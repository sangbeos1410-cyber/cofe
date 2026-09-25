
(() => {
  const panel=document.createElement('section');panel.className='panel theme-panel';
  panel.innerHTML=`<div class="section-label">KHÔNG GIAN CHENG</div><h2>Giao diện theo mùa</h2>
  <p>Chọn một mùa và phối thêm không khí Chủ nhật theo ý bạn.</p>
  <form id="themeForm"><div class="theme-options">
  <label><input type="radio" name="season" value="default" checked>☕ Mặc định</label>
  <label style="background:#ffe8ef"><input type="radio" name="season" value="spring">🌸 Xuân</label>
  <label style="background:#fff2bb"><input type="radio" name="season" value="summer">☀️ Hạ</label>
  <label style="background:#ffe1c2"><input type="radio" name="season" value="autumn">🍂 Thu</label>
  <label style="background:#dff1ff"><input type="radio" name="season" value="winter">❄️ Đông</label></div>
  <label class="checkbox-row"><input id="sundayTheme" type="checkbox">🎈 Phối thêm theme Chủ nhật (hiển thị khi bật)</label>
  <label class="checkbox-row"><input id="sundayDeal" type="checkbox">🎁 Bật sự kiện tặng món mỗi Chủ nhật</label>
  <div class="v5-grid">
  <label>Tên sự kiện<input id="offerTitle" maxlength="100" value="Quà tặng Chủ nhật"></label>
  <label>Tiêu đề banner<input id="offerHeading" maxlength="100" placeholder="Ưu đãi Chủ nhật"></label>
  <label>Nội dung banner<textarea id="offerMessage" maxlength="1000" rows="4" placeholder="Tự viết thông báo cho khách; để trống để tạo từ điều kiện ưu đãi."></textarea></label>
  <label>Món mua và size<select id="offerBuy"></select></label>
  <label>Số lượng phải mua<input id="offerBuyQty" type="number" min="1" max="100" step="1" value="2"></label>
  <label>Món tặng và size<select id="offerGift"></select></label>
  <label>Số lượng được tặng<input id="offerGiftQty" type="number" min="1" max="100" step="1" value="1"></label>
  <label class="checkbox-row"><input id="offerRepeat" type="checkbox" checked>Lặp lại theo số lượng mua</label></div>
  <p>Áp dụng Chủ nhật theo giờ Việt Nam. Khách thêm cả món mua và món tặng vào giỏ; phải đủ một bộ để nhận ưu đãi. Món tặng không tính vào số lượng phải mua. Nếu chọn món tặng bất kỳ, hệ thống miễn tiền món phù hợp có giá thấp nhất, vẫn chừa đủ số món phải mua. Nội dung banner chỉ để hiển thị; điều kiện tính tiền lấy từ các ô lựa chọn. Topping tính riêng. Hệ thống chọn ưu đãi tốt nhất và tính giá vốn cả món tặng.</p>
  <button type="submit" disabled>Lưu giao diện</button><p id="themeMessage" role="status"></p></form>`;
  document.getElementById('tab-promotions').prepend(panel);
  const form=panel.querySelector('form'),button=form.querySelector('button'),message=panel.querySelector('#themeMessage');
  let off=null,menuOff=null,dirty=false,menuReady=false,settingsReady=false,current={},choices=[];
  const get=id=>form.querySelector('#'+id);
  function fillChoices(){
    for(const [id,key] of [['offerBuy','buy'],['offerGift','gift']]){
      const select=get(id),old=dirty?select.value:JSON.stringify([current.sundayOffer?.[key+'MenuId'],current.sundayOffer?.[key+'SizeId']]);
      select.replaceChildren(new Option('Chọn món và size',''));
      for(const c of choices)select.add(new Option(c.label,c.value));
      if(choices.some(c=>c.value===old))select.value=old;
      else if(current.sundayOffer && !dirty)message.textContent='Món đã chọn không còn bán hoặc đã đổi size. Hãy chọn lại trước khi bật ưu đãi.';
    }
  }
  form.addEventListener('change',()=>{dirty=true;});
  firebase.auth().onAuthStateChanged(user=>{
    if(off)off();if(menuOff)menuOff();off=null;menuOff=null;menuReady=false;settingsReady=false;current={};choices=[];button.disabled=true;dirty=false;form.reset();message.textContent='';
    if(!user || user.email!==self.ADMIN_EMAIL)return;
    menuOff=db.collection('menu').onSnapshot(s=>{
      choices=s.docs.flatMap(d=>{const m=d.data();return m.active===true?(m.sizes||[]).map(z=>({menuId:d.id,sizeId:z.id,label:m.name+' · '+(z.name||z.id),value:JSON.stringify([d.id,z.id])})):[];});
      choices.unshift({menuId:'*',sizeId:'*',label:'Món bất kỳ · mọi size',value:JSON.stringify(['*','*'])});
      menuReady=true;fillChoices();button.disabled=!settingsReady;
    },e=>{menuReady=false;button.disabled=true;message.textContent='Không tải được menu: '+e.message;});
    off=db.collection('storeSettings').doc('appearance').onSnapshot(s=>{
      settingsReady=true;current=s.exists?s.data():{};if(!dirty){const a=current;const choice=[...form.elements.season].find(x=>x.value===(a.season||'default'));if(choice)choice.checked=true;
      form.querySelector('#sundayTheme').checked=a.sundayTheme===true;form.querySelector('#sundayDeal').checked=a.sundayDeal===true;
      const o=a.sundayOffer||{};get('offerHeading').value=o.bannerHeading||'';get('offerMessage').value=o.bannerText||'';get('offerTitle').value=o.title||'Quà tặng Chủ nhật';get('offerBuyQty').value=o.buyQty||2;get('offerGiftQty').value=o.giftQty||1;get('offerRepeat').checked=o.repeat!==false;fillChoices();}
      button.disabled=!menuReady;
    },e=>{message.textContent='Không tải được cài đặt: '+e.message;});
  });
  form.onsubmit=async e=>{e.preventDefault();button.disabled=true;message.textContent='Đang lưu…';
    try{
      if(!menuReady||!settingsReady)throw new Error('Vui lòng chờ tải menu và cài đặt.');
      const buy=choices.find(c=>c.value===get('offerBuy').value),gift=choices.find(c=>c.value===get('offerGift').value);
      const buyQty=Number(get('offerBuyQty').value),giftQty=Number(get('offerGiftQty').value),title=get('offerTitle').value.trim();
      let sundayOffer=null;
      if(get('sundayDeal').checked && (!buy||!gift||!title||![buyQty,giftQty].every(n=>Number.isInteger(n)&&n>=1&&n<=100)))throw new Error('Chọn món mua, món tặng, nhập tên và số lượng từ 1 đến 100.');
      if(buy&&gift&&title&&[buyQty,giftQty].every(n=>Number.isInteger(n)&&n>=1&&n<=100))sundayOffer={title,bannerHeading:get('offerHeading').value.trim(),bannerText:get('offerMessage').value.trim(),buyMenuId:buy.menuId,buySizeId:buy.sizeId,buyLabel:buy.label,buyQty,giftMenuId:gift.menuId,giftSizeId:gift.sizeId,giftLabel:gift.label,giftQty,repeat:get('offerRepeat').checked};
      await db.collection('storeSettings').doc('appearance').set({sundayOffer,season:form.elements.season.value,sundayTheme:form.querySelector('#sundayTheme').checked,sundayDeal:form.querySelector('#sundayDeal').checked,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});dirty=false;message.textContent='Đã lưu. Trang khách tự cập nhật giao diện.';}
    catch(err){message.textContent='Chưa lưu được: '+err.message;}finally{button.disabled=false;}
  };
})();

