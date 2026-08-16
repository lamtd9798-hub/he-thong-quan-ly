import {
  refs,arr,ts,logActivity,can,getProfile,esc,norm,fmtDate,fmtDateTime,daysUntil,
  EXEC_STAGES,execInfo,DISCIPLINES,setPage,loading,empty,badge,modal,closeModal,toast,confirmBox
} from "../core.js?v=2.20.1";
import {renderQuantityControl} from "./quantity-control.js?v=2.20.1";

let projects=[], executions=[], users=[];
let selectedProjectId="";
let tab="OVERVIEW";

let handover={};
let docs=[];
let procurement=[];
let milestones=[];

const DOC_TYPES=[
  ["SHOPDRAWING","Shopdrawing"],
  ["MATERIAL","Material Submission"],
  ["RFI","RFI / Làm rõ"],
  ["METHOD","Biện pháp thi công"],
  ["OTHER","Hồ sơ khác"]
];
const DOC_STATUSES=[
  ["DRAFT","Đang chuẩn bị","gray"],
  ["SUBMITTED","Đã trình","blue"],
  ["REVISION","Yêu cầu sửa","orange"],
  ["APPROVED","Đã duyệt","green"]
];
const PROC_STATUSES=[
  ["PLANNED","Kế hoạch","gray"],
  ["RFQ","Hỏi giá","blue"],
  ["PO","Đã đặt hàng","purple"],
  ["DELIVERING","Đang giao","orange"],
  ["DELIVERED","Đã về công trường","green"]
];
const MILESTONE_STATUSES=[
  ["TODO","Chưa thực hiện","gray"],
  ["DOING","Đang thực hiện","blue"],
  ["BLOCKED","Đang vướng","orange"],
  ["DONE","Hoàn thành","green"]
];

export async function renderExecution(container){
  setPage("Triển khai dự án","Công việc / Triển khai");
  container.innerHTML=loading();

  [projects,executions,users]=await Promise.all([
    arr(refs.projects()),arr(refs.execution()),arr(refs.users())
  ]);
  projects=projects.filter(x=>x.phase==="EXECUTION");
  users=users.filter(x=>x.active!==false).sort((a,b)=>(a.displayName||a.email||"").localeCompare(b.displayName||b.email||"","vi"));

  if(!selectedProjectId && projects.length)selectedProjectId=projects[0].id;
  if(selectedProjectId && !projects.some(p=>p.id===selectedProjectId))selectedProjectId=projects[0]?.id||"";

  await loadProjectData();
  paint(container);
}

async function loadProjectData(){
  if(!selectedProjectId){
    handover={};docs=[];procurement=[];milestones=[];return;
  }
  const [h,d,p,m]=await Promise.all([
    refs.handover(selectedProjectId).once("value"),
    refs.executionDocsProject(selectedProjectId).once("value"),
    refs.procurementProject(selectedProjectId).once("value"),
    refs.milestonesProject(selectedProjectId).once("value")
  ]);
  handover=h.val()||{};
  docs=toArray(d.val()).sort(sortDue);
  procurement=toArray(p.val()).sort(sortNeedDate);
  milestones=toArray(m.val()).sort(sortDue);
}

function paint(c){
  const p=projects.find(x=>x.id===selectedProjectId);
  const e=executions.find(x=>x.id===selectedProjectId)||{status:"HANDOVER",progress:0};
  const overdueDocs=docs.filter(x=>x.status!=="APPROVED"&&isLate(x.dueDate)).length;
  const overdueProc=procurement.filter(x=>x.status!=="DELIVERED"&&isLate(x.needDate)).length;
  const overdueMilestones=milestones.filter(x=>x.status!=="DONE"&&isLate(x.dueDate)).length;
  const handoverDone=handoverProgress(handover);

  c.innerHTML=`
    <div class="page-head">
      <div>
        <h2>Quản lý triển khai</h2>
        <p>Trúng thầu → bàn giao → hồ sơ kỹ thuật → vật tư/mua hàng → thi công → nghiệm thu → hoàn thành.</p>
      </div>
      ${selectedProjectId&&can("executionEdit")?`<div class="actions">
        <button class="btn" id="editExecutionBtn">Cập nhật tổng quan</button>
        <button class="btn primary" id="createExecTemplateBtn">⚡ Tạo bộ mốc triển khai</button>
      </div>`:""}
    </div>

    <div class="toolbar">
      <select id="executionProjectSelect" style="min-width:360px">
        <option value="">-- Chọn dự án triển khai --</option>
        ${projects.map(x=>`<option value="${x.id}" ${x.id===selectedProjectId?"selected":""}>${esc(x.code||"")} - ${esc(x.name||"")}</option>`).join("")}
      </select>
      ${selectedProjectId?`<span class="badge blue">${esc(execInfo(e.status).label)}</span>`:""}
    </div>

    ${selectedProjectId?`
      <div class="grid g6">
        ${metric("Tiến độ tổng",`${Number(e.progress||0)}%`,"↗","#2563eb","#eff6ff",esc(e.pmName||"Chưa giao PM"))}
        ${metric("Bàn giao Tender",`${handoverDone}%`,"⇄","#7c3aed","#f5f3ff",handoverDone===100?"Đã đủ checklist":"Còn nội dung cần bàn giao")}
        ${metric("Hồ sơ kỹ thuật",docs.length,"▧","#0284c7","#ecfeff",`${overdueDocs} hồ sơ quá hạn`)}
        ${metric("Vật tư / PO",procurement.length,"▣","#d97706","#fff7ed",`${overdueProc} hạng mục trễ`)}
        ${metric("Mốc hiện trường",milestones.length,"◆","#16a34a","#f0fdf4",`${overdueMilestones} mốc quá hạn`)}
        ${metric("Ngày mục tiêu",fmtDate(e.targetDate),"◷","#64748b","#f8fafc",daysLabel(e.targetDate,e.status==="CLOSED"))}
      </div>

      <div class="subtabs mt">
        ${[
          ["OVERVIEW","Tổng quan"],
          ["HANDOVER","Bàn giao Tender → Kỹ thuật"],
          ["DOCS","Hồ sơ kỹ thuật"],
          ["PROCUREMENT","Vật tư & Mua hàng"],
          ["QUANTITY","Kiểm soát khối lượng"],
          ["SITE","Thi công & Nghiệm thu"]
        ].map(x=>`<button class="subtab ${tab===x[0]?"active":""}" data-exec-tab="${x[0]}">${x[1]}</button>`).join("")}
      </div>

      <div id="executionTabBody">
        ${tab==="OVERVIEW"?overviewHtml(p,e):
          tab==="HANDOVER"?handoverHtml(p,e):
          tab==="DOCS"?docsHtml(p):
          tab==="PROCUREMENT"?procurementHtml(p):
          tab==="QUANTITY"?`<div id="quantityControlMount">${loading()}</div>`:
          siteHtml(p)}
      </div>
    `:empty("Chưa có dự án triển khai","Ở Pipeline đấu thầu, chuyển dự án sang Trúng thầu rồi bấm Bàn giao.","▤")}
  `;

  bind(c);
}

function bind(c){
  c.querySelector("#executionProjectSelect")?.addEventListener("change",async e=>{
    selectedProjectId=e.target.value;tab="OVERVIEW";c.innerHTML=loading();await loadProjectData();paint(c);
  });
  c.querySelectorAll("[data-exec-tab]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.execTab;paint(c)}));
  c.querySelector("#editExecutionBtn")?.addEventListener("click",()=>editExecution(c));
  c.querySelector("#createExecTemplateBtn")?.addEventListener("click",()=>createExecutionTemplate(c));

  c.querySelector("#saveHandoverBtn")?.addEventListener("click",()=>saveHandover(c));
  c.querySelector("#addDocBtn")?.addEventListener("click",()=>editDoc(null,c));
  c.querySelectorAll("[data-doc-edit]").forEach(b=>b.addEventListener("click",()=>editDoc(b.dataset.docEdit,c)));
  c.querySelectorAll("[data-doc-del]").forEach(b=>b.addEventListener("click",()=>deleteDoc(b.dataset.docDel,c)));
  c.querySelectorAll("[data-doc-status]").forEach(b=>b.addEventListener("click",()=>quickDocStatus(b.dataset.docStatus,b.dataset.status,c)));

  c.querySelector("#addProcBtn")?.addEventListener("click",()=>editProc(null,c));
  c.querySelectorAll("[data-proc-edit]").forEach(b=>b.addEventListener("click",()=>editProc(b.dataset.procEdit,c)));
  c.querySelectorAll("[data-proc-del]").forEach(b=>b.addEventListener("click",()=>deleteProc(b.dataset.procDel,c)));

  c.querySelector("#addMilestoneBtn")?.addEventListener("click",()=>editMilestone(null,c));
  c.querySelectorAll("[data-mile-edit]").forEach(b=>b.addEventListener("click",()=>editMilestone(b.dataset.mileEdit,c)));
  c.querySelectorAll("[data-mile-del]").forEach(b=>b.addEventListener("click",()=>deleteMilestone(b.dataset.mileDel,c)));
  c.querySelectorAll("[data-mile-status]").forEach(b=>b.addEventListener("click",()=>quickMilestoneStatus(b.dataset.mileStatus,b.dataset.status,c)));

  if(tab==="QUANTITY"){
    renderQuantityControl(c.querySelector("#quantityControlMount"),selectedProjectId);
  }
}

function overviewHtml(p,e){
  const current=execInfo(e.status);
  const approvedDocs=docs.filter(x=>x.status==="APPROVED").length;
  const delivered=procurement.filter(x=>x.status==="DELIVERED").length;
  const doneMiles=milestones.filter(x=>x.status==="DONE").length;

  return `<div class="grid g2">
    <div class="card">
      <div class="card-head"><h3>Thông tin dự án</h3>${badge(current.label,e.status==="CLOSED"?"green":"purple")}</div>
      <div class="card-body exec-summary">
        <div class="summary-row"><span>Mã dự án</span><b>${esc(p.code||"—")}</b></div>
        <div class="summary-row"><span>Dự án</span><b>${esc(p.name||"—")}</b></div>
        <div class="summary-row"><span>Khách hàng</span><b>${esc(p.client||"—")}</b></div>
        <div class="summary-row"><span>PM / Kỹ sư phụ trách</span><b>${esc(e.pmName||"Chưa giao")}</b></div>
        <div class="summary-row"><span>Kickoff</span><b>${fmtDate(e.kickoffDate)}</b></div>
        <div class="summary-row"><span>Ngày mục tiêu</span><b>${fmtDate(e.targetDate)}</b></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Sức khỏe triển khai</h3></div>
      <div class="card-body">
        ${healthLine("Bàn giao Tender",handoverProgress(handover),100)}
        ${healthLine("Hồ sơ được duyệt",approvedDocs,docs.length)}
        ${healthLine("Vật tư đã về",delivered,procurement.length)}
        ${healthLine("Mốc hiện trường hoàn thành",doneMiles,milestones.length)}
        <div class="divider"></div>
        <div class="progress-label"><span>Tiến độ tổng dự án</span><b>${Number(e.progress||0)}%</b></div>
        <div class="progress"><div class="bar" style="width:${Number(e.progress||0)}%"></div></div>
      </div>
    </div>
  </div>

  <div class="grid g3 mt">
    ${alertCard("Hồ sơ kỹ thuật",docs.filter(x=>x.status!=="APPROVED"&&isLate(x.dueDate)),"dueDate","Không có hồ sơ quá hạn")}
    ${alertCard("Vật tư cần về",procurement.filter(x=>x.status!=="DELIVERED"&&isLate(x.needDate)),"needDate","Không có vật tư trễ")}
    ${alertCard("Mốc thi công",milestones.filter(x=>x.status!=="DONE"&&isLate(x.dueDate)),"dueDate","Không có mốc quá hạn")}
  </div>

  ${e.notes?`<div class="card mt"><div class="card-head"><h3>Vướng mắc / Ghi chú chính</h3></div><div class="card-body prewrap">${esc(e.notes)}</div></div>`:""}
  `;
}

function handoverHtml(p,e){
  const fields=[
    ["contractScope","Phạm vi hợp đồng / Scope đã chốt"],
    ["approvedBoq","BOQ / Giá trúng thầu"],
    ["tenderClarifications","Clarification / Exclusion khi đấu thầu"],
    ["vendorQuotes","Báo giá NCC / Nhà thầu phụ đã sử dụng"],
    ["designBasis","Cơ sở thiết kế / Spec / Tiêu chuẩn"],
    ["clientContacts","Thông tin liên hệ CĐT / TVGS / Tổng thầu"],
    ["scheduleRequirement","Yêu cầu tiến độ / Milestone hợp đồng"],
    ["commercialNotes","Điều kiện thương mại cần lưu ý"]
  ];
  return `<div class="card">
    <div class="card-head">
      <div><h3>Checklist bàn giao Tender → Kỹ thuật</h3><div class="secondary-text">${handoverProgress(handover)}% hoàn tất</div></div>
      ${can("executionHandover")?`<button class="btn primary" id="saveHandoverBtn">Lưu bàn giao</button>`:""}
    </div>
    <div class="card-body">
      <div class="handover-banner">
        Mục tiêu: phòng kỹ thuật nhận đủ phạm vi, giá trúng, exclusion, nguồn giá và yêu cầu hợp đồng trước khi triển khai.
      </div>
      <div class="handover-grid">
        ${fields.map(([key,label])=>`<label class="handover-item ${handover[key]?"done":""}">
          <input type="checkbox" data-handover-key="${key}" ${handover[key]?"checked":""} ${can("executionHandover")?"":"disabled"}>
          <span><b>${label}</b><small>${handover[key]?"Đã bàn giao":"Chưa xác nhận"}</small></span>
        </label>`).join("")}
      </div>

      <div class="form-grid mt">
        <label class="field"><span>Người bàn giao</span><input id="handoverFrom" value="${esc(handover.fromName||"")}" ${can("executionHandover")?"":"disabled"}></label>
        <label class="field"><span>Người nhận bàn giao</span><input id="handoverTo" value="${esc(handover.toName||e.pmName||"")}" ${can("executionHandover")?"":"disabled"}></label>
        <label class="field"><span>Ngày bàn giao</span><input type="date" id="handoverDate" value="${esc(handover.handoverDate||"")}" ${can("executionHandover")?"":"disabled"}></label>
        <label class="field"><span>Link thư mục hồ sơ chung</span><input id="handoverFolder" value="${esc(handover.folderUrl||"")}" placeholder="https://..." ${can("executionHandover")?"":"disabled"}></label>
        <label class="field span2"><span>Ghi chú bàn giao</span><textarea id="handoverNotes" ${can("executionHandover")?"":"disabled"}>${esc(handover.notes||"")}</textarea></label>
      </div>
    </div>
  </div>`;
}

function docsHtml(p){
  const overdue=docs.filter(x=>x.status!=="APPROVED"&&isLate(x.dueDate)).length;
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">Hồ sơ kỹ thuật</h2><p>Shopdrawing, Material Submission, RFI, biện pháp thi công và trạng thái phê duyệt.</p></div>
    ${can("executionDocsEdit")?`<button class="btn primary" id="addDocBtn">＋ Thêm hồ sơ</button>`:""}
  </div>
  <div class="grid g4" style="margin-bottom:12px">
    ${smallMetric("Tổng hồ sơ",docs.length)}
    ${smallMetric("Đã trình",docs.filter(x=>x.status==="SUBMITTED").length)}
    ${smallMetric("Đã duyệt",docs.filter(x=>x.status==="APPROVED").length)}
    ${smallMetric("Quá hạn",overdue,overdue?"red":"green")}
  </div>
  <div class="table-wrap"><table class="table execution-doc-table"><thead><tr>
    <th>MÃ</th><th>LOẠI</th><th>HỆ</th><th>TÊN HỒ SƠ</th><th>PHỤ TRÁCH</th><th>DEADLINE</th><th>NGÀY TRÌNH</th><th>REV</th><th>TRẠNG THÁI</th><th>GHI CHÚ</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${docs.length?docs.map(docRow).join(""):`<tr><td colspan="11">${empty("Chưa có hồ sơ kỹ thuật","Thêm Shopdrawing/Material Submission đầu tiên để theo dõi.","▧")}</td></tr>`}
  </tbody></table></div>`;
}

function docRow(x){
  const st=docStatus(x.status),late=x.status!=="APPROVED"&&isLate(x.dueDate);
  return `<tr class="${late?"overdue-row":""}">
    <td><b>${esc(x.code||"—")}</b></td><td>${esc(docType(x.type))}</td><td>${badge(x.discipline||"KHÁC","gray")}</td>
    <td><div class="primary-text">${esc(x.title||"—")}</div><div class="secondary-text">${esc(x.description||"")}</div></td>
    <td>${esc(x.ownerName||"—")}</td>
    <td class="${late?"danger-text":""}">${fmtDate(x.dueDate)}</td><td>${fmtDate(x.submittedDate)}</td>
    <td>${esc(x.revision||"R0")}</td><td>${badge(st.label,st.color)}</td><td>${esc(x.notes||"—")}</td>
    <td><div class="row-actions">
      ${can("executionDocsEdit")&&x.status==="DRAFT"?`<button class="btn soft sm" data-doc-status="${x.id}" data-status="SUBMITTED">Đã trình</button>`:""}
      ${can("executionDocsEdit")&&x.status==="SUBMITTED"?`<button class="btn green sm" data-doc-status="${x.id}" data-status="APPROVED">Duyệt</button><button class="btn orange sm" data-doc-status="${x.id}" data-status="REVISION">Sửa</button>`:""}
      ${can("executionDocsEdit")?`<button class="btn sm" data-doc-edit="${x.id}">Sửa</button><button class="btn red sm" data-doc-del="${x.id}">Xóa</button>`:""}
    </div></td>
  </tr>`;
}

function procurementHtml(p){
  const total=procurement.reduce((s,x)=>s+Number(x.amount||0),0);
  const delivered=procurement.filter(x=>x.status==="DELIVERED").length;
  const late=procurement.filter(x=>x.status!=="DELIVERED"&&isLate(x.needDate)).length;
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">Vật tư & Mua hàng</h2><p>Theo dõi nhu cầu vật tư, PO, NCC, ngày cần và tình trạng giao hàng.</p></div>
    ${can("procurementEdit")?`<button class="btn primary" id="addProcBtn">＋ Thêm vật tư / PO</button>`:""}
  </div>
  <div class="grid g4" style="margin-bottom:12px">
    ${smallMetric("Hạng mục",procurement.length)}
    ${smallMetric("Đã về",delivered)}
    ${smallMetric("Trễ ngày cần",late,late?"red":"green")}
    ${smallMetric("Giá trị theo dõi",formatCompact(total))}
  </div>
  <div class="table-wrap"><table class="table execution-proc-table"><thead><tr>
    <th>HẠNG MỤC</th><th>HỆ</th><th>NHÀ CUNG CẤP</th><th>SỐ PO</th><th>GIÁ TRỊ</th><th>NGÀY CẦN</th><th>NGÀY PO</th><th>DỰ KIẾN GIAO</th><th>TRẠNG THÁI</th><th>GHI CHÚ</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${procurement.length?procurement.map(procRow).join(""):`<tr><td colspan="11">${empty("Chưa có dữ liệu vật tư","Thêm vật tư/PO đầu tiên để kiểm soát ngày cần hàng.","▣")}</td></tr>`}
  </tbody></table></div>`;
}

function procRow(x){
  const st=procStatus(x.status),late=x.status!=="DELIVERED"&&isLate(x.needDate);
  return `<tr class="${late?"overdue-row":""}">
    <td><div class="primary-text">${esc(x.item||"—")}</div><div class="secondary-text">${esc(x.specification||"")}</div></td>
    <td>${badge(x.discipline||"KHÁC","gray")}</td><td>${esc(x.supplier||"—")}</td><td>${esc(x.poNo||"—")}</td>
    <td>${formatMoney(x.amount)}</td><td class="${late?"danger-text":""}">${fmtDate(x.needDate)}</td><td>${fmtDate(x.poDate)}</td><td>${fmtDate(x.deliveryDate)}</td>
    <td>${badge(st.label,st.color)}</td><td>${esc(x.notes||"—")}</td>
    <td><div class="row-actions">${can("procurementEdit")?`<button class="btn sm" data-proc-edit="${x.id}">Sửa</button><button class="btn red sm" data-proc-del="${x.id}">Xóa</button>`:""}</div></td>
  </tr>`;
}

function siteHtml(p){
  const late=milestones.filter(x=>x.status!=="DONE"&&isLate(x.dueDate)).length;
  const avg=milestones.length?Math.round(milestones.reduce((s,x)=>s+Number(x.progress||0),0)/milestones.length):0;
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">Thi công & Nghiệm thu</h2><p>Mốc hiện trường, tiến độ, nghiệm thu và các vướng mắc chính.</p></div>
    ${can("milestoneEdit")?`<button class="btn primary" id="addMilestoneBtn">＋ Thêm mốc</button>`:""}
  </div>
  <div class="grid g4" style="margin-bottom:12px">
    ${smallMetric("Tổng mốc",milestones.length)}
    ${smallMetric("Đang làm",milestones.filter(x=>x.status==="DOING").length)}
    ${smallMetric("Tiến độ TB",`${avg}%`)}
    ${smallMetric("Quá hạn",late,late?"red":"green")}
  </div>
  <div class="table-wrap"><table class="table execution-site-table"><thead><tr>
    <th>MỐC / CÔNG VIỆC</th><th>NHÓM</th><th>PHỤ TRÁCH</th><th>BẮT ĐẦU</th><th>DEADLINE</th><th>TIẾN ĐỘ</th><th>TRẠNG THÁI</th><th>VƯỚNG MẮC</th><th>NGHIỆM THU</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${milestones.length?milestones.map(mileRow).join(""):`<tr><td colspan="10">${empty("Chưa có mốc triển khai","Tạo bộ mốc triển khai hoặc thêm mốc thủ công.","◆")}</td></tr>`}
  </tbody></table></div>`;
}

function mileRow(x){
  const st=mileStatus(x.status),late=x.status!=="DONE"&&isLate(x.dueDate);
  return `<tr class="${late?"overdue-row":""}">
    <td><div class="primary-text">${esc(x.title||"—")}</div><div class="secondary-text">${esc(x.description||"")}</div></td>
    <td>${esc(x.category||"Thi công")}</td><td>${esc(x.ownerName||"—")}</td><td>${fmtDate(x.startDate)}</td><td class="${late?"danger-text":""}">${fmtDate(x.dueDate)}</td>
    <td><div class="progress-label"><span>${Number(x.progress||0)}%</span></div><div class="progress" style="min-width:100px"><div class="bar ${x.status==="DONE"?"bar-green":x.status==="BLOCKED"?"bar-warning":""}" style="width:${Number(x.progress||0)}%"></div></div></td>
    <td>${badge(st.label,st.color)}</td><td>${esc(x.blocker||"—")}</td><td>${esc(x.inspection||"—")}</td>
    <td><div class="row-actions">
      ${can("milestoneEdit")&&x.status==="TODO"?`<button class="btn soft sm" data-mile-status="${x.id}" data-status="DOING">Bắt đầu</button>`:""}
      ${can("milestoneEdit")&&x.status!=="DONE"?`<button class="btn green sm" data-mile-status="${x.id}" data-status="DONE">Hoàn thành</button>`:""}
      ${can("milestoneEdit")?`<button class="btn sm" data-mile-edit="${x.id}">Sửa</button><button class="btn red sm" data-mile-del="${x.id}">Xóa</button>`:""}
    </div></td>
  </tr>`;
}

function editExecution(c){
  const p=projects.find(x=>x.id===selectedProjectId),e=executions.find(x=>x.id===selectedProjectId)||{};
  modal({
    title:`Cập nhật triển khai · ${p?.code||""}`,eyebrow:"PHÒNG KỸ THUẬT / PM",size:"lg",
    body:`<div class="form-grid">
      <label class="field"><span>PM / Kỹ sư phụ trách</span><input name="pmName" value="${esc(e.pmName||"")}"></label>
      <label class="field"><span>Trạng thái</span><select name="status">${EXEC_STAGES.map(s=>`<option value="${s[0]}" ${e.status===s[0]?"selected":""}>${s[1]}</option>`).join("")}</select></label>
      <label class="field"><span>Ngày Kickoff</span><input type="date" name="kickoffDate" value="${esc(e.kickoffDate||"")}"></label>
      <label class="field"><span>Ngày mục tiêu</span><input type="date" name="targetDate" value="${esc(e.targetDate||"")}"></label>
      <label class="field span2"><span>% tiến độ tổng</span><input type="number" min="0" max="100" name="progress" value="${Number(e.progress||0)}"></label>
      <label class="field span2"><span>Công việc / Vướng mắc chính</span><textarea name="notes">${esc(e.notes||"")}</textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.progress=Math.max(0,Math.min(100,Number(d.progress||0)));d.projectId=selectedProjectId;d.updatedAt=ts();if(!e.createdAt)d.createdAt=ts();
      await refs.executionProject(selectedProjectId).update(d);
      if(d.status==="CLOSED")await refs.project(selectedProjectId).update({phase:"CLOSED",updatedAt:ts()});
      await logActivity("EXECUTION_UPDATED",`Cập nhật triển khai ${p?.code||""}: ${execInfo(d.status).label}`,{projectId:selectedProjectId});
      toast("Đã cập nhật triển khai.");await refresh(c);return true;
    }
  });
}

async function saveHandover(c){
  const checklist={};
  document.querySelectorAll("[data-handover-key]").forEach(x=>checklist[x.dataset.handoverKey]=x.checked);
  const d={
    ...checklist,
    fromName:document.querySelector("#handoverFrom")?.value||"",
    toName:document.querySelector("#handoverTo")?.value||"",
    handoverDate:document.querySelector("#handoverDate")?.value||"",
    folderUrl:document.querySelector("#handoverFolder")?.value||"",
    notes:document.querySelector("#handoverNotes")?.value||"",
    updatedAt:ts()
  };
  if(!handover.createdAt)d.createdAt=ts();
  await refs.handover(selectedProjectId).update(d);
  await logActivity("HANDOVER_UPDATED",`Cập nhật checklist bàn giao Tender → Kỹ thuật (${handoverProgress(d)}%)`,{projectId:selectedProjectId});
  toast("Đã lưu checklist bàn giao.");await refresh(c);
}

function editDoc(id,c){
  const x=docs.find(d=>d.id===id)||{};
  modal({
    title:id?"Cập nhật hồ sơ kỹ thuật":"Thêm hồ sơ kỹ thuật",eyebrow:"SHOPDRAWING / MATERIAL / RFI",size:"lg",
    body:`<div class="form-grid">
      <label class="field"><span>Mã hồ sơ *</span><input required name="code" value="${esc(x.code||suggestCode("DOC",docs.length+1))}"></label>
      <label class="field"><span>Loại hồ sơ</span><select name="type">${DOC_TYPES.map(v=>`<option value="${v[0]}" ${x.type===v[0]?"selected":""}>${v[1]}</option>`).join("")}</select></label>
      <label class="field"><span>Hệ thống</span><select name="discipline">${DISCIPLINES.map(v=>`<option value="${v}" ${x.discipline===v?"selected":""}>${v}</option>`).join("")}</select></label>
      <label class="field"><span>Revision</span><input name="revision" value="${esc(x.revision||"R0")}"></label>
      <label class="field span2"><span>Tên hồ sơ *</span><input required name="title" value="${esc(x.title||"")}"></label>
      <label class="field"><span>Người phụ trách</span><input name="ownerName" value="${esc(x.ownerName||"")}"></label>
      <label class="field"><span>Deadline</span><input type="date" name="dueDate" value="${esc(x.dueDate||"")}"></label>
      <label class="field"><span>Ngày trình</span><input type="date" name="submittedDate" value="${esc(x.submittedDate||"")}"></label>
      <label class="field"><span>Trạng thái</span><select name="status">${DOC_STATUSES.map(v=>`<option value="${v[0]}" ${(x.status||"DRAFT")===v[0]?"selected":""}>${v[1]}</option>`).join("")}</select></label>
      <label class="field span2"><span>Mô tả</span><textarea name="description">${esc(x.description||"")}</textarea></label>
      <label class="field span2"><span>Ghi chú / Comment</span><textarea name="notes">${esc(x.notes||"")}</textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.updatedAt=ts();
      if(id)await refs.executionDoc(selectedProjectId,id).update(d);
      else{const key=refs.executionDocsProject(selectedProjectId).push().key;d.createdAt=ts();await refs.executionDoc(selectedProjectId,key).set(d)}
      await logActivity("EXEC_DOC_SAVED",`${id?"Cập nhật":"Thêm"} hồ sơ ${d.code} - ${d.title}`,{projectId:selectedProjectId});
      toast("Đã lưu hồ sơ kỹ thuật.");await refresh(c);return true;
    }
  });
}

async function quickDocStatus(id,status,c){
  const x=docs.find(d=>d.id===id);if(!x)return;
  const patch={status,updatedAt:ts()};
  if(status==="SUBMITTED"&&!x.submittedDate)patch.submittedDate=todayIso();
  await refs.executionDoc(selectedProjectId,id).update(patch);
  await logActivity("EXEC_DOC_STATUS",`${x.code} → ${docStatus(status).label}`,{projectId:selectedProjectId});
  toast("Đã cập nhật trạng thái hồ sơ.");await refresh(c);
}

async function deleteDoc(id,c){
  const x=docs.find(d=>d.id===id);
  if(!await confirmBox("Xóa hồ sơ",`Xóa ${x?.code||""} - ${x?.title||""}?`,"Xóa"))return;
  await refs.executionDoc(selectedProjectId,id).remove();toast("Đã xóa hồ sơ.","warning");await refresh(c);
}

function editProc(id,c){
  const x=procurement.find(d=>d.id===id)||{};
  modal({
    title:id?"Cập nhật vật tư / PO":"Thêm vật tư / PO",eyebrow:"PROCUREMENT",size:"lg",
    body:`<div class="form-grid">
      <label class="field span2"><span>Hạng mục vật tư *</span><input required name="item" value="${esc(x.item||"")}"></label>
      <label class="field"><span>Hệ thống</span><select name="discipline">${DISCIPLINES.map(v=>`<option value="${v}" ${x.discipline===v?"selected":""}>${v}</option>`).join("")}</select></label>
      <label class="field"><span>Nhà cung cấp</span><input name="supplier" value="${esc(x.supplier||"")}"></label>
      <label class="field"><span>Số PO</span><input name="poNo" value="${esc(x.poNo||"")}"></label>
      <label class="field"><span>Giá trị</span><input type="number" min="0" name="amount" value="${Number(x.amount||0)}"></label>
      <label class="field"><span>Ngày cần tại công trường *</span><input required type="date" name="needDate" value="${esc(x.needDate||"")}"></label>
      <label class="field"><span>Ngày phát hành PO</span><input type="date" name="poDate" value="${esc(x.poDate||"")}"></label>
      <label class="field"><span>Ngày dự kiến giao</span><input type="date" name="deliveryDate" value="${esc(x.deliveryDate||"")}"></label>
      <label class="field"><span>Trạng thái</span><select name="status">${PROC_STATUSES.map(v=>`<option value="${v[0]}" ${(x.status||"PLANNED")===v[0]?"selected":""}>${v[1]}</option>`).join("")}</select></label>
      <label class="field span2"><span>Thông số / Model</span><input name="specification" value="${esc(x.specification||"")}"></label>
      <label class="field span2"><span>Ghi chú</span><textarea name="notes">${esc(x.notes||"")}</textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.amount=Number(d.amount||0);d.updatedAt=ts();
      if(id)await refs.procurementItem(selectedProjectId,id).update(d);
      else{const key=refs.procurementProject(selectedProjectId).push().key;d.createdAt=ts();await refs.procurementItem(selectedProjectId,key).set(d)}
      await logActivity("PROCUREMENT_SAVED",`${id?"Cập nhật":"Thêm"} vật tư ${d.item}`,{projectId:selectedProjectId});
      toast("Đã lưu vật tư / PO.");await refresh(c);return true;
    }
  });
}

async function deleteProc(id,c){
  const x=procurement.find(d=>d.id===id);
  if(!await confirmBox("Xóa vật tư / PO",`Xóa hạng mục "${x?.item||""}"?`,"Xóa"))return;
  await refs.procurementItem(selectedProjectId,id).remove();toast("Đã xóa vật tư / PO.","warning");await refresh(c);
}

function editMilestone(id,c){
  const x=milestones.find(d=>d.id===id)||{};
  modal({
    title:id?"Cập nhật mốc hiện trường":"Thêm mốc hiện trường",eyebrow:"THI CÔNG / NGHIỆM THU",size:"lg",
    body:`<div class="form-grid">
      <label class="field span2"><span>Tên mốc / Công việc *</span><input required name="title" value="${esc(x.title||"")}"></label>
      <label class="field"><span>Nhóm</span><select name="category">${["Shopdrawing","Vật tư","Thi công","Nghiệm thu","Bàn giao","Khác"].map(v=>`<option value="${v}" ${x.category===v?"selected":""}>${v}</option>`).join("")}</select></label>
      <label class="field"><span>Người phụ trách</span><input name="ownerName" value="${esc(x.ownerName||"")}"></label>
      <label class="field"><span>Ngày bắt đầu</span><input type="date" name="startDate" value="${esc(x.startDate||todayIso())}"></label>
      <label class="field"><span>Deadline *</span><input required type="date" name="dueDate" value="${esc(x.dueDate||"")}"></label>
      <label class="field"><span>Tiến độ %</span><input type="number" min="0" max="100" name="progress" value="${Number(x.progress||0)}"></label>
      <label class="field"><span>Trạng thái</span><select name="status">${MILESTONE_STATUSES.map(v=>`<option value="${v[0]}" ${(x.status||"TODO")===v[0]?"selected":""}>${v[1]}</option>`).join("")}</select></label>
      <label class="field span2"><span>Mô tả</span><textarea name="description">${esc(x.description||"")}</textarea></label>
      <label class="field span2"><span>Vướng mắc</span><textarea name="blocker">${esc(x.blocker||"")}</textarea></label>
      <label class="field span2"><span>Kết quả nghiệm thu / Biên bản</span><input name="inspection" value="${esc(x.inspection||"")}"></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.progress=Math.max(0,Math.min(100,Number(d.progress||0)));
      if(d.status==="DONE")d.progress=100;if(d.status==="TODO"&&d.progress>0)d.status="DOING";d.updatedAt=ts();
      if(id)await refs.milestone(selectedProjectId,id).update(d);
      else{const key=refs.milestonesProject(selectedProjectId).push().key;d.createdAt=ts();await refs.milestone(selectedProjectId,key).set(d)}
      await logActivity("EXEC_MILESTONE_SAVED",`${id?"Cập nhật":"Thêm"} mốc ${d.title}`,{projectId:selectedProjectId});
      toast("Đã lưu mốc hiện trường.");await refresh(c);return true;
    }
  });
}

async function quickMilestoneStatus(id,status,c){
  const x=milestones.find(d=>d.id===id);if(!x)return;
  const patch={status,updatedAt:ts()};if(status==="DONE")patch.progress=100;if(status==="DOING"&&Number(x.progress||0)===0)patch.progress=10;
  await refs.milestone(selectedProjectId,id).update(patch);
  await logActivity("EXEC_MILESTONE_STATUS",`${x.title} → ${mileStatus(status).label}`,{projectId:selectedProjectId});
  toast("Đã cập nhật mốc.");await refresh(c);
}

async function deleteMilestone(id,c){
  const x=milestones.find(d=>d.id===id);
  if(!await confirmBox("Xóa mốc",`Xóa mốc "${x?.title||""}"?`,"Xóa"))return;
  await refs.milestone(selectedProjectId,id).remove();toast("Đã xóa mốc.","warning");await refresh(c);
}

async function createExecutionTemplate(c){
  const p=projects.find(x=>x.id===selectedProjectId),e=executions.find(x=>x.id===selectedProjectId)||{};
  if(milestones.length){
    if(!await confirmBox("Tạo bộ mốc triển khai",`Dự án đã có ${milestones.length} mốc. Vẫn tạo thêm bộ mốc chuẩn?`,"Tạo thêm"))return;
  }
  const start=e.kickoffDate?new Date(`${e.kickoffDate}T00:00:00`):new Date();
  const target=e.targetDate?new Date(`${e.targetDate}T00:00:00`):new Date(start.getTime()+120*86400000);
  const total=Math.max(30,Math.round((target-start)/86400000));
  const defs=[
    ["Kickoff & nhận bàn giao","Bàn giao",0.05],
    ["Hoàn thiện Shopdrawing chính","Shopdrawing",0.20],
    ["Duyệt Material Submission chính","Vật tư",0.30],
    ["Phát hành PO vật tư dài hạn","Vật tư",0.35],
    ["Triển khai thi công MEP","Thi công",0.70],
    ["Nghiệm thu hệ thống","Nghiệm thu",0.88],
    ["Testing & Commissioning","Nghiệm thu",0.95],
    ["Bàn giao / Hoàn công","Bàn giao",1.00]
  ];
  const updates={};
  defs.forEach((d,i)=>{
    const key=refs.milestonesProject(selectedProjectId).push().key;
    const due=new Date(start.getTime()+Math.round(total*d[2])*86400000);
    updates[key]={
      title:d[0],category:d[1],ownerName:e.pmName||"",startDate:toIso(start),
      dueDate:toIso(due>target?target:due),progress:i===0?100:0,status:i===0?"DONE":"TODO",
      description:"Mốc chuẩn được tạo tự động từ workflow triển khai.",blocker:"",inspection:"",
      templateKey:`EXEC_${i+1}`,createdAt:Date.now(),updatedAt:Date.now()
    };
  });
  await refs.milestonesProject(selectedProjectId).update(updates);
  await logActivity("EXEC_TEMPLATE_CREATED",`Tạo bộ 8 mốc triển khai cho ${p?.code||""}`,{projectId:selectedProjectId});
  toast("Đã tạo 8 mốc triển khai chuẩn.");tab="SITE";await refresh(c);
}

async function refresh(c){
  [projects,executions]=await Promise.all([arr(refs.projects()),arr(refs.execution())]);
  projects=projects.filter(x=>x.phase==="EXECUTION");
  await loadProjectData();paint(c);
}

function alertCard(title,list,dateField,emptyText){
  return `<div class="card"><div class="card-head"><h3>${title}</h3>${list.length?badge(`${list.length} quá hạn`,"red"):badge("Ổn","green")}</div><div class="card-body">
    ${list.length?`<div class="list">${list.slice(0,5).map(x=>`<div class="list-item"><i class="list-dot" style="background:#dc2626"></i><div class="list-main"><b>${esc(x.title||x.item||x.code||"")}</b><span>${esc(x.ownerName||x.supplier||"")}</span></div><div class="list-side danger-text">${fmtDate(x[dateField])}</div></div>`).join("")}</div>`:empty("Không có cảnh báo",emptyText,"✓")}
  </div></div>`;
}
function healthLine(label,done,total){
  const pct=total?Math.round(done/total*100):0;
  return `<div class="health-line"><div><span>${label}</span><b>${total?`${done}/${total}`:"Chưa có dữ liệu"}</b></div><div class="progress"><div class="bar" style="width:${pct}%"></div></div></div>`;
}
function handoverProgress(h){
  const keys=["contractScope","approvedBoq","tenderClarifications","vendorQuotes","designBasis","clientContacts","scheduleRequirement","commercialNotes"];
  return Math.round(keys.filter(k=>!!h[k]).length/keys.length*100);
}
function smallMetric(label,value,color="blue"){return `<div class="mini-metric ${color}"><span>${label}</span><b>${value}</b></div>`}
function metric(label,value,icon,c,s,foot){return `<div class="metric" style="--c:${c};--s:${s}"><div class="metric-head"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></div>`}
function toArray(v){return Object.entries(v||{}).map(([id,x])=>({id,...(x||{})}))}
function sortDue(a,b){return String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999"))}
function sortNeedDate(a,b){return String(a.needDate||"9999").localeCompare(String(b.needDate||"9999"))}
function isLate(v){return !!v&&daysUntil(v)<0}
function daysLabel(v,closed=false){if(closed)return"Đã hoàn thành";if(!v)return"Chưa đặt ngày";const d=daysUntil(v);return d<0?`Trễ ${Math.abs(d)} ngày`:d===0?"Hôm nay":`Còn ${d} ngày`}
function docType(k){return DOC_TYPES.find(x=>x[0]===k)?.[1]||"Hồ sơ khác"}
function docStatus(k){const x=DOC_STATUSES.find(v=>v[0]===(k||"DRAFT"))||DOC_STATUSES[0];return{label:x[1],color:x[2]}}
function procStatus(k){const x=PROC_STATUSES.find(v=>v[0]===(k||"PLANNED"))||PROC_STATUSES[0];return{label:x[1],color:x[2]}}
function mileStatus(k){const x=MILESTONE_STATUSES.find(v=>v[0]===(k||"TODO"))||MILESTONE_STATUSES[0];return{label:x[1],color:x[2]}}
function suggestCode(prefix,n){return `${prefix}-${String(n).padStart(3,"0")}`}
function todayIso(){return toIso(new Date())}
function toIso(d){const x=new Date(d),off=x.getTimezoneOffset()*60000;return new Date(x-off).toISOString().slice(0,10)}
function formatMoney(v){return `${Number(v||0).toLocaleString("vi-VN")} ₫`}
function formatCompact(v){const n=Number(v||0);if(n>=1e9)return`${(n/1e9).toLocaleString("vi-VN",{maximumFractionDigits:1})} tỷ`;if(n>=1e6)return`${(n/1e6).toLocaleString("vi-VN",{maximumFractionDigits:1})} tr`;return n.toLocaleString("vi-VN")}
