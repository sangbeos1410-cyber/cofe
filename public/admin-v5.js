const CCAdmin = (() => {
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cash = n => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
  const field = (id, title, type='text', extra='') => `<label>${title}<input id="${id}" type="${type}" ${extra}></label>`;
  let off = [], reportOff = null, catalog = [], extras = [], promotions = [], eventId = null, toppingId = null;
  let choices = [], costsReady = true, editVersion = 0, eventsReady = false;
  const moneyValue = id => {
    const raw = el(id).value.trim(), n = Number(raw);
    if (!raw || !CCPricing.validMoney(n)) throw new Error('Nhập giá bán/giá vốn nguyên từ 0 đến 100.000.000đ.');
    return n;
  };
  const notice = (id, err) => { el(id).textContent = err.message || String(err); };
  const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
  const nav = document.querySelector('.admin-tabs');
  nav.insertAdjacentHTML('beforeend', '<button type="button" class="tab-button" data-tab="promotions">✦ Khuyến mãi</button>');
  el('adminApp').insertAdjacentHTML('beforeend', `<section id="tab-promotions" class="tab-page">
    <section class="panel"><div class="section-label">SỰ KIỆN & ƯU ĐÃI</div><h2>Tạo khoảnh khắc đặc biệt</h2>
    <p class="muted">Giảm theo phần trăm toàn đơn, gồm topping. Không cộng dồn; khách nhận mức giảm tốt nhất.</p>
    <form id="eventForm"><div class="v5-grid">
    ${field('eventTitle','Tên sự kiện','text','required maxlength="100"')}
    ${field('eventPercent','Giảm giá (%)','number','required min="1" max="100" step="1"')}
    ${field('eventStart','Bắt đầu (giờ Việt Nam)','datetime-local','required')}
    ${field('eventEnd','Kết thúc (giờ Việt Nam)','datetime-local','required')}
    ${field('eventMin','Đơn tối thiểu (đ)','number','required min="0" step="1" value="0"')}
    <label class="checkbox-row"><input id="eventActive" type="checkbox" checked> Hiển thị sự kiện</label></div>
    <label>Mô tả<textarea id="eventDescription" maxlength="500" rows="3"></textarea></label>
    <div class="actions"><button class="primary" id="eventSave">Lưu sự kiện</button>
    <button class="secondary" type="button" id="eventReset">Tạo sự kiện mới</button></div></form>
    <p id="eventMessage" role="status"></p></section><div id="eventList" class="v5-grid"></div></section>`);
  el('tab-stats').insertAdjacentHTML('afterbegin', `<section class="panel profit-panel">
    <div class="section-label">HIỆU QUẢ KINH DOANH</div><h2>Lợi nhuận thực thu</h2>
    <p class="muted">Theo ngày đặt đơn, chỉ tính đơn đã thanh toán. Lãi gộp = tiền sau giảm giá − giá vốn món và topping, chưa trừ chi phí vận hành.</p>
    <form id="reportForm" class="v5-grid">${field('reportFrom','Từ ngày','date','required')}
    ${field('reportTo','Đến ngày','date','required')}<button class="primary">Xem báo cáo</button></form>
    <p id="reportMessage" role="status"></p><div id="profitCards" class="v5-grid"></div>
    <div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Đơn đã trả</th><th>Thực thu</th><th>Giá vốn đã biết</th><th>Lãi gộp đã biết</th><th>Thiếu giá vốn</th></tr></thead>
    <tbody id="profitRows"></tbody></table></div></section>`);
  // Giá vốn tách riêng khỏi menu công khai.
  for (const size of ['S','M','L','XL']) el('size'+size).insertAdjacentHTML('afterend',
    field('cost'+size, 'Giá vốn size '+size+' (đ)', 'number', 'min="0" step="1" placeholder="Bắt buộc nếu bán size này"'));
  const oldBox = el('toppingsText').closest('.config-box');
  oldBox.hidden = true;
  oldBox.insertAdjacentHTML('afterend', '<div class="config-box"><h3>Topping của món</h3><p class="muted">Tích topping được phép bán kèm và nhập giá vốn. Bỏ tích để không bán kèm.</p><div id="toppingChoices"></div></div>');
  el('tab-menu').insertAdjacentHTML('beforeend', `<section class="panel"><h2>Danh sách topping dùng chung</h2>
    <p class="muted">Tạo topping ở đây rồi tích chọn khi thêm/sửa món. Thay đổi danh sách này áp dụng khi bạn chọn topping và lưu lại món.</p>
    <form id="toppingForm"><div class="v5-grid">${field('toppingName','Tên topping','text','required maxlength="80"')}
    ${field('toppingPrice','Giá bán (đ)','number','required min="0" step="1"')}
    ${field('toppingCost','Giá vốn (đ)','number','required min="0" step="1"')}</div>
    <div class="actions"><button class="primary" id="toppingSave">Lưu topping</button><button type="reset" class="secondary">Tạo mới</button></div></form>
    <p id="toppingMessage" role="status"></p><div id="toppingLibrary"></div></section>`);
  function renderChoices(selected, costs) {
    const old = [...el('toppingChoices').querySelectorAll('input[type=checkbox]')];
    selected ??= old.filter(x=>x.checked).map(x=>x.value);
    costs ??= Object.fromEntries(old.map(x=>[x.value, el('tc'+x.dataset.i).value]));
    choices = [...new Map([...extras,...catalog].map(t=>[t.id,t])).values()];
    el('toppingChoices').innerHTML = choices.map((t,i)=>`<div class="topping-choice">
      <label class="checkbox-row"><input type="checkbox" value="${esc(t.id)}" data-i="${i}" ${selected.includes(t.id)?'checked':''}>
      ${esc(t.name)} · +${cash(t.price)}</label>
      <label>Giá vốn (đ)<input id="tc${i}" type="number" min="0" step="1" value="${esc(costs[t.id] ?? t.cost ?? '')}"></label></div>`).join('') || '<p class="muted">Chưa có topping. Thêm trong danh sách topping phía dưới.</p>';
  }
  function resetMenu() {
    editVersion++; costsReady = true; extras = [];
    for (const s of ['S','M','L','XL']) el('cost'+s).value = '';
    renderChoices([], {});
  }
  async function editMenu(id) {
    const version = ++editVersion;
    costsReady = false;
    el('message').textContent = 'Đang tải giá vốn...';
    for (const s of ['S','M','L','XL']) el('cost'+s).value = '';
    const item = MENU.find(x=>x.id===id);
    extras = (item?.toppings || []).map(t=>({...t}));
    renderChoices(extras.map(t=>t.id), {});
    try {
      const d = await db.collection('menuCosts').doc(id).get();
      if (version !== editVersion) return;
      const data = d.exists ? d.data() : {};
      for (const s of ['S','M','L','XL']) el('cost'+s).value = data.sizes?.[s] ?? '';
      renderChoices(extras.map(t=>t.id), data.toppings || {});
      costsReady = true;
      el('message').textContent = d.exists ? '' : 'Món cũ chưa có giá vốn. Vui lòng nhập trước khi lưu.';
    } catch (e) { if (version === editVersion) notice('message',e); }
  }
  async function saveMenu(event) {
    event.preventDefault();
    if (el('saveBtn').disabled) return;
    el('saveBtn').disabled = true;
    try {
      if (!costsReady) throw new Error('Chưa tải được giá vốn. Mở lại món để thử lại.');
      const id = editingId || el('itemId').value.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{1,30}$/.test(id)) throw new Error('Mã món không hợp lệ.');
      const sizes = buildSizes(), name = el('itemName').value.trim(), category = el('itemCategory').value.trim();
      if (!name || !category || !sizes.length) throw new Error('Nhập tên, danh mục và ít nhất một size.');
      const costs = {sizes:{}, toppings:{}, updatedAt:stamp()};
      for (const s of sizes) { if (!CCPricing.validMoney(s.price)) throw new Error('Giá bán không hợp lệ.'); costs.sizes[s.id] = moneyValue('cost'+s.id); }
      const toppings = [...el('toppingChoices').querySelectorAll('input[type=checkbox]:checked')].map(input=>{
        const t = choices[Number(input.dataset.i)];
        costs.toppings[t.id] = moneyValue('tc'+input.dataset.i);
        return {id:t.id, name:t.name, price:t.price};
      });
      if (toppings.length>20) throw new Error('Tối đa 20 topping cho một món.');
      const ref = db.collection('menu').doc(id), wasEditing = !!editingId;
      await db.runTransaction(async tx=>{
        const current = await tx.get(ref);
        if (!wasEditing && current.exists) throw new Error('Mã món đã tồn tại.');
        if (wasEditing && !current.exists) throw new Error('Món đã bị xóa.');
        tx.set(ref,{name:name.slice(0,100), category:category.slice(0,80), description:el('itemDescription').value.trim().slice(0,300),
          sizes,toppings,active:el('itemActive').checked,updatedAt:stamp()});
        tx.set(db.collection('menuCosts').doc(id), costs);
      });
      resetMenuForm(); notice('message', 'Đã lưu món, topping và giá vốn.');
    } catch(e) { notice('message',e); } finally { el('saveBtn').disabled = false; }
  }
  el('toppingForm').addEventListener('reset',()=>{toppingId=null;});
  el('toppingForm').addEventListener('submit',async e=>{
    e.preventDefault(); el('toppingSave').disabled=true;
    try {
      const name=el('toppingName').value.trim();
      if (!name) throw new Error('Nhập tên topping.');
      const collection=db.collection('toppingCatalog'); const ref=toppingId?collection.doc(toppingId):collection.doc();
      await ref.set({name,price:moneyValue('toppingPrice'),cost:moneyValue('toppingCost'),updatedAt:stamp()});
      el('toppingForm').reset(); notice('toppingMessage','Đã lưu topping.');
    } catch(e){notice('toppingMessage',e);} finally {el('toppingSave').disabled=false;}
  });
  el('toppingLibrary').addEventListener('click',async e=>{
    const button=e.target.closest('button[data-id]'); if(!button)return;
    const t=catalog.find(t=>t.id===button.dataset.id); if(!t)return;
    if(button.dataset.action==='edit') {
      toppingId=t.id; el('toppingName').value=t.name; el('toppingPrice').value=t.price; el('toppingCost').value=t.cost;
    } else if(confirm('Xóa topping khỏi danh sách dùng chung? Các món đã lưu vẫn giữ topping này.')) {
      try{await db.collection('toppingCatalog').doc(t.id).delete();}catch(e){notice('toppingMessage',e);}
    }
  });
  const localVN = ms => new Date(ms+7*3600000).toISOString().slice(0,16);
  function resetEvent(){eventId=null;el('eventForm').reset();el('eventSave').textContent='Lưu sự kiện';}
  el('eventReset').onclick=resetEvent;
  el('eventForm').addEventListener('submit',async e=>{
    e.preventDefault(); el('eventSave').disabled=true;
    try {
      if(!eventsReady)throw new Error('Chưa tải được danh sách sự kiện.');
      const startsAt=Date.parse(el('eventStart').value+':00+07:00'),endsAt=Date.parse(el('eventEnd').value+':00+07:00');
      const percent=Number(el('eventPercent').value),title=el('eventTitle').value.trim();
      if(!title || !Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt<=startsAt || !Number.isInteger(percent) || percent<1 || percent>100)
        throw new Error('Kiểm tra tên, thời gian bắt đầu/kết thúc và mức giảm 1–100%.');
      const collection=db.collection('promotions'); const ref=eventId?collection.doc(eventId):collection.doc();
      await ref.set({title,description:el('eventDescription').value.trim(),startsAt,endsAt,
        percent,minTotal:moneyValue('eventMin'),active:el('eventActive').checked,updatedAt:stamp()});
      resetEvent(); notice('eventMessage','Đã lưu. Trang khách tự cập nhật sự kiện.');
    }catch(e){notice('eventMessage',e);}finally{el('eventSave').disabled=false;}
  });
  function renderEvents(){
    el('eventList').innerHTML=promotions.map(p=>`<article class="panel"><span class="eyebrow">${!p.active?'ĐÃ ẨN':Date.now()<p.startsAt?'SẮP DIỄN RA':Date.now()>=p.endsAt?'ĐÃ KẾT THÚC':'ĐANG DIỄN RA'}</span>
      <h2>${esc(p.title)} · ${p.percent}%</h2><p>${esc(p.description)}</p><p class="muted">${localVN(p.startsAt).replace('T',' ')} → ${localVN(p.endsAt).replace('T',' ')} (VN)<br>Đơn từ ${cash(p.minTotal)}</p>
      <div class="actions"><button class="secondary" data-action="edit" data-id="${esc(p.id)}">Sửa</button>
      <button class="secondary" data-action="toggle" data-id="${esc(p.id)}">${p.active?'Ẩn':'Hiện'}</button></div></article>`).join('') || '<p class="muted">Chưa có sự kiện. Tạo ưu đãi đầu tiên ở trên.</p>';
  }
  el('eventList').addEventListener('click',async e=>{
    const b=e.target.closest('button[data-id]');if(!b)return;
    const p=promotions.find(x=>x.id===b.dataset.id);if(!p)return;
    if(b.dataset.action==='toggle') {
      try{await db.collection('promotions').doc(p.id).update({active:!p.active,updatedAt:stamp()});}catch(e){notice('eventMessage',e);}
    } else {
      eventId=p.id;el('eventTitle').value=p.title;el('eventDescription').value=p.description;
      el('eventPercent').value=p.percent;el('eventMin').value=p.minTotal;el('eventActive').checked=p.active;
      el('eventStart').value=localVN(p.startsAt);el('eventEnd').value=localVN(p.endsAt);
      el('eventSave').textContent='Cập nhật sự kiện';el('eventForm').scrollIntoView({behavior:'smooth',block:'center'});
    }
  });
  function report() { /* Replaced by admin-report.js. */ }
  el('reportForm').addEventListener('submit',e=>{e.preventDefault();report();});
  function start(){
    resetMenuForm(); resetEvent(); el('toppingForm').reset();
    off.push(db.collection('toppingCatalog').onSnapshot(s=>{
      catalog=s.docs.map(d=>({...d.data(),id:d.id}));renderChoices();
      el('toppingLibrary').innerHTML=catalog.map(t=>`<div class="topping-choice"><span>${esc(t.name)} · ${cash(t.price)} / vốn ${cash(t.cost)}</span><div class="actions"><button class="secondary" data-id="${esc(t.id)}" data-action="edit">Sửa</button><button class="secondary" data-id="${esc(t.id)}" data-action="delete">Xóa</button></div></div>`).join('');
    },e=>notice('toppingMessage',e)));
    off.push(db.collection('promotions').onSnapshot(s=>{eventsReady=true;promotions=s.docs.map(d=>({...d.data(),id:d.id}));renderEvents();},e=>{eventsReady=false;notice('eventMessage',e);}));
    const today=dateKeyVN();el('reportFrom').value=today.slice(0,8)+'01';el('reportTo').value=today;report();
    const timer=setInterval(renderEvents,30000);off.push(()=>clearInterval(timer));
  }
  function stop(){off.forEach(f=>f());off=[];if(reportOff)reportOff();reportOff=null;eventsReady=false;editVersion++;eventId=null;toppingId=null;catalog=[];extras=[];promotions=[];}
  return {start,stop,saveMenu,editMenu,resetMenu};
})();
