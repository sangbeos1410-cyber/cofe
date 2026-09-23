from pathlib import Path
from datetime import datetime
import shutil,re
ROOT=Path(__file__).resolve().parent
FILES={}
FILES['public/live-themes.js']=r'''
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

'''
FILES['public/admin-copy.js']=r'''
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

'''
FILES['public/live-themes.css']=r'''
/* Animate only transforms and opacity for the moving decorations. */
html body[data-season]::before{animation:none!important}
.season-atmosphere{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:-1;contain:strict}
.season-atmosphere i{position:absolute;top:-35px;left:var(--x);width:var(--size);height:calc(var(--size)*1.4);border-radius:80% 10% 80% 15%;background:#bd7a97;opacity:0;animation:season-fall var(--duration) linear var(--delay) infinite}
body[data-season="spring"] .season-atmosphere i{background:linear-gradient(135deg,#e4aac0,#ae627f);border-radius:85% 10% 80% 20%}
body[data-season="summer"] .season-atmosphere i{border-radius:50%;background:#dcb561;box-shadow:0 0 14px #efc77a66;animation-name:season-glow;top:calc(var(--x))}
body[data-season="autumn"] .season-atmosphere i{background:linear-gradient(45deg,#b7793b,#d7aa65);border-radius:3% 90% 10% 90%}
body[data-season="winter"] .season-atmosphere i{width:var(--size);height:var(--size);background:#8aa5bc;clip-path:polygon(45% 0,55% 0,55% 36%,85% 18%,90% 28%,62% 45%,100% 45%,100% 55%,62% 55%,90% 72%,85% 82%,55% 64%,55% 100%,45% 100%,45% 64%,15% 82%,10% 72%,38% 55%,0 55%,0 45%,38% 45%,10% 28%,15% 18%,45% 36%)}
.welcome-screen>.season-atmosphere,.success-screen>.season-atmosphere{position:absolute;z-index:0}
.success-screen[hidden] .season-atmosphere i{animation-play-state:paused}
body.motion-paused .season-atmosphere i{animation-play-state:paused}
body[data-season] .hero,body[data-season] .menu-card,body[data-season] .cart-card,body[data-season] .category-button{transition:background-color .65s ease,border-color .65s ease,color .65s ease,box-shadow .3s ease,transform .3s ease}
body[data-season] .hero h1,body[data-season] .menu-card h3{transition:color .65s ease}
@keyframes season-fall{0%{transform:translate3d(0,-30px,0) rotate(0);opacity:0}12%{opacity:.32}85%{opacity:.28}100%{transform:translate3d(var(--drift),calc(100vh + 50px),0) rotate(240deg);opacity:0}}
@keyframes season-glow{0%,100%{transform:translate3d(0,0,0) scale(.7);opacity:.06}50%{transform:translate3d(16px,-28px,0) scale(1.15);opacity:.3}}
@media(max-width:600px){.season-atmosphere i:nth-child(n+7){display:none}}
@media(prefers-reduced-motion:reduce){.season-atmosphere{display:none}body[data-season] .hero,body[data-season] .menu-card,body[data-season] .cart-card,body[data-season] .category-button{transition:none!important}}

'''
RULE="    match /storeCopy/{theme} {\n      allow read: if true;\n      allow create, update: if isAdmin()\n        && theme in ['default','spring','summer','autumn','winter','sunday']\n        && request.resource.data.keys().hasOnly(['heroTitle','heroText','caption','welcomeTitle','welcomeText','successText','updatedAt'])\n        && request.resource.data.get('heroTitle','') is string && request.resource.data.get('heroTitle','').size() <= 120\n        && request.resource.data.get('heroText','') is string && request.resource.data.get('heroText','').size() <= 300\n        && request.resource.data.get('caption','') is string && request.resource.data.get('caption','').size() <= 180\n        && request.resource.data.get('welcomeTitle','') is string && request.resource.data.get('welcomeTitle','').size() <= 120\n        && request.resource.data.get('welcomeText','') is string && request.resource.data.get('welcomeText','').size() <= 300\n        && request.resource.data.get('successText','') is string && request.resource.data.get('successText','').size() <= 300\n        && request.resource.data.updatedAt == request.time;\n    }\n"
for name,script in [('public/index.html','live-themes.js'),('public/admin.html','admin-copy.js')]:
    p=ROOT/name
    if not p.is_file():raise SystemExit('Đặt script cạnh firebase.json.')
    text=p.read_text(encoding='utf-8-sig')
    if script not in text:text=text.replace('</body>','<script src="'+script+'?v=1"></script>\n</body>')
    if name.endswith('index.html') and 'live-themes.css' not in text:text=text.replace('</head>','<link rel="stylesheet" href="live-themes.css?v=1">\n</head>')
    FILES[name]=text
p=ROOT/'firestore.rules'
text=p.read_text(encoding='utf-8-sig')
if '/storeCopy/{theme}' not in text:
    pattern=r'match\s+/\{document=\*\*\}\s*\{'
    if not re.search(pattern,text):raise SystemExit('Không tìm thấy vị trí thêm rules. Chưa sửa file nào.')
    text=re.sub(pattern,lambda m:RULE+m.group(),text,count=1)
FILES['firestore.rules']=text
backup=ROOT/'cheng-backups'/datetime.now().strftime('live-%Y%m%d-%H%M%S-%f')
for name in FILES:
    target=ROOT/name
    if target.is_file():
        saved=backup/name;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,saved)
for name,content in FILES.items():(ROOT/name).write_text(content,encoding='utf-8')
print('Đã thêm hiệu ứng 4 mùa và mục Khẩu hiệu trong Admin → Khuyến mãi.')