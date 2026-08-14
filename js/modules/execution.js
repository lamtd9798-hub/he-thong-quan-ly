import {refs,arr,ts,logActivity,can,esc,fmtDate,EXEC_STAGES,execInfo,setPage,loading,empty,badge,modal,toast} from "../core.js";

let projects=[],executions=[];
export async function renderExecution(container){
  setPage("Triển khai dự án","Công việc / Triển khai");container.innerHTML=loading();
  [projects,executions]=await Promise.all([arr(refs.projects()),arr(refs.execution())]);projects=projects.filter(x=>x.phase==="EXECUTION");paint(container);
}
function paint(c){
  c.innerHTML=`<div class="page-head"><div><h2>Dự án triển khai</h2><p>Dự án trúng thầu được bàn giao trực tiếp từ module đấu thầu, không tạo lại hồ sơ.</p></div></div>
  ${projects.length?`<div class="grid g3">${projects.map(card).join("")}</div>`:empty("Chưa có dự án triển khai","Đánh dấu dự án Trúng thầu rồi bấm “Bàn giao” ở Pipeline.","▤")}`;
  c.querySelectorAll("[data-exec]").forEach(b=>b.addEventListener("click",()=>edit(b.dataset.exec,c)));
}
function card(p){
  const e=executions.find(x=>x.id===p.id)||{status:"HANDOVER",progress:0},info=execInfo(e.status),progress=Math.max(0,Math.min(100,Number(e.progress||0)));
  return `<div class="card exec-card"><div class="exec-head"><div>${badge(p.code||"—","blue")}<h3>${esc(p.name||"")}</h3><div class="secondary-text">${esc(p.client||"")}</div></div>${badge(info.label,e.status==="CLOSED"?"green":"purple")}</div>
  <div class="exec-meta"><span>PM: ${esc(e.pmName||"Chưa giao")}</span><span>Kickoff: ${fmtDate(e.kickoffDate)}</span><span>Đích: ${fmtDate(e.targetDate)}</span></div>
  <div class="progress-label"><span>Tiến độ tổng</span><b>${progress}%</b></div><div class="progress"><div class="bar" style="width:${progress}%"></div></div>
  <div class="exec-foot"><span class="secondary-text">${esc(e.notes||"")}</span>${can("executionEdit")?`<button class="btn sm" data-exec="${p.id}">Cập nhật</button>`:""}</div></div>`;
}
function edit(id,c){
  const p=projects.find(x=>x.id===id),e=executions.find(x=>x.id===id)||{};
  modal({title:`Cập nhật triển khai · ${p?.code||""}`,eyebrow:"PHÒNG KỸ THUẬT / PM",size:"lg",body:`<div class="form-grid">
    <label class="field"><span>PM / Kỹ sư phụ trách</span><input name="pmName" value="${esc(e.pmName||"")}"></label>
    <label class="field"><span>Trạng thái</span><select name="status">${EXEC_STAGES.map(s=>`<option value="${s[0]}" ${e.status===s[0]?"selected":""}>${s[1]}</option>`).join("")}</select></label>
    <label class="field"><span>Ngày Kickoff</span><input type="date" name="kickoffDate" value="${esc(e.kickoffDate||"")}"></label>
    <label class="field"><span>Ngày mục tiêu</span><input type="date" name="targetDate" value="${esc(e.targetDate||"")}"></label>
    <label class="field span2"><span>% tiến độ tổng</span><input type="number" min="0" max="100" name="progress" value="${Number(e.progress||0)}"></label>
    <label class="field span2"><span>Công việc / Vướng mắc chính</span><textarea name="notes">${esc(e.notes||"")}</textarea></label></div>`,onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.progress=Math.max(0,Math.min(100,Number(d.progress||0)));d.projectId=id;d.updatedAt=ts();if(!e.createdAt)d.createdAt=ts();
      await refs.executionProject(id).update(d);if(d.status==="CLOSED")await refs.project(id).update({phase:"CLOSED",updatedAt:ts()});await logActivity("EXECUTION_UPDATED",`Cập nhật triển khai ${p?.code||""}: ${execInfo(d.status).label}`,{projectId:id});toast("Đã cập nhật triển khai.");await renderExecution(c);return true;
    }});
}
