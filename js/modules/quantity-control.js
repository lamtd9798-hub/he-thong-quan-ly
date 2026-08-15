import {
  refs,arr,ts,logActivity,getProfile,can,esc,norm,money,fmtDate,fmtDateTime,
  loading,empty,badge,modal,toast,confirmBox
} from "../core.js?v=2.8.0";

let projectId="";
let mountEl=null;
let baseline=[];
let baselineMeta={};
let requests=[];
let audits=[];
let variations=[];
let revisions=[];
let tenderRevision=null;
let activeRevision=null;
let view="SUMMARY";
let q="";

const COUNTED_STATUSES=new Set(["APPROVED","ORDERED"]);
const ORDER_STATUSES={
  DRAFT:["Nháp","gray"],
  PENDING:["Chờ duyệt","orange"],
  APPROVED:["Đã duyệt","green"],
  ORDERED:["Đã đặt hàng","purple"],
  CANCELLED:["Đã hủy","red"]
};
const REASONS=[
  ["DESIGN_CHANGE","Thay đổi thiết kế"],
  ["BOQ_MISSING","BOQ thiếu"],
  ["CLIENT_REQUEST","Khách hàng yêu cầu bổ sung"],
  ["SITE_CONDITION","Điều kiện thực tế công trường"],
  ["WASTE","Hao hụt thi công"],
  ["REWORK","Thi công sai / làm lại"],
  ["OTHER","Khác"]
];

export async function renderQuantityControl(el,selectedProjectId){
  mountEl=typeof el==="string"?document.querySelector(el):el;
  projectId=selectedProjectId||"";
  if(!mountEl)return;
  mountEl.innerHTML=loading();
  await loadData();
  paint();
}

async function loadData(){
  if(!projectId){baseline=[];baselineMeta={};requests=[];audits=[];variations=[];revisions=[];tenderRevision=null;activeRevision=null;return}
  const reads=[
    refs.quantityBaselineProject(projectId).once("value"),
    refs.quantityBaselineMeta(projectId).once("value"),
    refs.orderRequestsProject(projectId).once("value"),
    refs.quantityAuditProject(projectId).once("value"),
    refs.quantityBoqRevisionsProject(projectId).once("value")
  ];
  if(can("quantityVariationCreate"))reads.push(refs.variationsProject(projectId).once("value"));
  else reads.push(Promise.resolve({val:()=>({})}));

  const [b,m,r,a,rev,v]=await Promise.all(reads);
  baseline=toArray(b.val()).sort(itemSort);
  baselineMeta=m.val()||{};
  requests=toArray(r.val()).sort((x,y)=>String(y.requestDate||"").localeCompare(String(x.requestDate||""))||(y.createdAt||0)-(x.createdAt||0));
  audits=toArray(a.val()).sort((x,y)=>(y.createdAt||0)-(x.createdAt||0));
  revisions=toArray(rev.val()).sort(revisionSort);
  variations=toArray(v.val());

  tenderRevision=revisions.find(x=>x.id===baselineMeta.tenderRevisionId)||revisions.find(x=>x.revisionNo===0)||null;
  activeRevision=revisions.find(x=>x.id===baselineMeta.activeRevisionId)||revisions.find(x=>x.status==="ACTIVE")||null;

  if(baseline.length&&!revisions.length&&can("quantityRevisionActivate")){
    await migrateLegacyBaselineToR0();
  }
}

function paint(){
  if(!mountEl)return;
  if(!baseline.length){
    mountEl.innerHTML=baselineEmptyHtml();
    mountEl.querySelector("#initQuantityBaselineBtn")?.addEventListener("click",initializeBaseline);
    mountEl.querySelector("#uploadTenderR0Btn")?.addEventListener("click",()=>uploadRevisionDialog(true));
    return;
  }

  const rows=aggregateRows();
  const totals=summaryTotals(rows);
  const filtered=rows.filter(r=>!q||norm(`${r.itemNo} ${r.discipline} ${r.description} ${r.specification} ${r.unit}`).includes(norm(q)));

  mountEl.innerHTML=`
    <div class="quantity-head">
      <div>
        <h2>Kiểm soát khối lượng đặt hàng</h2>
        <p>Baseline BOQ trúng thầu → cộng dồn phiếu công trường → cảnh báo vượt → tính giá trị chênh và chi phí vượt.</p>
      </div>
      <div class="actions">
        <button class="btn" id="exportQtyCsvBtn">Xuất CSV</button>
        ${can("quantityRevisionManage")?`<button class="btn" id="uploadRevisionBtn">＋ Tải BOQ Revision</button>`:""}
        ${can("quantityRequestCreate")?`<button class="btn primary" id="newOrderRequestBtn">＋ Tạo phiếu đặt hàng</button>`:""}
      </div>
    </div>

    <div class="quantity-baseline-note">
      <div>
        <b>Baseline đang áp dụng: ${esc(activeRevision?.code||baselineMeta.activeRevisionCode||"R0")} · ${esc(activeRevision?.name||baselineMeta.activeRevisionName||"BOQ trúng thầu")}</b>
        <span>${baseline.length} đầu mục · hiệu lực ${fmtDate(activeRevision?.effectiveDate||baselineMeta.activeEffectiveDate)} · kích hoạt ${fmtDateTime(baselineMeta.activatedAt||baselineMeta.frozenAt)}</span>
      </div>
      <div class="baseline-badges">
        ${badge(`Tender: ${tenderRevision?.code||"R0"}`,"blue")}
        ${badge(`${revisions.length} phiên bản BOQ`,"gray")}
      </div>
    </div>

    <div class="grid g6 mt">
      ${metric("Baseline hiện hành",money(totals.baselineValue,true),activeRevision?.code||"BOQ","#2563eb","#eff6ff",`${baseline.length} đầu mục`)}
      ${metric("Δ HĐ so Tender",signedMoney(totals.contractDeltaValue),"Δ",totals.contractDeltaValue>=0?"#7c3aed":"#16a34a",totals.contractDeltaValue>=0?"#f5f3ff":"#f0fdf4",`${totals.contractChangedCount} đầu mục thay đổi`)}
      ${metric("Giá trị đã đặt",money(totals.orderedValue,true),"ĐH","#7c3aed","#f5f3ff",`${totals.confirmedRequests} phiếu được tính`)}
      ${metric("Vượt do công trường",money(totals.excessBidValue,true),"!","#dc2626","#fef2f2",`${totals.overCount} đầu mục vượt/ngoài BOQ`)}
      ${metric("Chi phí vượt dự kiến",money(totals.excessCost,true),"C","#d97706","#fff7ed","Theo giá mua dự kiến")}
      ${metric("Gần hết BOQ",totals.nearCount,"⚠","#d97706","#fff7ed","Từ 90% đến 100%")}
    </div>

    <div class="quantity-toolbar mt">
      <div class="subtabs" style="margin:0">
        ${[
          ["SUMMARY","Tổng hợp BOQ"],
          ["REVISIONS","BOQ Revision"],
          ["REQUESTS","Phiếu đặt hàng"],
          ["OUTSIDE","Ngoài BOQ"],
          ["HISTORY","Lịch sử"]
        ].map(x=>`<button class="subtab ${view===x[0]?"active":""}" data-qty-view="${x[0]}">${x[1]}</button>`).join("")}
      </div>
      ${view==="SUMMARY"?`<div class="search"><input id="qtySearch" value="${esc(q)}" placeholder="Tìm mã BOQ, vật tư, hệ, thông số..."></div>`:""}
    </div>

    <div id="quantityViewBody">
      ${view==="SUMMARY"?summaryHtml(filtered):
        view==="REVISIONS"?revisionsHtml():
        view==="REQUESTS"?requestsHtml():
        view==="OUTSIDE"?outsideHtml(rows):
        historyHtml()}
    </div>
  `;

  bind();
}

function baselineEmptyHtml(){
  return `<div class="quantity-empty">
    ${empty("Chưa có BOQ Baseline","Cần tạo R0 từ BOQ trúng thầu trước. Sau đó mới tải R1/R2/R3 và chọn Revision áp dụng.","▦")}
    ${can("quantityBaselineCreate")?`<div class="baseline-empty-actions">
      <button class="btn primary" id="initQuantityBaselineBtn">Khởi tạo R0 từ BOQ hiện tại</button>
      <button class="btn" id="uploadTenderR0Btn">Tải BOQ R0 từ CSV</button>
      <div class="secondary-text">R0 là BOQ đấu thầu/trúng thầu gốc và được giữ vĩnh viễn để so sánh.</div>
    </div>`:""}
  </div>`;
}

function summaryHtml(rows){
  return `<div class="qty-info-strip">
    <b>Tách 2 loại chênh:</b> Δ HĐ = Baseline Revision hiện hành − Tender R0. 
    Vượt công trường = Tổng phiếu đã duyệt/đặt − Baseline hiện hành. Hai số này không cộng lẫn nhau.
  </div>
  <div class="table-wrap"><table class="table quantity-summary-table"><thead><tr>
    <th>MÃ BOQ</th><th>HỆ</th><th>VẬT TƯ / CÔNG VIỆC</th><th>ĐVT</th>
    <th>TENDER R0</th><th>BASELINE ${esc(activeRevision?.code||"HIỆN HÀNH")}</th><th>Δ HĐ</th>
    <th>ĐÃ DUYỆT/ĐẶT</th><th>CHỜ DUYỆT</th><th>CÒN LẠI</th><th>VƯỢT CT</th>
    <th>% SỬ DỤNG</th><th>GIÁ HĐ/ĐVT</th><th>GT Δ HĐ</th><th>GT VƯỢT CT</th>
    <th>CHI PHÍ VƯỢT</th><th>TRẠNG THÁI</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${rows.length?rows.map(summaryRow).join(""):`<tr><td colspan="18">${empty("Không có dữ liệu","Không có đầu mục phù hợp bộ lọc.","▦")}</td></tr>`}
  </tbody></table></div>`;
}

function summaryRow(r){
  const state=rowState(r);
  const remaining=r.baselineQty-r.confirmedQty;
  const siteExcess=Math.max(0,r.confirmedQty-r.baselineQty);
  const contractClass=r.contractDeltaQty>0?"danger-text":r.contractDeltaQty<0?"positive-text":"";
  return `<tr class="qty-row-${state.key.toLowerCase()}">
    <td><b>${esc(r.itemNo||"—")}</b>${r.lineStatus==="REMOVED"?`<div>${badge("Loại khỏi Revision","red")}</div>`:""}</td>
    <td>${badge(r.discipline||"KHÁC","gray")}</td>
    <td><div class="primary-text">${esc(r.description||"—")}</div><div class="secondary-text">${esc(r.specification||"")}</div></td>
    <td>${esc(r.unit||"—")}</td>
    <td>${num(r.tenderQty,3)}</td>
    <td><b>${num(r.baselineQty,3)}</b></td>
    <td class="${contractClass}"><b>${signedQty(r.contractDeltaQty)}</b></td>
    <td><b>${num(r.confirmedQty,3)}</b></td>
    <td>${r.pendingQty?`<span class="qty-pending">${num(r.pendingQty,3)}</span>`:"0"}</td>
    <td class="${remaining<0?"danger-text":""}">${num(remaining,3)}</td>
    <td class="${siteExcess>0?"danger-text":""}"><b>${siteExcess?`+${num(siteExcess,3)}`:"0"}</b></td>
    <td>${usageHtml(r)}</td>
    <td>${money(r.bidUnit)}</td>
    <td class="${r.contractDeltaValue>0?"danger-text":r.contractDeltaValue<0?"positive-text":""}"><b>${signedMoney(r.contractDeltaValue)}</b></td>
    <td class="${r.excessBidValue>0?"danger-text":""}"><b>${money(r.excessBidValue)}</b></td>
    <td class="${r.excessCost>0?"danger-text":""}"><b>${money(r.excessCost)}</b></td>
    <td>${badge(state.label,state.color)}</td>
    <td><div class="row-actions">
      <button class="btn sm" data-qty-history="${esc(r.key)}">Lịch sử</button>
      ${r.excessBidValue>0&&can("quantityVariationCreate")?`<button class="btn orange sm" data-qty-vo="${esc(r.key)}">Tạo VO</button>`:""}
    </div></td>
  </tr>`;
}

function usageHtml(r){
  const pctVal=r.baselineQty>0?r.confirmedQty/r.baselineQty*100:(r.confirmedQty>0?100:0);
  const cls=pctVal>100?"bar-danger":pctVal>=90?"bar-warning":"";
  return `<div class="qty-usage"><div><span>${num(pctVal,1)}%</span></div><div class="progress"><div class="bar ${cls}" style="width:${Math.min(100,pctVal)}%"></div></div></div>`;
}

function requestsHtml(){
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">Phiếu đặt hàng công trường</h2><p>Mỗi lần công trường đề nghị vật tư được lưu thành một phiếu riêng. Chỉ phiếu Đã duyệt/Đã đặt hàng mới cộng vào khối lượng kiểm soát.</p></div>
  </div>
  <div class="table-wrap"><table class="table quantity-request-table"><thead><tr>
    <th>PHIẾU</th><th>NGÀY</th><th>NGƯỜI ĐỀ NGHỊ</th><th>KHU VỰC</th><th>SỐ DÒNG</th><th>KL QUY ĐỔI</th><th>GIÁ TRỊ THEO BOQ</th><th>TRẠNG THÁI</th><th>GHI CHÚ</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${requests.length?requests.map(requestRow).join(""):`<tr><td colspan="10">${empty("Chưa có phiếu đặt hàng","Tạo phiếu đầu tiên khi công trường có nhu cầu đặt vật tư.","▣")}</td></tr>`}
  </tbody></table></div>`;
}

function requestRow(r){
  const st=statusInfo(r.status),lines=linesOf(r),qty=lines.reduce((s,l)=>s+Number(l.boqQty||0),0),value=lines.reduce((s,l)=>s+Number(l.boqQty||0)*Number(l.bidUnit||0),0);
  return `<tr>
    <td><b>${esc(r.code||"—")}</b></td><td>${fmtDate(r.requestDate)}</td>
    <td><div>${esc(r.requesterName||r.requesterEmail||"—")}</div><div class="secondary-text">${esc(r.department||"")}</div></td>
    <td>${esc(r.location||"—")}</td><td>${lines.length}</td><td>${num(qty,3)}</td><td>${money(value)}</td>
    <td>${badge(st.label,st.color)}</td><td>${esc(r.notes||"—")}</td>
    <td><div class="row-actions"><button class="btn sm" data-request-view="${r.id}">Chi tiết</button>${canEditRequest(r)?`<button class="btn sm" data-request-edit="${r.id}">Sửa phiếu</button>`:""}</div></td>
  </tr>`;
}

function outsideHtml(rows){
  const list=rows.filter(r=>r.isOutside);
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">Đầu mục ngoài BOQ</h2><p>Toàn bộ khối lượng ngoài Baseline được coi là phát sinh và cần có lý do/đề xuất xử lý thương mại.</p></div>
  </div>
  <div class="table-wrap"><table class="table quantity-outside-table"><thead><tr>
    <th>VẬT TƯ NGOÀI BOQ</th><th>HỆ</th><th>ĐVT</th><th>ĐÃ DUYỆT/ĐẶT</th><th>CHỜ DUYỆT</th><th>GIÁ CHÀO TB</th><th>GT PHÁT SINH</th><th>CHI PHÍ DỰ KIẾN</th><th>LÝ DO</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${list.length?list.map(r=>`<tr class="qty-row-red">
      <td><div class="primary-text">${esc(r.description)}</div><div class="secondary-text">${esc(r.specification||"")}</div></td>
      <td>${badge(r.discipline||"KHÁC","gray")}</td><td>${esc(r.unit||"—")}</td>
      <td class="danger-text"><b>${num(r.confirmedQty,3)}</b></td><td>${num(r.pendingQty,3)}</td>
      <td>${money(r.bidUnit)}</td><td class="danger-text"><b>${money(r.excessBidValue)}</b></td><td>${money(r.excessCost)}</td>
      <td>${esc(r.reasonLabel||"Ngoài BOQ")}</td>
      <td><div class="row-actions"><button class="btn sm" data-qty-history="${esc(r.key)}">Lịch sử</button>${r.excessBidValue>0&&can("quantityVariationCreate")?`<button class="btn orange sm" data-qty-vo="${esc(r.key)}">Tạo VO</button>`:""}</div></td>
    </tr>`).join(""):`<tr><td colspan="10">${empty("Chưa có đầu mục ngoài BOQ","Các vật tư không tồn tại trong Baseline sẽ xuất hiện ở đây.","✓")}</td></tr>`}
  </tbody></table></div>`;
}

function historyHtml(){
  return `<div class="card">
    <div class="card-head"><h3>Lịch sử kiểm soát khối lượng</h3><span class="secondary-text">${audits.length} sự kiện</span></div>
    <div class="card-body">
      ${audits.length?`<div class="quantity-audit-list">${audits.map(a=>`<div class="quantity-audit-item">
        <div class="audit-dot"></div>
        <div class="audit-main"><b>${esc(a.message||a.action||"Cập nhật")}</b><span>${esc(a.userName||a.userEmail||"")} · ${fmtDateTime(a.createdAt)}</span></div>
        <div>${a.requestCode?badge(a.requestCode,"blue"):""}</div>
      </div>`).join("")}</div>`:empty("Chưa có lịch sử","Các thao tác tạo phiếu, duyệt, đặt hàng và thay đổi đầu mục sẽ được lưu ở đây.","◉")}
    </div>
  </div>`;
}

function bind(){
  mountEl.querySelectorAll("[data-qty-view]").forEach(b=>b.addEventListener("click",()=>{view=b.dataset.qtyView;paint()}));
  mountEl.querySelector("#qtySearch")?.addEventListener("input",e=>{
    q=e.target.value;paint();requestAnimationFrame(()=>{const i=mountEl.querySelector("#qtySearch");i?.focus();i?.setSelectionRange(i.value.length,i.value.length)});
  });
  mountEl.querySelector("#newOrderRequestBtn")?.addEventListener("click",()=>editRequest(null));
  mountEl.querySelector("#uploadRevisionBtn")?.addEventListener("click",()=>uploadRevisionDialog(false));
  mountEl.querySelector("#uploadRevisionInlineBtn")?.addEventListener("click",()=>uploadRevisionDialog(false));
  mountEl.querySelector("#exportQtyCsvBtn")?.addEventListener("click",exportCsv);
  mountEl.querySelectorAll("[data-request-view]").forEach(b=>b.addEventListener("click",()=>viewRequest(b.dataset.requestView)));
  mountEl.querySelectorAll("[data-request-edit]").forEach(b=>b.addEventListener("click",()=>editRequest(b.dataset.requestEdit)));
  mountEl.querySelectorAll("[data-qty-history]").forEach(b=>b.addEventListener("click",()=>itemHistory(b.dataset.qtyHistory)));
  mountEl.querySelectorAll("[data-qty-vo]").forEach(b=>b.addEventListener("click",()=>createVariationFromRow(b.dataset.qtyVo)));
  mountEl.querySelectorAll("[data-revision-compare]").forEach(b=>b.addEventListener("click",()=>compareRevisionDialog(b.dataset.revisionCompare)));
  mountEl.querySelectorAll("[data-revision-activate]").forEach(b=>b.addEventListener("click",()=>activateRevision(b.dataset.revisionActivate)));
  mountEl.querySelectorAll("[data-revision-delete]").forEach(b=>b.addEventListener("click",()=>deleteDraftRevision(b.dataset.revisionDelete)));
}

async function initializeBaseline(){
  if(!can("quantityBaselineCreate"))return;
  const existing=await refs.quantityBaselineProject(projectId).once("value");
  if(existing.exists()){toast("Baseline đã tồn tại. Hãy quản lý bằng BOQ Revision.","warning");await reload();return}

  const boq=await arr(refs.boqProject(projectId));
  if(!boq.length){toast("Dự án chưa có BOQ để tạo R0.","error");return}
  if(!await confirmBox("Khóa Tender R0",`Khóa ${boq.length} đầu mục BOQ hiện tại thành R0 – BOQ đấu thầu/trúng thầu? R0 sẽ được giữ để so sánh vĩnh viễn.`,"Khóa R0"))return;

  const items={};
  let total=0;
  boq.forEach(x=>{
    const c=calcBoq(x);
    items[x.id]={
      sourceBoqId:x.id,itemNo:x.itemNo||"",discipline:x.discipline||"KHÁC",category:x.category||"",
      description:x.description||"",specification:x.specification||"",unit:x.unit||"",
      qty:Number(x.qty||0),materialUnit:Number(x.materialUnit||0),laborUnit:Number(x.laborUnit||0),
      subcontractUnit:Number(x.subcontractUnit||0),otherUnit:Number(x.otherUnit||0),
      wastePct:Number(x.wastePct||0),markupPct:Number(x.markupPct||0),
      netUnit:c.netUnit,bidUnit:c.bidUnit,selectedSupplier:x.selectedSupplier||"",brand:x.brand||"",
      lineStatus:"ACTIVE",createdAt:Date.now()
    };
    total+=Number(x.qty||0)*c.bidUnit;
  });

  const u=getProfile()||{};
  const revisionId=refs.quantityBoqRevisionsProject(projectId).push().key;
  const revision={
    code:"R0",revisionNo:0,name:"BOQ đấu thầu / Trúng thầu",type:"TENDER",effectiveDate:todayIso(),
    status:"ACTIVE",source:"CURRENT_BOQ",sourceFileName:"",lineCount:Object.keys(items).length,totalBidValue:total,
    createdAt:Date.now(),createdByUid:u.uid||"",createdByName:u.displayName||u.email||"",
    activatedAt:Date.now(),activatedByUid:u.uid||"",activatedByName:u.displayName||u.email||"",
    items
  };

  const meta={
    source:"BOQ_AT_EXECUTION",frozenAt:Date.now(),frozenByUid:u.uid||"",frozenByName:u.displayName||"",frozenByEmail:u.email||"",
    lineCount:Object.keys(items).length,totalBidValue:total,
    tenderRevisionId:revisionId,tenderRevisionCode:"R0",
    activeRevisionId:revisionId,activeRevisionCode:"R0",activeRevisionName:revision.name,
    activeEffectiveDate:revision.effectiveDate,activatedAt:Date.now(),activatedByName:u.displayName||u.email||""
  };

  await Promise.all([
    refs.quantityBoqRevision(projectId,revisionId).set(revision),
    refs.quantityBaselineProject(projectId).set(items),
    refs.quantityBaselineMeta(projectId).set(meta)
  ]);
  await audit("BASELINE_CREATED",`Khóa Tender R0 · ${Object.keys(items).length} đầu mục · ${money(total)}`,{revisionId,revisionCode:"R0"});
  await logActivity("QTY_BASELINE_CREATED",`Khóa Tender R0 ${Object.keys(items).length} đầu mục`,{projectId,revisionId});
  toast("Đã khóa R0 và kích hoạt làm Baseline.");await reload();
}

async function migrateLegacyBaselineToR0(){
  if(!baseline.length||revisions.length||!can("quantityRevisionActivate"))return;
  const u=getProfile()||{},items={};
  baseline.forEach(b=>{const {id,...rest}=b;items[id]={...rest,lineStatus:rest.lineStatus||"ACTIVE"}});
  const total=Object.values(items).reduce((sum,x)=>sum+Number(x.qty||0)*Number(x.bidUnit||0),0);
  const revisionId=refs.quantityBoqRevisionsProject(projectId).push().key;
  const revision={
    code:"R0",revisionNo:0,name:"BOQ đấu thầu / Trúng thầu",type:"TENDER",
    effectiveDate:baselineMeta.activeEffectiveDate||todayIso(),status:"ACTIVE",source:"MIGRATED_V2_7",
    lineCount:Object.keys(items).length,totalBidValue:total,items,
    createdAt:baselineMeta.frozenAt||Date.now(),createdByUid:baselineMeta.frozenByUid||u.uid||"",
    createdByName:baselineMeta.frozenByName||u.displayName||u.email||"",
    activatedAt:baselineMeta.frozenAt||Date.now(),activatedByUid:u.uid||"",activatedByName:u.displayName||u.email||""
  };
  await refs.quantityBoqRevision(projectId,revisionId).set(revision);
  await refs.quantityBaselineMeta(projectId).update({
    tenderRevisionId:revisionId,tenderRevisionCode:"R0",
    activeRevisionId:revisionId,activeRevisionCode:"R0",activeRevisionName:revision.name,
    activeEffectiveDate:revision.effectiveDate,activatedAt:baselineMeta.frozenAt||Date.now()
  });
  revisions=[{id:revisionId,...revision}];
  tenderRevision=revisions[0];activeRevision=revisions[0];
  baselineMeta={...baselineMeta,tenderRevisionId:revisionId,activeRevisionId:revisionId,activeRevisionCode:"R0",activeRevisionName:revision.name};
  await audit("REVISION_MIGRATED",`Nâng Baseline V2.7 thành Tender R0 · ${baseline.length} đầu mục`,{revisionId});
}

function revisionsHtml(){
  const ordered=[...revisions].sort((a,b)=>Number(a.revisionNo||0)-Number(b.revisionNo||0));
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">BOQ Revision & Baseline hợp đồng</h2><p>R0 luôn giữ BOQ đấu thầu. R1/R2/R3 là BOQ hợp đồng/phụ lục; chỉ một Revision được dùng làm Baseline đặt hàng.</p></div>
    ${can("quantityRevisionManage")?`<button class="btn primary" id="uploadRevisionInlineBtn">＋ Tải BOQ Revision</button>`:""}
  </div>

  <div class="revision-flow">
    <div><b>R0 Tender</b><span>Giữ nguyên lịch sử đấu thầu</span></div><i>→</i>
    <div><b>R1/R2/R3...</b><span>Hợp đồng / Phụ lục</span></div><i>→</i>
    <div><b>Baseline đang áp dụng</b><span>${esc(activeRevision?.code||"R0")} · dùng để so phiếu đặt hàng</span></div>
  </div>

  <div class="table-wrap mt"><table class="table revision-table"><thead><tr>
    <th>REV</th><th>LOẠI</th><th>TÊN PHIÊN BẢN</th><th>NGÀY HIỆU LỰC</th><th>SỐ DÒNG</th>
    <th>GIÁ TRỊ BOQ</th><th>Δ SO TENDER R0</th><th>TRẠNG THÁI</th><th>NGUỒN</th><th>NGƯỜI TẠO</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${ordered.length?ordered.map(revisionRow).join(""):`<tr><td colspan="11">${empty("Chưa có Revision","Khởi tạo R0 trước khi tải BOQ hợp đồng.","R")}</td></tr>`}
  </tbody></table></div>

  <div class="revision-help mt">
    <b>Nguyên tắc:</b> kích hoạt Revision mới không xóa phiếu đặt hàng cũ. Hệ thống giữ cùng mã định danh cho các đầu mục được map,
    vì vậy toàn bộ khối lượng đã đặt sẽ được tính lại trên Baseline mới. Đầu mục bị loại khỏi Revision mới có Baseline = 0 và mọi khối lượng đã đặt của đầu mục đó sẽ trở thành vượt công trường.
  </div>`;
}

function revisionRow(r){
  const tenderItems=tenderRevision?.items||{};
  const currentItems=r.items||{};
  const tenderValue=revisionTotal(tenderItems),value=revisionTotal(currentItems),delta=value-tenderValue;
  const st=r.status==="ACTIVE"?["Đang áp dụng","green"]:r.status==="DRAFT"?["Chờ áp dụng","orange"]:["Lịch sử","gray"];
  const typeLabel={TENDER:"Tender R0",CONTRACT:"BOQ Hợp đồng",ADDENDUM:"Phụ lục",OTHER:"Revision khác"}[r.type]||r.type||"Revision";
  return `<tr class="${r.status==="ACTIVE"?"revision-active-row":""}">
    <td><b>${esc(r.code||`R${r.revisionNo||0}`)}</b></td><td>${badge(typeLabel,r.type==="TENDER"?"blue":r.type==="CONTRACT"?"purple":"gray")}</td>
    <td><div class="primary-text">${esc(r.name||"—")}</div></td><td>${fmtDate(r.effectiveDate)}</td>
    <td>${Number(r.lineCount||Object.keys(currentItems).length)}</td><td>${money(value)}</td>
    <td class="${delta>0?"danger-text":delta<0?"positive-text":""}"><b>${signedMoney(delta)}</b></td>
    <td>${badge(st[0],st[1])}</td><td>${esc(r.sourceFileName||r.source||"—")}</td><td>${esc(r.createdByName||"—")}</td>
    <td><div class="row-actions">
      <button class="btn sm" data-revision-compare="${r.id}">So sánh</button>
      ${r.status==="DRAFT"&&can("quantityRevisionActivate")?`<button class="btn green sm" data-revision-activate="${r.id}">Áp dụng Baseline</button>`:""}
      ${r.status==="DRAFT"&&can("quantityRevisionManage")?`<button class="btn red sm" data-revision-delete="${r.id}">Xóa</button>`:""}
    </div></td>
  </tr>`;
}

function uploadRevisionDialog(isTenderR0=false){
  if(!can("quantityRevisionManage"))return;
  if(isTenderR0&&baseline.length){toast("Dự án đã có R0/Baseline.","warning");return}
  if(!isTenderR0&&!tenderRevision){toast("Cần tạo Tender R0 trước khi tải Revision hợp đồng.","error");return}
  if(!isTenderR0&&revisions.some(x=>x.status==="DRAFT")){toast("Đang có một Revision Chờ áp dụng. Hãy kiểm tra/kích hoạt hoặc xóa Revision đó trước khi tải phiên bản tiếp theo.","warning");view="REVISIONS";paint();return}

  const nextNo=isTenderR0?0:nextRevisionNo();
  const code=`R${nextNo}`;
  modal({
    title:isTenderR0?"Tải Tender R0 từ CSV":`Tải BOQ ${code}`,
    eyebrow:isTenderR0?"BOQ ĐẤU THẦU / TRÚNG THẦU":"BOQ HỢP ĐỒNG / PHỤ LỤC",
    size:"lg",submitText:isTenderR0?"Tạo R0":"Tải & So sánh",
    body:`<div class="revision-upload-note">
      ${isTenderR0
        ?"<b>R0 sẽ là mốc gốc.</b> File CSV cần có tối thiểu Mô tả và Khối lượng."
        :`File mới sẽ được lưu thành <b>${code} – Chờ áp dụng</b>. Khối lượng đặt hàng chưa thay đổi cho tới khi bấm “Áp dụng Baseline”.`}
    </div>
    <div class="form-grid mt">
      <label class="field"><span>Mã Revision</span><input name="code" value="${code}" readonly></label>
      <label class="field"><span>Loại Revision</span><select name="type">
        ${isTenderR0?`<option value="TENDER">Tender R0</option>`:`<option value="CONTRACT">BOQ Hợp đồng</option><option value="ADDENDUM">Phụ lục hợp đồng</option><option value="OTHER">Revision khác</option>`}
      </select></label>
      <label class="field span2"><span>Tên phiên bản *</span><input required name="name" value="${isTenderR0?"BOQ đấu thầu / Trúng thầu":code+" - BOQ Hợp đồng"}"></label>
      <label class="field"><span>Ngày hiệu lực *</span><input required type="date" name="effectiveDate" value="${todayIso()}"></label>
      <label class="field"><span>File BOQ CSV *</span><input required type="file" name="revisionFile" id="revisionFile" accept=".csv,text/csv"></label>
      <label class="field span2"><span>Ghi chú</span><textarea name="notes" placeholder="Ví dụ: BOQ theo HĐ số..., Phụ lục 01..."></textarea></label>
    </div>
    <div class="revision-template-box">
      <span>Hỗ trợ cột: STT/Mã, Hệ, Nhóm, Mô tả, Thông số, ĐVT, Khối lượng, Giá chào/ĐVT hoặc các cột Giá vật tư/Nhân công/Thầu phụ/Khác.</span>
      <button type="button" class="btn sm" id="downloadRevisionTemplateBtn">Tải mẫu CSV</button>
    </div>`,
    onSubmit:async fd=>{
      try{
        const file=fd.get("revisionFile");
        if(!(file instanceof File)||!file.size){toast("Vui lòng chọn file CSV.","error");return false}
        const parsed=await parseRevisionCsv(file);
        if(!parsed.length){toast("Không có dòng BOQ hợp lệ trong file.","error");return false}

        const items=mapRevisionItems(parsed);
        const u=getProfile()||{},revisionId=refs.quantityBoqRevisionsProject(projectId).push().key;
        const total=revisionTotal(items);
        const revision={
          code:String(fd.get("code")||code),revisionNo:nextNo,type:String(fd.get("type")||"CONTRACT"),
          name:String(fd.get("name")||code),effectiveDate:String(fd.get("effectiveDate")||todayIso()),
          notes:String(fd.get("notes")||""),status:isTenderR0?"ACTIVE":"DRAFT",
          source:"CSV_UPLOAD",sourceFileName:file.name,lineCount:Object.keys(items).length,totalBidValue:total,
          createdAt:Date.now(),createdByUid:u.uid||"",createdByName:u.displayName||u.email||"",items
        };

        if(isTenderR0){
          revision.activatedAt=Date.now();revision.activatedByUid=u.uid||"";revision.activatedByName=u.displayName||u.email||"";
          const baselineItems=materializeBaseline(items);
          const meta={
            source:"CSV_R0",frozenAt:Date.now(),frozenByUid:u.uid||"",frozenByName:u.displayName||"",frozenByEmail:u.email||"",
            lineCount:Object.keys(baselineItems).length,totalBidValue:total,
            tenderRevisionId:revisionId,tenderRevisionCode:"R0",
            activeRevisionId:revisionId,activeRevisionCode:"R0",activeRevisionName:revision.name,
            activeEffectiveDate:revision.effectiveDate,activatedAt:Date.now(),activatedByName:u.displayName||u.email||""
          };
          await Promise.all([
            refs.quantityBoqRevision(projectId,revisionId).set(revision),
            refs.quantityBaselineProject(projectId).set(baselineItems),
            refs.quantityBaselineMeta(projectId).set(meta)
          ]);
          await audit("R0_UPLOADED",`Tải Tender R0 từ ${file.name} · ${Object.keys(items).length} đầu mục`,{revisionId,revisionCode:"R0"});
          toast("Đã tạo Tender R0 và kích hoạt Baseline.");
          await reload();return true;
        }

        await refs.quantityBoqRevision(projectId,revisionId).set(revision);
        await audit("REVISION_UPLOADED",`Tải ${revision.code} từ ${file.name} · ${Object.keys(items).length} đầu mục`,{revisionId,revisionCode:revision.code});
        await logActivity("QTY_REVISION_UPLOADED",`Tải ${revision.code} - ${revision.name}`,{projectId,revisionId});
        toast(`Đã tải ${revision.code}. Hãy kiểm tra so sánh trước khi áp dụng.`);
        await reload();view="REVISIONS";paint();compareRevisionDialog(revisionId);return false;
      }catch(e){
        console.error(e);toast(e.message||"Không thể đọc BOQ Revision.","error");return false;
      }
    }
  });

  document.querySelector("#downloadRevisionTemplateBtn")?.addEventListener("click",downloadRevisionTemplate);
}

async function parseRevisionCsv(file){
  const text=await file.text(),rows=parseCsv(text);
  if(rows.length<2)throw new Error("File CSV không có dữ liệu.");
  const headers=rows[0].map(x=>norm(x).replace(/\s+/g," "));
  const idx=(...names)=>headers.findIndex(h=>names.some(n=>h===norm(n)));
  const map={
    itemNo:idx("stt","ma","mã","item no","item"),
    discipline:idx("he","hệ","system"),
    category:idx("nhom","nhóm","category"),
    description:idx("mo ta","mô tả","description"),
    specification:idx("thong so","thông số","spec","specification"),
    unit:idx("dvt","đvt","unit"),
    qty:idx("khoi luong","khối lượng","qty","quantity"),
    bidUnit:idx("gia chao/dvt","giá chào/đvt","gia chao","giá chào","don gia hd","đơn giá hđ","don gia","đơn giá","unit price"),
    materialUnit:idx("gia vat tu","giá vật tư"),
    laborUnit:idx("nhan cong","nhân công"),
    subcontractUnit:idx("thau phu","thầu phụ"),
    otherUnit:idx("khac","khác"),
    wastePct:idx("hao hut %","hao hụt %"),
    markupPct:idx("markup %","loi nhuan %","lợi nhuận %")
  };
  if(map.description<0||map.qty<0)throw new Error("File phải có ít nhất cột Mô tả và Khối lượng.");

  const out=[];
  for(let i=1;i<rows.length;i++){
    const r=rows[i];if(!r.some(x=>String(x).trim()))continue;
    const get=k=>map[k]>=0?(r[map[k]]??""):"";
    const d={
      itemNo:String(get("itemNo")||i).trim(),discipline:String(get("discipline")||"KHÁC").trim().toUpperCase(),
      category:String(get("category")||"").trim(),description:String(get("description")||"").trim(),
      specification:String(get("specification")||"").trim(),unit:String(get("unit")||"").trim(),
      qty:toNumber(get("qty")),bidUnit:toNumber(get("bidUnit")),materialUnit:toNumber(get("materialUnit")),
      laborUnit:toNumber(get("laborUnit")),subcontractUnit:toNumber(get("subcontractUnit")),otherUnit:toNumber(get("otherUnit")),
      wastePct:toNumber(get("wastePct")),markupPct:toNumber(get("markupPct"))
    };
    if(!d.description)continue;
    out.push(d);
  }
  return out;
}

function mapRevisionItems(parsed){
  const historyItems=historicalItemRegistry();
  const noIndex=new Map(),sigIndex=new Map();
  Object.entries(historyItems).forEach(([id,x])=>{
    const n=norm(x.itemNo||"");
    if(n){if(!noIndex.has(n))noIndex.set(n,[]);noIndex.get(n).push(id)}
    const sig=itemSignature(x);if(sig){if(!sigIndex.has(sig))sigIndex.set(sig,[]);sigIndex.get(sig).push(id)}
  });

  const result={},usedIds=new Set();
  parsed.forEach((d,i)=>{
    let id="",method="NEW";
    const n=norm(d.itemNo||"");
    if(n&&noIndex.get(n)?.length===1&&!usedIds.has(noIndex.get(n)[0])){id=noIndex.get(n)[0];method="ITEM_NO"}
    if(!id){
      const sig=itemSignature(d);
      if(sig&&sigIndex.get(sig)?.length===1&&!usedIds.has(sigIndex.get(sig)[0])){id=sigIndex.get(sig)[0];method="DESCRIPTION_SPEC_UNIT"}
    }
    if(!id)id=refs.quantityBoqRevisionItems(projectId,"_temp").push().key;
    usedIds.add(id);

    const old=historyItems[id]||{};
    const hasNewCost=[d.materialUnit,d.laborUnit,d.subcontractUnit,d.otherUnit,d.bidUnit].some(x=>Number(x||0)!==0);
    let bidUnit=Number(d.bidUnit||0);
    let materialUnit=Number(d.materialUnit||0),laborUnit=Number(d.laborUnit||0),
      subcontractUnit=Number(d.subcontractUnit||0),otherUnit=Number(d.otherUnit||0),
      wastePct=Number(d.wastePct||0),markupPct=Number(d.markupPct||0);

    if(!hasNewCost&&old){
      bidUnit=Number(old.bidUnit||0);materialUnit=Number(old.materialUnit||0);laborUnit=Number(old.laborUnit||0);
      subcontractUnit=Number(old.subcontractUnit||0);otherUnit=Number(old.otherUnit||0);
      wastePct=Number(old.wastePct||0);markupPct=Number(old.markupPct||0);
    }else if(!bidUnit){
      const base=materialUnit+laborUnit+subcontractUnit+otherUnit;
      const net=base*(1+wastePct/100);bidUnit=net*(1+markupPct/100);
    }

    result[id]={
      stableItemId:id,itemNo:d.itemNo||old.itemNo||String(i+1),discipline:d.discipline||old.discipline||"KHÁC",
      category:d.category||old.category||"",description:d.description||old.description||"",
      specification:d.specification||old.specification||"",unit:d.unit||old.unit||"",
      qty:Number(d.qty||0),materialUnit,laborUnit,subcontractUnit,otherUnit,wastePct,markupPct,
      netUnit:(materialUnit+laborUnit+subcontractUnit+otherUnit)*(1+wastePct/100),bidUnit,
      selectedSupplier:old.selectedSupplier||"",brand:old.brand||"",matchMethod:method,lineStatus:"ACTIVE",updatedAt:Date.now()
    };
  });
  return result;
}

function historicalItemRegistry(){
  const out={};
  if(tenderRevision?.items)Object.entries(tenderRevision.items).forEach(([id,x])=>out[id]={...x});
  revisions.forEach(r=>Object.entries(r.items||{}).forEach(([id,x])=>{if(!out[id])out[id]={...x}}));
  baseline.forEach(b=>{if(!out[b.id]){const {id,...rest}=b;out[b.id]={...rest}}});
  return out;
}

function compareRevisionDialog(revisionId){
  const r=revisions.find(x=>x.id===revisionId);if(!r)return;
  const previous=previousRevision(r);
  const base=previous||tenderRevision;
  const changes=compareRevisionItems(base?.items||{},r.items||{});
  const tenderChanges=compareRevisionItems(tenderRevision?.items||{},r.items||{});
  const sum=compareSummary(changes),tenderSum=compareSummary(tenderChanges);

  modal({
    title:`So sánh ${r.code} · ${r.name}`,
    eyebrow:`So với ${base?.code||"R0"} · Tender Δ ${signedMoney(tenderSum.deltaValue)}`,
    size:"xl",showSubmit:false,
    body:`<div class="grid g5">
      ${smallMetric("Thêm mới",sum.added,sum.added?"red":"green")}
      ${smallMetric("Tăng KL",sum.increased,sum.increased?"orange":"green")}
      ${smallMetric("Giảm KL",sum.decreased,sum.decreased?"blue":"green")}
      ${smallMetric("Loại bỏ",sum.removed,sum.removed?"orange":"green")}
      ${smallMetric("Δ giá trị",signedMoney(sum.deltaValue),sum.deltaValue>0?"red":"green")}
    </div>
    <div class="revision-compare-note mt">
      <b>So với Tender R0:</b> ${tenderSum.changed} đầu mục thay đổi · Giá trị BOQ ${money(revisionTotal(r.items||{}))} · Δ ${signedMoney(tenderSum.deltaValue)}.
      ${r.status==="DRAFT"?"Revision này chưa ảnh hưởng kiểm soát đặt hàng cho tới khi kích hoạt.":""}
    </div>
    <div class="table-wrap mt"><table class="table revision-compare-table"><thead><tr>
      <th>TRẠNG THÁI</th><th>MÃ</th><th>VẬT TƯ</th><th>ĐVT</th><th>${esc(base?.code||"TRƯỚC")}</th><th>${esc(r.code)}</th><th>Δ KL</th>
      <th>ĐƠN GIÁ CŨ</th><th>ĐƠN GIÁ MỚI</th><th>Δ GIÁ TRỊ</th><th>MAP</th><th>KIỂM TRA MAP</th>
    </tr></thead><tbody>
      ${changes.filter(x=>x.change!=="UNCHANGED").length?changes.filter(x=>x.change!=="UNCHANGED").map(x=>changeRow(x,r.id)).join(""):`<tr><td colspan="12">${empty("Không có thay đổi","Khối lượng và giá trị giống phiên bản trước.","✓")}</td></tr>`}
    </tbody></table></div>
    ${r.status==="DRAFT"&&can("quantityRevisionActivate")?`<div class="actions mt" style="justify-content:flex-end"><button type="button" class="btn green" id="activateRevisionFromCompare">✓ Xác nhận dùng ${esc(r.code)} làm Baseline</button></div>`:""}`
  });
  document.querySelector("#activateRevisionFromCompare")?.addEventListener("click",()=>activateRevision(revisionId));
  document.querySelectorAll("[data-revision-remap]").forEach(b=>b.addEventListener("click",()=>remapRevisionItem(b.dataset.revisionRemap,b.dataset.itemId)));
}

function changeRow(x,revisionId){
  const info={
    ADDED:["THÊM MỚI","green"],REMOVED:["LOẠI BỎ","red"],INCREASE:["TĂNG","orange"],
    DECREASE:["GIẢM","blue"],PRICE:["ĐỔI GIÁ","purple"],MIXED:["KL + GIÁ","orange"]
  }[x.change]||[x.change,"gray"];
  return `<tr class="revision-change-${String(x.change).toLowerCase()}">
    <td>${badge(info[0],info[1])}</td><td><b>${esc(x.itemNo||"—")}</b></td>
    <td><div class="primary-text">${esc(x.description||"—")}</div><div class="secondary-text">${esc(x.specification||"")}</div></td>
    <td>${esc(x.unit||"—")}</td><td>${num(x.oldQty,3)}</td><td><b>${num(x.newQty,3)}</b></td>
    <td class="${x.deltaQty>0?"danger-text":x.deltaQty<0?"positive-text":""}"><b>${signedQty(x.deltaQty)}</b></td>
    <td>${money(x.oldBid)}</td><td>${money(x.newBid)}</td>
    <td class="${x.deltaValue>0?"danger-text":x.deltaValue<0?"positive-text":""}"><b>${signedMoney(x.deltaValue)}</b></td>
    <td>${x.matchMethod==="NEW"?badge("CHƯA MAP","orange"):esc(x.matchMethod||"—")}</td>
    <td>${x.change==="ADDED"&&x.matchMethod==="NEW"&&can("quantityRevisionManage")?`<button type="button" class="btn sm" data-revision-remap="${revisionId}" data-item-id="${x.id}">Map lại</button>`:"—"}</td>
  </tr>`;
}

function remapRevisionItem(revisionId,itemId){
  const r=revisions.find(x=>x.id===revisionId),item=r?.items?.[itemId];
  if(!r||r.status!=="DRAFT"||!item)return;

  const currentIds=new Set(Object.keys(r.items||{}));
  const history=historicalItemRegistry();
  const candidates=Object.entries(history).filter(([id])=>!currentIds.has(id));
  if(!candidates.length){toast("Không còn đầu mục phiên bản trước để map.","warning");return}

  modal({
    title:"Map đầu mục Revision",
    eyebrow:`${r.code} · ${item.itemNo||""}`,
    size:"lg",submitText:"Xác nhận Mapping",
    body:`<div class="revision-map-source">
      <span>Đầu mục mới</span><b>${esc(item.description||"")}</b><small>${esc(item.specification||"")} · ${esc(item.unit||"")}</small>
    </div>
    <div class="form-grid mt">
      <label class="field span2"><span>Map với đầu mục phiên bản trước *</span><select required name="targetId">
        <option value="">-- Chọn đầu mục --</option>
        ${candidates.map(([id,x])=>`<option value="${id}">${esc(x.itemNo||"")} · ${esc(x.description||"")} · ${esc(x.specification||"")} · ${esc(x.unit||"")} · KL ${num(x.qty,3)}</option>`).join("")}
      </select></label>
    </div>
    <div class="revision-help mt">Dùng khi hệ thống không nhận ra cùng một đầu mục do mã/mô tả đã đổi. Mapping thủ công sẽ giữ lịch sử đặt hàng của đầu mục cũ.</div>`,
    onSubmit:async fd=>{
      const targetId=String(fd.get("targetId")||"");if(!targetId)return false;
      if(r.items?.[targetId]){toast("Đầu mục đích đã tồn tại trong Revision này.","error");return false}
      const mapped={...item,stableItemId:targetId,matchMethod:"MANUAL_MAP",updatedAt:Date.now()};
      const updates={};updates[`items/${targetId}`]=mapped;updates[`items/${itemId}`]=null;
      await refs.quantityBoqRevision(projectId,revisionId).update(updates);
      await audit("REVISION_REMAP",`Map thủ công ${item.description} vào đầu mục lịch sử ${targetId}`,{revisionId,itemId,targetId});
      toast("Đã cập nhật mapping.");await reload();compareRevisionDialog(revisionId);return false;
    }
  });
}

function compareRevisionItems(oldItems,newItems){
  const keys=new Set([...Object.keys(oldItems||{}),...Object.keys(newItems||{})]),out=[];
  keys.forEach(id=>{
    const a=oldItems?.[id],b=newItems?.[id];
    const oldQty=Number(a?.qty||0),newQty=Number(b?.qty||0),oldBid=Number(a?.bidUnit||0),newBid=Number(b?.bidUnit||0);
    const deltaQty=newQty-oldQty,deltaValue=newQty*newBid-oldQty*oldBid;
    let change="UNCHANGED";
    if(!a&&b)change="ADDED";
    else if(a&&!b)change="REMOVED";
    else{
      const qtyChanged=Math.abs(deltaQty)>1e-9,priceChanged=Math.abs(newBid-oldBid)>0.5;
      if(qtyChanged&&priceChanged)change="MIXED";
      else if(deltaQty>0)change="INCREASE";
      else if(deltaQty<0)change="DECREASE";
      else if(priceChanged)change="PRICE";
    }
    out.push({
      id,itemNo:b?.itemNo||a?.itemNo||"",description:b?.description||a?.description||"",
      specification:b?.specification||a?.specification||"",unit:b?.unit||a?.unit||"",
      oldQty,newQty,deltaQty,oldBid,newBid,deltaValue,change,matchMethod:b?.matchMethod||""
    });
  });
  return out.sort((x,y)=>changeOrder(x.change)-changeOrder(y.change)||String(x.itemNo).localeCompare(String(y.itemNo),"vi",{numeric:true}));
}

function compareSummary(changes){
  const changed=changes.filter(x=>x.change!=="UNCHANGED");
  return {
    changed:changed.length,added:changed.filter(x=>x.change==="ADDED").length,
    removed:changed.filter(x=>x.change==="REMOVED").length,
    increased:changed.filter(x=>["INCREASE","MIXED"].includes(x.change)&&x.deltaQty>0).length,
    decreased:changed.filter(x=>["DECREASE","MIXED"].includes(x.change)&&x.deltaQty<0).length,
    deltaValue:changes.reduce((s,x)=>s+Number(x.deltaValue||0),0)
  };
}

async function activateRevision(revisionId){
  if(!can("quantityRevisionActivate"))return;
  const r=revisions.find(x=>x.id===revisionId);if(!r||r.status!=="DRAFT")return;
  const current=activeRevision||tenderRevision;
  const changes=compareRevisionItems(current?.items||{},r.items||{}),sum=compareSummary(changes);
  const tenderSum=compareSummary(compareRevisionItems(tenderRevision?.items||{},r.items||{}));
  const orderedCount=requests.filter(x=>COUNTED_STATUSES.has(x.status)).length;
  const message=`Kích hoạt ${r.code} làm Baseline? ${sum.changed} đầu mục thay đổi so với ${current?.code||"R0"}, Δ giá trị ${signedMoney(sum.deltaValue)}. `+
    `So Tender R0: ${signedMoney(tenderSum.deltaValue)}. ${orderedCount?`${orderedCount} phiếu đã duyệt/đặt sẽ được tính lại trên Baseline mới.`:""}`;
  if(!await confirmBox(`Áp dụng ${r.code}`,message,`Áp dụng ${r.code}`))return;

  const u=getProfile()||{};
  const materialized=materializeBaseline(r.items||{});
  const total=revisionTotal(r.items||{});
  const oldId=activeRevision?.id;

  await refs.quantityBaselineProject(projectId).set(materialized);
  await refs.quantityBaselineMeta(projectId).update({
    lineCount:Object.keys(materialized).length,totalBidValue:total,
    activeRevisionId:revisionId,activeRevisionCode:r.code,activeRevisionName:r.name,
    activeEffectiveDate:r.effectiveDate,activatedAt:Date.now(),activatedByUid:u.uid||"",activatedByName:u.displayName||u.email||""
  });
  if(oldId&&oldId!==revisionId)await refs.quantityBoqRevision(projectId,oldId).update({status:"SUPERSEDED",supersededAt:Date.now()});
  await refs.quantityBoqRevision(projectId,revisionId).update({
    status:"ACTIVE",activatedAt:Date.now(),activatedByUid:u.uid||"",activatedByName:u.displayName||u.email||""
  });

  await audit("REVISION_ACTIVATED",`Áp dụng ${r.code} làm Baseline · Δ so Tender ${signedMoney(tenderSum.deltaValue)}`,{
    revisionId,revisionCode:r.code,previousRevisionId:oldId||"",changeSummary:sum,tenderSummary:tenderSum
  });
  await logActivity("QTY_REVISION_ACTIVATED",`Áp dụng ${r.code} - ${r.name} làm Baseline`,{projectId,revisionId});
  toast(`Đã áp dụng ${r.code}. Toàn bộ phiếu đặt hàng đã được tính lại theo Baseline mới.`);
  await reload();view="SUMMARY";paint();
}

function materializeBaseline(targetItems){
  const registry=historicalItemRegistry(),out={};
  Object.entries(targetItems||{}).forEach(([id,x])=>out[id]={...x,lineStatus:"ACTIVE",activeRevisionCode:""});
  Object.entries(registry).forEach(([id,x])=>{
    if(out[id])return;
    out[id]={...x,qty:0,lineStatus:"REMOVED",activeRevisionCode:""};
  });
  return out;
}

async function deleteDraftRevision(id){
  const r=revisions.find(x=>x.id===id);if(!r||r.status!=="DRAFT"||!can("quantityRevisionManage"))return;
  if(!await confirmBox("Xóa BOQ Revision",`Xóa ${r.code} - ${r.name}? Revision chưa áp dụng nên không ảnh hưởng phiếu đặt hàng.`,"Xóa"))return;
  await refs.quantityBoqRevision(projectId,id).remove();
  await audit("REVISION_DELETED",`Xóa Revision nháp ${r.code}`,{revisionId:id,revisionCode:r.code});
  toast(`Đã xóa ${r.code}.`,"warning");await reload();view="REVISIONS";paint();
}

function previousRevision(r){
  const candidates=revisions.filter(x=>Number(x.revisionNo||0)<Number(r.revisionNo||0)).sort((a,b)=>Number(b.revisionNo||0)-Number(a.revisionNo||0));
  return candidates[0]||null;
}

function nextRevisionNo(){
  return revisions.reduce((m,r)=>Math.max(m,Number(r.revisionNo||0)),0)+1;
}

function revisionTotal(items){
  return Object.values(items||{}).reduce((s,x)=>s+Number(x.qty||0)*Number(x.bidUnit||0),0);
}

function revisionSort(a,b){
  return Number(b.revisionNo||0)-Number(a.revisionNo||0);
}

function changeOrder(k){
  return {ADDED:0,INCREASE:1,MIXED:2,PRICE:3,DECREASE:4,REMOVED:5,UNCHANGED:9}[k]??8;
}

function itemSignature(x){
  const desc=norm(x.description||"").replace(/[^a-z0-9]+/g," ");
  const spec=norm(x.specification||"").replace(/[^a-z0-9]+/g," ");
  const unit=norm(x.unit||"");
  return `${desc}|${spec}|${unit}`.trim();
}

function downloadRevisionTemplate(){
  const rows=[
    ["STT","Hệ","Nhóm","Mô tả","Thông số","ĐVT","Khối lượng","Giá chào/ĐVT","Giá vật tư","Nhân công","Thầu phụ","Khác","Hao hụt %","Markup %"],
    ["1","PCCC","Đường ống","Ống thép đen DN50","SCH40","m","1200","120000","85000","0","0","0","0","0"]
  ];
  downloadCsv("MAU_BOQ_REVISION.csv",rows);
}

function parseCsv(text){
  const first=(text.split(/\r?\n/,1)[0]||""),delim=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?";":",";
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
    else if(ch===delim&&!quoted){row.push(cell);cell=""}
    else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);rows.push(row);row=[];cell=""}
    else cell+=ch;
  }
  if(cell.length||row.length){row.push(cell);rows.push(row)}
  return rows.map(r=>r.map(x=>x.trim()));
}

function toNumber(v){
  const raw=String(v??"").trim().replace(/\s/g,"");if(!raw)return 0;
  if(raw.includes(",")&&!raw.includes("."))return Number(raw.replace(",","."))||0;
  return Number(raw.replaceAll(",",""))||0;
}

function editRequest(id){
  const r=requests.find(x=>x.id===id)||{};
  const u=getProfile()||{};
  if(id&&!canEditRequest(r)){toast("Phiếu này không còn được phép sửa.","error");return}

  modal({
    title:id?"Cập nhật phiếu đặt hàng":"Tạo phiếu đặt hàng công trường",
    eyebrow:"ĐỀ NGHỊ VẬT TƯ",
    size:"lg",
    submitText:id?"Lưu phiếu":"Tạo phiếu",
    body:`<div class="form-grid">
      <label class="field"><span>Mã phiếu *</span><input required name="code" value="${esc(r.code||nextRequestCode())}"></label>
      <label class="field"><span>Ngày đề nghị *</span><input required type="date" name="requestDate" value="${esc(r.requestDate||todayIso())}"></label>
      <label class="field"><span>Người đề nghị</span><input name="requesterName" value="${esc(r.requesterName||u.displayName||u.email||"")}"></label>
      <label class="field"><span>Khu vực / Tầng / Zone</span><input name="location" value="${esc(r.location||"")}" placeholder="Ví dụ: Tầng 2 - Zone A"></label>
      <label class="field span2"><span>Mục đích / Ghi chú</span><textarea name="notes">${esc(r.notes||"")}</textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());
      d.updatedAt=ts();
      if(id){
        const before={...r};delete before.lines;
        await refs.orderRequest(projectId,id).update(d);
        await audit("REQUEST_UPDATED",`Cập nhật phiếu ${d.code}`,{requestId:id,requestCode:d.code,before,after:d});
      }else{
        const key=refs.orderRequestsProject(projectId).push().key;
        d.status="DRAFT";d.requesterUid=u.uid||"";d.requesterEmail=u.email||"";d.department=u.department||"";
        d.createdAt=ts();d.createdByUid=u.uid||"";d.createdByName=u.displayName||u.email||"";
        await refs.orderRequest(projectId,key).set(d);
        await audit("REQUEST_CREATED",`Tạo phiếu ${d.code}`,{requestId:key,requestCode:d.code,after:d});
      }
      toast(id?"Đã cập nhật phiếu.":"Đã tạo phiếu. Hãy thêm đầu mục vật tư.");
      await reload();
      if(!id){
        const created=requests.find(x=>x.code===d.code);
        if(created){viewRequest(created.id);return false}
      }
      return true;
    }
  });
}

function viewRequest(id){
  const r=requests.find(x=>x.id===id);if(!r)return;
  const lines=linesOf(r),st=statusInfo(r.status),impact=requestImpact(r);
  const editable=r.status==="DRAFT"&&canEditRequest(r);

  modal({
    title:`${r.code||"Phiếu đặt hàng"} · ${st.label}`,
    eyebrow:`${fmtDate(r.requestDate)} · ${r.location||"Công trường"}`,
    size:"xl",showSubmit:false,
    body:`<div class="grid g5">
      ${smallMetric("Số dòng",lines.length)}
      ${smallMetric("KL quy đổi",num(lines.reduce((s,l)=>s+Number(l.boqQty||0),0),3))}
      ${smallMetric("GT theo giá BOQ",money(lines.reduce((s,l)=>s+Number(l.boqQty||0)*Number(l.bidUnit||0),0),true))}
      ${smallMetric("Đầu mục sẽ vượt",impact.overCount,impact.overCount?"red":"green")}
      ${smallMetric("GT vượt do phiếu",money(impact.excessBidValue,true),impact.excessBidValue?"red":"green")}
    </div>

    ${impact.overCount?`<div class="qty-warning-box mt"><b>⚠ Phiếu này có thể làm vượt Baseline.</b><span>${impact.overCount} đầu mục · giá trị vượt theo giá chào ${money(impact.excessBidValue)} · chi phí vượt dự kiến ${money(impact.excessCost)}</span></div>`:""}

    <div class="card mt">
      <div class="card-head"><div><h3>Chi tiết vật tư</h3><div class="secondary-text">${esc(r.requesterName||r.requesterEmail||"")} · ${esc(r.notes||"")}</div></div>${editable?`<button type="button" class="btn primary sm" id="addRequestLineBtn">＋ Thêm đầu mục</button>`:""}</div>
      <div class="table-wrap" style="border:0;border-radius:0 0 11px 11px"><table class="table request-lines-table"><thead><tr>
        <th>VẬT TƯ</th><th>NGUỒN</th><th>ĐVT BOQ</th><th>ĐVT ĐẶT</th><th>QUY ĐỔI</th><th>SL ĐẶT</th><th>KL QUY ĐỔI</th><th>GIÁ CHÀO</th><th>GIÁ MUA DK</th><th>LÝ DO</th><th style="text-align:right">THAO TÁC</th>
      </tr></thead><tbody>
        ${lines.length?lines.map(l=>`<tr>
          <td><div class="primary-text">${esc(l.description||"—")}</div><div class="secondary-text">${esc(l.specification||"")}</div></td>
          <td>${l.isOutsideBoq?badge("NGOÀI BOQ","red"):badge(l.itemNo||"BOQ","blue")}</td>
          <td>${esc(l.unit||"—")}</td><td>${esc(l.orderUnit||l.unit||"—")}</td><td>1 ${esc(l.orderUnit||l.unit||"")} = ${num(l.conversionFactor||1,3)} ${esc(l.unit||"")}</td>
          <td>${num(l.orderQty,3)}</td><td><b>${num(l.boqQty,3)}</b></td><td>${money(l.bidUnit)}</td><td>${money(l.costUnitPrice)}</td>
          <td>${esc(reasonLabel(l.reasonCode))}${l.reasonNote?`<div class="secondary-text">${esc(l.reasonNote)}</div>`:""}</td>
          <td><div class="row-actions">${editable?`<button type="button" class="btn sm" data-line-edit="${l.id}">Sửa</button><button type="button" class="btn red sm" data-line-del="${l.id}">Xóa</button>`:""}</div></td>
        </tr>`).join(""):`<tr><td colspan="11">${empty("Phiếu chưa có vật tư","Thêm các đầu mục cần đặt hàng vào phiếu.","▦")}</td></tr>`}
      </tbody></table></div>
    </div>

    <div class="actions mt">
      ${r.status==="DRAFT"&&canEditRequest(r)&&lines.length?`<button type="button" class="btn primary" id="submitRequestBtn">Gửi duyệt</button>`:""}
      ${r.status==="PENDING"&&can("quantityRequestApprove")?`<button type="button" class="btn green" id="approveRequestBtn">✓ Duyệt phiếu</button><button type="button" class="btn" id="returnDraftBtn">Trả về Nháp</button>`:""}
      ${r.status==="APPROVED"&&can("quantityRequestOrder")?`<button type="button" class="btn primary" id="markOrderedBtn">Đánh dấu Đã đặt hàng</button>`:""}
      ${["PENDING","APPROVED","ORDERED"].includes(r.status)&&can("quantityRequestCancel")?`<button type="button" class="btn red" id="cancelRequestBtn">Hủy phiếu</button>`:""}
      ${r.status==="DRAFT"&&canEditRequest(r)?`<button type="button" class="btn red" id="deleteRequestBtn">Xóa phiếu</button>`:""}
    </div>`
  });

  document.querySelector("#addRequestLineBtn")?.addEventListener("click",()=>editLine(r.id,null));
  document.querySelectorAll("[data-line-edit]").forEach(b=>b.addEventListener("click",()=>editLine(r.id,b.dataset.lineEdit)));
  document.querySelectorAll("[data-line-del]").forEach(b=>b.addEventListener("click",()=>deleteLine(r.id,b.dataset.lineDel)));
  document.querySelector("#submitRequestBtn")?.addEventListener("click",()=>transitionRequest(r.id,"PENDING"));
  document.querySelector("#approveRequestBtn")?.addEventListener("click",()=>approveRequest(r.id));
  document.querySelector("#returnDraftBtn")?.addEventListener("click",()=>transitionRequest(r.id,"DRAFT"));
  document.querySelector("#markOrderedBtn")?.addEventListener("click",()=>transitionRequest(r.id,"ORDERED"));
  document.querySelector("#cancelRequestBtn")?.addEventListener("click",()=>transitionRequest(r.id,"CANCELLED"));
  document.querySelector("#deleteRequestBtn")?.addEventListener("click",()=>deleteRequest(r.id));
}

function editLine(requestId,lineId){
  const r=requests.find(x=>x.id===requestId);if(!r||r.status!=="DRAFT"||!canEditRequest(r))return;
  const old=linesOf(r).find(x=>x.id===lineId)||{};
  const selectedKey=old.isOutsideBoq?"__OUTSIDE__":(old.baselineItemId||baseline[0]?.id||"__OUTSIDE__");

  modal({
    title:lineId?"Cập nhật đầu mục":"Thêm đầu mục đặt hàng",
    eyebrow:r.code||"PHIẾU ĐẶT HÀNG",
    size:"lg",
    submitText:lineId?"Lưu đầu mục":"Thêm vào phiếu",
    body:`<div class="form-grid">
      <label class="field span2"><span>Đầu mục Baseline *</span><select name="sourceKey" id="lineSourceKey">
        ${baseline.map(b=>`<option value="${b.id}" ${selectedKey===b.id?"selected":""}>${esc(b.itemNo||"")} · ${esc(b.description||"")} · BOQ ${num(b.qty,3)} ${esc(b.unit||"")}</option>`).join("")}
        <option value="__OUTSIDE__" ${selectedKey==="__OUTSIDE__"?"selected":""}>＋ ĐẦU MỤC NGOÀI BOQ</option>
      </select></label>

      <div class="span2 qty-line-baseline" id="lineBaselineInfo"></div>

      <label class="field span2 qty-outside-field"><span>Mô tả đầu mục ngoài BOQ *</span><input name="description" id="lineDescription" value="${esc(old.description||"")}"></label>
      <label class="field span2 qty-outside-field"><span>Thông số / Model</span><input name="specification" id="lineSpecification" value="${esc(old.specification||"")}"></label>
      <label class="field qty-outside-field"><span>Hệ thống</span><input name="discipline" id="lineDiscipline" value="${esc(old.discipline||"KHÁC")}"></label>
      <label class="field qty-outside-field"><span>ĐVT BOQ để quy đổi *</span><input name="unit" id="lineUnit" value="${esc(old.unit||"")}"></label>

      <label class="field"><span>Đơn vị đặt hàng *</span><input required name="orderUnit" id="lineOrderUnit" value="${esc(old.orderUnit||old.unit||"")}"></label>
      <label class="field"><span>Hệ số quy đổi *</span><input required type="number" min="0.000001" step="any" name="conversionFactor" id="lineFactor" value="${Number(old.conversionFactor||1)}"><small>1 ĐVT đặt = bao nhiêu ĐVT BOQ. Ví dụ 1 cây = 6 m.</small></label>
      <label class="field"><span>Số lượng đặt *</span><input required type="number" min="0.000001" step="any" name="orderQty" id="lineOrderQty" value="${Number(old.orderQty||0)}"></label>
      <label class="field"><span>Giá chào / ĐVT BOQ</span><input type="number" min="0" step="any" name="bidUnit" id="lineBidUnit" value="${Number(old.bidUnit||0)}"></label>
      <label class="field"><span>Giá mua dự kiến / ĐVT BOQ</span><input type="number" min="0" step="any" name="costUnitPrice" id="lineCostUnit" value="${Number(old.costUnitPrice||0)}"></label>
      <label class="field"><span>Lý do phát sinh / vượt</span><select name="reasonCode" id="lineReason"><option value="">-- Chọn lý do --</option>${REASONS.map(x=>`<option value="${x[0]}" ${old.reasonCode===x[0]?"selected":""}>${x[1]}</option>`).join("")}</select></label>
      <label class="field span2"><span>Giải trình</span><textarea name="reasonNote" id="lineReasonNote">${esc(old.reasonNote||"")}</textarea></label>

      <div class="span2 qty-line-preview" id="linePreview"></div>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());
      const sourceKey=d.sourceKey;
      const outside=sourceKey==="__OUTSIDE__";
      const b=baseline.find(x=>x.id===sourceKey);

      d.isOutsideBoq=outside;
      d.baselineItemId=outside?"":sourceKey;
      d.orderQty=Number(d.orderQty||0);
      d.conversionFactor=Number(d.conversionFactor||1);
      d.boqQty=d.orderQty*d.conversionFactor;
      d.bidUnit=Number(d.bidUnit||0);
      d.costUnitPrice=Number(d.costUnitPrice||0);
      d.orderUnit=String(d.orderUnit||"").trim();

      if(outside){
        d.description=String(d.description||"").trim();
        d.specification=String(d.specification||"").trim();
        d.discipline=String(d.discipline||"KHÁC").trim()||"KHÁC";
        d.unit=String(d.unit||"").trim();
        if(!d.description||!d.unit){toast("Đầu mục ngoài BOQ phải có Mô tả và ĐVT BOQ.","error");return false}
        d.outsideKey=outsideKey(d.description,d.specification,d.unit);
        d.itemNo="NGOÀI BOQ";
      }else{
        if(!b){toast("Không tìm thấy đầu mục Baseline.","error");return false}
        d.itemNo=b.itemNo||"";d.description=b.description||"";d.specification=b.specification||"";
        d.discipline=b.discipline||"KHÁC";d.unit=b.unit||"";d.outsideKey="";
        if(!d.bidUnit)d.bidUnit=Number(b.bidUnit||0);
        if(!d.costUnitPrice)d.costUnitPrice=Number(b.materialUnit||0);
      }

      const projected=projectedLineImpact(d);
      if((outside||projected.excessQty>0)&&!d.reasonCode){toast("Đầu mục vượt/ngoài BOQ phải chọn lý do.","error");return false}
      d.updatedAt=ts();

      if(lineId){
        const before={...old};
        await refs.orderRequestLine(projectId,requestId,lineId).update(d);
        await audit("LINE_UPDATED",`Cập nhật ${d.description} · ${num(d.boqQty,3)} ${d.unit}`,{requestId,requestCode:r.code,lineId,before,after:d});
      }else{
        const key=refs.orderRequestLines(projectId,requestId).push().key;d.createdAt=ts();
        await refs.orderRequestLine(projectId,requestId,key).set(d);
        await audit("LINE_CREATED",`Thêm ${d.description} · ${num(d.boqQty,3)} ${d.unit}`,{requestId,requestCode:r.code,lineId:key,after:d});
      }

      toast("Đã lưu đầu mục.");await reload();viewRequest(requestId);return false;
    }
  });

  const source=document.querySelector("#lineSourceKey");
  const update=()=>{
    const key=source?.value||"__OUTSIDE__",outside=key==="__OUTSIDE__",b=baseline.find(x=>x.id===key);
    document.querySelectorAll(".qty-outside-field").forEach(el=>el.classList.toggle("hidden",!outside));

    if(!outside&&b){
      const oldSame=!old.isOutsideBoq&&old.baselineItemId===b.id;
      const orderUnit=document.querySelector("#lineOrderUnit"),factor=document.querySelector("#lineFactor"),bid=document.querySelector("#lineBidUnit"),cost=document.querySelector("#lineCostUnit");
      if(!oldSame){
        if(orderUnit)orderUnit.value=b.unit||"";
        if(factor)factor.value=1;
        if(bid)bid.value=Number(b.bidUnit||0);
        if(cost)cost.value=Number(b.materialUnit||0);
      }
      const row=aggregateRows().find(x=>x.key===b.id);
      const info=document.querySelector("#lineBaselineInfo");
      if(info)info.innerHTML=`<div><span>Baseline</span><b>${num(b.qty,3)} ${esc(b.unit||"")}</b></div><div><span>Đã duyệt/đặt</span><b>${num(row?.confirmedQty||0,3)}</b></div><div><span>Còn lại</span><b>${num(Number(b.qty||0)-Number(row?.confirmedQty||0),3)}</b></div><div><span>Giá chào</span><b>${money(b.bidUnit)}</b></div>`;
    }else{
      const info=document.querySelector("#lineBaselineInfo");
      if(info)info.innerHTML=`<div class="qty-outside-warning"><b>ĐẦU MỤC NGOÀI BOQ</b><span>Toàn bộ khối lượng được xem là phát sinh.</span></div>`;

      // Khi chuyển từ một dòng Baseline sang "Ngoài BOQ", không giữ lại giá/đơn vị
      // của vật tư trước đó để tránh người dùng vô tình lưu sai giá.
      if(!old.isOutsideBoq && source?.dataset.lastKey && source.dataset.lastKey!=="__OUTSIDE__"){
        const orderUnit=document.querySelector("#lineOrderUnit"),factor=document.querySelector("#lineFactor"),
          bid=document.querySelector("#lineBidUnit"),cost=document.querySelector("#lineCostUnit"),
          unit=document.querySelector("#lineUnit");
        if(orderUnit)orderUnit.value="";
        if(unit)unit.value="";
        if(factor)factor.value=1;
        if(bid)bid.value=0;
        if(cost)cost.value=0;
      }
    }
    if(source)source.dataset.lastKey=key;
    updatePreview();
  };

  const updatePreview=()=>{
    const key=source?.value||"__OUTSIDE__",outside=key==="__OUTSIDE__",b=baseline.find(x=>x.id===key);
    const orderQty=Number(document.querySelector("#lineOrderQty")?.value||0);
    const factor=Number(document.querySelector("#lineFactor")?.value||1);
    const boqQty=orderQty*factor;
    const bid=Number(document.querySelector("#lineBidUnit")?.value||(!outside?b?.bidUnit:0)||0);
    const cost=Number(document.querySelector("#lineCostUnit")?.value||(!outside?b?.materialUnit:0)||0);
    let before=0,baselineQty=0;
    if(!outside&&b){
      const row=aggregateRows().find(x=>x.key===b.id);before=Number(row?.confirmedQty||0);baselineQty=Number(b.qty||0);
    }
    const after=before+boqQty;
    const excess=Math.max(0,after-baselineQty);
    const box=document.querySelector("#linePreview");
    if(box)box.innerHTML=`<div><span>KL quy đổi phiếu này</span><b>${num(boqQty,3)} ${esc(outside?(document.querySelector("#lineUnit")?.value||""):b?.unit||"")}</b></div><div><span>Đã đặt trước đó</span><b>${num(before,3)}</b></div><div><span>Sau phiếu</span><b>${num(after,3)}</b></div><div class="${excess>0?"danger-text":""}"><span>Vượt Baseline</span><b>${num(excess,3)}</b></div><div class="${excess>0?"danger-text":""}"><span>GT vượt theo giá chào</span><b>${money(excess*bid)}</b></div><div><span>Chi phí vượt dự kiến</span><b>${money(excess*cost)}</b></div>`;
  };

  source?.addEventListener("change",update);
  ["#lineOrderQty","#lineFactor","#lineBidUnit","#lineCostUnit","#lineUnit"].forEach(sel=>document.querySelector(sel)?.addEventListener("input",updatePreview));
  update();
}

async function deleteLine(requestId,lineId){
  const r=requests.find(x=>x.id===requestId),line=linesOf(r).find(x=>x.id===lineId);if(!r||!line)return;
  if(!await confirmBox("Xóa đầu mục",`Xóa "${line.description}" khỏi ${r.code}?`,"Xóa"))return;
  await refs.orderRequestLine(projectId,requestId,lineId).remove();
  await audit("LINE_DELETED",`Xóa ${line.description} khỏi ${r.code}`,{requestId,requestCode:r.code,lineId,before:line});
  toast("Đã xóa đầu mục.","warning");await reload();viewRequest(requestId);
}

async function transitionRequest(id,status){
  const r=requests.find(x=>x.id===id);if(!r)return;
  if(status==="PENDING"&&!linesOf(r).length){toast("Phiếu chưa có đầu mục để gửi duyệt.","error");return}
  if(status==="CANCELLED"&&!await confirmBox("Hủy phiếu",`Hủy ${r.code}? Phiếu sẽ không còn được tính vào khối lượng cộng dồn.`,"Hủy phiếu"))return;

  const u=getProfile()||{},patch={status,updatedAt:ts()};
  if(status==="PENDING"){patch.submittedAt=ts();patch.submittedByUid=u.uid||""}
  if(status==="DRAFT"){patch.returnedAt=ts();patch.returnedByUid=u.uid||""}
  if(status==="ORDERED"){patch.orderedAt=ts();patch.orderedByUid=u.uid||"";patch.orderedByName=u.displayName||u.email||""}
  if(status==="CANCELLED"){patch.cancelledAt=ts();patch.cancelledByUid=u.uid||"";patch.cancelledByName=u.displayName||u.email||""}

  await refs.orderRequest(projectId,id).update(patch);
  await audit("REQUEST_STATUS",`${r.code}: ${statusInfo(r.status).label} → ${statusInfo(status).label}`,{requestId:id,requestCode:r.code,before:{status:r.status},after:{status}});
  await logActivity("QTY_REQUEST_STATUS",`${r.code} → ${statusInfo(status).label}`,{projectId,requestId:id});
  toast("Đã cập nhật trạng thái phiếu.");await reload();viewRequest(id);
}

async function approveRequest(id){
  const r=requests.find(x=>x.id===id);if(!r||r.status!=="PENDING"||!can("quantityRequestApprove"))return;
  const impact=requestImpact(r);
  const msg=impact.overCount
    ?`${r.code} sẽ làm vượt ${impact.overCount} đầu mục. Giá trị vượt theo giá chào: ${money(impact.excessBidValue)}; chi phí vượt dự kiến: ${money(impact.excessCost)}. Vẫn duyệt?`
    :`Duyệt ${r.code} và cộng khối lượng phiếu này vào kiểm soát BOQ?`;
  if(!await confirmBox("Duyệt phiếu đặt hàng",msg,"Duyệt phiếu"))return;

  const u=getProfile()||{};
  await refs.orderRequest(projectId,id).update({status:"APPROVED",approvedAt:ts(),approvedByUid:u.uid||"",approvedByName:u.displayName||u.email||"",updatedAt:ts()});
  await audit("REQUEST_APPROVED",`Duyệt ${r.code}${impact.overCount?` · vượt ${impact.overCount} đầu mục · ${money(impact.excessBidValue)}`:""}`,{requestId:id,requestCode:r.code,impact});
  await logActivity("QTY_REQUEST_APPROVED",`Duyệt ${r.code}`,{projectId,requestId:id,excessValue:impact.excessBidValue});
  toast(impact.overCount?"Đã duyệt phiếu. Có khối lượng vượt BOQ cần xử lý.":"Đã duyệt phiếu.",impact.overCount?"warning":"success");
  await reload();viewRequest(id);
}

async function deleteRequest(id){
  const r=requests.find(x=>x.id===id);if(!r||r.status!=="DRAFT")return;
  if(!await confirmBox("Xóa phiếu",`Xóa hoàn toàn ${r.code}?`,"Xóa"))return;
  await refs.orderRequest(projectId,id).remove();
  await audit("REQUEST_DELETED",`Xóa phiếu ${r.code}`,{requestId:id,requestCode:r.code,before:r});
  toast("Đã xóa phiếu.","warning");await reload();
}

function itemHistory(key){
  const row=aggregateRows().find(x=>x.key===key);if(!row)return;
  const events=lineEventsForKey(key);
  modal({
    title:`Lịch sử · ${row.description}`,
    eyebrow:row.isOutside?"NGOÀI BOQ":row.itemNo||"BOQ",
    size:"lg",showSubmit:false,
    body:`<div class="grid g4">
      ${smallMetric("KL Baseline",`${num(row.baselineQty,3)} ${esc(row.unit||"")}`)}
      ${smallMetric("Đã duyệt/đặt",num(row.confirmedQty,3))}
      ${smallMetric("Chờ duyệt",num(row.pendingQty,3))}
      ${smallMetric("GT vượt",money(row.excessBidValue,true),row.excessBidValue?"red":"green")}
    </div>
    <div class="table-wrap mt"><table class="table qty-history-table"><thead><tr>
      <th>PHIẾU</th><th>NGÀY</th><th>TRẠNG THÁI</th><th>SL ĐẶT</th><th>ĐVT ĐẶT</th><th>HỆ SỐ</th><th>KL QUY ĐỔI</th><th>GIÁ CHÀO</th><th>GIÁ MUA DK</th><th>LÝ DO</th>
    </tr></thead><tbody>${events.length?events.map(e=>`<tr>
      <td><b>${esc(e.request.code||"")}</b></td><td>${fmtDate(e.request.requestDate)}</td><td>${badge(statusInfo(e.request.status).label,statusInfo(e.request.status).color)}</td>
      <td>${num(e.line.orderQty,3)}</td><td>${esc(e.line.orderUnit||"")}</td><td>${num(e.line.conversionFactor||1,3)}</td><td><b>${num(e.line.boqQty,3)} ${esc(e.line.unit||"")}</b></td>
      <td>${money(e.line.bidUnit)}</td><td>${money(e.line.costUnitPrice)}</td><td>${esc(reasonLabel(e.line.reasonCode))}</td>
    </tr>`).join(""):`<tr><td colspan="10">Chưa có lịch sử.</td></tr>`}</tbody></table></div>`
  });
}

async function createVariationFromRow(key){
  if(!can("quantityVariationCreate"))return;
  const row=aggregateRows().find(x=>x.key===key);if(!row||row.excessBidValue<=0)return;

  const existing=variations.find(v=>v.source==="QTY_CONTROL"&&v.sourceQuantityKey===key&&v.status!=="REJECTED");
  if(existing){toast(`Đã có ${existing.code||"Variation"} liên kết đầu mục này (${statusVariation(existing.status)}).`,"warning");return}

  if(!await confirmBox("Tạo Variation từ khối lượng vượt",`Tạo VO nháp cho "${row.description}" với giá trị ${money(row.excessBidValue)}?`,"Tạo VO"))return;

  const keyVar=refs.variationsProject(projectId).push().key;
  const code=`VO-QTY-${String(variations.length+1).padStart(2,"0")}`;
  const d={
    code,date:todayIso(),title:`Vượt BOQ: ${row.description}`,direction:"INCREASE",amount:Number(row.excessBidValue||0),status:"DRAFT",
    clientRef:"",source:"QTY_CONTROL",sourceQuantityKey:key,
    notes:`Tạo từ kiểm soát khối lượng. Baseline: ${num(row.baselineQty,3)} ${row.unit}; Đã duyệt/đặt: ${num(row.confirmedQty,3)} ${row.unit}; Vượt: ${num(Math.max(0,row.confirmedQty-row.baselineQty),3)} ${row.unit}.`,
    createdAt:ts(),updatedAt:ts()
  };
  await refs.variation(projectId,keyVar).set(d);
  await audit("VARIATION_CREATED",`Tạo ${code} từ khối lượng vượt · ${money(row.excessBidValue)}`,{after:d});
  await logActivity("QTY_VARIATION_CREATED",`Tạo ${code} từ kiểm soát khối lượng`,{projectId,variationId:keyVar});
  toast(`Đã tạo ${code} ở Tài chính → Phát sinh.`);await reload();
}

function aggregateRows(){
  const baseMap=new Map();
  const tenderItems=tenderRevision?.items||{};
  baseline.forEach(b=>{
    const t=tenderItems[b.id]||{};
    const baselineQty=Number(b.qty||0),tenderQty=Number(t.qty||0);
    const bidUnit=Number(b.bidUnit||0),tenderBidUnit=Number(t.bidUnit||bidUnit||0);
    baseMap.set(b.id,{
      key:b.id,isOutside:false,itemNo:b.itemNo||t.itemNo||"",discipline:b.discipline||t.discipline||"KHÁC",
      description:b.description||t.description||"",specification:b.specification||t.specification||"",
      unit:b.unit||t.unit||"",baselineQty,tenderQty,bidUnit,tenderBidUnit,defaultCost:Number(b.materialUnit||t.materialUnit||0),
      lineStatus:b.lineStatus||"ACTIVE",
      contractDeltaQty:baselineQty-tenderQty,
      contractDeltaValue:baselineQty*bidUnit-tenderQty*tenderBidUnit,
      confirmedQty:0,pendingQty:0,orderedValue:0,excessBidValue:0,excessCost:0,diffBidValue:0,reasonLabel:""
    });
  });

  const outsideMap=new Map();

  requests.forEach(req=>{
    const counted=COUNTED_STATUSES.has(req.status),pending=req.status==="PENDING";
    if(!counted&&!pending)return;
    linesOf(req).forEach(line=>{
      const qty=Number(line.boqQty||0);
      if(line.isOutsideBoq){
        const key=`OUT:${line.outsideKey||outsideKey(line.description,line.specification,line.unit)}`;
        if(!outsideMap.has(key))outsideMap.set(key,{
          key,isOutside:true,itemNo:"NGOÀI BOQ",discipline:line.discipline||"KHÁC",description:line.description||"",specification:line.specification||"",
          unit:line.unit||"",baselineQty:0,tenderQty:0,bidUnit:0,tenderBidUnit:0,defaultCost:0,lineStatus:"OUTSIDE",
          contractDeltaQty:0,contractDeltaValue:0,
          confirmedQty:0,pendingQty:0,orderedValue:0,excessBidValue:0,excessCost:0,diffBidValue:0,
          bidValueSum:0,costValueSum:0,reasonLabel:reasonLabel(line.reasonCode)
        });
        const row=outsideMap.get(key);
        if(counted){
          row.confirmedQty+=qty;row.bidValueSum+=qty*Number(line.bidUnit||0);row.costValueSum+=qty*Number(line.costUnitPrice||0);row.orderedValue+=qty*Number(line.bidUnit||0);
        }else row.pendingQty+=qty;
      }else{
        const row=baseMap.get(line.baselineItemId);if(!row)return;
        if(counted){row.confirmedQty+=qty;row.orderedValue+=qty*Number(line.bidUnit||row.bidUnit||0)}
        else row.pendingQty+=qty;
      }
    });
  });

  // Accurate excess cost: only the portion crossing the baseline is multiplied by the unit cost at that order event.
  baseMap.forEach(row=>{
    let used=0,cost=0;
    const events=lineEventsForKey(row.key).filter(e=>COUNTED_STATUSES.has(e.request.status))
      .sort((a,b)=>String(a.request.requestDate||"").localeCompare(String(b.request.requestDate||""))||(a.request.createdAt||0)-(b.request.createdAt||0));
    events.forEach(e=>{
      const q=Number(e.line.boqQty||0),before=used,after=used+q;
      const extra=Math.max(0,after-row.baselineQty)-Math.max(0,before-row.baselineQty);
      if(extra>0)cost+=extra*Number(e.line.costUnitPrice||row.defaultCost||0);
      used=after;
    });
    const diff=row.confirmedQty-row.baselineQty;
    row.excessBidValue=Math.max(0,diff)*row.bidUnit;
    row.diffBidValue=diff*row.bidUnit;
    row.excessCost=cost;
  });

  outsideMap.forEach(row=>{
    row.bidUnit=row.confirmedQty?row.bidValueSum/row.confirmedQty:0;
    row.excessBidValue=row.bidValueSum;row.diffBidValue=row.bidValueSum;row.excessCost=row.costValueSum;
  });

  return [...baseMap.values(),...outsideMap.values()];
}

function lineEventsForKey(key){
  const outside=String(key).startsWith("OUT:");
  const outKey=outside?String(key).slice(4):"";
  const events=[];
  requests.forEach(request=>linesOf(request).forEach(line=>{
    const match=outside
      ?line.isOutsideBoq&&(line.outsideKey||outsideKey(line.description,line.specification,line.unit))===outKey
      :!line.isOutsideBoq&&line.baselineItemId===key;
    if(match)events.push({request,line});
  }));
  return events;
}

function requestImpact(req){
  let overCount=0,excessBidValue=0,excessCost=0;
  const grouped=new Map();

  linesOf(req).forEach(line=>{
    const key=line.isOutsideBoq?`OUT:${line.outsideKey||outsideKey(line.description,line.specification,line.unit)}`:line.baselineItemId;
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(line);
  });

  grouped.forEach((lines,key)=>{
    const outside=String(key).startsWith("OUT:");
    const b=outside?null:baseline.find(x=>x.id===key);

    // Lấy phần đã duyệt/đặt TRƯỚC phiếu đang xem để không cộng phiếu này hai lần
    // khi phiếu đã ở trạng thái APPROVED/ORDERED.
    const before=lineEventsForKey(key)
      .filter(e=>e.request.id!==req.id&&COUNTED_STATUSES.has(e.request.status))
      .reduce((sum,e)=>sum+Number(e.line.boqQty||0),0);

    const baselineQty=outside?0:Number(b?.qty||0);
    let cursor=before,itemExcessCost=0,itemBid=0;

    lines.forEach(line=>{
      const qty=Number(line.boqQty||0),after=cursor+qty;
      const extra=Math.max(0,after-baselineQty)-Math.max(0,cursor-baselineQty);
      if(extra>0){
        itemExcessCost+=extra*Number(line.costUnitPrice||b?.materialUnit||0);
        itemBid+=extra*Number(line.bidUnit||b?.bidUnit||0);
      }
      cursor=after;
    });

    if(cursor>baselineQty){
      overCount++;
      excessBidValue+=itemBid;
      excessCost+=itemExcessCost;
    }
  });

  return {overCount,excessBidValue,excessCost};
}

function projectedLineImpact(line){
  if(line.isOutsideBoq)return {excessQty:Number(line.boqQty||0)};
  const b=baseline.find(x=>x.id===line.baselineItemId),row=aggregateRows().find(x=>x.key===line.baselineItemId);
  const before=Number(row?.confirmedQty||0),after=before+Number(line.boqQty||0);
  return {excessQty:Math.max(0,after-Number(b?.qty||0))};
}

function summaryTotals(rows){
  const baselineValue=rows.filter(r=>!r.isOutside).reduce((s,r)=>s+Number(r.baselineQty||0)*Number(r.bidUnit||0),0);
  const tenderValue=rows.filter(r=>!r.isOutside).reduce((s,r)=>s+Number(r.tenderQty||0)*Number(r.tenderBidUnit||0),0);
  const contractRows=rows.filter(r=>!r.isOutside&&(Math.abs(Number(r.contractDeltaQty||0))>1e-9||Math.abs(Number(r.contractDeltaValue||0))>0.5));
  const confirmed=requests.filter(r=>COUNTED_STATUSES.has(r.status));
  const orderedValue=rows.reduce((s,r)=>s+Number(r.confirmedQty||0)*Number(r.bidUnit||0),0);
  const over=rows.filter(r=>(r.isOutside&&r.confirmedQty>0)||r.confirmedQty>r.baselineQty);
  return {
    baselineValue,tenderValue,contractDeltaValue:baselineValue-tenderValue,contractChangedCount:contractRows.length,
    orderedValue,confirmedRequests:confirmed.length,
    overCount:over.length,outsideCount:rows.filter(r=>r.isOutside&&r.confirmedQty>0).length,
    excessBidValue:over.reduce((s,r)=>s+Number(r.excessBidValue||0),0),
    excessCost:over.reduce((s,r)=>s+Number(r.excessCost||0),0),
    nearCount:rows.filter(r=>!r.isOutside&&r.baselineQty>0&&r.confirmedQty/r.baselineQty>=0.9&&r.confirmedQty<=r.baselineQty).length
  };
}

function rowState(r){
  if(r.isOutside&&r.confirmedQty>0)return {key:"RED",label:"NGOÀI BOQ",color:"red"};
  if(r.confirmedQty>r.baselineQty)return {key:"RED",label:"VƯỢT BOQ",color:"red"};
  if(!r.isOutside&&r.baselineQty>0&&r.confirmedQty+r.pendingQty>r.baselineQty)return {key:"YELLOW",label:"CHỜ DUYỆT SẼ VƯỢT",color:"orange"};
  const usage=r.baselineQty?r.confirmedQty/r.baselineQty:0;
  const projected=r.baselineQty?(r.confirmedQty+r.pendingQty)/r.baselineQty:0;
  if(usage>=0.9||projected>=0.9)return {key:"YELLOW",label:usage>=0.9?"GẦN HẾT":"CHỜ DUYỆT GẦN HẾT",color:"orange"};
  if(r.confirmedQty>0)return {key:"GREEN",label:"TRONG BOQ",color:"green"};
  return {key:"GRAY",label:"CHƯA ĐẶT",color:"gray"};
}

function canEditRequest(r){
  const u=getProfile()||{};
  if(["ADMIN","DIRECTOR","MANAGER"].includes(u.role))return r.status==="DRAFT";
  return r.status==="DRAFT"&&r.requesterUid===u.uid&&can("quantityRequestCreate");
}

async function audit(action,message,extra={}){
  const u=getProfile()||{},key=refs.quantityAuditProject(projectId).push().key;
  await refs.quantityAuditItem(projectId,key).set({
    action,message,...sanitize(extra),userUid:u.uid||"",userName:u.displayName||"",userEmail:u.email||"",createdAt:ts()
  });
}

async function reload(){
  await loadData();paint();
}

function exportCsv(){
  const rows=aggregateRows(),totals=summaryTotals(rows);
  const data=[
    ["KIỂM SOÁT KHỐI LƯỢNG ĐẶT HÀNG"],
    ["Tender Revision",tenderRevision?.code||"R0",tenderRevision?.name||""],
    ["Baseline áp dụng",activeRevision?.code||baselineMeta.activeRevisionCode||"R0",activeRevision?.name||baselineMeta.activeRevisionName||""],
    ["Ngày kích hoạt",fmtDateTime(baselineMeta.activatedAt||baselineMeta.frozenAt)],
    ["Giá trị Tender R0",totals.tenderValue],
    ["Giá trị Baseline hiện hành",totals.baselineValue],
    ["Chênh HĐ so Tender",totals.contractDeltaValue],
    ["Giá trị vượt do công trường",totals.excessBidValue],
    [],
    ["Mã BOQ","Hệ","Mô tả","Thông số","ĐVT","Tender R0","Baseline hiện hành","Δ HĐ","Đã duyệt/đặt","Chờ duyệt","Còn lại","Vượt công trường","% sử dụng","Giá HĐ/ĐVT","GT Δ HĐ","GT vượt công trường","Chi phí vượt","Trạng thái"],
    ...rows.map(r=>[
      r.itemNo,r.discipline,r.description,r.specification,r.unit,r.tenderQty,r.baselineQty,r.contractDeltaQty,
      r.confirmedQty,r.pendingQty,r.baselineQty-r.confirmedQty,Math.max(0,r.confirmedQty-r.baselineQty),
      r.baselineQty?r.confirmedQty/r.baselineQty*100:(r.confirmedQty?100:0),r.bidUnit,r.contractDeltaValue,r.excessBidValue,r.excessCost,rowState(r).label
    ]),
    [],
    ["BOQ REVISION"],
    ["Rev","Loại","Tên","Ngày hiệu lực","Trạng thái","Số dòng","Giá trị","Nguồn file"],
    ...[...revisions].sort((a,b)=>Number(a.revisionNo||0)-Number(b.revisionNo||0)).map(r=>[
      r.code,r.type,r.name,r.effectiveDate,r.status,r.lineCount||Object.keys(r.items||{}).length,revisionTotal(r.items||{}),r.sourceFileName||r.source||""
    ]),
    [],
    ["PHIẾU ĐẶT HÀNG"],
    ["Mã phiếu","Ngày","Người đề nghị","Khu vực","Trạng thái","Số dòng","Ghi chú"],
    ...requests.map(r=>[r.code,r.requestDate,r.requesterName,r.location,statusInfo(r.status).label,linesOf(r).length,r.notes])
  ];
  downloadCsv(`KIEM_SOAT_KHOI_LUONG_${activeRevision?.code||"R0"}_${projectId}.csv`,data);
}

function linesOf(r){return toArray(r?.lines||{})}
function statusInfo(k){const x=ORDER_STATUSES[k]||[k||"Nháp","gray"];return{label:x[0],color:x[1]}}
function reasonLabel(k){return REASONS.find(x=>x[0]===k)?.[1]||"Khác"}
function statusVariation(k){return {DRAFT:"Nháp",SUBMITTED:"Đã trình",APPROVED:"Đã duyệt",REJECTED:"Từ chối"}[k]||k||""}
function calcBoq(x){const base=Number(x.materialUnit||0)+Number(x.laborUnit||0)+Number(x.subcontractUnit||0)+Number(x.otherUnit||0),netUnit=base*(1+Number(x.wastePct||0)/100),bidUnit=netUnit*(1+Number(x.markupPct||0)/100);return{netUnit,bidUnit}}
function itemSort(a,b){return String(a.itemNo||"").localeCompare(String(b.itemNo||""),"vi",{numeric:true})}
function outsideKey(desc,spec,unit){return norm(`${desc}|${spec}|${unit}`).replace(/[^a-z0-9|_-]+/g,"-").slice(0,160)}
function nextRequestCode(){
  const y=new Date().getFullYear();
  const max=requests.reduce((m,r)=>{const x=String(r.code||"").match(new RegExp(`^DDH-${y}-(\\d+)$`));return x?Math.max(m,Number(x[1]||0)):m},0);
  return `DDH-${y}-${String(max+1).padStart(3,"0")}`;
}
function todayIso(){return new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)}
function num(v,d=2){return Number(v||0).toLocaleString("vi-VN",{maximumFractionDigits:d})}
function signedQty(v){const n=Number(v||0);return `${n>0?"+":""}${num(n,3)}`}
function signedMoney(v){const n=Number(v||0);return `${n>0?"+":n<0?"-":""}${money(Math.abs(n))}`}
function toArray(v){return Object.entries(v||{}).map(([id,x])=>({id,...(x||{})}))}
function sanitize(v){try{return JSON.parse(JSON.stringify(v??{}))}catch{return{}}}
function metric(label,value,icon,c,s,foot){return `<div class="metric" style="--c:${c};--s:${s}"><div class="metric-head"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></div>`}
function smallMetric(label,value,color="blue"){return `<div class="mini-metric ${color}"><span>${label}</span><b>${value}</b></div>`}
function csvEscape(v){return `"${String(v??"").replaceAll('"','""')}"`}
function downloadCsv(name,rows){const csv=rows.map(r=>(r||[]).map(csvEscape).join(";")).join("\r\n"),blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
