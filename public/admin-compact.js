(() => {
  const app=document.getElementById('adminApp');
  const nav=app?.querySelector('.admin-tabs');if(!nav)return;
  nav.id='adminVerticalNavigation';nav.setAttribute('aria-label','Các mục quản trị');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='admin-nav-toggle';
  toggle.setAttribute('aria-controls',nav.id);toggle.setAttribute('aria-expanded','false');
  nav.before(toggle);app.classList.add('nav-enhanced');
  const label=()=>{const active=nav.querySelector('.tab-button.active');toggle.textContent=(app.classList.contains('nav-open')?'✕ Đóng menu':'☰ Menu')+' · '+(active?.textContent.trim()||'Quản trị');};
  const close=()=>{app.classList.remove('nav-open');toggle.setAttribute('aria-expanded','false');label();};
  toggle.onclick=()=>{const open=app.classList.toggle('nav-open');toggle.setAttribute('aria-expanded',String(open));label();};
  nav.addEventListener('click',event=>{if(!event.target.closest('.tab-button'))return;close();if(window.matchMedia('(max-width:720px)').matches)toggle.focus({preventScroll:true});});
  app.addEventListener('keydown',event=>{if(event.key==='Escape'&&app.classList.contains('nav-open')){close();toggle.focus();}});
  new MutationObserver(()=>{if(app.hidden)close();}).observe(app,{attributes:true,attributeFilter:['hidden']});
  new MutationObserver(label).observe(nav,{subtree:true,attributes:true,attributeFilter:['class'],childList:true});
  label();
})();
