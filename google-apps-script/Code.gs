const MENU_SHEET = "MENU";
const ORDER_SHEET = "DON_HANG";
const HISTORY_SHEET = "LICH_SU";
const FCM_TOKEN_SHEET = "FCM_TOKENS";
const ADMIN_PASSWORD_KEY = "ADMIN_PASSWORD";
const SESSION_PREFIX = "ADMIN_SESSION_";
const SESSION_MINUTES = 120;

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let menu = ss.getSheetByName(MENU_SHEET);
  if (!menu) menu = ss.insertSheet(MENU_SHEET);
  if (menu.getLastRow() === 0) {
    menu.appendRow(["Mã", "Tên món", "Giá", "Đang bán"]);
    menu.getRange(2, 1, 5, 4).setValues([
      ["CF01", "Cà phê sữa", 25000, true],
      ["CF02", "Bạc xỉu", 30000, true],
      ["T01", "Trà đào", 30000, true],
      ["T02", "Trà tắc", 20000, true],
      ["N01", "Nước cam", 35000, true]
    ]);
  }

  let orders = ss.getSheetByName(ORDER_SHEET);
  if (!orders) orders = ss.insertSheet(ORDER_SHEET);
  if (orders.getLastRow() === 0) {
    orders.appendRow(["Thời gian","Mã đơn","Bàn","Mã món","Tên món","Số lượng","Đơn giá","Thành tiền"]);
  }

  let history = ss.getSheetByName(HISTORY_SHEET);
  if (!history) history = ss.insertSheet(HISTORY_SHEET);
  if (history.getLastRow() === 0) {
    history.appendRow(["Ngày","Số cốc","Doanh thu"]);
  }

  let fcmTokens = ss.getSheetByName(FCM_TOKEN_SHEET);
  if (!fcmTokens) fcmTokens = ss.insertSheet(FCM_TOKEN_SHEET);
  if (fcmTokens.getLastRow() === 0) {
    fcmTokens.appendRow(["Token", "Thiết bị", "Cập nhật lúc"]);
  }

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(ADMIN_PASSWORD_KEY)) {
    props.setProperty(ADMIN_PASSWORD_KEY, "123456");
  }
}

function setAdminPassword(newPassword) {
  newPassword = String(newPassword || "").trim();
  if (newPassword.length < 4) throw new Error("Mật khẩu phải có ít nhất 4 ký tự.");
  PropertiesService.getScriptProperties().setProperty(ADMIN_PASSWORD_KEY, newPassword);
}

function doGet(e) {
  try {
    setup();
    const action = String(e.parameter.action || "").trim();
    let result;

    switch (action) {
      case "getMenu":
        result = getMenu_();
        break;
      case "adminLogin":
        result = adminLogin_(e.parameter.password || "");
        break;
      case "validateSession":
        requireAdmin_(e.parameter.token);
        result = {ok:true};
        break;
      case "getMenuAdmin":
        requireAdmin_(e.parameter.token);
        result = getMenu_();
        break;
      case "addMenu":
        requireAdmin_(e.parameter.token);
        result = addMenu_(e.parameter);
        break;
      case "updateMenu":
        requireAdmin_(e.parameter.token);
        result = updateMenu_(e.parameter);
        break;
      case "deleteMenu":
        requireAdmin_(e.parameter.token);
        result = deleteMenu_(e.parameter);
        break;
      case "getDashboard":
        requireAdmin_(e.parameter.token);
        result = getDashboard_();
        break;
      case "getTodayOrders":
        requireAdmin_(e.parameter.token);
        result = getTodayOrders_();
        break;
      case "getHistory":
        requireAdmin_(e.parameter.token);
        result = getHistory_();
        break;
      case "changeAdminPassword":
        requireAdmin_(e.parameter.token);
        result = changeAdminPassword_(e.parameter);
        break;
      case "registerFcmToken":
        requireAdmin_(e.parameter.token);
        result = registerFcmToken_(e.parameter);
        break;
      case "unregisterFcmToken":
        requireAdmin_(e.parameter.token);
        result = unregisterFcmToken_(e.parameter);
        break;
      case "testFcmPush":
        requireAdmin_(e.parameter.token);
        result = testFcmPush_(e.parameter);
        break;
      case "createOrder":
        result = createOrder_(e.parameter.data || "");
        break;
      default:
        result = {ok:true,message:"Quan Nuoc API OK"};
    }

    return jsonp_(result, e.parameter.callback);
  } catch (err) {
    return jsonp_({ok:false,message:String(err.message || err)}, e.parameter.callback);
  }
}

function adminLogin_(password) {
  const stored = PropertiesService.getScriptProperties().getProperty(ADMIN_PASSWORD_KEY) || "";
  if (String(password) !== stored) throw new Error("Mật khẩu không đúng.");

  const token = Utilities.getUuid().replace(/-/g, "");
  const expires = Date.now() + SESSION_MINUTES * 60 * 1000;

  CacheService.getScriptCache().put(
    SESSION_PREFIX + token,
    String(expires),
    SESSION_MINUTES * 60
  );

  return {ok:true,token,expires};
}

function requireAdmin_(token) {
  token = String(token || "").trim();
  if (!token) throw new Error("Bạn chưa đăng nhập Admin.");

  const value = CacheService.getScriptCache().get(SESSION_PREFIX + token);
  if (!value) throw new Error("Phiên đăng nhập đã hết hạn.");

  const expires = Number(value);
  if (!expires || Date.now() > expires) {
    CacheService.getScriptCache().remove(SESSION_PREFIX + token);
    throw new Error("Phiên đăng nhập đã hết hạn.");
  }
}


function changeAdminPassword_(p) {
  const currentPassword = String(p.currentPassword || "");
  const newPassword = String(p.newPassword || "").trim();

  if (newPassword.length < 4) {
    throw new Error("Mật khẩu mới phải có ít nhất 4 ký tự.");
  }

  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty(ADMIN_PASSWORD_KEY) || "";

  if (currentPassword !== stored) {
    throw new Error("Mật khẩu hiện tại không đúng.");
  }

  if (currentPassword === newPassword) {
    throw new Error("Mật khẩu mới phải khác mật khẩu hiện tại.");
  }

  props.setProperty(ADMIN_PASSWORD_KEY, newPassword);

  return {
    ok: true,
    message: "Đổi mật khẩu thành công."
  };
}

function getMenu_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MENU_SHEET);
  const last = s.getLastRow();
  if (last < 2) return {ok:true,menu:[]};

  const menu = s.getRange(2,1,last-1,4).getValues()
    .filter(r => String(r[0]).trim() !== "")
    .map(r => ({
      id:String(r[0]).trim(),
      name:String(r[1]).trim(),
      price:Number(r[2])||0,
      active:normalizeBool_(r[3])
    }));

  return {ok:true,menu};
}

function addMenu_(p) {
  const id=clean_(p.id).toUpperCase(), name=clean_(p.name), price=Number(p.price), active=normalizeBool_(p.active);
  if(!id||!name||!isFinite(price)||price<0) throw new Error("Dữ liệu món không hợp lệ.");
  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MENU_SHEET);
  if(findMenuRow_(s,id)!==-1) throw new Error("Mã món đã tồn tại.");
  s.appendRow([id,name,price,active]);
  return {ok:true};
}

function updateMenu_(p) {
  const id=clean_(p.id).toUpperCase(), name=clean_(p.name), price=Number(p.price), active=normalizeBool_(p.active);
  if(!id||!name||!isFinite(price)||price<0) throw new Error("Dữ liệu món không hợp lệ.");
  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MENU_SHEET);
  const row=findMenuRow_(s,id);
  if(row===-1) throw new Error("Không tìm thấy món.");
  s.getRange(row,1,1,4).setValues([[id,name,price,active]]);
  return {ok:true};
}

function deleteMenu_(p) {
  const id=clean_(p.id).toUpperCase();
  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MENU_SHEET);
  const row=findMenuRow_(s,id);
  if(row===-1) throw new Error("Không tìm thấy món.");
  s.deleteRow(row);
  return {ok:true};
}

function createOrder_(encodedData) {
  if(!encodedData) throw new Error("Không có dữ liệu đơn hàng.");
  const data=JSON.parse(decodeURIComponent(encodedData));
  if(!data.items||!Array.isArray(data.items)||!data.items.length) throw new Error("Đơn hàng không có món.");

  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDER_SHEET);
  const now=new Date();
  const rows=data.items.map(i=>[
    now,data.orderId||"",data.table||"",i.id||"",i.name||"",
    Number(i.quantity)||0,Number(i.price)||0,Number(i.subtotal)||0
  ]);
  s.getRange(s.getLastRow()+1,1,rows.length,8).setValues(rows);
  try { sendNewOrderPush_(data); } catch (err) { console.error("FCM: " + err); }
  return {ok:true,orderId:data.orderId||""};
}


// ===== FIREBASE CLOUD MESSAGING =====

function setupFirebaseServiceAccount() {
  // TẠM điền dữ liệu từ file Service Account JSON, chạy 1 lần,
  // sau đó xóa dữ liệu thật khỏi code và Deploy lại.
  const projectId = "DIEN_PROJECT_ID";
  const clientEmail = "DIEN_CLIENT_EMAIL";
  const privateKey = `DIEN_PRIVATE_KEY`;

  if(projectId.startsWith("DIEN_") || clientEmail.startsWith("DIEN_") || privateKey.startsWith("DIEN_")){
    throw new Error("Hãy điền Service Account trước.");
  }

  PropertiesService.getScriptProperties().setProperties({
    FCM_PROJECT_ID: projectId,
    FCM_CLIENT_EMAIL: clientEmail,
    FCM_PRIVATE_KEY: privateKey
  });
}

function registerFcmToken_(p){
  const token=clean_(p.fcmToken);
  if(!token) throw new Error("Không có FCM token.");
  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FCM_TOKEN_SHEET);
  const last=s.getLastRow();
  if(last>=2){
    const vals=s.getRange(2,1,last-1,1).getValues();
    for(let i=0;i<vals.length;i++){
      if(String(vals[i][0])===token){
        s.getRange(i+2,2,1,2).setValues([[clean_(p.deviceName),new Date()]]);
        return {ok:true};
      }
    }
  }
  s.appendRow([token,clean_(p.deviceName),new Date()]);
  return {ok:true};
}

function unregisterFcmToken_(p){
  removeFcmToken_(clean_(p.fcmToken));
  return {ok:true};
}

function removeFcmToken_(token){
  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FCM_TOKEN_SHEET);
  if(!s || s.getLastRow()<2) return;
  const vals=s.getRange(2,1,s.getLastRow()-1,1).getValues();
  for(let i=vals.length-1;i>=0;i--){
    if(String(vals[i][0])===String(token)) s.deleteRow(i+2);
  }
}

function getAllFcmTokens_(){
  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FCM_TOKEN_SHEET);
  if(!s || s.getLastRow()<2) return [];
  return s.getRange(2,1,s.getLastRow()-1,1).getValues()
    .map(r=>String(r[0]).trim()).filter(Boolean);
}

function testFcmPush_(p){
  const token=clean_(p.fcmToken);
  if(!token) throw new Error("Thiết bị chưa có FCM token.");
  sendFcmToToken_(token,"🔔 Thông báo thử","Firebase đã kết nối thành công.",{orderId:"TEST-"+Date.now(),url:"/admin.html"});
  return {ok:true};
}

function sendNewOrderPush_(order){
  const tokens=getAllFcmTokens_();
  if(!tokens.length) return;

  const items=Array.isArray(order.items)?order.items:[];
  let total=0;
  const lines=items.map(i=>{
    total+=Number(i.subtotal)||0;
    return (Number(i.quantity)||0)+" × "+String(i.name||"");
  });

  const table=order.table ? "Bàn "+order.table : "Không ghi số bàn";
  const body=table+" • "+lines.join(", ")+" • Tổng "+formatMoney_(total)+"đ";

  tokens.forEach(token=>{
    try{
      sendFcmToToken_(token,"🔔 ĐƠN MỚI - "+table,body,{orderId:String(order.orderId||""),url:"/admin.html"});
    }catch(err){console.error(err);}
  });
}

function sendFcmToToken_(token,title,body,extraData){
  const props=PropertiesService.getScriptProperties();
  const projectId=props.getProperty("FCM_PROJECT_ID");
  if(!projectId) throw new Error("Chưa cấu hình Firebase Service Account.");

  const data=Object.assign({title:String(title),body:String(body),url:"/admin.html"},extraData||{});
  Object.keys(data).forEach(k=>data[k]=String(data[k]??""));

  const res=UrlFetchApp.fetch(
    "https://fcm.googleapis.com/v1/projects/"+encodeURIComponent(projectId)+"/messages:send",
    {
      method:"post",
      contentType:"application/json",
      headers:{Authorization:"Bearer "+getFirebaseAccessToken_()},
      payload:JSON.stringify({message:{token:token,data:data,webpush:{headers:{Urgency:"high"}}}}),
      muteHttpExceptions:true
    }
  );

  const code=res.getResponseCode(), text=res.getContentText();
  if(code>=200 && code<300) return JSON.parse(text||"{}");
  if(code===404 || text.indexOf("UNREGISTERED")!==-1) removeFcmToken_(token);
  throw new Error("FCM HTTP "+code+": "+text);
}

function getFirebaseAccessToken_(){
  const cache=CacheService.getScriptCache();
  const cached=cache.get("FCM_ACCESS_TOKEN");
  if(cached) return cached;

  const props=PropertiesService.getScriptProperties();
  const email=props.getProperty("FCM_CLIENT_EMAIL");
  const key=props.getProperty("FCM_PRIVATE_KEY");
  if(!email || !key) throw new Error("Thiếu Firebase Service Account.");

  const now=Math.floor(Date.now()/1000);
  const header={alg:"RS256",typ:"JWT"};
  const claim={
    iss:email,
    scope:"https://www.googleapis.com/auth/firebase.messaging",
    aud:"https://oauth2.googleapis.com/token",
    iat:now,
    exp:now+3600
  };

  const unsigned=base64Url_(JSON.stringify(header))+"."+base64Url_(JSON.stringify(claim));
  const sig=Utilities.computeRsaSha256Signature(unsigned,key);
  const assertion=unsigned+"."+Utilities.base64EncodeWebSafe(sig).replace(/=+$/g,"");

  const res=UrlFetchApp.fetch("https://oauth2.googleapis.com/token",{
    method:"post",
    payload:{
      grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:assertion
    },
    muteHttpExceptions:true
  });

  const code=res.getResponseCode(), text=res.getContentText();
  if(code<200 || code>=300) throw new Error("OAuth Firebase lỗi: "+code+" "+text);

  const obj=JSON.parse(text);
  cache.put("FCM_ACCESS_TOKEN",obj.access_token,3300);
  return obj.access_token;
}

function base64Url_(v){
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(String(v)).getBytes()).replace(/=+$/g,"");
}

function formatMoney_(n){
  return String(Math.round(Number(n)||0)).replace(/\B(?=(\d{3})+(?!\d))/g,".");
}



function getTodayOrders_() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(ORDER_SHEET);

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      ok: true,
      orders: []
    };
  }

  const rows = sheet
    .getRange(2, 1, lastRow - 1, 8)
    .getValues();

  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(
    new Date(),
    tz,
    "yyyy-MM-dd"
  );

  const grouped = {};

  rows.forEach(row => {
    if (!row[0] || !row[1]) return;

    const rowDate = Utilities.formatDate(
      new Date(row[0]),
      tz,
      "yyyy-MM-dd"
    );

    if (rowDate !== today) return;

    const orderId = String(row[1]);

    if (!grouped[orderId]) {
      grouped[orderId] = {
        orderId: orderId,
        table: String(row[2] || ""),
        time: Utilities.formatDate(
          new Date(row[0]),
          tz,
          "HH:mm:ss"
        ),
        timestamp: new Date(row[0]).getTime(),
        total: 0,
        items: []
      };
    }

    const quantity = Number(row[5]) || 0;
    const price = Number(row[6]) || 0;
    const subtotal = Number(row[7]) || 0;

    grouped[orderId].items.push({
      id: String(row[3] || ""),
      name: String(row[4] || ""),
      quantity: quantity,
      price: price,
      subtotal: subtotal
    });

    grouped[orderId].total += subtotal;
  });

  const orders = Object.values(grouped)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(order => {
      delete order.timestamp;
      return order;
    });

  return {
    ok: true,
    orders: orders
  };
}


function getDashboard_() {
  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDER_SHEET);
  const last=s.getLastRow();
  if(last<2) return {ok:true,todayCups:0,todayRevenue:0};

  const rows=s.getRange(2,1,last-1,8).getValues();
  const tz=Session.getScriptTimeZone();
  const today=Utilities.formatDate(new Date(),tz,"yyyy-MM-dd");

  let cups=0,revenue=0;
  rows.forEach(r=>{
    if(!r[0]) return;
    const d=Utilities.formatDate(new Date(r[0]),tz,"yyyy-MM-dd");
    if(d===today){
      cups += Number(r[5])||0;
      revenue += Number(r[7])||0;
    }
  });

  return {ok:true,todayCups:cups,todayRevenue:revenue};
}

function getHistory_() {
  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HISTORY_SHEET);
  const last=s.getLastRow();
  if(last<2) return {ok:true,history:[]};

  const tz=Session.getScriptTimeZone();
  const rows=s.getRange(2,1,last-1,3).getValues()
    .filter(r=>r[0] !== "")
    .map(r=>({
      date:r[0] instanceof Date ? Utilities.formatDate(r[0],tz,"dd/MM/yyyy") : String(r[0]),
      cups:Number(r[1])||0,
      revenue:Number(r[2])||0
    }))
    .reverse();

  return {ok:true,history:rows};
}

function resetDonHangMoiNgay() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const donHang=ss.getSheetByName(ORDER_SHEET);
  if(!donHang||donHang.getLastRow()<=1) return;

  let lichSu=ss.getSheetByName(HISTORY_SHEET);
  if(!lichSu){
    lichSu=ss.insertSheet(HISTORY_SHEET);
    lichSu.appendRow(["Ngày","Số cốc","Doanh thu"]);
  }

  const last=donHang.getLastRow();
  const rows=donHang.getRange(2,1,last-1,8).getValues();
  const soCoc=rows.reduce((t,r)=>t+(Number(r[5])||0),0);
  const doanhThu=rows.reduce((t,r)=>t+(Number(r[7])||0),0);

  const homQua=new Date();
  homQua.setDate(homQua.getDate()-1);
  const ngay=Utilities.formatDate(homQua,Session.getScriptTimeZone(),"dd/MM/yyyy");

  lichSu.appendRow([ngay,soCoc,doanhThu]);
  donHang.getRange(2,1,last-1,donHang.getLastColumn()).clearContent();
}

function findMenuRow_(s,id){
  const last=s.getLastRow();
  if(last<2)return -1;
  const vals=s.getRange(2,1,last-1,1).getValues();
  for(let i=0;i<vals.length;i++){
    if(String(vals[i][0]).trim().toUpperCase()===id)return i+2;
  }
  return -1;
}
function clean_(v){return String(v==null?"":v).trim();}
function normalizeBool_(v){
  if(v===true)return true;
  const s=String(v).trim().toLowerCase();
  return s==="true"||s==="1"||s==="có"||s==="yes";
}
function jsonp_(obj,callback){
  const json=JSON.stringify(obj);
  if(callback){
    const safe=String(callback).replace(/[^\w.$]/g,"");
    return ContentService.createTextOutput(safe+"("+json+");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
