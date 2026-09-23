
const CCShop = (() => {
  let events = [], loaded = false;

  const area = document.createElement("section");
  area.className = "promotion-strip";
  area.hidden = true;
  area.setAttribute("aria-label", "Sự kiện khuyến mãi");
  document.querySelector(".hero").after(area);

  const summary = document.createElement("div");
  summary.className = "discount-summary";
  summary.setAttribute("aria-live", "polite");
  document.getElementById("orderBtn").before(summary);

  const fmt = n =>
    new Intl.NumberFormat("vi-VN").format(n) + "đ";

  const dateText = n =>
    new Date(n).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh"
    });

  function refreshCart() {
    for (const line of cart) {
      const item = MENU.find(m => m.id === line.menuId);
      const size = item?.sizes.find(s => s.id === line.sizeId);
      const toppings = (line.toppingIds || []).map(id =>
        item?.toppings.find(t => t.id === id)
      );

      if (!size || toppings.some(t => !t)) continue;

      line.unitPrice = size.price
        + toppings.reduce((sum, t) => sum + t.price, 0);
      line.name = item.name;
      line.toppingNames = toppings.map(t => t.name);
    }
  }

  function currentQuote() {
    return CCPricing.quote(
      cart.reduce((s, i) => s + i.unitPrice * i.qty, 0),
      events
    );
  }

  function render() {
    const now = Date.now();

    area.innerHTML = events
      .filter(p => p.endsAt > now)
      .sort((a, b) => a.startsAt - b.startsAt)
      .map(p => `
        <article class="promotion-card">
          <span class="eyebrow">
            ${p.startsAt > now ? "SẮP DIỄN RA" : "ƯU ĐÃI HÔM NAY"}
          </span>
          <strong class="promotion-percent">−${p.percent}%</strong>
          <h2>${escapeHtml(p.title)}</h2>
          <p>${escapeHtml(p.description)}</p>
          <small>
            Đơn từ ${fmt(p.minTotal)} ·
            ${dateText(p.startsAt)} – ${dateText(p.endsAt)}
            (giờ Việt Nam)
          </small>
        </article>
      `).join("");

    area.hidden = !area.childElementCount;

    const q = currentQuote();

    summary.innerHTML = !cart.length ? "" : `
      <div>
        <span>Tạm tính</span><b>${fmt(q.subtotal)}</b>
      </div>
      <div>
        <span>
          ${q.promotion ? escapeHtml(q.promotion.title) : "Khuyến mãi"}
        </span>
        <b>−${fmt(q.discount)}</b>
      </div>
      <small>
        ${loaded
          ? "Tự áp dụng một ưu đãi tốt nhất, gồm cả topping."
          : "Chưa tải được ưu đãi. Vui lòng chờ kết nối."}
      </small>
    `;

    document.getElementById("total").textContent = fmt(q.total);
  }

  function start() {
    db.collection("promotions")
      .where("active", "==", true)
      .onSnapshot(snapshot => {
        events = snapshot.docs.map(d => ({
          ...d.data(), id: d.id
        }));
        loaded = true;
        render();
      }, () => {
        loaded = false;
        render();
      });

    setInterval(render, 15000);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) render();
    });
  }

  function expectedTotal() {
    if (!loaded) {
      throw new Error(
        "Chưa tải được khuyến mãi. Vui lòng thử lại sau."
      );
    }

    refreshCart();
    render();
    return currentQuote().total;
  }

  function showTotal(total) {
    let node = document.getElementById("successTotalV5");

    if (!node) {
      node = document.createElement("p");
      node.id = "successTotalV5";
      document.getElementById("successPaymentHint").before(node);
    }

    node.textContent = "Tổng thanh toán: " + fmt(total);
  }

  return {
    start, render, expectedTotal, refreshCart, showTotal
  };
})();
