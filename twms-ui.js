/* TWMS Unified UI V4.8 - shared navigation/form behavior */
(function(window,document){
'use strict';
const C=window.WorkshopCore;
const UI={};
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function arr(k){return C?C.legacyList(k):[]}
function key(k){return C?C.canonicalKey(k):k}
function notice(text,bad){
 const el=document.querySelector('#notice,.notice');
 if(!el)return;
 el.textContent=text;el.className='notice '+(bad?'bad':'good');el.style.display='block';
 setTimeout(()=>el.style.display='none',3200);
}
function cardTitle(card){const h=card.querySelector('h2');return h?h.textContent.trim():''}
function isCreateCard(card){
 const t=cardTitle(card);
 return /➕|إضافة|إنشاء|تسجيل (?:دفعة|زيارة|ضمان|عملية|مرجع)|جدولة زيارة|إدارة نقاط عميل/.test(t);
}
function makeCardCollapsible(card){
 if(card.dataset.twmsCollapsible==='1'||!isCreateCard(card))return;
 // Do not collapse dedicated modal/detail panels or cards explicitly marked always visible.
 if(card.dataset.alwaysVisible==='1'||card.id==='modal'||card.id==='detailPanel')return;
 card.dataset.twmsCollapsible='1';
 const h=card.querySelector('h2'); if(!h)return;
 const wrap=document.createElement('div');
 wrap.className='twms-card-head';
 while(h.firstChild)wrap.appendChild(h.firstChild);
 h.appendChild(wrap);
 const b=document.createElement('button');
 b.type='button';b.className='twms-add-toggle';b.textContent='➕ فتح';
 h.appendChild(b);
 const body=[...card.children].filter(x=>x!==h);
 const panel=document.createElement('div');panel.className='twms-form-panel hidden';
 body.forEach(x=>panel.appendChild(x));
 card.appendChild(panel);
 b.addEventListener('click',()=>{
   const hidden=panel.classList.toggle('hidden');
   b.textContent=hidden?'➕ فتح':'✖ إغلاق';
   if(!hidden){card.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>{const first=panel.querySelector('input,select,textarea');if(first)first.focus()},150)}
 });
 // Editing controls in lists should reopen the relevant form.
 card.addEventListener('click',e=>{
   const btn=e.target.closest('button');
   if(btn && /تعديل|Edit/i.test(btn.textContent||'')){
     panel.classList.remove('hidden');b.textContent='✖ إغلاق';
   }
 });
}
function injectStyles(){
 if(document.getElementById('twms-ui-style'))return;
 const s=document.createElement('style');s.id='twms-ui-style';
 s.textContent=`
 .twms-form-panel.hidden{display:none!important}.twms-card-head{display:inline}.twms-add-toggle{float:left!important;min-width:95px!important;background:#1769aa!important;color:#fff!important;margin:-5px 0 0 0!important}.twms-card-head:after{content:"";display:block;clear:both}.twms-form-panel{margin-top:10px}.twms-form-panel .card{box-shadow:none;padding:0;margin:0}
 .twms-after-save{padding:12px;border-radius:10px;background:#e7f6ec;color:#146c2e;font-weight:700;margin-top:10px}.twms-after-save button{margin-top:8px}
 `;document.head.appendChild(s);
}
function initForms(){
 injectStyles();
 document.querySelectorAll('.card').forEach(makeCardCollapsible);
 // One-click guard: prevents accidental double submission across all modules.
 document.addEventListener('click',function(e){
   const b=e.target.closest('button'); if(!b||b.disabled)return;
   const t=(b.textContent||'').trim();
   if(!/(حفظ|تسجيل|إنشاء|إضافة|اعتماد|استلام|جدولة|إرسال)/.test(t))return;
   if(/إلغاء|حذف|بحث|فتح|تعديل/.test(t))return;
   b.dataset.twmsBusy='1'; b.disabled=true; b.style.opacity='.65';
   const old=t; b.textContent='⏳ جاري التنفيذ...';
   setTimeout(()=>{if(document.body.contains(b)){b.disabled=false;b.style.opacity='';b.textContent=old;b.dataset.twmsBusy='';}},5000);
 },true);
}
function openCreateCard(){
 const card=[...document.querySelectorAll('.card')].find(c=>isCreateCard(c));
 if(card){const b=card.querySelector('.twms-add-toggle');if(b)b.click();}
}
UI.version="4.8.0";UI.init=initForms;UI.openCreateCard=openCreateCard;UI.arr=arr;UI.key=key;UI.notice=notice;
UI.afterSave=function(label,url){
 const host=document.querySelector('#notice,.notice');
 if(host){host.style.display='block';host.className='notice good';host.innerHTML='✅ '+esc(label||'تم الحفظ بنجاح')+(url?'<br><span>سيتم فتح الملف تلقائيًا...</span> <button type="button" class="blue" id="twmsOpenRecord">📂 فتح الآن</button>':'');
  const go=()=>{if(url)window.location.href=url};
  const b=document.getElementById('twmsOpenRecord');if(b)b.onclick=go;
  if(url)setTimeout(go,900);
 } else if(url){setTimeout(()=>window.location.href=url,250);}
};
window.TWMSUI=UI;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initForms);else initForms();
})(window,document);
