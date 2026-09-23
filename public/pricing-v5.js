
/* Công thức dùng chung cho trình duyệt và Cloud Functions. */
(function(root) {
  const validMoney = n =>
    Number.isSafeInteger(n) && n >= 0 && n <= 100000000;

  function quote(subtotal, events, now = Date.now()) {
    let discount = 0, promotion = null;

    const sorted = [...events].sort((a, b) =>
      String(a.id).localeCompare(String(b.id))
    );

    for (const p of sorted) {
      if (
        !p.active ||
        !(p.startsAt <= now && now < p.endsAt) ||
        subtotal < p.minTotal ||
        !Number.isInteger(p.percent) ||
        p.percent < 1 ||
        p.percent > 100
      ) continue;

      const amount = Math.min(
        subtotal,
        Math.floor(subtotal * p.percent / 100)
      );

      if (amount > discount) {
        discount = amount;
        promotion = {
          id: p.id,
          title: p.title,
          percent: p.percent
        };
      }
    }

    return {
      subtotal,
      discount,
      total: subtotal - discount,
      promotion
    };
  }

  function costOf(items, costs) {
    let totalCost = 0;

    for (const item of items) {
      const c = costs[item.menuId];
      const parts = [
        c?.sizes?.[item.sizeId],
        ...item.toppings.map(t => c?.toppings?.[t.id])
      ];

      if (parts.some(n => !validMoney(n))) {
        return { costComplete: false, totalCost: null };
      }

      totalCost += parts.reduce((a, b) => a + b, 0)
        * item.quantity;
    }

    return { costComplete: true, totalCost };
  }

  const api = { quote, costOf, validMoney };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CCPricing = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
