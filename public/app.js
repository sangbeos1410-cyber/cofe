let MENU = [];
let cart = JSON.parse(localStorage.getItem("cart") || "[]");
let submitting = false;

const money = n => new Intl.NumberFormat("vi-VN").format(Number(n)) + "đ";
const cfg = self.FIREBASE_CONFIG || {};

if (!firebase.apps.length) firebase.initializeApp(cfg);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.app().functions(self.FIREBASE_FUNCTIONS_REGION || "asia-southeast1");
const createOrderFn = functions.httpsCallable("createOrder");

firebase.firestore().enablePersistence({synchronizeTabs:true}).catch(()=>{});

async function ensureCustomerAuth(){
  if (auth.currentUser) return auth.currentUser;
  const cred = await auth.signInAnonymously();
  return cred.user;
}

function loadMenu(){
  document.getElementById("menuStatus").textContent = "Đang tải menu...";
  db.collection("menu").where("active","==",true).onSnapshot(snapshot=>{
    MENU = snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>
      String(a.name||"").localeCompare(String(b.name||""),"vi")
    );
    document.getElementById("menuStatus").textContent = "";
    renderMenu(); renderCart();
  }, err=>{
    console.error(err);
    document.getElementById("menuStatus").textContent = "Không tải được menu. Vui lòng thử lại.";
  });
}

function renderMenu(){
  const el=document.getElementById("menu");
  el.innerHTML=MENU.map(i=>`<article class="card"><h3>${esc(i.name)}</h3><div class="price">${money(i.price)}</div><button class="primary" onclick="add('${attr(i.id)}')">+ Thêm món</button></article>`).join("")||"<p>Chưa có món đang bán.</p>";
}
function add(id){const x=cart.find(c=>c.id===id);if(x)x.qty=Math.min(20,x.qty+1);else cart.push({id,qty:1});save()}
function change(id,d){const x=cart.find(c=>c.id===id);if(!x)return;x.qty+=d;if(x.qty<=0)cart=cart.filter(c=>c.id!==id);save()}
function save(){localStorage.setItem("cart",JSON.stringify(cart));renderCart()}

function renderCart(){
  cart=cart.filter(c=>MENU.some(m=>m.id===c.id));
  const el=document.getElementById("cartItems");let total=0;
  if(!cart.length){el.innerHTML="<p>Chưa có món nào.</p>";document.getElementById("total").textContent="0đ";return}
  el.innerHTML=cart.map(c=>{
    const i=MENU.find(m=>m.id===c.id),sub=Number(i.price)*c.qty;total+=sub;
    return `<div class="cart-item"><div><strong>${esc(i.name)}</strong><br><small>${money(i.price)} × ${c.qty} = ${money(sub)}</small></div><div class="qty"><button onclick="change('${attr(i.id)}',-1)">−</button><span>${c.qty}</span><button onclick="change('${attr(i.id)}',1)">+</button></div></div>`
  }).join("");
  document.getElementById("total").textContent=money(total);
}

async function submitOrder(){
  const msg=document.getElementById("message"),btn=document.getElementById("orderBtn");
  if(submitting)return;
  if(!cart.length){msg.textContent="Vui lòng chọn món.";return}
  const table=document.getElementById("tableNumber").value.trim().slice(0,20);
  const items=cart.map(c=>({menuId:c.id,quantity:Number(c.qty)}));
  try{
    submitting=true;btn.disabled=true;msg.textContent="Đang gửi đơn...";
    await ensureCustomerAuth();
    const result=await createOrderFn({table,items,clientRequestId:crypto.randomUUID ? crypto.randomUUID() : String(Date.now())});
    cart=[];save();document.getElementById("tableNumber").value="";
    msg.textContent="Đặt món thành công! Mã đơn: "+(result.data.orderId||"");
  }catch(e){
    console.error(e);
    msg.textContent=e.message?.replace("internal","Có lỗi khi đặt món") || "Không gửi được đơn. Vui lòng thử lại.";
  }finally{submitting=false;btn.disabled=false}
}

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function attr(v){return String(v??"").replaceAll("'","\\'")}

document.getElementById("orderBtn").addEventListener("click",submitOrder);
ensureCustomerAuth().then(loadMenu).catch(e=>{
  console.error(e);
  document.getElementById("menuStatus").textContent="Không kết nối được hệ thống.";
});
