(()=>{const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat("vi-VN").format(Number(n)||0)+"đ";let MENU=[],editingId=null,unsubs=[],messaging=null,token=localStorage.getItem("fcmToken")||"";
if(!firebase.apps.length)firebase.initializeApp(self.FIREBASE_CONFIG);const auth=firebase.auth(),db=firebase.firestore(),functions=firebase.app().functions(self.FIREBASE_FUNCTIONS_REGION||"asia-southeast1");auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
const isAdmin=u=>u&&String(u.email||"").toLowerCase()===String(self.ADMIN_EMAIL||"").toLowerCase(),today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"),slug=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function showLogin(){$("loginPanel").hidden=false;$("adminApp").hidden=true;$("logoutBtn").hidden=true}function showAdmin(){$("loginPanel").hidden=true;$("adminApp").hidden=false;$("logoutBtn").hidden=false}function stop(){unsubs.forEach(f=>{try{f()}catch{}});unsubs=[]}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".tabp").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("tab-"+b.dataset.tab).classList.add("active")});
$("loginForm").onsubmit=async e=>{e.preventDefault();try{const c=await auth.signInWithEmailAndPassword(self.ADMIN_EMAIL,$("password").value);if(!isAdmin(c.user)){await auth.signOut();throw Error("Không có quyền Admin.")}$("password").value="";$("loginMessage").textContent=""}catch(err){$("loginMessage").textContent=err.code==="auth/invalid-credential"?"Sai mật khẩu.":err.message}};
$("logoutBtn").onclick=()=>auth.signOut();auth.onAuthStateChanged(u=>{stop();if(isAdmin(u)){showAdmin();start()}else showLogin()});
function start(){loadStoreSettings();unsubs.push(db.collection("menu").onSnapshot(s=>{MENU=s.docs.map(d=>({id:d.id,...d.data(),sizes:Array.isArray(d.data().sizes)?d.data().sizes:[],toppings:Array.isArray(d.data().toppings)?d.data().toppings:[]}));renderMenu()}));unsubs.push(db.collection("orders").where("dateKey","==",today()).orderBy("createdAt","desc").limit(100).onSnapshot(s=>{const a=s.docs.map(d=>({id:d.id,...d.data()}));$("todayOrders").textContent=a.length;renderOrders(a)},e=>$("ordersList").textContent=e.message));unsubs.push(db.collection("dailyStats").doc(today()).onSnapshot(d=>{const x=d.exists?d.data():{};$("todayCups").textContent=x.cups||0;$("todayRevenue").textContent=money(x.revenue||0)}));unsubs.push(db.collection("dailyStats").orderBy("date","desc").limit(31).onSnapshot(s=>$("historyTable").innerHTML=s.docs.map(d=>{const x=d.data();return`<tr><td>${x.date||d.id}</td><td>${x.orders||0}</td><td>${x.cups||0}</td><td>${money(x.revenue||0)}</td></tr>`}).join("")))}
function renderOrders(a){$("ordersList").innerHTML=a.map(o=>`<div class="order"><div class="order-head"><div><b>${o.id}</b><div class="muted">${o.table?"Bàn "+esc(o.table)+" • ":""}${o.createdAt?.toDate?o.createdAt.toDate().toLocaleTimeString("vi-VN"):""}</div></div><b>${money(o.total)}</b></div>${(o.items||[]).map(i=>`<div class="item"><div><b>${esc(i.name)} • ${esc(i.sizeName||i.sizeId||"")}</b><div class="muted">${i.quantity} × ${money(i.unitPrice||i.price||0)}${(i.toppings||[]).length?" • "+esc(i.toppings.map(t=>t.name).join(", ")):""}</div>${i.note?`<div class="muted"><strong>Ghi chú:</strong> ${esc(i.note)}</div>`:""}</div><b>${money(i.subtotal)}</b></div>`).join("")}${o.orderNote?`<div class="order-note-admin"><strong>Ghi chú đơn:</strong> ${esc(o.orderNote)}</div>`:""}<div class="actions"><button data-id="${o.id}" data-st="preparing">Đang làm</button><button data-id="${o.id}" data-st="done">Hoàn thành</button><span>${o.status||"new"}</span></div></div>`).join("")||"Chưa có đơn.";document.querySelectorAll("[data-st]").forEach(b=>b.onclick=()=>db.collection("orders").doc(b.dataset.id).update({status:b.dataset.st,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}))}
function renderMenu(){$("menuTable").innerHTML=MENU.map(i=>`<tr><td>${i.id}</td><td>${esc(i.name)}</td><td>${esc(i.sizes.map(s=>`${s.id}:${money(s.price)}`).join(" • "))}</td><td>${esc(i.toppings.map(t=>`${t.name}:${money(t.price)}`).join(" • ")||"Không")}</td><td>${i.active?"Đang bán":"Đã ẩn"}</td><td><div class="actions"><button data-a="edit" data-id="${i.id}">Sửa</button><button data-a="toggle" data-id="${i.id}">${i.active?"Ẩn":"Hiện"}</button><button data-a="delete" data-id="${i.id}">Xóa</button></div></td></tr>`).join("");document.querySelectorAll("[data-a]").forEach(b=>b.onclick=async()=>{const i=MENU.find(x=>x.id===b.dataset.id);if(b.dataset.a==="edit")fill(i);if(b.dataset.a==="toggle")await db.collection("menu").doc(i.id).update({active:!i.active,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});if(b.dataset.a==="delete"&&confirm("Xóa món?"))await db.collection("menu").doc(i.id).delete()})}
function fill(i){editingId=i.id;$("itemId").value=i.id;$("itemId").disabled=true;$("itemName").value=i.name||"";$("itemCategory").value=i.category||"";$("itemDescription").value=i.description||"";for(const s of["S","M","L"])$( "size"+s).value=i.sizes.find(x=>x.id===s)?.price??"";$("toppingsText").value=i.toppings.map(t=>`${t.name} | ${t.price}`).join("\n");$("itemActive").checked=!!i.active;$("formTitle").textContent="Sửa món";$("saveBtn").textContent="Lưu";$("cancelBtn").hidden=false}
function reset(){editingId=null;$("menuForm").reset();$("itemId").disabled=false;$("itemActive").checked=true;$("formTitle").textContent="Thêm món mới";$("saveBtn").textContent="Thêm món";$("cancelBtn").hidden=true}$("cancelBtn").onclick=reset;
$("menuForm").onsubmit=async e=>{e.preventDefault();try{const id=(editingId||$("itemId").value.trim().toUpperCase()),name=$("itemName").value.trim();const sizes=[];for(const s of["S","M","L"]){const v=$("size"+s).value;if(v!=="")sizes.push({id:s,name:s,price:Number(v)})}if(!sizes.length)throw Error("Phải có ít nhất 1 size.");const toppings=$("toppingsText").value.split("\n").map(x=>x.trim()).filter(Boolean).map((line,n)=>{const [name,p]=line.split("|").map(x=>x.trim());if(!name||!Number.isInteger(Number(p)))throw Error("Topping dòng "+(n+1)+" không hợp lệ.");return{id:slug(name)||"tp"+n,name,price:Number(p)}});await db.collection("menu").doc(id).set({name,category:$("itemCategory").value.trim(),description:$("itemDescription").value.trim(),sizes,toppings,active:$("itemActive").checked,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});reset();$("message").textContent="Đã lưu."}catch(err){$("message").textContent=err.message}};

function safeUrlInput(v){
  v=String(v||"").trim();
  if(!v)return "";
  if(!/^https?:\/\//i.test(v))throw Error("Facebook/Zalo phải bắt đầu bằng http:// hoặc https://");
  return v.slice(0,300);
}
function loadStoreSettings(){
  unsubs.push(db.collection("storeSettings").doc("contact").onSnapshot(d=>{
    const x=d.exists?d.data():{};
    $("storeName").value=x.name||"CHENG COFFEE";
    $("storePhone").value=x.phone||"";
    $("storeHours").value=x.openingHours||"";
    $("storeAddress").value=x.address||"";
    $("storeFacebook").value=x.facebook||"";
    $("storeZalo").value=x.zalo||"";
    $("storeTagline").value=x.tagline||"Một chút cà phê, một chút bình yên.";
  },e=>$("storeMessage").textContent=e.message));
}
$("storeForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    const data={
      name:String($("storeName").value||"").trim().slice(0,100),
      phone:String($("storePhone").value||"").trim().slice(0,30),
      openingHours:String($("storeHours").value||"").trim().slice(0,100),
      address:String($("storeAddress").value||"").trim().slice(0,200),
      facebook:safeUrlInput($("storeFacebook").value),
      zalo:safeUrlInput($("storeZalo").value),
      tagline:String($("storeTagline").value||"").trim().slice(0,180),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
    if(!data.name)throw Error("Tên quán không được để trống.");
    await db.collection("storeSettings").doc("contact").set(data);
    $("storeMessage").textContent="Đã lưu thông tin quán.";
  }catch(err){$("storeMessage").textContent=err.message}
});

$("changePasswordForm").onsubmit=async e=>{e.preventDefault();try{if($("newPassword").value!==$("confirmPassword").value)throw Error("Hai mật khẩu không khớp.");const u=auth.currentUser;await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email,$("currentPassword").value));await u.updatePassword($("newPassword").value);$("passwordMessage").textContent="Đổi mật khẩu thành công."}catch(err){$("passwordMessage").textContent=err.message}};
async function sha(t){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
$("enablePushBtn").onclick=async()=>{try{messaging=firebase.messaging();const r=await navigator.serviceWorker.register("/firebase-messaging-sw.js");if(await Notification.requestPermission()!=="granted")throw Error("Chưa cho phép thông báo.");token=await messaging.getToken({vapidKey:self.FIREBASE_VAPID_KEY,serviceWorkerRegistration:r});await db.collection("adminDevices").doc(await sha(token)).set({token,uid:auth.currentUser.uid,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});localStorage.setItem("fcmToken",token);$("pushStatusBadge").textContent="Đã bật"}catch(err){$("pushMessage").textContent=err.message}};
$("disablePushBtn").onclick=async()=>{if(token)await db.collection("adminDevices").doc(await sha(token)).delete();token="";localStorage.removeItem("fcmToken");$("pushStatusBadge").textContent="Đã tắt"};
$("testPushBtn").onclick=async()=>{try{await functions.httpsCallable("testAdminPush")({});$("pushMessage").textContent="Đã gửi thử."}catch(err){$("pushMessage").textContent=err.message}};showLogin()})();