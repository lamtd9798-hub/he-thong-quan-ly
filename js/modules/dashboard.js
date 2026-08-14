import {refs,arr,getProfile,can,esc,money,fmtDate,fmtDateTime,daysUntil,stageInfo,setPage,loading,empty,badge} from "../core.js?v=2.2.0";

export async function renderDashboard(container){
  setPage("Dashboard","Tổng quan");
  container.innerHTML=loading();
  const reads=[arr(refs.projects()),arr(refs.activities()),arr(refs.execution())];
  reads.push(can("finance")?arr(refs.approvals()):Promise.resolve([]));
  const [projects,activities,execution,approvals]=await Promise.all(reads);
  const tender=projects.filter(x=>x.phase==="TENDER"), exe=projects.filter(x=>x.phase==="EXECUTION");
  const due=tender.filter(x=>{const d=daysUntil(x.tenderDeadline);return d!==null&&d>=0&&d<=7});
  const pending=approvals.filter(x=>x.status==="PENDING");
  const approved=projects.reduce((s,x)=>s+Number(x.approvedBidPrice||0),0);
  const avg=exe.length?Math.round(exe.reduce((s,p)=>s+Number(execution.find(e=>e.id===p.id)?.progress||0),0)/exe.length):0;
  const deadlines=[...tender].filter(x=>x.tenderDeadline).sort((a,b)=>a.tenderDeadline.localeCompare(b.tenderDeadline)).slice(0,7);
  const recent=[...activities].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,8);
  const p=getProfile();

  container.innerHTML=`
    <div class="card welcome"><div class="card-body"><div class="eyebrow" style="color:#93c5fd">TỔNG QUAN HÔM NAY</div><h2>Xin chào, ${esc(p?.displayName||"")}</h2><p>Tình trạng mới nhất của danh mục dự án, đấu thầu và triển khai.</p></div></div>
    <div class="grid g5 mt">
      ${metric("Tổng dự án",projects.length,"▣","#2563eb","#eff6ff","Toàn bộ hồ sơ")}
      ${metric("Đang đấu thầu",tender.length,"◆","#7c3aed","#f5f3ff",`${due.length} dự án hết hạn ≤ 7 ngày`)}
      ${metric("Chờ duyệt giá",pending.length,"✓","#d97706","#fff7ed","Cần Giám đốc xử lý")}
      ${metric("Đang triển khai",exe.length,"▤","#16a34a","#f0fdf4",`Tiến độ TB ${avg}%`)}
      ${metric(can("finance")?"Giá trị đã duyệt":"Dự án hoạt động",can("finance")?money(approved,true):projects.filter(x=>x.phase!=="CLOSED").length,"₫","#0284c7","#ecfeff",can("finance")?"Tổng giá chào được duyệt":"Không tính dự án đã đóng")}
    </div>
    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h3>Deadline đấu thầu gần nhất</h3><a href="#/tender" class="btn sm">Mở Pipeline →</a></div><div class="card-body">
        ${deadlines.length?`<div class="list">${deadlines.map(x=>{
          const d=daysUntil(x.tenderDeadline),s=stageInfo(x.tenderStatus);
          return `<div class="list-item"><i class="list-dot" style="background:${d!==null&&d<=2?"#dc2626":"#2563eb"}"></i><div class="list-main"><b>${esc(x.code)} · ${esc(x.name)}</b><span>${badge(s.label,s.color)} &nbsp; ${esc(x.ownerName||"Chưa phân công")}</span></div><div class="list-side ${d!==null&&d<=2?"danger-text":""}">${fmtDate(x.tenderDeadline)}<br>${d<0?"Quá hạn":d+" ngày"}</div></div>`}).join("")}</div>`:empty("Chưa có deadline","Thêm hạn nộp thầu vào hồ sơ dự án để theo dõi.","◷")}
      </div></div>
      <div class="card"><div class="card-head"><h3>Hoạt động gần đây</h3><span class="secondary-text">${recent.length} cập nhật</span></div><div class="card-body">
        ${recent.length?`<div class="list">${recent.map(a=>`<div class="list-item"><i class="list-dot" style="background:#7c3aed"></i><div class="list-main"><b>${esc(a.message||a.type||"Cập nhật")}</b><span>${esc(a.userEmail||"Hệ thống")}</span></div><div class="list-side">${fmtDateTime(a.createdAt)}</div></div>`).join("")}</div>`:empty("Chưa có hoạt động","Các thao tác tạo/sửa dữ liệu sẽ xuất hiện tại đây.","◉")}
      </div></div>
    </div>`;
}
function metric(label,value,icon,c,s,foot){return `<div class="metric" style="--c:${c};--s:${s}"><div class="metric-head"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></div>`}
