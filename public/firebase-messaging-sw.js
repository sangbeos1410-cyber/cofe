importScripts("/firebase-config.js");
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js");

firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging=firebase.messaging();

messaging.onBackgroundMessage(payload=>{
  const d=payload.data||{};
  self.registration.showNotification(d.title||"🔔 Đơn mới",{
    body:d.body||"Có khách vừa đặt món.",
    icon:"/icon-192.png",badge:"/icon-192.png",
    tag:d.orderId||("order-"+Date.now()),renotify:true,
    data:{url:d.url||"/admin.html"}
  });
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||"/admin.html",self.location.origin).href;
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const c of list){if(c.url.startsWith(self.location.origin)&&"focus"in c){c.navigate(target);return c.focus()}}
    return clients.openWindow(target);
  }));
});
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
