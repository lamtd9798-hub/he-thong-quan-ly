import {refs,arr,ts,logActivity,can,getProfile,esc,money,fmtDate,daysUntil,TENDER_STAGES,stageInfo,setPage,loading,empty,badge,modal,toast,confirmBox} from "../core.js";

let projects=[],rfqs=[],approvals=[],boqData={},tab="pipeline";

export async function renderTender(container){
  setPage("Đấu thầu","Công việc / Đấu thầu");container.innerHTML=loading();
  [projects,rfqs,approvals]=await Promise.all([arr(refs.projects()),arr(refs.rfqs()),can("finance")?arr(refs.approvals()):Promise.resolve([])]);
  projects=projects.filter(x=>x.phase!=="CLOSED");paint(container);
}
function paint(c){
  if(tab==="approval"&&!can("finance"))tab="pipeline";
  c.innerHTML=`<div class="page-head"><div><h2>Quản lý đấu thầu</h2><p>Nhận hồ sơ → hỏi giá → lập giá → trình duyệt → nộp thầu → kết quả.</p></div></div>
  <div class="subtabs"><button class="subtab ${tab==="pipeline"?"active":""}" data-tab="pipeline">Pipeline</button><button class="subtab ${tab==="rfq"?"active":""}" data-tab="rfq">RFQ / Hỏi giá</button>${can("finance")?`<button class="subtab ${tab==="approval"?"active":""}" data-tab="approval">Trình & duyệt giá</button>`:""}</div><div id="tabBody"></div>`;
  c.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.tab;paint(c)}));
  const body=c.querySelector("#tabBody");if(tab==="pipeline")pipeline(body,c);if(tab==="rfq")rfqView(body,c);if(tab==="approval")approvalView(body,c);
}
function pipeline(body,c){
  body.innerHTML=`<div class="pipeline-wrap"><div class="pipeline">${TENDER_STAGES.map(s=>{
    const list=projects.filter(x=>x.phase==="TENDER"&&(x.tenderStatus||"RECEIVED")===s[0]);
    return `<div class="pipe-col"><div class="pipe-head"><b>${s[1].toUpperCase()}</b><span>${list.length}</span></div><div class="pipe-cards">${list.length?list.map(x=>{
      const d=daysUntil(x.tenderDeadline);
      return `<div class="pipe-card"><div class="pipe-code">${esc(x.code||"—")}</div><h4>${esc(x.name||"")}</h4><div class="pipe-meta"><span>${esc(x.ownerName||"Chưa phân công")}</span><span class="${d!==null&&d<=2?"danger-text":""}">${x.tenderDeadline?(d<0?"Quá hạn":d+" ngày"):"—"}</span></div>${can("tenderEdit")?`<div class="pipe-actions"><button class="btn sm" data-stage="${x.id}">Cập nhật</button>${s[0]==="WON"?`<button class="btn green sm" data-handover="${x.id}">Bàn giao</button>`:""}</div>`:""}</div>`}).join(""):`<div class="secondary-text" style="text-align:center;padding:18px 5px">Chưa có dự án</div>`}</div></div>`}).join("")}</div></div>`;
  body.querySelectorAll("[data-stage]").forEach(b=>b.addEventListener("click",()=>changeStage(b.dataset.stage,c)));
  body.querySelectorAll("[data-handover]").forEach(b=>b.addEventListener("click",()=>handover(b.dataset.handover,c)));
}
function changeStage(id,c){
  const p=projects.find(x=>x.id===id);if(!p)return;
  modal({title:"Cập nhật trạng thái đấu thầu",eyebrow:p.code||"",size:"sm",body:`<div class="field"><span>Trạng thái</span><select name="tenderStatus">${TENDER_STAGES.map(s=>`<option value="${s[0]}" ${p.tenderStatus===s[0]?"selected":""}>${s[1]}</option>`).join("")}</select></div><label class="field mt"><span>Ghi chú cập nhật</span><textarea name="note"></textarea></label>`,onSubmit:async fd=>{
    const status=fd.get("tenderStatus"),info=stageInfo(status);await refs.project(id).update({tenderStatus:status,updatedAt:ts()});await logActivity("TENDER_STAGE",`${p.code} chuyển sang ${info.label}`,{projectId:id,note:fd.get("note")||""});toast("Đã cập nhật trạng thái.");await renderTender(c);return true;
  }});
}
async function handover(id,c){
  const p=projects.find(x=>x.id===id);if(!p)return;if(!await confirmBox("Bàn giao sang kỹ thuật",`Chuyển ${p.code} - ${p.name} sang giai đoạn triển khai?`,"Bàn giao"))return;
  await refs.project(id).update({phase:"EXECUTION",tenderStatus:"WON",updatedAt:ts()});
  const snap=await refs.executionProject(id).once("value");if(!snap.exists())await refs.executionProject(id).set({projectId:id,status:"HANDOVER",progress:0,createdAt:ts(),updatedAt:ts()});
  await logActivity("HANDOVER",`Bàn giao ${p.code} sang phòng kỹ thuật`,{projectId:id});toast("Đã bàn giao dự án.");await renderTender(c);
}
function rfqView(body,c){
  const list=[...rfqs].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  body.innerHTML=`<div class="page-head"><div><h2 style="font-size:17px">RFQ / Hỏi giá nhà cung cấp</h2><p>Quản lý các gói hỏi giá và tình trạng phản hồi.</p></div>${can("rfqEdit")?`<button id="addRfq" class="btn primary">＋ Tạo RFQ</button>`:""}</div>
  <div class="table-wrap"><table class="table"><thead><tr><th>DỰ ÁN</th><th>GÓI / HẠNG MỤC</th><th>NHÀ CUNG CẤP</th><th>LIÊN HỆ</th><th>HẠN PHẢN HỒI</th><th>TRẠNG THÁI</th><th>GIÁ BÁO</th><th style="text-align:right">THAO TÁC</th></tr></thead><tbody>${list.length?list.map(rfqRow).join(""):`<tr><td colspan="8">${empty("Chưa có RFQ","Tạo RFQ đầu tiên để theo dõi việc hỏi giá.","◆")}</td></tr>`}</tbody></table></div>`;
  body.querySelector("#addRfq")?.addEventListener("click",()=>editRfq(null,c));
  body.querySelectorAll("[data-rfq-edit]").forEach(b=>b.addEventListener("click",()=>editRfq(b.dataset.rfqEdit,c)));
  body.querySelectorAll("[data-rfq-del]").forEach(b=>b.addEventListener("click",()=>delRfq(b.dataset.rfqDel,c)));
}
function rfqRow(r){
  const p=projects.find(x=>x.id===r.projectId),map={DRAFT:["Nháp","gray"],SENT:["Đã gửi","blue"],RECEIVED:["Đã nhận báo giá","green"],SELECTED:["Được chọn","purple"],CLOSED:["Đã đóng","gray"]},s=map[r.status]||[r.status||"Nháp","gray"];
  return `<tr><td><div class="primary-text">${esc(p?.code||"—")}</div><div class="secondary-text">${esc(p?.name||"")}</div></td><td>${esc(r.packageName||"—")}</td><td>${esc(r.supplier||"—")}</td><td>${esc(r.contact||"—")}</td><td>${fmtDate(r.dueDate)}</td><td>${badge(s[0],s[1])}</td><td>${r.amount?money(r.amount):"—"}</td><td><div class="row-actions">${can("rfqEdit")?`<button class="btn sm" data-rfq-edit="${r.id}">Sửa</button><button class="btn red sm" data-rfq-del="${r.id}">Xóa</button>`:""}</div></td></tr>`;
}
function editRfq(id,c){
  const r=rfqs.find(x=>x.id===id)||{};
  modal({title:id?"Cập nhật RFQ":"Tạo RFQ / Hỏi giá",eyebrow:"ĐẤU THẦU",size:"lg",body:`<div class="form-grid">
    <label class="field"><span>Dự án *</span><select required name="projectId"><option value="">-- Chọn dự án --</option>${projects.filter(x=>x.phase==="TENDER").map(p=>`<option value="${p.id}" ${r.projectId===p.id?"selected":""}>${esc(p.code)} - ${esc(p.name)}</option>`).join("")}</select></label>
    <label class="field"><span>Gói / Hạng mục *</span><input required name="packageName" value="${esc(r.packageName||"")}"></label>
    <label class="field"><span>Nhà cung cấp *</span><input required name="supplier" value="${esc(r.supplier||"")}"></label>
    <label class="field"><span>Liên hệ</span><input name="contact" value="${esc(r.contact||"")}" placeholder="Email / SĐT"></label>
    <label class="field"><span>Ngày gửi</span><input type="date" name="sentDate" value="${esc(r.sentDate||"")}"></label>
    <label class="field"><span>Hạn phản hồi</span><input type="date" name="dueDate" value="${esc(r.dueDate||"")}"></label>
    <label class="field"><span>Trạng thái</span><select name="status">${[["DRAFT","Nháp"],["SENT","Đã gửi"],["RECEIVED","Đã nhận báo giá"],["SELECTED","Được chọn"],["CLOSED","Đã đóng"]].map(s=>`<option value="${s[0]}" ${r.status===s[0]?"selected":""}>${s[1]}</option>`).join("")}</select></label>
    <label class="field"><span>Giá báo (VNĐ)</span><input type="number" min="0" name="amount" value="${r.amount||""}"></label>
    <label class="field span2"><span>Ghi chú</span><textarea name="notes">${esc(r.notes||"")}</textarea></label></div>`,onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.amount=Number(d.amount||0);d.updatedAt=ts();if(id)await refs.rfq(id).update(d);else{const key=refs.rfqs().push().key;d.createdAt=ts();await refs.rfq(key).set(d)}
      await refs.project(d.projectId).update({tenderStatus:"RFQ",updatedAt:ts()});await logActivity("RFQ_SAVED",`${id?"Cập nhật":"Tạo"} RFQ ${d.packageName}`,{projectId:d.projectId});toast("Đã lưu RFQ.");tab="rfq";await renderTender(c);return true;
    }});
}
async function delRfq(id,c){
  const r=rfqs.find(x=>x.id===id);if(!await confirmBox("Xóa RFQ",`Xóa RFQ ${r?.packageName||""} của ${r?.supplier||""}?`,"Xóa"))return;await refs.rfq(id).remove();toast("Đã xóa RFQ.","warning");tab="rfq";await renderTender(c);
}
function approvalView(body,c){
  const list=[...approvals].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  body.innerHTML=`<div class="page-head"><div><h2 style="font-size:17px">Trình & duyệt giá</h2><p>Mỗi lần trình tạo một phiên bản riêng để giữ lịch sử giá.</p></div>${can("approvalSubmit")?`<button id="newApproval" class="btn primary">＋ Trình giá</button>`:""}</div>
  <div class="table-wrap"><table class="table"><thead><tr><th>DỰ ÁN</th><th>PHIÊN BẢN</th><th>GIÁ NET</th><th>GIÁ CHÀO</th><th>LN GỘP</th><th>TRẠNG THÁI</th><th>NGƯỜI TRÌNH</th><th>NGÀY TRÌNH</th><th style="text-align:right">THAO TÁC</th></tr></thead><tbody>${list.length?list.map(approvalRow).join(""):`<tr><td colspan="9">${empty("Chưa có hồ sơ trình giá","Tạo phiên bản trình giá để Giám đốc duyệt.","◇")}</td></tr>`}</tbody></table></div>`;
  body.querySelector("#newApproval")?.addEventListener("click",()=>newApproval(c));body.querySelectorAll("[data-approval]").forEach(b=>b.addEventListener("click",()=>viewApproval(b.dataset.approval,c)));
}
function approvalRow(a){
  const p=projects.find(x=>x.id===a.projectId),status={PENDING:["Chờ duyệt","orange"],APPROVED:["Đã duyệt","green"],REJECTED:["Từ chối","red"]}[a.status]||[a.status||"—","gray"],profit=Number(a.bidPrice||0)-Number(a.netPrice||0),margin=a.bidPrice?profit/Number(a.bidPrice)*100:0;
  return `<tr><td><div class="primary-text">${esc(p?.code||"—")}</div><div class="secondary-text">${esc(p?.name||"")}</div></td><td>V${String(a.version||1).padStart(2,"0")}</td><td>${money(a.netPrice)}</td><td>${money(a.bidPrice)}</td><td>${money(profit)} <span class="secondary-text">(${margin.toFixed(1)}%)</span></td><td>${badge(status[0],status[1])}</td><td>${esc(a.submittedByName||a.submittedByEmail||"—")}</td><td>${fmtDate(a.submittedDate)}</td><td><div class="row-actions"><button class="btn sm" data-approval="${a.id}">Xem</button></div></td></tr>`;
}
function boqTotals(projectId){
  const val=boqData[projectId]||{};
  const lines=Object.values(val);
  let net=0,bid=0;
  lines.forEach(x=>{
    const qty=Number(x.qty||0);
    const base=Number(x.materialUnit||0)+Number(x.laborUnit||0)+Number(x.subcontractUnit||0)+Number(x.otherUnit||0);
    const netUnit=base*(1+Number(x.wastePct||0)/100);
    const bidUnit=netUnit*(1+Number(x.markupPct||0)/100);
    net+=qty*netUnit;bid+=qty*bidUnit;
  });
  return {net,bid,count:lines.length,profit:bid-net,margin:bid?(bid-net)/bid*100:0};
}
function newApproval(c){
  const tender=projects.filter(x=>x.phase==="TENDER");
  modal({title:"Trình duyệt giá",eyebrow:"PHÊ DUYỆT",size:"lg",submitText:"Gửi duyệt",body:`<div class="form-grid">
    <label class="field span2"><span>Dự án *</span><select required name="projectId" id="approvalProject"><option value="">-- Chọn dự án --</option>${tender.map(p=>`<option value="${p.id}">${esc(p.code)} - ${esc(p.name)}</option>`).join("")}</select></label>

    <div class="span2 approval-boq-summary" id="approvalBoqSummary">
      <div class="empty" style="padding:20px"><b>▧</b><h3>Chọn dự án</h3><p>Hệ thống sẽ tự lấy tổng giá từ BOQ & Lập giá.</p></div>
    </div>

    <label class="field"><span>Giá NET trình duyệt *</span><input required type="number" min="0" step="any" name="netPrice" id="approvalNet"></label>
    <label class="field"><span>Giá chào trình duyệt *</span><input required type="number" min="0" step="any" name="bidPrice" id="approvalBid"></label>
    <label class="field span2"><span>Rủi ro / Ngoại lệ / Exclusion</span><textarea name="risks"></textarea></label>
    <label class="field span2"><span>Ghi chú trình duyệt</span><textarea name="notes" placeholder="Nếu chỉnh giá khác với tổng BOQ, ghi rõ lý do tại đây."></textarea></label>
  </div>`,onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());
      d.netPrice=Number(d.netPrice||0);d.bidPrice=Number(d.bidPrice||0);
      const b=boqTotals(d.projectId);
      if(!b.count){toast("Dự án chưa có BOQ. Hãy lập BOQ trước khi trình giá.","error");return false}
      d.boqNetPrice=b.net;d.boqBidPrice=b.bid;d.boqLineCount=b.count;
      const versions=approvals.filter(x=>x.projectId===d.projectId).map(x=>Number(x.version||0));d.version=(versions.length?Math.max(...versions):0)+1;
      const p=getProfile();d.status="PENDING";d.submittedBy=p.uid;d.submittedByName=p.displayName||"";d.submittedByEmail=p.email||"";d.submittedDate=new Date().toISOString().slice(0,10);d.createdAt=ts();d.updatedAt=ts();
      const key=refs.approvals().push().key;await refs.approval(key).set(d);
      await refs.project(d.projectId).update({tenderStatus:"APPROVAL",approvalStatus:"PENDING",updatedAt:ts()});
      await logActivity("APPROVAL_SUBMITTED",`Trình duyệt giá V${d.version} từ ${d.boqLineCount} dòng BOQ`,{projectId:d.projectId});
      toast("Đã gửi hồ sơ trình duyệt.");tab="approval";await renderTender(c);return true;
    }});
  const select=document.querySelector("#approvalProject");
  const summary=document.querySelector("#approvalBoqSummary");
  const netInput=document.querySelector("#approvalNet");
  const bidInput=document.querySelector("#approvalBid");
  select?.addEventListener("change",()=>{
    const t=boqTotals(select.value);
    if(!t.count){
      summary.innerHTML=`<div class="alert error">Dự án này chưa có BOQ. Vào <b>BOQ & Lập giá</b> để nhập khối lượng và giá trước.</div>`;
      netInput.value="";bidInput.value="";return;
    }
    netInput.value=Math.round(t.net);bidInput.value=Math.round(t.bid);
    summary.innerHTML=`<div class="grid g4">
      <div class="metric" style="--c:#64748b"><div class="metric-head"><span>DÒNG BOQ</span></div><div class="metric-value" style="font-size:18px">${t.count}</div></div>
      <div class="metric" style="--c:#64748b"><div class="metric-head"><span>NET TỪ BOQ</span></div><div class="metric-value" style="font-size:17px">${money(t.net)}</div></div>
      <div class="metric" style="--c:#2563eb"><div class="metric-head"><span>GIÁ CHÀO TỪ BOQ</span></div><div class="metric-value" style="font-size:17px">${money(t.bid)}</div></div>
      <div class="metric" style="--c:#16a34a"><div class="metric-head"><span>LN GỘP</span></div><div class="metric-value" style="font-size:18px">${t.margin.toFixed(1)}%</div><div class="metric-foot">${money(t.profit)}</div></div>
    </div>`;
  });
}
function viewApproval(id,c){
  const a=approvals.find(x=>x.id===id);if(!a)return;const p=projects.find(x=>x.id===a.projectId),profit=Number(a.bidPrice||0)-Number(a.netPrice||0),margin=a.bidPrice?profit/Number(a.bidPrice)*100:0,decide=can("approvalDecide")&&a.status==="PENDING";
  modal({title:`${p?.code||""} · V${String(a.version||1).padStart(2,"0")}`,eyebrow:"HỒ SƠ TRÌNH GIÁ",size:"lg",showSubmit:false,body:`<div class="grid g3">
    <div class="metric" style="--c:#64748b"><div class="metric-head"><span>GIÁ NET</span></div><div class="metric-value" style="font-size:19px">${money(a.netPrice)}</div></div>
    <div class="metric" style="--c:#2563eb"><div class="metric-head"><span>GIÁ CHÀO</span></div><div class="metric-value" style="font-size:19px">${money(a.bidPrice)}</div></div>
    <div class="metric" style="--c:#16a34a"><div class="metric-head"><span>LỢI NHUẬN GỘP</span></div><div class="metric-value" style="font-size:19px">${margin.toFixed(1)}%</div><div class="metric-foot">${money(profit)}</div></div></div>
    ${a.boqLineCount?`<div class="card mt"><div class="card-head"><h3>Dữ liệu BOQ tại thời điểm trình</h3>${badge(`${a.boqLineCount} dòng BOQ`,"blue")}</div><div class="card-body"><div class="grid g4">
      <div><div class="secondary-text">NET từ BOQ</div><div class="primary-text">${money(a.boqNetPrice)}</div></div>
      <div><div class="secondary-text">Giá chào từ BOQ</div><div class="primary-text">${money(a.boqBidPrice)}</div></div>
      <div><div class="secondary-text">Điều chỉnh NET</div><div class="primary-text">${money(Number(a.netPrice||0)-Number(a.boqNetPrice||0))}</div></div>
      <div><div class="secondary-text">Điều chỉnh giá chào</div><div class="primary-text">${money(Number(a.bidPrice||0)-Number(a.boqBidPrice||0))}</div></div>
    </div></div></div>`:""}
    <div class="grid g2 mt"><div class="card"><div class="card-head"><h3>Rủi ro / Exclusion</h3></div><div class="card-body" style="font-size:11px;white-space:pre-wrap">${esc(a.risks||"—")}</div></div><div class="card"><div class="card-head"><h3>Ghi chú</h3></div><div class="card-body" style="font-size:11px;white-space:pre-wrap">${esc(a.notes||"—")}</div></div></div>
    ${a.decisionNote?`<div class="card mt"><div class="card-head"><h3>Ý kiến phê duyệt</h3></div><div class="card-body" style="font-size:11px">${esc(a.decisionNote)}</div></div>`:""}
    ${decide?`<div class="actions mt"><button type="button" id="approvePrice" class="btn green">✓ Duyệt giá</button><button type="button" id="rejectPrice" class="btn red">✕ Từ chối</button></div>`:""}`});
  document.querySelector("#approvePrice")?.addEventListener("click",()=>decideApproval(a,true,c));document.querySelector("#rejectPrice")?.addEventListener("click",()=>decideApproval(a,false,c));
}
function decideApproval(a,yes,c){
  modal({title:yes?"Duyệt giá chào":"Từ chối hồ sơ",eyebrow:"GIÁM ĐỐC",size:"sm",submitText:yes?"Xác nhận duyệt":"Xác nhận từ chối",body:`<label class="field"><span>Ý kiến phê duyệt</span><textarea name="decisionNote" placeholder="${yes?"Có thể để trống.":"Nhập lý do cần chỉnh sửa..."}"></textarea></label>`,onSubmit:async fd=>{
    const p=getProfile(),status=yes?"APPROVED":"REJECTED";await refs.approval(a.id).update({status,decisionNote:fd.get("decisionNote")||"",decidedBy:p.uid,decidedByName:p.displayName||"",decidedAt:ts(),updatedAt:ts()});await refs.project(a.projectId).update({approvalStatus:status,...(yes?{approvedBidPrice:a.bidPrice,approvedNetPrice:a.netPrice}:{}),updatedAt:ts()});await logActivity(yes?"APPROVAL_APPROVED":"APPROVAL_REJECTED",`${yes?"Duyệt":"Từ chối"} giá V${a.version}`,{projectId:a.projectId});toast(yes?"Đã duyệt giá chào.":"Đã từ chối hồ sơ.",yes?"success":"warning");tab="approval";await renderTender(c);return true;
  }});
}
