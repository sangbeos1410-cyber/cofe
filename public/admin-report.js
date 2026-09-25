
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

