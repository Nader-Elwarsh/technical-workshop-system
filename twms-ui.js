(function(){
"use strict";
window.TWMSUI=window.TWMSUI||{};
window.TWMSUI.escape=function(v){
 return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
};
window.TWMSUI.afterSave=function(message,nextUrl){
 try{sessionStorage.setItem("TWMS_LAST_SAVE",JSON.stringify({message:String(message||"تم الحفظ"),at:new Date().toISOString()}));}catch(e){}
 if(nextUrl){window.location.assign(nextUrl);return true;}
 return false;
};
window.TWMSUI.flash=function(message,type){
 const cls=type==="error"?"twms-error":"twms-success";
 let box=document.getElementById("twmsFlash");
 if(!box){box=document.createElement("div");box.id="twmsFlash";box.style.cssText="position:fixed;top:12px;right:12px;z-index:9999;max-width:90vw;padding:12px 16px;border-radius:10px;font:inherit;box-shadow:0 4px 18px rgba(0,0,0,.15);";document.body.appendChild(box);}
 box.className=cls;box.textContent=String(message||"");
 box.style.background=type==="error"?"#ffe2e2":"#e3f7e9";
 box.style.color=type==="error"?"#a00000":"#146c2e";
 setTimeout(()=>{if(box)box.remove()},3500);
};
})();
