const CCThemes = (() => {
  let settings = {}, ready = false;
  const seasons = {spring:['Xuân','🌸','Một chút ngọt ngào, một mùa tươi mới.'],summer:['Hạ','☀️','Nắng lên rồi, mình uống gì mát nhé!'],autumn:['Thu','🍂','Chậm lại một chút, nhâm nhi mùa thu.'],winter:['Đông','❄️','Một ly ấm áp cho ngày se lạnh.']};
  const hero = document.querySelector('.hero');
  const banner = document.createElement('section');
  banner.className = 'sunday-banner'; banner.hidden = true;
  hero.after(banner);
  const decor = document.createElement('div'); decor.className='season-decor'; decor.setAttribute('aria-hidden','true'); hero.append(decor);
  const caption = document.createElement('p'); caption.className='season-caption'; hero.querySelector('.hero-inner').append(caption);
  function render() {
    const season=seasons[settings.season];
    document.body.dataset.season=season?settings.season:'default';
    document.body.classList.toggle('sunday-theme',settings.sundayTheme===true);
    decor.textContent=season?`${season[1]}      ${season[1]}      ${season[1]}`:'';
    caption.textContent=season?season[2]:'';
    const active=settings.sundayDeal===true && !!settings.sundayOffer && CCPricing.isSunday(Date.now());
    banner.hidden=!(settings.sundayTheme || active);
    const offer=settings.sundayOffer;
    const description=offer?`${offer.title}: mua ${offer.buyQty} ${offer.buyLabel}, tặng ${offer.giftQty} ${offer.giftLabel}. ${offer.repeat?'Lặp lại theo số lượng.':'Một lần mỗi đơn.'} Thêm đủ món mua và món tặng vào giỏ; topping tính riêng.`:'';
    banner.textContent=active?'🎁 CHỦ NHẬT · '+description:settings.sundayDeal&&offer?'🎈 Ưu đãi Chủ nhật · '+description:'🎈 Sunday Funday · Hẹn nhau một ly, vui cả ngày!';
    CCShop.render(); document.dispatchEvent(new Event('cheng-theme-change'));
  }
  db.collection('storeSettings').doc('appearance').onSnapshot(s=>{settings=s.exists?s.data():{};ready=true;render();},()=>{ready=false;banner.hidden=false;banner.textContent='Chưa tải được giao diện và ưu đãi. Vui lòng kiểm tra kết nối.';});
  setInterval(render,15000);
  return {get settings(){return settings;},get ready(){return ready;},event(){
    if(!settings.sundayDeal || !settings.sundayOffer || !CCPricing.isSunday(Date.now()))return [];
    const o=settings.sundayOffer;
    return [{active:true,startsAt:0,endsAt:8640000000000000,title:o.title,description:`Mua ${o.buyQty} ${o.buyLabel}, tặng ${o.giftQty} ${o.giftLabel}. ${o.repeat?'Lặp lại theo số lượng.':'Một lần mỗi đơn.'} Thêm đủ món mua và món tặng vào giỏ để nhận ưu đãi. Topping tính riêng; không cộng dồn ưu đãi.`,kind:'buy2get1'}];
  }};
})();
