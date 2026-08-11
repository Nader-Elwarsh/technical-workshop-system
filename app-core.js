/* =========================================================
   الورشة الفنية - TWMS Core V4.7.0 Unified Regression Gated
   المرجع الموحد للبيانات والعلاقات وقواعد العمل - Core V4.7.0.
   ملاحظة أمنية: localStorage مناسب للنسخة المحلية/التجريبية فقط.
   الصلاحيات والأمان الحقيقيان يحتاجان Backend عند الإنتاج.
   ========================================================= */
(function(window){
"use strict";

const CORE_VERSION="4.7.0-unified";

const KEYS={
 deviceImages:"deviceImages",deviceLog:"deviceLog",deviceTypes:"deviceTypes",deviceQr:"deviceQr",deviceKnowledge:"deviceKnowledge",
 settings:"systemSettings", audit:"auditLog", customers:"customers", devices:"devices",
 requests:"maintenanceRequests", workOrders:"maintenanceRequests", technicians:"technicians",
 visits:"visits", routes:"routes", inventory:"inventory", inventoryTransactions:"inventory_transactions",
 suppliers:"suppliers", purchaseOrders:"purchaseOrders", purchaseReceipts:"purchaseReceipts", purchaseReturns:"purchaseReturns", invoices:"invoices", payments:"payments",
 warranties:"warranties", contracts:"contracts", notifications:"notifications",
 loyaltyAccounts:"loyaltyAccounts", loyaltyTransactions:"loyaltyTransactions",
 technicalLibrary:"technicalLibrary", users:"users",
 supplierRatings:"supplierRatings", purchaseInvoices:"purchaseInvoices", warrantyClaims:"warrantyClaims",
 portalSettings:"portalSettings", notificationSettings:"notificationSettings", contractSettings:"contractSettings", securitySettings:"securitySettings",
 customerMessages:"customerMessages", faqItems:"faqItems", blogPosts:"blogPosts",
 approvals:"workOrderApprovals",
 diagnoses:"workOrderDiagnoses", assignments:"workOrderAssignments", statusHistory:"workOrderStatusHistory",
 complaints:"complaints", ratings:"customerRatings",
customerMergeRequests:"customerMergeRequests"
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
 pointValue:1,vipPoints:1000,warrantyDays:30,notifications:"on",
 defaultWarehouse:"المخزن الرئيسي",negativeStock:"no",
 autoTechnicianAssignment:"off",requireCustomerApproval:"off",
 allowReopen:"yes",allowDeleteApproved:"no",
allowDeleteCustomer:"no",allowDeleteDevice:"no",
 audit:"on",inventoryDeductionMode:"completion",warrantyCreationMode:"close"
};

function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function read(key,fallback){
 try{const raw=localStorage.getItem(key);if(raw===null)return clone(fallback);
 const v=JSON.parse(raw);return v===null?clone(fallback):v;}
 catch(e){console.error("TWMS read error",e);return clone(fallback);}
}
function coreWrite(key,value){
 try{localStorage.setItem(key,JSON.stringify(value));return value;}
 catch(e){console.error("TWMS write error",e);throw new Error("تعذر حفظ البيانات. تأكد من مساحة التخزين.");}
}
function list(key){const v=read(key,[]);return Array.isArray(v)?v:[];}
function now(){return new Date().toISOString();}
function today(){return now().slice(0,10);}
function clean(v,max){return String(v??"").trim().slice(0,max||10000);}
function normalizeWorkshopSerial(v){
 return String(v??"").trim().toUpperCase().replace(/\s+/g,"");
}
function nextWorkshopSerial(){
 const rows=list(KEYS.devices);
 let max=0;
 rows.forEach(d=>{
  const m=String(d.workshopSerial||"").match(/^WRK-(\d+)$/i);
  if(m)max=Math.max(max,Number(m[1]));
 });
 return "WRK-"+String(max+1).padStart(6,"0");
}
function workshopSerialExists(value,excludeId){
 const k=normalizeWorkshopSerial(value);
 return !!k&&list(KEYS.devices).some(d=>String(idOf(d))!==String(excludeId||"")&&normalizeWorkshopSerial(d.workshopSerial)===k);
}
function deviceFingerprint(input){
 const x=input||{};
 const brand=normalizeText(x.brand||x.manufacturer||"");
 const custom=normalizeText(x.brandCustom||"");
 return [
  normalizeText(x.type||x.deviceType||""),
  normalizeText(x.subtype||x.deviceSubtype||x.configuration||""),
  brand,
  brand==="أخرى"?custom:"",
  normalizeText(x.refrigerant||""),
  normalizeText(x.capacity||""),
  normalizeText(x.inverter||"")
 ].join("|");
}
function findDeviceByWorkshopSerial(serial){
 const key=normalizeWorkshopSerial(serial);
 if(!key)return null;
 return list(KEYS.devices).find(d=>normalizeWorkshopSerial(d.workshopSerial)===key)||null;
}
function findDeviceByLegacySerial(serial){
 const key=normalizeSerialNumber(serial);
 if(!key)return null;
 return list(KEYS.devices).find(d=>normalizeSerialNumber(d.manufacturerSerial||d.serialNumber||d.serial)===key)||null;
}
function findDuplicateDevice(input,excludeId){
 const x=input||{},cid=String(x.customerId||x.clientId||"");
 const fp=deviceFingerprint(x);
 if(!cid||!fp.replace(/\|/g,""))return null;
 return list(KEYS.devices).find(d=>{
  if(String(idOf(d))===String(excludeId||"")||d.archived)return false;
  const dcid=String(d.customerId||d.clientId||"");
  return dcid===cid&&deviceFingerprint(d)===fp;
 })||null;
}
function normalizeSerialNumber(v){
 let s=String(v??"").normalize("NFKC").trim().toLowerCase();
 const ar="٠١٢٣٤٥٦٧٨٩", fa="۰۱۲۳۴۵۶۷۸۹";
 s=[...s].map(ch=>{
   let i=ar.indexOf(ch); if(i>=0)return String(i);
   i=fa.indexOf(ch); if(i>=0)return String(i);
   return ch;
 }).join("");
 return s.replace(/[\s\-–—_./\\]+/g,"");
}
function idOf(o){
 if(!o)return "";
 return String(o.id??"");
}
function escReg(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
function numberPart(prefix,id){const m=String(id||"").match(new RegExp("^"+escReg(prefix)+"(\\d+)$"));return m?Number(m[1]):0;}
function nextId(prefix,key,width){
 let max=0;list(key).forEach(x=>{max=Math.max(max,numberPart(prefix,idOf(x)));});
 return prefix+String(max+1).padStart(width||5,"0");
}
function settings(){return Object.assign({},DEFAULT_SETTINGS,read(KEYS.settings,{}));}
function saveSettings(patch,actor){
 requirePermission("settings",actor);
 const s=Object.assign({},settings(),patch||{},{updatedAt:now()});
 coreWrite(KEYS.settings,s);audit("تعديل","الإعدادات","", "تعديل إعدادات النظام",actor);return s;
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

// Public module boundary: modules may read through the Core, but may not write
// arbitrary records directly. All mutations must use a validated Core API.
function publicWriteBlocked(){
 throw new Error("الكتابة المباشرة لبيانات النظام ممنوعة. استخدم واجهات WorkshopCore المعتمدة.");
}

// Compatibility boundary for legacy UI modules. Pages read/write only through
// this Core adapter so every module uses the same storage source and key aliases.
const LEGACY_KEY_ALIASES={
 inventoryParts:KEYS.inventory,
 auditLogs:KEYS.audit,
 inventory_transactions:KEYS.inventoryTransactions,
 maintenanceRequests:KEYS.requests,
 supplierRatings:KEYS.supplierRatings,
 purchaseInvoices:KEYS.purchaseInvoices,
 warrantyClaims:KEYS.warrantyClaims,
 portalSettings:KEYS.portalSettings,
 notificationSettings:KEYS.notificationSettings,
 contractSettings:KEYS.contractSettings,
 securitySettings:KEYS.securitySettings,
 customerMessages:KEYS.customerMessages,
 faqItems:KEYS.faqItems,
 blogPosts:KEYS.blogPosts
};
function canonicalKey(key){return LEGACY_KEY_ALIASES[String(key)]||String(key);}
function legacyList(key){return list(canonicalKey(key));}
function legacyWrite(key,value,actor){
 const k=canonicalKey(key);
 assert(Array.isArray(value),"بيانات السجل يجب أن تكون قائمة.");
 const before=list(k);
 coreWrite(k,clone(value));
 auditImmutable("تحديث بيانات","التوافق المركزي",k,"تحديث بيانات من وحدة واجهة قديمة عبر Core",actor||"النظام",{before,after:value,source:"legacy-adapter"});
 return value;
}
function legacyRemove(key,id,actor){
 const k=canonicalKey(key),rows=list(k),next=rows.filter(x=>String(idOf(x))!==String(id));
 if(next.length===rows.length)return false;
 legacyWrite(k,next,actor);return true;
}


function auditImmutable(action,module,recordId,description,user,meta){
 const logs=list(KEYS.audit),a=actorInfo(user),m=meta&&typeof meta==="object"?meta:{};
 const entry={
  id:nextId("AUD-",KEYS.audit,6),
  operationId:m.operationId||nextId("OP-",[],8),
  correlationId:m.correlationId||"",
  user:a.name||settings().adminName||"النظام",userId:a.id||"",role:a.role||"",
  module:module||"النظام",action:action||"أخرى",recordId:recordId||"",
  description:clean(description,2000),date:now(),source:"core-v4.7.0",
  result:m.result||"success",before:m.before===undefined?null:m.before,
  after:m.after===undefined?null:m.after,
  changedFields:Array.isArray(m.changedFields)?m.changedFields:[],
  ip:m.ip||"",immutable:true
 };
 logs.unshift(entry);coreWrite(KEYS.audit,logs);return entry;
}
function audit(action,module,recordId,description,user,meta){
 return auditImmutable(action,module,recordId,description,user,meta);
}
function deleteAudit(){
 throw new Error("لا يجوز حذف سجل المراجعة.");
}
function updateAudit(){
 throw new Error("لا يجوز تعديل سجل المراجعة.");
}

function assert(condition,message){if(!condition)throw new Error(message);}
function exists(key,id){return !!find(key,id);}

function actorInfo(actor){
 if(actor && typeof actor==="object") return {
  id:actor.id||actor.userId||"",
  name:actor.name||actor.fullName||actor.username||"المستخدم",
  role:actor.role||actor.userRole||""
 };
 if(actor==="النظام") return {id:"SYSTEM",name:"النظام",role:"system"};
 if(actor) return {id:"",name:String(actor),role:""};
 return {id:"",name:"",role:""};
}

function getPermissionRegistry(){
 const s=settings(),configured=s.permissionRegistry;
 if(configured&&typeof configured==="object")return clone(configured);
 return {
  create:["manager","technician","موظف","فني","admin","owner"],
  customerRequest:["customer","عميل"],
  customerMessage:["customer","عميل","manager","موظف","admin","owner"],
  customerDevice:["customer","عميل"],
  customerProfile:["customer","عميل"],
  update:["manager","technician","موظف","فني","admin","owner"],
  delete:["manager","admin","owner"],
  archive:["manager","admin","owner"],
  approve:["manager","admin","owner"],
  assign:["manager","admin","owner"],
  stock:["manager","storekeeper","مخزن","admin","owner"],
  finance:["manager","accountant","محاسب","admin","owner"],
  settings:["manager","admin","owner"],
  integrity:["manager","admin","owner"],
  customerUpdate:["manager","موظف","admin","owner"],
customerMerge:["manager","admin","owner"],
  deviceUpdate:["manager","موظف","فني","admin","owner"],
  workOrderUpdate:["manager","موظف","فني","admin","owner"],
  diagnosis:["manager","technician","فني","admin","owner"],
  complaint:["manager","موظف","admin","owner"],
  rating:["customer","عميل","manager","موظف","admin","owner"],
  library:["manager","technician","موظف","فني","admin","owner"],
  route:["manager","موظف","admin","owner"],
  supplierManage:["manager","storekeeper","مخزن","admin","owner"],
  purchaseManage:["manager","storekeeper","مخزن","admin","owner"],
  technicianManage:["manager","admin","owner"],
  visitManage:["manager","admin","owner"],
  warranty:["manager","admin","owner"],
  contract:["manager","admin","owner"],
  invoiceEdit:["manager","accountant","محاسب","admin","owner"],
  invoiceClosedEdit:["admin","owner"],
  userManagement:["manager","admin","owner"],
  securityManage:["admin","owner"],
  workflowManage:["manager","admin","owner"]
 };
}
function setPermissionRegistry(registry,actor){
 requirePermission("securityManage",actor);
 assert(registry&&typeof registry==="object","سجل الصلاحيات غير صحيح.");
 const cleaned={};
 Object.keys(registry).forEach(k=>{cleaned[String(k)]=Array.isArray(registry[k])?registry[k].map(x=>String(x)):[];});
 coreWrite(KEYS.settings,Object.assign({},settings(),{permissionRegistry:cleaned,updatedAt:now()}));
 audit("تعديل الصلاحيات","الأمان","PERMISSION_REGISTRY","تحديث سجل الصلاحيات",actor);
 return cleaned;
}
function hasPermission(action,actor){
 const a=actorInfo(actor),role=String(a.role||"").toLowerCase();
 if(role==="system"&&a.id==="SYSTEM")return true;
 if(!a.id||!a.role)return false;
 const adminRoles=["admin","administrator","owner","مالك","مدير النظام"];
 if(adminRoles.includes(role))return true;
 const matrix=getPermissionRegistry();
 const allowed=matrix[String(action||"")]||[];
 return Array.isArray(allowed)&&allowed.map(x=>String(x).toLowerCase()).includes(role);
}
function requirePermission(action,actor){
 assert(hasPermission(action,actor),"ليس لديك صلاحية تنفيذ هذه العملية.");
}
function requireAnyPermission(actions,actor){
 const aa=Array.isArray(actions)?actions:[actions];
 assert(aa.some(a=>hasPermission(a,actor)),"ليس لديك صلاحية تنفيذ هذه العملية.");
}
function log(action,module,recordId,description,actor){return audit(action,module,recordId,description,actor);}


function validateCustomerDevice(cid,did){
 assert(exists(KEYS.customers,cid),"العميل غير موجود.");
 assert(exists(KEYS.devices,did),"الجهاز غير موجود.");
 const d=findDevice(did);
 assert(String(d.customerId||d.clientId||"")===String(cid),"الجهاز لا ينتمي إلى العميل المختار.");
 return d;
}


function getWorkflowPolicy(){
 const s=settings();
 return (s.workflowPolicy&&typeof s.workflowPolicy==="object")?clone(s.workflowPolicy):{};
}
function allowedWorkflowTransition(from,to,actor){
 const p=getWorkflowPolicy(),fromKey=String(from||"__none__"),toKey=String(to||"");
 const transitions=p.transitions&&p.transitions[fromKey];
 if(Array.isArray(transitions)&&!transitions.includes(toKey))return false;
 const required=p.permissions&&p.permissions[toKey];
 if(required&&typeof required==="string")return hasPermission(required,actor);
 return true;
}
function assertWorkflowTransition(from,to,actor){
 assert(allowedWorkflowTransition(from,to,actor),"انتقال حالة أمر الشغل غير مسموح.");
}
function setWorkflowPolicy(policy,actor){
 requirePermission("workflowManage",actor);
 assert(policy&&typeof policy==="object","سياسة دورة الحالات غير صحيحة.");
 const normalized=clone(policy);
 coreWrite(KEYS.settings,Object.assign({},settings(),{workflowPolicy:normalized,updatedAt:now()}));
 audit("تعديل دورة الحالات","أوامر الشغل","WORKFLOW_POLICY","تحديث سياسة دورة الحالات",actor);
 return normalized;
}
function validateRequestChain(r){
 assert(r&&r.customerId&&r.deviceId,"أمر الشغل يحتاج عميلًا وجهازًا.");
 validateCustomerDevice(r.customerId,r.deviceId);
 if(r.technicianId)assert(exists(KEYS.technicians,r.technicianId),"الفني المحدد غير موجود.");
 return r;
}
function validateInvoiceChain(i){
 if(i.requestId||i.workOrderId){
  const rid=i.requestId||i.workOrderId,r=findRequest(rid);assert(r,"أمر الشغل المرتبط بالفاتورة غير موجود.");
  if(i.customerId||i.clientId)assert(String(i.customerId||i.clientId)===String(requestCustomerId(r)),"الفاتورة لا تخص عميل أمر الشغل.");
  if(i.deviceId||i.applianceId)assert(String(i.deviceId||i.applianceId)===String(requestDeviceId(r)),"الفاتورة لا تخص جهاز أمر الشغل.");
 }
 if(i.customerId||i.clientId)assert(exists(KEYS.customers,i.customerId||i.clientId),"عميل الفاتورة غير موجود.");
 if(i.deviceId||i.applianceId){
  const d=findDevice(i.deviceId||i.applianceId);assert(d,"جهاز الفاتورة غير موجود.");
  if(i.customerId||i.clientId)assert(String(d.customerId||d.clientId||"")===String(i.customerId||i.clientId),"جهاز الفاتورة لا ينتمي إلى عميل الفاتورة.");
 }
 return i;
}
function validateWarrantyChain(w){
 assert(w&&typeof w==="object","بيانات الضمان غير صحيحة.");
 const rid=w.requestId||w.workOrderId||"";
 const r=rid?findRequest(rid):null;
 const iid=w.invoiceId||"";
 const i=iid?findInvoice(iid):null;
 const conid=w.contractId||"";
 const contract=conid?find(KEYS.contracts,conid):null;
 const did=w.deviceId||w.applianceId||"";
 const d=did?findDevice(did):null;
 if(rid)assert(r,"أمر شغل الضمان غير موجود.");
 if(iid)assert(i,"فاتورة الضمان غير موجودة.");
 if(conid)assert(contract,"عقد الضمان غير موجود.");
 assert(d,"جهاز الضمان مطلوب ويجب أن يكون موجودًا.");
 assert(exists(KEYS.customers,d.customerId||d.clientId),"عميل جهاز الضمان غير موجود.");
 const cid=w.customerId||w.clientId||(r&&requestCustomerId(r))||(i&&(i.customerId||i.clientId))||(contract&&contract.customerId)||(d.customerId||d.clientId)||"";
 assert(cid&&exists(KEYS.customers,cid),"عميل الضمان مطلوب وغير موجود.");
 assert(String(d.customerId||d.clientId||"")===String(cid),"جهاز الضمان لا ينتمي إلى عميل الضمان.");
 assert(r||i||contract,"الضمان يجب أن يرتبط بأمر شغل أو فاتورة أو عقد.");
 if(r){assert(String(requestDeviceId(r))===String(d.id),"جهاز الضمان لا يطابق جهاز أمر الشغل.");assert(String(requestCustomerId(r))===String(cid),"عميل الضمان لا يطابق أمر الشغل.");}
 if(i){assert(String(i.customerId||i.clientId||"")===String(cid),"عميل الضمان لا يطابق الفاتورة.");if(i.deviceId||i.applianceId)assert(String(i.deviceId||i.applianceId)===String(d.id),"جهاز الضمان لا يطابق الفاتورة.");}
 if(contract){assert(String(contract.customerId)===String(cid),"عميل الضمان لا يطابق العقد.");assert(Array.isArray(contract.deviceIds)&&contract.deviceIds.map(String).includes(String(d.id)),"جهاز الضمان غير مدرج في العقد.");}
 return w;
}
function validateContractChain(c){
 assert(c&&c.customerId&&exists(KEYS.customers,c.customerId),"العميل غير موجود.");
 (Array.isArray(c.deviceIds)?c.deviceIds:[]).forEach(did=>{
  const d=findDevice(did);assert(d,"أحد أجهزة العقد غير موجود.");
  assert(String(d.customerId||d.clientId||"")===String(c.customerId),"أحد أجهزة العقد لا يتبع العميل.");
 });
 return c;
}
function validatePaymentChain(p){
 if(p.invoiceId){
  const i=findInvoice(p.invoiceId);assert(i,"فاتورة الدفعة غير موجودة.");
  if(p.customerId||p.clientId)assert(String(p.customerId||p.clientId)===String(i.customerId||i.clientId||""),"الدفعة لا تخص عميل الفاتورة.");
  if(p.requestId)assert(String(p.requestId)===String(i.requestId||i.workOrderId||""),"الدفعة لا تخص أمر شغل الفاتورة.");
 }
 if(p.requestId)assert(exists(KEYS.requests,p.requestId),"أمر شغل الدفعة غير موجود.");
 return p;
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


function customerHasOperationalData(cid){
 return customerDevices(cid).length||customerRequests(cid).length||
  customerInvoices(cid).length||customerVisits(cid).length||
  list(KEYS.contracts).some(x=>String(x.customerId)===String(cid))||
  list(KEYS.warranties).some(x=>String(x.customerId)===String(cid));
}
function deviceHasOperationalData(did){
 return list(KEYS.requests).some(x=>String(requestDeviceId(x))===String(did))||
  list(KEYS.invoices).some(x=>String(x.deviceId||x.applianceId)===String(did))||
  list(KEYS.warranties).some(x=>String(x.deviceId||x.applianceId)===String(did))||
  list(KEYS.contracts).some(x=>Array.isArray(x.deviceIds)&&x.deviceIds.map(String).includes(String(did)));
}

function customerClassification(cid){
 const c=findCustomer(cid); if(!c)return null;
 const req=customerRequests(cid),visits=customerVisits(cid),inv=customerInvoices(cid);
 const ratings=list(KEYS.ratings).filter(x=>String(x.customerId||x.clientId||"")===String(cid)&&x.archived!==true);
 const complaints=list(KEYS.complaints).filter(x=>String(x.customerId||x.clientId||"")===String(cid)&&x.archived!==true);
 const loyalty=loyaltyPoints(cid);
 const closed=req.filter(r=>["مكتمل","مغلق"].includes(String(r.status||""))).length;
 const cancelled=req.filter(r=>String(r.status||"")==="ملغي").length;
 const avgRating=ratings.length?ratings.reduce((s,r)=>s+Number(r.rating||0),0)/ratings.length:0;
 const totalInvoices=inv.reduce((s,i)=>s+invoiceTotal(i),0);
 const dates=[];
 [req,visits,inv,ratings,complaints].forEach(arr=>arr.forEach(x=>{
   const d=x.updatedAt||x.closedAt||x.completedAt||x.date||x.createdAt;
   if(d)dates.push(new Date(d).getTime());
 }));
 const lastActivity=dates.length?new Date(Math.max.apply(null,dates)).toISOString():"";
 const daysSince=lastActivity?Math.max(0,Math.floor((Date.now()-new Date(lastActivity).getTime())/86400000)):null;

 // No TWMS work order yet = new to the system, even if known to the workshop.
 if(req.length===0){
  return {tier:"جديد",score:0,reason:"لا يوجد أمر شغل مسجل للعميل داخل النظام حتى الآن.",metrics:{
   requests:0,closedRequests:0,visits:visits.length,ratings:ratings.length,avgRating:0,
   complaints:complaints.length,totalInvoices,loyaltyPoints:loyalty,lastActivity,daysSince
  }};
 }

 let score=Math.min(20,closed*2)+Math.min(10,visits.length);
 if(avgRating>0)score+=Math.min(10,Math.round(avgRating*2));
 if(totalInvoices>=30000)score+=10;
 else if(totalInvoices>=15000)score+=8;
 else if(totalInvoices>=7000)score+=6;
 else if(totalInvoices>=3000)score+=4;
 else if(totalInvoices>=1000)score+=2;
 score+=Math.min(10,Math.floor(Math.max(0,loyalty)/100));
 score-=Math.min(9,complaints.length*3);
 score-=Math.min(6,cancelled*2);
 if(daysSince!==null){
  if(daysSince<=90)score+=3;
  else if(daysSince<=180)score+=1;
  else if(daysSince>365)score-=3;
 }
 score=Math.max(0,score);

 let tier="عادي";
 if(score>=25)tier="VIP";
 else if(score>=15)tier="مميز";
 else if(score>=6)tier="نشط";

 return {tier,score,
  reason:`أوامر الشغل: ${req.length} • المكتمل/المغلق: ${closed} • الزيارات: ${visits.length} • التقييمات: ${ratings.length}${ratings.length?` بمتوسط ${avgRating.toFixed(1)}/5`:""} • الفواتير: ${totalInvoices.toFixed(2)} ${settings().currency} • نقاط الولاء: ${loyalty} • الشكاوى: ${complaints.length} • الإلغاءات: ${cancelled}`,
  metrics:{requests:req.length,closedRequests:closed,visits:visits.length,ratings:ratings.length,
   avgRating:Number(avgRating.toFixed(2)),complaints:complaints.length,totalInvoices,
   loyaltyPoints:loyalty,lastActivity,daysSince}
 };
}
function recalculateCustomerClassification(cid,actor){
 const c=findCustomer(cid);assert(c,"العميل غير موجود.");
 const result=customerClassification(cid);assert(result,"تعذر حساب تصنيف العميل.");
 const oldTier=String(c.customerTier||c.category||"");
 if(oldTier===result.tier && Number(c.classificationScore||0)===Number(result.score))return c;
 const a=list(KEYS.customers),i=a.findIndex(x=>String(idOf(x))===String(cid));assert(i>=0,"العميل غير موجود.");
 const before=clone(a[i]);
 a[i]=Object.assign({},a[i],{
  customerTier:result.tier,category:result.tier,
  classificationScore:result.score,classificationReason:result.reason,
  classificationMetrics:result.metrics,classificationUpdatedAt:now(),updatedAt:now()
 });
 coreWrite(KEYS.customers,a);
 audit("تصنيف تلقائي","العملاء",cid,"تحديث تصنيف العميل تلقائيًا بواسطة محرك التصنيف",actor,
  {before,after:a[i],changedFields:["customerTier","category","classificationScore","classificationReason","classificationMetrics"]});
 return a[i];
}

function customerPhoneExists(phone,excludeId){
 const p=normalizePhone(phone);if(!p)return false;
 return list(KEYS.customers).some(c=>String(idOf(c))!==String(excludeId||"")&&customerContactPhones(c).includes(p));
}

function saveCustomer(input,actor){
 const aa=actorInfo(actor);
 if(String(aa.role||"").toLowerCase()==="customer" || String(aa.role||"")==="عميل") {
  requirePermission("customerProfile",actor);
  assert(String(aa.id||"")===String(input.id||input.customerId||""),"لا يمكنك تعديل بيانات عميل آخر.");
 } else requirePermission(input.id||input.customerId?"customerUpdate":"create",actor);
 const d=Object.assign({},input), oldId=clean(d.id||d.customerId,80);
 assert(clean(d.name||d.fullName,200),"اسم العميل مطلوب.");
 d.name=clean(d.name||d.fullName,200); d.phone=clean(d.phone||d.mobile,50);
 delete d.category; delete d.customerTier; delete d.classificationScore; delete d.classificationReason; delete d.classificationMetrics;
 const a=list(KEYS.customers);
 const inputPhones=customerContactPhones(d);
 const duplicatePhone=a.find(x=>String(idOf(x))!==String(oldId)&&inputPhones.some(p=>customerContactPhones(x).includes(p)));
 assert(!duplicatePhone,"رقم الهاتف مستخدم بالفعل في حساب عميل آخر.");
 // البريد الإلكتروني وسيلة تواصل وليست معرفًا فريدًا إلزاميًا؛ يمكن لأفراد الأسرة مشاركته، ويظهر التشابه كمؤشر فقط.
 if(oldId){
  const i=a.findIndex(x=>String(idOf(x))===oldId);assert(i>=0,"العميل غير موجود.");
  a[i]=Object.assign({},a[i],d,{id:oldId,updatedAt:now()});coreWrite(KEYS.customers,a);
  audit("تعديل","العملاء",oldId,"تم تعديل بيانات العميل",actor);syncRelations();return recalculateCustomerClassification(oldId,actor);
 }
 const id=nextId("CUS-",KEYS.customers,5),item=Object.assign({id,createdAt:now(),archived:false},d);
 a.push(item);coreWrite(KEYS.customers,a);audit("إضافة","العملاء",id,"تم إنشاء عميل",actor);return recalculateCustomerClassification(id,actor);
}

function normalizePhone(v){
 let p=String(v||"").replace(/\D/g,"");
 if(p.startsWith("0020"))p=p.slice(4);
 if(p.startsWith("20")&&p.length===12)p="0"+p.slice(2);
 return p;
}
function normalizeText(v){return String(v||"").trim().toLowerCase().replace(/\s+/g," ");}
function customerContactPhones(c){
 const contacts=Array.isArray(c&&c.contacts)?c.contacts:[];
 return [c&&c.phone,c&&c.mobile,c&&c.phone2,c&&c.secondaryPhone]
  .concat(Array.isArray(c&&c.alternatePhones)?c.alternatePhones:[])
  .concat(contacts.filter(x=>String(x&&x.type||"").toLowerCase().includes("phone")||String(x&&x.type||"").toLowerCase().includes("هاتف")).map(x=>x&&x.value))
  .filter(Boolean).map(normalizePhone).filter(Boolean);
}
function customerContactEmails(c){
 const contacts=Array.isArray(c&&c.contacts)?c.contacts:[];
 return [c&&c.email]
  .concat(Array.isArray(c&&c.alternateEmails)?c.alternateEmails:[])
  .concat(contacts.filter(x=>String(x&&x.type||"").toLowerCase().includes("email")||String(x&&x.type||"").toLowerCase().includes("mail")||String(x&&x.type||"").toLowerCase().includes("بريد")).map(x=>x&&x.value))
  .filter(Boolean).map(x=>normalizeText(x)).filter(Boolean);
}
function customerAddresses(c){
 const out=[];
 if(c){
  out.push({governorate:c.governorate,center:c.center,village:c.village,street:c.street,address:c.address,location:c.location});
  if(Array.isArray(c.addresses))c.addresses.forEach(a=>out.push(a));
 }
 return out.filter(Boolean);
}
function customerAddressSignals(c){
 return customerAddresses(c).map(a=>({
  governorate:normalizeText(a.governorate),center:normalizeText(a.center),village:normalizeText(a.village),street:normalizeText(a.street),address:normalizeText(a.address||a.text),
  location:a.location&&a.location.lat!=null&&a.location.lng!=null?{lat:Number(a.location.lat),lng:Number(a.location.lng)}:null
 }));
}
function customerDeviceFingerprints(cid){
 return customerDevices(cid).map(d=>({
  id:idOf(d),
  workshopSerial:normalizeWorkshopSerial(d.workshopSerial||""),
  legacySerial:normalizeSerialNumber(d.manufacturerSerial||d.serialNumber||d.serial),
  type:normalizeText(d.type||d.deviceType),
  brand:normalizeText(d.brand||d.manufacturer)
 })).map(d=>({
  serialKey:d.workshopSerial?"workshop:"+d.workshopSerial:(d.legacySerial?"legacy:"+d.legacySerial:""),
  modelKey:"",
  data:d
 }));
}
function customerIdentitySignals(c){
 const phones=[...new Set(customerContactPhones(c))];
 const emails=[...new Set(customerContactEmails(c))];
 const name=normalizeText((c&&c.name)||c&&c.fullName||c&&c.customerName||"");
 const address=normalizeText((c&&c.address)||"");
 return {phones,emails,name,address,governorate:normalizeText(c&&c.governorate),center:normalizeText(c&&c.center),village:normalizeText(c&&c.village),street:normalizeText(c&&c.street),addresses:customerAddressSignals(c),deviceFingerprints:customerDeviceFingerprints(idOf(c))};
}
function addressSimilarity(a,b){
 let score=0;
 if(a.governorate&&a.governorate===b.governorate)score+=1;
 if(a.center&&a.center===b.center)score+=1;
 if(a.village&&a.village===b.village)score+=1;
 if(a.street&&b.street&&a.street===b.street)score+=1;
 if(a.address&&b.address&&(a.address===b.address||a.address.includes(b.address)||b.address.includes(a.address)))score+=2;
 return score;
}
function deviceSimilarity(a,b){
 const aa=a.deviceFingerprints||[],bb=b.deviceFingerprints||[];
 const serialA=new Set(aa.map(x=>x.serialKey).filter(Boolean)),serialB=new Set(bb.map(x=>x.serialKey).filter(Boolean));
 let serialCount=0;serialA.forEach(k=>{if(serialB.has(k))serialCount++;});
 const modelA=new Set(aa.map(x=>x.modelKey).filter(Boolean)),modelB=new Set(bb.map(x=>x.modelKey).filter(Boolean));
 let modelCount=0;modelA.forEach(k=>{if(modelB.has(k))modelCount++;});
 return {serialCount,modelCount};
}
function findPossibleCustomerMatches(input,excludeId){
 const x=customerIdentitySignals(input||{});
 return list(KEYS.customers).filter(c=>{
  const id=String(idOf(c)||"");return id&&id!==String(excludeId||"")&&!c.mergedIntoCustomerId;
 }).map(c=>{
  const y=customerIdentitySignals(c);
  const reasons=[];
  let score=0;
  const phoneMatch=x.phones.some(p=>y.phones.includes(p));
  const emailMatch=x.emails.some(e=>y.emails.includes(e));
  const nameMatch=!!x.name&&!!y.name&&x.name===y.name;
  if(phoneMatch){score+=100;reasons.push("same_phone");}
  if(emailMatch){score+=35;reasons.push("same_email");}
  if(nameMatch){score+=15;reasons.push("same_name");}
  return {customer:c,score,reasons,location:false,household:false};
 }).filter(x=>x.score>=35).sort((a,b)=>b.score-a.score);
}
function findCustomerRelationshipSuggestions(cid){
 const c=findCustomer(cid);if(!c)return [];
 const x=customerIdentitySignals(c);
 return list(KEYS.customers).filter(o=>String(idOf(o))!==String(cid)&&!o.mergedIntoCustomerId&&!o.archived).map(o=>{
  const y=customerIdentitySignals(o),addressScore=Math.max(...(x.addresses||[]).map(a=>Math.max(...(y.addresses||[]).map(b=>addressSimilarity(a,b)),0)),0),deviceMatch=deviceSimilarity(x,y);
  const samePhone=x.phones.some(p=>y.phones.includes(p)),sameEmail=x.emails.some(e=>y.emails.includes(e));
  const locationMatch=!!x.governorate&&x.governorate===y.governorate&&!!x.center&&x.center===y.center;
  const sameName=!!x.name&&x.name===y.name;
  let score=(samePhone?12:0)+(sameEmail?10:0)+(sameName?4:0)+(locationMatch?1:0)+Math.min(4,addressScore)+Math.min(16,deviceMatch.serialCount*16);
  const likelyIdentity=samePhone||sameEmail||(sameName&&addressScore>=4);
  const household=!likelyIdentity&&(addressScore>=3||deviceMatch.serialCount>0||(sameName&&locationMatch));
  return {id:idOf(o),name:customerName(o),score,likelyIdentity,household,signals:{samePhone,sameEmail,sameName,locationMatch,addressScore,sharedDeviceSerialCount:deviceMatch.serialCount,sharedDeviceModelCount:deviceMatch.modelCount}};
 }).filter(x=>x.household||x.likelyIdentity).sort((a,b)=>b.score-a.score).slice(0,10);
}
function linkCustomerRelationship(customerAId,customerBId,type,evidence,actor){
 requirePermission("customerMerge",actor);
 assert(String(customerAId)!==String(customerBId),"لا يمكن ربط العميل بنفسه.");
 assert(exists(KEYS.customers,customerAId)&&exists(KEYS.customers,customerBId),"أحد العملاء غير موجود.");
 const arr=list(KEYS.customerRelationships);
 const existsLink=arr.find(r=>(String(r.customerAId)===String(customerAId)&&String(r.customerBId)===String(customerBId))||(String(r.customerAId)===String(customerBId)&&String(r.customerBId)===String(customerAId)));
 if(existsLink)return existsLink;
 const item={id:nextId("CRL-",KEYS.customerRelationships,6),customerAId:String(customerAId),customerBId:String(customerBId),relationshipType:type||"نفس الأسرة/العنوان",evidence:Array.isArray(evidence)?evidence:[],status:"active",createdAt:now(),createdBy:actorInfo(actor)};
 arr.unshift(item);coreWrite(KEYS.customerRelationships,arr);
 audit("ربط عملاء","العملاء",item.id,"إنشاء علاقة بين حسابين مستقلين دون دمج البيانات",actor,{after:item,changedFields:["customerAId","customerBId","relationshipType","evidence"]});
 return item;
}
function customerRelationships(cid){
 return list(KEYS.customerRelationships).filter(r=>r.status!=="inactive"&&(String(r.customerAId)===String(cid)||String(r.customerBId)===String(cid)));
}

function addCustomerPhone(cid,phone,actor){
 requirePermission("customerUpdate",actor);
 const c=findCustomer(cid);assert(c,"العميل غير موجود.");
 const p=normalizePhone(phone);assert(p,"رقم الهاتف غير صحيح.");
 const all=list(KEYS.customers);
 const dup=all.find(x=>String(idOf(x))!==String(cid)&&customerIdentitySignals(x).phones.includes(p));
 assert(!dup,"رقم الهاتف مستخدم بالفعل في حساب عميل آخر.");
 const current=customerIdentitySignals(c).phones;
 if(current.includes(p))return c;
 const raw=String(phone).trim();
 const next=Object.assign({},c);
 if(!next.phone2)next.phone2=raw;
 else{
  const alt=Array.isArray(next.alternatePhones)?next.alternatePhones.slice():[];
  if(!alt.some(x=>normalizePhone(x)===p))alt.push(raw);
  next.alternatePhones=alt;
 }
 next.updatedAt=now();
 const i=all.findIndex(x=>String(idOf(x))===String(cid));all[i]=next;coreWrite(KEYS.customers,all);
 audit("إضافة هاتف بديل","العملاء",String(cid),"إضافة رقم هاتف جديد إلى حساب عميل قائم بدل إنشاء حساب مكرر",actor,
  {before:c,after:next,changedFields:["phone2","alternatePhones"]});
 syncRelations();recalculateCustomerClassification(String(cid),actor);return next;
}

function requestCustomerMerge(primaryId,secondaryId,actor,reason){
 requirePermission("customerMerge",actor);
 assert(String(primaryId)!==String(secondaryId),"لا يمكن طلب دمج الحساب مع نفسه.");
 const p=findCustomer(primaryId),s=findCustomer(secondaryId);
 assert(p&&s,"أحد حسابات العملاء غير موجود.");
 assert(!s.mergedIntoCustomerId,"الحساب الثاني مدمج بالفعل.");
 const a=list(KEYS.customerMergeRequests),id=nextId("CMR-",a,6);
 const item={id,primaryCustomerId:String(primaryId),secondaryCustomerId:String(secondaryId),
  reason:clean(reason||"احتمال أن الحسابين لنفس العميل",500),status:"pending",
  createdAt:now(),createdBy:actorInfo(actor)};
 a.unshift(item);coreWrite(KEYS.customerMergeRequests,a);
 audit("طلب دمج","العملاء",id,"إنشاء طلب دمج حسابي عميلين",actor,{before:null,after:item});
 return item;
}
function mergeCustomers(primaryId,secondaryId,actor,options){
 requirePermission("customerMerge",actor);
 assert(String(primaryId)!==String(secondaryId),"لا يمكن دمج العميل مع نفسه.");
 const snapshotKeys=[KEYS.customers,KEYS.devices,KEYS.requests,KEYS.visits,KEYS.invoices,KEYS.payments,KEYS.warranties,KEYS.contracts,KEYS.notifications,KEYS.loyaltyAccounts,KEYS.loyaltyTransactions,KEYS.complaints,KEYS.ratings,KEYS.customerRelationships,KEYS.customerMergeRequests,KEYS.audit];
 const snapshot={};snapshotKeys.forEach(k=>snapshot[k]=clone(read(k,[])));
 try{
  const customersArr=list(KEYS.customers),pi=customersArr.findIndex(c=>String(idOf(c))===String(primaryId)),si=customersArr.findIndex(c=>String(idOf(c))===String(secondaryId));
  assert(pi>=0&&si>=0,"أحد حسابات العملاء غير موجود.");
  const primary=clone(customersArr[pi]),secondary=clone(customersArr[si]);
  assert(!primary.mergedIntoCustomerId,"الحساب الرئيسي نفسه مدمج في حساب آخر.");
  assert(!secondary.mergedIntoCustomerId,"الحساب الثاني مدمج بالفعل في حساب آخر.");
  const mergeId=nextId("MER-",[],8),before={primary:clone(primary),secondary:clone(secondary)};
  const mergedPhones=[...new Set(customerContactPhones(primary).concat(customerContactPhones(secondary)))];
  const mergedEmails=[...new Set(customerContactEmails(primary).concat(customerContactEmails(secondary)))];
  const addresses=[...(Array.isArray(primary.addresses)?primary.addresses:[])];
  (Array.isArray(secondary.addresses)?secondary.addresses:[]).forEach(a=>{if(!addresses.some(x=>normalizeText(x.text||x.address)===normalizeText(a.text||a.address)&&normalizeText(x.label)===normalizeText(a.label)))addresses.push(a);});
  const contacts=[...(Array.isArray(primary.contacts)?primary.contacts:[])];
  (Array.isArray(secondary.contacts)?secondary.contacts:[]).forEach(x=>{if(!contacts.some(y=>normalizeText(y.type)===normalizeText(x.type)&&normalizeText(y.value)===normalizeText(x.value)))contacts.push(x);});
  const mergedPrimary=Object.assign({},primary,{phone:primary.phone||secondary.phone||"",phone2:primary.phone2||secondary.phone2||"",alternatePhones:mergedPhones.filter(x=>x!==normalizePhone(primary.phone||"")),email:primary.email||secondary.email||"",alternateEmails:mergedEmails.filter(x=>x!==normalizeText(primary.email||"")),addresses,contacts,mergedCustomerIds:[...new Set((Array.isArray(primary.mergedCustomerIds)?primary.mergedCustomerIds:[]).concat([String(secondaryId)]))],updatedAt:now()});
  const relationKeys=[KEYS.devices,KEYS.requests,KEYS.visits,KEYS.invoices,KEYS.payments,KEYS.warranties,KEYS.contracts,KEYS.notifications,KEYS.loyaltyTransactions,KEYS.complaints,KEYS.ratings];
  const changed=[];
  relationKeys.forEach(key=>{const arr=list(key);let n=0;const next=arr.map(row=>{if(!row||typeof row!=="object")return row;const cid=row.customerId||row.clientId||"";if(String(cid)!==String(secondaryId))return row;n++;const z=Object.assign({},row,{customerId:String(primaryId),updatedAt:now()});if(Object.prototype.hasOwnProperty.call(z,"clientId"))z.clientId=String(primaryId);return z;});if(n){coreWrite(key,next);changed.push({key,count:n});}});
  const loyalty=list(KEYS.loyaltyAccounts),pLi=loyalty.findIndex(x=>String(x.customerId)===String(primaryId)),sLi=loyalty.findIndex(x=>String(x.customerId)===String(secondaryId));
  if(sLi>=0){const sp=Number(loyalty[sLi].points||0);if(pLi>=0){loyalty[pLi]=Object.assign({},loyalty[pLi],{points:Number(loyalty[pLi].points||0)+sp,updatedAt:now(),customerName:customerName(mergedPrimary)});loyalty.splice(sLi,1);}else{loyalty[sLi]=Object.assign({},loyalty[sLi],{customerId:String(primaryId),customerName:customerName(mergedPrimary),updatedAt:now()});}coreWrite(KEYS.loyaltyAccounts,loyalty);changed.push({key:KEYS.loyaltyAccounts,count:1});}
  // Re-point relationship records; self-links are removed.
  const rels=list(KEYS.customerRelationships),nextR=[];
  rels.forEach(r=>{let a=String(r.customerAId),b=String(r.customerBId);if(a===String(secondaryId))a=String(primaryId);if(b===String(secondaryId))b=String(primaryId);if(a===b)return;const dup=nextR.some(x=>(String(x.customerAId)===a&&String(x.customerBId)===b)||(String(x.customerAId)===b&&String(x.customerBId)===a));if(!dup)nextR.push(Object.assign({},r,{customerAId:a,customerBId:b,updatedAt:now()}));});coreWrite(KEYS.customerRelationships,nextR);
  customersArr[pi]=mergedPrimary;customersArr[si]=Object.assign({},secondary,{archived:true,mergeStatus:"merged",mergedIntoCustomerId:String(primaryId),mergedAt:now(),mergedBy:actorInfo(actor),mergeOperationId:mergeId,updatedAt:now()});coreWrite(KEYS.customers,customersArr);
  const mr=list(KEYS.customerMergeRequests);mr.forEach((r,i)=>{const same=(String(r.primaryCustomerId)===String(primaryId)&&String(r.secondaryCustomerId)===String(secondaryId))||(String(r.primaryCustomerId)===String(secondaryId)&&String(r.secondaryCustomerId)===String(primaryId));if(same&&r.status==="pending")mr[i]=Object.assign({},r,{status:"approved",approvedAt:now(),approvedBy:actorInfo(actor),mergeOperationId:mergeId});});coreWrite(KEYS.customerMergeRequests,mr);
  audit("دمج عملاء","العملاء",String(primaryId),`دمج ${secondaryId} داخل الحساب الرئيسي ${primaryId} مع الاحتفاظ بالسجل التاريخي`,actor,{operationId:mergeId,correlationId:mergeId,before,after:{primary:clone(mergedPrimary),secondary:clone(customersArr[si]),changedRelations:changed},changedFields:["customerId","clientId","mergedCustomerIds","mergedIntoCustomerId","mergeStatus","addresses","contacts"]});
  syncRelations();recalculateCustomerClassification(String(primaryId),actor);
  const integrity=validateIntegrity();assert(integrity.ok,"فشل فحص سلامة العلاقات بعد الدمج: "+integrity.problems.join(" | "));
  audit("فحص بعد الدمج","النظام",String(primaryId),"نجح فحص سلامة العلاقات بعد دمج العميل",actor,{operationId:mergeId,result:"success"});
  return {operationId:mergeId,primary:findCustomer(primaryId),mergedCustomerId:String(secondaryId),changedRelations:changed};
 }catch(e){snapshotKeys.forEach(k=>{try{coreWrite(k,snapshot[k]);}catch(_){}});throw e;}
}
function resolveCustomerId(cid){
 const c=findCustomer(cid);if(!c)return null;
 return c.mergedIntoCustomerId?String(c.mergedIntoCustomerId):String(idOf(c));
}
function findCustomerByPhone(phone){
 const p=normalizePhone(phone);if(!p)return null;
 const all=list(KEYS.customers);
 let c=all.find(x=>customerIdentitySignals(x).phones.includes(p));
 if(!c)return null;
 const rid=resolveCustomerId(idOf(c));
 return findCustomer(rid)||c;
}

function archiveCustomer(cid,actor){
 requirePermission("archive",actor);const c=findCustomer(cid);assert(c,"العميل غير موجود.");
 const a=list(KEYS.customers),i=a.findIndex(x=>String(idOf(x))===String(cid));
 a[i]=Object.assign({},a[i],{archived:true,archivedAt:now(),updatedAt:now()});coreWrite(KEYS.customers,a);
 audit("أرشفة","العملاء",cid,"تم أرشفة العميل",actor);return a[i];
}
function deleteCustomer(cid,actor){
 requirePermission("delete",actor);const c=findCustomer(cid);assert(c,"العميل غير موجود.");
 assert(!customerHasOperationalData(cid),"لا يمكن حذف عميل لديه بيانات تشغيلية؛ استخدم الأرشفة.");
 if(settings().allowDeleteCustomer!=="yes")throw new Error("حذف العملاء معطل من الإعدادات؛ استخدم الأرشفة.");
 coreWrite(KEYS.customers,list(KEYS.customers).filter(x=>String(idOf(x))!==String(cid)));
 audit("حذف","العملاء",cid,"تم حذف عميل بلا بيانات تشغيلية",actor);return true;
}


/* Device module completion: lifecycle, history, attachments, types, QR, knowledge */
const DEFAULT_DEVICE_TYPES=[
 {id:"washing",name:"غسالة"},
 {id:"fridge",name:"تلاجة"},
 {id:"ac",name:"تكييف"},
 {id:"heater",name:"سخان"},
 {id:"cooler",name:"مبرد"},
 {id:"freezer",name:"فريزر"},
 {id:"stove",name:"بوتاجاز"},
 {id:"oven",name:"فرن"},
 {id:"microwave",name:"ميكروويف"}
];
function deviceSubtypeOptions(type){
 const t=normalizeText(type);
 const map=[
  [/غسالة|washing/i,["هاف أو نص اتوماتيك","اتوماتيك تحميل علوي","اتوماتيك تحميل امامي","أطفال"]],
  [/تلاجة|ثلاجة|refrigerator/i,["بابين نوفروست","بابين ديفروست أو عادية","باب واحد","٣ باب نوفروست"]],
  [/فريزر|freezer/i,["أدراج نوفروست","أدراج ديفروست أو عادي","صندوق"]],
  [/تكييف|air\s*condition|ac/i,["اسبليت","شباك","متنقل فريون","متنقل صحراوي"]],
  [/سخان|heater/i,["غاز","كهرباء"]],
  [/بوتاجاز|stove/i,["٤ شعلة","٥ شعلة","بلت ان"]],
  [/فرن|oven/i,["فرن كهربائي","يعمل بالغاز"]],
  [/ميكروويف|microwave/i,["تاتش","زراير"]]
 ];
 for(const [rx,vals] of map)if(rx.test(t))return vals.slice();
 return [];
}
function deviceTypeList(){
 const rows=list(KEYS.deviceTypes).filter(x=>!x.archived);
 if(rows.length)return rows.sort((a,b)=>DEFAULT_DEVICE_TYPES.findIndex(d=>d.id===a.id)-DEFAULT_DEVICE_TYPES.findIndex(d=>d.id===b.id));
 return DEFAULT_DEVICE_TYPES.map(x=>Object.assign({},x));
}
function saveDeviceType(input,actor){
 requirePermission("deviceTypeManage",actor);
 const x=Object.assign({},input||{});
 x.id=x.id||nextId("DT");
 x.name=clean(x.name,120); assert(x.name,"اسم نوع الجهاز مطلوب.");
 x.parentId=x.parentId||null;
 x.active=x.active!==false;
 x.updatedAt=now(); x.createdAt=x.createdAt||now();
 const rows=list(KEYS.deviceTypes); const i=rows.findIndex(r=>String(idOf(r))===String(x.id));
 if(i>=0)rows[i]=x; else rows.push(x);
 coreWrite(KEYS.deviceTypes,rows);
 audit(i>=0?"تعديل نوع جهاز":"إضافة نوع جهاز","الأجهزة",x.id,"إدارة أنواع الأجهزة",actor,{after:x});
 return x;
}
function addDeviceAttachment(deviceId,input,actor){
 requirePermission("deviceUpdate",actor);
 const d=findDevice(deviceId);assert(d,"الجهاز غير موجود.");
 const x=Object.assign({},input||{});
 x.id=x.id||nextId("DIMG");
 x.deviceId=String(deviceId);
 x.category=clean(x.category||"other",40);
 x.fileName=clean(x.fileName,255);
 x.fileRef=x.fileRef||null;
 x.note=clean(x.note,1000);
 x.createdAt=now(); x.createdBy=actor?.id||null;
 const rows=list(KEYS.deviceImages); rows.push(x); coreWrite(KEYS.deviceImages,rows);
 audit("إضافة مرفق جهاز","الأجهزة",String(deviceId),"إضافة مرفق إلى ملف الجهاز",actor,{after:x});
 return x;
}
function deviceAttachments(deviceId){
 return list(KEYS.deviceImages).filter(x=>String(x.deviceId)===String(deviceId)&&!x.archived);
}
function deviceHistory(deviceId){
 const rows=list(KEYS.deviceLog).filter(x=>String(x.deviceId)===String(deviceId));
 return rows.sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
}
function appendDeviceHistory(deviceId,event,actor,data){
 const d=findDevice(deviceId);assert(d,"الجهاز غير موجود.");
 const x={id:nextId("DLOG"),deviceId:String(deviceId),event:clean(event,100),createdAt:now(),
          actorId:actor?.id||null,data:data||null};
 const rows=list(KEYS.deviceLog);rows.push(x);coreWrite(KEYS.deviceLog,rows);
 return x;
}
function setDeviceQr(deviceId,enabled,actor){
 requirePermission("deviceQrManage",actor);
 const d=findDevice(deviceId);assert(d,"الجهاز غير موجود.");
 const rows=list(KEYS.deviceQr);
 let x=rows.find(r=>String(r.deviceId)===String(deviceId));
 if(!x){x={id:nextId("DQR"),deviceId:String(deviceId)};rows.push(x);}
 x.enabled=!!enabled;x.token=x.token||("dev_"+String(deviceId)+"_"+String(Math.random()).slice(2,10));
 x.updatedAt=now();x.updatedBy=actor?.id||null;
 coreWrite(KEYS.deviceQr,rows);
 audit(enabled?"تفعيل QR للجهاز":"إيقاف QR للجهاز","الأجهزة",String(deviceId),"تغيير حالة QR",actor,{after:x});
 return x;
}
function getDeviceQr(deviceId){
 return list(KEYS.deviceQr).find(x=>String(x.deviceId)===String(deviceId))||null;
}
function setDeviceKnowledge(deviceId,input,actor){
 requirePermission("deviceKnowledgeManage",actor);
 const d=findDevice(deviceId);assert(d,"الجهاز غير موجود.");
 const x=Object.assign({},input||{});
 x.id=x.id||nextId("DKNOW");
 x.deviceId=String(deviceId);
 x.modelKey=clean(x.modelKey||d.model,160);
 x.faultCodes=Array.isArray(x.faultCodes)?x.faultCodes:[];
 x.factoryReset=clean(x.factoryReset,2000);
 x.serviceGuide=clean(x.serviceGuide,2000);
 x.compatibleParts=Array.isArray(x.compatibleParts)?x.compatibleParts:[];
 x.commonFaults=Array.isArray(x.commonFaults)?x.commonFaults:[];
 x.articles=Array.isArray(x.articles)?x.articles:[];
 x.updatedAt=now();
 const rows=list(KEYS.deviceKnowledge);const i=rows.findIndex(r=>String(idOf(r))===String(x.id));
 if(i>=0)rows[i]=x;else rows.push(x);
 coreWrite(KEYS.deviceKnowledge,rows);
 audit(i>=0?"تعديل توافق مركز المعرفة":"إضافة توافق مركز المعرفة","الأجهزة",String(deviceId),"ربط الجهاز بمركز المعرفة",actor,{after:x});
 return x;
}
function getDeviceKnowledge(deviceId){
 return list(KEYS.deviceKnowledge).filter(x=>String(x.deviceId)===String(deviceId));
}
function deriveDeviceCondition(deviceId){
 const d=findDevice(deviceId);assert(d,"الجهاز غير موجود.");
 const reqs=deviceWorkOrders(deviceId).filter(r=>String(r.status||"")!=="ملغي");
 if(d.archived)return "مؤرشف";
 if(!reqs.length)return "يعمل";
 const active=reqs.filter(r=>!['مغلق','مكتمل','ملغي','مؤرشف'].includes(String(r.status||"")));
 const rank={
  "جاري الإصلاح":100,
  "بانتظار قطعة غيار":90,
  "بانتظار موافقة العميل":80,
  "جاري الفحص":70,
  "في الطريق":60,
  "تم الإسناد":50,
  "بانتظار الإسناد":40,
  "جديد":30
 };
 if(active.length){
  active.sort((a,b)=>{
   const ra=rank[String(a.status||"")]||10, rb=rank[String(b.status||"")]||10;
   if(ra!==rb)return rb-ra;
   return String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||""));
  });
  const st=String(active[0].status||"");
  if(st==="جاري الإصلاح")return "تحت الإصلاح";
  if(st==="بانتظار قطعة غيار")return "بانتظار قطعة غيار";
  if(st==="بانتظار موافقة العميل")return "بانتظار موافقة العميل";
  if(st==="جاري الفحص")return "تحت الفحص";
  if(st==="في الطريق")return "في الطريق";
  return "له أمر شغل مفتوح";
 }
 const latest=reqs.slice().sort((a,b)=>String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||"")))[0];
 if(latest && ["مغلق","مكتمل"].includes(String(latest.status||"")))return "تم الإصلاح";
 return "يعمل";
}
function syncDeviceConditions(){
 const devices=list(KEYS.devices),requests=list(KEYS.requests);
 const rank={"جاري الإصلاح":100,"بانتظار قطعة غيار":90,"بانتظار موافقة العميل":80,"جاري الفحص":70,"في الطريق":60,"تم الإسناد":50,"بانتظار الإسناد":40,"جديد":30};
 const grouped={};
 requests.forEach(r=>{const did=String(requestDeviceId(r)||"");if(!did||String(r.status||"")==="ملغي")return;(grouped[did] ||= []).push(r);});
 const out=devices.map(d=>{
  let condition="يعمل";
  if(d.archived)condition="مؤرشف";
  else{
   const rs=grouped[String(idOf(d))]||[];
   const active=rs.filter(r=>!['مغلق','مكتمل','ملغي','مؤرشف'].includes(String(r.status||"")));
   if(active.length){
    active.sort((a,b)=>{const ra=rank[String(a.status||"")]||10,rb=rank[String(b.status||"")]||10;return ra!==rb?rb-ra:String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||""));});
    const st=String(active[0].status||"");
    condition=st==="جاري الإصلاح"?"تحت الإصلاح":st==="بانتظار قطعة غيار"?"بانتظار قطعة غيار":st==="بانتظار موافقة العميل"?"بانتظار موافقة العميل":st==="جاري الفحص"?"تحت الفحص":st==="في الطريق"?"في الطريق":"له أمر شغل مفتوح";
   }else if(rs.some(r=>["مغلق","مكتمل"].includes(String(r.status||""))))condition="تم الإصلاح";
  }
  return Object.assign({},d,{condition,currentCondition:condition,conditionSource:"system",conditionUpdatedAt:now()});
 });
 coreWrite(KEYS.devices,out);return out;
}

function deviceLifecycle(deviceId){
 const d=findDevice(deviceId);assert(d,"الجهاز غير موجود.");
 const events=deviceHistory(deviceId);
 const names=["تسجيل الجهاز","استقبال البلاغ","إنشاء أمر الشغل","التشخيص","تنفيذ الإصلاح","تركيب قطع الغيار","إصدار الفاتورة","إصدار الضمان","زيارة لاحقة","انتهاء الخدمة أو الأرشفة"];
 return names.map((name,i)=>({stage:i+1,name,status:events.some(e=>e.event===name)?"completed":"pending"}));
}
function deviceSearch(criteria){
 const q=criteria||{}, norm=v=>String(v??"").trim().toLowerCase();
 const wsQ=normalizeWorkshopSerial(q.workshopSerial||q.deviceId);
 const msQ=normalizeSerialNumber(q.manufacturerSerial||q.serial);
 const workOrders=list(KEYS.requests), invoices=list(KEYS.invoices);
 return list(KEYS.devices).filter(d=>{
  const c=findCustomer(d.customerId||d.clientId);
  if(q.workOrder && !workOrders.some(r=>String(requestDeviceId(r)||"")===String(idOf(d))&&norm(r.id).includes(norm(q.workOrder))))return false;
  if(q.invoice && !invoices.some(r=>String(r.deviceId||r.applianceId||"")===String(idOf(d))&&norm(r.id).includes(norm(q.invoice))))return false;
  if(wsQ && !normalizeWorkshopSerial(d.workshopSerial).includes(wsQ))return false;
  if(msQ && !normalizeSerialNumber(d.manufacturerSerial||d.serialNumber||d.serial).includes(msQ))return false;
  if(q.condition && !norm(d.condition||d.currentCondition).includes(norm(q.condition)))return false;
  const fields=[
   [q.customerName,c?customerName(c):""],[q.type,d.type],[q.subtype,d.subtype],
   [q.manufacturer,d.brand||d.manufacturer]
  ];
  return fields.every(([needle,val])=>!needle||norm(val).includes(norm(needle)));
 });
}

function deviceWorkOrders(did){
 return list(KEYS.requests).filter(r=>String(requestDeviceId(r)||"")===String(did));
}
function deviceVisits(did){
 return list(KEYS.visits).filter(v=>String(v.deviceId||v.applianceId||"")===String(did));
}
function deviceInvoices(did){
 return list(KEYS.invoices).filter(i=>String(i.deviceId||i.applianceId||"")===String(did));
}
function deviceWarranties(did){
 return list(KEYS.warranties).filter(w=>String(w.deviceId||w.applianceId||"")===String(did));
}
function deviceContracts(did){
 return list(KEYS.contracts).filter(c=>Array.isArray(c.deviceIds)&&c.deviceIds.map(String).includes(String(did)));
}
function isStaffActor(actor){return !!actor&&["manager","technician"].includes(String(actor.role||actor.type||""));}
function device360(did,actor){
 const raw=findDevice(did);assert(raw,"الجهاز غير موجود.");
 const d=clone(raw);
 if(!isStaffActor(actor))delete d.technicalNotes;
 const cid=String(d.customerId||d.clientId||"");
 const customer=findCustomer(cid);
 return {
  device:d, customer,
  workOrders:deviceWorkOrders(did), visits:deviceVisits(did),
  invoices:deviceInvoices(did), warranties:deviceWarranties(did),
  contracts:deviceContracts(did), attachments:deviceAttachments(did),
  history:deviceHistory(did), lifecycle:deviceLifecycle(did),
  qr:getDeviceQr(did), knowledge:getDeviceKnowledge(did),
  integrity:validateCustomerDevice(cid,did)
 };
}

function saveDevice(input,actor){
 const aa=actorInfo(actor);
 if(String(aa.role||"").toLowerCase()==="customer" || String(aa.role||"")==="عميل") {
  requirePermission(input.id||input.deviceId?"deviceUpdate":"customerDevice",actor);
  assert(String(aa.id||"")===String(input.customerId||input.clientId||""),"لا يمكنك تسجيل جهاز لعميل آخر.");
 } else requirePermission(input.id||input.deviceId?"deviceUpdate":"create",actor);
 const existing=input.id?list(KEYS.devices).find(x=>String(idOf(x))===String(input.id)):null;
 if(existing && input.customerId!==undefined && String(existing.customerId||existing.clientId||"")!==String(input.customerId)){
  const operational=list(KEYS.requests).some(r=>String(requestDeviceId(r))===String(input.id)) ||
    list(KEYS.invoices).some(i=>String(i.deviceId||i.applianceId||"")===String(input.id)) ||
    list(KEYS.warranties).some(w=>String(w.deviceId||"")===String(input.id));
  assert(!operational,"لا يمكن تغيير مالك الجهاز بعد وجود سجل تشغيلي؛ استخدم إجراء نقل ملكية موثق.");
 }
 const d=Object.assign({},input),oldId=clean(d.id||d.deviceId,80);
 if(d.technicalNotes!==undefined&&!isStaffActor(actor))assert(false,"البيانات الفنية متاحة للفني أو المدير فقط.");
 d.customerId=clean(d.customerId||d.clientId,80);assert(d.customerId,"العميل مطلوب.");
 assert(exists(KEYS.customers,d.customerId),"العميل غير موجود.");
 d.type=clean(d.type||d.deviceType,100);assert(d.type,"نوع الجهاز مطلوب.");
 d.subtype=clean(d.subtype||d.deviceSubtype||d.configuration,120);
 d.brand=clean(d.brand||d.manufacturer,100);
 d.brandCustom=clean(d.brandCustom,100);
 if(d.brand==="أخرى" && !d.brandCustom)assert(false,"اكتب اسم الماركة في خانة الماركة الأخرى.");
 if(d.brand!=="أخرى")d.brandCustom="";
 d.manufacturerSerial=clean(d.manufacturerSerial||d.serialNumber||d.serial,150);
 d.manufacturerSerialKey=normalizeSerialNumber(d.manufacturerSerial);
 d.workshopSerial=normalizeWorkshopSerial(d.workshopSerial||existing?.workshopSerial||"");
 if(!d.workshopSerial)d.workshopSerial=nextWorkshopSerial();
 if(workshopSerialExists(d.workshopSerial,oldId)){ const err=new Error("رقم الجهاز بالورشة مستخدم بالفعل؛ لا يمكن تكراره."); err.code="DUPLICATE_WORKSHOP_SERIAL"; err.deviceId=idOf(findDeviceByWorkshopSerial(d.workshopSerial)); throw err; }
 const legacySerial=clean(d.manufacturerSerial||d.serialNumber||d.serial,150);
 if(legacySerial){
  const legacyHit=findDeviceByLegacySerial(legacySerial);
  if(legacyHit&&String(idOf(legacyHit))!==String(oldId||"")){
   const hitCustomer=customerName(findCustomer(legacyHit.customerId))||"عميل آخر";
   const err=new Error("الرقم المسلسل القديم موجود بالفعل على الجهاز "+idOf(legacyHit)+" لدى "+hitCustomer+".");
   err.code="DUPLICATE_DEVICE_SERIAL";err.deviceId=idOf(legacyHit);throw err;
  }
 }
 const duplicate=findDuplicateDevice(d,oldId);
 if(duplicate&&!d.allowDuplicateDevice){
  const dupName=customerName(findCustomer(duplicate.customerId))||"العميل";
  const err=new Error("هذا الجهاز يبدو مسجلًا بالفعل للعميل "+dupName+" ("+idOf(duplicate)+"). الأفضل فتح السجل الحالي بدل إنشاء نسخة جديدة.");
  err.code="DUPLICATE_DEVICE";err.deviceId=idOf(duplicate);throw err;
 }
 delete d.allowDuplicateDevice;
 d.manufactureYear=clean(d.manufactureYear||d.year,10);
 d.color=clean(d.color,60);
 d.usageLocation=clean(d.usageLocation||d.location,250);
 d.currentCondition=existing?deriveDeviceCondition(oldId):"يعمل";
 d.condition=d.currentCondition;
 d.generalNotes=clean(d.generalNotes||d.notes,2000);
 const a=list(KEYS.devices);
 // Workshop serial is the canonical unique identifier. Manufacturer serial is optional metadata only.
 if(oldId){
  const i=a.findIndex(x=>String(idOf(x))===oldId);assert(i>=0,"الجهاز غير موجود.");
  a[i]=Object.assign({},a[i],d,{id:oldId,updatedAt:now()});coreWrite(KEYS.devices,a);
  appendDeviceHistory(oldId,"تعديل بيانات الجهاز",actor,{changedFields:Object.keys(d)});
  audit("تعديل","الأجهزة",oldId,"تم تعديل بيانات الجهاز",actor);syncRelations();return a[i];
 }
 const id=nextId("DEV-",KEYS.devices,5),item=Object.assign({id,createdAt:now(),archived:false},d);
 a.push(item);coreWrite(KEYS.devices,a);
 appendDeviceHistory(id,"تسجيل الجهاز",actor,{workshopSerial:d.workshopSerial});
 audit("إضافة","الأجهزة",id,"تم إنشاء جهاز ورقم ورشة للجهاز",actor);syncRelations();return item;
}
function archiveDevice(did,actor){
 requirePermission("archive",actor);const d=findDevice(did);assert(d,"الجهاز غير موجود.");
 const a=list(KEYS.devices),i=a.findIndex(x=>String(idOf(x))===String(did));
 a[i]=Object.assign({},a[i],{archived:true,archivedAt:now(),updatedAt:now()});coreWrite(KEYS.devices,a);
 audit("أرشفة","الأجهزة",did,"تم أرشفة الجهاز",actor);return a[i];
}
function deleteDevice(did,actor){
 requirePermission("delete",actor);
 const d=findDevice(did);assert(d,"الجهاز غير موجود.");
 assert(!deviceHasOperationalData(did),"لا يمكن حذف جهاز مرتبط ببيانات تشغيلية؛ استخدم الأرشفة.");
 const linkedStores=[
  [KEYS.deviceImages,x=>String(x.deviceId)===String(did)],
  [KEYS.deviceLog,x=>String(x.deviceId)===String(did)],
  [KEYS.deviceQr,x=>String(x.deviceId)===String(did)],
  [KEYS.deviceKnowledge,x=>String(x.deviceId)===String(did)]
 ];
 linkedStores.forEach(([key,pred])=>coreWrite(key,list(key).filter(x=>!pred(x))));
 coreWrite(KEYS.devices,list(KEYS.devices).filter(x=>String(idOf(x))!==String(did)));
 audit("حذف نهائي","الأجهزة",did,"حذف المدير جهازًا بلا بيانات تشغيلية مع تنظيف سجلاته المساندة",actor);
 syncRelations();
 return true;
}

function saveRequest(input,actor){
 const aa=actorInfo(actor);
 if(String(aa.role||"").toLowerCase()==="customer" || String(aa.role||"")==="عميل") requirePermission(input.id||input.requestId?"workOrderUpdate":"customerRequest",actor);
 else requirePermission(input.id||input.requestId?"workOrderUpdate":"create",actor);
 const data=Object.assign({},input);
 const oldId=clean(data.id||data.requestId,80);
 data.customerId=clean(data.customerId||data.clientId,80);
 data.deviceId=clean(data.deviceId||data.applianceId,80);
 data.type=data.type||data.requestType||"صيانة منزلية";
 data.requestType=data.type;
 data.priority=data.priority||"عادية";
 data.status=data.status||"جديد";
 data.source=clean(data.source||data.channel||"داخلي",100);
 assert(data.customerId,"العميل مطلوب.");assert(data.deviceId,"الجهاز مطلوب.");
 assert(typeAllowed(data.type)||settings().allowCustomWorkOrderTypes==="yes","نوع أمر الشغل غير معتمد.");
 assert(priorityAllowed(data.priority),"الأولوية غير معتمدة.");assert(statusAllowed(data.status),"حالة أمر الشغل غير معتمدة.");
 validateRequestChain(data);
 const arr=list(KEYS.requests);
 if(oldId){
  const i=arr.findIndex(x=>String(idOf(x))===oldId);assert(i>=0,"أمر الشغل غير موجود.");
  const old=arr[i];
  if(old.status!==data.status){
   assertWorkflowTransition(old.status,data.status,actor);
   recordStatusChange(oldId,old.status,data.status,actor);
  }
  arr[i]=Object.assign({},old,data,{id:oldId,updatedAt:now()});
  coreWrite(KEYS.requests,arr);syncRelations();audit("تعديل","أوامر الشغل",oldId,"تم تعديل أمر الشغل",actor);recalculateCustomerClassification(data.customerId,actor);return findRequest(oldId);
 }
 const id=nextId("WO-",KEYS.requests,6);
 const item=Object.assign({id,createdAt:now(),approved:false},data);
 arr.push(item);coreWrite(KEYS.requests,arr);
 recordStatusChange(id,"",item.status,actor);audit("إضافة","أوامر الشغل",id,"تم إنشاء أمر شغل",actor);syncRelations();recalculateCustomerClassification(item.customerId,actor);return findRequest(id);
}
function requestClosureReadiness(r){
 assert(r,"أمر الشغل غير موجود.");
 const report=Boolean(r.technicianReport||r.technicianReportText||r.report||r.reportText||r.serviceReport);
 const parts=Boolean(r.partsRecorded===true||r.usedPartsRecorded===true||r.partsUsedRecorded===true||list(KEYS.inventoryTransactions).some(t=>String(t.requestId||t.workOrderId||"")===String(r.id)&&["صرف","تركيب"].includes(String(t.type||""))));
 const cost=Boolean(r.costApproved===true||r.costApprovedAt);
 const tested=Boolean(r.deviceTested===true||r.tested===true||r.testResult||r.testResultText||r.testStatus);
 assert(report,"لا يمكن إغلاق أمر الشغل قبل تسجيل تقرير الفني.");
 assert(parts,"لا يمكن إغلاق أمر الشغل قبل تسجيل القطع المستخدمة أو تأكيد عدم استخدامها.");
 assert(cost,"لا يمكن إغلاق أمر الشغل قبل تسجيل/اعتماد التكلفة.");
 assert(tested,"لا يمكن إغلاق أمر الشغل قبل اختبار الجهاز وتسجيل النتيجة.");
 return true;
}
function isWorkCompleted(r){return !!r&&["مكتمل","مغلق"].includes(String(r.status||""));}
function costApproved(r){return !!r&&(r.costApproved===true||r.costApprovedAt);}
function isFinalInvoice(i){return !i.status||["نهائية","نهائي","معتمدة","مؤكدة","مغلقة"].includes(String(i.status));}

function updateRequestStatus(id,status,actor){
 requirePermission("workOrderUpdate",actor);
 assert(statusAllowed(status),"حالة أمر الشغل غير معتمدة.");
 const arr=list(KEYS.requests),i=arr.findIndex(x=>String(idOf(x))===String(id));
 assert(i>=0,"أمر الشغل غير موجود.");const old=arr[i];
 if(old.status==="مؤرشف")assert(status==="مؤرشف","أمر الشغل المؤرشف لا يمكن تغييره.");
 if(old.status==="مغلق"&&status!=="مغلق")assert(settings().allowReopen==="yes","إعادة فتح أمر الشغل غير مسموحة.");
 if(status==="مغلق"&&old.status!=="مغلق")requestClosureReadiness(old);
 arr[i]=Object.assign({},old,{status,updatedAt:now()});coreWrite(KEYS.requests,arr);
 syncDeviceConditions();
 recordStatusChange(id,old.status,status,actor);audit("تغيير حالة","أوامر الشغل",id,old.status+" ← "+status,actor);recalculateCustomerClassification(requestCustomerId(arr[i]),actor);return findRequest(id);
}
function recordStatusChange(id,from,to,actor){
 const a=list(KEYS.statusHistory);a.unshift({id:nextId("ST-",KEYS.statusHistory,7),requestId:id,fromStatus:from||"",toStatus:to||"",user:actorInfo(actor).name||"النظام",userId:actorInfo(actor).id||"",role:actorInfo(actor).role||"",date:now()});coreWrite(KEYS.statusHistory,a);
}
function deleteRequest(id,actor){
 requirePermission("delete",actor);
 const r=findRequest(id);assert(r,"أمر الشغل غير موجود.");assert(canDeleteRequest(r),"لا يجوز حذف أمر شغل معتمد.");
 const related=[...requestVisits(id),...requestInvoices(id),...requestWarranties(id)];
 assert(related.length===0,"لا يمكن حذف أمر الشغل لوجود بيانات مرتبطة به.");
 coreWrite(KEYS.requests,list(KEYS.requests).filter(x=>String(idOf(x))!==String(id)));
 audit("حذف","أوامر الشغل",id,"تم حذف أمر الشغل",actor);return true;
}


function validateVisitAssignment(data,actor){
 const req=findRequest(data.requestId||data.workOrderId);
 assert(req,"أمر الشغل غير موجود.");
 const technicianId=data.technicianId||req.technicianId;
 assert(technicianId&&exists(KEYS.technicians,technicianId),"الفني غير موجود.");
 const tech=findTechnician(technicianId);
 assert(technicianIsActive(tech),"لا يمكن إنشاء/تعديل زيارة لفني غير فعال أو موقوف.");
 validateRequestChain(req);
 const date=String(data.date||data.visitDate||data.scheduledDate||"").slice(0,10);
 const vr=visitTimeRange(data);
 if(date&&vr.start&&vr.end){
  assert(!technicianScheduleConflict(technicianId,Object.assign({},data,{requestId:req.id,date,startTime:vr.start,endTime:vr.end})),"الفني لديه تعارض في الموعد المحدد.");
 }
 return {req,tech,technicianId};
}
function addVisit(data,actor){
 requirePermission("visitManage",actor);
 const visitCheck=validateVisitAssignment(data,actor);
 assert(exists(KEYS.requests,data.requestId),"أمر الشغل غير موجود.");
 assert(exists(KEYS.technicians,data.technicianId),"الفني غير موجود.");
 const r=findRequest(data.requestId);validateRequestChain(r);
 const v=Object.assign({},data,{id:nextId("VIS-",KEYS.visits,6),customerId:requestCustomerId(r),deviceId:requestDeviceId(r),createdAt:now()});
 const a=list(KEYS.visits);a.push(v);coreWrite(KEYS.visits,a);audit("إضافة","الزيارات",v.id,"إضافة زيارة لأمر الشغل "+data.requestId,actor);syncRelations();const visitCid=requestCustomerId(r);if(visitCid)recalculateCustomerClassification(visitCid,actor);return v;
}
function requestWorkOrder(id){return findRequest(id);}

function inventoryItem(id){return find(KEYS.inventory,id);}
function inventoryQuantity(id){const x=inventoryItem(id);return x?Number(x.quantity||0):0;}
function addInventoryTransactionInternal(id,qty,type,reference,notes,actor){
 requirePermission("stock",actor);
 const transactionType=String(type||"إضافة");
 const consumptionTypes=["صرف","استخدام","تركيب","صرف مخزون"];
 if(consumptionTypes.includes(transactionType)){
  assert(reference&&exists(KEYS.requests,reference),"حركة الصرف/الاستخدام يجب أن ترتبط بأمر شغل صحيح.");
  const req=findRequest(reference);assert(req.status!=="مؤرشف"&&req.status!=="ملغي","لا يمكن تسجيل حركة صرف لأمر شغل مؤرشف أو ملغي.");
 }
 const n=Number(qty);assert(Number.isFinite(n)&&n>0,"الكمية غير صحيحة.");const items=list(KEYS.inventory);
 const i=items.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الصنف غير موجود.");
 const before=Number(items[i].quantity||0),after=before+n;items[i]=Object.assign({},items[i],{quantity:after,updatedAt:now()});coreWrite(KEYS.inventory,items);
 const tr=list(KEYS.inventoryTransactions);const t={id:nextId("TR-",KEYS.inventoryTransactions,7),itemId:id,itemName:items[i].name||"",type:type||"إضافة",qty:n,before,after,reference:reference||"",notes:notes||"",userId:actorInfo(actor).id||"",user:actorInfo(actor).name||"النظام",date:now()};tr.unshift(t);coreWrite(KEYS.inventoryTransactions,tr);audit("حركة مخزون","المخزون",id,type||"إضافة",actor);return items[i];
}
function addInventoryTransaction(){
 throw new Error("لا تستخدم حركة مخزون عامة مباشرة؛ استخدم عملية المخزون المعتمدة.");
}
function reserveInventory(id,qty,requestId,notes,actor){
 requirePermission("stock",actor);
 assert(requestId&&exists(KEYS.requests,requestId),"حجز القطعة يجب أن يرتبط بأمر شغل صحيح.");
 const req=findRequest(requestId);assert(req.status!=="مؤرشف"&&req.status!=="ملغي","لا يمكن الحجز لأمر شغل مؤرشف أو ملغي.");
 const n=Number(qty);assert(Number.isFinite(n)&&n>0,"الكمية غير صحيحة.");
 const a=list(KEYS.inventory),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الصنف غير موجود.");
 const reserved=Number(a[i].reservedQuantity||0),available=Number(a[i].quantity||0)-reserved;
 assert(n<=available,"الكمية المطلوبة أكبر من الكمية المتاحة للحجز.");
 a[i]=Object.assign({},a[i],{reservedQuantity:reserved+n,updatedAt:now()});coreWrite(KEYS.inventory,a);
 const tr=list(KEYS.inventoryTransactions);tr.unshift({id:nextId("TR-",KEYS.inventoryTransactions,7),itemId:id,itemName:a[i].name||"",requestId,type:"حجز",qty:0,before:available,after:available-n,reference:requestId,notes:notes||"",userId:actorInfo(actor).id||"",user:actorInfo(actor).name||"النظام",date:now()});coreWrite(KEYS.inventoryTransactions,tr);
 audit("حجز مخزون","المخزون",id,"حجز كمية لأمر الشغل "+requestId,actor);return a[i];
}
function releaseInventoryReservation(id,qty,requestId,notes,actor){
 requirePermission("stock",actor);
 const reqId=String(requestId||"").trim();
 assert(reqId&&exists(KEYS.requests,reqId),"أمر الشغل مطلوب لفك الحجز.");
 const req=findRequest(reqId);assert(req.status!=="مؤرشف"&&req.status!=="ملغي","لا يمكن فك حجز لأمر شغل مؤرشف أو ملغي.");
 const n=Number(qty);assert(Number.isFinite(n)&&n>0,"الكمية غير صحيحة.");
 const a=list(KEYS.inventory),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الصنف غير موجود.");
 const reserved=Number(a[i].reservedQuantity||0);assert(n<=reserved,"كمية فك الحجز أكبر من المحجوز.");
 a[i]=Object.assign({},a[i],{reservedQuantity:reserved-n,updatedAt:now()});coreWrite(KEYS.inventory,a);
 const tr=list(KEYS.inventoryTransactions);tr.unshift({id:nextId("TR-",KEYS.inventoryTransactions,7),itemId:id,itemName:a[i].name||"",requestId:requestId||"",type:"فك حجز",qty:0,before:reserved,after:reserved-n,reference:requestId||"",notes:notes||"",userId:actorInfo(actor).id||"",user:actorInfo(actor).name||"النظام",date:now()});coreWrite(KEYS.inventoryTransactions,tr);
 audit("فك حجز مخزون","المخزون",id,"فك حجز قطعة",actor);return a[i];
}
function consumeInventory(id,qty,type,reference,notes,actor){
 requirePermission("stock",actor);
 const n=Number(qty);assert(Number.isFinite(n)&&n>0,"الكمية غير صحيحة.");
 const requestId=String(reference||"").trim();
 assert(requestId&&exists(KEYS.requests,requestId),"صرف/استخدام القطعة يجب أن يرتبط بأمر شغل صحيح.");
 const req=findRequest(requestId);assert(req.status!=="مؤرشف"&&req.status!=="ملغي","لا يمكن الصرف لأمر شغل مؤرشف أو ملغي.");
 const item=inventoryItem(id);assert(item,"الصنف غير موجود.");
 const i=list(KEYS.inventory).findIndex(x=>String(idOf(x))===String(id));
 const before=Number(item.quantity||0);
 const allowNegative=String(settings().negativeStock||"no").toLowerCase()==="yes";
 assert(allowNegative||n<=before,"الكمية المطلوبة أكبر من الرصيد المتاح.");
 const reserved=Number(item.reservedQuantity||0);
 const after=before-n;
 const remainingReserved=Math.max(0,reserved-n);
 const items=list(KEYS.inventory);
 items[i]=Object.assign({},items[i],{quantity:after,reservedQuantity:remainingReserved,updatedAt:now()});
 coreWrite(KEYS.inventory,items);
 const tr=list(KEYS.inventoryTransactions);
 tr.unshift({
  id:nextId("TR-",KEYS.inventoryTransactions,7),itemId:id,itemName:items[i].name||"",
  requestId,type:type||"صرف",qty:-n,before,after,reference:requestId,notes:notes||"",
  userId:actorInfo(actor).id||"",user:actorInfo(actor).name||"النظام",date:now()
 });
 coreWrite(KEYS.inventoryTransactions,tr);
 audit("صرف مخزون","المخزون",id,"صرف مرتبط بأمر الشغل "+requestId,actor);
 return items[i];
}

function invoiceTotal(i){return Number(i&&(i.grandTotal??i.total??i.finalTotal??i.amount) || 0)||0;}
function paymentsForInvoice(id,includeCancelled){return list(KEYS.payments).filter(p=>String(p.invoiceId||"")===String(id)&&(includeCancelled||p.status!=="ملغاة"));}
function invoicePaid(id){return paymentsForInvoice(id).filter(p=>p.status==="مؤكدة"&&p.type!=="استرداد").reduce((s,p)=>s+Number(p.amount||0),0);}
function invoiceRefunded(id){return paymentsForInvoice(id).filter(p=>p.status==="مؤكدة"&&p.type==="استرداد").reduce((s,p)=>s+Number(p.amount||0),0);}
function invoiceBalance(id){const i=findInvoice(id);return i?Math.max(0,invoiceTotal(i)-invoicePaid(id)+invoiceRefunded(id)):0;}

function getOrCreateLoyalty(cid,actor){
 const a=list(KEYS.loyaltyAccounts);let x=a.find(v=>String(v.customerId)===String(cid));if(x)return x;
 requirePermission("create",actor);assert(exists(KEYS.customers,cid),"العميل غير موجود.");
 x={id:nextId("LOY-",KEYS.loyaltyAccounts,5),customerId:cid,customerName:customerName(findCustomer(cid)),points:0,createdAt:now()};
 a.push(x);coreWrite(KEYS.loyaltyAccounts,a);audit("إضافة","الولاء",x.id,"إنشاء حساب ولاء للعميل",actor);return x;
}
function loyaltyPoints(cid){
 const x=list(KEYS.loyaltyAccounts).find(v=>String(v.customerId)===String(cid));return Number(x&&x.points||0);
}
function changeLoyalty(cid,points,type,reference,notes,actor){
 requirePermission("customerUpdate",actor);assert(exists(KEYS.customers,cid),"العميل غير موجود.");
 const n=Number(points);assert(Number.isFinite(n)&&n!==0,"عدد النقاط غير صحيح.");const a=list(KEYS.loyaltyAccounts);let i=a.findIndex(x=>String(x.customerId)===String(cid));
 if(i<0){getOrCreateLoyalty(cid,actor);return changeLoyalty(cid,n,type,reference,notes,actor);}
 const before=Number(a[i].points||0),delta=type==="earn"?Math.abs(n):-Math.abs(n),after=before+delta;assert(after>=0,"رصيد النقاط غير كافٍ.");
 a[i]=Object.assign({},a[i],{points:after,updatedAt:now()});coreWrite(KEYS.loyaltyAccounts,a);const t=list(KEYS.loyaltyTransactions);
 t.unshift({id:nextId("LP-",KEYS.loyaltyTransactions,6),customerId:cid,customerName:a[i].customerName||"",type:type||"earn",points:Math.abs(delta),before,after,reference:reference||"",notes:notes||"",userId:actorInfo(actor).id||"",user:actorInfo(actor).name||"النظام",date:now()});coreWrite(KEYS.loyaltyTransactions,t);audit("نقاط ولاء","الولاء",cid,"تعديل رصيد النقاط",actor);recalculateCustomerClassification(cid,actor);return a[i];
}

function syncRelations(){
 const customers=list(KEYS.customers),cm={};customers.forEach(c=>cm[idOf(c)]={name:customerName(c),phone:c.phone||c.mobile||"",address:c.address||""});
 const devices=list(KEYS.devices).map(d=>{const cid=d.customerId||d.clientId||"",c=cm[cid];return Object.assign({},d,{customerId:cid,customerName:(c&&c.name)||""});});coreWrite(KEYS.devices,devices);
 const requests=list(KEYS.requests).map(r=>{const cid=requestCustomerId(r),did=requestDeviceId(r),c=cm[cid],d=devices.find(x=>String(idOf(x))===String(did)),t=findTechnician(r.technicianId);return Object.assign({},r,{customerId:cid,deviceId:did,customerName:(c&&c.name)||"",deviceName:(d&&(d.name||d.deviceName||d.type))||"",technicianName:technicianName(t)});});coreWrite(KEYS.requests,requests);
 const visits=list(KEYS.visits).map(v=>{const r=findRequest(v.requestId||v.workOrderId),cid=(r&&requestCustomerId(r))||v.customerId||v.clientId||"",did=(r&&requestDeviceId(r))||v.deviceId||v.applianceId||"",c=cm[cid],d=devices.find(x=>String(idOf(x))===String(did)),t=findTechnician(v.technicianId);return Object.assign({},v,{customerId:cid,deviceId:did,requestId:v.requestId||v.workOrderId||"",customerName:(c&&c.name)||"",deviceName:(d&&(d.name||d.deviceName||d.type))||"",technicianName:technicianName(t)});});coreWrite(KEYS.visits,visits);
 const invoices=list(KEYS.invoices).map(i=>{const r=findRequest(i.requestId||i.workOrderId),cid=(r&&requestCustomerId(r))||i.customerId||i.clientId||"",did=(r&&requestDeviceId(r))||i.deviceId||i.applianceId||"",c=cm[cid],d=devices.find(x=>String(idOf(x))===String(did));return Object.assign({},i,{customerId:cid,deviceId:did,requestId:i.requestId||i.workOrderId||"",customerName:(c&&c.name)||"",deviceName:(d&&(d.name||d.deviceName||d.type))||""});});coreWrite(KEYS.invoices,invoices);
 const payments=list(KEYS.payments).map(p=>{const i=findInvoice(p.invoiceId),cid=(i&&(i.customerId||i.clientId))||p.customerId||p.clientId||"",rid=(i&&(i.requestId||i.workOrderId))||p.requestId||p.workOrderId||"",c=cm[cid];return Object.assign({},p,{customerId:cid,requestId:rid,customerName:(c&&c.name)||""});});coreWrite(KEYS.payments,payments);
 syncDeviceConditions();
 return systemSummary();
}

function validateIntegrity(){
 const problems=[];
 const keys=[KEYS.customers,KEYS.devices,KEYS.requests,KEYS.technicians,KEYS.visits,KEYS.routes,KEYS.inventory,KEYS.suppliers,
  KEYS.purchaseOrders,KEYS.purchaseReceipts,KEYS.purchaseReturns,KEYS.invoices,KEYS.payments,KEYS.warranties,KEYS.contracts,
  KEYS.notifications,KEYS.loyaltyAccounts,KEYS.loyaltyTransactions,KEYS.technicalLibrary,KEYS.users,KEYS.approvals,
  KEYS.diagnoses,KEYS.assignments,KEYS.statusHistory,KEYS.complaints,KEYS.ratings];
 keys.forEach(key=>{const seen=new Set();list(key).forEach((row,idx)=>{const id=idOf(row);if(!id)problems.push("سجل بدون ID في "+key+" عند الموضع "+idx);else if(seen.has(id))problems.push("ID مكرر في "+key+": "+id);else seen.add(id);});});
 const ids=key=>new Set(list(key).map(idOf).filter(Boolean));
 const customers=ids(KEYS.customers),devices=ids(KEYS.devices),requests=ids(KEYS.requests),techs=ids(KEYS.technicians),inventory=ids(KEYS.inventory),suppliers=ids(KEYS.suppliers),purchaseOrders=ids(KEYS.purchaseOrders);
 list(KEYS.devices).forEach(d=>{if(!customers.has(String(d.customerId||d.clientId||"")))problems.push("جهاز بدون عميل: "+idOf(d));});
 list(KEYS.requests).forEach(r=>{try{validateRequestChain(r);}catch(e){problems.push("أمر شغل "+idOf(r)+": "+e.message);}});
 list(KEYS.visits).forEach(v=>{if(!requests.has(String(v.requestId||v.workOrderId||"")))problems.push("زيارة بدون أمر شغل: "+idOf(v));if(v.technicianId&&!techs.has(String(v.technicianId)))problems.push("زيارة بفني غير موجود: "+idOf(v));if(v.deviceId&&!devices.has(String(v.deviceId)))problems.push("زيارة بجهاز غير موجود: "+idOf(v));});
 list(KEYS.invoices).forEach(i=>{try{validateInvoiceChain(i);}catch(e){problems.push("فاتورة "+idOf(i)+": "+e.message);}});
 list(KEYS.payments).forEach(p=>{try{validatePaymentChain(p);}catch(e){problems.push("دفعة "+idOf(p)+": "+e.message);}});
 list(KEYS.warranties).forEach(w=>{try{validateWarrantyChain(w);}catch(e){problems.push("ضمان "+idOf(w)+": "+e.message);}});
 list(KEYS.contracts).forEach(c=>{try{validateContractChain(c);}catch(e){problems.push("عقد "+idOf(c)+": "+e.message);}});
 const loyaltyCustomers=customers;
 list(KEYS.loyaltyAccounts).forEach(x=>{if(!loyaltyCustomers.has(String(x.customerId||"")))problems.push("حساب ولاء بدون عميل: "+idOf(x));});
 const loyaltyAccounts=ids(KEYS.loyaltyAccounts);
 list(KEYS.loyaltyTransactions).forEach(x=>{if(!loyaltyCustomers.has(String(x.customerId||"")))problems.push("حركة ولاء بدون عميل: "+idOf(x));if(x.loyaltyAccountId&&!loyaltyAccounts.has(String(x.loyaltyAccountId)))problems.push("حركة ولاء بحساب غير موجود: "+idOf(x));});
 list(KEYS.purchaseOrders).forEach(po=>{if(!suppliers.has(String(po.supplierId||"")))problems.push("طلب شراء بدون مورد: "+idOf(po));(po.items||[]).forEach(x=>{if(!inventory.has(String(x.itemId||"")))problems.push("طلب شراء بصنف غير موجود: "+idOf(po));});});
 list(KEYS.purchaseReceipts).forEach(rc=>{if(!purchaseOrders.has(String(rc.purchaseOrderId||"")))problems.push("استلام بدون طلب شراء: "+idOf(rc));if(rc.supplierId&&!suppliers.has(String(rc.supplierId)))problems.push("استلام بمورد غير موجود: "+idOf(rc));(rc.items||[]).forEach(x=>{if(!inventory.has(String(x.itemId||"")))problems.push("استلام بصنف غير موجود: "+idOf(rc));});});
 list(KEYS.purchaseReturns).forEach(rr=>{if(!purchaseOrders.has(String(rr.purchaseOrderId||"")))problems.push("مرتجع بدون طلب شراء: "+idOf(rr));});
 list(KEYS.inventoryTransactions).forEach(t=>{if(t.itemId&&!inventory.has(String(t.itemId)))problems.push("حركة مخزون لصنف غير موجود: "+idOf(t));if(t.requestId&&!requests.has(String(t.requestId)))problems.push("حركة مخزون بأمر شغل غير موجود: "+idOf(t));});
 list(KEYS.approvals).forEach(x=>{if(!requests.has(String(x.requestId||"")))problems.push("اعتماد بدون أمر شغل: "+idOf(x));});
 list(KEYS.diagnoses).forEach(x=>{if(!requests.has(String(x.requestId||"")))problems.push("تشخيص بدون أمر شغل: "+idOf(x));if(x.technicianId&&!techs.has(String(x.technicianId)))problems.push("تشخيص بفني غير موجود: "+idOf(x));});
 list(KEYS.assignments).forEach(x=>{
  if(!requests.has(String(x.requestId||"")))problems.push("إسناد بدون أمر شغل: "+idOf(x));
  if(!techs.has(String(x.technicianId||"")))problems.push("إسناد بفني غير موجود: "+idOf(x));
  const t=findTechnician(x.technicianId);
  if(t&&!technicianIsActive(t))problems.push("إسناد لفني غير فعال: "+idOf(x));
 });
 const visitByTech={};
 list(KEYS.visits).forEach(v=>{
  const tid=String(v.technicianId||"");
  const date=String(v.date||v.visitDate||v.scheduledDate||"").slice(0,10);
  if(!tid||!date)return;
  const key=tid+"|"+date;
  const arr=visitByTech[key]||(visitByTech[key]=[]);
  arr.forEach(prev=>{
   if(rangesOverlap(visitTimeRange(prev),visitTimeRange(v))&&String(prev.id)!==String(v.id))
    problems.push("تعارض زيارات للفني "+tid+": "+idOf(prev)+" / "+idOf(v));
  });
  arr.push(v);
 });

 list(KEYS.inventoryTransactions).forEach(t=>{
  const typ=String(t.type||"");
  if(["صرف","استخدام","تركيب","صرف مخزون"].includes(typ)&&!t.requestId)problems.push("صرف مخزون بدون أمر شغل: "+idOf(t));
 });
 list(KEYS.complaints).forEach(x=>{if(!customers.has(String(x.customerId||x.clientId||"")))problems.push("شكوى بدون عميل: "+idOf(x));if(x.requestId&&!requests.has(String(x.requestId)))problems.push("شكوى بأمر شغل غير موجود: "+idOf(x));});
 list(KEYS.ratings).forEach(x=>{if(!customers.has(String(x.customerId||x.clientId||"")))problems.push("تقييم بدون عميل: "+idOf(x));if(x.requestId&&!requests.has(String(x.requestId)))problems.push("تقييم بأمر شغل غير موجود: "+idOf(x));else if(x.requestId){const r=findRequest(x.requestId);if(r&&r.status!=="مغلق"&&x.archived!==true)problems.push("تقييم قبل إغلاق أمر الشغل: "+idOf(x));}});
 const relationshipIds=new Set();
 list(KEYS.customerRelationships).forEach(r=>{if(!idOf(r))problems.push("علاقة عملاء بدون ID: "+String(r));else if(relationshipIds.has(idOf(r)))problems.push("ID مكرر في علاقات العملاء: "+idOf(r));else relationshipIds.add(idOf(r));if(!customers.has(String(r.customerAId||""))||!customers.has(String(r.customerBId||"")))problems.push("علاقة عملاء تشير إلى عميل غير موجود: "+idOf(r));if(String(r.customerAId)===String(r.customerBId))problems.push("علاقة عميل مع نفسه: "+idOf(r));});
 list(KEYS.customerMergeRequests).forEach(r=>{if(!customers.has(String(r.primaryCustomerId||""))||!customers.has(String(r.secondaryCustomerId||"")))problems.push("طلب دمج يشير إلى عميل غير موجود: "+idOf(r));if(String(r.primaryCustomerId)===String(r.secondaryCustomerId))problems.push("طلب دمج مع نفس العميل: "+idOf(r));});
 return {ok:problems.length===0,problems,count:problems.length};
}

function saveSupplier(data,actor){
 requirePermission("supplierManage",actor);assert(data&&clean(data.name,200),"اسم المورد مطلوب.");
 const a=list(KEYS.suppliers),id=clean(data.id,80)||nextId("SUP-",KEYS.suppliers,6);
 const item=Object.assign({},data,{id,name:clean(data.name,200),updatedAt:now(),createdAt:data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=Object.assign({},a[i],item);else a.push(item);
 coreWrite(KEYS.suppliers,a);audit(i>=0?"تعديل":"إضافة","الموردين",id,"حفظ بيانات المورد",actor);return item;
}
function savePurchaseOrder(data,actor){
 requirePermission("purchaseManage",actor);
 assert(data&&data.supplierId&&exists(KEYS.suppliers,data.supplierId),"المورد غير موجود.");
 assert(Array.isArray(data.items)&&data.items.length>0,"يجب أن يحتوي طلب الشراء على أصناف.");
 data.items.forEach(x=>{assert(x.itemId&&exists(KEYS.inventory,x.itemId),"صنف طلب الشراء غير موجود.");const q=Number(x.qty);assert(Number.isFinite(q)&&q>0,"كمية الصنف غير صحيحة.");});
 const a=list(KEYS.purchaseOrders),id=clean(data.id,80)||nextId("PO-",KEYS.purchaseOrders,6);
 const item=Object.assign({},data,{id,supplierId:data.supplierId,status:data.status||"مسودة",items:clone(data.items),updatedAt:now(),createdAt:data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=Object.assign({},a[i],item);else a.push(item);
 coreWrite(KEYS.purchaseOrders,a);audit(i>=0?"تعديل":"إضافة","طلبات الشراء",id,"حفظ طلب شراء",actor);return item;
}
function approvePurchaseOrder(id,actor){
 requirePermission("approve",actor);const a=list(KEYS.purchaseOrders),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"طلب الشراء غير موجود.");
 assert(a[i].status!=="ملغي","لا يمكن اعتماد طلب شراء ملغي.");a[i]=Object.assign({},a[i],{status:"معتمد",approvedAt:now(),updatedAt:now()});coreWrite(KEYS.purchaseOrders,a);
 audit("اعتماد","طلبات الشراء",id,"اعتماد طلب شراء",actor);return a[i];
}
function receivePurchaseOrder(id,receiptItems,actor){
 requirePermission("stock",actor);const order=find(KEYS.purchaseOrders,id);assert(order,"طلب الشراء غير موجود.");assert(order.status==="معتمد"||order.status==="مستلم جزئيًا","يجب اعتماد طلب الشراء قبل الاستلام.");
 const items=Array.isArray(receiptItems)&&receiptItems.length?receiptItems:order.items||[];assert(items.length>0,"لا توجد أصناف للاستلام.");
 const orderedTotals={};(order.items||[]).forEach(x=>{orderedTotals[x.itemId]=(orderedTotals[x.itemId]||0)+Number(x.qty||0);});
 const priorReceipts=list(KEYS.purchaseReceipts).filter(r=>String(r.purchaseOrderId)===String(id));
 const receivedTotals={};priorReceipts.flatMap(r=>r.items||[]).forEach(x=>{receivedTotals[x.itemId]=(receivedTotals[x.itemId]||0)+Number(x.qty||0);});
 const requestedTotals={};
 items.forEach(x=>{assert(x.itemId&&exists(KEYS.inventory,x.itemId),"صنف الاستلام غير موجود.");assert(Object.prototype.hasOwnProperty.call(orderedTotals,x.itemId),"صنف الاستلام غير موجود في طلب الشراء.");const q=Number(x.qty);assert(Number.isFinite(q)&&q>0,"كمية الاستلام غير صحيحة.");requestedTotals[x.itemId]=(requestedTotals[x.itemId]||0)+q;});
 Object.keys(requestedTotals).forEach(itemId=>{const ordered=Number(orderedTotals[itemId]||0),already=Number(receivedTotals[itemId]||0),requested=Number(requestedTotals[itemId]||0);assert(already+requested<=ordered,"كمية الاستلام تتجاوز الكمية المطلوبة في طلب الشراء.");});
 const received=[];
 items.forEach(x=>{const q=Number(x.qty);
  const inv=inventoryItem(x.itemId),before=Number(inv.quantity||0),cost=Number(x.unitCost??x.cost??inv.averageCost??0),after=before+q;
  const oldAvg=Number(inv.averageCost||0),newAvg=(before>0&&cost>0)?((before*oldAvg)+(q*cost))/after:(cost>0?cost:oldAvg);
  const updated=addInventoryTransactionInternal(x.itemId,q,"استلام شراء",id,x.notes||"استلام من طلب شراء",actor);
  const arr=list(KEYS.inventory),ii=arr.findIndex(v=>String(idOf(v))===String(x.itemId));if(ii>=0){arr[ii]=Object.assign({},arr[ii],{averageCost:newAvg,updatedAt:now()});coreWrite(KEYS.inventory,arr);}
  received.push({itemId:x.itemId,qty:q,unitCost:cost,inventoryBefore:before,inventoryAfter:after});
 });
 const ra=list(KEYS.purchaseReceipts),rid=nextId("REC-",KEYS.purchaseReceipts,6);ra.unshift({id:rid,purchaseOrderId:id,supplierId:order.supplierId,items:received,receivedAt:now(),userId:actorInfo(actor).id||"",user:actorInfo(actor).name||"النظام"});coreWrite(KEYS.purchaseReceipts,ra);
 const po=list(KEYS.purchaseOrders),pi=po.findIndex(x=>String(idOf(x))===String(id));
 if(pi>=0){
  const allReceipts=list(KEYS.purchaseReceipts).filter(r=>String(r.purchaseOrderId)===String(id)).flatMap(r=>r.items||[]);
  const receivedTotals={};
  allReceipts.forEach(x=>{receivedTotals[x.itemId]=(receivedTotals[x.itemId]||0)+Number(x.qty||0);});
  const partial=(po[pi].items||[]).some(x=>Number(receivedTotals[x.itemId]||0)<Number(x.qty||0));
  po[pi]=Object.assign({},po[pi],{status:partial?"مستلم جزئيًا":"مستلم",lastReceiptId:rid,updatedAt:now()});
 }
 coreWrite(KEYS.purchaseOrders,po);
 audit("استلام","طلبات الشراء",id,"اعتماد استلام وتحديث المخزون",actor);return {purchaseOrder:po[pi],receipt:ra[0]};
}

function decrementInventoryForPurchaseReturn(id,qty,reference,notes,actor){
 requirePermission("purchaseManage",actor);
 const n=Number(qty);assert(Number.isFinite(n)&&n>0,"كمية المرتجع غير صحيحة.");
 const a=list(KEYS.inventory),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الصنف غير موجود.");
 const before=Number(a[i].quantity||0);assert(n<=before,"كمية المرتجع أكبر من رصيد المخزون.");
 const after=before-n;
 a[i]=Object.assign({},a[i],{quantity:after,updatedAt:now()});coreWrite(KEYS.inventory,a);
 const tr=list(KEYS.inventoryTransactions);
 tr.unshift({id:nextId("TR-",KEYS.inventoryTransactions,7),itemId:id,itemName:a[i].name||"",type:"مرتجع شراء",qty:-n,
  before,after,reference:reference||"",notes:notes||"",userId:actorInfo(actor).id||"",user:actorInfo(actor).name||"النظام",date:now()});
 coreWrite(KEYS.inventoryTransactions,tr);
 audit("مرتجع شراء","المخزون",id,"خفض مخزون بسبب مرتجع شراء "+String(reference||""),actor);
 return a[i];
}
function returnPurchase(purchaseOrderId,returnItems,reason,actor){
 requirePermission("purchaseManage",actor);
 const order=find(KEYS.purchaseOrders,purchaseOrderId);assert(order,"طلب الشراء غير موجود.");
 const receipts=list(KEYS.purchaseReceipts).filter(r=>String(r.purchaseOrderId)===String(purchaseOrderId));
 const received={};receipts.flatMap(r=>r.items||[]).forEach(x=>{received[x.itemId]=(received[x.itemId]||0)+Number(x.qty||0);});
 const alreadyReturned=list(KEYS.purchaseReturns).filter(r=>String(r.purchaseOrderId)===String(purchaseOrderId)).flatMap(r=>r.items||[]);
 const returned={};alreadyReturned.forEach(x=>{returned[x.itemId]=(returned[x.itemId]||0)+Number(x.qty||0);});
 assert(Array.isArray(returnItems)&&returnItems.length>0,"أصناف المرتجع مطلوبة.");
 returnItems.forEach(x=>{
  const q=Number(x.qty);assert(x.itemId&&exists(KEYS.inventory,x.itemId),"صنف المرتجع غير موجود.");assert(Number.isFinite(q)&&q>0,"كمية المرتجع غير صحيحة.");
  assert(q+Number(returned[x.itemId]||0)<=Number(received[x.itemId]||0),"كمية المرتجع تتجاوز الكمية المستلمة.");
  assert(q<=inventoryQuantity(x.itemId),"كمية المرتجع أكبر من رصيد المخزون.");
 });
 returnItems.forEach(x=>consumeInventory(x.itemId,Number(x.qty),"مرتجع شراء",purchaseOrderId,reason||"مرتجع إلى المورد",actor));
 const a=list(KEYS.purchaseReturns),id=nextId("RET-",KEYS.purchaseReturns,6),ret={id,purchaseOrderId,supplierId:order.supplierId,items:clone(returnItems),reason:clean(reason,1000),createdAt:now(),userId:actorInfo(actor).id||"",user:actorInfo(actor).name||"النظام"};
 a.unshift(ret);coreWrite(KEYS.purchaseReturns,a);audit("مرتجع شراء","طلبات الشراء",id,"إرجاع أصناف إلى المورد",actor);return ret;
}
function deleteRoute(id,actor){
 requirePermission("delete",actor);const x=find(KEYS.routes,id);assert(x,"المسار غير موجود.");assert(!["جاري التنفيذ","مكتمل"].includes(String(x.status||"")),"لا يمكن حذف مسار بدأ التنفيذ.");
 const visits=list(KEYS.visits);visits.forEach(v=>{if(String(v.routeId||"")===String(id)){delete v.routeId;delete v.routeOrder;v.updatedAt=now();}});coreWrite(KEYS.visits,visits);
 coreWrite(KEYS.routes,list(KEYS.routes).filter(v=>String(idOf(v))!==String(id)));audit("حذف","المسارات",id,"حذف مسار",actor);return true;
}

function saveRoute(data,actor){
 requirePermission("visitManage",actor);
 assert(data&&clean(data.date,30),"تاريخ المسار مطلوب.");
 assert(data.technicianId&&exists(KEYS.technicians,data.technicianId),"الفني غير موجود.");
 assert(Array.isArray(data.stops)&&data.stops.length>0,"يجب أن يحتوي المسار على زيارة واحدة على الأقل.");
 data.stops.forEach(x=>assert(x.visitId&&exists(KEYS.visits,x.visitId),"الزيارة المحددة للمسار غير موجودة."));
 const a=list(KEYS.routes),id=clean(data.id,80)||nextId("ROUTE-",KEYS.routes,5);
 const item=Object.assign({},data,{id,stops:clone(data.stops),updatedAt:now(),createdAt:data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=Object.assign({},a[i],item);else a.push(item);
 coreWrite(KEYS.routes,a);
 const visits=list(KEYS.visits);visits.forEach(v=>{const st=item.stops.find(z=>String(z.visitId)===String(idOf(v)));if(st){v.routeId=id;v.routeOrder=st.order;v.updatedAt=now();}else if(String(v.routeId||"")===String(id)){delete v.routeId;delete v.routeOrder;v.updatedAt=now();}});
 coreWrite(KEYS.visits,visits);audit(i>=0?"تعديل":"إضافة","المسارات",id,"حفظ مسار وربط الزيارات",actor);syncRelations();return item;
}

function saveTechnician(data,actor){
 requirePermission("technicianManage",actor);assert(data&&clean(data.name||data.fullName||data.technicianName,200),"اسم الفني مطلوب.");
 const a=list(KEYS.technicians),id=clean(data.id,80)||nextId("TECH-",KEYS.technicians,5);
 const item=Object.assign({},data,{id,name:clean(data.name||data.fullName||data.technicianName,200),updatedAt:now(),createdAt:data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=Object.assign({},a[i],item);else a.push(item);
 coreWrite(KEYS.technicians,a);audit(i>=0?"تعديل":"إضافة","الفنيين",id,"حفظ بيانات الفني",actor);syncRelations();return item;
}
function archiveTechnician(id,actor){
 requirePermission("archive",actor);const t=findTechnician(id);assert(t,"الفني غير موجود.");
 const a=list(KEYS.technicians),i=a.findIndex(x=>String(idOf(x))===String(id));a[i]=Object.assign({},a[i],{archived:true,archivedAt:now(),updatedAt:now()});coreWrite(KEYS.technicians,a);
 audit("أرشفة","الفنيين",id,"أرشفة الفني",actor);return a[i];
}
function updateVisit(id,data,actor){
 requirePermission("workOrderUpdate",actor);
 const a=list(KEYS.visits),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الزيارة غير موجودة.");
 const old=a[i],rid=data.requestId||data.workOrderId||old.requestId||old.workOrderId;
 assert(exists(KEYS.requests,rid),"أمر الشغل غير موجود.");
 const normalized=Object.assign({},old,data,{id:old.id,requestId:rid,technicianId:data.technicianId||old.technicianId});
 const visitCheck=validateVisitAssignment(normalized,actor);
 const r=visitCheck.req;
 const item=Object.assign({},old,data,{id:old.id,requestId:rid,technicianId:visitCheck.technicianId,
  customerId:requestCustomerId(r),deviceId:requestDeviceId(r),updatedAt:now()});
 a[i]=item;coreWrite(KEYS.visits,a);
 audit("تعديل","الزيارات",id,"تعديل زيارة",actor);syncRelations();return item;
}
function cancelVisit(id,reason,actor){
 requirePermission("visitManage",actor);const a=list(KEYS.visits),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الزيارة غير موجودة.");
 a[i]=Object.assign({},a[i],{status:"ملغاة",cancelReason:clean(reason,1000),cancelledAt:now(),updatedAt:now()});coreWrite(KEYS.visits,a);audit("إلغاء","الزيارات",id,"إلغاء زيارة",actor);return a[i];
}
function saveInventoryItem(data,actor){
 requirePermission(data&&data.id?"stock":"stock",actor);
 assert(data&&clean(data.name,200),"اسم الصنف مطلوب.");
 const a=list(KEYS.inventory),id=clean(data.id,80)||nextId("ITM-",KEYS.inventory,6);
 const i=a.findIndex(x=>String(idOf(x))===String(id)),existing=i>=0?a[i]:null;
 if(existing){
  if(data.quantity!==undefined)assert(Number(data.quantity)===Number(existing.quantity||0),"تعديل كمية المخزون يجب أن يتم عبر حركة مخزون معتمدة.");
  if(data.reservedQuantity!==undefined)assert(Number(data.reservedQuantity)===Number(existing.reservedQuantity||0),"تعديل الكمية المحجوزة يجب أن يتم عبر واجهة الحجز.");
  const item=Object.assign({},existing,data,{id,name:clean(data.name,200),quantity:Number(existing.quantity||0),reservedQuantity:Number(existing.reservedQuantity||0),updatedAt:now()});
  a[i]=item;coreWrite(KEYS.inventory,a);audit("تعديل","المخزون",id,"تعديل بيانات صنف دون تغيير الرصيد",actor);return item;
 }
 const qty=data.quantity===undefined?0:Number(data.quantity);assert(Number.isFinite(qty)&&qty>=0,"رصيد المخزون غير صحيح.");
 const item=Object.assign({},data,{id,name:clean(data.name,200),quantity:qty,reservedQuantity:0,updatedAt:now(),createdAt:data.createdAt||now()});
 a.push(item);coreWrite(KEYS.inventory,a);audit("إضافة","المخزون",id,"إنشاء صنف مخزون",actor);return item;
}
function archiveInventoryItem(id,actor){
 requirePermission("archive",actor);const a=list(KEYS.inventory),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الصنف غير موجود.");
 a[i]=Object.assign({},a[i],{status:"مؤرشف",archived:true,archivedAt:now(),updatedAt:now()});coreWrite(KEYS.inventory,a);audit("أرشفة","المخزون",id,"أرشفة صنف",actor);return a[i];
}
function deleteInventoryItem(id,actor){
 requirePermission("delete",actor);const x=inventoryItem(id);assert(x,"الصنف غير موجود.");
 const operational=list(KEYS.inventoryTransactions).some(t=>String(t.itemId)===String(id))||list(KEYS.purchaseOrders).some(po=>(po.items||[]).some(l=>String(l.itemId)===String(id)));
 assert(!operational,"لا يمكن حذف صنف مرتبط بحركات تشغيلية؛ استخدم الأرشفة.");
 const a=list(KEYS.inventory).filter(v=>String(idOf(v))!==String(id));coreWrite(KEYS.inventory,a);audit("حذف","المخزون",id,"حذف صنف نهائيًا",actor);return true;
}

function saveInvoice(data,actor){
 const a=list(KEYS.invoices);
 const id=clean(data&&data.id,80)||nextId("INV-",KEYS.invoices,6);
 const existing=a.find(x=>String(idOf(x))===String(id));
 if(existing) requirePermission(existing.status==="مغلقة"||existing.status==="مقفلة"||existing.status==="مؤكدة"||existing.status==="نهائية"?"invoiceClosedEdit":"invoiceEdit",actor);
 else requirePermission("finance",actor);
 const item=Object.assign({},existing||{},data,{id,updatedAt:now(),createdAt:(existing&&existing.createdAt)||data.createdAt||now()});
 validateInvoiceChain(item);
 if(isFinalInvoice(item)){
  assert(item.requestId||item.workOrderId,"الفاتورة النهائية يجب أن ترتبط بأمر شغل.");
  const rid=item.requestId||item.workOrderId,r=findRequest(rid);assert(r,"أمر الشغل المرتبط بالفاتورة غير موجود.");
  assert(isWorkCompleted(r),"لا تصدر الفاتورة النهائية قبل انتهاء العمل.");
  assert(costApproved(r),"لا تصدر الفاتورة النهائية قبل اعتماد التكلفة.");
 }
 const i=a.findIndex(x=>String(idOf(x))===String(id));if(i>=0)a[i]=item;else a.push(item);
 coreWrite(KEYS.invoices,a);audit(i>=0?"تعديل":"إضافة","الفواتير",id,"حفظ فاتورة",actor);syncRelations();const invReq=findRequest(item.requestId||item.workOrderId),invCid=item.customerId||item.clientId||(invReq&&requestCustomerId(invReq));if(invCid)recalculateCustomerClassification(invCid,actor);return item;
}
function savePayment(data,actor){
 requirePermission("finance",actor);
 assert(data&&data.invoiceId,"الفاتورة مطلوبة للدفعة.");
 validatePaymentChain(data);
 const amount=Number(data.amount);assert(Number.isFinite(amount)&&amount>0,"قيمة الدفعة غير صحيحة.");
 const a=list(KEYS.payments),existing=data.id?a.find(x=>String(idOf(x))===String(data.id)):null;
 if(existing){assert(existing.status!=="مؤكدة","لا يجوز تعديل دفعة مؤكدة مباشرة؛ استخدم الإلغاء أو الاسترداد.");assert(existing.status!=="ملغاة","لا يجوز تعديل دفعة ملغاة.");}
 if(data.status==="مؤكدة"&&data.type!=="استرداد"){
  const oldConfirmed=existing&&existing.status==="مؤكدة"?Number(existing.amount||0):0;
  const available=invoiceBalance(data.invoiceId)+oldConfirmed;
  assert(amount<=available,"قيمة الدفعة تتجاوز الرصيد المتبقي للفاتورة.");
 }
 const item=Object.assign({},existing||{},data,{id:clean(data.id,80)||nextId("PAY-",KEYS.payments,6),amount,updatedAt:now(),createdAt:(existing&&existing.createdAt)||data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===String(item.id));if(i>=0)a[i]=item;else a.push(item);
 coreWrite(KEYS.payments,a);audit(i>=0?"تعديل":"إضافة","المدفوعات",item.id,"حفظ دفعة",actor);syncRelations();const payInv=findInvoice(item.invoiceId),payCid=payInv&&(payInv.customerId||payInv.clientId);if(payCid)recalculateCustomerClassification(payCid,actor);return item;
}
function refundPayment(data,actor){
 requirePermission("finance",actor);assert(data&&data.invoiceId,"الفاتورة مطلوبة للاسترداد.");
 const inv=findInvoice(data.invoiceId);assert(inv,"الفاتورة غير موجودة.");
 const amount=Number(data.amount);assert(Number.isFinite(amount)&&amount>0,"قيمة الاسترداد غير صحيحة.");
 const paid=invoicePaid(data.invoiceId),ref=invoiceRefunded(data.invoiceId);assert(amount<=Math.max(0,paid-ref),"قيمة الاسترداد أكبر من المبلغ المتاح للاسترداد.");
 const p=Object.assign({},data,{id:clean(data.id,80)||nextId("PAY-",KEYS.payments,6),type:"استرداد",status:"مؤكدة",amount,createdAt:now(),updatedAt:now()});
 validatePaymentChain(p);const a=list(KEYS.payments);a.push(p);coreWrite(KEYS.payments,a);
 audit("استرداد","المدفوعات",p.id,"استرداد مرتبط بالفاتورة",actor);syncRelations();return p;
}
function cancelPayment(id,reason,actor){
 requirePermission("finance",actor);const a=list(KEYS.payments),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الدفعة غير موجودة.");assert(a[i].status!=="ملغاة","الدفعة ملغاة بالفعل.");
 a[i]=Object.assign({},a[i],{status:"ملغاة",cancelReason:clean(reason,1000),cancelledAt:now(),updatedAt:now()});coreWrite(KEYS.payments,a);audit("إلغاء","المدفوعات",id,"إلغاء دفعة",actor);const cancelledInv=findInvoice(a[i].invoiceId),cancelledCid=cancelledInv&&(cancelledInv.customerId||cancelledInv.clientId);if(cancelledCid)recalculateCustomerClassification(cancelledCid,actor);return a[i];
}
function saveApproval(data,actor){
 requirePermission("approve",actor);
 assert(data&&data.requestId&&exists(KEYS.requests,data.requestId),"أمر الشغل غير موجود.");
 const a=list(KEYS.approvals),id=clean(data.id,80)||nextId("APR-",KEYS.approvals,6);
 const item=Object.assign({},data,{id,requestId:data.requestId,updatedAt:now(),createdAt:data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=Object.assign({},a[i],item);else a.push(item);
 coreWrite(KEYS.approvals,a);audit(i>=0?"تعديل":"إضافة","الاعتمادات",id,"اعتماد مرتبط بأمر الشغل",actor);return item;
}
function saveDiagnosis(data,actor){
 requirePermission("diagnosis",actor);
 assert(data&&data.requestId&&exists(KEYS.requests,data.requestId),"أمر الشغل غير موجود.");
 const a=list(KEYS.diagnoses),id=clean(data.id,80)||nextId("DIA-",KEYS.diagnoses,6);
 const item=Object.assign({},data,{id,requestId:data.requestId,updatedAt:now(),createdAt:data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=Object.assign({},a[i],item);else a.push(item);
 coreWrite(KEYS.diagnoses,a);audit(i>=0?"تعديل":"إضافة","التشخيصات",id,"تشخيص مرتبط بأمر الشغل",actor);return item;
}
function technicianIsActive(t){
 return !!t && t.active!==false && t.isActive!==false && String(t.status||"فعال")!=="غير فعال" && String(t.status||"فعال")!=="موقوف";
}
function visitDateValue(v){return String(v.date||v.visitDate||"").slice(0,10);}
function visitTimeRange(v){
 const start=String(v.startTime||v.timeFrom||v.from||"").trim();
 const end=String(v.endTime||v.timeTo||v.to||"").trim();
 return {start,end};
}
function rangesOverlap(a,b){
 if(!a.start||!a.end||!b.start||!b.end)return false;
 return a.start<b.end && b.start<a.end;
}
function technicianScheduleConflict(technicianId,assignment){
 const date=String(assignment.date||assignment.visitDate||assignment.scheduledDate||"").slice(0,10);
 if(!date)return false;
 const nr=visitTimeRange(assignment);
 const ignoreVisitId=String(assignment.id||"");
 return technicianVisits(technicianId,date).some(v=>{
  if(ignoreVisitId&&String(idOf(v))===ignoreVisitId)return false;
  return rangesOverlap(nr,visitTimeRange(v));
 });
}
function assignTechnician(data,actor){
 requirePermission("assign",actor);
 assert(data&&data.requestId&&exists(KEYS.requests,data.requestId),"أمر الشغل غير موجود.");
 assert(data.technicianId&&exists(KEYS.technicians,data.technicianId),"الفني غير موجود.");
 const req=findRequest(data.requestId);
 assert(!["مغلق","ملغي","مؤرشف"].includes(String(req.status||"")),"لا يمكن إسناد فني لأمر شغل مغلق أو ملغي أو مؤرشف.");
 const tech=findTechnician(data.technicianId);
 assert(technicianIsActive(tech),"لا يمكن إسناد أمر الشغل إلى فني غير فعال أو موقوف.");
 assert(String(requestCustomerId(req))&&String(requestDeviceId(req)),"أمر الشغل غير مكتمل العلاقة بالعميل والجهاز.");
 validateRequestChain(req);
 assert(!technicianScheduleConflict(data.technicianId,data),"الفني لديه تعارض في الموعد المحدد.");
 const updated=updateRequestStatus(req.id,"تم الإسناد",actor);
 const a=list(KEYS.assignments),id=clean(data.id,80)||nextId("ASN-",KEYS.assignments,6);
 const item=Object.assign({},data,{id,requestId:req.id,technicianId:data.technicianId,assignedAt:data.assignedAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=Object.assign({},a[i],item);else a.push(item);
 coreWrite(KEYS.assignments,a);audit(i>=0?"تعديل":"إضافة","إسناد الفنيين",id,"إسناد فني فعال لأمر الشغل",actor);syncRelations();return updated;
}
function saveWarranty(data,actor){
 requirePermission("warranty",actor);
 validateWarrantyChain(data);
 const rid=data.requestId||data.workOrderId, r=rid?findRequest(rid):null;
 const inv=data.invoiceId?findInvoice(data.invoiceId):null;
 const contract=data.contractId?find(KEYS.contracts,data.contractId):null;
 const mode=settings().warrantyCreationMode||"close";
 const triggeredByClose=!!(r&&r.status==="مغلق");
 const triggeredByInvoice=!!(inv&&isFinalInvoice(inv));
 const triggeredByContract=!!contract;
 const manual=String(data.creationMode||"").toLowerCase()==="manual";
 const allowed=manual||triggeredByClose||(mode==="invoice"&&triggeredByInvoice)||(mode==="contract"&&triggeredByContract)||(mode==="any"&&(triggeredByInvoice||triggeredByContract||triggeredByClose));
 assert(allowed,"لا يمكن إنشاء الضمان قبل تحقق طريقة الإنشاء المعتمدة.");
 assert(clean(data.type||data.warrantyType,100),"نوع الضمان مطلوب.");
 assert(data.startDate||data.startAt||data.warrantyStart,"تاريخ بداية الضمان مطلوب.");
 assert(data.endDate||data.endAt||data.warrantyEnd||Number(data.durationDays||data.days)>0,"مدة/تاريخ انتهاء الضمان مطلوب.");
 assert(data.servicesCovered!==undefined||data.coveredServices!==undefined||data.includedServices!==undefined,"الخدمات المشمولة في الضمان مطلوبة.");
 assert(data.partsCovered!==undefined||data.coveredParts!==undefined||data.includedParts!==undefined,"القطع المشمولة في الضمان مطلوبة.");
 const warrantyStatus=clean(data.status||"ساري",50);
 assert(["ساري","منتهي","معلق","ملغي","قيد المراجعة","مغلق"].includes(warrantyStatus),"حالة الضمان غير معتمدة.");
 if(manual)requirePermission("warranty",actor);
 const a=list(KEYS.warranties),id=clean(data.id,80)||nextId("WAR-",KEYS.warranties,6);
 const item=Object.assign({},data,{id,updatedAt:now(),createdAt:data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=Object.assign({},a[i],item);else a.push(item);
 coreWrite(KEYS.warranties,a);audit(i>=0?"تعديل":"إضافة","الضمان",id,"سجل ضمان",actor);return item;
}
function saveContract(data,actor){
 requirePermission("contract",actor);
 validateContractChain(data);
 const a=list(KEYS.contracts),id=clean(data.id,80)||nextId("CON-",KEYS.contracts,6);
 const item=Object.assign({},data,{id,updatedAt:now(),createdAt:data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=Object.assign({},a[i],item);else a.push(item);
 coreWrite(KEYS.contracts,a);audit(i>=0?"تعديل":"إضافة","العقود",id,"عقد مرتبط بالعميل والأجهزة",actor);return item;
}
function saveCustomerMessage(data,actor){
 const aa=actorInfo(actor);
 if(String(aa.role||"").toLowerCase()==="customer" || String(aa.role||"")==="عميل") requirePermission("customerMessage",actor);
 else requirePermission("customerMessage",actor);
 assert(data&&data.customerId&&exists(KEYS.customers,data.customerId),"العميل غير موجود.");
 if(["customer","عميل"].includes(String(aa.role||"").toLowerCase())) assert(String(aa.id)===String(data.customerId),"لا يمكنك إرسال رسالة باسم عميل آخر.");
 const a=list(KEYS.customerMessages),id=clean(data.id,100)||nextId("MSG-",KEYS.customerMessages,8);
 const item=Object.assign({},data,{id,updatedAt:now(),createdAt:data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===String(id)); if(i>=0)a[i]=item; else a.unshift(item);
 coreWrite(KEYS.customerMessages,a); audit(i>=0?"تعديل":"إضافة","رسائل العملاء",id,"رسالة من/إلى العميل",actor); return item;
}
function saveUser(data,actor){
 requirePermission("settings",actor); assert(data&&clean(data.name,200),"اسم المستخدم مطلوب."); assert(data&&clean(data.username,120),"اسم المستخدم مطلوب.");
 const a=list(KEYS.users),id=clean(data.id,80)||nextId("USR-",KEYS.users,6);
 const dup=a.find(x=>String(x.id)!==String(id)&&String(x.username||"").toLowerCase()===String(data.username).toLowerCase()); assert(!dup,"اسم المستخدم مستخدم بالفعل.");
 const existing=a.find(x=>String(x.id)===String(id)); const item=Object.assign({},existing||{},data,{id,updatedAt:now(),createdAt:(existing&&existing.createdAt)||data.createdAt||now()});
 const i=a.findIndex(x=>String(x.id)===String(id)); if(i>=0)a[i]=item; else a.unshift(item); coreWrite(KEYS.users,a); audit(i>=0?"تعديل":"إضافة","المستخدمون",id,"حفظ مستخدم وصلاحيات",actor); return item;
}
function setUserStatus(id,status,actor){ requirePermission("settings",actor); const a=list(KEYS.users),i=a.findIndex(x=>String(x.id)===String(id)); assert(i>=0,"المستخدم غير موجود."); a[i]=Object.assign({},a[i],{status,updatedAt:now()}); coreWrite(KEYS.users,a); audit("تعديل","المستخدمون",id,"تغيير حالة المستخدم",actor,{status}); return a[i]; }
function deleteUser(id,actor){ requirePermission("settings",actor); const a=list(KEYS.users),u=a.find(x=>String(x.id)===String(id)); assert(u,"المستخدم غير موجود."); assert(!(u.role==="مدير النظام"&&u.status==="نشط"&&a.filter(x=>x.role==="مدير النظام"&&x.status==="نشط").length<=1),"لا يمكن حذف آخر مدير نشط."); coreWrite(KEYS.users,a.filter(x=>String(x.id)!==String(id))); audit("حذف","المستخدمون",id,"حذف مستخدم",actor); return true; }

function saveComplaint(data,actor){
 requirePermission("complaint",actor);
 assert(data&&data.customerId&&exists(KEYS.customers,data.customerId),"العميل غير موجود.");
 if(data.requestId){const rr=findRequest(data.requestId);assert(rr,"أمر الشغل غير موجود.");assert(String(requestCustomerId(rr))===String(data.customerId),"الشكوى لا تخص عميل أمر الشغل.");}
 const a=list(KEYS.complaints),id=clean(data.id,80)||nextId("CMP-",KEYS.complaints,6);
 const item=Object.assign({},data,{id,updatedAt:now(),createdAt:data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=Object.assign({},a[i],item);else a.push(item);
 coreWrite(KEYS.complaints,a);audit(i>=0?"تعديل":"إضافة","الشكاوى",id,"شكوى عميل",actor);recalculateCustomerClassification(item.customerId,actor);return item;
}
function saveRating(data,actor){
 requirePermission("rating",actor);
 assert(data&&data.customerId&&exists(KEYS.customers,data.customerId),"العميل غير موجود.");
 assert(data.requestId,"التقييم يجب أن يرتبط بأمر شغل.");
 const rr=findRequest(data.requestId);assert(rr,"أمر الشغل غير موجود.");
 assert(String(requestCustomerId(rr))===String(data.customerId),"التقييم لا يخص عميل أمر الشغل.");
 assert(rr.status==="مغلق","لا يمكن تقييم الخدمة قبل إغلاق أمر الصيانة.");
 const rating=Number(data.rating);assert(Number.isFinite(rating)&&rating>=1&&rating<=5,"التقييم يجب أن يكون من 1 إلى 5.");
 const a=list(KEYS.ratings),id=clean(data.id,80)||nextId("RAT-",KEYS.ratings,6),existing=a.find(x=>String(idOf(x))===String(id));
 assert(!existing||existing.archived!==true,"لا يمكن تعديل تقييم مؤرشف.");
 const item=Object.assign({},existing||{},data,{id,rating,archived:false,updatedAt:now(),createdAt:(existing&&existing.createdAt)||data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===String(id));if(i>=0)a[i]=item;else a.push(item);
 coreWrite(KEYS.ratings,a);audit(i>=0?"تعديل":"إضافة","التقييمات",id,"تقييم عميل",actor);recalculateCustomerClassification(item.customerId,actor);return item;
}
function archiveRating(id,actor){
 requirePermission("archive",actor);const a=list(KEYS.ratings),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"التقييم غير موجود.");
 a[i]=Object.assign({},a[i],{archived:true,archivedAt:now(),updatedAt:now()});coreWrite(KEYS.ratings,a);audit("أرشفة","التقييمات",id,"أرشفة تقييم دون حذفه",actor);return a[i];
}

function runIntegrityCheck(actor){
 requirePermission("integrity",actor);
 const result=validateIntegrity();
 audit("فحص سلامة البيانات","النظام","",result.ok?"نجح فحص سلامة العلاقات":"اكتشاف "+result.count+" مشكلة في العلاقات",actor);
 return result;
}

function customerFinancialSummary(cid){
 const inv=customerInvoices(cid),pay=customerPayments(cid).filter(p=>p.status==="مؤكدة");
 const total=inv.reduce((s,i)=>s+invoiceTotal(i),0),paid=pay.filter(p=>p.type!=="استرداد").reduce((s,p)=>s+Number(p.amount||0),0),ref=pay.filter(p=>p.type==="استرداد").reduce((s,p)=>s+Number(p.amount||0),0);
 return {invoices:inv.length,total,paid,refunded:ref,balance:Math.max(0,total-paid+ref)};
}
function customer360(cid){
 const c=findCustomer(cid);if(!c)return null;const req=customerRequests(cid);
 return {customer:c,devices:customerDevices(cid),requests:req,visits:customerVisits(cid),invoices:customerInvoices(cid),payments:customerPayments(cid),warranties:req.flatMap(r=>requestWarranties(idOf(r))),contracts:list(KEYS.contracts).filter(x=>String(x.customerId)===String(cid)),loyalty:list(KEYS.loyaltyAccounts).find(x=>String(x.customerId)===String(cid))||null,financial:customerFinancialSummary(cid)};
}

function migrateWorkOrdersToCanonical(){
 const legacyKey="workOrdersLegacy",canonicalKey=KEYS.requests;
 const legacy=read(legacyKey,[]);
 if(!Array.isArray(legacy)||!legacy.length)return;
 const canonical=list(canonicalKey),seen=new Set(canonical.map(idOf));
 let changed=false;
 legacy.forEach(x=>{
  const id=idOf(x);
  if(!id||seen.has(id))return;
  const r=Object.assign({},x,{id,customerId:x.customerId||x.clientId||"",deviceId:x.deviceId||x.applianceId||"",requestType:x.requestType||x.type||"صيانة منزلية"});
  canonical.push(r);seen.add(id);changed=true;
 });
 if(changed){coreWrite(canonicalKey,canonical);audit("ترحيل","النظام","", "تم دمج أوامر الشغل القديمة في المصدر الموحد","النظام");}
}


function saveNotification(data,actor){
 requirePermission("notifications",actor);
 assert(data&&clean(data.title,300),"عنوان الإشعار مطلوب.");
 assert(data&&clean(data.message,4000),"محتوى الإشعار مطلوب.");
 const a=list(KEYS.notifications),id=clean(data.id,100)||nextId("NTF-",KEYS.notifications,8);
 const existing=a.find(x=>String(idOf(x))===String(id));
 const item=Object.assign({},existing||{},data,{id,updatedAt:now(),createdAt:(existing&&existing.createdAt)||data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=item;else a.unshift(item);
 coreWrite(KEYS.notifications,a);audit(i>=0?"تعديل":"إضافة","الإشعارات",id,"حفظ إشعار",actor);return item;
}
function updateNotification(id,patch,actor){
 requirePermission("notifications",actor);const a=list(KEYS.notifications),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الإشعار غير موجود.");
 a[i]=Object.assign({},a[i],patch||{},{id:a[i].id,updatedAt:now()});coreWrite(KEYS.notifications,a);audit("تعديل","الإشعارات",id,"تحديث حالة الإشعار",actor);return a[i];
}
function saveTechnicalLibrary(data,actor){
 requirePermission("library",actor);assert(data&&clean(data.title,300),"عنوان المرجع مطلوب.");assert(data&&clean(data.content,20000),"محتوى المرجع مطلوب.");
 const a=list(KEYS.technicalLibrary),id=clean(data.id,100)||nextId("LIB-",KEYS.technicalLibrary,5),existing=a.find(x=>String(idOf(x))===id);
 const item=Object.assign({},existing||{},data,{id,updatedAt:now(),createdAt:(existing&&existing.createdAt)||data.createdAt||now()});
 const i=a.findIndex(x=>String(idOf(x))===id);if(i>=0)a[i]=item;else a.unshift(item);coreWrite(KEYS.technicalLibrary,a);audit(i>=0?"تعديل":"إضافة","المكتبة الفنية",id,"حفظ مرجع فني",actor);return item;
}
function deleteTechnicalLibrary(id,actor){requirePermission("delete",actor);const a=list(KEYS.technicalLibrary),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"المرجع غير موجود.");a.splice(i,1);coreWrite(KEYS.technicalLibrary,a);audit("حذف","المكتبة الفنية",id,"حذف مرجع فني",actor);return true;}
function saveLoyaltySettings(data,actor){requirePermission("settings",actor);const merged=Object.assign({},settings(),data||{});return saveSettings(merged,actor);}
function saveNotificationSettings(data,actor){requirePermission("settings",actor);const a=Object.assign({},read(KEYS.notificationSettings,{}),data||{}, {updatedAt:now()});coreWrite(KEYS.notificationSettings,a);audit("تعديل","الإشعارات","","تعديل إعدادات الإشعارات",actor);return a;}
function saveInventoryTransaction(data,actor){
 requirePermission("stock",actor);assert(data&&data.itemId&&exists(KEYS.inventory,data.itemId),"الصنف غير موجود.");
 const type=clean(data.type,100)||"إضافة",qty=Number(data.qty??data.quantity);assert(Number.isFinite(qty)&&qty>0,"الكمية غير صحيحة.");
 if(["صرف لفني","صرف","استخدام","تركيب","تلف"].includes(type)) return consumeInventory(data.itemId,qty,type,data.requestId||data.workOrderId||data.reference||"",data.notes||"",actor);
 if(type==="تعديل جرد") return adjustInventoryCount(data.itemId,Number(data.actualQuantity),data.notes||"",actor);
 return addInventoryTransactionInternal(data.itemId,qty,type,data.reference||data.requestId||"",data.notes||"",actor);
}
function adjustInventoryCount(id,actual,notes,actor){
 requirePermission("stock",actor);const a=list(KEYS.inventory),i=a.findIndex(x=>String(idOf(x))===String(id));assert(i>=0,"الصنف غير موجود.");const n=Number(actual);assert(Number.isFinite(n)&&n>=0,"الرصيد الفعلي غير صحيح.");
 const before=Number(a[i].quantity||0),diff=n-before;if(diff===0)return a[i];
 a[i]=Object.assign({},a[i],{quantity:n,available:Math.max(0,n-Number(a[i].reservedQuantity||0)),updatedAt:now()});coreWrite(KEYS.inventory,a);
 const tr=list(KEYS.inventoryTransactions);tr.unshift({id:nextId("TR-",KEYS.inventoryTransactions,7),itemId:id,itemName:a[i].name||"",type:"تعديل جرد",qty:Math.abs(diff),difference:diff,before,after:n,notes:notes||"",userId:actorInfo(actor).id||"",user:actorInfo(actor).name||"النظام",date:now()});coreWrite(KEYS.inventoryTransactions,tr);audit("تعديل جرد","المخزون",id,"تسجيل فرق الجرد",actor);return a[i];
}
function deletePurchaseOrder(id,actor){requirePermission("delete",actor);const x=find(KEYS.purchaseOrders,id);assert(x,"طلب الشراء غير موجود.");assert(!list(KEYS.purchaseReceipts).some(r=>String(r.purchaseOrderId)===String(id)),"لا يمكن حذف طلب شراء بدأ استلامه؛ استخدم الأرشفة أو الإلغاء.");const a=list(KEYS.purchaseOrders).filter(v=>String(idOf(v))!==String(id));coreWrite(KEYS.purchaseOrders,a);audit("حذف","طلبات الشراء",id,"حذف طلب شراء",actor);return true;}
function saveAuditManual(data,actor){requirePermission("audit",actor);assert(data&&clean(data.description,2000),"وصف العملية مطلوب.");return audit(data.action||"أخرى",data.module||"النظام",data.recordId||"",data.description,actor,{result:"success"});}
function exportBackup(actor){requirePermission("settings",actor);const data={exportedAt:now(),version:CORE_VERSION,settings:settings(),data:{}};Object.keys(KEYS).forEach(k=>{const key=KEYS[k];data.data[key]=read(key,Array.isArray(read(key,null))?[]:{});});audit("تصدير نسخة احتياطية","الإعدادات","","تصدير نسخة احتياطية",actor);return data;}
function importBackup(data,actor){requirePermission("settings",actor);assert(data&&typeof data==="object","ملف النسخة الاحتياطية غير صالح.");if(data.settings)saveSettings(data.settings,actor);if(data.data&&typeof data.data==="object"){Object.entries(data.data).forEach(([key,value])=>{if(Object.values(KEYS).includes(key))coreWrite(key,clone(value));});}syncRelations();const result=validateIntegrity();audit("استيراد نسخة احتياطية","الإعدادات","",result.ok?"تم استيراد نسخة احتياطية":"تم الاستيراد مع وجود مشاكل في العلاقات",actor,{result:result.ok?"success":"warning"});return result;}

function moduleContract(){
 return {
  entities:Object.assign({},KEYS),
  identity:{customer:"customerId",device:"deviceId",request:"requestId",technician:"technicianId",invoice:"invoiceId",payment:"paymentId",warranty:"warrantyId",inventoryItem:"itemId",customerRelationship:"customerRelationshipId"},
  mutationRule:"لا توجد كتابة مباشرة؛ استخدم API الخاص بالـCore",
  auditRule:"كل عملية تغيير مهمة تمر عبر audit",
  relationRule:"validateIntegrity و validators قبل الحفظ",
  integrationRule:"إعادة استخدام نفس IDs والمصادر الأساسية وعدم إنشاء بيانات موازية"
 };
}

function mutationPolicy(){
 return {
  directWrite:false,
  requiredPath:"WorkshopCore mutation APIs",
  auditRequired:true,
  relationValidation:true,
  integrityCheck:"WorkshopCore.runIntegrityCheck(actor)"
 };
}


function regressionSelfTest(){
 const failures=[];
 const fail=(name,msg)=>failures.push({name,error:String(msg||"فشل غير محدد")});
 const expectReject=(name,fn,expected)=>{
  try{fn();fail(name,"العملية قُبلت رغم وجوب رفضها.");}
  catch(e){
   const msg=String(e&&e.message||e);
   if(expected&&!msg.includes(expected))fail(name,"سبب الرفض غير صحيح: "+msg);
  }
 };
 const admin={id:"TEST-ADMIN",name:"اختبار",role:"admin"};
 const tech={id:"TEST-TECH",name:"فني اختبار",role:"technician"};
 if(!hasPermission("technicianManage",admin))fail("permission technicianManage","admin denied");
 if(hasPermission("technicianManage",tech))fail("permission technicianManage","technician bypass");
 if(!hasPermission("integrity",admin))fail("permission integrity","admin denied");
 if(!hasPermission("visitManage",admin))fail("permission visitManage","admin denied");
 if(hasPermission("visitManage",tech))fail("permission visitManage","technician bypass");
 if(!hasPermission("customerMerge",admin))fail("permission customerMerge","admin denied");
 if(hasPermission("customerMerge",tech))fail("permission customerMerge","technician bypass");
 expectReject("public write",()=>publicWriteBlocked(),"الكتابة المباشرة");
 const result=validateIntegrity();
 if(!result.ok)fail("integrity",result.problems.join(" | "));
 return {ok:failures.length===0,failures};
}

function systemSummary(){
 return {version:CORE_VERSION,date:today(),customers:list(KEYS.customers).length,devices:list(KEYS.devices).length,
 requests:list(KEYS.requests).length,workOrders:list(KEYS.requests).length,technicians:list(KEYS.technicians).length,
 visits:list(KEYS.visits).length,routes:list(KEYS.routes).length,inventory:list(KEYS.inventory).length,
 suppliers:list(KEYS.suppliers).length,purchaseOrders:list(KEYS.purchaseOrders).length,invoices:list(KEYS.invoices).length,
 payments:list(KEYS.payments).length,warranties:list(KEYS.warranties).length,contracts:list(KEYS.contracts).length,
 notifications:list(KEYS.notifications).length,users:list(KEYS.users).length};
}

window.WorkshopCore={
 VERSION:CORE_VERSION,KEYS,DEFAULT_SETTINGS,WORK_ORDER_TYPES,PRIORITIES,STATUSES,
 getPermissionRegistry,setPermissionRegistry,getWorkflowPolicy,setWorkflowPolicy,allowedWorkflowTransition,assertWorkflowTransition,
 auditImmutable,deleteAudit,updateAudit,
 read,list,write:publicWriteBlocked,now,today,clean,idOf,nextId,settings,saveSettings,find,findCustomer,findDevice,findRequest,
 findTechnician,findVisit,findInvoice,findPayment,customerName,technicianName,requestCustomerId,requestDeviceId,
findPossibleCustomerMatches,findCustomerRelationshipSuggestions,customerRelationships,linkCustomerRelationship,addCustomerPhone,requestCustomerMerge,mergeCustomers,resolveCustomerId,findCustomerByPhone,
 customerDevices,customerRequests,customerVisits,customerInvoices,customerPayments,customerClassification,recalculateCustomerClassification,customerPhoneExists,requestVisits,requestInvoices,
 requestPayments,requestWarranties,technicianVisits,invoiceTotal,paymentsForInvoice,invoicePaid,invoiceRefunded,
 invoiceBalance,inventoryItem,inventoryQuantity,addInventoryTransaction,consumeInventory,getOrCreateLoyalty,
 loyaltyPoints,changeLoyalty,audit,syncRelations,validateIntegrity,validateCustomerDevice,validateRequestRefs,
 saveRequest,updateRequestStatus,deleteRequest,addVisit,updateVisit,cancelVisit,requestWorkOrder,customerFinancialSummary,customer360,systemSummary,moduleContract,mutationPolicy,runIntegrityCheck,regressionSelfTest,log,hasPermission,requirePermission,requireAnyPermission,legacyList,legacyWrite,legacyRemove,canonicalKey,saveCustomer,archiveCustomer,deleteCustomer,saveDevice,findDuplicateDevice,findDeviceByWorkshopSerial,findDeviceByLegacySerial,deviceFingerprint,isStaffActor,device360,deviceWorkOrders,deviceVisits,deviceInvoices,deviceWarranties,deviceContracts,archiveDevice,deleteDevice,deriveDeviceCondition,syncDeviceConditions,deviceTypeList,deviceSubtypeOptions,saveDeviceType,addDeviceAttachment,deviceAttachments,deviceHistory,appendDeviceHistory,setDeviceQr,getDeviceQr,setDeviceKnowledge,getDeviceKnowledge,deviceLifecycle,deviceSearch,saveTechnician,archiveTechnician,saveSupplier,saveRoute,deleteRoute,savePurchaseOrder,approvePurchaseOrder,receivePurchaseOrder,saveInventoryItem,archiveInventoryItem,deleteInventoryItem,saveInvoice,savePayment,cancelPayment,refundPayment,saveApproval,saveDiagnosis,assignTechnician,saveWarranty,saveContract,saveComplaint,saveRating,reserveInventory,releaseInventoryReservation,returnPurchase,decrementInventoryForPurchaseReturn,archiveRating,saveNotification,updateNotification,saveCustomerMessage,saveUser,setUserStatus,deleteUser,saveTechnicalLibrary,deleteTechnicalLibrary,saveLoyaltySettings,saveNotificationSettings,saveInventoryTransaction,adjustInventoryCount,deletePurchaseOrder,saveAuditManual,exportBackup,importBackup
};
try{
 migrateWorkOrdersToCanonical();
 try{localStorage.removeItem("workOrdersLegacy");}catch(e){}
 syncRelations();
 const bootIntegrity=validateIntegrity();
 if(!bootIntegrity.ok)console.error("TWMS integrity check failed:",bootIntegrity.problems);
}catch(e){console.error("TWMS Core startup sync failed:",e);}
})(window);
