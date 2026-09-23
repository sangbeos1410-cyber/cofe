from pathlib import Path
from datetime import datetime
import shutil
ROOT=Path(__file__).resolve().parent
FILES={}
FILES['public/theme-moments.js']=r'''
(() => {
  const link=document.querySelector('.admin-link');
  if(link){
    const button=document.createElement('button');
    button.type='button';button.className='admin-icon-button';
    button.setAttribute('aria-label','Mở trang quản trị');button.title='Quản trị';
    button.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>';
    button.onclick=()=>{window.location.href='admin.html';};
    link.remove();document.body.append(button);
  }
  if(!document.body.dataset.season)document.body.dataset.season='default';
  const words={
    spring:['Xuân ghé Cheng, niềm vui nở hoa.','Cheng gửi bạn chút ngọt ngào của mùa xuân.'],
    summer:['Một chút mát lành cho ngày đầy nắng.','Chúc bạn một ngày rực rỡ và thật nhiều năng lượng.'],
    autumn:['Chậm một nhịp, thưởng thức mùa thu.','Chúc bạn những phút thư giãn dịu dàng như mùa thu.'],
    winter:['Ghé Cheng, tìm một chút ấm áp.','Cheng gửi bạn một chút ấm áp giữa ngày se lạnh.'],
    default:['Một chút thư giãn cùng Cheng Coffee.','Cảm ơn bạn đã dành một khoảnh khắc cho Cheng.']
  };
  function apply(){
    const copy=words[document.body.dataset.season]||words.default;
    const welcome=document.querySelector('.welcome-content > p');if(welcome)welcome.textContent=copy[0];
    const success=document.querySelector('.success-thank');if(success)success.textContent=copy[1];
  }
  document.addEventListener('cheng-theme-change',apply);apply();
})();

'''
FILES['public/theme-moments.css']=r'''
/* Chuyển động và màn hình đồng bộ theme */
.admin-icon-button{position:fixed;top:16px;left:16px;z-index:50;width:46px;height:46px;display:grid;place-items:center;padding:0;border:1px solid var(--line,#dcd5c5);border-radius:14px;background:#fffef9ed;color:var(--season-accent,#3b5848);box-shadow:0 5px 20px #28352812;cursor:pointer;transition:transform .25s,box-shadow .25s}
.admin-icon-button:hover{transform:translateY(-2px);box-shadow:0 8px 24px #28352822}
body[data-season] .hero{padding-top:82px}
body[data-season] .welcome-screen,body[data-season] .success-screen{background-color:var(--paper);background-image:var(--season-pattern),radial-gradient(ellipse at 20% 15%,var(--season-a),transparent 65%),linear-gradient(145deg,var(--paper),var(--season-b));background-size:460px 420px,cover,cover;color:var(--season-ink);overflow-y:auto;padding:28px 0}
body[data-season] .success-screen[hidden]{display:none!important}
body[data-season] .welcome-content,body[data-season] .success-content{border:1px solid var(--line);border-radius:26px;padding:28px 24px;background:var(--paper);box-shadow:0 20px 65px #27352912;max-width:calc(100% - 36px);box-sizing:border-box;margin:auto}
body[data-season] .welcome-content h1,body[data-season] .success-content h1{color:var(--season-ink);font-family:Arial,sans-serif!important;font-size:clamp(27px,5vw,38px);line-height:1.3}
body[data-season] .welcome-content p,body[data-season] .welcome-content small,body[data-season] .success-thank,body[data-season] .success-description,body[data-season] .success-payment-hint,body[data-season] .success-order-box span,body[data-season] .success-order-box strong{color:var(--season-ink);line-height:1.7}
body[data-season] .welcome-brand,body[data-season] .success-brand{color:var(--season-accent)}
body[data-season] .welcome-logo{width:140px;height:110px;border:0;border-radius:0;background:var(--art) center/contain no-repeat;font-size:0;box-shadow:none;animation:cheng-gentle-float 7s ease-in-out infinite}
body[data-season] .success-icon{background:var(--season-b);border:1px solid var(--line);color:var(--season-accent);box-shadow:0 0 0 10px var(--paper),0 0 0 11px var(--line)}
body[data-season] .success-order-box{background:var(--season-a);border-color:var(--line)}
body[data-season] .success-button{background:var(--season-accent)!important;border-color:var(--season-accent);color:white!important}
body[data-season] .welcome-progress{background:var(--season-b)}
body[data-season] .welcome-progress span{background:var(--season-accent)}
body[data-season] .welcome-light,body[data-season] .success-light{background:var(--season-a);opacity:.3;animation:cheng-gentle-float 10s ease-in-out infinite;pointer-events:none}
/* Di chuyển nền rất chậm; không tạo lớp phủ lên các nút. */
body[data-season]{animation:cheng-pattern-drift 48s ease-in-out infinite}
body[data-season] .welcome-screen,body[data-season] .success-screen{animation:cheng-pattern-drift 48s ease-in-out infinite}
@keyframes cheng-pattern-drift{0%,100%{background-position:0 0,0 0,0 0}50%{background-position:12px 18px,0 0,0 0}}
@keyframes cheng-gentle-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@media(max-width:600px){.admin-icon-button{top:12px;left:12px;width:42px;height:42px}body[data-season] .hero{padding-top:74px}body[data-season] .welcome-content,body[data-season] .success-content{padding:24px 18px}body[data-season]{animation:none}}
@media(prefers-reduced-motion:reduce){body[data-season],body[data-season] .welcome-screen,body[data-season] .success-screen,body[data-season] .welcome-logo,body[data-season] .welcome-light,body[data-season] .success-light{animation:none!important}.admin-icon-button{transition:none}}

'''

p=ROOT/'public/index.html'
if not p.is_file(): raise SystemExit('Đặt script trong thư mục có firebase.json.')
s=p.read_text(encoding='utf-8-sig')
if 'season-themes.js' not in s: raise SystemExit('Cần cài bản theme trước.')
if 'theme-moments.css' not in s: s=s.replace('</head>','<link rel="stylesheet" href="theme-moments.css?v=1">\n</head>')
if 'theme-moments.js' not in s: s=s.replace('</body>','<script src="theme-moments.js?v=1"></script>\n</body>')
FILES['public/index.html']=s
backup=ROOT/'cheng-backups'/datetime.now().strftime('moments-%Y%m%d-%H%M%S-%f')
for name in FILES:
    p=ROOT/name
    if p.is_file():
        saved=backup/name
        saved.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,saved)
for name,content in FILES.items(): (ROOT/name).write_text(content,encoding='utf-8')
print('Đã thêm chuyển động, màn hình theo mùa và nút quản trị góc trái.')
