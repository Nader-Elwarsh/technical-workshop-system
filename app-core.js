/* =========================================================
   الورشة الفنية - TWMS Core V2
   المرجع الموحد للبيانات والعلاقات وقواعد العمل.
   ملاحظة أمنية: localStorage مناسب للنسخة المحلية/التجريبية فقط.
   الصلاحيات والأمان الحقيقيان يحتاجان Backend عند الإنتاج.
   ========================================================= */
(function(window){
"use strict";

const CORE_VERSION="2.0.0";

const KEYS={
 settings:"systemSettings", audit:"auditLog", customers:"customers", devices:"devices",
 requests:"maintenanceRequests", workOrders:"workOrders", technicians:"technicians",
 visits:"visits", routes:"routes", inventory:"inventory", inventoryTransactions:"inventory_transactions",
 suppliers:"suppliers", purchaseOrders:"purchaseOrders", invoices:"invoices", payments:"payments",
 warranties:"warranties", contracts:"contracts", notifications:"notifications",
 loyaltyAccounts:"loyaltyAccounts", loyaltyTransactions:"loyaltyTransactions",
 technicalLibrary:"technicalLibrary", users:"users", approvals:"workOrderApprovals",
 diagnoses:"workOrderDiagnoses", assignments:"workOrderAssignments", statusHistory:"workOrderStatusHistory",
 complaints:"complaints", ratings:"customerRatings"
};

const WORK_ORDER_TYPES=[
 "صيانة منزلية","صيانة داخل الورشة","تركيب جهاز","فك ونقل جهاز",
 "زيارة فحص فقط","زيارة ضمان","زيارة دورية","معاينة قبل الإصلاح"
];
const PRIORITIES=["عاجلة جدًا","عاجلة","عادية","منخفضة"];
const STATUSES=[
 "جديد","بانتظار الإسناد","تم الإسناد","في الطريق","جاري الفحص",
 "بانتظار موافقة العميل","بانتظار قطعة غيار","جاري الإصلاح",
 "مكتمل","مغلق","ملغي","مؤرشف"
];

const DEFAULT_SETTINGS={
 workshopName:"الورشة الفنية لصيانة الأجهزة المنزلية والتكييف",
 shortName:"الورشة الفنية",currency:"جنيه",invoicePrefix:"INV-",
 pointValue:1,vipPoints:1000,warrantyDays:30,audit:"on",notifications:"on",
 defaultWarehouse:"المخزن الرئيسي",negativeStock:"no",
 autoTechnicianAssignment:"off",requireCustomerApproval:"off",
 allowReopen:"yes",allowDeleteApproved:"no"
};

function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function read(key,fallback){
 try{const raw=localStorage.getItem(key);if(raw===null)return clone(fallback);
 const v=JSON.parse(raw);return v===null?clone(fallback):v;}
 catch(e){console.error("TWMS read error",e);return clone(fallback);}
}
function write(key,value){
 try{localStorage.setItem(key,JSON.stringify(value));return value;}
 catch(e){console.error("TWMS write error",e);throw new Error("تعذر حفظ البيانات. تأكد من مساحة التخزين.");}
}
function list(key){const v=read(key,[]);return Array.isArray(v)?v:[];}
function now(){return new Date().toISOString();}
function today(){return now().slice(0,10);}
function clean(v,max){return String(v??"").trim().slice(0,max||10000);}
function idOf(o){
 if(!o)return "";
 return String(o.id??o.customerId??o.deviceId??o.requestId??o.workOrderId??o.technicianId??
 o.visitId??o.routeId??o.invoiceId??o.paymentId??o.supplierId??o.code??"");
}
function escReg(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
function numberPart(prefix,id){const m=String(id||"").match(new RegExp("^"+escReg(prefix)+"(\\d+)$"));return m?Number(m[1]):0;}
function nextId(prefix,key,width){
 let max=0;list(key).forEach(x=>{max=Math.max(max,numberPart(prefix,idOf(x)));});
 return prefix+String(max+1).padStart(width||5,"0");
}
function settings(){return Object.assign({},DEFAULT_SETTINGS,read(KEYS.settings,{}));}
function saveSettings(patch){
 const s=Object.assign({},settings(),patch||{},{updatedAt:now()});write(KEYS.settings,s);return s;
}
function find(key,id){return list(key).find(x=>String(idOf(x))===String(id))||null;}
const findCustomer=id=>find(KEYS.customers,id),findDevice=id=>find(KEYS.devices,id),
findRequest=id=>find(KEYS.requests,id),findTechnician=id=>find(KEYS.technicians,id),
findVisit=id=>find(KEYS.visits,id),findInvoice=id=>find(KEYS.invoices,id),
findPayment=id=>find(KEYS.payments,id);

function customerName(c){return c?(c.name||c.fullName||c.customerName||""):"";}
function technicianName(t){return t?(t.name||t.fullName||t.technicianName||""):"";}
function requestCustomerId(r){return r?(r.customerId||r.clientId||""):"";}
function requestDeviceId(r){return r?(r.deviceId||r.applianceId||""):"";}
function customerDevices(cid){return list(KEYS.devices).filter(d=>String(d.customerId||d.clientId||"")===String(cid));}
function customerRequests(cid){return list(KEYS.requests).filter(r=>String(requestCustomerId(r))===String(cid));}
function customerVisits(cid){return list(KEYS.visits).filter(v=>String(v.customerId||v.clientId||"")===String(cid));}
function customerInvoices(cid){return list(KEYS.invoices).filter(i=>String(i.customerId||i.clientId||"")===String(cid));}
function customerPayments(cid){return list(KEYS.payments).filter(p=>String(p.customerId||p.clientId||"")===String(cid));}
function requestVisits(rid){return list(KEYS.visits).filter(v=>String(v.requestId||v.workOrderId||"")===String(rid));}
function requestInvoices(rid){return list(KEYS.invoices).filter(i=>String(i.requestId||i.workOrderId||"")===String(rid));}
function requestPayments(rid){return list(KEYS.payments).filter(p=>String(p.requestId||p.workOrderId||"")===String(rid));}
function requestWarranties(rid){return list(KEYS.warranties).filter(w=>String(w.requestId||w.workOrderId||"")===String(rid));}
function technicianVisits(tid,date){return list(KEYS.visits).filter(v=>String(v.technicianId||"")===String(tid)&&(!date||String(v.date||"")===String(date)));}

function audit(action,module,recordId,description,user){
 if(settings().audit==="off")return null;
 const logs=list(KEYS.audit);
 const entry={id:nextId("AUD-",KEYS.audit,6),user:user||settings().adminName||"النظام",
 module:module||"النظام",action:action||"أخرى",recordId:recordId||"",
 description:clean(description,2000),date:now(),source:"core-v2"};
 logs.unshift(entry);write(KEYS.audit,logs);return entry;
}
function assert(condition,message){if(!condition)throw new Error(message);}
function exists(key,id){return !!find(key,id);}

function validateCustomerDevice(cid,did){
 assert(exists(KEYS.customers,cid),"العميل غير موجود.");
 assert(exists(KEYS.devices,did),"الجهاز غير موجود.");
 const d=findDevice(did);
 assert(String(d.customerId||d.clientId||"")===String(cid),"الجهاز لا ينتمي إلى العميل المختار.");
 return d;
}
function validateRequestRefs(r){
 validateCustomerDevice(requestCustomerId(r),requestDeviceId(r));
 if(r.technicianId)assert(exists(KEYS.technicians,r.technicianId),"الفني المحدد غير موجود.");
}
function isApproved(r){return !!(r&&((r.approved===true)||r.approvedAt||r.status==="مغلق"||r.status==="مؤرشف"));}
function canDeleteRequest(r){
 return !isApproved(r)||settings().allowDeleteApproved==="yes";
}
function statusAllowed(s){return STATUSES.includes(s);}
function priorityAllowed(p){return PRIORITIES.includes(p);}
function typeAllowed(t){return WORK_ORDER_TYPES.includes(t);}

function saveRequest(input,actor){
 const data=Object.assign({},input);
 const oldId=clean(data.id||data.requestId,80);
 data.customerId=clean(data.customerId||data.clientId,80);
 data.deviceId=clean(data.deviceId||data.applianceId,80);
 data.type=data.type||data.requestType||"صيانة منزلية";
 data.requestType=data.type;
 data.priority=data.priority||"عادية";
 data.status=data.status||"جديد";
 assert(data.customerId,"العميل مطلوب.");assert(data.deviceId,"الجهاز مطلوب.");
 assert(typeAllowed(data.type)||settings().allowCustomWorkOrderTypes==="yes","نوع أمر الشغل غير معتمد.");
 assert(priorityAllowed(data.priority),"الأولوية غير معتمدة.");assert(statusAllowed(data.status),"حالة أمر الشغل غير معتمدة.");
 validateRequestRefs(data);
 const arr=list(KEYS.requests);
 if(oldId){
  const i=arr.findIndex(x=>String(idOf(x))===oldId);assert(i>=0,"أمر الشغل غير موجود.");
  const old=arr[i];
  if(old.status!==data.status)recordStatusChange(oldId,old.status,data.status,actor);
  arr[i]=Object.assign({},old,data,{id:oldId,updatedAt:now()});
  write(KEYS.requests,arr);syncRelations();audit("تعديل","أوامر الشغل",oldId,"تم تعديل أمر الشغل",actor);return arr[i];
 }
 const id=nextId("WO-",KEYS.requests,6);
 const item=Object.assign({id,createdAt:now(),approved:false},data);
 arr.push(item);write(KEYS.requests,arr);
 recordStatusChange(id,"",item.status,actor);audit("إضافة","أوامر الشغل",id,"تم إنشاء أمر شغل",actor);syncRelations();return item;
}
function updateRequestStatus(id,status,actor){
 assert(statusAllowed(status),"حالة أمر الشغل غير معتمدة.");
 const arr=list(KEYS.requests),i=arr.findIndex(x=>String(idOf(x))===String(id));
 assert(i>=0,"أمر الشغل غير موجود.");const old=arr[i];
 if(old.status==="مؤرشف")assert(status==="مؤرشف","أمر الشغل المؤرشف لا يمكن تغييره.");
 if(old.status==="مغلق"&&status!=="مغلق")assert(settings().allowReopen==="yes","إعادة فتح أمر الشغل غير مسموحة.");
 arr[i]=Object.assign({},old,{status,updatedAt:now()});write(KEYS.requests,arr);
 recordStatusChange(id,old.status,status,actor);audit("تغيير حالة","أوامر الشغل",id,old.status+" ← "+status,actor);return arr[i];
}
function recordStatusChange(id,from,to,actor){
 const a=list(KEYS.statusHistory);a.unshift({id:nextId("ST-",KEYS.statusHistory,7),requestId:id,fromStatus:from||"",toStatus:to||"",user:actor||"النظام",date:now()});write(KEYS.statusHistory,a);
}
function deleteRequest(id,actor){
 const r=findRequest(id);assert(r,"أمر الشغل غير موجود.");assert(canDeleteRequest(r),"لا يجوز حذف أمر شغل معتمد.");
 const related=[...requestVisits(id),...requestInvoices(id),...requestWarranties(id)];
 assert(related.length===0,"لا يمكن حذف أمر الشغل لوجود بيانات مرتبطة به.");
 write(KEYS.requests,list(KEYS.requests).filter(x=>String(idOf(x))!==String(id)));
 audit("حذف","أوامر الشغل",id,"تم حذف أمر الشغل",actor);return true;
}

function addVisit(data,actor){
 assert(exists(KEYS.requests,data.requestId),"أمر الشغل غير موجود.");
 assert(exists(KEYS.technicians,data.technicianId),"الفني غير موجود.");
 const r=findRequest(data.requestId);
 const v=Object.assign({},data,{id:nextId("VIS-",KEYS.visits,6),customerId:requestCustomerId(r),deviceId:requestDeviceId(r),createdAt:now()});
 const a=list(KEYS.visits);a.push(v);write(KEYS.visits,a);audit("إضافة","الزيارات",v.id,"إضافة زيارة لأمر الشغل "+data.requestId,actor);syncRelations();return v;
}
function requestWorkOrder(id){return findRequest(id);}

function inventoryItem(id){return find(KEYS.inventory,id);}
function inventoryQuantity(id){const x=inventoryItem(id);return x?Number(x.quantity||0):0;}
function addInventoryTransaction(id,qty,type,reference,notes,actor){
 const n=Number(qty);assert(Number.isFinite(n)&&n>0,"الكمية غير صحيحة.");const items=list(KEYS.inventory);
 const i=items.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الصنف غير موجود.");
 const before=Number(items[i].quantity||0),after=before+n;items[i]=Object.assign({},items[i],{quantity:after,updatedAt:now()});write(KEYS.inventory,items);
 const tr=list(KEYS.inventoryTransactions);const t={id:nextId("TR-",KEYS.inventoryTransactions,7),itemId:id,itemName:items[i].name||"",type:type||"إضافة",qty:n,before,after,reference:reference||"",notes:notes||"",date:now()};tr.unshift(t);write(KEYS.inventoryTransactions,tr);audit("حركة مخزون","المخزون",id,type||"إضافة",actor);return items[i];
}
function consumeInventory(id,qty,type,reference,notes,actor){
 const n=Number(qty);assert(Number.isFinite(n)&&n>0,"الكمية غير صحيحة.");const items=list(KEYS.inventory);
 const i=items.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الصنف غير موجود.");const before=Number(items[i].quantity||0);
 assert(settings().negativeStock==="yes"||n<=before,"الكمية المطلوبة أكبر من الرصيد المتاح.");
 const after=before-n;items[i]=Object.assign({},items[i],{quantity:after,updatedAt:now()});write(KEYS.inventory,items);
 const tr=list(KEYS.inventoryTransactions);tr.unshift({id:nextId("TR-",KEYS.inventoryTransactions,7),itemId:id,itemName:items[i].name||"",type:type||"صرف",qty:-n,before,after,reference:reference||"",notes:notes||"",date:now()});write(KEYS.inventoryTransactions,tr);
 audit("صرف مخزون","المخزون",id,type||"صرف",actor);return items[i];
}

function invoiceTotal(i){return Number(i&&(i.grandTotal??i.total??i.finalTotal??i.amount) || 0)||0;}
function paymentsForInvoice(id,includeCancelled){return list(KEYS.payments).filter(p=>String(p.invoiceId||"")===String(id)&&(includeCancelled||p.status!=="ملغاة"));}
function invoicePaid(id){return paymentsForInvoice(id).filter(p=>p.status==="مؤكدة"&&p.type!=="استرداد").reduce((s,p)=>s+Number(p.amount||0),0);}
function invoiceRefunded(id){return paymentsForInvoice(id).filter(p=>p.status==="مؤكدة"&&p.type==="استرداد").reduce((s,p)=>s+Number(p.amount||0),0);}
function invoiceBalance(id){const i=findInvoice(id);return i?Math.max(0,invoiceTotal(i)-invoicePaid(id)+invoiceRefunded(id)):0;}

function getOrCreateLoyalty(cid){
 const a=list(KEYS.loyaltyAccounts);let x=a.find(v=>String(v.customerId)===String(cid));if(x)return x;
 x={id:nextId("LOY-",KEYS.loyaltyAccounts,5),customerId:cid,customerName:customerName(findCustomer(cid)),points:0,createdAt:now()};a.push(x);write(KEYS.loyaltyAccounts,a);return x;
}
function loyaltyPoints(cid){return Number(getOrCreateLoyalty(cid).points||0);}
function changeLoyalty(cid,points,type,reference,notes,actor){
 const n=Number(points);assert(Number.isFinite(n)&&n!==0,"عدد النقاط غير صحيح.");const a=list(KEYS.loyaltyAccounts);let i=a.findIndex(x=>String(x.customerId)===String(cid));
 if(i<0){getOrCreateLoyalty(cid);return changeLoyalty(cid,n,type,reference,notes,actor);}
 const before=Number(a[i].points||0),delta=type==="earn"?Math.abs(n):-Math.abs(n),after=before+delta;assert(after>=0,"رصيد النقاط غير كافٍ.");
 a[i]=Object.assign({},a[i],{points:after,updatedAt:now()});write(KEYS.loyaltyAccounts,a);const t=list(KEYS.loyaltyTransactions);
 t.unshift({id:nextId("LP-",KEYS.loyaltyTransactions,6),customerId:cid,customerName:a[i].customerName||"",type:type||"earn",points:Math.abs(delta),before,after,reference:reference||"",notes:notes||"",date:now()});write(KEYS.loyaltyTransactions,t);audit("نقاط ولاء","الولاء",cid,"تعديل رصيد النقاط",actor);return a[i];
}

function syncRelations(){
 const customers=list(KEYS.customers),cm={};customers.forEach(c=>cm[idOf(c)]={name:customerName(c),phone:c.phone||c.mobile||"",address:c.address||""});
 const devices=list(KEYS.devices).map(d=>{const cid=d.customerId||d.clientId||"",c=cm[cid];return Object.assign({},d,{customerId:cid,customerName:d.customerName||(c&&c.name)||""});});write(KEYS.devices,devices);
 const requests=list(KEYS.requests).map(r=>{const cid=requestCustomerId(r),did=requestDeviceId(r),c=cm[cid],d=devices.find(x=>String(idOf(x))===String(did)),t=findTechnician(r.technicianId);return Object.assign({},r,{customerId:cid,deviceId:did,customerName:r.customerName||(c&&c.name)||"",deviceName:r.deviceName||(d&&(d.name||d.deviceName||d.type))||"",technicianName:r.technicianName||technicianName(t)});});write(KEYS.requests,requests);
 const visits=list(KEYS.visits).map(v=>{const r=findRequest(v.requestId||v.workOrderId),cid=v.customerId||(r&&requestCustomerId(r))||"",c=cm[cid],t=findTechnician(v.technicianId);return Object.assign({},v,{customerId:cid,requestId:v.requestId||v.workOrderId||"",customerName:v.customerName||(c&&c.name)||(r&&r.customerName)||"",technicianName:v.technicianName||technicianName(t)});});write(KEYS.visits,visits);
 const invoices=list(KEYS.invoices).map(i=>{const r=findRequest(i.requestId||i.workOrderId),cid=i.customerId||(r&&requestCustomerId(r))||"",c=cm[cid];return Object.assign({},i,{customerId:cid,requestId:i.requestId||i.workOrderId||"",customerName:i.customerName||(c&&c.name)||""});});write(KEYS.invoices,invoices);
 const payments=list(KEYS.payments).map(p=>{const i=findInvoice(p.invoiceId),cid=p.customerId||(i&&(i.customerId||i.clientId))||"",c=cm[cid];return Object.assign({},p,{customerId:cid,requestId:p.requestId||(i&&i.requestId)||"",customerName:p.customerName||(c&&c.name)||""});});write(KEYS.payments,payments);
 return systemSummary();
}

function validateIntegrity(){
 const problems=[];
 list(KEYS.devices).forEach(d=>{if(!exists(KEYS.customers,d.customerId||d.clientId))problems.push("جهاز بدون عميل: "+idOf(d));});
 list(KEYS.requests).forEach(r=>{try{validateRequestRefs(r);}catch(e){problems.push("أمر شغل "+idOf(r)+": "+e.message);}});
 list(KEYS.visits).forEach(v=>{if(!exists(KEYS.requests,v.requestId||v.workOrderId))problems.push("زيارة بدون أمر شغل: "+idOf(v));});
 list(KEYS.invoices).forEach(i=>{if(i.requestId&&!exists(KEYS.requests,i.requestId))problems.push("فاتورة بدون أمر شغل: "+idOf(i));});
 list(KEYS.payments).forEach(p=>{if(p.invoiceId&&!exists(KEYS.invoices,p.invoiceId))problems.push("دفعة بدون فاتورة: "+idOf(p));});
 return {ok:problems.length===0,problems,count:problems.length};
}

function customerFinancialSummary(cid){
 const inv=customerInvoices(cid),pay=customerPayments(cid).filter(p=>p.status==="مؤكدة");
 const total=inv.reduce((s,i)=>s+invoiceTotal(i),0),paid=pay.filter(p=>p.type!=="استرداد").reduce((s,p)=>s+Number(p.amount||0),0),ref=pay.filter(p=>p.type==="استرداد").reduce((s,p)=>s+Number(p.amount||0),0);
 return {invoices:inv.length,total,paid,refunded:ref,balance:Math.max(0,total-paid+ref)};
}
function customer360(cid){
 const c=findCustomer(cid);if(!c)return null;const req=customerRequests(cid);
 return {customer:c,devices:customerDevices(cid),requests:req,visits:customerVisits(cid),invoices:customerInvoices(cid),payments:customerPayments(cid),warranties:req.flatMap(r=>requestWarranties(idOf(r))),contracts:list(KEYS.contracts).filter(x=>String(x.customerId)===String(cid)),loyalty:getOrCreateLoyalty(cid),financial:customerFinancialSummary(cid)};
}
function systemSummary(){
 return {version:CORE_VERSION,date:today(),customers:list(KEYS.customers).length,devices:list(KEYS.devices).length,
 requests:list(KEYS.requests).length,workOrders:list(KEYS.workOrders).length,technicians:list(KEYS.technicians).length,
 visits:list(KEYS.visits).length,routes:list(KEYS.routes).length,inventory:list(KEYS.inventory).length,
 suppliers:list(KEYS.suppliers).length,purchaseOrders:list(KEYS.purchaseOrders).length,invoices:list(KEYS.invoices).length,
 payments:list(KEYS.payments).length,warranties:list(KEYS.warranties).length,contracts:list(KEYS.contracts).length,
 notifications:list(KEYS.notifications).length,users:list(KEYS.users).length};
}

window.WorkshopCore={
 VERSION:CORE_VERSION,KEYS,DEFAULT_SETTINGS,WORK_ORDER_TYPES,PRIORITIES,STATUSES,
 read,write,list,now,today,clean,idOf,nextId,settings,saveSettings,find,findCustomer,findDevice,findRequest,
 findTechnician,findVisit,findInvoice,findPayment,customerName,technicianName,requestCustomerId,requestDeviceId,
 customerDevices,customerRequests,customerVisits,customerInvoices,customerPayments,requestVisits,requestInvoices,
 requestPayments,requestWarranties,technicianVisits,invoiceTotal,paymentsForInvoice,invoicePaid,invoiceRefunded,
 invoiceBalance,inventoryItem,inventoryQuantity,addInventoryTransaction,consumeInventory,getOrCreateLoyalty,
 loyaltyPoints,changeLoyalty,audit,syncRelations,validateIntegrity,validateCustomerDevice,validateRequestRefs,
 saveRequest,updateRequestStatus,deleteRequest,addVisit,requestWorkOrder,customerFinancialSummary,customer360,systemSummary
};
try{syncRelations();}catch(e){console.error("TWMS Core startup sync failed:",e);}
})(window);
