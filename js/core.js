import { firebaseConfig, APP_ROOT, ADMIN_EMAIL } from "./config.js?v=2.20";

if (!window.firebase) throw new Error("Không tải được Firebase SDK.");
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const db = firebase.database();
const root = db.ref(APP_ROOT);
export const ts = () => firebase.database.ServerValue.TIMESTAMP;

export const refs = {
  users:()=>root.child("users"), user:id=>root.child(`users/${id}`),
  projects:()=>root.child("projects"), project:id=>root.child(`projects/${id}`),
  rfqs:()=>root.child("rfqs"), rfq:id=>root.child(`rfqs/${id}`),
  boqRoot:()=>root.child("boq"),
  boqProject:projectId=>root.child(`boq/${projectId}`),
  boqItem:(projectId,itemId)=>root.child(`boq/${projectId}/${itemId}`),
  // V2.18.2: dữ liệu phụ của module lập giá nằm ngay trong /boq/{projectId}/__PRICING_DATA__.
  // Nhờ vậy module dùng đúng quyền đã hoạt động cho BOQ, không phụ thuộc Rules mới.
  boqPricingData:projectId=>root.child(`boq/${projectId}/__PRICING_DATA__`),
  boqImportMetaRoot:()=>root.child("boq"),
  boqImportMeta:projectId=>root.child(`boq/${projectId}/__PRICING_DATA__/boqImportMeta`),
  materialPriceImportsRoot:()=>root.child("boq"),
  materialPriceImportsProject:projectId=>root.child(`boq/${projectId}/__PRICING_DATA__/materialPriceImports`),
  materialPriceImport:(projectId,importId)=>root.child(`boq/${projectId}/__PRICING_DATA__/materialPriceImports/${importId}`),
  supplierQuotesRoot:()=>root.child("supplierQuotes"),
  supplierQuotesProject:projectId=>root.child(`supplierQuotes/${projectId}`),
  supplierQuotesItem:(projectId,itemId)=>root.child(`supplierQuotes/${projectId}/${itemId}`),
  supplierQuote:(projectId,itemId,quoteId)=>root.child(`supplierQuotes/${projectId}/${itemId}/${quoteId}`),
  pricingSettingsRoot:()=>root.child("pricingSettings"),
  pricingSettings:projectId=>root.child(`pricingSettings/${projectId}`),
  boqVersionsRoot:()=>root.child("boqVersions"),
  boqVersionsProject:projectId=>root.child(`boqVersions/${projectId}`),
  boqVersion:(projectId,versionId)=>root.child(`boqVersions/${projectId}/${versionId}`),
  boqOriginalWorkbook:projectId=>root.child(`boqVersions/${projectId}/__SOURCE_XLSX__`),
  approvals:()=>root.child("approvals"), approval:id=>root.child(`approvals/${id}`),
  execution:()=>root.child("execution"), executionProject:id=>root.child(`execution/${id}`),
  handover:projectId=>root.child(`handover/${projectId}`),
  executionDocs:()=>root.child("executionDocs"),
  executionDocsProject:projectId=>root.child(`executionDocs/${projectId}`),
  executionDoc:(projectId,id)=>root.child(`executionDocs/${projectId}/${id}`),
  procurement:()=>root.child("procurement"),
  procurementProject:projectId=>root.child(`procurement/${projectId}`),
  procurementItem:(projectId,id)=>root.child(`procurement/${projectId}/${id}`),
  milestones:()=>root.child("milestones"),
  milestonesProject:projectId=>root.child(`milestones/${projectId}`),
  milestone:(projectId,id)=>root.child(`milestones/${projectId}/${id}`),

  quantityBaselineRoot:()=>root.child("quantityBaseline"),
  quantityBaselineProject:projectId=>root.child(`quantityBaseline/${projectId}`),
  quantityBaselineItem:(projectId,itemId)=>root.child(`quantityBaseline/${projectId}/${itemId}`),
  quantityBaselineMetaRoot:()=>root.child("quantityBaselineMeta"),
  quantityBaselineMeta:projectId=>root.child(`quantityBaselineMeta/${projectId}`),

  quantityBoqRevisionsRoot:()=>root.child("quantityBoqRevisions"),
  quantityBoqRevisionsProject:projectId=>root.child(`quantityBoqRevisions/${projectId}`),
  quantityBoqRevision:(projectId,revisionId)=>root.child(`quantityBoqRevisions/${projectId}/${revisionId}`),
  quantityBoqRevisionItems:(projectId,revisionId)=>root.child(`quantityBoqRevisions/${projectId}/${revisionId}/items`),
  quantityBoqRevisionItem:(projectId,revisionId,itemId)=>root.child(`quantityBoqRevisions/${projectId}/${revisionId}/items/${itemId}`),

  orderRequestsRoot:()=>root.child("orderRequests"),
  orderRequestsProject:projectId=>root.child(`orderRequests/${projectId}`),
  orderRequest:(projectId,requestId)=>root.child(`orderRequests/${projectId}/${requestId}`),
  orderRequestLines:(projectId,requestId)=>root.child(`orderRequests/${projectId}/${requestId}/lines`),
  orderRequestLine:(projectId,requestId,lineId)=>root.child(`orderRequests/${projectId}/${requestId}/lines/${lineId}`),

  quantityAuditRoot:()=>root.child("quantityAudit"),
  quantityAuditProject:projectId=>root.child(`quantityAudit/${projectId}`),
  quantityAuditItem:(projectId,id)=>root.child(`quantityAudit/${projectId}/${id}`),

  financeSettingsRoot:()=>root.child("financeSettings"),
  financeSettings:projectId=>root.child(`financeSettings/${projectId}`),

  budgetsRoot:()=>root.child("budgets"),
  budgetsProject:projectId=>root.child(`budgets/${projectId}`),
  budgetItem:(projectId,id)=>root.child(`budgets/${projectId}/${id}`),

  actualCostsRoot:()=>root.child("actualCosts"),
  actualCostsProject:projectId=>root.child(`actualCosts/${projectId}`),
  actualCost:(projectId,id)=>root.child(`actualCosts/${projectId}/${id}`),

  supplierPaymentsRoot:()=>root.child("supplierPayments"),
  supplierPaymentsProject:projectId=>root.child(`supplierPayments/${projectId}`),
  supplierPayment:(projectId,id)=>root.child(`supplierPayments/${projectId}/${id}`),

  variationsRoot:()=>root.child("variations"),
  variationsProject:projectId=>root.child(`variations/${projectId}`),
  variation:(projectId,id)=>root.child(`variations/${projectId}/${id}`),

  billingsRoot:()=>root.child("billings"),
  billingsProject:projectId=>root.child(`billings/${projectId}`),
  billing:(projectId,id)=>root.child(`billings/${projectId}/${id}`),

  receiptsRoot:()=>root.child("receipts"),
  receiptsProject:projectId=>root.child(`receipts/${projectId}`),
  receipt:(projectId,id)=>root.child(`receipts/${projectId}/${id}`),

  cashFlowPlansRoot:()=>root.child("cashFlowPlans"),
  cashFlowPlansProject:projectId=>root.child(`cashFlowPlans/${projectId}`),
  cashFlowPlan:(projectId,monthKey)=>root.child(`cashFlowPlans/${projectId}/${monthKey}`),

  financeAuditRoot:()=>root.child("financeAudit"),
  financeAuditProject:projectId=>root.child(`financeAudit/${projectId}`),
  financeAuditItem:(projectId,id)=>root.child(`financeAudit/${projectId}/${id}`),

  reports:()=>root.child("reports"), report:id=>root.child(`reports/${id}`),
  tasks:()=>root.child("tasks"), task:id=>root.child(`tasks/${id}`),
  activities:()=>root.child("activities")
};

export const ROLES = {
  ADMIN:"Quản trị hệ thống", DIRECTOR:"Giám đốc", MANAGER:"Trưởng phòng",
  TENDER:"Đấu thầu / QS", PROCUREMENT:"Mua hàng", TECHNICAL:"Kỹ thuật / PM",
  EMPLOYEE:"Nhân viên", VIEWER:"Chỉ xem"
};

const PERMS = {
  projectCreate:["ADMIN","DIRECTOR","MANAGER","TENDER"],
  projectEdit:["ADMIN","DIRECTOR","MANAGER","TENDER","TECHNICAL"],
  projectDelete:["ADMIN","DIRECTOR"],
  tenderEdit:["ADMIN","DIRECTOR","MANAGER","TENDER"],
  rfqEdit:["ADMIN","DIRECTOR","MANAGER","TENDER","PROCUREMENT"],
  boqEdit:["ADMIN","DIRECTOR","MANAGER","TENDER"],
  quoteEdit:["ADMIN","DIRECTOR","MANAGER","TENDER","PROCUREMENT"],
  approvalSubmit:["ADMIN","DIRECTOR","MANAGER","TENDER"],
  approvalDecide:["ADMIN","DIRECTOR"],
  executionEdit:["ADMIN","DIRECTOR","MANAGER","TECHNICAL"],
  executionHandover:["ADMIN","DIRECTOR","MANAGER","TENDER","TECHNICAL"],
  executionDocsEdit:["ADMIN","DIRECTOR","MANAGER","TECHNICAL"],
  procurementEdit:["ADMIN","DIRECTOR","MANAGER","PROCUREMENT","TECHNICAL"],
  milestoneEdit:["ADMIN","DIRECTOR","MANAGER","TECHNICAL"],
  quantityBaselineCreate:["ADMIN","DIRECTOR","MANAGER","TENDER"],
  quantityRevisionManage:["ADMIN","DIRECTOR","MANAGER","TENDER"],
  quantityRevisionActivate:["ADMIN","DIRECTOR","MANAGER"],
  quantityRequestCreate:["ADMIN","DIRECTOR","MANAGER","TECHNICAL","PROCUREMENT","EMPLOYEE"],
  quantityRequestApprove:["ADMIN","DIRECTOR","MANAGER"],
  quantityRequestOrder:["ADMIN","DIRECTOR","MANAGER","PROCUREMENT"],
  quantityRequestCancel:["ADMIN","DIRECTOR","MANAGER"],
  quantityVariationCreate:["ADMIN","DIRECTOR","MANAGER","TENDER"],
  financeProjectView:["ADMIN","DIRECTOR","MANAGER","TENDER"],
  financeProjectEdit:["ADMIN","DIRECTOR","MANAGER"],
  financeCostEdit:["ADMIN","DIRECTOR","MANAGER"],
  financeVariationEdit:["ADMIN","DIRECTOR","MANAGER","TENDER"],
  financeBillingEdit:["ADMIN","DIRECTOR","MANAGER"],
  financeAuditView:["ADMIN","DIRECTOR","MANAGER"],
  cashFlowEdit:["ADMIN","DIRECTOR","MANAGER"],
  taskAssign:["ADMIN","DIRECTOR","MANAGER","TENDER","PROCUREMENT","TECHNICAL"],
  taskSelfEdit:["ADMIN","DIRECTOR","MANAGER","TENDER","PROCUREMENT","TECHNICAL","EMPLOYEE"],
  taskDelete:["ADMIN","DIRECTOR","MANAGER"],
  reportsEditAll:["ADMIN","DIRECTOR","MANAGER"],
  usersManage:["ADMIN"],
  finance:["ADMIN","DIRECTOR","MANAGER","TENDER"]
};

let profile = null;
export const getProfile = () => profile;
export const can = action => (PERMS[action]||[]).includes(profile?.role||"VIEWER");

export async function arr(ref){
  const snap = await ref.once("value");
  const val = snap.val() || {};
  return Object.entries(val).map(([id,x])=>({id,...(x||{})}));
}

export async function logActivity(type,message,meta={}){
  const user=auth.currentUser;
  const key=refs.activities().push().key;
  await refs.activities().child(key).set({
    type,message,...meta,userId:user?.uid||"",userEmail:user?.email||"",createdAt:ts()
  });
}

export async function ensureProfile(user){
  const snap=await refs.user(user.uid).once("value");
  if(snap.exists()){
    profile={uid:user.uid,...snap.val()};
    if(profile.active===false) throw new Error("Tài khoản này đang bị khóa.");
    return profile;
  }
  const admin=(user.email||"").toLowerCase()===ADMIN_EMAIL.toLowerCase();
  const p={
    email:user.email||"",
    displayName:user.displayName||(admin?"Quản trị hệ thống":(user.email||"").split("@")[0]),
    department:admin?"Ban quản trị":"",
    role:admin?"ADMIN":"EMPLOYEE",
    active:true,createdAt:ts(),updatedAt:ts()
  };
  await refs.user(user.uid).set(p);
  profile={uid:user.uid,...p};
  return profile;
}

export function listenAuth(cb){
  return auth.onAuthStateChanged(async user=>{
    if(!user){profile=null;cb(null,null);return}
    try{cb(user,await ensureProfile(user))}
    catch(e){await auth.signOut();cb(null,null,e)}
  });
}

export const esc=(v="")=>String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
export const norm=(v="")=>String(v).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");
export const money=(v,compact=false)=>{
  const n=Number(v||0);
  if(compact&&Math.abs(n)>=1e9)return `${(n/1e9).toLocaleString("vi-VN",{maximumFractionDigits:1})} tỷ`;
  if(compact&&Math.abs(n)>=1e6)return `${(n/1e6).toLocaleString("vi-VN",{maximumFractionDigits:1})} tr`;
  return `${n.toLocaleString("vi-VN")} ₫`;
};
export const fmtDate=v=>{
  if(!v)return "—"; const d=typeof v==="number"?new Date(v):new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
};
export const fmtDateTime=v=>{
  if(!v)return "—";const d=new Date(v);if(Number.isNaN(d.getTime()))return "—";
  return new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d);
};
export const daysUntil=v=>{if(!v)return null;return Math.ceil((new Date(`${v}T23:59:59`)-new Date())/86400000)};
export const initials=(name="",email="")=>{
  const s=name.trim()||email.split("@")[0]||"U", p=s.split(/\s+/).filter(Boolean);
  return p.length===1?p[0].slice(0,2).toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase();
};

export const TENDER_STAGES=[
  ["RECEIVED","Đã nhận","gray"],["REVIEWING","Kiểm tra HS","blue"],["RFQ","Hỏi giá","cyan"],
  ["PRICING","Lập giá","purple"],["APPROVAL","Chờ duyệt","orange"],["SUBMITTED","Đã nộp","blue"],
  ["NEGOTIATION","Thương thảo","orange"],["WON","Trúng thầu","green"],["LOST","Trượt thầu","red"]
];
export const EXEC_STAGES=[
  ["HANDOVER","Bàn giao"],["PLANNING","Chuẩn bị"],["SHOPDRAWING","Shopdrawing"],["MATERIAL","Material"],
  ["PROCUREMENT","Mua hàng"],["CONSTRUCTION","Thi công"],["COMMISSIONING","Nghiệm thu"],["CLOSED","Hoàn thành"]
];
export const stageInfo=k=>{const x=TENDER_STAGES.find(s=>s[0]===k)||TENDER_STAGES[0];return{key:x[0],label:x[1],color:x[2]}};
export const execInfo=k=>{const x=EXEC_STAGES.find(s=>s[0]===k)||EXEC_STAGES[0];return{key:x[0],label:x[1]}};
export const TASK_STATUSES=[
  ["TODO","Chưa thực hiện","gray"],
  ["DOING","Đang thực hiện","blue"],
  ["BLOCKED","Đang vướng","orange"],
  ["DONE","Hoàn thành","green"]
];
export const TASK_PRIORITIES=[
  ["LOW","Thấp","gray"],
  ["NORMAL","Bình thường","blue"],
  ["HIGH","Cao","orange"],
  ["URGENT","Khẩn cấp","red"]
];
export const TASK_TYPES=[
  ["REVIEW","Kiểm tra hồ sơ"],
  ["BOQ","Bóc / Rà BOQ"],
  ["RFQ","RFQ / Hỏi giá"],
  ["PRICING","Lập giá"],
  ["APPROVAL","Trình duyệt"],
  ["SUBMIT","Nộp thầu"],
  ["TECHNICAL","Kỹ thuật / Shopdrawing"],
  ["MATERIAL","Vật tư / Mua hàng"],
  ["CONSTRUCTION","Thi công"],
  ["OTHER","Khác"]
];

export const DISCIPLINES=["PCCC","HVAC","CẤP THOÁT NƯỚC","ĐIỆN","ĐIỆN NHẸ","KHÁC"];
export const projectCode=n=>`DA-${new Date().getFullYear()}-${String(n).padStart(3,"0")}`;
export const appVersion="2.20";
export const weekKey=()=>{
  const d=new Date(), t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())), day=t.getUTCDay()||7;
  t.setUTCDate(t.getUTCDate()+4-day);const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil((((t-y0)/86400000)+1)/7)).padStart(2,"0")}`;
};
export const monthKey=()=>`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;

// UI
const $=s=>document.querySelector(s);
let submitHandler=null;
export function setPage(title,crumb="Hệ thống quản lý"){
  $("#pageTitle").textContent=title;$("#breadcrumb").textContent=crumb;document.title=`${title} · Hệ thống Quản lý`;
}
export const loading=(t="Đang tải dữ liệu...")=>`<div class="loading"><div class="spinner"></div><span>${esc(t)}</span></div>`;
export const empty=(title,msg,icon="▦")=>`<div class="empty"><b>${icon}</b><h3>${esc(title)}</h3><p>${esc(msg)}</p></div>`;
export const badge=(label,color="gray")=>`<span class="badge ${color}">${esc(label)}</span>`;
export function toast(message,type="success"){
  const e=document.createElement("div");e.className=`toast ${type}`;e.innerHTML=`<b>${type==="error"?"!":type==="warning"?"⚠":"✓"}</b><span>${esc(message)}</span>`;
  $("#toastRoot").appendChild(e);setTimeout(()=>e.remove(),3500);
}
export function modal({title,eyebrow="",body="",size="md",submitText="Lưu",showSubmit=true,onSubmit=null}){
  $("#modalTitle").textContent=title;$("#modalEyebrow").textContent=eyebrow;$("#modalBody").innerHTML=body;
  $("#modalPanel").className=`modal-panel ${size==="xl"?"xl":size==="lg"?"lg":size==="sm"?"sm":""}`;
  $("#modalFooter").innerHTML=`<button type="button" class="btn" data-modal-close>Hủy</button>${showSubmit?`<button type="submit" class="btn primary">${submitText}</button>`:""}`;
  submitHandler=onSubmit;$("#modalRoot").classList.remove("hidden");document.body.style.overflow="hidden";
}
export function closeModal(){$("#modalRoot").classList.add("hidden");document.body.style.overflow="";submitHandler=null}
export function initModal(){
  $("#modalRoot").addEventListener("click",e=>{if(e.target.closest("[data-modal-close]"))closeModal()});
  $("#modalForm").addEventListener("submit",async e=>{
    e.preventDefault();if(!submitHandler)return;const btn=e.currentTarget.querySelector('button[type="submit"]');
    try{if(btn){btn.disabled=true;btn.textContent="Đang lưu..."}const ok=await submitHandler(new FormData(e.currentTarget));if(ok!==false)closeModal()}
    catch(err){console.error(err);toast(err.message||"Không thể lưu dữ liệu.","error")}
    finally{if(btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent="Lưu"}}
  });
}
export function confirmBox(title,msg,confirmText="Xác nhận"){
  return new Promise(resolve=>{
    modal({title,eyebrow:"XÁC NHẬN",size:"sm",body:`<p class="confirm-text">${esc(msg)}</p>`,submitText:confirmText,onSubmit:async()=>{resolve(true);return true}});
    const cancel=()=>resolve(false);
    $("#modalRoot").querySelectorAll("[data-modal-close]").forEach(x=>x.addEventListener("click",cancel,{once:true}));
  });
}
