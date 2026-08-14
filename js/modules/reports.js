import {refs,arr,ts,logActivity,getProfile,can,esc,norm,fmtDateTime,weekKey,monthKey,setPage,loading,empty,badge,modal,toast,confirmBox} from "../core.js?v=2.2.0";

let reports=[],projects=[],type="WEEK",q="";
export async function renderReports(container){
  setPage("Báo cáo tuần / tháng","Công việc / Báo cáo");container.innerHTML=loading();
  [reports,projects]=await Promise.all([arr(refs.reports()),arr(refs.projects())]);reports.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));paint(container);
}
function paint(c){
  const p=getProfile(),all=["ADMIN","DIRECTOR","MANAGER"].includes(p.role);
  const list=reports.filter(r=>{
    const pr=projects.find(x=>x.id===r.projectId);
    return r.type===type&&(all||r.userId===p.uid)&&(!q||norm(`${pr?.code} ${pr?.name} ${r.userName} ${r.completed} ${r.ongoing}`).includes(norm(q)));
  });
  c.innerHTML=`<div class="page-head"><div><h2>Báo cáo tuần / tháng</h2><p>Nhân viên cập nhật một lần; quản lý xem tổng hợp toàn bộ phòng ban.</p></div><button id="newReport" class="btn primary">＋ Tạo báo cáo</button></div>
  <div class="toolbar"><div class="subtabs" style="margin:0"><button class="subtab ${type==="WEEK"?"active":""}" data-type="WEEK">Theo tuần</button><button class="subtab ${type==="MONTH"?"active":""}" data-type="MONTH">Theo tháng</button></div><div class="search"><input id="qReport" value="${esc(q)}" placeholder="Tìm dự án, người báo cáo, nội dung..."></div>${badge(`${list.length} báo cáo`)}</div>
  ${list.length?`<div class="grid g2">${list.map(card).join("")}</div>`:empty("Chưa có báo cáo",`Chưa có báo cáo ${type==="WEEK"?"tuần":"tháng"} phù hợp bộ lọc.`,"▥")}`;
  c.querySelector("#newReport").addEventListener("click",()=>edit(null,c));c.querySelectorAll("[data-type]").forEach(b=>b.addEventListener("click",()=>{type=b.dataset.type;paint(c)}));
  c.querySelector("#qReport")?.addEventListener("input",e=>{q=e.target.value;paint(c);requestAnimationFrame(()=>{const i=c.querySelector("#qReport");i?.focus();i?.setSelectionRange(i.value.length,i.value.length)})});
  c.querySelectorAll("[data-report-edit]").forEach(b=>b.addEventListener("click",()=>edit(b.dataset.reportEdit,c)));c.querySelectorAll("[data-report-del]").forEach(b=>b.addEventListener("click",()=>del(b.dataset.reportDel,c)));
}
function card(r){
  const p=projects.find(x=>x.id===r.projectId),me=getProfile(),editable=r.userId===me.uid||can("reportsEditAll");
  return `<div class="card report-card"><div class="report-head"><div><h3>${esc(p?.code||"Không gắn dự án")} · ${esc(p?.name||"Công việc chung")}</h3><div class="secondary-text">${esc(r.userName||"")} · ${esc(r.period||"")}</div></div>${badge(r.type==="WEEK"?"Tuần":"Tháng",r.type==="WEEK"?"blue":"purple")}</div>
  <div class="report-block"><b>Đã hoàn thành</b><p>${esc(r.completed||"—")}</p></div><div class="report-block"><b>Đang thực hiện</b><p>${esc(r.ongoing||"—")}</p></div><div class="report-block"><b>Kế hoạch tiếp theo</b><p>${esc(r.nextPlan||"—")}</p></div>${r.issues?`<div class="report-block"><b>Vướng mắc / Kiến nghị</b><p style="color:#c2410c">${esc(r.issues)}</p></div>`:""}
  <div class="report-foot"><span class="secondary-text">Cập nhật ${fmtDateTime(r.updatedAt)}</span>${editable?`<div class="row-actions"><button class="btn sm" data-report-edit="${r.id}">Sửa</button><button class="btn red sm" data-report-del="${r.id}">Xóa</button></div>`:""}</div></div>`;
}
function edit(id,c){
  const r=reports.find(x=>x.id===id)||{},p=getProfile(),defaultPeriod=type==="WEEK"?weekKey():monthKey();
  modal({title:id?"Cập nhật báo cáo":"Tạo báo cáo",eyebrow:"BÁO CÁO CÔNG VIỆC",size:"lg",body:`<div class="form-grid">
    <label class="field"><span>Loại báo cáo</span><select name="type"><option value="WEEK" ${(!r.type&&type==="WEEK")||r.type==="WEEK"?"selected":""}>Tuần</option><option value="MONTH" ${(!r.type&&type==="MONTH")||r.type==="MONTH"?"selected":""}>Tháng</option></select></label>
    <label class="field"><span>Kỳ báo cáo *</span><input required name="period" value="${esc(r.period||defaultPeriod)}"></label>
    <label class="field span2"><span>Dự án</span><select name="projectId"><option value="">Công việc chung</option>${projects.map(x=>`<option value="${x.id}" ${r.projectId===x.id?"selected":""}>${esc(x.code)} - ${esc(x.name)}</option>`).join("")}</select></label>
    <label class="field span2"><span>Công việc đã hoàn thành</span><textarea name="completed">${esc(r.completed||"")}</textarea></label>
    <label class="field span2"><span>Công việc đang thực hiện</span><textarea name="ongoing">${esc(r.ongoing||"")}</textarea></label>
    <label class="field span2"><span>Kế hoạch kỳ tiếp theo</span><textarea name="nextPlan">${esc(r.nextPlan||"")}</textarea></label>
    <label class="field span2"><span>Vướng mắc / Kiến nghị</span><textarea name="issues">${esc(r.issues||"")}</textarea></label></div>`,onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.userId=r.userId||p.uid;d.userName=r.userName||p.displayName||p.email;d.userEmail=r.userEmail||p.email;d.updatedAt=ts();
      if(id)await refs.report(id).update(d);else{const key=refs.reports().push().key;d.createdAt=ts();await refs.report(key).set(d)}
      await logActivity("REPORT_SAVED",`${id?"Cập nhật":"Tạo"} báo cáo ${d.period}`,{projectId:d.projectId||""});toast("Đã lưu báo cáo.");await renderReports(c);return true;
    }});
}
async function del(id,c){
  const r=reports.find(x=>x.id===id);if(!await confirmBox("Xóa báo cáo",`Xóa báo cáo ${r?.period||""}?`,"Xóa"))return;await refs.report(id).remove();toast("Đã xóa báo cáo.","warning");await renderReports(c);
}
