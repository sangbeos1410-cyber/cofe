let MENU=[];
let editingId=null;
let unsubOrders=null, unsubMenu=null, unsubStats=null, unsubHistory=null;

const money=n=>new Intl.NumberFormat("vi-VN").format(Number(n))+"đ";
if(!firebase.apps.length) firebase.initializeApp(self.FIREBASE_CONFIG);
const auth=firebase.auth();
const db=firebase.firestore();
const functions=firebase.app().functions(self.FIREBASE_FUNCTIONS_REGION||"asia-southeast1");
let firebaseMessaging=null;
let currentFcmToken=localStorage.getItem("fcmToken")||"";

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

function showAdmin(){loginPanel.hidden=true;adminApp.hidden=false;logoutBtn.hidden=false}
function showLogin(){adminApp.hidden=true;loginPanel.hidden=false;logoutBtn.hidden=true}
function bool(v){return v===true||String(v).toLowerCase()==="true"}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function attr(v){return String(v??"").replaceAll("'","\\'")}
function msg(t){document.getElementById("message").textContent=t}

function isAdminUser(user){
  return !!user && String(user.email||"").toLowerCase()===String(self.ADMIN_EMAIL||"").toLowerCase();
}

loginForm.addEventListener("submit",async e=>{
  e.preventDefault();loginMessage.textContent="Đang đăng nhập...";
  try{
    const cred=await auth.signInWithEmailAndPassword(self.ADMIN_EMAIL,password.value);
    if(!isAdminUser(cred.user)){await auth.signOut();throw new Error("Tài khoản không có quyền Admin.");}
    password.value="";loginMessage.textContent="";
  }catch(err){loginMessage.textContent=humanAuthError(err)}
});
logoutBtn.addEventListener("click",()=>auth.signOut());

auth.onAuthStateChanged(user=>{
  stopRealtime();
  if(isAdminUser(user)){showAdmin();startRealtime();refreshPushState()}
  else showLogin();
});

function humanAuthError(e){
  const c=e?.code||"";
  if(c.includes("wrong-password")||c.includes("invalid-credential"))return "Sai mật khẩu.";
  if(c.includes("too-many-requests"))return "Đăng nhập sai quá nhiều lần. Hãy thử lại sau.";
  return e?.message||"Không đăng nhập được.";
}

function startRealtime(){
  loadMenuRealtime();
  loadOrdersRealtime();
  loadStatsRealtime();
  loadHistoryRealtime();
}
function stopRealtime(){
  [unsubOrders,unsubMenu,unsubStats,unsubHistory].forEach(fn=>{try{if(fn)fn()}catch(_){}});
  unsubOrders=unsubMenu=unsubStats=unsubHistory=null;
}

function loadMenuRealtime(){
  unsubMenu=db.collection("menu").onSnapshot(s=>{
    MENU=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"vi"));
    menuTable.innerHTML=MENU.map(i=>`<tr><td><strong>${esc(i.id)}</strong></td><td>${esc(i.name)}</td><td>${money(i.price)}</td><td>${bool(i.active)?"Đang bán":"Đã ẩn"}</td><td><div class="row-actions"><button class="secondary" onclick="editItem('${attr(i.id)}')">Sửa</button><button class="secondary" onclick="toggleItem('${attr(i.id)}')">${bool(i.active)?"Ẩn":"Hiện"}</button><button class="danger" onclick="deleteItem('${attr(i.id)}')">Xóa</button></div></td></tr>`).join("");
  },e=>msg(e.message));
}

function todayKey(){
  const d=new Date(), y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function loadStatsRealtime(){
  unsubStats=db.collection("dailyStats").doc(todayKey()).onSnapshot(d=>{
    const x=d.exists?d.data():{};
    todayCups.textContent=x.cups||0;todayRevenue.textContent=money(x.revenue||0);
  });
}
function loadHistoryRealtime(){
  unsubHistory=db.collection("dailyStats").orderBy("date","desc").limit(31).onSnapshot(s=>{
    historyTable.innerHTML=s.docs.map(d=>{const x=d.data();return `<tr><td>${esc(x.date||d.id)}</td><td>${x.cups||0}</td><td>${money(x.revenue||0)}</td></tr>`}).join("")||'<tr><td colspan="3">Chưa có lịch sử.</td></tr>';
  });
}
function loadOrdersRealtime(){
  unsubOrders=db.collection("orders").where("dateKey","==",todayKey()).orderBy("createdAt","desc").limit(100).onSnapshot(s=>{
    const orders=s.docs.map(d=>({orderId:d.id,...d.data()}));
    const list=document.getElementById("ordersList");
    list.innerHTML=orders.map(o=>`<article class="order-card">
      <div class="order-head"><div><div class="order-id">${esc(o.orderId)}</div><div class="order-meta">${o.table?"Bàn "+esc(o.table)+" • ":""}${o.createdAt?.toDate?o.createdAt.toDate().toLocaleTimeString("vi-VN"):"Đang cập nhật..."}</div></div><div class="order-total">${money(o.total||0)}</div></div>
      <div class="order-items">${(o.items||[]).map(i=>`<div class="order-item-row"><div><div class="order-item-name">${esc(i.name)}</div><div class="order-item-detail">${i.quantity||0} × ${money(i.price||0)}</div></div><strong>${money(i.subtotal||0)}</strong></div>`).join("")}</div>
      <div class="actions"><button class="secondary" onclick="setOrderStatus('${attr(o.orderId)}','preparing')">Đang làm</button><button class="primary" onclick="setOrderStatus('${attr(o.orderId)}','done')">Hoàn thành</button><span class="status-badge">${esc(statusText(o.status))}</span></div>
    </article>`).join("")||'<div class="empty-state">Chưa có đơn hàng nào hôm nay.</div>';
  },e=>msg(e.message));
}
function statusText(s){return s==="done"?"Hoàn thành":s==="preparing"?"Đang làm":"Mới"}
async function setOrderStatus(id,status){try{await db.collection("orders").doc(id).update({status,updatedAt:firebase.firestore.FieldValue.serverTimestamp()})}catch(e){msg(e.message)}}

function editItem(id){const i=MENU.find(x=>x.id===id);if(!i)return;editingId=id;itemId.value=i.id;itemName.value=i.name;itemPrice.value=i.price;itemActive.checked=bool(i.active);itemId.disabled=true;formTitle.textContent="Sửa món";saveBtn.textContent="Lưu thay đổi";cancelBtn.hidden=false}
function resetForm(){editingId=null;menuForm.reset();itemActive.checked=true;itemId.disabled=false;formTitle.textContent="Thêm món mới";saveBtn.textContent="Thêm món";cancelBtn.hidden=true}
async function toggleItem(id){const i=MENU.find(x=>x.id===id);if(!i)return;await db.collection("menu").doc(id).update({active:!bool(i.active),updatedAt:firebase.firestore.FieldValue.serverTimestamp()})}
async function deleteItem(id){const i=MENU.find(x=>x.id===id);if(i&&confirm(`Xóa món "${i.name}"?`))await db.collection("menu").doc(id).delete()}
menuForm.addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    const id=(editingId||itemId.value.trim().toUpperCase()),name=itemName.value.trim(),price=Number(itemPrice.value),active=itemActive.checked;
    if(!/^[A-Z0-9_-]{1,30}$/.test(id))throw new Error("Mã món không hợp lệ.");
    if(!name||name.length>100)throw new Error("Tên món không hợp lệ.");
    if(!Number.isInteger(price)||price<0||price>10000000)throw new Error("Giá không hợp lệ.");
    await db.collection("menu").doc(id).set({name,price,active,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    resetForm();msg("Đã lưu.");
  }catch(e){msg(e.message)}
});
cancelBtn.addEventListener("click",resetForm);
reloadAll?.addEventListener("click",()=>msg("Dữ liệu đang cập nhật realtime."));
document.getElementById("reloadOrdersBtn")?.addEventListener("click",()=>msg("Đơn hàng đang cập nhật realtime."));

changePasswordForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const user=auth.currentUser,current=currentPassword.value,next=newPassword.value,confirmNext=confirmPassword.value;
  if(next.length<8){passwordMessage.textContent="Mật khẩu mới nên có ít nhất 8 ký tự.";return}
  if(next!==confirmNext){passwordMessage.textContent="Hai lần nhập mật khẩu không khớp.";return}
  try{
    const credential=firebase.auth.EmailAuthProvider.credential(user.email,current);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(next);
    currentPassword.value=newPassword.value=confirmPassword.value="";
    passwordMessage.textContent="Đổi mật khẩu thành công.";
  }catch(e){passwordMessage.textContent=humanAuthError(e)}
});

// Firebase Push: token chỉ Admin mới được ghi vào Firestore.
function firebaseConfigured(){const c=self.FIREBASE_CONFIG||{};return c.apiKey&&c.projectId&&self.FIREBASE_VAPID_KEY&&!String(c.apiKey).startsWith("DIEN_")&&!String(self.FIREBASE_VAPID_KEY).startsWith("DIEN_")}
function setPushStatus(t){const e=document.getElementById("pushStatusBadge");if(e)e.textContent=t}
function setPushMessage(t){const e=document.getElementById("pushMessage");if(e)e.textContent=t}
async function initFirebaseMessaging(){
  if(!("serviceWorker" in navigator))throw new Error("Trình duyệt không hỗ trợ Service Worker.");
  if(!("Notification" in window))throw new Error("Trình duyệt không hỗ trợ thông báo.");
  if(!firebaseConfigured())throw new Error("Chưa cấu hình Firebase.");
  firebaseMessaging=firebase.messaging();
  const reg=await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  return reg;
}
async function enablePushNotifications(){
  try{
    const reg=await initFirebaseMessaging();
    if(await Notification.requestPermission()!=="granted")throw new Error("Bạn chưa cho phép thông báo.");
    const token=await firebaseMessaging.getToken({vapidKey:self.FIREBASE_VAPID_KEY,serviceWorkerRegistration:reg});
    if(!token)throw new Error("Không tạo được FCM token.");
    await db.collection("adminDevices").doc(await sha256(token)).set({token,uid:auth.currentUser.uid,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    currentFcmToken=token;localStorage.setItem("fcmToken",token);setPushStatus("Đã bật");setPushMessage("Đã đăng ký thông báo.");
  }catch(e){setPushMessage(e.message)}
}
async function disablePushNotifications(){
  try{
    if(currentFcmToken)await db.collection("adminDevices").doc(await sha256(currentFcmToken)).delete();
    if(firebaseMessaging)await firebaseMessaging.deleteToken();
    currentFcmToken="";localStorage.removeItem("fcmToken");setPushStatus("Đã tắt");setPushMessage("Đã tắt thông báo.");
  }catch(e){setPushMessage(e.message)}
}
async function testPushNotification(){
  try{setPushMessage("Đang gửi thử...");await functions.httpsCallable("testAdminPush")({});setPushMessage("Đã gửi thông báo thử.")}catch(e){setPushMessage(e.message)}
}
async function sha256(text){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function refreshPushState(){if(!firebaseConfigured())setPushStatus("Chưa cấu hình");else if(Notification.permission==="granted"&&currentFcmToken)setPushStatus("Đã bật");else setPushStatus("Chưa bật")}
document.getElementById("enablePushBtn")?.addEventListener("click",enablePushNotifications);
document.getElementById("disablePushBtn")?.addEventListener("click",disablePushNotifications);
document.getElementById("testPushBtn")?.addEventListener("click",testPushNotification);

// PWA install
let deferredInstallPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;const b=document.getElementById("installPwaBtn");if(b)b.hidden=false});
document.getElementById("installPwaBtn")?.addEventListener("click",async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null}});
