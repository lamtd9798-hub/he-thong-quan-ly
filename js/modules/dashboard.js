import {
  refs,arr,getProfile,can,esc,money,fmtDate,fmtDateTime,daysUntil,stageInfo,
  TASK_PRIORITIES,setPage,loading,empty,badge
} from "../core.js?v=2.4.0";

export async function renderDashboard(container){
  setPage("Dashboard","Tổng quan");
  container.innerHTML=loading();

  const reads=[
    arr(refs.projects()),
    arr(refs.activities()),
    arr(refs.execution()),
    arr(refs.tasks())
  ];
  reads.push(can("finance")?arr(refs.approvals()):Promise.resolve([]));

  const [projects,activities,execution,tasks,approvals]=await Promise.all(reads);

  const tender=projects.filter(x=>x.phase==="TENDER");
  const exe=projects.filter(x=>x.phase==="EXECUTION");
  const due=tender.filter(x=>{const d=daysUntil(x.tenderDeadline);return d!==null&&d>=0&&d<=7});
  const pending=approvals.filter(x=>x.status==="PENDING");
  const approved=projects.reduce((s,x)=>s+Number(x.approvedBidPrice||0),0);
  const avg=exe.length?Math.round(exe.reduce((s,p)=>s+Number(execution.find(e=>e.id===p.id)?.progress||0),0)/exe.length):0;
  const deadlines=[...tender].filter(x=>x.tenderDeadline).sort((a,b)=>a.tenderDeadline.localeCompare(b.tenderDeadline)).slice(0,6);
  const recent=[...activities].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,7);

  const p=getProfile();
  const openTasks=tasks.filter(t=>t.status!=="DONE");
  const myTasks=openTasks.filter(t=>t.assigneeUid===p.uid);
  const overdue=openTasks.filter(t=>t.dueDate&&daysUntil(t.dueDate)<0);
  const myOverdue=myTasks.filter(t=>t.dueDate&&daysUntil(t.dueDate)<0);
  const blocked=openTasks.filter(t=>t.status==="BLOCKED");
  const myTop=[...myTasks].sort(taskSort).slice(0,7);

  container.innerHTML=`
    <div class="card welcome">
      <div class="card-body">
        <div class="eyebrow" style="color:#93c5fd">TỔNG QUAN HÔM NAY</div>
        <h2>Xin chào, ${esc(p?.displayName||"")}</h2>
        <p>Tình trạng dự án, đấu thầu, công việc đang giao và các deadline cần xử lý.</p>
      </div>
    </div>

    <div class="grid g6 mt">
      ${metric("Tổng dự án",projects.length,"▣","#2563eb","#eff6ff","Toàn bộ hồ sơ")}
      ${metric("Đang đấu thầu",tender.length,"◆","#7c3aed","#f5f3ff",`${due.length} dự án hết hạn ≤ 7 ngày`)}
      ${metric("Việc quá hạn",overdue.length,"!","#dc2626","#fef2f2",`${myOverdue.length} việc của tôi`)}
      ${metric("Đang vướng",blocked.length,"⚠","#d97706","#fff7ed","Cần gỡ vướng")}
      ${metric("Đang triển khai",exe.length,"▤","#16a34a","#f0fdf4",`Tiến độ TB ${avg}%`)}
      ${metric(can("finance")?"Giá trị đã duyệt":"Việc của tôi",can("finance")?money(approved,true):myTasks.length,can("finance")?"₫":"✓","#0284c7","#ecfeff",can("finance")?`${pending.length} hồ sơ chờ duyệt`:`${myOverdue.length} việc trễ`)}
    </div>

    <div class="grid g3 mt">
      <div class="card">
        <div class="card-head">
          <h3>Việc của tôi cần xử lý</h3>
          <a href="#/tasks" class="btn sm">Mở Giao việc →</a>
        </div>
        <div class="card-body">
          ${myTop.length?`<div class="list">${myTop.map(taskRow).join("")}</div>`:
            empty("Không có việc đang mở","Các công việc được giao cho bạn sẽ xuất hiện tại đây.","✓")}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Deadline đấu thầu gần nhất</h3><a href="#/tender" class="btn sm">Pipeline →</a></div>
        <div class="card-body">
          ${deadlines.length?`<div class="list">${deadlines.map(x=>{
            const d=daysUntil(x.tenderDeadline),s=stageInfo(x.tenderStatus);
            return `<div class="list-item">
              <i class="list-dot" style="background:${d!==null&&d<=2?"#dc2626":"#2563eb"}"></i>
              <div class="list-main"><b>${esc(x.code)} · ${esc(x.name)}</b><span>${badge(s.label,s.color)} &nbsp; ${esc(x.ownerName||"Chưa phân công")}</span></div>
              <div class="list-side ${d!==null&&d<=2?"danger-text":""}">${fmtDate(x.tenderDeadline)}<br>${d<0?"Quá hạn":d+" ngày"}</div>
            </div>`;
          }).join("")}</div>`:empty("Chưa có deadline","Thêm hạn nộp thầu vào hồ sơ dự án để theo dõi.","◷")}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Hoạt động gần đây</h3><span class="secondary-text">${recent.length} cập nhật</span></div>
        <div class="card-body">
          ${recent.length?`<div class="list">${recent.map(a=>`
            <div class="list-item">
              <i class="list-dot" style="background:#7c3aed"></i>
              <div class="list-main"><b>${esc(a.message||a.type||"Cập nhật")}</b><span>${esc(a.userEmail||"Hệ thống")}</span></div>
              <div class="list-side">${fmtDateTime(a.createdAt)}</div>
            </div>`).join("")}</div>`:
            empty("Chưa có hoạt động","Các thao tác tạo/sửa dữ liệu sẽ xuất hiện tại đây.","◉")}
        </div>
      </div>
    </div>`;
}

function taskRow(t){
  const projectCode=t.projectId?"Dự án":"Chung";
  const d=daysUntil(t.dueDate),overdue=t.dueDate&&d<0;
  const color=t.status==="BLOCKED"?"#d97706":overdue?"#dc2626":"#2563eb";
  const pr=TASK_PRIORITIES.find(x=>x[0]===t.priority)||TASK_PRIORITIES[1];

  return `<div class="list-item">
    <i class="list-dot" style="background:${color}"></i>
    <div class="list-main">
      <b>${esc(t.title||"")}</b>
      <span>${badge(pr[1],pr[2])} &nbsp; ${Number(t.progress||0)}%${t.status==="BLOCKED"?" · ĐANG VƯỚNG":""}</span>
    </div>
    <div class="list-side ${overdue?"danger-text":""}">
      ${fmtDate(t.dueDate)}<br>${!t.dueDate?"":overdue?`Trễ ${Math.abs(d)} ngày`:d===0?"Hôm nay":`Còn ${d} ngày`}
    </div>
  </div>`;
}

function taskSort(a,b){
  const ao=a.dueDate&&daysUntil(a.dueDate)<0,bo=b.dueDate&&daysUntil(b.dueDate)<0;
  if(ao!==bo)return ao?-1:1;
  const aBlocked=a.status==="BLOCKED",bBlocked=b.status==="BLOCKED";
  if(aBlocked!==bBlocked)return aBlocked?-1:1;
  return String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999"));
}

function metric(label,value,icon,c,s,foot){
  return `<div class="metric" style="--c:${c};--s:${s}">
    <div class="metric-head"><span>${label}</span><span class="metric-icon">${icon}</span></div>
    <div class="metric-value">${value}</div><div class="metric-foot">${foot}</div>
  </div>`;
}
