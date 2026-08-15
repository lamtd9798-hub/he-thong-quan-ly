import {
  refs,arr,ts,logActivity,getProfile,can,esc,norm,money,fmtDate,fmtDateTime,
  loading,empty,badge,modal,toast,confirmBox
} from "../core.js?v=2.7.0";

let projectId="";
let mountEl=null;
let baseline=[];
let baselineMeta={};
let requests=[];
let audits=[];
let variations=[];
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
  if(!projectId){baseline=[];baselineMeta={};requests=[];audits=[];variations=[];return}
  const reads=[
    refs.quantityBaselineProject(projectId).once("value"),
    refs.quantityBaselineMeta(projectId).once("value"),
    refs.orderRequestsProject(projectId).once("value"),
    refs.quantityAuditProject(projectId).once("value")
  ];
  if(can("quantityVariationCreate"))reads.push(refs.variationsProject(projectId).once("value"));
  else reads.push(Promise.resolve({val:()=>({})}));

  const [b,m,r,a,v]=await Promise.all(reads);
  baseline=toArray(b.val()).sort(itemSort);
  baselineMeta=m.val()||{};
  requests=toArray(r.val()).sort((x,y)=>String(y.requestDate||"").localeCompare(String(x.requestDate||""))||(y.createdAt||0)-(x.createdAt||0));
  audits=toArray(a.val()).sort((x,y)=>(y.createdAt||0)-(x.createdAt||0));
  variations=toArray(v.val());
}

function paint(){
  if(!mountEl)return;
  if(!baseline.length){
    mountEl.innerHTML=baselineEmptyHtml();
    mountEl.querySelector("#initQuantityBaselineBtn")?.addEventListener("click",initializeBaseline);
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
        ${can("quantityRequestCreate")?`<button class="btn primary" id="newOrderRequestBtn">＋ Tạo phiếu đặt hàng</button>`:""}
      </div>
    </div>

    <div class="quantity-baseline-note">
      <div><b>Baseline BOQ đã khóa</b><span>${baseline.length} đầu mục · ${fmtDateTime(baselineMeta.frozenAt)} · ${esc(baselineMeta.frozenByName||baselineMeta.frozenByEmail||"Hệ thống")}</span></div>
      <div>${badge("Không thay đổi theo BOQ đấu thầu sau bàn giao","blue")}</div>
    </div>

    <div class="grid g6 mt">
      ${metric("Giá trị BOQ",money(totals.baselineValue,true),"BOQ","#2563eb","#eff6ff",`${baseline.length} đầu mục baseline`)}
      ${metric("Giá trị đã đặt",money(totals.orderedValue,true),"ĐH","#7c3aed","#f5f3ff",`${totals.confirmedRequests} phiếu được tính`)}
      ${metric("Đầu mục vượt",totals.overCount,"!","#dc2626","#fef2f2",`${totals.outsideCount} đầu mục ngoài BOQ`)}
      ${metric("GT vượt theo giá chào",money(totals.excessBidValue,true),"↑","#dc2626","#fef2f2","Cơ sở xem xét Variation / VO")}
      ${metric("Chi phí vượt dự kiến",money(totals.excessCost,true),"C","#d97706","#fff7ed","Theo giá mua dự kiến đã nhập")}
      ${metric("Gần hết BOQ",totals.nearCount,"⚠","#d97706","#fff7ed","Từ 90% đến 100%")}
    </div>

    <div class="quantity-toolbar mt">
      <div class="subtabs" style="margin:0">
        ${[
          ["SUMMARY","Tổng hợp BOQ"],
          ["REQUESTS","Phiếu đặt hàng"],
          ["OUTSIDE","Ngoài BOQ"],
          ["HISTORY","Lịch sử"]
        ].map(x=>`<button class="subtab ${view===x[0]?"active":""}" data-qty-view="${x[0]}">${x[1]}</button>`).join("")}
      </div>
      ${view==="SUMMARY"?`<div class="search"><input id="qtySearch" value="${esc(q)}" placeholder="Tìm mã BOQ, vật tư, hệ, thông số..."></div>`:""}
    </div>

    <div id="quantityViewBody">
      ${view==="SUMMARY"?summaryHtml(filtered):
        view==="REQUESTS"?requestsHtml():
        view==="OUTSIDE"?outsideHtml(rows):
        historyHtml()}
    </div>
  `;

  bind();
}

function baselineEmptyHtml(){
  return `<div class="quantity-empty">
    ${empty("Chưa có Baseline BOQ","Khối lượng kiểm soát phải được khóa từ BOQ trúng thầu trước khi công trường bắt đầu đặt hàng.","▦")}
    ${can("quantityBaselineCreate")?`<div style="text-align:center;margin-top:12px"><button class="btn primary" id="initQuantityBaselineBtn">Khởi tạo Baseline từ BOQ hiện tại</button><div class="secondary-text" style="margin-top:7px">Chỉ nên thực hiện một lần sau khi đã chốt/trúng thầu.</div></div>`:""}
  </div>`;
}

function summaryHtml(rows){
  return `<div class="qty-info-strip">Chênh lệch âm hiện tại là phần BOQ <b>chưa được đặt</b>; chỉ nên xem là khối lượng giảm thực tế khi dự án đã chốt khối lượng cuối cùng.</div>
  <div class="table-wrap"><table class="table quantity-summary-table"><thead><tr>
    <th>MÃ BOQ</th><th>HỆ</th><th>VẬT TƯ / CÔNG VIỆC</th><th>ĐVT</th>
    <th>KL BOQ</th><th>ĐÃ DUYỆT/ĐẶT</th><th>CHỜ DUYỆT</th><th>CÒN LẠI</th>
    <th>TĂNG/GIẢM</th><th>% SỬ DỤNG</th><th>GIÁ CHÀO/ĐVT</th><th>GT CHÊNH</th>
    <th>CHI PHÍ VƯỢT</th><th>TRẠNG THÁI</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${rows.length?rows.map(summaryRow).join(""):`<tr><td colspan="15">${empty("Không có dữ liệu","Không có đầu mục phù hợp bộ lọc.","▦")}</td></tr>`}
  </tbody></table></div>`;
}

function summaryRow(r){
  const state=rowState(r);
  const diff=r.confirmedQty-r.baselineQty;
  const remaining=r.baselineQty-r.confirmedQty;
  return `<tr class="qty-row-${state.key.toLowerCase()}">
    <td><b>${esc(r.itemNo||"—")}</b></td>
    <td>${badge(r.discipline||"KHÁC","gray")}</td>
    <td><div class="primary-text">${esc(r.description||"—")}</div><div class="secondary-text">${esc(r.specification||"")}</div></td>
    <td>${esc(r.unit||"—")}</td>
    <td>${num(r.baselineQty,3)}</td>
    <td><b>${num(r.confirmedQty,3)}</b></td>
    <td>${r.pendingQty?`<span class="qty-pending">${num(r.pendingQty,3)}</span>`:"0"}</td>
    <td class="${remaining<0?"danger-text":""}">${num(remaining,3)}</td>
    <td class="${diff>0?"danger-text":diff<0?"positive-text":""}"><b>${signedQty(diff)}</b></td>
    <td>${usageHtml(r)}</td>
    <td>${money(r.bidUnit)}</td>
    <td class="${r.diffBidValue>0?"danger-text":r.diffBidValue<0?"positive-text":""}"><b>${signedMoney(r.diffBidValue)}</b></td>
    <td class="${r.excessCost>0?"danger-text":""}><b>${money(r.excessCost)}</b></td>
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
  mountEl.querySelector("#exportQtyCsvBtn")?.addEventListener("click",exportCsv);
  mountEl.querySelectorAll("[data-request-view]").forEach(b=>b.addEventListener("click",()=>viewRequest(b.dataset.requestView)));
  mountEl.querySelectorAll("[data-request-edit]").forEach(b=>b.addEventListener("click",()=>editRequest(b.dataset.requestEdit)));
  mountEl.querySelectorAll("[data-qty-history]").forEach(b=>b.addEventListener("click",()=>itemHistory(b.dataset.qtyHistory)));
  mountEl.querySelectorAll("[data-qty-vo]").forEach(b=>b.addEventListener("click",()=>createVariationFromRow(b.dataset.qtyVo)));
}

async function initializeBaseline(){
  if(!can("quantityBaselineCreate"))return;
  const existing=await refs.quantityBaselineProject(projectId).once("value");
  if(existing.exists()){toast("Baseline đã tồn tại và đang được khóa.","warning");await reload();return}

  const boq=await arr(refs.boqProject(projectId));
  if(!boq.length){toast("Dự án chưa có BOQ để tạo Baseline.","error");return}
  if(!await confirmBox("Khóa Baseline BOQ",`Khóa ${boq.length} đầu mục BOQ hiện tại làm cơ sở kiểm soát khối lượng? Sau khi tạo, Baseline không tự thay đổi theo BOQ đấu thầu.`,"Khóa Baseline"))return;

  const data={};
  let total=0;
  boq.forEach(x=>{
    const c=calcBoq(x);
    data[x.id]={
      sourceBoqId:x.id,itemNo:x.itemNo||"",discipline:x.discipline||"KHÁC",category:x.category||"",
      description:x.description||"",specification:x.specification||"",unit:x.unit||"",
      qty:Number(x.qty||0),materialUnit:Number(x.materialUnit||0),netUnit:c.netUnit,bidUnit:c.bidUnit,
      selectedSupplier:x.selectedSupplier||"",brand:x.brand||"",createdAt:Date.now()
    };
    total+=Number(x.qty||0)*c.bidUnit;
  });

  const u=getProfile()||{};
  const meta={
    source:"BOQ_AT_EXECUTION",frozenAt:Date.now(),frozenByUid:u.uid||"",frozenByName:u.displayName||"",frozenByEmail:u.email||"",
    lineCount:boq.length,totalBidValue:total
  };
  await Promise.all([refs.quantityBaselineProject(projectId).set(data),refs.quantityBaselineMeta(projectId).set(meta)]);
  await audit("BASELINE_CREATED",`Khóa Baseline BOQ ${boq.length} đầu mục · ${money(total)}`,{});
  await logActivity("QTY_BASELINE_CREATED",`Khóa Baseline BOQ ${boq.length} đầu mục`,{projectId});
  toast("Đã khóa Baseline BOQ.");await reload();
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
  baseline.forEach(b=>baseMap.set(b.id,{
    key:b.id,isOutside:false,itemNo:b.itemNo||"",discipline:b.discipline||"KHÁC",description:b.description||"",specification:b.specification||"",
    unit:b.unit||"",baselineQty:Number(b.qty||0),bidUnit:Number(b.bidUnit||0),defaultCost:Number(b.materialUnit||0),
    confirmedQty:0,pendingQty:0,orderedValue:0,excessBidValue:0,excessCost:0,diffBidValue:0,reasonLabel:""
  }));

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
          unit:line.unit||"",baselineQty:0,bidUnit:0,defaultCost:0,confirmedQty:0,pendingQty:0,orderedValue:0,excessBidValue:0,excessCost:0,diffBidValue:0,
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
  const baselineValue=baseline.reduce((s,b)=>s+Number(b.qty||0)*Number(b.bidUnit||0),0);
  const confirmed=requests.filter(r=>COUNTED_STATUSES.has(r.status));
  const orderedValue=confirmed.reduce((s,r)=>s+linesOf(r).reduce((a,l)=>a+Number(l.boqQty||0)*Number(l.bidUnit||0),0),0);
  const over=rows.filter(r=>(r.isOutside&&r.confirmedQty>0)||r.confirmedQty>r.baselineQty);
  return {
    baselineValue,orderedValue,confirmedRequests:confirmed.length,
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
  const rows=aggregateRows();
  const data=[
    ["KIỂM SOÁT KHỐI LƯỢNG ĐẶT HÀNG"],
    ["Baseline khóa",fmtDateTime(baselineMeta.frozenAt)],
    [],
    ["Mã BOQ","Hệ","Mô tả","Thông số","ĐVT","KL BOQ","Đã duyệt/đặt","Chờ duyệt","Còn lại","Tăng/Giảm","% sử dụng","Giá chào/ĐVT","GT chênh","Chi phí vượt","Trạng thái"],
    ...rows.map(r=>[r.itemNo,r.discipline,r.description,r.specification,r.unit,r.baselineQty,r.confirmedQty,r.pendingQty,r.baselineQty-r.confirmedQty,r.confirmedQty-r.baselineQty,r.baselineQty?r.confirmedQty/r.baselineQty*100:(r.confirmedQty?100:0),r.bidUnit,r.diffBidValue,r.excessCost,rowState(r).label]),
    [],
    ["PHIẾU ĐẶT HÀNG"],
    ["Mã phiếu","Ngày","Người đề nghị","Khu vực","Trạng thái","Số dòng","Ghi chú"],
    ...requests.map(r=>[r.code,r.requestDate,r.requesterName,r.location,statusInfo(r.status).label,linesOf(r).length,r.notes])
  ];
  downloadCsv(`KIEM_SOAT_KHOI_LUONG_${projectId}.csv`,data);
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
