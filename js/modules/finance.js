import {
  refs,arr,ts,logActivity,can,esc,norm,money,fmtDate,fmtDateTime,daysUntil,
  DISCIPLINES,setPage,loading,empty,badge,modal,toast,confirmBox
} from "../core.js?v=2.5.0";

let projects=[], selectedProjectId="", tab="OVERVIEW";
let settings={}, budgets=[], costs=[], payments=[], variations=[], billings=[], receipts=[], procurement=[], boqItems=[], pricing={};

const BUDGET_CATEGORIES=[
  ["MATERIAL","Vật tư"],
  ["LABOR","Nhân công"],
  ["SUBCONTRACT","Thầu phụ"],
  ["OVERHEAD","Chi phí chung"],
  ["CONTINGENCY","Dự phòng"],
  ["OTHER","Chi phí khác"]
];
const VAR_STATUSES=[
  ["DRAFT","Nháp","gray"],
  ["SUBMITTED","Đã trình","blue"],
  ["APPROVED","Đã duyệt","green"],
  ["REJECTED","Từ chối","red"]
];

export async function renderFinance(container){
  setPage("Tài chính dự án","Công việc / Tài chính");
  container.innerHTML=loading();

  projects=(await arr(refs.projects())).filter(p=>p.phase==="EXECUTION"||p.phase==="CLOSED"||p.tenderStatus==="WON");
  projects.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));

  if(!selectedProjectId&&projects.length)selectedProjectId=projects[0].id;
  if(selectedProjectId&&!projects.some(p=>p.id===selectedProjectId))selectedProjectId=projects[0]?.id||"";

  await loadProjectData();
  paint(container);
}

async function loadProjectData(){
  if(!selectedProjectId){
    settings={};budgets=[];costs=[];payments=[];variations=[];billings=[];receipts=[];procurement=[];boqItems=[];pricing={};return;
  }

  const [s,b,c,pay,v,bi,r,proc,boq,price]=await Promise.all([
    refs.financeSettings(selectedProjectId).once("value"),
    refs.budgetsProject(selectedProjectId).once("value"),
    refs.actualCostsProject(selectedProjectId).once("value"),
    refs.supplierPaymentsProject(selectedProjectId).once("value"),
    refs.variationsProject(selectedProjectId).once("value"),
    refs.billingsProject(selectedProjectId).once("value"),
    refs.receiptsProject(selectedProjectId).once("value"),
    refs.procurementProject(selectedProjectId).once("value"),
    refs.boqProject(selectedProjectId).once("value"),
    refs.pricingSettings(selectedProjectId).once("value")
  ]);

  settings=s.val()||{};
  budgets=toArray(b.val()).sort((a,b)=>String(a.category||"").localeCompare(String(b.category||"")));
  costs=toArray(c.val()).sort((a,b)=>String(b.costDate||"").localeCompare(String(a.costDate||"")));
  payments=toArray(pay.val()).sort((a,b)=>String(b.paymentDate||"").localeCompare(String(a.paymentDate||"")));
  variations=toArray(v.val()).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  billings=toArray(bi.val()).sort((a,b)=>String(b.billingDate||"").localeCompare(String(a.billingDate||"")));
  receipts=toArray(r.val()).sort((a,b)=>String(b.receiptDate||"").localeCompare(String(a.receiptDate||"")));
  procurement=toArray(proc.val());
  boqItems=toArray(boq.val());
  pricing=price.val()||{};
}

function paint(c){
  const p=projects.find(x=>x.id===selectedProjectId);
  const f=financials(p);

  c.innerHTML=`
    <div class="page-head">
      <div>
        <h2>Tài chính dự án</h2>
        <p>Giá trị hợp đồng → Budget → PO/Chi phí → Phát sinh → Xuất hóa đơn → Thu tiền → Lợi nhuận dự án.</p>
      </div>
      ${selectedProjectId?`<div class="actions">
        <button class="btn" id="exportFinanceBtn">Xuất CSV</button>
        ${can("financeProjectEdit")?`<button class="btn primary" id="editFinanceSettingsBtn">Cấu hình hợp đồng</button>`:""}
      </div>`:""}
    </div>

    <div class="toolbar">
      <select id="financeProjectSelect" style="min-width:380px">
        <option value="">-- Chọn dự án --</option>
        ${projects.map(x=>`<option value="${x.id}" ${x.id===selectedProjectId?"selected":""}>${esc(x.code||"")} - ${esc(x.name||"")}</option>`).join("")}
      </select>
      ${selectedProjectId?`${badge(p?.phase==="CLOSED"?"Đã đóng":"Đang triển khai",p?.phase==="CLOSED"?"gray":"green")} ${badge(`HĐ ${money(f.revisedContract,true)}`,"blue")}`:""}
    </div>

    ${selectedProjectId?`
      <div class="grid g6">
        ${metric("Giá trị HĐ điều chỉnh",money(f.revisedContract,true),"HĐ","#2563eb","#eff6ff",`Gốc ${money(f.originalContract,true)} · PS ${signedMoney(f.approvedVariation)}`)}
        ${metric("Budget",money(f.budget,true),"B","#7c3aed","#f5f3ff",`${budgets.length} nhóm ngân sách`)}
        ${metric("PO đã cam kết",money(f.committed,true),"PO","#d97706","#fff7ed",`${f.committedCount} PO/hạng mục`)}
        ${metric("Chi phí thực tế",money(f.actual,true),"C","#64748b","#f8fafc",`${costs.length} chứng từ chi phí`)}
        ${metric("Forecast Cost",money(f.forecast,true),"F","#0284c7","#ecfeff",`Chênh Budget ${signedMoney(f.forecast-f.budget)}`)}
        ${metric("LN dự kiến",`${num(f.forecastMargin,1)}%`,"↗",f.forecastProfit>=0?"#16a34a":"#dc2626",f.forecastProfit>=0?"#f0fdf4":"#fef2f2",money(f.forecastProfit))}
      </div>

      <div class="grid g4 mt">
        ${cashMetric("Đã xuất HĐ",f.billedTotal,`Trước VAT ${money(f.billedExVat)}`,"#2563eb")}
        ${cashMetric("Đã thu tiền",f.collected,`${pct(f.collected,f.billedTotal)}% giá trị đã xuất`,"#16a34a")}
        ${cashMetric("Phải thu KH",f.receivable,`${f.overdueReceivableCount} hóa đơn quá hạn`,"#dc2626")}
        ${cashMetric("Phải trả NCC",f.payable,`${f.overduePayableCount} khoản quá hạn`,"#d97706")}
      </div>

      <div class="subtabs mt">
        ${[
          ["OVERVIEW","Tổng quan"],
          ["BUDGET","Hợp đồng & Budget"],
          ["COSTS","Chi phí & Công nợ NCC"],
          ["VARIATIONS","Phát sinh"],
          ["BILLING","Xuất HĐ & Thu tiền"]
        ].map(x=>`<button class="subtab ${tab===x[0]?"active":""}" data-fin-tab="${x[0]}">${x[1]}</button>`).join("")}
      </div>

      <div id="financeTabBody">
        ${tab==="OVERVIEW"?overviewHtml(p,f):
          tab==="BUDGET"?budgetHtml(p,f):
          tab==="COSTS"?costsHtml(p,f):
          tab==="VARIATIONS"?variationsHtml(p,f):
          billingHtml(p,f)}
      </div>
    `:empty("Chưa có dự án tài chính","Dự án cần Trúng thầu/Đang triển khai trước khi theo dõi tài chính.","₫")}
  `;

  bind(c);
}

function bind(c){
  c.querySelector("#financeProjectSelect")?.addEventListener("change",async e=>{
    selectedProjectId=e.target.value;tab="OVERVIEW";c.innerHTML=loading();await loadProjectData();paint(c);
  });
  c.querySelectorAll("[data-fin-tab]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.finTab;paint(c)}));
  c.querySelector("#editFinanceSettingsBtn")?.addEventListener("click",()=>editSettings(c));
  c.querySelector("#exportFinanceBtn")?.addEventListener("click",exportFinanceCsv);

  c.querySelector("#importBudgetFromBoqBtn")?.addEventListener("click",()=>importBudgetFromBoq(c));
  c.querySelector("#addBudgetBtn")?.addEventListener("click",()=>editBudget(null,c));
  c.querySelectorAll("[data-budget-edit]").forEach(b=>b.addEventListener("click",()=>editBudget(b.dataset.budgetEdit,c)));
  c.querySelectorAll("[data-budget-del]").forEach(b=>b.addEventListener("click",()=>deleteBudget(b.dataset.budgetDel,c)));

  c.querySelector("#addCostBtn")?.addEventListener("click",()=>editCost(null,c));
  c.querySelectorAll("[data-cost-edit]").forEach(b=>b.addEventListener("click",()=>editCost(b.dataset.costEdit,c)));
  c.querySelectorAll("[data-cost-pay]").forEach(b=>b.addEventListener("click",()=>recordSupplierPayment(b.dataset.costPay,c)));
  c.querySelectorAll("[data-cost-del]").forEach(b=>b.addEventListener("click",()=>deleteCost(b.dataset.costDel,c)));

  c.querySelector("#addVariationBtn")?.addEventListener("click",()=>editVariation(null,c));
  c.querySelectorAll("[data-var-edit]").forEach(b=>b.addEventListener("click",()=>editVariation(b.dataset.varEdit,c)));
  c.querySelectorAll("[data-var-status]").forEach(b=>b.addEventListener("click",()=>changeVariationStatus(b.dataset.varStatus,b.dataset.status,c)));
  c.querySelectorAll("[data-var-del]").forEach(b=>b.addEventListener("click",()=>deleteVariation(b.dataset.varDel,c)));

  c.querySelector("#addBillingBtn")?.addEventListener("click",()=>editBilling(null,c));
  c.querySelectorAll("[data-billing-edit]").forEach(b=>b.addEventListener("click",()=>editBilling(b.dataset.billingEdit,c)));
  c.querySelectorAll("[data-billing-receipt]").forEach(b=>b.addEventListener("click",()=>recordReceipt(b.dataset.billingReceipt,c)));
  c.querySelectorAll("[data-billing-del]").forEach(b=>b.addEventListener("click",()=>deleteBilling(b.dataset.billingDel,c)));
}

function overviewHtml(p,f){
  const budgetUtil=f.budget?pct(f.actual,f.budget):0;
  const billingProgress=f.revisedContract?pct(f.billedExVat,f.revisedContract):0;
  const collectionProgress=f.billedTotal?pct(f.collected,f.billedTotal):0;
  const contractVat=f.revisedContract*(1+Number(f.vatPct||0)/100);

  return `<div class="grid g2">
    <div class="card">
      <div class="card-head"><h3>Hiệu quả dự án</h3>${badge(f.forecastProfit>=0?"Đang có lãi":"Cảnh báo lỗ",f.forecastProfit>=0?"green":"red")}</div>
      <div class="card-body finance-summary">
        ${summaryRow("Giá trị HĐ gốc",money(f.originalContract))}
        ${summaryRow("Phát sinh đã duyệt",signedMoney(f.approvedVariation))}
        ${summaryRow("Giá trị HĐ điều chỉnh",money(f.revisedContract),true)}
        ${summaryRow(`VAT HĐ (${num(f.vatPct,1)}%)`,money(contractVat-f.revisedContract))}
        ${summaryRow("Tổng HĐ gồm VAT",money(contractVat),true)}
        <div class="divider"></div>
        ${summaryRow("Budget",money(f.budget))}
        ${summaryRow("Forecast Cost",money(f.forecast))}
        ${summaryRow("Lợi nhuận dự kiến",money(f.forecastProfit),true,f.forecastProfit>=0?"green":"red")}
        ${summaryRow("Biên lợi nhuận dự kiến",`${num(f.forecastMargin,2)}%`,true,f.forecastProfit>=0?"green":"red")}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Tiến độ tài chính</h3></div>
      <div class="card-body">
        ${progressLine("Sử dụng Budget",budgetUtil,`${money(f.actual)} / ${money(f.budget)}`,budgetUtil>100?"red":"blue")}
        ${progressLine("Đã xuất hóa đơn",billingProgress,`${money(f.billedExVat)} / ${money(f.revisedContract)}`,"blue")}
        ${progressLine("Đã thu trên hóa đơn",collectionProgress,`${money(f.collected)} / ${money(f.billedTotal)}`,collectionProgress<70&&f.billedTotal?"orange":"green")}
        <div class="divider"></div>
        <div class="finance-alert-grid">
          ${miniAlert("Phải thu khách hàng",money(f.receivable),f.receivable>0?"red":"green")}
          ${miniAlert("Phải trả NCC",money(f.payable),f.payable>0?"orange":"green")}
          ${miniAlert("HĐ quá hạn",f.overdueReceivableCount,f.overdueReceivableCount?"red":"green")}
          ${miniAlert("NCC quá hạn",f.overduePayableCount,f.overduePayableCount?"orange":"green")}
        </div>
      </div>
    </div>
  </div>

  <div class="grid g3 mt">
    ${varianceCard("Budget vs Actual",f.budget,f.actual)}
    ${varianceCard("Budget vs Forecast",f.budget,f.forecast)}
    ${varianceCard("HĐ vs Forecast Cost",f.revisedContract,f.forecast,true)}
  </div>

  <div class="card mt">
    <div class="card-head"><h3>Tổng hợp dòng tiền / công nợ</h3></div>
    <div class="table-wrap" style="border:0;border-radius:0 0 11px 11px"><table class="table finance-overview-table"><thead><tr>
      <th>CHỈ TIÊU</th><th>GIÁ TRỊ</th><th>GHI CHÚ</th>
    </tr></thead><tbody>
      <tr><td>PO / Chi phí đã cam kết</td><td><b>${money(f.committed)}</b></td><td>${f.committedCount} PO/hạng mục từ module Vật tư & Mua hàng</td></tr>
      <tr><td>Chi phí thực tế đã ghi nhận</td><td><b>${money(f.actual)}</b></td><td>${costs.length} chứng từ</td></tr>
      <tr><td>Tiền đã trả NCC</td><td><b>${money(f.paidSupplier)}</b></td><td>${payments.length} lần thanh toán</td></tr>
      <tr><td>Hóa đơn đã xuất (gồm VAT)</td><td><b>${money(f.billedTotal)}</b></td><td>${billings.length} đợt/hóa đơn</td></tr>
      <tr><td>Tiền đã thu khách hàng</td><td><b>${money(f.collected)}</b></td><td>${receipts.length} lần thu</td></tr>
      <tr><td>Dòng tiền ròng đã thu - đã trả</td><td><b class="${f.netCash>=0?"positive-text":"danger-text"}">${money(f.netCash)}</b></td><td>Chỉ phản ánh dòng tiền đã ghi nhận</td></tr>
    </tbody></table></div>
  </div>`;
}

function budgetHtml(p,f){
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">Hợp đồng & Budget</h2><p>Budget là cơ sở kiểm soát chi phí sau khi trúng thầu; Forecast cho biết dự kiến chi phí cuối dự án.</p></div>
    <div class="actions">
      ${can("financeProjectEdit")?`<button class="btn soft" id="importBudgetFromBoqBtn">⚡ Tạo Budget từ BOQ</button><button class="btn primary" id="addBudgetBtn">＋ Thêm Budget</button>`:""}
    </div>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="card-body">
      <div class="grid g4">
        ${smallMetric("HĐ gốc",money(f.originalContract,true))}
        ${smallMetric("PS đã duyệt",signedMoney(f.approvedVariation))}
        ${smallMetric("HĐ điều chỉnh",money(f.revisedContract,true))}
        ${smallMetric("Budget",money(f.budget,true),f.budget>f.revisedContract?"red":"blue")}
      </div>
    </div>
  </div>

  <div class="table-wrap"><table class="table finance-budget-table"><thead><tr>
    <th>NHÓM</th><th>HỆ</th><th>NỘI DUNG</th><th>BUDGET</th><th>FORECAST</th><th>CHÊNH</th><th>ĐÃ CHI</th><th>% BUDGET</th><th>GHI CHÚ</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${budgets.length?budgets.map(budgetRow).join(""):`<tr><td colspan="10">${empty("Chưa có Budget","Bấm “Tạo Budget từ BOQ” để lấy chi phí trúng thầu làm ngân sách ban đầu.","B")}</td></tr>`}
  </tbody>${budgets.length?`<tfoot><tr><th colspan="3" style="text-align:right">TỔNG</th><th>${money(f.budget)}</th><th>${money(f.forecast)}</th><th>${signedMoney(f.forecast-f.budget)}</th><th>${money(f.actual)}</th><th>${f.budget?num(f.actual/f.budget*100,1):0}%</th><th colspan="2"></th></tr></tfoot>`:""}</table></div>`;
}

function budgetRow(x){
  const actual=costs.filter(c=>c.category===x.category&&(x.discipline?c.discipline===x.discipline:true)).reduce((s,c)=>s+Number(c.amountExVat||0),0);
  const forecast=Number(x.forecastAmount||x.budgetAmount||0), budget=Number(x.budgetAmount||0), util=budget?actual/budget*100:0;
  return `<tr>
    <td>${esc(categoryLabel(x.category))}</td><td>${esc(x.discipline||"Tất cả")}</td>
    <td><div class="primary-text">${esc(x.description||categoryLabel(x.category))}</div></td>
    <td>${money(budget)}</td><td><b>${money(forecast)}</b></td>
    <td class="${forecast>budget?"danger-text":"positive-text"}">${signedMoney(forecast-budget)}</td>
    <td>${money(actual)}</td><td>${num(util,1)}%</td><td>${esc(x.notes||"—")}</td>
    <td><div class="row-actions">${can("financeProjectEdit")?`<button class="btn sm" data-budget-edit="${x.id}">Sửa</button><button class="btn red sm" data-budget-del="${x.id}">Xóa</button>`:""}</div></td>
  </tr>`;
}

function costsHtml(p,f){
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">Chi phí thực tế & Công nợ NCC</h2><p>Ghi nhận hóa đơn/chi phí thực tế và các lần thanh toán cho NCC, thầu phụ.</p></div>
    ${can("financeCostEdit")?`<button class="btn primary" id="addCostBtn">＋ Ghi nhận chi phí</button>`:""}
  </div>

  <div class="grid g4" style="margin-bottom:12px">
    ${smallMetric("Chi phí trước VAT",money(f.actual,true))}
    ${smallMetric("Tổng công nợ gồm VAT",money(f.costTotalWithVat,true))}
    ${smallMetric("Đã trả NCC",money(f.paidSupplier,true),"green")}
    ${smallMetric("Còn phải trả",money(f.payable,true),f.payable?"red":"green")}
  </div>

  <div class="table-wrap"><table class="table finance-cost-table"><thead><tr>
    <th>NGÀY</th><th>NHÓM / HỆ</th><th>NCC / THẦU PHỤ</th><th>NỘI DUNG</th><th>CHỨNG TỪ</th><th>TRƯỚC VAT</th><th>VAT</th><th>TỔNG</th><th>ĐÃ TRẢ</th><th>CÒN NỢ</th><th>HẠN TT</th><th>TRẠNG THÁI</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${costs.length?costs.map(costRow).join(""):`<tr><td colspan="13">${empty("Chưa có chi phí thực tế","Ghi nhận hóa đơn/chi phí từ NCC hoặc thầu phụ để kiểm soát Actual Cost.","C")}</td></tr>`}
  </tbody></table></div>

  ${payments.length?`<div class="card mt"><div class="card-head"><h3>Lịch sử thanh toán NCC gần nhất</h3><span class="secondary-text">${payments.length} giao dịch</span></div><div class="card-body"><div class="list">${payments.slice(0,8).map(pay=>{const cost=costs.find(x=>x.id===pay.costId);return `<div class="list-item"><i class="list-dot" style="background:#d97706"></i><div class="list-main"><b>${esc(cost?.supplier||pay.supplier||"NCC")} · ${money(pay.amount)}</b><span>${esc(pay.referenceNo||pay.notes||"Thanh toán NCC")}</span></div><div class="list-side">${fmtDate(pay.paymentDate)}</div></div>`}).join("")}</div></div></div>`:""}`;
}

function costRow(x){
  const total=costTotal(x),paid=payments.filter(p=>p.costId===x.id).reduce((s,p)=>s+Number(p.amount||0),0),remain=Math.max(0,total-paid);
  const overdue=remain>0&&x.dueDate&&daysUntil(x.dueDate)<0;
  const status=remain<=0?["Đã thanh toán","green"]:paid>0?["Thanh toán một phần","orange"]:overdue?["Quá hạn","red"]:["Chưa thanh toán","gray"];
  return `<tr class="${overdue?"overdue-row":""}">
    <td>${fmtDate(x.costDate)}</td><td><div>${esc(categoryLabel(x.category))}</div><div class="secondary-text">${esc(x.discipline||"")}</div></td>
    <td>${esc(x.supplier||"—")}</td><td><div class="primary-text">${esc(x.description||"—")}</div><div class="secondary-text">${esc(x.notes||"")}</div></td>
    <td>${esc(x.invoiceNo||"—")}</td><td>${money(x.amountExVat)}</td><td>${num(x.vatPct,1)}%</td><td><b>${money(total)}</b></td>
    <td>${money(paid)}</td><td class="${remain>0?"danger-text":""}"><b>${money(remain)}</b></td><td class="${overdue?"danger-text":""}">${fmtDate(x.dueDate)}</td><td>${badge(status[0],status[1])}</td>
    <td><div class="row-actions">
      ${can("financeCostEdit")&&remain>0?`<button class="btn green sm" data-cost-pay="${x.id}">Thanh toán</button>`:""}
      ${can("financeCostEdit")?`<button class="btn sm" data-cost-edit="${x.id}">Sửa</button><button class="btn red sm" data-cost-del="${x.id}">Xóa</button>`:""}
    </div></td>
  </tr>`;
}

function variationsHtml(p,f){
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">Phát sinh / Variation</h2><p>Theo dõi phát sinh tăng/giảm và chỉ cộng vào giá trị hợp đồng khi trạng thái “Đã duyệt”.</p></div>
    ${can("financeVariationEdit")?`<button class="btn primary" id="addVariationBtn">＋ Thêm phát sinh</button>`:""}
  </div>

  <div class="grid g4" style="margin-bottom:12px">
    ${smallMetric("Tổng đề xuất tăng",money(variations.filter(v=>v.direction!=="DECREASE"&&v.status!=="REJECTED").reduce((s,v)=>s+Number(v.amount||0),0),true))}
    ${smallMetric("Tổng đề xuất giảm",money(variations.filter(v=>v.direction==="DECREASE"&&v.status!=="REJECTED").reduce((s,v)=>s+Number(v.amount||0),0),true))}
    ${smallMetric("PS đã duyệt",signedMoney(f.approvedVariation),"green")}
    ${smallMetric("HĐ điều chỉnh",money(f.revisedContract,true))}
  </div>

  <div class="table-wrap"><table class="table finance-var-table"><thead><tr>
    <th>MÃ</th><th>NGÀY</th><th>PHÁT SINH</th><th>LOẠI</th><th>GIÁ TRỊ</th><th>TRẠNG THÁI</th><th>NGÀY DUYỆT</th><th>THAM CHIẾU</th><th>GHI CHÚ</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${variations.length?variations.map(variationRow).join(""):`<tr><td colspan="10">${empty("Chưa có phát sinh","Ghi nhận Variation/VO phát sinh tăng hoặc giảm giá trị hợp đồng.","±")}</td></tr>`}
  </tbody></table></div>`;
}

function variationRow(x){
  const st=VAR_STATUSES.find(v=>v[0]===x.status)||VAR_STATUSES[0],sign=x.direction==="DECREASE"?-1:1;
  return `<tr><td><b>${esc(x.code||"—")}</b></td><td>${fmtDate(x.date)}</td><td><div class="primary-text">${esc(x.title||"—")}</div></td>
    <td>${badge(x.direction==="DECREASE"?"Giảm":"Tăng",x.direction==="DECREASE"?"red":"green")}</td>
    <td class="${sign<0?"danger-text":"positive-text"}"><b>${sign<0?"-":"+"}${money(x.amount)}</b></td><td>${badge(st[1],st[2])}</td>
    <td>${fmtDate(x.approvedDate)}</td><td>${esc(x.clientRef||"—")}</td><td>${esc(x.notes||"—")}</td>
    <td><div class="row-actions">
      ${can("financeVariationEdit")&&x.status==="DRAFT"?`<button class="btn soft sm" data-var-status="${x.id}" data-status="SUBMITTED">Đã trình</button>`:""}
      ${can("financeProjectEdit")&&x.status==="SUBMITTED"?`<button class="btn green sm" data-var-status="${x.id}" data-status="APPROVED">Duyệt</button><button class="btn red sm" data-var-status="${x.id}" data-status="REJECTED">Từ chối</button>`:""}
      ${can("financeVariationEdit")?`<button class="btn sm" data-var-edit="${x.id}">Sửa</button><button class="btn red sm" data-var-del="${x.id}">Xóa</button>`:""}
    </div></td>
  </tr>`;
}

function billingHtml(p,f){
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">Xuất hóa đơn & Thu tiền</h2><p>Theo dõi giá trị nghiệm thu/xuất hóa đơn, hạn thanh toán, tiền đã thu và công nợ khách hàng.</p></div>
    ${can("financeBillingEdit")?`<button class="btn primary" id="addBillingBtn">＋ Thêm đợt/Hóa đơn</button>`:""}
  </div>

  <div class="grid g5" style="margin-bottom:12px">
    ${smallMetric("HĐ điều chỉnh trước VAT",money(f.revisedContract,true))}
    ${smallMetric("Đã xuất trước VAT",money(f.billedExVat,true))}
    ${smallMetric("Đã xuất gồm VAT",money(f.billedTotal,true))}
    ${smallMetric("Đã thu",money(f.collected,true),"green")}
    ${smallMetric("Phải thu",money(f.receivable,true),f.receivable?"red":"green")}
  </div>

  <div class="table-wrap"><table class="table finance-billing-table"><thead><tr>
    <th>ĐỢT / HÓA ĐƠN</th><th>NGÀY XUẤT</th><th>HẠN TT</th><th>TRƯỚC VAT</th><th>VAT</th><th>TỔNG</th><th>ĐÃ THU</th><th>CÒN PHẢI THU</th><th>TRẠNG THÁI</th><th>GHI CHÚ</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${billings.length?billings.map(billingRow).join(""):`<tr><td colspan="11">${empty("Chưa có hóa đơn","Thêm đợt nghiệm thu/xuất hóa đơn để theo dõi công nợ khách hàng.","₫")}</td></tr>`}
  </tbody></table></div>

  ${receipts.length?`<div class="card mt"><div class="card-head"><h3>Lịch sử thu tiền gần nhất</h3><span class="secondary-text">${receipts.length} giao dịch</span></div><div class="card-body"><div class="list">${receipts.slice(0,8).map(r=>{const b=billings.find(x=>x.id===r.billingId);return `<div class="list-item"><i class="list-dot" style="background:#16a34a"></i><div class="list-main"><b>${money(r.amount)} · ${esc(b?.invoiceNo||b?.description||"Thu tiền")}</b><span>${esc(r.referenceNo||r.notes||"")}</span></div><div class="list-side">${fmtDate(r.receiptDate)}</div></div>`}).join("")}</div></div></div>`:""}`;
}

function billingRow(x){
  const total=billingTotal(x),collected=receipts.filter(r=>r.billingId===x.id).reduce((s,r)=>s+Number(r.amount||0),0),remain=Math.max(0,total-collected);
  const overdue=remain>0&&x.dueDate&&daysUntil(x.dueDate)<0;
  const status=remain<=0?["Đã thu đủ","green"]:collected>0?["Thu một phần","orange"]:overdue?["Quá hạn","red"]:["Chưa thu","gray"];
  return `<tr class="${overdue?"overdue-row":""}">
    <td><div class="primary-text">${esc(x.invoiceNo||x.period||"—")}</div><div class="secondary-text">${esc(x.description||"")}</div></td>
    <td>${fmtDate(x.billingDate)}</td><td class="${overdue?"danger-text":""}">${fmtDate(x.dueDate)}</td>
    <td>${money(x.amountExVat)}</td><td>${num(x.vatPct,1)}%</td><td><b>${money(total)}</b></td>
    <td>${money(collected)}</td><td class="${remain>0?"danger-text":""}"><b>${money(remain)}</b></td><td>${badge(status[0],status[1])}</td><td>${esc(x.notes||"—")}</td>
    <td><div class="row-actions">
      ${can("financeBillingEdit")&&remain>0?`<button class="btn green sm" data-billing-receipt="${x.id}">Thu tiền</button>`:""}
      ${can("financeBillingEdit")?`<button class="btn sm" data-billing-edit="${x.id}">Sửa</button><button class="btn red sm" data-billing-del="${x.id}">Xóa</button>`:""}
    </div></td>
  </tr>`;
}

function editSettings(c){
  const p=projects.find(x=>x.id===selectedProjectId),defaultContract=Number(settings.contractValueExVat??p?.approvedBidPrice??0),defaultVat=Number(settings.vatPct??pricing.vatPct??10);
  modal({
    title:"Cấu hình hợp đồng dự án",eyebrow:p?.code||"TÀI CHÍNH",size:"lg",
    body:`<div class="form-grid">
      <label class="field"><span>Giá trị hợp đồng gốc trước VAT *</span><input required type="number" min="0" step="any" name="contractValueExVat" value="${defaultContract}"><small>Có thể lấy từ giá trúng thầu rồi điều chỉnh theo hợp đồng ký chính thức.</small></label>
      <label class="field"><span>VAT hợp đồng %</span><input type="number" min="0" max="100" step="any" name="vatPct" value="${defaultVat}"></label>
      <label class="field"><span>Ngày ký hợp đồng</span><input type="date" name="contractDate" value="${esc(settings.contractDate||"")}"></label>
      <label class="field"><span>Hạn hoàn thành hợp đồng</span><input type="date" name="contractEndDate" value="${esc(settings.contractEndDate||"")}"></label>
      <label class="field"><span>Tạm ứng %</span><input type="number" min="0" max="100" step="any" name="advancePct" value="${Number(settings.advancePct||0)}"></label>
      <label class="field"><span>Giữ lại bảo hành %</span><input type="number" min="0" max="100" step="any" name="retentionPct" value="${Number(settings.retentionPct||0)}"></label>
      <label class="field"><span>Điều khoản thanh toán (ngày)</span><input type="number" min="0" name="paymentTermsDays" value="${Number(settings.paymentTermsDays||30)}"></label>
      <label class="field"><span>Số hợp đồng</span><input name="contractNo" value="${esc(settings.contractNo||"")}"></label>
      <label class="field span2"><span>Ghi chú thương mại</span><textarea name="notes">${esc(settings.notes||"")}</textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());
      ["contractValueExVat","vatPct","advancePct","retentionPct","paymentTermsDays"].forEach(k=>d[k]=Number(d[k]||0));
      d.updatedAt=ts();if(!settings.createdAt)d.createdAt=ts();
      await refs.financeSettings(selectedProjectId).update(d);
      await logActivity("FINANCE_SETTINGS",`Cập nhật hợp đồng tài chính ${p?.code||""}`,{projectId:selectedProjectId});
      toast("Đã cập nhật cấu hình hợp đồng.");await refresh(c);return true;
    }
  });
}

async function importBudgetFromBoq(c){
  if(!boqItems.length){toast("Dự án chưa có BOQ để tạo Budget.","warning");return}
  if(budgets.length&&!await confirmBox("Tạo lại Budget từ BOQ",`Hiện đã có ${budgets.length} dòng Budget. Tạo lại sẽ xóa Budget cũ và thay bằng số liệu BOQ hiện tại.`,"Tạo lại"))return;

  const sum={MATERIAL:0,LABOR:0,SUBCONTRACT:0,OTHER:0};
  boqItems.forEach(x=>{
    const qty=Number(x.qty||0),factor=1+Number(x.wastePct||0)/100;
    sum.MATERIAL+=qty*Number(x.materialUnit||0)*factor;
    sum.LABOR+=qty*Number(x.laborUnit||0)*factor;
    sum.SUBCONTRACT+=qty*Number(x.subcontractUnit||0)*factor;
    sum.OTHER+=qty*Number(x.otherUnit||0)*factor;
  });
  const direct=sum.MATERIAL+sum.LABOR+sum.SUBCONTRACT+sum.OTHER;
  const overhead=direct*Number(pricing.overheadPct||0)/100;
  const contingency=direct*Number(pricing.contingencyPct||0)/100;
  const rows=[
    ["MATERIAL","Vật tư theo BOQ",sum.MATERIAL],
    ["LABOR","Nhân công theo BOQ",sum.LABOR],
    ["SUBCONTRACT","Thầu phụ theo BOQ",sum.SUBCONTRACT],
    ["OTHER","Chi phí khác theo BOQ",sum.OTHER],
    ["OVERHEAD",`Chi phí chung ${num(pricing.overheadPct||0,1)}%`,overhead],
    ["CONTINGENCY",`Dự phòng ${num(pricing.contingencyPct||0,1)}%`,contingency]
  ].filter(x=>x[2]!==0);

  const obj={};
  rows.forEach(r=>{const key=refs.budgetsProject(selectedProjectId).push().key;obj[key]={category:r[0],discipline:"",description:r[1],budgetAmount:r[2],forecastAmount:r[2],source:"BOQ",notes:"Tạo tự động từ BOQ & Lập giá",createdAt:Date.now(),updatedAt:Date.now()}});

  await refs.budgetsProject(selectedProjectId).set(obj);
  await logActivity("BUDGET_FROM_BOQ",`Tạo Budget từ BOQ: ${money(rows.reduce((s,x)=>s+x[2],0))}`,{projectId:selectedProjectId});
  toast("Đã tạo Budget từ BOQ.");tab="BUDGET";await refresh(c);
}

function editBudget(id,c){
  const x=budgets.find(b=>b.id===id)||{};
  modal({
    title:id?"Cập nhật Budget":"Thêm Budget",eyebrow:"NGÂN SÁCH DỰ ÁN",size:"lg",
    body:`<div class="form-grid">
      <label class="field"><span>Nhóm chi phí</span><select name="category">${BUDGET_CATEGORIES.map(v=>`<option value="${v[0]}" ${x.category===v[0]?"selected":""}>${v[1]}</option>`).join("")}</select></label>
      <label class="field"><span>Hệ thống</span><select name="discipline"><option value="">Tất cả</option>${DISCIPLINES.map(v=>`<option value="${v}" ${x.discipline===v?"selected":""}>${v}</option>`).join("")}</select></label>
      <label class="field span2"><span>Nội dung</span><input name="description" value="${esc(x.description||"")}"></label>
      <label class="field"><span>Budget *</span><input required type="number" min="0" step="any" name="budgetAmount" value="${Number(x.budgetAmount||0)}"></label>
      <label class="field"><span>Forecast Cost *</span><input required type="number" min="0" step="any" name="forecastAmount" value="${Number(x.forecastAmount??x.budgetAmount??0)}"></label>
      <label class="field span2"><span>Ghi chú</span><textarea name="notes">${esc(x.notes||"")}</textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.budgetAmount=Number(d.budgetAmount||0);d.forecastAmount=Number(d.forecastAmount||0);d.updatedAt=ts();
      if(id)await refs.budgetItem(selectedProjectId,id).update(d);
      else{const key=refs.budgetsProject(selectedProjectId).push().key;d.createdAt=ts();await refs.budgetItem(selectedProjectId,key).set(d)}
      await logActivity("BUDGET_SAVED",`${id?"Cập nhật":"Thêm"} Budget ${d.description||categoryLabel(d.category)}`,{projectId:selectedProjectId});
      toast("Đã lưu Budget.");await refresh(c);return true;
    }
  });
}

async function deleteBudget(id,c){
  const x=budgets.find(b=>b.id===id);
  if(!await confirmBox("Xóa Budget",`Xóa "${x?.description||categoryLabel(x?.category)}"?`,"Xóa"))return;
  await refs.budgetItem(selectedProjectId,id).remove();toast("Đã xóa Budget.","warning");await refresh(c);
}

function editCost(id,c){
  const x=costs.find(v=>v.id===id)||{};
  modal({
    title:id?"Cập nhật chi phí":"Ghi nhận chi phí thực tế",eyebrow:"ACTUAL COST / CÔNG NỢ NCC",size:"lg",
    body:`<div class="form-grid">
      <label class="field"><span>Ngày ghi nhận *</span><input required type="date" name="costDate" value="${esc(x.costDate||todayIso())}"></label>
      <label class="field"><span>Nhóm chi phí</span><select name="category">${BUDGET_CATEGORIES.map(v=>`<option value="${v[0]}" ${x.category===v[0]?"selected":""}>${v[1]}</option>`).join("")}</select></label>
      <label class="field"><span>Hệ thống</span><select name="discipline"><option value="">Khác / Chung</option>${DISCIPLINES.map(v=>`<option value="${v}" ${x.discipline===v?"selected":""}>${v}</option>`).join("")}</select></label>
      <label class="field"><span>NCC / Thầu phụ</span><input name="supplier" value="${esc(x.supplier||"")}"></label>
      <label class="field span2"><span>Nội dung chi phí *</span><input required name="description" value="${esc(x.description||"")}"></label>
      <label class="field"><span>Số hóa đơn / Chứng từ</span><input name="invoiceNo" value="${esc(x.invoiceNo||"")}"></label>
      <label class="field"><span>Hạn thanh toán</span><input type="date" name="dueDate" value="${esc(x.dueDate||"")}"></label>
      <label class="field"><span>Giá trị trước VAT *</span><input required type="number" min="0" step="any" name="amountExVat" value="${Number(x.amountExVat||0)}"></label>
      <label class="field"><span>VAT %</span><input type="number" min="0" max="100" step="any" name="vatPct" value="${Number(x.vatPct??10)}"></label>
      <label class="field span2"><span>Ghi chú</span><textarea name="notes">${esc(x.notes||"")}</textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.amountExVat=Number(d.amountExVat||0);d.vatPct=Number(d.vatPct||0);d.updatedAt=ts();
      if(id)await refs.actualCost(selectedProjectId,id).update(d);
      else{const key=refs.actualCostsProject(selectedProjectId).push().key;d.createdAt=ts();await refs.actualCost(selectedProjectId,key).set(d)}
      await logActivity("ACTUAL_COST_SAVED",`${id?"Cập nhật":"Ghi nhận"} chi phí ${d.description}`,{projectId:selectedProjectId});
      toast("Đã lưu chi phí thực tế.");await refresh(c);return true;
    }
  });
}

function recordSupplierPayment(costId,c){
  const x=costs.find(v=>v.id===costId);if(!x)return;
  const total=costTotal(x),paid=payments.filter(p=>p.costId===costId).reduce((s,p)=>s+Number(p.amount||0),0),remain=Math.max(0,total-paid);
  modal({
    title:"Ghi nhận thanh toán NCC",eyebrow:x.supplier||x.description||"CÔNG NỢ",size:"sm",submitText:"Ghi nhận thanh toán",
    body:`<div class="finance-pay-summary"><span>Tổng chứng từ</span><b>${money(total)}</b><span>Đã trả</span><b>${money(paid)}</b><span>Còn nợ</span><b class="danger-text">${money(remain)}</b></div>
    <div class="form-grid mt">
      <label class="field"><span>Ngày thanh toán *</span><input required type="date" name="paymentDate" value="${todayIso()}"></label>
      <label class="field"><span>Số tiền *</span><input required type="number" min="0" max="${remain}" step="any" name="amount" value="${remain}"></label>
      <label class="field span2"><span>UNC / Phiếu chi / Tham chiếu</span><input name="referenceNo"></label>
      <label class="field span2"><span>Ghi chú</span><textarea name="notes"></textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.amount=Number(d.amount||0);
      if(d.amount<=0||d.amount>remain){toast("Số tiền thanh toán không hợp lệ.","error");return false}
      d.costId=costId;d.supplier=x.supplier||"";d.createdAt=ts();
      const key=refs.supplierPaymentsProject(selectedProjectId).push().key;await refs.supplierPayment(selectedProjectId,key).set(d);
      await logActivity("SUPPLIER_PAYMENT",`Thanh toán ${money(d.amount)} cho ${x.supplier||x.description}`,{projectId:selectedProjectId,costId});
      toast("Đã ghi nhận thanh toán NCC.");await refresh(c);return true;
    }
  });
}

async function deleteCost(id,c){
  const x=costs.find(v=>v.id===id),hasPay=payments.some(p=>p.costId===id);
  if(hasPay){toast("Chi phí này đã có lịch sử thanh toán. Không thể xóa; hãy chỉnh sửa chứng từ.","error");return}
  if(!await confirmBox("Xóa chi phí",`Xóa "${x?.description||""}"?`,"Xóa"))return;
  await refs.actualCost(selectedProjectId,id).remove();toast("Đã xóa chi phí.","warning");await refresh(c);
}

function editVariation(id,c){
  const x=variations.find(v=>v.id===id)||{};
  modal({
    title:id?"Cập nhật phát sinh":"Thêm phát sinh / Variation",eyebrow:"VARIATION / VO",size:"lg",
    body:`<div class="form-grid">
      <label class="field"><span>Mã phát sinh *</span><input required name="code" value="${esc(x.code||`VO-${String(variations.length+1).padStart(2,"0")}`)}"></label>
      <label class="field"><span>Ngày phát sinh</span><input type="date" name="date" value="${esc(x.date||todayIso())}"></label>
      <label class="field span2"><span>Nội dung *</span><input required name="title" value="${esc(x.title||"")}"></label>
      <label class="field"><span>Loại</span><select name="direction"><option value="INCREASE" ${x.direction!=="DECREASE"?"selected":""}>Tăng giá trị HĐ</option><option value="DECREASE" ${x.direction==="DECREASE"?"selected":""}>Giảm giá trị HĐ</option></select></label>
      <label class="field"><span>Giá trị trước VAT *</span><input required type="number" min="0" step="any" name="amount" value="${Number(x.amount||0)}"></label>
      <label class="field"><span>Trạng thái</span><select name="status">${VAR_STATUSES.map(v=>`<option value="${v[0]}" ${(x.status||"DRAFT")===v[0]?"selected":""}>${v[1]}</option>`).join("")}</select></label>
      <label class="field"><span>Ngày duyệt</span><input type="date" name="approvedDate" value="${esc(x.approvedDate||"")}"></label>
      <label class="field"><span>Tham chiếu CĐT / Email / VO</span><input name="clientRef" value="${esc(x.clientRef||"")}"></label>
      <label class="field span2"><span>Ghi chú</span><textarea name="notes">${esc(x.notes||"")}</textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.amount=Number(d.amount||0);if(d.status==="APPROVED"&&!d.approvedDate)d.approvedDate=todayIso();d.updatedAt=ts();
      if(id)await refs.variation(selectedProjectId,id).update(d);
      else{const key=refs.variationsProject(selectedProjectId).push().key;d.createdAt=ts();await refs.variation(selectedProjectId,key).set(d)}
      await logActivity("VARIATION_SAVED",`${id?"Cập nhật":"Thêm"} phát sinh ${d.code}`,{projectId:selectedProjectId});
      toast("Đã lưu phát sinh.");await refresh(c);return true;
    }
  });
}

async function changeVariationStatus(id,status,c){
  const x=variations.find(v=>v.id===id);if(!x)return;
  const patch={status,updatedAt:ts()};if(status==="APPROVED")patch.approvedDate=todayIso();
  await refs.variation(selectedProjectId,id).update(patch);
  await logActivity("VARIATION_STATUS",`${x.code} → ${VAR_STATUSES.find(v=>v[0]===status)?.[1]||status}`,{projectId:selectedProjectId});
  toast("Đã cập nhật trạng thái phát sinh.");await refresh(c);
}

async function deleteVariation(id,c){
  const x=variations.find(v=>v.id===id);
  if(x?.status==="APPROVED"){toast("Phát sinh đã duyệt không nên xóa. Hãy tạo phát sinh điều chỉnh ngược nếu cần.","error");return}
  if(!await confirmBox("Xóa phát sinh",`Xóa ${x?.code||""} - ${x?.title||""}?`,"Xóa"))return;
  await refs.variation(selectedProjectId,id).remove();toast("Đã xóa phát sinh.","warning");await refresh(c);
}

function editBilling(id,c){
  const x=billings.find(v=>v.id===id)||{},defaultVat=Number(settings.vatPct??pricing.vatPct??10);
  modal({
    title:id?"Cập nhật hóa đơn / Đợt thanh toán":"Thêm hóa đơn / Đợt thanh toán",eyebrow:"BILLING / AR",size:"lg",
    body:`<div class="form-grid">
      <label class="field"><span>Số HĐ / Mã đợt *</span><input required name="invoiceNo" value="${esc(x.invoiceNo||`HD-${String(billings.length+1).padStart(2,"0")}`)}"></label>
      <label class="field"><span>Kỳ / Đợt</span><input name="period" value="${esc(x.period||"")}"></label>
      <label class="field span2"><span>Nội dung *</span><input required name="description" value="${esc(x.description||"")}"></label>
      <label class="field"><span>Ngày xuất / nghiệm thu *</span><input required type="date" name="billingDate" value="${esc(x.billingDate||todayIso())}"></label>
      <label class="field"><span>Hạn thanh toán</span><input type="date" name="dueDate" value="${esc(x.dueDate||defaultDueDate(settings.paymentTermsDays||30))}"></label>
      <label class="field"><span>Giá trị trước VAT *</span><input required type="number" min="0" step="any" name="amountExVat" value="${Number(x.amountExVat||0)}"></label>
      <label class="field"><span>VAT %</span><input type="number" min="0" max="100" step="any" name="vatPct" value="${Number(x.vatPct??defaultVat)}"></label>
      <label class="field span2"><span>Ghi chú</span><textarea name="notes">${esc(x.notes||"")}</textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.amountExVat=Number(d.amountExVat||0);d.vatPct=Number(d.vatPct||0);d.updatedAt=ts();
      if(id)await refs.billing(selectedProjectId,id).update(d);
      else{const key=refs.billingsProject(selectedProjectId).push().key;d.createdAt=ts();await refs.billing(selectedProjectId,key).set(d)}
      await logActivity("BILLING_SAVED",`${id?"Cập nhật":"Xuất"} hóa đơn ${d.invoiceNo}`,{projectId:selectedProjectId});
      toast("Đã lưu hóa đơn / đợt thanh toán.");await refresh(c);return true;
    }
  });
}

function recordReceipt(billingId,c){
  const x=billings.find(v=>v.id===billingId);if(!x)return;
  const total=billingTotal(x),collected=receipts.filter(r=>r.billingId===billingId).reduce((s,r)=>s+Number(r.amount||0),0),remain=Math.max(0,total-collected);
  modal({
    title:"Ghi nhận thu tiền",eyebrow:x.invoiceNo||x.description||"CÔNG NỢ KHÁCH HÀNG",size:"sm",submitText:"Ghi nhận thu tiền",
    body:`<div class="finance-pay-summary"><span>Tổng hóa đơn</span><b>${money(total)}</b><span>Đã thu</span><b>${money(collected)}</b><span>Còn phải thu</span><b class="danger-text">${money(remain)}</b></div>
    <div class="form-grid mt">
      <label class="field"><span>Ngày thu *</span><input required type="date" name="receiptDate" value="${todayIso()}"></label>
      <label class="field"><span>Số tiền *</span><input required type="number" min="0" max="${remain}" step="any" name="amount" value="${remain}"></label>
      <label class="field span2"><span>Ủy nhiệm / Sao kê / Tham chiếu</span><input name="referenceNo"></label>
      <label class="field span2"><span>Ghi chú</span><textarea name="notes"></textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.amount=Number(d.amount||0);
      if(d.amount<=0||d.amount>remain){toast("Số tiền thu không hợp lệ.","error");return false}
      d.billingId=billingId;d.createdAt=ts();
      const key=refs.receiptsProject(selectedProjectId).push().key;await refs.receipt(selectedProjectId,key).set(d);
      await logActivity("CUSTOMER_RECEIPT",`Thu ${money(d.amount)} cho ${x.invoiceNo||x.description}`,{projectId:selectedProjectId,billingId});
      toast("Đã ghi nhận thu tiền.");await refresh(c);return true;
    }
  });
}

async function deleteBilling(id,c){
  const x=billings.find(v=>v.id===id),hasReceipt=receipts.some(r=>r.billingId===id);
  if(hasReceipt){toast("Hóa đơn này đã có lịch sử thu tiền. Không thể xóa; hãy chỉnh sửa nội dung.","error");return}
  if(!await confirmBox("Xóa hóa đơn",`Xóa ${x?.invoiceNo||x?.description||""}?`,"Xóa"))return;
  await refs.billing(selectedProjectId,id).remove();toast("Đã xóa hóa đơn.","warning");await refresh(c);
}

function financials(p){
  const originalContract=Number(settings.contractValueExVat??p?.approvedBidPrice??0);
  const approvedVariation=variations.filter(v=>v.status==="APPROVED").reduce((s,v)=>s+(v.direction==="DECREASE"?-1:1)*Number(v.amount||0),0);
  const revisedContract=originalContract+approvedVariation;
  const vatPct=Number(settings.vatPct??pricing.vatPct??10);

  const budget=budgets.reduce((s,b)=>s+Number(b.budgetAmount||0),0);
  const actual=costs.reduce((s,x)=>s+Number(x.amountExVat||0),0);
  const forecast=budgets.length?budgets.reduce((s,b)=>s+Number(b.forecastAmount??b.budgetAmount??0),0):actual;
  const committedRows=procurement.filter(x=>["PO","DELIVERING","DELIVERED"].includes(x.status));
  const committed=committedRows.reduce((s,x)=>s+Number(x.amount||0),0);
  const costTotalWithVat=costs.reduce((s,x)=>s+costTotal(x),0);
  const paidSupplier=payments.reduce((s,x)=>s+Number(x.amount||0),0);
  const payable=Math.max(0,costTotalWithVat-paidSupplier);

  const billedExVat=billings.reduce((s,x)=>s+Number(x.amountExVat||0),0);
  const billedTotal=billings.reduce((s,x)=>s+billingTotal(x),0);
  const collected=receipts.reduce((s,x)=>s+Number(x.amount||0),0);
  const receivable=Math.max(0,billedTotal-collected);

  const forecastProfit=revisedContract-forecast;
  const forecastMargin=revisedContract?forecastProfit/revisedContract*100:0;
  const overdueReceivableCount=billings.filter(x=>billingOutstanding(x)>0&&x.dueDate&&daysUntil(x.dueDate)<0).length;
  const overduePayableCount=costs.filter(x=>costOutstanding(x)>0&&x.dueDate&&daysUntil(x.dueDate)<0).length;

  return {
    originalContract,approvedVariation,revisedContract,vatPct,budget,forecast,committed,committedCount:committedRows.length,
    actual,costTotalWithVat,paidSupplier,payable,billedExVat,billedTotal,collected,receivable,
    forecastProfit,forecastMargin,overdueReceivableCount,overduePayableCount,netCash:collected-paidSupplier
  };
}

async function refresh(c){await loadProjectData();paint(c)}

function exportFinanceCsv(){
  const p=projects.find(x=>x.id===selectedProjectId),f=financials(p);
  const rows=[
    ["TÀI CHÍNH DỰ ÁN",p?.code||"",p?.name||""],
    [],
    ["TỔNG HỢP","GIÁ TRỊ"],
    ["HĐ gốc trước VAT",f.originalContract],
    ["Phát sinh đã duyệt",f.approvedVariation],
    ["HĐ điều chỉnh",f.revisedContract],
    ["Budget",f.budget],
    ["PO cam kết",f.committed],
    ["Actual Cost",f.actual],
    ["Forecast Cost",f.forecast],
    ["Forecast Profit",f.forecastProfit],
    ["Forecast Margin %",f.forecastMargin],
    ["Đã xuất HĐ gồm VAT",f.billedTotal],
    ["Đã thu",f.collected],
    ["Phải thu",f.receivable],
    ["Đã trả NCC",f.paidSupplier],
    ["Phải trả NCC",f.payable],
    [],
    ["BUDGET"],["Nhóm","Hệ","Nội dung","Budget","Forecast"],
    ...budgets.map(x=>[categoryLabel(x.category),x.discipline||"",x.description||"",x.budgetAmount||0,x.forecastAmount??x.budgetAmount??0]),
    [],
    ["CHI PHÍ THỰC TẾ"],["Ngày","Nhóm","NCC","Nội dung","Chứng từ","Trước VAT","VAT %","Tổng"],
    ...costs.map(x=>[x.costDate||"",categoryLabel(x.category),x.supplier||"",x.description||"",x.invoiceNo||"",x.amountExVat||0,x.vatPct||0,costTotal(x)]),
    [],
    ["PHÁT SINH"],["Mã","Ngày","Nội dung","Loại","Giá trị","Trạng thái"],
    ...variations.map(x=>[x.code||"",x.date||"",x.title||"",x.direction==="DECREASE"?"Giảm":"Tăng",x.amount||0,x.status||""]),
    [],
    ["HÓA ĐƠN"],["Số HĐ","Ngày","Hạn TT","Trước VAT","VAT %","Tổng","Đã thu"],
    ...billings.map(x=>[x.invoiceNo||"",x.billingDate||"",x.dueDate||"",x.amountExVat||0,x.vatPct||0,billingTotal(x),receipts.filter(r=>r.billingId===x.id).reduce((s,r)=>s+Number(r.amount||0),0)])
  ];
  downloadCsv(`TAI_CHINH_${p?.code||"DU_AN"}.csv`,rows);
}

function costTotal(x){return Number(x.amountExVat||0)*(1+Number(x.vatPct||0)/100)}
function billingTotal(x){return Number(x.amountExVat||0)*(1+Number(x.vatPct||0)/100)}
function costOutstanding(x){return Math.max(0,costTotal(x)-payments.filter(p=>p.costId===x.id).reduce((s,p)=>s+Number(p.amount||0),0))}
function billingOutstanding(x){return Math.max(0,billingTotal(x)-receipts.filter(r=>r.billingId===x.id).reduce((s,r)=>s+Number(r.amount||0),0))}
function categoryLabel(k){return BUDGET_CATEGORIES.find(v=>v[0]===k)?.[1]||k||"Khác"}
function toArray(v){return Object.entries(v||{}).map(([id,x])=>({id,...(x||{})}))}
function num(v,d=2){return Number(v||0).toLocaleString("vi-VN",{maximumFractionDigits:d})}
function pct(a,b){return b?Math.round(Number(a||0)/Number(b)*100):0}
function signedMoney(v){const n=Number(v||0);return `${n>0?"+":n<0?"-":""}${money(Math.abs(n))}`}
function todayIso(){return new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)}
function defaultDueDate(days){const d=new Date();d.setDate(d.getDate()+Number(days||30));return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function metric(label,value,icon,c,s,foot){return `<div class="metric" style="--c:${c};--s:${s}"><div class="metric-head"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></div>`}
function cashMetric(label,value,foot,c){return `<div class="finance-cash-metric" style="--c:${c}"><span>${label}</span><b>${money(value,true)}</b><small>${foot}</small></div>`}
function smallMetric(label,value,color="blue"){return `<div class="mini-metric ${color}"><span>${label}</span><b>${value}</b></div>`}
function summaryRow(label,value,strong=false,color=""){return `<div class="summary-row"><span>${label}</span><b class="${color==="green"?"positive-text":color==="red"?"danger-text":""}" ${strong?'style="font-size:12px"':""}>${value}</b></div>`}
function progressLine(label,value,caption,color="blue"){const v=Math.max(0,Math.min(150,Number(value||0)));return `<div class="finance-progress-line"><div><span>${label}</span><b>${num(value,0)}%</b></div><div class="progress"><div class="bar ${color==="red"?"bar-danger":color==="orange"?"bar-warning":color==="green"?"bar-green":""}" style="width:${Math.min(100,v)}%"></div></div><small>${caption}</small></div>`}
function miniAlert(label,value,color){return `<div class="finance-mini-alert ${color}"><span>${label}</span><b>${value}</b></div>`}
function varianceCard(title,base,current,profit=false){const delta=Number(base||0)-Number(current||0),ratio=base?delta/base*100:0;return `<div class="card"><div class="card-head"><h3>${title}</h3></div><div class="card-body"><div class="variance-main ${delta>=0?"positive-text":"danger-text"}">${signedMoney(delta)}</div><div class="secondary-text">${profit?"Lợi nhuận / phần còn lại":"Còn lại so với cơ sở"} · ${num(ratio,1)}%</div></div></div>`}
function downloadCsv(name,rows){const csv=rows.map(r=>(r||[]).map(csvEscape).join(";")).join("\r\n"),blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
function csvEscape(v){return `"${String(v??"").replaceAll('"','""')}"`}
