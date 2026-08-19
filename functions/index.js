const {onCall, HttpsError}=require("firebase-functions/v2/https");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue,Timestamp}=require("firebase-admin/firestore");
const {getMessaging}=require("firebase-admin/messaging");
const crypto=require("crypto");

initializeApp();
const db=getFirestore();
const REGION="asia-southeast1";
const ADMIN_EMAIL="sangbeos1410@gmail.com";

function isAdmin(req){
  return !!req.auth &&
    String(req.auth.token.email||"").toLowerCase()===ADMIN_EMAIL.toLowerCase();
}
function dateKeyVN(date=new Date()){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
function cleanTable(v){return String(v||"").trim().slice(0,20)}
function validItems(items){
  return Array.isArray(items)&&items.length>0&&items.length<=30&&items.every(x=>
    typeof x.menuId==="string" && /^[A-Za-z0-9_-]{1,30}$/.test(x.menuId) &&
    Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=20
  );
}

exports.createOrder=onCall(
  {
    region:REGION,
    enforceAppCheck:false,
    timeoutSeconds:10,
    memory:"256MiB"
  },
  async req=>{
    if(!req.auth){
      throw new HttpsError(
        "unauthenticated",
        "Thiết bị chưa xác thực."
      );
    }

    const {
      table,
      items,
      clientRequestId
    }=req.data||{};

    if(!validItems(items)){
      throw new HttpsError(
        "invalid-argument",
        "Danh sách món không hợp lệ."
      );
    }

    if(
      typeof clientRequestId!=="string" ||
      clientRequestId.length<8 ||
      clientRequestId.length>100
    ){
      throw new HttpsError(
        "invalid-argument",
        "Mã yêu cầu không hợp lệ."
      );
    }

    const requestHash=crypto
      .createHash("sha256")
      .update(req.auth.uid+":"+clientRequestId)
      .digest("hex");

    const requestRef=
      db.collection("requestIds").doc(requestHash);

    const orderRef=
      db.collection("orders").doc();

    const statsRef=
      db.collection("dailyStats").doc(dateKeyVN());

    const result=await db.runTransaction(async tx=>{
      const prior=await tx.get(requestRef);

      if(prior.exists){
        return {
          orderId:prior.data().orderId,
          total:prior.data().total||0,
          deduplicated:true
        };
      }

      const uniqueIds=[
        ...new Set(items.map(x=>x.menuId))
      ];

      const refs=uniqueIds.map(id=>
        db.collection("menu").doc(id)
      );

      const snaps=await Promise.all(
        refs.map(ref=>tx.get(ref))
      );

      const menuMap=new Map();

      snaps.forEach(snap=>{
        if(
          !snap.exists ||
          snap.data().active!==true
        ){
          throw new HttpsError(
            "failed-precondition",
            "Có món đã ngừng bán."
          );
        }

        menuMap.set(
          snap.id,
          snap.data()
        );
      });

      let total=0;
      let cups=0;

      const safeItems=items.map(item=>{
        const menuItem=
          menuMap.get(item.menuId);

        const price=
          Number(menuItem.price);

        const subtotal=
          price*item.quantity;

        total+=subtotal;
        cups+=item.quantity;

        return {
          menuId:item.menuId,
          name:String(menuItem.name).slice(0,100),
          price,
          quantity:item.quantity,
          subtotal
        };
      });

      if(total<0 || total>100000000){
        throw new HttpsError(
          "invalid-argument",
          "Tổng tiền không hợp lệ."
        );
      }

      const now=
        FieldValue.serverTimestamp();

      const dateKey=
        dateKeyVN();

      const cleanTableValue=
        cleanTable(table);

      tx.create(orderRef,{
        table:cleanTableValue,
        items:safeItems,
        total,
        cups,
        status:"new",
        dateKey,
        createdAt:now,
        updatedAt:now,
        customerUid:req.auth.uid
      });

      tx.set(
        statsRef,
        {
          date:dateKey,
          cups:FieldValue.increment(cups),
          revenue:FieldValue.increment(total),
          updatedAt:now
        },
        {
          merge:true
        }
      );

      tx.create(requestRef,{
        orderId:orderRef.id,
        total,
        createdAt:now
      });

      return {
        orderId:orderRef.id,
        total,
        table:cleanTableValue,
        items:safeItems,
        deduplicated:false
      };
    });

    // Nếu đây là request retry bị trùng, không gửi push lần nữa.
    if(!result.deduplicated){
      try{
        await sendOrderNotification_(
          result.orderId,
          result
        );
      }catch(error){
        console.error(
          "Push notification error:",
          error
        );
      }
    }

    return {
      orderId:result.orderId,
      total:result.total,
      deduplicated:result.deduplicated||false
    };
  }
);

async function sendOrderNotification_(
  orderId,
  order
){
  const devices=
    await db
      .collection("adminDevices")
      .get();

  if(devices.empty){
    return;
  }

  const tokenDocs=devices.docs
    .map(doc=>({
      ref:doc.ref,
      token:doc.data().token
    }))
    .filter(x=>Boolean(x.token));

  if(!tokenDocs.length){
    return;
  }

  const tokens=
    tokenDocs.map(x=>x.token);

  const itemText=
    (order.items||[])
      .map(item=>
        `${item.quantity} × ${item.name}`
      )
      .join(", ")
      .slice(0,500);

  const tableText=
    order.table
      ? `Bàn ${order.table}`
      : "Đơn mới";

  const body=
    `${itemText} • `+
    `${new Intl.NumberFormat("vi-VN")
      .format(order.total||0)}đ`;

  const response=
    await getMessaging()
      .sendEachForMulticast({
        tokens,
        data:{
          title:
            `🔔 ĐƠN MỚI${order.table ? " - Bàn "+order.table : ""}`,
          body,
          orderId:String(orderId),
          url:"/admin.html"
        },
        webpush:{
          headers:{
            Urgency:"high"
          }
        }
      });

  // Dọn token FCM không còn hợp lệ.
  const batch=db.batch();
  let hasDeletes=false;

  response.responses.forEach((r,index)=>{
    if(
      !r.success &&
      [
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token"
      ].includes(r.error?.code)
    ){
      batch.delete(tokenDocs[index].ref);
      hasDeletes=true;
    }
  });

  if(hasDeletes){
    await batch.commit();
  }
}

exports.testAdminPush=onCall({region:REGION,enforceAppCheck:false},async req=>{
  if(!isAdmin(req))throw new HttpsError("permission-denied","Không có quyền Admin.");
  const devices=await db.collection("adminDevices").get();
  const tokens=devices.docs.map(d=>d.data().token).filter(Boolean);
  if(!tokens.length)throw new HttpsError("failed-precondition","Chưa có thiết bị nhận thông báo.");
  await getMessaging().sendEachForMulticast({
    tokens,data:{title:"🔔 Cheng Coffee","body":"Thông báo Firebase hoạt động bình thường.","orderId":"TEST","url":"/admin.html"},
    webpush:{headers:{Urgency:"high"}}
  });
  return {ok:true};
});
