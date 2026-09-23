
(() => {
 const scope=document.getElementById('tab-promotions');if(!scope)return;
 const panel=document.createElement('section');panel.className='panel';
 const fields={heroTitle:['Tiêu đề trang khách',120],heroText:['Lời giới thiệu',300],caption:['Khẩu hiệu theo mùa',180],welcomeTitle:['Tiêu đề chào mừng',120],welcomeText:['Lời chào mừng',300],successText:['Lời cảm ơn sau đặt hàng',300]};
 panel.innerHTML='<h2>Khẩu hiệu & lời chào</h2><p>Để trống để dùng lời mặc định. Khẩu hiệu riêng của mùa được ưu tiên hơn mục Chung; Chủ nhật được ưu tiên khi bật theme Chủ nhật.</p><label>Chỉnh cho<select id="copyScope"><option value="default">Chung</option><option value="spring">Xuân</option><option value="summer">Hạ</option><option value="autumn">Thu</option><option value="winter">Đông</option><option value="sunday">Chủ nhật</option></select></label><form id="copyForm"><div class="v5-grid"></div><button type="submit" disabled>Lưu khẩu hiệu</button><p role="status"></p></form>';
 scope.append(panel);
 const form=panel.querySelector('form'),select=panel.querySelector('select'),button=form.querySelector('button'),message=form.querySelector('[role="status"]');
 for(const [key,[label,max]] of Object.entries(fields)){
   const wrap=document.createElement('label');wrap.textContent=label;
   const input=document.createElement('textarea');input.name=key;input.maxLength=max;input.rows=2;wrap.append(input);form.querySelector('.v5-grid').append(wrap);
 }
 let off=null,allowed=false,ready=false,dirty=false,previous='default',saving=false,version=0;
 const toggle=()=>{button.disabled=!allowed||!ready||saving;select.disabled=saving;};
 function subscribe(){
   const mine=++version;if(off)off();ready=false;dirty=false;form.reset();message.textContent='Đang tải…';toggle();
   if(!allowed)return;
   off=db.collection('storeCopy').doc(select.value).onSnapshot(s=>{
     if(mine!==version)return;ready=true;
     if(!dirty){const data=s.exists?s.data():{};for(const key in fields)form.elements[key].value=data[key]||'';}
     message.textContent=dirty?'Bạn có thay đổi chưa lưu.':'';toggle();
   },e=>{if(mine!==version)return;ready=false;message.textContent='Không tải được: '+e.message;toggle();});
 }
 form.addEventListener('input',()=>{dirty=true;message.textContent='Bạn có thay đổi chưa lưu.';});
 select.onchange=()=>{if(dirty&&!confirm('Bỏ các thay đổi chưa lưu để chuyển theme?')){select.value=previous;return;}previous=select.value;subscribe();};
 firebase.auth().onAuthStateChanged(user=>{allowed=!!user&&user.email===self.ADMIN_EMAIL;subscribe();});
 form.onsubmit=async e=>{
   e.preventDefault();if(!allowed||!ready||saving)return;
   const scope=select.value,mine=version,data={};for(const key in fields){const value=form.elements[key].value.trim();if(value)data[key]=value;}
   saving=true;toggle();message.textContent='Đang lưu…';
   try{await db.collection('storeCopy').doc(scope).set({...data,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});if(mine===version){dirty=false;message.textContent='Đã lưu. Trang khách sẽ tự cập nhật.';}}
   catch(err){if(mine===version)message.textContent='Chưa lưu được: '+err.message;}
   finally{saving=false;toggle();}
 };
})();

