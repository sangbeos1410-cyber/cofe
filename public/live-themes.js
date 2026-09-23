
(() => {
  const fields={heroTitle:'.hero h1',heroText:'.hero-inner > div > p',caption:'.season-caption',welcomeTitle:'.welcome-content h1',welcomeText:'.welcome-content > p',successText:'.success-thank'};
  // The hero paragraph can be nested differently between earlier site versions.
  fields.heroText='.hero-inner p:not(.season-caption)';
  const initial=Object.fromEntries(Object.entries(fields).map(([k,s])=>[k,document.querySelector(s)?.textContent.trim()||'']));
  const saved={};
  let lastTheme='',fallback={...initial};
  function apply(){
    const season=document.body.dataset.season||'default';
    if(lastTheme!==season){fallback={...initial};lastTheme=season;}
    // Existing theme scripts supply the seasonal default copy before this listener.
    for(const key of ['caption','welcomeText','successText']){
      const node=document.querySelector(fields[key]);if(node && node.textContent!==node.dataset.customCopy)fallback[key]=node.textContent;
    }
    const custom={...(saved.default||{}),...(saved[season]||{})};
    if(document.body.classList.contains('sunday-theme'))Object.assign(custom,saved.sunday||{});
    for(const [key,selector] of Object.entries(fields)){
      const node=document.querySelector(selector);if(node){node.textContent=custom[key]||fallback[key]||initial[key];node.dataset.customCopy=custom[key]||'';}
    }
  }
  function refresh(){
    // Restore seasonal defaults before applying overrides, including cleared fields.
    document.dispatchEvent(new Event('cheng-theme-change'));
  }
  document.addEventListener('cheng-theme-change',apply);
  for(const theme of ['default','spring','summer','autumn','winter','sunday']){
    db.collection('storeCopy').doc(theme).onSnapshot(s=>{saved[theme]=s.exists?s.data():{};refresh();},e=>console.warn('Không tải được khẩu hiệu:',e.code));
  }
  const layer=document.createElement('div');layer.className='season-atmosphere';layer.setAttribute('aria-hidden','true');
  for(let i=0;i<14;i++){
    const particle=document.createElement('i');particle.style.cssText=`--x:${(i*37+5)%100}%;--delay:-${i*3.7}s;--duration:${24+(i%5)*5}s;--size:${9+(i%4)*3}px;--drift:${i%2?60:-60}px;`;
    layer.append(particle);
  }
  document.body.prepend(layer);
  for(const id of ['welcomeScreen','successScreen']){
    const screen=document.getElementById(id);if(screen)screen.prepend(layer.cloneNode(true));
  }
  const pause=()=>document.body.classList.toggle('motion-paused',document.hidden);
  document.addEventListener('visibilitychange',pause);pause();
})();

