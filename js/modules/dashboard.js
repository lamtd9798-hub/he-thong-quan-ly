import {
  refs,arr,getProfile,can,esc,money,fmtDate,fmtDateTime,daysUntil,stageInfo,
  TASK_PRIORITIES,setPage,loading,empty,badge
} from "../core.js?v=2.5.0";

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
  reads.push(can("financeProjectView")?Promise.all([
    refs.financeSettingsRoot().once("value"),
    refs.budgetsRoot().once("value"),
    refs.actualCostsRoot().once("value"),
    refs.supplierPaymentsRoot().once("value"),
    refs.variationsRoot().once("value"),
    refs.billingsRoot().once("value"),
    refs.receiptsRoot().once("value")
  ]):Promise.resolve(null));

  const [projects,activities,execution,tasks,approvals,financeBundle]=await Promise.all(reads);

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
    </div>

    ${can("financeProjectView")?portfolioFinanceHtml(projects,financeBundle):""}`;
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


function portfolioFinanceHtml(projects,bundle){
  if(!bundle)return"";
  const [settingsSnap,budgetSnap,costSnap,paymentSnap,varSnap,billingSnap,receiptSnap]=bundle;
  const settings=settingsSnap.val()||{}, budgets=budgetSnap.val()||{}, costs=costSnap.val()||{},
    payments=paymentSnap.val()||{}, variations=varSnap.val()||{}, billings=billingSnap.val()||{}, receipts=receiptSnap.val()||{};

  const active=projects.filter(p=>p.phase==="EXECUTION"||p.phase==="CLOSED"||p.tenderStatus==="WON");
  const rows=active.map(p=>{
    const st=settings[p.id]||{},bs=Object.values(budgets[p.id]||{}),cs=Object.values(costs[p.id]||{}),
      ps=Object.values(payments[p.id]||{}),vs=Object.values(variations[p.id]||{}),bis=Object.values(billings[p.id]||{}),rs=Object.values(receipts[p.id]||{});
    const original=Number(st.contractValueExVat??p.approvedBidPrice??0);
    const variation=vs.filter(v=>v.status==="APPROVED").reduce((a,v)=>a+(v.direction==="DECREASE"?-1:1)*Number(v.amount||0),0);
    const contract=original+variation;
    const budget=bs.reduce((a,b)=>a+Number(b.budgetAmount||0),0);
    const actual=cs.reduce((a,c)=>a+Number(c.amountExVat||0),0);
    const forecast=bs.length?bs.reduce((a,b)=>a+Number(b.forecastAmount??b.budgetAmount??0),0):actual;
    const billed=bis.reduce((a,b)=>a+Number(b.amountExVat||0)*(1+Number(b.vatPct||0)/100),0);
    const collected=rs.reduce((a,r)=>a+Number(r.amount||0),0);
    const costGross=cs.reduce((a,c)=>a+Number(c.amountExVat||0)*(1+Number(c.vatPct||0)/100),0);
    const paid=ps.reduce((a,x)=>a+Number(x.amount||0),0);
    return {p,contract,budget,forecast,actual,billed,collected,receivable:Math.max(0,billed-collected),payable:Math.max(0,costGross-paid),profit:contract-forecast,margin:contract?(contract-forecast)/contract*100:0};
  });

  const total=rows.reduce((a,r)=>{for(const k of ["contract","budget","forecast","actual","billed","collected","receivable","payable","profit"])a[k]+=r[k];return a},{contract:0,budget:0,forecast:0,actual:0,billed:0,collected:0,receivable:0,payable:0,profit:0});
  const margin=total.contract?total.profit/total.contract*100:0;

  return `<div class="card mt">
    <div class="card-head"><div><h3>Tài chính danh mục dự án</h3><div class="secondary-text">Tổng hợp nhanh các dự án trúng thầu / đang triển khai</div></div><a href="#/finance" class="btn sm">Mở Tài chính →</a></div>
    <div class="card-body">
      <div class="grid g5">
        ${metric("Giá trị HĐ",money(total.contract,true),"HĐ","#2563eb","#eff6ff",`${rows.length} dự án`)}
        ${metric("Forecast Cost",money(total.forecast,true),"F","#7c3aed","#f5f3ff",`Budget ${money(total.budget,true)}`)}
        ${metric("LN dự kiến",`${margin.toFixed(1)}%`,"↗",total.profit>=0?"#16a34a":"#dc2626",total.profit>=0?"#f0fdf4":"#fef2f2",money(total.profit))}
        ${metric("Phải thu KH",money(total.receivable,true),"AR","#dc2626","#fef2f2",`Đã thu ${money(total.collected,true)}`)}
        ${metric("Phải trả NCC",money(total.payable,true),"AP","#d97706","#fff7ed",`Actual ${money(total.actual,true)}`)}
      </div>
      ${rows.length?`<div class="table-wrap mt"><table class="table" style="min-width:1100px"><thead><tr><th>DỰ ÁN</th><th>HỢP ĐỒNG</th><th>BUDGET</th><th>FORECAST</th><th>LN DỰ KIẾN</th><th>% LN</th><th>PHẢI THU</th><th>PHẢI TRẢ</th></tr></thead><tbody>${rows.sort((a,b)=>b.contract-a.contract).slice(0,8).map(r=>`<tr><td><div class="primary-text">${esc(r.p.code||"")} · ${esc(r.p.name||"")}</div></td><td>${money(r.contract)}</td><td>${money(r.budget)}</td><td>${money(r.forecast)}</td><td class="${r.profit>=0?"positive-text":"danger-text"}"><b>${money(r.profit)}</b></td><td>${r.margin.toFixed(1)}%</td><td>${money(r.receivable)}</td><td>${money(r.payable)}</td></tr>`).join("")}</tbody></table></div>`:""}
    </div>
  </div>`;
}

function metric(label,value,icon,c,s,foot){
  return `<div class="metric" style="--c:${c};--s:${s}">
    <div class="metric-head"><span>${label}</span><span class="metric-icon">${icon}</span></div>
    <div class="metric-value">${value}</div><div class="metric-foot">${foot}</div>
  </div>`;
}
