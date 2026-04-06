// ── CONSTANTS ──────────────────────────────────────────────────
const PIX_KEY    = 'hiagomartins55@hotmail.com';
const BAR_PHONE  = '5561995203082';
const STORAGE_KEY= 'barberbahia_slots_v3';
const MONTHS     = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_PT    = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const SERVICES = [
  {id:'corte',   name:'Corte Masculino', desc:'Tesoura, máquina ou degradê.',  price:55},
  {id:'barba',   name:'Barba Completa',  desc:'Modelagem + toalha quente.',    price:45},
  {id:'combo',   name:'Corte + Barba',   desc:'O combo completo.',             price:90},
  {id:'pigment', name:'Pigmentação',     desc:'Cobertura de falhas.',          price:70},
  {id:'towel',   name:'Hot Towel Shave', desc:'Navalha clássica.',             price:65},
  {id:'sob',     name:'Sobrancelha',     desc:'Alinhamento e design.',         price:25},
  {id:'degrade', name:'Degradê',         desc:'Fade americano ou skin fade.',  price:60},
  {id:'relax',   name:'Relaxamento',     desc:'Tratamento capilar.',           price:80},
];

// ── SLOT ENGINE ────────────────────────────────────────────────
function generateSlots(){
  const s=[];let h=9,m=0;
  while(h<18){s.push(pad(h)+':'+pad(m));m+=40;if(m>=60){h+=Math.floor(m/60);m=m%60;}}
  return s;
}
const ALL_SLOTS=generateSlots();
function pad(n){return String(n).padStart(2,'0');}
function dateKey(y,m,d){return y+'-'+pad(m+1)+'-'+pad(d);}

function getBookings(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}catch{return[];}}
function saveBooking(dk,slot){const b=getBookings();b.push(dk+'|'+slot);localStorage.setItem(STORAGE_KEY,JSON.stringify(b));}
function isBooked(dk,slot){return getBookings().includes(dk+'|'+slot);}

// ── STATE ──────────────────────────────────────────────────────
let calYear,calMonth,selectedDate=null,selectedSlot=null,selectedServices=[];
let phoneVerified=false,currentCode='',resendInterval=null;

// ── PAGE ROUTING ───────────────────────────────────────────────
function openBooking(){
  document.getElementById('page-home').classList.remove('active');
  document.getElementById('page-book').classList.add('active');
  window.scrollTo(0,0);
  initBooking();
}
function closeBooking(){
  document.getElementById('page-book').classList.remove('active');
  document.getElementById('page-home').classList.add('active');
  window.scrollTo(0,0);
}

function setStep(n){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  const targetPanel = document.getElementById('panel-'+n);
  if(targetPanel) targetPanel.classList.add('active');
  
  document.querySelectorAll('.step').forEach((s,i)=>{
    s.classList.remove('active','done');
    if(i+1===n)s.classList.add('active');
    else if(i+1<n)s.classList.add('done');
  });
  window.scrollTo(0,0);
}

function goStep(n){
  if(n===2&&!validateStep1())return;
  if(n===3&&!phoneVerified){alert('⚠️ Verifique seu número de WhatsApp primeiro.');return;}
  if(n===4)buildPaymentPanel();
  setStep(n);
}

// ── VALIDATION ─────────────────────────────────────────────────
function rawPhone(){return document.getElementById('inp-phone').value.replace(/\D/g,'');}
function validateStep1(){
  const name=document.getElementById('inp-name').value.trim();
  const phone=rawPhone();
  const fgN=document.getElementById('fg-name');
  const fgP=document.getElementById('fg-phone');
  
  const nameOk=name.trim().split(/\s+/).length>=2&&name.length>=5;
  // 🚀 NOVA VALIDAÇÃO: Aceita 10 ou 11 dígitos
  const phoneOk=phone.length>=10 && phone.length<=11;
  
  fgN.classList.toggle('has-error',!nameOk);
  fgP.classList.toggle('has-error',!phoneOk);
  return nameOk&&phoneOk;
}

// ── PHONE VERIFICATION ─────────────────────────────────────────
async function sendCode(){
  const name=document.getElementById('inp-name').value.trim();
  const phone=rawPhone();

  // Limpa os quadradinhos de código
  [0,1,2,3].forEach(i=>{
    const el=document.getElementById('cd'+i);
    el.value='';el.style.borderColor='';
  });
  document.getElementById('btn-verify-code').disabled=true;

  // Muda o botão para "Enviando..."
  const btn=document.getElementById('btn-send-code');
  btn.disabled=true;
  const originalText = btn.textContent;
  btn.textContent='Enviando...';

  try {
    // 🚀 CHAMA O NOSSO SERVIDOR NODE.JS AO INVÉS DE ABRIR O WHATSAPP WEB
    const response = await fetch('https://bb0ed7ce-024f-4f25-a257-674af36dee21-00-1kd4kr3w9fxhs.spock.replit.dev/api/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, phone: phone })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Deu certo! A API da Meta já disparou a mensagem.
      document.getElementById('code-section').style.display='block';
      const statusBar = document.getElementById('verify-status-bar');
      const statusDot = statusBar.querySelector('.verify-status');
      statusDot.className='verify-status pending';
      document.getElementById('verify-status-txt').textContent='Código enviado! Verifique seu WhatsApp.';

      // Temporizador de reenvio (60s)
      let secs=60;
      const timer=document.getElementById('resend-timer');
      timer.textContent='Reenviar em '+secs+'s';
      if(resendInterval)clearInterval(resendInterval);
      resendInterval=setInterval(()=>{
        secs--;
        if(secs<=0){
          clearInterval(resendInterval);
          btn.disabled=false;
          btn.textContent=originalText;
          timer.textContent='';
        } else {
          timer.textContent='Reenviar em '+secs+'s';
        }
      },1000);
      
      // Joga o cursor pro primeiro quadradinho automaticamente
      setTimeout(()=>document.getElementById('cd0').focus(),300);
    } else {
      alert('❌ Erro ao enviar: ' + (data.error || data.message));
      btn.disabled=false;
      btn.textContent=originalText;
    }

  } catch (error) {
    console.error('Erro de conexão:', error);
    alert('❌ Falha ao conectar com o servidor. O backend (Node.js) está rodando?');
    btn.disabled=false;
    btn.textContent=originalText;
  }
}

function digitInput(el,idx){
  el.value=el.value.replace(/\D/g,'').slice(0,1);
  if(el.value&&idx<3)document.getElementById('cd'+(idx+1)).focus();
  const all=[0,1,2,3].map(i=>document.getElementById('cd'+i).value).join('');
  document.getElementById('btn-verify-code').disabled=all.length!==4;
}
function digitKey(e,idx){if(e.key==='Backspace'&&!document.getElementById('cd'+idx).value&&idx>0)document.getElementById('cd'+(idx-1)).focus();}

async function verifyCode(){
  const phone=rawPhone();
  const entered=[0,1,2,3].map(i=>document.getElementById('cd'+i).value).join('');

  if(entered.length!==4){
    alert('Insira um código de 4 dígitos');
    return;
  }

  const btn=document.getElementById('btn-verify-code');
  btn.disabled=true;
  btn.textContent='Verificando...';

  try{
    const response=await fetch('https://bb0ed7ce-024f-4f25-a257-674af36dee21-00-1kd4kr3w9fxhs.spock.replit.dev/api/verify-code',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({phone,code:entered})
    });

    const data=await response.json();

    if(response.ok){
      phoneVerified=true;
      document.getElementById('code-section').style.display='none';
      document.getElementById('verify-ok-block').style.display='block';
      const statusBar=document.getElementById('verify-status-bar');
      const statusDot=statusBar.querySelector('.verify-status');
      statusDot.className='verify-status ok';
      document.getElementById('verify-status-txt').textContent='✅ Número verificado com sucesso!';
      document.getElementById('btn-after-verify').disabled=false;
      if(resendInterval)clearInterval(resendInterval);
    }else{
      [0,1,2,3].forEach(i=>{
        const el=document.getElementById('cd'+i);
        el.style.borderColor='var(--red)';el.value='';
        setTimeout(()=>el.style.borderColor='',1200);
      });
      document.getElementById('cd0').focus();
      btn.disabled=false;
      btn.textContent='Verificar Código';
      const attRemaining=data.attemptsRemaining;
      alert('❌ '+data.error+(attRemaining?` (${attRemaining} tentativas restantes)`:''));
      // Shake effect
      const box=document.querySelector('.code-inputs');
      box.style.animation='none';
      setTimeout(()=>{box.style.animation='';},10);
    }
  }catch(e){
    alert('❌ Erro ao verificar código. Tente novamente.');
    console.error(e);
    btn.disabled=false;
    btn.textContent='Verificar Código';
  }
}

// ── CALENDAR ───────────────────────────────────────────────────
function changeMonth(d){
  calMonth+=d;
  if(calMonth>11){calMonth=0;calYear++;}
  if(calMonth<0){calMonth=11;calYear--;}
  renderCalendar();
}
function renderCalendar(){
  document.getElementById('cal-month-label').textContent=MONTHS[calMonth]+' '+calYear;
  const grid=document.getElementById('cal-grid');
  grid.innerHTML='';
  DAYS_PT.forEach(d=>{const el=document.createElement('div');el.className='cal-dow';el.textContent=d;grid.appendChild(el);});
  const first=new Date(calYear,calMonth,1).getDay();
  const days=new Date(calYear,calMonth+1,0).getDate();
  const today=new Date();today.setHours(0,0,0,0);
  for(let i=0;i<first;i++){const e=document.createElement('div');e.className='cal-day empty';grid.appendChild(e);}
  for(let d=1;d<=days;d++){
    const el=document.createElement('div');el.className='cal-day';el.textContent=d;
    const dt=new Date(calYear,calMonth,d);
    const key=dateKey(calYear,calMonth,d);
    if(dt<today)el.classList.add('past');
    else if(dt.getDay()===0)el.classList.add('disabled');
    else{
      el.onclick=()=>selectDate(calYear,calMonth,d);
      if(dt.toDateString()===today.toDateString())el.classList.add('today');
    }
    if(selectedDate===key)el.classList.add('selected');
    grid.appendChild(el);
  }
}
function selectDate(y,m,d){
  selectedDate=dateKey(y,m,d);selectedSlot=null;
  document.getElementById('btn-step3-next').disabled=true;
  renderCalendar();renderSlots();
}
function renderSlots(){
  const sec=document.getElementById('slots-section');
  const grid=document.getElementById('slots-grid');
  const lbl=document.getElementById('slots-date-label');
  if(!selectedDate){sec.style.display='none';return;}
  sec.style.display='block';
  const[y,m,d]=selectedDate.split('-').map(Number);
  lbl.textContent=d+' de '+MONTHS[m-1]+' de '+y;
  grid.innerHTML='';
  ALL_SLOTS.forEach(slot=>{
    const el=document.createElement('div');el.className='slot-btn';el.textContent=slot;
    if(isBooked(selectedDate,slot)){
      el.classList.add('taken');el.title='Horário já reservado';
    } else {
      if(selectedSlot===slot)el.classList.add('selected');
      el.onclick=()=>selectSlot(slot);
    }
    grid.appendChild(el);
  });
}
function selectSlot(s){
  selectedSlot=s;
  document.getElementById('btn-step3-next').disabled=false;
  renderSlots();
}

// ── SERVICES ───────────────────────────────────────────────────
function buildServiceChecks(){
  const c=document.getElementById('srv-checks');c.innerHTML='';
  SERVICES.forEach(srv=>{
    const el=document.createElement('label');el.className='srv-check';
    el.innerHTML=`<input type="checkbox" value="${srv.id}" onchange="toggleSrv('${srv.id}')">
      <div class="check-box"><span class="check-mark">✓</span></div>
      <div class="srv-check-info">
        <span class="srv-check-name">${srv.name}</span>
        <span class="srv-check-desc">${srv.desc}</span>
      </div>
      <span class="srv-check-price">R$ ${srv.price}</span>`;
    c.appendChild(el);
  });
}
function toggleSrv(id){
  const i=selectedServices.indexOf(id);
  if(i>-1)selectedServices.splice(i,1);else selectedServices.push(id);
  document.querySelectorAll('.srv-check').forEach(el=>el.classList.toggle('selected',selectedServices.includes(el.querySelector('input').value)));
  document.getElementById('btn-step4-next').disabled=selectedServices.length===0;
}

// ── PAYMENT PANEL ──────────────────────────────────────────────
function buildPaymentPanel(){
  const name=document.getElementById('inp-name').value.trim();
  const phone=document.getElementById('inp-phone').value.trim();
  const[y,m,d]=selectedDate.split('-').map(Number);
  const dl=d+' de '+MONTHS[m-1]+' de '+y;
  const srvs=SERVICES.filter(s=>selectedServices.includes(s.id));
  const total=srvs.reduce((a,s)=>a+s.price,0);
  const entrada=total*0.5;

  document.getElementById('summary-box').innerHTML=`
    <div class="sum-row"><span class="sum-label">Cliente</span><span class="sum-value">${name}</span></div>
    <div class="sum-row"><span class="sum-label">WhatsApp</span><span class="sum-value">${phone}</span></div>
    <div class="sum-row"><span class="sum-label">Data</span><span class="sum-value">${dl}</span></div>
    <div class="sum-row"><span class="sum-label">Horário</span><span class="sum-value">${selectedSlot}</span></div>
    <div class="sum-row"><span class="sum-label">Serviços</span><span class="sum-value">${srvs.map(s=>s.name).join(', ')}</span></div>
    <div class="sum-row"><span class="sum-label">Total do Serviço</span><span class="sum-total">R$ ${fmt(total)}</span></div>
    <div class="sum-row"><span class="sum-label">✅ Entrada (50%) — Pagar Agora</span><span class="sum-entrada">R$ ${fmt(entrada)}</span></div>
    <div class="sum-row"><span class="sum-label">Restante — Pagar no Dia</span><span class="sum-value">R$ ${fmt(entrada)}</span></div>`;

  document.getElementById('pix-amount').innerHTML=`<small>Valor da Entrada</small>R$ ${fmt(entrada)}`;

  // Generate QR Code
  const qr=document.getElementById('qrcode-container');
  qr.innerHTML='';
  try{
    const payload=buildPixPayload(PIX_KEY,'Barber Bahia',entrada,'BSB');
    new QRCode(qr,{text:payload,width:200,height:200,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});
  }catch(e){
    qr.innerHTML='<p style="color:var(--dim);font-size:.8rem;padding:1rem">Use a chave PIX abaixo para realizar o pagamento.</p>';
  }
}
function fmt(v){return v.toFixed(2).replace('.',',');}

// PIX EMV payload
function buildPixPayload(key,name,amount,city){
  const f=(id,v)=>id+String(v).length.toString().padStart(2,'0')+String(v);
  const merchantAccountInfo=f('00','BR.GOV.BCB.PIX')+f('01',key);
  const additionalData=f('05','***');
  let p=f('00','01')+f('26',merchantAccountInfo)+f('52','0000')+f('53','986')+f('54',amount.toFixed(2))+f('58','BR')+f('59',name.slice(0,25))+f('60',city.slice(0,15))+f('62',additionalData)+'6304';
  return p+crc16(p);
}
function crc16(s){
  let c=0xFFFF;
  for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=(c&0x8000)?(c<<1)^0x1021:(c<<1);}
  return(c&0xFFFF).toString(16).toUpperCase().padStart(4,'0');
}

function copyPix(){
  const copy=t=>{const b=document.getElementById('btn-copy-pix');b.textContent='Copiado ✓';b.classList.add('copied');setTimeout(()=>{b.textContent='Copiar Chave';b.classList.remove('copied');},2500);};
  if(navigator.clipboard){navigator.clipboard.writeText(PIX_KEY).then(copy).catch(()=>fallbackCopy());}
  else fallbackCopy();
  function fallbackCopy(){const t=document.createElement('textarea');t.value=PIX_KEY;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);copy();}
}

// ── CONFIRM ────────────────────────────────────────────────────
function contactSupport(){
  const phone=rawPhone();
  const[y,m,d]=selectedDate.split('-').map(Number);
  const dl=d+' de '+MONTHS[m-1]+' de '+y;
  const srvs=SERVICES.filter(s=>selectedServices.includes(s.id));
  const total=srvs.reduce((a,s)=>a+s.price,0);
  const entrada=total*0.5;
  const srvNames=srvs.map(s=>s.name).join(' + ');
  const name=document.getElementById('inp-name').value.trim();

  const msg=encodeURIComponent(
    `Olá! Realizei o PIX para confirmar meu agendamento.\n\n`+
    `👤 *Cliente:* ${name}\n`+
    `📱 *WhatsApp:* (${phone.slice(0,2)}) ${phone.slice(2,3)} ${phone.slice(3,7)}-${phone.slice(7)}\n`+
    `📅 *Data:* ${dl}\n`+
    `⏰ *Horário:* ${selectedSlot}\n`+
    `✂️ *Serviços:* ${srvNames}\n`+
    `💰 *Valor do PIX:* R$ ${fmt(entrada)}\n\n`+
    `Por favor, confirme meu agendamento.`
  );
  window.open(`https://wa.me/${BAR_PHONE}?text=${msg}`,'_blank');
}
function confirmBooking(){
  const name=document.getElementById('inp-name').value.trim();
  const phone=rawPhone();
  const[y,m,d]=selectedDate.split('-').map(Number);
  const dl=d+' de '+MONTHS[m-1]+' de '+y;
  const srvs=SERVICES.filter(s=>selectedServices.includes(s.id));
  const total=srvs.reduce((a,s)=>a+s.price,0);
  const entrada=total*0.5;
  const srvNames=srvs.map(s=>s.name).join(' + ');
  saveBooking(selectedDate,selectedSlot);

  document.getElementById('success-details').innerHTML=`
    <div class="sd-row"><span>Cliente</span><span>${name}</span></div>
    <div class="sd-row"><span>Data</span><span>${dl}</span></div>
    <div class="sd-row"><span>Horário</span><span>${selectedSlot}</span></div>
    <div class="sd-row"><span>Serviços</span><span>${srvNames}</span></div>
    <div class="sd-row"><span>Total</span><span>R$ ${fmt(total)}</span></div>
    <div class="sd-row"><span>Entrada Paga</span><span style="color:var(--gold)">R$ ${fmt(entrada)}</span></div>`;

  const msg=encodeURIComponent(
    `✂️ *AGENDAMENTO CONFIRMADO — Barber Bahia*\n\n`+
    `👤 *Cliente:* ${name}\n`+
    `📱 *WhatsApp:* (${phone.slice(0,2)}) ${phone.slice(2,3)} ${phone.slice(3,7)}-${phone.slice(7)}\n`+
    `📅 *Data:* ${dl}\n`+
    `⏰ *Horário:* ${selectedSlot}\n`+
    `✂️ *Serviços:* ${srvNames}\n`+
    `💰 *Total:* R$ ${fmt(total)}\n`+
    `✅ *Entrada paga (50%):* R$ ${fmt(entrada)}\n\n`+
    `_Segue comprovante do PIX em anexo._`
  );
  document.getElementById('wpp-link').href=`https://wa.me/${BAR_PHONE}?text=${msg}`;
  setStep(6);
}

// ── INIT ───────────────────────────────────────────────────────
function initBooking(){
  const now=new Date();calYear=now.getFullYear();calMonth=now.getMonth();
  selectedDate=null;selectedSlot=null;selectedServices=[];phoneVerified=false;currentCode='';
  if(resendInterval)clearInterval(resendInterval);
  setStep(1);
  buildServiceChecks();
  renderCalendar();
  document.getElementById('inp-name').value='';
  document.getElementById('inp-phone').value='';
  document.getElementById('btn-send-code').disabled=false;
  document.getElementById('resend-timer').textContent='';
  document.getElementById('code-section').style.display='none';
  document.getElementById('verify-ok-block').style.display='none';
  document.getElementById('btn-after-verify').disabled=true;
  const statusBar = document.getElementById('verify-status-bar');
  const statusDot = statusBar.querySelector('.verify-status');
  statusDot.className='verify-status pending';
  document.getElementById('verify-status-txt').textContent='Aguardando envio do código';
  [0,1,2,3].forEach(i=>document.getElementById('cd'+i).value='');
  ['fg-name','fg-phone'].forEach(id=>document.getElementById(id).classList.remove('has-error'));
}

// ── PHONE MASK ─────────────────────────────────────────────────
document.getElementById('inp-phone').addEventListener('input',function(){
  let v=this.value.replace(/\D/g,'').slice(0,11);
  if(v.length>7)v=v.replace(/^(\d{2})(\d{1})(\d{4})(\d{0,4})/,'($1) $2 $3-$4');
  else if(v.length>2)v=v.replace(/^(\d{2})(\d*)/,'($1) $2');
  this.value=v;
});

// ── SCROLL REVEAL ──────────────────────────────────────────────
new IntersectionObserver((entries)=>{
  entries.forEach((e,i)=>{if(e.isIntersecting){setTimeout(()=>e.target.classList.add('visible'),i*80);/*unobserve*/}});
},{threshold:.1}).observe&&document.querySelectorAll('.reveal').forEach(el=>{
  new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');}});},{threshold:.1}).observe(el);
});
