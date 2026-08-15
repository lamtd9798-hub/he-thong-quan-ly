import {refs,arr,ts,logActivity,can,esc,norm,fmtDate,TENDER_STAGES,DISCIPLINES,stageInfo,projectCode,setPage,loading,empty,badge,modal,toast,confirmBox} from "../core.js?v=2.14.0";

let data=[],filter={q:"",phase:"ALL",stage:"ALL"};

export async function renderProjects(container){
  setPage("Danh mục dự án","Công việc / Dự án");container.innerHTML=loading();
  data=await arr(refs.projects());data.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));paint(container);
}
function paint(c){
  const rows=data.filter(x=>{
    const okq=!filter.q||norm(`${x.code} ${x.name} ${x.client} ${x.location} ${x.ownerName}`).includes(norm(filter.q));
    return okq&&(filter.phase==="ALL"||x.phase===filter.phase)&&(filter.stage==="ALL"||x.tenderStatus===filter.stage);
  });
  c.innerHTML=`
    <div class="page-head"><div><h2>Danh mục dự án</h2><p>Mỗi dự án chỉ tạo một lần và đi xuyên suốt từ đấu thầu đến triển khai.</p></div><div class="actions">${can("projectCreate")?`<button id="addProject" class="btn primary">＋ Tạo dự án</button>`:""}</div></div>
    <div class="toolbar"><div class="search"><input id="qProject" value="${esc(filter.q)}" placeholder="Tìm mã, tên dự án, khách hàng, địa điểm..."></div>
      <select id="phaseFilter"><option value="ALL">Tất cả giai đoạn</option><option value="TENDER" ${filter.phase==="TENDER"?"selected":""}>Đấu thầu</option><option value="EXECUTION" ${filter.phase==="EXECUTION"?"selected":""}>Triển khai</option><option value="CLOSED" ${filter.phase==="CLOSED"?"selected":""}>Đã đóng</option></select>
      <select id="stageFilter"><option value="ALL">Tất cả trạng thái</option>${TENDER_STAGES.map(s=>`<option value="${s[0]}" ${filter.stage===s[0]?"selected":""}>${s[1]}</option>`).join("")}</select>${badge(`${rows.length} dự án`,"gray")}
    </div>
    <div class="table-wrap"><table class="table"><thead><tr><th>MÃ / DỰ ÁN</th><th>KHÁCH HÀNG</th><th>PHẠM VI</th><th>NGÀY NHẬN</th><th>HẠN NỘP</th><th>GIAI ĐOẠN</th><th>TRẠNG THÁI</th><th>PHỤ TRÁCH</th><th style="text-align:right">THAO TÁC</th></tr></thead><tbody>
    ${rows.length?rows.map(row).join(""):`<tr><td colspan="9">${empty("Chưa có dự án","Bấm “Tạo dự án” để tạo hồ sơ đầu tiên.","▣")}</td></tr>`}</tbody></table></div>`;
  c.querySelector("#addProject")?.addEventListener("click",()=>edit());
  c.querySelector("#qProject")?.addEventListener("input",e=>{filter.q=e.target.value;paint(c);requestAnimationFrame(()=>{const i=c.querySelector("#qProject");i?.focus();i?.setSelectionRange(i.value.length,i.value.length)})});
  c.querySelector("#phaseFilter")?.addEventListener("change",e=>{filter.phase=e.target.value;paint(c)});
  c.querySelector("#stageFilter")?.addEventListener("change",e=>{filter.stage=e.target.value;paint(c)});
  c.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>view(b.dataset.view)));
  c.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>edit(b.dataset.edit,c)));
  c.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>del(b.dataset.del,c)));
}
function row(x){
  const s=stageInfo(x.tenderStatus), scopes=Array.isArray(x.disciplines)?x.disciplines:[], phase=x.phase==="EXECUTION"?["Triển khai","green"]:x.phase==="CLOSED"?["Đã đóng","gray"]:["Đấu thầu","blue"];
  return `<tr><td><div class="primary-text">${esc(x.code||"—")}</div><div class="secondary-text">${esc(x.name||"")}</div></td><td><div>${esc(x.client||"—")}</div><div class="secondary-text">${esc(x.location||"")}</div></td><td>${scopes.slice(0,2).map(v=>badge(v)).join(" ")}${scopes.length>2?` ${badge("+"+(scopes.length-2))}`:""}</td><td>${fmtDate(x.receivedDate)}</td><td>${fmtDate(x.tenderDeadline)}</td><td>${badge(phase[0],phase[1])}</td><td>${badge(s.label,s.color)}</td><td>${esc(x.ownerName||"—")}</td><td><div class="row-actions"><button class="btn sm" data-view="${x.id}">Xem</button>${can("projectEdit")?`<button class="btn sm" data-edit="${x.id}">Sửa</button>`:""}${can("projectDelete")?`<button class="btn red sm" data-del="${x.id}">Xóa</button>`:""}</div></td></tr>`;
}
function form(x={}){
  const scopes=Array.isArray(x.disciplines)?x.disciplines:[];
  return `<div class="form-grid">
    <label class="field"><span>Mã dự án *</span><input required name="code" value="${esc(x.code||projectCode(data.length+1))}"></label>
    <label class="field"><span>Tên dự án *</span><input required name="name" value="${esc(x.name||"")}"></label>
    <label class="field"><span>Chủ đầu tư / Khách hàng</span><input name="client" value="${esc(x.client||"")}"></label>
    <label class="field"><span>Địa điểm</span><input name="location" value="${esc(x.location||"")}"></label>
    <label class="field"><span>Ngày nhận hồ sơ</span><input type="date" name="receivedDate" value="${esc(x.receivedDate||"")}"></label>
    <label class="field"><span>Hạn nộp thầu</span><input type="date" name="tenderDeadline" value="${esc(x.tenderDeadline||"")}"></label>
    <label class="field"><span>Người phụ trách</span><input name="ownerName" value="${esc(x.ownerName||"")}"></label>
    <label class="field"><span>Giai đoạn</span><select name="phase"><option value="TENDER" ${!x.phase||x.phase==="TENDER"?"selected":""}>Đấu thầu</option><option value="EXECUTION" ${x.phase==="EXECUTION"?"selected":""}>Triển khai</option><option value="CLOSED" ${x.phase==="CLOSED"?"selected":""}>Đã đóng</option></select></label>
    <label class="field span2"><span>Trạng thái đấu thầu</span><select name="tenderStatus">${TENDER_STAGES.map(s=>`<option value="${s[0]}" ${x.tenderStatus===s[0]?"selected":""}>${s[1]}</option>`).join("")}</select></label>
    <div class="field span2"><span>Phạm vi hệ thống</span><div class="checks">${DISCIPLINES.map(v=>`<label class="check"><input type="checkbox" name="disciplines" value="${v}" ${scopes.includes(v)?"checked":""}>${v}</label>`).join("")}</div></div>
    <label class="field span2"><span>Link hồ sơ</span><input type="url" name="documentUrl" value="${esc(x.documentUrl||"")}" placeholder="https://..."></label>
    <label class="field span2"><span>Ghi chú</span><textarea name="notes">${esc(x.notes||"")}</textarea></label>
  </div>`;
}
function edit(id=null,c=document.querySelector("#content")){
  const x=data.find(p=>p.id===id)||{};
  modal({title:id?"Cập nhật dự án":"Tạo dự án mới",eyebrow:"HỒ SƠ DỰ ÁN",size:"lg",submitText:id?"Lưu thay đổi":"Tạo dự án",body:form(x),onSubmit:async fd=>{
    const d=Object.fromEntries(fd.entries());d.disciplines=fd.getAll("disciplines");d.phase=d.phase||"TENDER";d.tenderStatus=d.tenderStatus||"RECEIVED";d.updatedAt=ts();
    if(id){await refs.project(id).update(d);await logActivity("PROJECT_UPDATED",`Cập nhật dự án ${d.code}`,{projectId:id})}
    else{const key=refs.projects().push().key;d.createdAt=ts();await refs.project(key).set(d);await logActivity("PROJECT_CREATED",`Tạo dự án ${d.code}`,{projectId:key})}
    toast(id?"Đã cập nhật dự án.":"Đã tạo dự án.");await renderProjects(c);return true;
  }});
}
function view(id){
  const x=data.find(p=>p.id===id);if(!x)return;const s=stageInfo(x.tenderStatus), scopes=Array.isArray(x.disciplines)?x.disciplines:[];
  modal({title:x.name||"Chi tiết dự án",eyebrow:x.code||"DỰ ÁN",size:"lg",showSubmit:false,body:`<div class="grid g2">
    <div class="card"><div class="card-body"><p><b>Khách hàng:</b> ${esc(x.client||"—")}</p><p><b>Địa điểm:</b> ${esc(x.location||"—")}</p><p><b>Ngày nhận:</b> ${fmtDate(x.receivedDate)}</p><p><b>Hạn nộp:</b> ${fmtDate(x.tenderDeadline)}</p><p><b>Phụ trách:</b> ${esc(x.ownerName||"—")}</p></div></div>
    <div class="card"><div class="card-body"><p><b>Giai đoạn:</b> ${esc(x.phase||"TENDER")}</p><p><b>Trạng thái:</b> ${badge(s.label,s.color)}</p><p><b>Phạm vi:</b> ${esc(scopes.join(", ")||"—")}</p><p><b>Hồ sơ:</b> ${x.documentUrl?`<a style="color:#2563eb" target="_blank" href="${esc(x.documentUrl)}">Mở link ↗</a>`:"—"}</p></div></div></div><div class="card mt"><div class="card-head"><h3>Ghi chú</h3></div><div class="card-body" style="font-size:11px;white-space:pre-wrap">${esc(x.notes||"Chưa có ghi chú.")}</div></div>`});
}
async function del(id,c){
  const x=data.find(p=>p.id===id);if(!await confirmBox("Xóa dự án",`Xóa ${x?.code||""} - ${x?.name||""}? Dữ liệu RFQ/duyệt giá liên quan không tự xóa.`,"Xóa"))return;
  await refs.project(id).remove();await logActivity("PROJECT_DELETED",`Xóa dự án ${x?.code||id}`,{projectId:id});toast("Đã xóa dự án.","warning");await renderProjects(c);
}
