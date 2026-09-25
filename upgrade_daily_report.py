from pathlib import Path
from datetime import datetime
import re,shutil
ROOT=Path(__file__).resolve().parent
FILES={}
FILES['public/report-data.js']=r'''
(function(root){
 const DAY=86400000;
 const today=(now=Date.now())=>new Date(now+7*3600000).toISOString().slice(0,10);
 function dates(from,to){
  const start=Date.parse(from+'T00:00:00Z'),end=Date.parse(to+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>366*DAY||new Date(start).toISOString().slice(0,10)!==from||new Date(end).toISOString().slice(0,10)!==to)throw new Error('Chọn khoảng ngày hợp lệ, tối đa 367 ngày.');
  const keys=[];for(let t=start;t<=end;t+=DAY)keys.push(new Date(t).toISOString().slice(0,10));return keys;
 }
 function aggregate(orders,from,to){
  const blank=()=>({orders:0,paid:0,pending:0,revenue:0,pendingValue:0,cost:0,knownRevenue:0,missing:0,discount:0,invalid:0});
  const rows=new Map(dates(from,to).map(k=>[k,{date:k,...blank()}])),sum=blank();
  for(const o of orders){
   const row=rows.get(o.dateKey);if(!row)continue;
   const totalOk=Number.isSafeInteger(o.total)&&o.total>=0;
   for(const x of [row,sum]){
    x.orders++;
    if(!totalOk)x.invalid++;
    if(o.paymentStatus!=='paid'){x.pending++;if(totalOk)x.pendingValue+=o.total;continue;}
    x.paid++;if(totalOk)x.revenue+=o.total;
    if(Number.isSafeInteger(o.discount)&&o.discount>=0)x.discount+=o.discount;
    if(totalOk&&o.costComplete===true&&Number.isSafeInteger(o.totalCost)&&o.totalCost>=0){x.cost+=o.totalCost;x.knownRevenue+=o.total;}else x.missing++;
   }
  }
  return {sum,rows:[...rows.values()]};
 }
 const api={today,dates,aggregate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CCReportData=api;
})(typeof globalThis!=='undefined'?globalThis:this);

'''
FILES['public/admin-report.js']=r'''
(() => {
 const root=document.getElementById('tab-stats');if(!root)return;
 const panel=document.createElement('div');panel.id='dailyReport';
 panel.innerHTML=`<header class="dr-heading"><div><span class="dr-eyebrow">TỔNG QUAN KINH DOANH</span><h2>Báo cáo theo ngày</h2><p>Tự cập nhật khi có đơn mới hoặc khi bạn xác nhận thanh toán.</p></div><span class="dr-live">● Cập nhật tự động</span></header>
 <section class="dr-filter"><div class="dr-presets"><button type="button" data-range="today">Hôm nay</button><button type="button" data-range="week">7 ngày gần đây</button><button type="button" data-range="month" class="active">Tháng này</button></div><form id="drForm"><label>Từ ngày<input id="drFrom" type="date" required></label><label>Đến ngày<input id="drTo" type="date" required></label><button type="submit">Xem khoảng ngày</button></form></section>
 <p class="dr-status" id="drStatus" role="status"></p><div id="drCards" class="dr-cards"></div>
 <p id="drCoverage" class="dr-note"></p>
 <section class="dr-panel"><h3>Doanh thu đã thanh toán mỗi ngày</h3><p class="dr-muted">Biểu đồ hiển thị tối đa 31 ngày cuối trong khoảng đã chọn. Bảng bên dưới có đầy đủ các ngày.</p><div id="drChart" class="dr-chart"></div></section>
 <section class="dr-panel"><h3>Chi tiết từng ngày</h3><p class="dr-muted">Ngày không có đơn vẫn được hiển thị. Ngày mới nhất ở trên.</p><div class="dr-table"><table><thead><tr><th>Ngày</th><th>Tổng đơn</th><th>Đã trả</th><th>Chờ trả</th><th>Doanh thu đã trả</th><th>Giá vốn đã biết</th><th>Lãi gộp đã biết</th><th>Thiếu giá vốn</th></tr></thead><tbody id="drRows"></tbody></table></div></section>
 <details class="dr-panel"><summary>Cách đọc báo cáo</summary><p><b>Doanh thu đã thanh toán:</b> tổng tiền sau giảm giá của đơn đã đánh dấu “Đã thanh toán”.</p><p><b>Lãi gộp:</b> doanh thu của các đơn đủ giá vốn trừ giá vốn món và topping, bao gồm món tặng. Chưa trừ tiền thuê, điện nước, lương và chi phí vận hành.</p><p><b>Ngày thống kê:</b> ngày tạo đơn theo giờ Việt Nam. Thanh toán một đơn cũ sẽ cập nhật lại ngày tạo đơn đó; đây không phải báo cáo theo ngày tiền về.</p><p><b>Thiếu giá vốn:</b> không coi giá vốn là 0. Những đơn này vẫn tính doanh thu nhưng được loại khỏi lãi gộp và biên lãi.</p></details>`;
 root.append(panel);
 const el=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('vi-VN').format(n)+'đ',date=k=>k.split('-').reverse().join('/');
 let off=null,allowed=false,version=0,mode='month',activeDay='',bounds=null;
 function preset(){const t=CCReportData.today();activeDay=t;el('drTo').value=t;el('drFrom').value=mode==='today'?t:mode==='week'?new Date(Date.parse(t+'T00:00:00Z')-6*86400000).toISOString().slice(0,10):t.slice(0,8)+'01';}
 function clear(){for(const id of ['drCards','drChart','drRows'])el(id).replaceChildren();el('drCoverage').textContent='';}
 function stop(){version++;if(off)off();off=null;}
 function failure(e){clear();el('drStatus').textContent=String(e.code||'').includes('permission-denied')?'Không có quyền đọc báo cáo. Kiểm tra tài khoản admin và Firestore Rules.':'Chưa tải được báo cáo. '+(e.message||'Kiểm tra kết nối rồi thử lại.');}
 function render(snapshot){
  const {sum:s,rows}=CCReportData.aggregate(snapshot.docs.map(d=>d.data()),bounds.from,bounds.to);
  const covered=s.paid-s.missing,profit=s.knownRevenue-s.cost,known=covered>0||s.paid===0;
  const cards=[['Doanh thu đã thanh toán',fmt(s.revenue),'Sau giảm giá · '+s.paid+' đơn đã trả'],['Giá vốn đã biết',known?fmt(s.cost):'Chưa đủ dữ liệu','Giá vốn của '+covered+'/'+s.paid+' đơn đã trả'],['Lãi gộp đã biết',known?fmt(profit):'Chưa đủ dữ liệu','Chưa trừ chi phí vận hành'],['Tổng số đơn',s.orders,s.paid+' đã trả · '+s.pending+' chờ trả'],['Tiền chưa thanh toán',fmt(s.pendingValue),'Chưa cộng vào doanh thu đã trả'],['Biên lãi gộp',s.knownRevenue>0?(profit/s.knownRevenue*100).toFixed(1)+'%':'—','Lãi ÷ doanh thu của đơn đủ giá vốn']];
  el('drCards').innerHTML=cards.map(([label,value,note],i)=>`<article class="dr-card ${i===2?(profit<0?'negative':'profit'):''}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
  el('drCoverage').textContent=s.missing?`${s.missing} đơn đã thanh toán thiếu giá vốn hoặc số tiền hợp lệ. Lãi hiện tại chỉ tính ${covered} đơn đủ dữ liệu.`:'Đã có giá vốn cho toàn bộ đơn đã thanh toán trong khoảng này.';
  if(!s.paid)el('drCoverage').textContent='Chưa có đơn đã thanh toán. Doanh thu và lãi sẽ cập nhật khi bạn xác nhận thanh toán.';
  if(s.invalid)el('drCoverage').textContent+=' Có '+s.invalid+' đơn có số tiền không hợp lệ, không cộng số tiền đó vào tổng.';
  el('drCoverage').classList.toggle('warning',s.missing>0||s.invalid>0);
  el('drStatus').textContent=(snapshot.metadata?.fromCache?'Đang hiển thị dữ liệu lưu tạm; chờ đồng bộ. ':'Đã đồng bộ. ')+date(bounds.from)+' – '+date(bounds.to)+' · Giờ Việt Nam · '+new Date().toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})+(s.orders?'':' · Chưa có đơn.');
  el('drRows').innerHTML=[...rows].reverse().map(d=>{const has=d.paid>d.missing||d.paid===0;return `<tr><td>${date(d.date)}</td><td>${d.orders}</td><td>${d.paid}</td><td>${d.pending}</td><td>${fmt(d.revenue)}</td><td>${has?fmt(d.cost):'—'}</td><td class="${d.knownRevenue-d.cost<0?'dr-loss':''}">${has?fmt(d.knownRevenue-d.cost):'—'}</td><td>${d.missing?'<span class="dr-badge">'+d.missing+' đơn</span>':'—'}</td></tr>`;}).join('');
  const points=rows.slice(-31),max=Math.max(1,...points.map(d=>d.revenue));
  el('drChart').innerHTML=points.map(d=>`<div class="dr-bar-row"><span>${date(d.date).slice(0,5)}</span><div class="dr-track"><div class="dr-bar" style="width:${d.revenue/max*100}%"></div></div><b>${fmt(d.revenue)}</b></div>`).join('');
 }
 function load(){
  const from=el('drFrom').value,to=el('drTo').value;
  try{CCReportData.dates(from,to);}catch(e){el('drStatus').textContent=e.message;return;}
  stop();if(!allowed)return;bounds={from,to};clear();el('drStatus').textContent='Đang tải báo cáo…';const token=version;
  off=db.collection('orders').where('dateKey','>=',from).where('dateKey','<=',to).onSnapshot({includeMetadataChanges:true},snapshot=>{if(token!==version)return;try{render(snapshot);}catch(e){failure(e);}},e=>{if(token===version)failure(e);});
 }
 el('drForm').onsubmit=e=>{e.preventDefault();mode='custom';panel.querySelectorAll('[data-range]').forEach(b=>b.classList.remove('active'));load();};
 panel.querySelectorAll('[data-range]').forEach(button=>button.onclick=()=>{mode=button.dataset.range;panel.querySelectorAll('[data-range]').forEach(b=>b.classList.toggle('active',b===button));preset();load();});
 firebase.auth().onAuthStateChanged(user=>{stop();allowed=!!user&&user.email?.toLowerCase()===self.ADMIN_EMAIL?.toLowerCase();clear();if(allowed){mode='month';panel.querySelectorAll('[data-range]').forEach(b=>b.classList.toggle('active',b.dataset.range==='month'));preset();load();}else el('drStatus').textContent='Đăng nhập admin để xem báo cáo.';});
 const rollover=()=>{if(allowed&&mode!=='custom'&&activeDay!==CCReportData.today()){preset();load();}};
 setInterval(rollover,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)rollover();});
})();

'''
FILES['public/admin-report.css']=r'''
#tab-stats>:not(#dailyReport){display:none!important}
#dailyReport{font-family:Arial,sans-serif;color:#263e35;max-width:1400px;margin:auto}
.dr-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:8px 0 24px}.dr-heading h2{font-size:30px;margin:8px 0}.dr-heading p,.dr-muted{color:#66776e;font-size:14px;line-height:1.6}.dr-eyebrow{font-size:11px;font-weight:700;letter-spacing:.12em;color:#748475}.dr-live{padding:9px 14px;background:#e4f3e8;color:#236544;border-radius:24px;white-space:nowrap;font-size:12px}
.dr-filter,.dr-panel{padding:22px;background:#fff;border:1px solid #dfe7e1;border-radius:18px;margin:18px 0}.dr-presets{display:flex;gap:8px;flex-wrap:wrap}.dr-presets button{background:#f1f5f2;border:1px solid #dfe7e1;color:#3d5548;padding:10px 16px;border-radius:10px;cursor:pointer}.dr-presets button.active,#drForm button{background:#285c46;color:white;border:1px solid #285c46}#drForm{display:flex;align-items:end;gap:14px;flex-wrap:wrap;margin-top:18px}#drForm label{display:grid;gap:7px;font-size:13px}#drForm input{width:100%;min-height:44px}#drForm button{padding:12px 18px;border-radius:10px;cursor:pointer}
.dr-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.dr-card{display:grid;gap:14px;padding:23px;background:white;border:1px solid #dfe7e1;border-radius:17px;min-width:0}.dr-card>span{font-size:14px;color:#52675a}.dr-card strong{font-size:clamp(22px,2.5vw,32px);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.dr-card small{font-size:12px;color:#617366}.dr-card.profit{background:#eaf5ed;border-color:#c9dfcf}.dr-card.negative{background:#fff0ed;border-color:#edc9c2}.dr-note{background:#edf4ee;padding:14px 18px;border-radius:12px;line-height:1.7;font-size:14px}.dr-note.warning{background:#fff4d9;color:#7b5625}.dr-status{font-size:13px;color:#627266;line-height:1.6}
.dr-panel h3{font-size:19px;margin:0 0 8px}.dr-chart{display:grid;gap:10px;margin-top:22px;max-height:400px;overflow-y:auto}.dr-bar-row{display:grid;grid-template-columns:48px minmax(20px,1fr) 115px;align-items:center;gap:12px;font-size:12px}.dr-track{background:#f0f4f1;height:14px;border-radius:6px;overflow:hidden}.dr-bar{height:100%;background:#5f977b;border-radius:6px}.dr-bar-row b{text-align:right;font-variant-numeric:tabular-nums}.dr-table{overflow-x:auto}.dr-table table{width:100%;border-collapse:collapse;font-size:13px}.dr-table th{background:#edf3ee!important;color:#365542!important;padding:14px;white-space:nowrap}.dr-table td{padding:14px;border-bottom:1px solid #edf1ed;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}.dr-table td:first-child,.dr-table th:first-child{text-align:left}.dr-table th{text-align:right}.dr-table tr:nth-child(even){background:#fafcf9}.dr-loss{color:#ac4032}.dr-badge{background:#fff0cd;color:#805a23;border-radius:20px;padding:4px 9px}#dailyReport details p{font-size:14px;line-height:1.8}#dailyReport summary{cursor:pointer;font-weight:700}
@media(max-width:750px){.dr-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.dr-heading{align-items:start;flex-direction:column}.dr-filter,.dr-panel{padding:16px}.dr-card{padding:17px}.dr-bar-row{grid-template-columns:40px minmax(20px,1fr) 95px;gap:7px}}
@media(max-width:380px){.dr-cards{grid-template-columns:1fr}}

'''

for n in ['public/admin.html','public/admin-v5.js','public/admin.js']:
    if not (ROOT/n).is_file():raise SystemExit('Thiếu '+n+'. Đặt script cạnh firebase.json trong dự án hiện tại.')
text=(ROOT/'public/admin-v5.js').read_text(encoding='utf-8-sig')
pattern=r"  function report\(\) \{[\s\S]*?(?=  el\('reportForm'\)\.addEventListener)"
if not re.search(pattern,text):raise SystemExit('Cấu trúc báo cáo cũ khác bản đang hỗ trợ. Chưa thay file nào; gửi public/admin-v5.js để kiểm tra.')
FILES['public/admin-v5.js']=re.sub(pattern,'  function report() { /* Replaced by admin-report.js. */ }\n',text,count=1)
text=(ROOT/'public/admin.js').read_text(encoding='utf-8-sig')
FILES['public/admin.js']=re.sub(r'(?m)^  loadStats\(\);', '  // Daily report uses its own realtime order subscription.',text,count=1)
text=(ROOT/'public/admin.html').read_text(encoding='utf-8-sig')
if 'admin-report.css' not in text:text=text.replace('</head>','<link rel="stylesheet" href="admin-report.css?v=1">\n</head>')
if 'admin-report.js' not in text:text=text.replace('</body>','<script src="report-data.js?v=1"></script>\n<script src="admin-report.js?v=1"></script>\n</body>')
text=re.sub(r'(src="admin(?:-v5)?\.js)(?:\?[^" ]*)?"',r'\1?v=daily1"',text)
FILES['public/admin.html']=text
backup=ROOT/'cheng-backups'/datetime.now().strftime('daily-report-%Y%m%d-%H%M%S-%f')
for n in FILES:
    p=ROOT/n
    if p.is_file():
        dest=backup/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
for n,s in FILES.items():(ROOT/n).write_text(s,encoding='utf-8')
print('Đã làm lại báo cáo theo ngày. Sao lưu: '+str(backup))
