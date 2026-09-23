const CCShop = (() => {
  let events = [], loaded = false;
  const area = document.createElement('section');
  area.className = 'promotion-strip'; area.hidden = true;
  area.setAttribute('aria-label', 'Sự kiện khuyến mãi');
  document.querySelector('.hero').after(area);
  const summary = document.createElement('div');
  summary.className = 'discount-summary'; summary.setAttribute('aria-live', 'polite');
  document.getElementById('orderBtn').before(summary);
  const fmt = n => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
  function refreshCart() {
    for (const line of cart) {
      const item = MENU.find(m => m.id === line.menuId);
      const size = item?.sizes.find(s => s.id === line.sizeId);
      const toppings = (line.toppingIds || []).map(id => item?.toppings.find(t => t.id === id));
      if (!size || toppings.some(t => !t)) continue;
      line.unitPrice = size.price + toppings.reduce((sum,t) => sum + t.price, 0);
      line.name = item.name; line.toppingNames = toppings.map(t => t.name);
    }
  }
  function showTotal(total) {
    let node = document.getElementById('successTotalV5');
    if (!node) { node = document.createElement('p'); node.id = 'successTotalV5'; document.getElementById('successPaymentHint').before(node); }
    node.textContent = 'Tổng thanh toán: ' + fmt(total);
  }
  function currentQuote() {
    return CCPricing.quote(cart.reduce((s, i) => s + i.unitPrice * i.qty, 0), events, Date.now(), cart.map(i=>({menuId:i.menuId,sizeId:i.sizeId,sizePrice:MENU.find(m=>m.id===i.menuId)?.sizes.find(s=>s.id===i.sizeId)?.price,quantity:i.qty})), typeof CCThemes==='undefined'?{}:CCThemes.settings);
  }
  function render() {
    const now = Date.now();
    area.innerHTML = events.filter(p => p.endsAt > now).sort((a,b) => a.startsAt-b.startsAt).map(p => `
      <article class="promotion-card">
        <span class="eyebrow">${p.startsAt > now ? 'SẮP DIỄN RA' : 'ƯU ĐÃI HÔM NAY'}</span>
        <strong class="promotion-percent">−${p.percent}%</strong>
        <h2>${escapeHtml(p.title)}</h2><p>${escapeHtml(p.description)}</p>
        <small>Đơn từ ${fmt(p.minTotal)} · ${new Date(p.startsAt).toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'})}
        – ${new Date(p.endsAt).toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'})} (giờ Việt Nam)</small>
      </article>`).join('');
    area.hidden = !area.childElementCount;
    const q = currentQuote();
    summary.innerHTML = !cart.length ? '' : `<div><span>Tạm tính</span><b>${fmt(q.subtotal)}</b></div>
      <div><span>${q.promotion ? escapeHtml(q.promotion.title) : 'Khuyến mãi'}</span><b>−${fmt(q.discount)}</b></div>
      <small>${loaded ? 'Tự áp dụng ưu đãi tốt nhất. Quà tặng Chủ nhật không miễn phí topping.' : 'Chưa tải được ưu đãi. Vui lòng chờ kết nối.'}</small>`;
    document.getElementById('total').textContent = fmt(q.total);
  }
  function start() {
    db.collection('promotions').where('active', '==', true).onSnapshot(s => {
      events = s.docs.map(d => ({...d.data(), id:d.id})); loaded = true; render();
    }, () => { loaded = false; render(); });
    setInterval(render, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  }
  function expectedTotal() {
    if (!loaded || typeof CCThemes==='undefined' || !CCThemes.ready) throw new Error('Chưa tải được khuyến mãi. Vui lòng thử lại sau.');
    refreshCart(); render(); return currentQuote().total;
  }
  return {start, render, expectedTotal, refreshCart, showTotal};
})();
