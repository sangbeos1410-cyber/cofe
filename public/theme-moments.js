
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

