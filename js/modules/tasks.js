import {
  refs, arr, ts, logActivity, getProfile, can, esc, norm, fmtDate, fmtDateTime,
  daysUntil, TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES,
  setPage, loading, empty, badge, modal, closeModal, toast, confirmBox
} from "../core.js?v=2.18.2";

let tasks = [];
let projects = [];
let users = [];

let viewMode = "KANBAN";
let filters = {
  q: "",
  projectId: "ALL",
  assigneeUid: "ALL",
  status: "ALL",
  priority: "ALL"
};

export async function renderTasks(container) {
  setPage("Giao việc & Tiến độ", "Công việc / Giao việc");
  container.innerHTML = loading();

  [tasks, projects, users] = await Promise.all([
    arr(refs.tasks()),
    arr(refs.projects()),
    arr(refs.users())
  ]);

  tasks.sort((a,b) => {
    if ((a.status === "DONE") !== (b.status === "DONE")) return a.status === "DONE" ? 1 : -1;
    return String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"));
  });

  users = users.filter(u => u.active !== false)
    .sort((a,b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || "", "vi"));

  paint(container);
}

function paint(container) {
  const me = getProfile();
  const list = filteredTasks();
  const open = tasks.filter(t => t.status !== "DONE");
  const overdue = open.filter(isOverdue);
  const blocked = open.filter(t => t.status === "BLOCKED");
  const myOpen = open.filter(t => t.assigneeUid === me.uid);
  const done7 = tasks.filter(t => t.status === "DONE" && Number(t.completedAt || 0) >= Date.now() - 7*86400000);

  container.innerHTML = `
    <div class="page-head">
      <div>
        <h2>Giao việc & Tiến độ</h2>
        <p>Biết rõ ai đang làm gì, deadline nào sắp trễ, việc nào đang vướng và % hoàn thành theo từng dự án.</p>
      </div>
      <div class="actions">
        ${can("taskAssign") ? `<button class="btn" id="tenderTemplateBtn">⚡ Tạo bộ việc đấu thầu</button>` : ""}
        ${can("taskAssign")||can("taskSelfEdit")?`<button class="btn primary" id="newTaskBtn">＋ Giao việc</button>`:""}
      </div>
    </div>

    <div class="grid g5">
      ${metric("Việc đang mở", open.length, "▦", "#2563eb", "#eff6ff", `${myOpen.length} việc của tôi`)}
      ${metric("Đang thực hiện", tasks.filter(t=>t.status==="DOING").length, "▶", "#7c3aed", "#f5f3ff", "Đang xử lý")}
      ${metric("Quá hạn", overdue.length, "!", "#dc2626", "#fef2f2", overdue.length ? "Cần xử lý ngay" : "Không có việc trễ")}
      ${metric("Đang vướng", blocked.length, "⚠", "#d97706", "#fff7ed", "Cần hỗ trợ / gỡ vướng")}
      ${metric("Hoàn thành 7 ngày", done7.length, "✓", "#16a34a", "#f0fdf4", "Kết quả gần đây")}
    </div>

    <div class="toolbar mt">
      <div class="search">
        <input id="taskSearch" value="${esc(filters.q)}" placeholder="Tìm công việc, dự án, người phụ trách, ghi chú...">
      </div>
      <select id="taskProjectFilter">
        <option value="ALL">Tất cả dự án</option>
        ${projects.map(p=>`<option value="${p.id}" ${filters.projectId===p.id?"selected":""}>${esc(p.code||"")} - ${esc(p.name||"")}</option>`).join("")}
      </select>
      <select id="taskAssigneeFilter">
        <option value="ALL">Tất cả người phụ trách</option>
        <option value="ME" ${filters.assigneeUid==="ME"?"selected":""}>Việc của tôi</option>
        ${users.map(u=>`<option value="${u.id}" ${filters.assigneeUid===u.id?"selected":""}>${esc(u.displayName||u.email||"")}</option>`).join("")}
      </select>
      <select id="taskStatusFilter">
        <option value="ALL">Tất cả trạng thái</option>
        ${TASK_STATUSES.map(s=>`<option value="${s[0]}" ${filters.status===s[0]?"selected":""}>${s[1]}</option>`).join("")}
      </select>
      <select id="taskPriorityFilter">
        <option value="ALL">Tất cả ưu tiên</option>
        ${TASK_PRIORITIES.map(s=>`<option value="${s[0]}" ${filters.priority===s[0]?"selected":""}>${s[1]}</option>`).join("")}
      </select>
      <div class="subtabs" style="margin:0">
        <button class="subtab ${viewMode==="KANBAN"?"active":""}" data-view-mode="KANBAN">Kanban</button>
        <button class="subtab ${viewMode==="LIST"?"active":""}" data-view-mode="LIST">Danh sách</button>
      </div>
      ${badge(`${list.length} việc`,"gray")}
    </div>

    <div id="taskBody">
      ${viewMode === "KANBAN" ? kanbanHtml(list) : listHtml(list)}
    </div>
  `;

  bind(container);
}

function filteredTasks() {
  const me = getProfile();
  return tasks.filter(t => {
    const p = projects.find(x=>x.id===t.projectId);
    const text = norm(`${t.title} ${t.description} ${t.blocker} ${t.nextAction} ${t.assigneeName} ${p?.code} ${p?.name}`);
    const qOk = !filters.q || text.includes(norm(filters.q));
    const projectOk = filters.projectId === "ALL" || t.projectId === filters.projectId;
    const assigneeOk = filters.assigneeUid === "ALL" ||
      (filters.assigneeUid === "ME" ? t.assigneeUid === me.uid : t.assigneeUid === filters.assigneeUid);
    const statusOk = filters.status === "ALL" || t.status === filters.status;
    const priorityOk = filters.priority === "ALL" || t.priority === filters.priority;
    return qOk && projectOk && assigneeOk && statusOk && priorityOk;
  });
}

function kanbanHtml(list) {
  return `<div class="task-board-wrap"><div class="task-board">
    ${TASK_STATUSES.map(s => {
      const col = list.filter(t => (t.status || "TODO") === s[0]);
      return `<section class="task-column task-status-${s[0].toLowerCase()}">
        <div class="task-column-head">
          <div><span class="task-status-dot"></span><b>${esc(s[1])}</b></div>
          <span class="task-count">${col.length}</span>
        </div>
        <div class="task-column-body">
          ${col.length ? col.map(taskCard).join("") : `<div class="task-column-empty">Chưa có công việc</div>`}
        </div>
      </section>`;
    }).join("")}
  </div></div>`;
}

function taskCard(t) {
  const p = projects.find(x=>x.id===t.projectId);
  const st = statusInfo(t.status);
  const pr = priorityInfo(t.priority);
  const overdue = isOverdue(t);
  const d = daysUntil(t.dueDate);
  const editable = canEdit(t);

  return `<article class="task-card ${overdue?"task-overdue":""}">
    <div class="task-card-top">
      <div class="task-project">${esc(p?.code || (t.phase==="GENERAL"?"CÔNG VIỆC CHUNG":"—"))}</div>
      ${badge(pr.label,pr.color)}
    </div>
    <h4>${esc(t.title||"Không tên")}</h4>
    <div class="task-type">${esc(typeInfo(t.taskType).label)}</div>

    <div class="task-assignee">
      <span class="mini-avatar">${initialsLocal(t.assigneeName||t.assigneeEmail||"?")}</span>
      <div><b>${esc(t.assigneeName||t.assigneeEmail||"Chưa giao")}</b><small>${esc(t.department||"")}</small></div>
    </div>

    <div class="task-progress-line">
      <span>Tiến độ</span><b>${Number(t.progress||0)}%</b>
    </div>
    <div class="progress"><div class="bar ${t.status==="BLOCKED"?"bar-warning":t.status==="DONE"?"bar-green":""}" style="width:${Math.max(0,Math.min(100,Number(t.progress||0)))}%"></div></div>

    <div class="task-deadline ${overdue?"danger-text":""}">
      <span>◷ ${fmtDate(t.dueDate)}</span>
      <b>${!t.dueDate?"Chưa có hạn":t.status==="DONE"?"Đã xong":d<0?`Trễ ${Math.abs(d)} ngày`:d===0?"Hôm nay":`Còn ${d} ngày`}</b>
    </div>

    ${t.status==="BLOCKED" && t.blocker ? `<div class="task-blocker">⚠ ${esc(t.blocker)}</div>` : ""}
    ${t.nextAction ? `<div class="task-next">Tiếp theo: ${esc(t.nextAction)}</div>` : ""}

    <div class="task-actions">
      <button class="btn sm" data-task-view="${t.id}">Xem</button>
      ${editable ? quickButtons(t) : ""}
      ${editable ? `<button class="btn sm" data-task-edit="${t.id}">Sửa</button>` : ""}
    </div>
  </article>`;
}

function quickButtons(t) {
  if (t.status === "TODO") return `<button class="btn soft sm" data-task-status="${t.id}" data-status="DOING">▶ Bắt đầu</button>`;
  if (t.status === "DOING") return `<button class="btn orange sm" data-task-status="${t.id}" data-status="BLOCKED">⚠ Vướng</button><button class="btn green sm" data-task-status="${t.id}" data-status="DONE">✓ Xong</button>`;
  if (t.status === "BLOCKED") return `<button class="btn soft sm" data-task-status="${t.id}" data-status="DOING">↻ Làm tiếp</button><button class="btn green sm" data-task-status="${t.id}" data-status="DONE">✓ Xong</button>`;
  if (t.status === "DONE") return `<button class="btn sm" data-task-status="${t.id}" data-status="DOING">Mở lại</button>`;
  return "";
}

function listHtml(list) {
  return `<div class="table-wrap"><table class="table task-list-table"><thead><tr>
    <th>DỰ ÁN / CÔNG VIỆC</th><th>LOẠI</th><th>PHỤ TRÁCH</th><th>BẮT ĐẦU</th><th>DEADLINE</th>
    <th>ƯU TIÊN</th><th>TRẠNG THÁI</th><th>TIẾN ĐỘ</th><th>VƯỚNG MẮC</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
  ${list.length ? list.map(t=>{
    const p=projects.find(x=>x.id===t.projectId),st=statusInfo(t.status),pr=priorityInfo(t.priority),overdue=isOverdue(t);
    return `<tr class="${overdue?"overdue-row":""}">
      <td><div class="primary-text">${esc(p?.code||"CÔNG VIỆC CHUNG")} · ${esc(t.title||"")}</div><div class="secondary-text">${esc(p?.name||t.description||"")}</div></td>
      <td>${esc(typeInfo(t.taskType).label)}</td>
      <td><div>${esc(t.assigneeName||t.assigneeEmail||"—")}</div><div class="secondary-text">${esc(t.department||"")}</div></td>
      <td>${fmtDate(t.startDate)}</td>
      <td class="${overdue?"danger-text":""}">${fmtDate(t.dueDate)}${overdue?`<div class="secondary-text danger-text">Đã quá hạn</div>`:""}</td>
      <td>${badge(pr.label,pr.color)}</td><td>${badge(st.label,st.color)}</td>
      <td><div class="progress-label"><span>${Number(t.progress||0)}%</span></div><div class="progress" style="min-width:90px"><div class="bar" style="width:${Number(t.progress||0)}%"></div></div></td>
      <td>${esc(t.blocker||"—")}</td>
      <td><div class="row-actions"><button class="btn sm" data-task-view="${t.id}">Xem</button>${canEdit(t)?`<button class="btn sm" data-task-edit="${t.id}">Sửa</button>`:""}${can("taskDelete")?`<button class="btn red sm" data-task-del="${t.id}">Xóa</button>`:""}</div></td>
    </tr>`;
  }).join("") : `<tr><td colspan="10">${empty("Chưa có công việc","Tạo công việc đầu tiên để bắt đầu theo dõi tiến độ.","▦")}</td></tr>`}
  </tbody></table></div>`;
}

function bind(container) {
  container.querySelector("#newTaskBtn")?.addEventListener("click",()=>openTask(null,container));
  container.querySelector("#tenderTemplateBtn")?.addEventListener("click",()=>openTenderTemplate(container));

  container.querySelector("#taskSearch")?.addEventListener("input",e=>{
    filters.q=e.target.value; paint(container);
    requestAnimationFrame(()=>{
      const i=container.querySelector("#taskSearch");i?.focus();i?.setSelectionRange(i.value.length,i.value.length);
    });
  });
  container.querySelector("#taskProjectFilter")?.addEventListener("change",e=>{filters.projectId=e.target.value;paint(container)});
  container.querySelector("#taskAssigneeFilter")?.addEventListener("change",e=>{filters.assigneeUid=e.target.value;paint(container)});
  container.querySelector("#taskStatusFilter")?.addEventListener("change",e=>{filters.status=e.target.value;paint(container)});
  container.querySelector("#taskPriorityFilter")?.addEventListener("change",e=>{filters.priority=e.target.value;paint(container)});
  container.querySelectorAll("[data-view-mode]").forEach(b=>b.addEventListener("click",()=>{viewMode=b.dataset.viewMode;paint(container)}));

  container.querySelectorAll("[data-task-view]").forEach(b=>b.addEventListener("click",()=>viewTask(b.dataset.taskView,container)));
  container.querySelectorAll("[data-task-edit]").forEach(b=>b.addEventListener("click",()=>openTask(b.dataset.taskEdit,container)));
  container.querySelectorAll("[data-task-del]").forEach(b=>b.addEventListener("click",()=>deleteTask(b.dataset.taskDel,container)));
  container.querySelectorAll("[data-task-status]").forEach(b=>b.addEventListener("click",()=>quickStatus(b.dataset.taskStatus,b.dataset.status,container)));
}

function taskForm(t={}) {
  const me=getProfile();
  const canAssign=can("taskAssign");
  const defaultAssignee = t.assigneeUid || me.uid;
  const defaultProject = t.projectId || (filters.projectId!=="ALL"?filters.projectId:"");
  const activeProjects = projects.filter(p=>p.phase!=="CLOSED");

  return `<div class="form-grid">
    <label class="field span2"><span>Tên công việc *</span><input required name="title" value="${esc(t.title||"")}" placeholder="Ví dụ: Bóc BOQ hệ PCCC"></label>

    <label class="field"><span>Dự án</span><select name="projectId">
      <option value="">Công việc chung</option>
      ${activeProjects.map(p=>`<option value="${p.id}" ${defaultProject===p.id?"selected":""}>${esc(p.code||"")} - ${esc(p.name||"")}</option>`).join("")}
    </select></label>

    <label class="field"><span>Nhóm công việc</span><select name="taskType">
      ${TASK_TYPES.map(x=>`<option value="${x[0]}" ${t.taskType===x[0]?"selected":""}>${x[1]}</option>`).join("")}
    </select></label>

    <label class="field"><span>Người phụ trách *</span><select required name="assigneeUid" ${canAssign?"":"disabled"}>
      ${users.map(u=>`<option value="${u.id}" ${defaultAssignee===u.id?"selected":""}>${esc(u.displayName||u.email||"")} · ${esc(u.department||"")}</option>`).join("")}
    </select>${!canAssign?`<input type="hidden" name="assigneeUid" value="${esc(me.uid)}">`:""}</label>

    <label class="field"><span>Ưu tiên</span><select name="priority">
      ${TASK_PRIORITIES.map(x=>`<option value="${x[0]}" ${(t.priority||"NORMAL")===x[0]?"selected":""}>${x[1]}</option>`).join("")}
    </select></label>

    <label class="field"><span>Ngày bắt đầu</span><input type="date" name="startDate" value="${esc(t.startDate||todayIso())}"></label>
    <label class="field"><span>Deadline *</span><input required type="date" name="dueDate" value="${esc(t.dueDate||"")}"></label>

    <label class="field"><span>Trạng thái</span><select name="status">
      ${TASK_STATUSES.map(x=>`<option value="${x[0]}" ${(t.status||"TODO")===x[0]?"selected":""}>${x[1]}</option>`).join("")}
    </select></label>

    <label class="field"><span>% hoàn thành</span><input type="number" min="0" max="100" name="progress" value="${Number(t.progress||0)}"></label>

    <label class="field span2"><span>Mô tả / Yêu cầu đầu ra</span><textarea name="description" placeholder="Mô tả rõ việc cần làm, file cần bàn giao, tiêu chí hoàn thành...">${esc(t.description||"")}</textarea></label>
    <label class="field span2"><span>Vướng mắc hiện tại</span><textarea name="blocker" placeholder="Nếu công việc bị vướng, ghi rõ nguyên nhân và cần ai hỗ trợ.">${esc(t.blocker||"")}</textarea></label>
    <label class="field span2"><span>Hành động tiếp theo</span><input name="nextAction" value="${esc(t.nextAction||"")}" placeholder="Ví dụ: Chờ NCC A gửi lại báo giá trước 15h"></label>
  </div>`;
}

function openTask(id,container){
  const t=tasks.find(x=>x.id===id)||{};
  modal({
    title:id?"Cập nhật công việc":"Giao việc mới",
    eyebrow:"TIẾN ĐỘ & DEADLINE",
    size:"lg",
    submitText:id?"Lưu thay đổi":"Tạo công việc",
    body:taskForm(t),
    onSubmit:async fd=>{
      const me=getProfile();
      const d=Object.fromEntries(fd.entries());
      const assignee=users.find(u=>u.id===d.assigneeUid) || (d.assigneeUid===me.uid?me:null);
      d.assigneeName=assignee?.displayName||assignee?.email||"";
      d.assigneeEmail=assignee?.email||"";
      d.department=assignee?.department||"";
      d.progress=Math.max(0,Math.min(100,Number(d.progress||0)));
      if(d.status==="DONE"){
        d.progress=100;
        if(!t.completedAt)d.completedAt=Date.now();
      }else{
        d.completedAt=null;
        if(d.status==="TODO" && d.progress>0)d.status="DOING";
      }
      if(d.status==="BLOCKED" && !d.blocker.trim()){
        toast("Công việc đang Vướng: nên ghi rõ nguyên nhân vướng mắc.","warning");
      }
      d.phase = d.projectId ? (projects.find(p=>p.id===d.projectId)?.phase || "TENDER") : "GENERAL";
      d.updatedAt=ts();

      if(id){
        await refs.task(id).update(d);
        await logActivity("TASK_UPDATED",`Cập nhật công việc: ${d.title}`,{projectId:d.projectId||"",taskId:id});
      }else{
        const key=refs.tasks().push().key;
        d.createdAt=ts();d.createdByUid=me.uid;d.createdByName=me.displayName||me.email;d.createdByEmail=me.email||"";
        await refs.task(key).set(d);
        await logActivity("TASK_CREATED",`Giao việc: ${d.title} → ${d.assigneeName}`,{projectId:d.projectId||"",taskId:key});
      }
      toast(id?"Đã cập nhật công việc.":"Đã giao công việc.");
      await renderTasks(container);return true;
    }
  });
}

function viewTask(id,container){
  const t=tasks.find(x=>x.id===id);if(!t)return;
  const p=projects.find(x=>x.id===t.projectId),st=statusInfo(t.status),pr=priorityInfo(t.priority);
  modal({
    title:t.title||"Chi tiết công việc",
    eyebrow:p?.code||"CÔNG VIỆC CHUNG",
    size:"lg",showSubmit:false,
    body:`<div class="grid g3">
      <div class="metric" style="--c:#2563eb"><div class="metric-head"><span>TRẠNG THÁI</span></div><div class="metric-value" style="font-size:18px">${esc(st.label)}</div></div>
      <div class="metric" style="--c:${isOverdue(t)?"#dc2626":"#d97706"}"><div class="metric-head"><span>DEADLINE</span></div><div class="metric-value" style="font-size:18px">${fmtDate(t.dueDate)}</div><div class="metric-foot">${isOverdue(t)?"ĐÃ QUÁ HẠN":t.status==="DONE"?"Đã hoàn thành":daysUntil(t.dueDate)!==null?`Còn ${Math.max(0,daysUntil(t.dueDate))} ngày`:"Chưa đặt hạn"}</div></div>
      <div class="metric" style="--c:#16a34a"><div class="metric-head"><span>TIẾN ĐỘ</span></div><div class="metric-value" style="font-size:18px">${Number(t.progress||0)}%</div></div>
    </div>

    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h3>Thông tin công việc</h3></div><div class="card-body task-detail">
        <p><b>Dự án:</b> ${esc(p?`${p.code} - ${p.name}`:"Công việc chung")}</p>
        <p><b>Nhóm việc:</b> ${esc(typeInfo(t.taskType).label)}</p>
        <p><b>Phụ trách:</b> ${esc(t.assigneeName||t.assigneeEmail||"—")}</p>
        <p><b>Phòng ban:</b> ${esc(t.department||"—")}</p>
        <p><b>Ưu tiên:</b> ${badge(pr.label,pr.color)}</p>
        <p><b>Bắt đầu:</b> ${fmtDate(t.startDate)}</p>
        <p><b>Deadline:</b> ${fmtDate(t.dueDate)}</p>
      </div></div>
      <div class="card"><div class="card-head"><h3>Kiểm soát thực hiện</h3></div><div class="card-body task-detail">
        <p><b>Người giao:</b> ${esc(t.createdByName||t.createdByEmail||"—")}</p>
        <p><b>Cập nhật:</b> ${fmtDateTime(t.updatedAt)}</p>
        <p><b>Hoàn thành:</b> ${fmtDateTime(t.completedAt)}</p>
        <div class="progress-label"><span>Tiến độ</span><b>${Number(t.progress||0)}%</b></div>
        <div class="progress"><div class="bar" style="width:${Number(t.progress||0)}%"></div></div>
      </div></div>
    </div>

    <div class="card mt"><div class="card-head"><h3>Mô tả / Yêu cầu đầu ra</h3></div><div class="card-body prewrap">${esc(t.description||"Chưa có mô tả.")}</div></div>
    ${t.blocker?`<div class="card mt blocker-card"><div class="card-head"><h3>⚠ Vướng mắc</h3></div><div class="card-body prewrap">${esc(t.blocker)}</div></div>`:""}
    ${t.nextAction?`<div class="card mt"><div class="card-head"><h3>Hành động tiếp theo</h3></div><div class="card-body prewrap">${esc(t.nextAction)}</div></div>`:""}

    ${canEdit(t)?`<div class="actions mt"><button type="button" class="btn primary" id="taskDetailEdit">Sửa công việc</button>${t.status!=="DONE"?`<button type="button" class="btn green" id="taskDetailDone">✓ Hoàn tất</button>`:""}</div>`:""}
  `});
  document.querySelector("#taskDetailEdit")?.addEventListener("click",()=>openTask(id,container));
  document.querySelector("#taskDetailDone")?.addEventListener("click",()=>quickStatus(id,"DONE",container,true));
}

async function quickStatus(id,status,container,fromDetail=false){
  const t=tasks.find(x=>x.id===id);if(!t)return;
  if(status==="BLOCKED"){
    modal({
      title:"Đánh dấu công việc bị vướng",
      eyebrow:t.title||"CÔNG VIỆC",
      size:"sm",submitText:"Lưu vướng mắc",
      body:`<label class="field"><span>Nguyên nhân vướng *</span><textarea required name="blocker" placeholder="Ví dụ: Chưa nhận được báo giá bơm từ NCC...">${esc(t.blocker||"")}</textarea></label><label class="field mt"><span>Hành động tiếp theo</span><input name="nextAction" value="${esc(t.nextAction||"")}"></label>`,
      onSubmit:async fd=>{
        await refs.task(id).update({status:"BLOCKED",blocker:fd.get("blocker"),nextAction:fd.get("nextAction")||"",updatedAt:ts()});
        await logActivity("TASK_BLOCKED",`Công việc bị vướng: ${t.title}`,{projectId:t.projectId||"",taskId:id});
        toast("Đã ghi nhận vướng mắc.","warning");await renderTasks(container);return true;
      }
    });
    return;
  }

  const patch={status,updatedAt:ts()};
  if(status==="DONE"){patch.progress=100;patch.completedAt=Date.now();patch.blocker="";}
  if(status==="DOING"){patch.completedAt=null;if(Number(t.progress||0)===0)patch.progress=10;}
  await refs.task(id).update(patch);
  await logActivity("TASK_STATUS",`${t.title} → ${statusInfo(status).label}`,{projectId:t.projectId||"",taskId:id});
  toast(status==="DONE"?"Đã hoàn thành công việc.":"Đã cập nhật trạng thái.");
  if(fromDetail) closeModal();
  await renderTasks(container);
}

async function deleteTask(id,container){
  const t=tasks.find(x=>x.id===id);if(!t)return;
  if(!await confirmBox("Xóa công việc",`Xóa công việc "${t.title}"?`,"Xóa"))return;
  await refs.task(id).remove();
  await logActivity("TASK_DELETED",`Xóa công việc: ${t.title}`,{projectId:t.projectId||"",taskId:id});
  toast("Đã xóa công việc.","warning");await renderTasks(container);
}

function openTenderTemplate(container){
  const tender=projects.filter(p=>p.phase==="TENDER");
  if(!tender.length){toast("Chưa có dự án đang đấu thầu.","warning");return}

  modal({
    title:"Tạo bộ việc đấu thầu",
    eyebrow:"TẠO NHANH WORKFLOW",
    size:"lg",submitText:"Tạo 6 công việc",
    body:`<div class="alert" style="background:#eff6ff;border:1px solid #dbeafe;color:#1d4ed8;margin-bottom:14px">
      Hệ thống sẽ tạo 6 mốc: Kiểm tra hồ sơ → Bóc/Rà BOQ → Hỏi giá → Tổng hợp giá → Trình duyệt → Nộp thầu.
      Deadline từng việc được chia tự động từ hôm nay đến hạn nộp thầu.
    </div>
    <div class="form-grid">
      <label class="field span2"><span>Dự án *</span><select required name="projectId" id="templateProject">
        <option value="">-- Chọn dự án --</option>${tender.map(p=>`<option value="${p.id}">${esc(p.code)} - ${esc(p.name)} · Hạn ${fmtDate(p.tenderDeadline)}</option>`).join("")}
      </select></label>
      <label class="field"><span>Người phụ trách chính *</span><select required name="assigneeUid">
        ${users.map(u=>`<option value="${u.id}">${esc(u.displayName||u.email||"")} · ${esc(u.department||"")}</option>`).join("")}
      </select></label>
      <label class="field"><span>Ưu tiên</span><select name="priority">
        <option value="HIGH">Cao</option><option value="URGENT">Khẩn cấp</option><option value="NORMAL">Bình thường</option>
      </select></label>
    </div>`,
    onSubmit:async fd=>{
      const projectId=fd.get("projectId"),assigneeUid=fd.get("assigneeUid"),priority=fd.get("priority")||"HIGH";
      const p=projects.find(x=>x.id===projectId),u=users.find(x=>x.id===assigneeUid);
      if(!p||!u)return false;

      const existing=tasks.filter(t=>t.projectId===projectId && String(t.templateKey||"").startsWith("TENDER_"));
      if(existing.length){
        toast(`Dự án đã có ${existing.length} công việc từ bộ workflow. Có thể thêm việc thủ công nếu cần.`,"warning");
        return false;
      }

      const today=new Date();today.setHours(0,0,0,0);
      const deadline=p.tenderDeadline?new Date(`${p.tenderDeadline}T00:00:00`):new Date(today.getTime()+7*86400000);
      const total=Math.max(1,Math.round((deadline-today)/86400000));
      const ratios=[0.15,0.35,0.50,0.70,0.85,1];
      const defs=[
        ["TENDER_REVIEW","Kiểm tra hồ sơ mời thầu","REVIEW","Rà phạm vi, bản vẽ, spec, điều kiện thương mại và các điểm cần làm rõ."],
        ["TENDER_BOQ","Bóc / Rà soát BOQ","BOQ","Hoàn thiện BOQ theo phạm vi chào thầu và ghi rõ các giả định."],
        ["TENDER_RFQ","Gửi RFQ / Lấy giá vật tư","RFQ","Phát hành RFQ, bám nhà cung cấp và thu đủ báo giá các vật tư chính."],
        ["TENDER_PRICE","Tổng hợp giá & Lập giá","PRICING","Chọn giá, cập nhật nhân công/thầu phụ/chi phí khác, kiểm tra NET và giá chào."],
        ["TENDER_APPROVAL","Trình Giám đốc duyệt giá","APPROVAL","Khóa version giá, tổng hợp rủi ro/exclusion và trình phê duyệt."],
        ["TENDER_SUBMIT","Hoàn thiện & Nộp hồ sơ thầu","SUBMIT","Kiểm tra hồ sơ cuối, biểu mẫu, giá chào và nộp đúng hạn."]
      ];

      const updates={};
      defs.forEach((d,i)=>{
        const key=refs.tasks().push().key;
        const due=new Date(today.getTime()+Math.max(0,Math.round(total*ratios[i]))*86400000);
        const dueIso=toIso(due>deadline?deadline:due);
        updates[key]={
          projectId,phase:"TENDER",title:d[1],taskType:d[2],description:d[3],templateKey:d[0],
          assigneeUid,assigneeName:u.displayName||u.email||"",assigneeEmail:u.email||"",department:u.department||"",
          priority,status:"TODO",progress:0,startDate:todayIso(),dueDate:dueIso,blocker:"",nextAction:"",
          createdByUid:getProfile().uid,createdByName:getProfile().displayName||getProfile().email,
          createdByEmail:getProfile().email||"",createdAt:Date.now(),updatedAt:Date.now()
        };
      });
      await refs.tasks().update(updates);
      await logActivity("TASK_TEMPLATE_CREATED",`Tạo bộ 6 việc đấu thầu cho ${p.code}`,{projectId});
      toast("Đã tạo 6 công việc đấu thầu.");await renderTasks(container);return true;
    }
  });
}

function canEdit(t){
  const me=getProfile();
  return can("taskAssign") || (can("taskSelfEdit") && (t.assigneeUid===me.uid || t.createdByUid===me.uid));
}
function isOverdue(t){
  if(!t.dueDate||t.status==="DONE")return false;
  return daysUntil(t.dueDate)<0;
}
function statusInfo(k){
  const x=TASK_STATUSES.find(s=>s[0]===(k||"TODO"))||TASK_STATUSES[0];
  return {key:x[0],label:x[1],color:x[2]};
}
function priorityInfo(k){
  const x=TASK_PRIORITIES.find(s=>s[0]===(k||"NORMAL"))||TASK_PRIORITIES[1];
  return {key:x[0],label:x[1],color:x[2]};
}
function typeInfo(k){
  const x=TASK_TYPES.find(s=>s[0]===k)||TASK_TYPES[TASK_TYPES.length-1];
  return {key:x[0],label:x[1]};
}
function metric(label,value,icon,c,s,foot){
  return `<div class="metric" style="--c:${c};--s:${s}"><div class="metric-head"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></div>`;
}
function initialsLocal(v=""){
  const p=String(v).trim().split(/\s+/).filter(Boolean);if(!p.length)return"?";
  return (p.length===1?p[0].slice(0,2):p[0][0]+p[p.length-1][0]).toUpperCase();
}
function todayIso(){return toIso(new Date())}
function toIso(d){
  const x=new Date(d),off=x.getTimezoneOffset()*60000;
  return new Date(x-off).toISOString().slice(0,10);
}
