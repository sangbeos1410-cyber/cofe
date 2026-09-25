
/* Dùng chung công thức ở trình duyệt và Cloud Functions. */
(function(root) {
  const validMoney = n => Number.isSafeInteger(n) && n >= 0 && n <= 100000000;
  function quote(subtotal, events, now = Date.now()) {
    let discount = 0, promotion = null;
    for (const p of [...events].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
      if (!p.active || !(p.startsAt <= now && now < p.endsAt) || subtotal < p.minTotal ||
          !Number.isInteger(p.percent) || p.percent < 1 || p.percent > 100) continue;
      const amount = Math.min(subtotal, Math.floor(subtotal * p.percent / 100));
      if (amount > discount) {
        discount = amount;
        promotion = { id: p.id, title: p.title, percent: p.percent };
      }
    }
    return { subtotal, discount, total: subtotal - discount, promotion };
  }
  function costOf(items, costs) {
    let totalCost = 0;
    for (const item of items) {
      const c = costs[item.menuId];
      const parts = [c?.sizes?.[item.sizeId], ...item.toppings.map(t => c?.toppings?.[t.id])];
      if (parts.some(n => !validMoney(n))) return { costComplete: false, totalCost: null };
      totalCost += parts.reduce((a, b) => a + b, 0) * item.quantity;
    }
    return { costComplete: true, totalCost };
  }
  function isSunday(now) {
    return new Date(now + 7 * 3600000).getUTCDay() === 0;
  }
  const percentageQuote = quote;
  function themeQuote(subtotal, events, now = Date.now(), items = [], appearance = {}) {
    const best = percentageQuote(subtotal, events, now);
    if (appearance.sundayDeal !== true || !isSunday(now)) return best;
    const deal=appearance.sundayOffer;
    if(!deal || ![deal.buyQty,deal.giftQty].every(n=>Number.isInteger(n)&&n>=1&&n<=100) ||
      ![deal.buyMenuId,deal.buySizeId,deal.giftMenuId,deal.giftSizeId].every(x=>typeof x==='string'&&x.length))return best;
    if(items.some(i=>!validMoney(i.sizePrice)||!Number.isSafeInteger(i.quantity)||i.quantity<1))return best;
    const matches=(i,menuId,sizeId)=>(menuId==='*'||i.menuId===menuId)&&(sizeId==='*'||i.sizeId===sizeId);
    const buys=i=>matches(i,deal.buyMenuId,deal.buySizeId);
    const gifts=i=>matches(i,deal.giftMenuId,deal.giftSizeId);
    const count=predicate=>items.filter(predicate).reduce((n,i)=>n+i.quantity,0);
    const buyCount=count(buys),giftCount=count(gifts),union=count(i=>buys(i)||gifts(i));
    let sets=Math.min(Math.floor(buyCount/deal.buyQty),Math.floor(giftCount/deal.giftQty),Math.floor(union/(deal.buyQty+deal.giftQty)));
    if(deal.repeat!==true)sets=Math.min(sets,1);
    let left=sets*deal.giftQty,discount=0,overlapBudget=buyCount-sets*deal.buyQty;
    const freeCount=left;
    for(const line of items.filter(gifts).sort((a,b)=>a.sizePrice-b.sizePrice)){
      const count=Math.min(left,line.quantity,buys(line)?overlapBudget:Infinity);
      discount+=count*line.sizePrice;left-=count;
      if(buys(line))overlapBudget-=count;
    }
    discount=Math.min(subtotal,discount);
    if(discount<=best.discount)return best;
    return {subtotal,discount,total:subtotal-discount,promotion:{id:'sunday-custom',title:deal.title||'Quà tặng Chủ nhật',type:'buyXgetY',freeCount,buyMenuId:deal.buyMenuId,buySizeId:deal.buySizeId,giftMenuId:deal.giftMenuId,giftSizeId:deal.giftSizeId,buyQty:deal.buyQty,giftQty:deal.giftQty}};
  }
  const api = { quote:themeQuote, costOf, validMoney, isSunday };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CCPricing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

