import {
  refs, arr, ts, logActivity, can, getProfile, esc, norm, money, fmtDate, fmtDateTime,
  DISCIPLINES, setPage, loading, empty, badge, modal, toast, confirmBox
} from "../core.js?v=2.4.1";

let projects = [];
let items = [];
let quotesByItem = {};
let pricing = defaults();
let versions = [];
let selectedProjectId = "";
let q = "";
let disciplineFilter = "ALL";

function defaults(){
  return {overheadPct:0, contingencyPct:0, discountPct:0, vatPct:10};
}

export async function renderBOQ(container) {
  setPage("BOQ & Lập giá", "Công việc / Đấu thầu / BOQ");
  container.innerHTML = loading();

  projects = await arr(refs.projects());
  const allowed = projects.filter(p => p.phase === "TENDER" || p.phase === "EXECUTION");
  if (!selectedProjectId && allowed.length) selectedProjectId = allowed[0].id;
  if (selectedProjectId && !allowed.some(p => p.id === selectedProjectId)) selectedProjectId = allowed[0]?.id || "";

  await loadProjectData();
  paint(container);
}

async function loadProjectData() {
  if (!selectedProjectId) {
    items = []; quotesByItem = {}; pricing = defaults(); versions = [];
    return;
  }
  const [boqSnap, quoteSnap, pricingSnap, versionSnap] = await Promise.all([
    refs.boqProject(selectedProjectId).once("value"),
    refs.supplierQuotesProject(selectedProjectId).once("value"),
    refs.pricingSettings(selectedProjectId).once("value"),
    refs.boqVersionsProject(selectedProjectId).once("value")
  ]);

  const boqVal = boqSnap.val() || {};
  items = Object.entries(boqVal).map(([id, x]) => ({ id, ...(x || {}) }));
  items.sort((a,b) => String(a.itemNo || "").localeCompare(String(b.itemNo || ""), "vi", {numeric:true}));
  quotesByItem = quoteSnap.val() || {};
  pricing = {...defaults(), ...(pricingSnap.val() || {})};
  const verVal = versionSnap.val() || {};
  versions = Object.entries(verVal).map(([id,x])=>({id,...(x||{})})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}

function paint(container) {
  const p = projects.find(x => x.id === selectedProjectId);
  const visible = items.filter(x => {
    const okQ = !q || norm(`${x.itemNo} ${x.discipline} ${x.category} ${x.description} ${x.specification} ${x.brand} ${x.selectedSupplier}`).includes(norm(q));
    const okD = disciplineFilter === "ALL" || x.discipline === disciplineFilter;
    return okQ && okD;
  });

  const totals = calcProjectTotals(items, pricing);
  const missingPrice = items.filter(x => Number(x.materialUnit || 0) <= 0).length;
  const noQuotes = items.filter(x => quoteList(x.id).length === 0).length;

  container.innerHTML = `
    <div class="page-head">
      <div>
        <h2>BOQ & Lập giá</h2>
        <p>BOQ chi tiết, so sánh NCC, chi phí chung, dự phòng, chiết khấu, VAT và lưu nhiều phiên bản giá.</p>
      </div>
      <div class="actions">
        ${selectedProjectId ? `<button class="btn" id="matrixBtn">▦ Ma trận NCC</button>
          <button class="btn" id="versionsBtn">Phiên bản (${versions.length})</button>
          ${can("boqEdit")?`<button class="btn" id="saveVersionBtn">Lưu phiên bản</button>`:""}
          <button class="btn" id="downloadTemplateBtn">Tải mẫu CSV</button>
          <label class="btn" style="cursor:pointer">Nhập CSV<input id="importCsvInput" type="file" accept=".csv,text/csv" hidden></label>
          <button class="btn" id="exportBoqBtn">Xuất CSV</button>` : ""}
        ${selectedProjectId && can("boqEdit") ? `<button class="btn primary" id="addBoqBtn">＋ Thêm dòng BOQ</button>` : ""}
      </div>
    </div>

    <div class="toolbar">
      <select id="boqProjectSelect" style="min-width:320px">
        <option value="">-- Chọn dự án --</option>
        ${projects.filter(x => x.phase === "TENDER" || x.phase === "EXECUTION").map(x =>
          `<option value="${x.id}" ${x.id===selectedProjectId?"selected":""}>${esc(x.code||"")} - ${esc(x.name||"")}</option>`
        ).join("")}
      </select>
      <div class="search"><input id="boqSearch" value="${esc(q)}" placeholder="Tìm STT, mô tả, thông số, hãng, NCC..."></div>
      <select id="boqDiscipline"><option value="ALL">Tất cả hệ</option>${DISCIPLINES.map(d=>`<option value="${d}" ${disciplineFilter===d?"selected":""}>${d}</option>`).join("")}</select>
    </div>

    ${selectedProjectId ? `
      <div class="grid g5">
        ${metric("NET trực tiếp", money(totals.directNet,true), "N", "#64748b", "#f8fafc", money(totals.directNet))}
        ${metric("Chi phí dự án", money(totals.projectCost,true), "C", "#7c3aed", "#f5f3ff", `CC ${num(pricing.overheadPct,1)}% · DP ${num(pricing.contingencyPct,1)}%`)}
        ${metric("Chào trước VAT", money(totals.bidExVat,true), "₫", "#2563eb", "#eff6ff", `CK ${num(pricing.discountPct,1)}%`)}
        ${metric("Tổng sau VAT", money(totals.grandTotal,true), "+", "#0284c7", "#ecfeff", `VAT ${num(pricing.vatPct,1)}%`)}
        ${metric("LN gộp", totals.margin.toFixed(1)+"%", "↗", "#16a34a", "#f0fdf4", money(totals.profit))}
      </div>

      <div class="grid g2 mt">
        <div class="card pricing-card">
          <div class="card-head"><div><h3>Chi phí & điều chỉnh cấp dự án</h3><div class="secondary-text">Áp dụng sau khi tổng hợp các dòng BOQ</div></div>${can("boqEdit")?`<button class="btn sm" id="editPricingBtn">Cập nhật</button>`:""}</div>
          <div class="card-body pricing-summary">
            ${summaryLine("NET trực tiếp", totals.directNet)}
            ${summaryLine(`Chi phí chung (${num(pricing.overheadPct,1)}%)`, totals.overhead)}
            ${summaryLine(`Dự phòng (${num(pricing.contingencyPct,1)}%)`, totals.contingency)}
            ${summaryLine("Tổng chi phí dự án", totals.projectCost, true)}
            <div class="pricing-sep"></div>
            ${summaryLine("Giá chào theo dòng BOQ", totals.lineBid)}
            ${summaryLine("+ Chi phí chung + dự phòng", totals.overhead + totals.contingency)}
            ${summaryLine(`- Chiết khấu (${num(pricing.discountPct,1)}%)`, -totals.discount)}
            ${summaryLine("Giá chào trước VAT", totals.bidExVat, true)}
            ${summaryLine(`VAT (${num(pricing.vatPct,1)}%)`, totals.vat)}
            ${summaryLine("TỔNG SAU VAT", totals.grandTotal, true, "grand")}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Kiểm soát dữ liệu giá</h3><div class="secondary-text">Các mục cần xử lý trước khi trình duyệt</div></div>${badge(`${versions.length} phiên bản`,"blue")}</div>
          <div class="card-body">
            ${controlLine("Số dòng BOQ", items.length, items.length?"green":"orange")}
            ${controlLine("Chưa có giá vật tư", missingPrice, missingPrice?"orange":"green")}
            ${controlLine("Chưa có báo giá NCC", noQuotes, noQuotes?"orange":"green")}
            ${controlLine("Đã chọn báo giá", items.filter(x=>x.selectedQuoteId).length, "blue")}
            ${controlLine("Tỷ lệ LN trước VAT", totals.margin.toFixed(1)+"%", totals.margin<0?"red":totals.margin<5?"orange":"green")}
          </div>
        </div>
      </div>

      <div class="card mt">
        <div class="card-head">
          <div><h3>${esc(p?.code || "")} · ${esc(p?.name || "")}</h3><div class="secondary-text">${esc(p?.client || "")}</div></div>
          <div class="actions">${badge(`${items.length} dòng BOQ`, "blue")}${missingPrice ? badge(`${missingPrice} thiếu giá`, "orange") : badge("Đã có giá vật tư", "green")}</div>
        </div>
        <div class="table-wrap" style="border:0;border-radius:0 0 11px 11px">
          <table class="table boq-table">
            <thead><tr>
              <th>STT</th><th>HỆ</th><th>MÔ TẢ / THÔNG SỐ</th><th>ĐVT</th><th>KL</th><th>GIÁ VT</th><th>NHÂN CÔNG</th><th>THẦU PHỤ</th><th>KHÁC</th><th>HAO HỤT</th><th>NET / ĐVT</th><th>MARKUP</th><th>GIÁ CHÀO / ĐVT</th><th>THÀNH TIỀN CHÀO</th><th>NCC ĐÃ CHỌN</th><th style="text-align:right">THAO TÁC</th>
            </tr></thead>
            <tbody>${visible.length ? visible.map(rowHtml).join("") : `<tr><td colspan="16">${empty("Chưa có dữ liệu BOQ","Thêm dòng BOQ mới hoặc nhập file CSV theo mẫu.","▦")}</td></tr>`}</tbody>
            ${items.length ? `<tfoot><tr><th colspan="10" style="text-align:right">TỔNG TRỰC TIẾP</th><th>${money(totals.directNet)}</th><th></th><th></th><th>${money(totals.lineBid)}</th><th colspan="2">${badge(`LN dòng ${totals.lineMargin.toFixed(1)}%`,"green")}</th></tr></tfoot>` : ""}
          </table>
        </div>
      </div>
    ` : empty("Chưa có dự án","Tạo dự án trước rồi quay lại BOQ & Lập giá.","▣")}
  `;

  bind(container);
}

function bind(container) {
  container.querySelector("#boqProjectSelect")?.addEventListener("change", async e => {
    selectedProjectId = e.target.value; q = ""; disciplineFilter = "ALL"; container.innerHTML = loading(); await loadProjectData(); paint(container);
  });
  container.querySelector("#boqSearch")?.addEventListener("input", e => {
    q = e.target.value; paint(container); requestAnimationFrame(()=>{const i=container.querySelector("#boqSearch");i?.focus();i?.setSelectionRange(i.value.length,i.value.length)});
  });
  container.querySelector("#boqDiscipline")?.addEventListener("change", e => { disciplineFilter = e.target.value; paint(container); });
  container.querySelector("#addBoqBtn")?.addEventListener("click", () => openItem(null, container));
  container.querySelector("#editPricingBtn")?.addEventListener("click", () => openPricing(container));
  container.querySelector("#matrixBtn")?.addEventListener("click", () => openSupplierMatrix(container));
  container.querySelector("#versionsBtn")?.addEventListener("click", () => openVersions(container));
  container.querySelector("#saveVersionBtn")?.addEventListener("click", () => saveVersionModal(container));
  container.querySelectorAll("[data-edit-item]").forEach(b => b.addEventListener("click", () => openItem(b.dataset.editItem, container)));
  container.querySelectorAll("[data-del-item]").forEach(b => b.addEventListener("click", () => deleteItem(b.dataset.delItem, container)));
  container.querySelectorAll("[data-quotes]").forEach(b => b.addEventListener("click", () => openQuotes(b.dataset.quotes, container)));
  container.querySelector("#exportBoqBtn")?.addEventListener("click", exportCsv);
  container.querySelector("#downloadTemplateBtn")?.addEventListener("click", downloadTemplate);
  container.querySelector("#importCsvInput")?.addEventListener("change", e => importCsv(e.target.files?.[0], container));
}

function rowHtml(x) {
  const c = calcLine(x), quoteCount = quoteList(x.id).length;
  return `<tr>
    <td><div class="primary-text">${esc(x.itemNo || "—")}</div><div class="secondary-text">${esc(x.category || "")}</div></td>
    <td>${badge(x.discipline || "KHÁC","gray")}</td>
    <td style="min-width:280px"><div class="primary-text">${esc(x.description || "—")}</div><div class="secondary-text">${esc(x.specification || "")}${x.brand?` · Hãng: ${esc(x.brand)}`:""}</div></td>
    <td>${esc(x.unit || "—")}</td><td>${num(x.qty,3)}</td>
    <td class="${Number(x.materialUnit||0)<=0?"danger-text":""}">${money(x.materialUnit)}</td>
    <td>${money(x.laborUnit)}</td><td>${money(x.subcontractUnit)}</td><td>${money(x.otherUnit)}</td><td>${num(x.wastePct,1)}%</td>
    <td><b>${money(c.netUnit)}</b></td><td>${num(x.markupPct,1)}%</td><td><b>${money(c.bidUnit)}</b></td>
    <td><b>${money(c.bidTotal)}</b><div class="secondary-text">NET ${money(c.netTotal)}</div></td>
    <td><div>${esc(x.selectedSupplier || "—")}</div><div class="secondary-text">${quoteCount} báo giá${x.selectedQuoteId?" · đã chọn":""}</div></td>
    <td><div class="row-actions"><button class="btn sm soft" data-quotes="${x.id}">So giá (${quoteCount})</button>${can("boqEdit")?`<button class="btn sm" data-edit-item="${x.id}">Sửa</button><button class="btn red sm" data-del-item="${x.id}">Xóa</button>`:""}</div></td>
  </tr>`;
}

function itemForm(x={}) {
  return `<div class="form-grid">
    <label class="field"><span>STT / Mã BOQ *</span><input required name="itemNo" value="${esc(x.itemNo || String(items.length+1))}"></label>
    <label class="field"><span>Hệ thống</span><select name="discipline">${DISCIPLINES.map(d=>`<option value="${d}" ${x.discipline===d?"selected":""}>${d}</option>`).join("")}</select></label>
    <label class="field"><span>Nhóm / Category</span><input name="category" value="${esc(x.category||"")}"></label>
    <label class="field"><span>Đơn vị</span><input name="unit" value="${esc(x.unit||"")}"></label>
    <label class="field span2"><span>Mô tả công việc / vật tư *</span><input required name="description" value="${esc(x.description||"")}"></label>
    <label class="field span2"><span>Thông số / Spec</span><input name="specification" value="${esc(x.specification||"")}"></label>
    <label class="field"><span>Khối lượng *</span><input required type="number" min="0" step="any" name="qty" value="${Number(x.qty||0)}"></label>
    <label class="field"><span>Giá vật tư / ĐVT</span><input type="number" min="0" step="any" name="materialUnit" value="${Number(x.materialUnit||0)}"></label>
    <label class="field"><span>Nhân công / ĐVT</span><input type="number" min="0" step="any" name="laborUnit" value="${Number(x.laborUnit||0)}"></label>
    <label class="field"><span>Thầu phụ / ĐVT</span><input type="number" min="0" step="any" name="subcontractUnit" value="${Number(x.subcontractUnit||0)}"></label>
    <label class="field"><span>Chi phí khác / ĐVT</span><input type="number" min="0" step="any" name="otherUnit" value="${Number(x.otherUnit||0)}"></label>
    <label class="field"><span>Hao hụt %</span><input type="number" min="0" step="any" name="wastePct" value="${Number(x.wastePct||0)}"></label>
    <label class="field"><span>Markup / Lợi nhuận %</span><input type="number" min="0" step="any" name="markupPct" value="${Number(x.markupPct||0)}"></label>
    <label class="field"><span>Hãng / Brand</span><input name="brand" value="${esc(x.brand||"")}"></label>
    <label class="field span2"><span>Ghi chú</span><textarea name="notes">${esc(x.notes||"")}</textarea></label>
  </div>`;
}

function openItem(id, container) {
  const x = items.find(i=>i.id===id) || {};
  modal({title:id?"Cập nhật dòng BOQ":"Thêm dòng BOQ",eyebrow:projects.find(p=>p.id===selectedProjectId)?.code||"BOQ",size:"lg",submitText:id?"Lưu thay đổi":"Thêm vào BOQ",body:itemForm(x),onSubmit:async fd=>{
    const d=Object.fromEntries(fd.entries());["qty","materialUnit","laborUnit","subcontractUnit","otherUnit","wastePct","markupPct"].forEach(k=>d[k]=Number(d[k]||0));d.updatedAt=ts();
    if(id){await refs.boqItem(selectedProjectId,id).update(d);await logActivity("BOQ_UPDATED",`Cập nhật BOQ ${d.itemNo} - ${d.description}`,{projectId:selectedProjectId,boqItemId:id})}
    else{const key=refs.boqProject(selectedProjectId).push().key;d.createdAt=ts();await refs.boqItem(selectedProjectId,key).set(d);await logActivity("BOQ_CREATED",`Thêm BOQ ${d.itemNo} - ${d.description}`,{projectId:selectedProjectId,boqItemId:key})}
    await refs.project(selectedProjectId).update({tenderStatus:"PRICING",updatedAt:ts()});toast(id?"Đã cập nhật BOQ.":"Đã thêm dòng BOQ.");await loadProjectData();paint(container);return true;
  }});
}

async function deleteItem(id,container){
  const x=items.find(i=>i.id===id);if(!await confirmBox("Xóa dòng BOQ",`Xóa ${x?.itemNo||""} - ${x?.description||""}? Các báo giá gắn với dòng này cũng sẽ bị xóa.`,"Xóa"))return;
  await Promise.all([refs.boqItem(selectedProjectId,id).remove(),refs.supplierQuotesItem(selectedProjectId,id).remove()]);
  await logActivity("BOQ_DELETED",`Xóa BOQ ${x?.itemNo||id}`,{projectId:selectedProjectId,boqItemId:id});toast("Đã xóa dòng BOQ.","warning");await loadProjectData();paint(container);
}

function openPricing(container){
  modal({title:"Chi phí & điều chỉnh dự án",eyebrow:projects.find(p=>p.id===selectedProjectId)?.code||"LẬP GIÁ",size:"lg",body:`<div class="form-grid">
    <label class="field"><span>Chi phí chung dự án %</span><input type="number" min="0" step="any" name="overheadPct" value="${Number(pricing.overheadPct||0)}"><small>Ví dụ: quản lý, văn phòng công trường, bảo hiểm, vận chuyển chung...</small></label>
    <label class="field"><span>Dự phòng / Contingency %</span><input type="number" min="0" step="any" name="contingencyPct" value="${Number(pricing.contingencyPct||0)}"><small>Dự phòng rủi ro tính trên NET trực tiếp.</small></label>
    <label class="field"><span>Chiết khấu giá chào %</span><input type="number" min="0" max="100" step="any" name="discountPct" value="${Number(pricing.discountPct||0)}"><small>Giảm trên giá chào trước VAT.</small></label>
    <label class="field"><span>VAT %</span><input type="number" min="0" max="100" step="any" name="vatPct" value="${Number(pricing.vatPct??10)}"></label>
    <label class="field span2"><span>Ghi chú điều chỉnh</span><textarea name="note">${esc(pricing.note||"")}</textarea></label>
  </div>`,submitText:"Lưu & tính lại",onSubmit:async fd=>{
    const d=Object.fromEntries(fd.entries());["overheadPct","contingencyPct","discountPct","vatPct"].forEach(k=>d[k]=Number(d[k]||0));d.updatedAt=ts();
    await refs.pricingSettings(selectedProjectId).update(d);await logActivity("PRICING_SETTINGS",`Cập nhật chi phí chung/DP/CK/VAT`,{projectId:selectedProjectId});toast("Đã cập nhật cấu hình lập giá.");await loadProjectData();paint(container);return true;
  }});
}

function quoteList(itemId){
  const val=quotesByItem[itemId]||{};
  return Object.entries(val).map(([id,x])=>({id,...(x||{})})).sort((a,b)=>Number(a.unitPrice||0)-Number(b.unitPrice||0));
}

function openQuotes(itemId,container){
  const item=items.find(x=>x.id===itemId);if(!item)return;const list=quoteList(itemId),current=item.selectedQuoteId||"";
  modal({title:`So sánh báo giá · ${item.itemNo}`,eyebrow:item.description||"VẬT TƯ",size:"lg",showSubmit:false,body:`
    <div class="page-head" style="margin-bottom:12px"><div><h2 style="font-size:16px">${esc(item.description||"")}</h2><p>${esc(item.specification||"")} · KL ${num(item.qty,3)} ${esc(item.unit||"")}</p></div>${can("quoteEdit")?`<button type="button" class="btn primary" id="addQuoteBtn">＋ Thêm báo giá NCC</button>`:""}</div>
    <div class="table-wrap"><table class="table quote-table"><thead><tr><th>NHÀ CUNG CẤP</th><th>HÃNG</th><th>ĐƠN GIÁ</th><th>NGÀY BÁO</th><th>LEAD TIME</th><th>THANH TOÁN</th><th>HIỆU LỰC</th><th>GHI CHÚ</th><th style="text-align:right">THAO TÁC</th></tr></thead><tbody>${list.length?list.map((q,i)=>quoteRow(item,q,current,i)).join(""):`<tr><td colspan="9">${empty("Chưa có báo giá","Thêm báo giá từ các nhà cung cấp để so sánh và chọn giá.","◆")}</td></tr>`}</tbody></table></div>`});
  document.querySelector("#addQuoteBtn")?.addEventListener("click",()=>openQuoteForm(itemId,null,container));
  document.querySelectorAll("[data-edit-quote]").forEach(b=>b.addEventListener("click",()=>openQuoteForm(itemId,b.dataset.editQuote,container)));
  document.querySelectorAll("[data-del-quote]").forEach(b=>b.addEventListener("click",()=>deleteQuote(itemId,b.dataset.delQuote,container)));
  document.querySelectorAll("[data-select-quote]").forEach(b=>b.addEventListener("click",()=>selectQuote(itemId,b.dataset.selectQuote,container,true)));
}

function quoteRow(item,q,current,index){
  const selected=current===q.id;
  return `<tr class="${selected?"selected-quote":""}"><td><div class="primary-text">${esc(q.supplier||"—")}</div><div class="secondary-text">${esc(q.contact||"")}</div></td><td>${esc(q.brand||"—")}</td><td><b>${money(q.unitPrice)}</b>${index===0?`<div class="secondary-text" style="color:#15803d">Giá thấp nhất</div>`:""}</td><td>${fmtDate(q.quoteDate)}</td><td>${esc(q.leadTime||"—")}</td><td>${esc(q.paymentTerms||"—")}</td><td>${esc(q.validity||"—")}</td><td>${esc(q.notes||"—")}</td><td><div class="row-actions">${selected?badge("Đang chọn","green"):(can("quoteEdit")?`<button type="button" class="btn green sm" data-select-quote="${q.id}">Chọn giá</button>`:"")}${can("quoteEdit")?`<button type="button" class="btn sm" data-edit-quote="${q.id}">Sửa</button><button type="button" class="btn red sm" data-del-quote="${q.id}">Xóa</button>`:""}</div></td></tr>`;
}

function quoteForm(q={}){
  return `<div class="form-grid"><label class="field"><span>Nhà cung cấp *</span><input required name="supplier" value="${esc(q.supplier||"")}"></label><label class="field"><span>Hãng / Brand</span><input name="brand" value="${esc(q.brand||"")}"></label><label class="field"><span>Đơn giá / ĐVT *</span><input required type="number" min="0" step="any" name="unitPrice" value="${Number(q.unitPrice||0)}"></label><label class="field"><span>Ngày báo giá</span><input type="date" name="quoteDate" value="${esc(q.quoteDate||"")}"></label><label class="field"><span>Liên hệ</span><input name="contact" value="${esc(q.contact||"")}"></label><label class="field"><span>Lead time</span><input name="leadTime" value="${esc(q.leadTime||"")}" placeholder="Ví dụ: 4-6 tuần"></label><label class="field"><span>Điều khoản thanh toán</span><input name="paymentTerms" value="${esc(q.paymentTerms||"")}"></label><label class="field"><span>Hiệu lực báo giá</span><input name="validity" value="${esc(q.validity||"")}" placeholder="Ví dụ: 30 ngày"></label><label class="field span2"><span>Ghi chú</span><textarea name="notes">${esc(q.notes||"")}</textarea></label></div>`;
}

function openQuoteForm(itemId,quoteId,container){
  const q0=quoteList(itemId).find(x=>x.id===quoteId)||{};
  modal({title:quoteId?"Cập nhật báo giá":"Thêm báo giá nhà cung cấp",eyebrow:items.find(x=>x.id===itemId)?.description||"BÁO GIÁ",size:"lg",submitText:quoteId?"Lưu báo giá":"Thêm báo giá",body:quoteForm(q0),onSubmit:async fd=>{
    const d=Object.fromEntries(fd.entries());d.unitPrice=Number(d.unitPrice||0);d.updatedAt=ts();
    if(quoteId)await refs.supplierQuote(selectedProjectId,itemId,quoteId).update(d);else{const key=refs.supplierQuotesItem(selectedProjectId,itemId).push().key;d.createdAt=ts();await refs.supplierQuote(selectedProjectId,itemId,key).set(d)}
    await logActivity("SUPPLIER_QUOTE_SAVED",`${quoteId?"Cập nhật":"Thêm"} báo giá ${d.supplier}`,{projectId:selectedProjectId,boqItemId:itemId});toast("Đã lưu báo giá.");await loadProjectData();openQuotes(itemId,container);return false;
  }});
}

async function deleteQuote(itemId,quoteId,container){
  const q0=quoteList(itemId).find(x=>x.id===quoteId);if(!await confirmBox("Xóa báo giá",`Xóa báo giá của ${q0?.supplier||""}?`,"Xóa"))return;
  await refs.supplierQuote(selectedProjectId,itemId,quoteId).remove();const item=items.find(x=>x.id===itemId);if(item?.selectedQuoteId===quoteId)await refs.boqItem(selectedProjectId,itemId).update({selectedQuoteId:"",selectedSupplier:"",updatedAt:ts()});toast("Đã xóa báo giá.","warning");await loadProjectData();openQuotes(itemId,container);
}

async function selectQuote(itemId,quoteId,container,reopen=false){
  const q0=quoteList(itemId).find(x=>x.id===quoteId);if(!q0)return;
  await refs.boqItem(selectedProjectId,itemId).update({materialUnit:Number(q0.unitPrice||0),brand:q0.brand||"",selectedSupplier:q0.supplier||"",selectedQuoteId:quoteId,updatedAt:ts()});
  await logActivity("SUPPLIER_QUOTE_SELECTED",`Chọn giá ${q0.supplier} - ${money(q0.unitPrice)}`,{projectId:selectedProjectId,boqItemId:itemId,quoteId});toast(`Đã chọn giá của ${q0.supplier} và cập nhật vào BOQ.`);await loadProjectData();paint(container);if(reopen)openQuotes(itemId,container);
}

function openSupplierMatrix(container){
  const supplierMap=new Map();
  for(const item of items){
    for(const q0 of quoteList(item.id)){
      const key=norm(q0.supplier||"").trim();if(!key)continue;
      if(!supplierMap.has(key))supplierMap.set(key,q0.supplier);
    }
  }
  const suppliers=[...supplierMap.entries()].map(([key,name])=>({key,name})).sort((a,b)=>a.name.localeCompare(b.name,"vi"));
  if(!items.length){toast("Chưa có BOQ để so sánh.","warning");return}
  if(!suppliers.length){toast("Chưa có báo giá nhà cung cấp nào.","warning");return}

  const rows=items.map(item=>{
    const quotes=quoteList(item.id);
    const cells=suppliers.map(s=>{
      const candidates=quotes.filter(q=>norm(q.supplier||"").trim()===s.key).sort((a,b)=>Number(a.unitPrice||0)-Number(b.unitPrice||0));
      const q0=candidates[0];if(!q0)return `<td class="matrix-empty">—</td>`;
      const allPrices=quotes.map(x=>Number(x.unitPrice||0)).filter(x=>x>0),lowest=allPrices.length?Math.min(...allPrices):0;
      const isLow=Number(q0.unitPrice||0)===lowest,selected=item.selectedQuoteId===q0.id;
      return `<td class="matrix-cell ${selected?"matrix-selected":""} ${isLow?"matrix-low":""}"><b>${money(q0.unitPrice)}</b><div class="secondary-text">${esc(q0.brand||"")}</div><div class="matrix-badges">${selected?badge("Đã chọn","green"):isLow?badge("Thấp nhất","blue"):""}</div>${can("quoteEdit")&&!selected?`<button type="button" class="btn sm matrix-pick" data-matrix-item="${item.id}" data-matrix-quote="${q0.id}">Chọn</button>`:""}</td>`;
    }).join("");
    return `<tr><td class="matrix-sticky"><div class="primary-text">${esc(item.itemNo||"")} · ${esc(item.description||"")}</div><div class="secondary-text">${esc(item.specification||"")} · ${num(item.qty,3)} ${esc(item.unit||"")}</div></td>${cells}</tr>`;
  }).join("");

  modal({title:"Ma trận so sánh nhà cung cấp",eyebrow:projects.find(p=>p.id===selectedProjectId)?.code||"SO SÁNH GIÁ",size:"xl",showSubmit:false,body:`<div class="matrix-note">Mỗi ô lấy <b>giá thấp nhất của chính NCC đó</b> cho vật tư tương ứng. Màu xanh lá là giá đang được chọn vào BOQ.</div><div class="table-wrap matrix-wrap"><table class="table matrix-table"><thead><tr><th class="matrix-sticky">VẬT TƯ / HẠNG MỤC</th>${suppliers.map(s=>`<th>${esc(s.name)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`});
  document.querySelectorAll("[data-matrix-quote]").forEach(b=>b.addEventListener("click",async()=>{await selectQuote(b.dataset.matrixItem,b.dataset.matrixQuote,container,false);openSupplierMatrix(container)}));
}

function saveVersionModal(container){
  if(!items.length){toast("Chưa có BOQ để lưu phiên bản.","warning");return}
  const next=(versions.reduce((m,v)=>Math.max(m,Number(v.versionNo||0)),0)+1);
  modal({title:"Lưu phiên bản BOQ",eyebrow:"KHÓA DỮ LIỆU GIÁ",size:"sm",submitText:"Lưu phiên bản",body:`<div class="form-grid"><label class="field"><span>Số phiên bản</span><input name="versionLabel" value="V${String(next).padStart(2,"0")}" required></label><label class="field"><span>Tên phiên bản</span><input name="name" value="BOQ trình giá" placeholder="Ví dụ: Chào lần 1"></label><label class="field span2"><span>Ghi chú</span><textarea name="note" placeholder="Lý do lưu phiên bản, thay đổi chính..."></textarea></label></div>`,onSubmit:async fd=>{
    await createVersion({versionNo:next,versionLabel:fd.get("versionLabel")||`V${String(next).padStart(2,"0")}`,name:fd.get("name")||"BOQ",note:fd.get("note")||"",source:"MANUAL"});toast("Đã lưu phiên bản BOQ.");await loadProjectData();paint(container);return true;
  }});
}

async function createVersion(meta={}){
  const p=getProfile(), totals=calcProjectTotals(items,pricing),key=refs.boqVersionsProject(selectedProjectId).push().key;
  const itemObj=Object.fromEntries(items.map(x=>[x.id,stripId(x)]));
  const payload={...meta,projectId:selectedProjectId,itemCount:items.length,items:itemObj,pricing:{...pricing},totals,createdBy:p?.uid||"",createdByName:p?.displayName||p?.email||"",createdAt:Date.now()};
  await refs.boqVersion(selectedProjectId,key).set(payload);await logActivity("BOQ_VERSION_CREATED",`Lưu ${payload.versionLabel||payload.name||"phiên bản BOQ"}`,{projectId:selectedProjectId,versionId:key});return key;
}

function openVersions(container){
  modal({title:"Lịch sử phiên bản BOQ",eyebrow:projects.find(p=>p.id===selectedProjectId)?.code||"VERSION",size:"xl",showSubmit:false,body:`<div class="page-head" style="margin-bottom:12px"><div><h2 style="font-size:16px">${versions.length} phiên bản đã khóa</h2><p>Phiên bản là snapshot độc lập, không đổi khi BOQ đang làm tiếp tục chỉnh sửa.</p></div>${can("boqEdit")?`<button type="button" class="btn primary" id="versionCreateInside">＋ Lưu phiên bản hiện tại</button>`:""}</div><div class="table-wrap"><table class="table version-table"><thead><tr><th>PHIÊN BẢN</th><th>TÊN / GHI CHÚ</th><th>DÒNG</th><th>NET</th><th>CHÀO TRƯỚC VAT</th><th>SAU VAT</th><th>LN</th><th>NGƯỜI LƯU</th><th>THỜI GIAN</th><th style="text-align:right">THAO TÁC</th></tr></thead><tbody>${versions.length?versions.map(versionRow).join(""):`<tr><td colspan="10">${empty("Chưa có phiên bản","Bấm Lưu phiên bản để khóa trạng thái BOQ hiện tại.","◫")}</td></tr>`}</tbody></table></div>`});
  document.querySelector("#versionCreateInside")?.addEventListener("click",()=>saveVersionModal(container));
  document.querySelectorAll("[data-view-version]").forEach(b=>b.addEventListener("click",()=>viewVersion(b.dataset.viewVersion,container)));
  document.querySelectorAll("[data-restore-version]").forEach(b=>b.addEventListener("click",()=>restoreVersion(b.dataset.restoreVersion,container)));
}

function versionRow(v){
  const t=v.totals||{};
  return `<tr><td><div class="primary-text">${esc(v.versionLabel||`V${String(v.versionNo||1).padStart(2,"0")}`)}</div>${v.source==="APPROVAL"?badge("Trình duyệt","purple"):badge("Thủ công","gray")}</td><td><div class="primary-text">${esc(v.name||"BOQ")}</div><div class="secondary-text">${esc(v.note||"")}</div></td><td>${Number(v.itemCount||0)}</td><td>${money(t.projectCost??t.directNet??t.net)}</td><td>${money(t.bidExVat??t.bid)}</td><td>${money(t.grandTotal??t.bid)}</td><td>${num(t.margin,1)}%</td><td>${esc(v.createdByName||"—")}</td><td>${fmtDateTime(v.createdAt)}</td><td><div class="row-actions"><button class="btn sm" data-view-version="${v.id}">Xem</button>${can("boqEdit")?`<button class="btn orange sm" data-restore-version="${v.id}">Khôi phục</button>`:""}</div></td></tr>`;
}

function viewVersion(id,container){
  const v=versions.find(x=>x.id===id);if(!v)return;const versionItems=Object.entries(v.items||{}).map(([id,x])=>({id,...(x||{})})).sort((a,b)=>String(a.itemNo||"").localeCompare(String(b.itemNo||""),"vi",{numeric:true}));const t=v.totals||calcProjectTotals(versionItems,v.pricing||defaults());
  modal({title:`${v.versionLabel||"Phiên bản"} · ${v.name||"BOQ"}`,eyebrow:"SNAPSHOT BOQ",size:"xl",showSubmit:false,body:`<div class="grid g4"><div class="metric" style="--c:#64748b"><div class="metric-head"><span>CHI PHÍ DỰ ÁN</span></div><div class="metric-value" style="font-size:17px">${money(t.projectCost??t.directNet)}</div></div><div class="metric" style="--c:#2563eb"><div class="metric-head"><span>CHÀO TRƯỚC VAT</span></div><div class="metric-value" style="font-size:17px">${money(t.bidExVat??t.bid)}</div></div><div class="metric" style="--c:#0284c7"><div class="metric-head"><span>SAU VAT</span></div><div class="metric-value" style="font-size:17px">${money(t.grandTotal??t.bid)}</div></div><div class="metric" style="--c:#16a34a"><div class="metric-head"><span>LỢI NHUẬN</span></div><div class="metric-value" style="font-size:17px">${num(t.margin,1)}%</div></div></div><div class="table-wrap mt"><table class="table version-items"><thead><tr><th>STT</th><th>HỆ</th><th>MÔ TẢ</th><th>ĐVT</th><th>KL</th><th>GIÁ VT</th><th>NET/ĐVT</th><th>CHÀO/ĐVT</th><th>THÀNH TIỀN</th><th>NCC</th></tr></thead><tbody>${versionItems.map(x=>{const c=calcLine(x);return `<tr><td>${esc(x.itemNo||"")}</td><td>${esc(x.discipline||"")}</td><td><div class="primary-text">${esc(x.description||"")}</div><div class="secondary-text">${esc(x.specification||"")}</div></td><td>${esc(x.unit||"")}</td><td>${num(x.qty,3)}</td><td>${money(x.materialUnit)}</td><td>${money(c.netUnit)}</td><td>${money(c.bidUnit)}</td><td>${money(c.bidTotal)}</td><td>${esc(x.selectedSupplier||"—")}</td></tr>`}).join("")}</tbody></table></div>`});
}

async function restoreVersion(id,container){
  const v=versions.find(x=>x.id===id);if(!v)return;if(!await confirmBox("Khôi phục phiên bản",`Khôi phục ${v.versionLabel||v.name||"phiên bản"} thành BOQ đang làm? Dữ liệu hiện tại sẽ được thay bằng snapshot này. Nên lưu phiên bản hiện tại trước khi khôi phục.`,"Khôi phục"))return;
  const itemObj=v.items||{};await refs.boqProject(selectedProjectId).set(itemObj);await refs.pricingSettings(selectedProjectId).set({...defaults(),...(v.pricing||{})});await logActivity("BOQ_VERSION_RESTORED",`Khôi phục ${v.versionLabel||v.name||id}`,{projectId:selectedProjectId,versionId:id});toast("Đã khôi phục phiên bản BOQ.");await loadProjectData();paint(container);
}

export function calcLine(x){
  const qty=Number(x.qty||0),base=Number(x.materialUnit||0)+Number(x.laborUnit||0)+Number(x.subcontractUnit||0)+Number(x.otherUnit||0),netUnit=base*(1+Number(x.wastePct||0)/100),bidUnit=netUnit*(1+Number(x.markupPct||0)/100);
  return {netUnit,bidUnit,netTotal:qty*netUnit,bidTotal:qty*bidUnit};
}

export function calcProjectTotals(list,settings=defaults()){
  const base=list.reduce((a,x)=>{const c=calcLine(x);a.directNet+=c.netTotal;a.lineBid+=c.bidTotal;return a},{directNet:0,lineBid:0});
  const overhead=base.directNet*Number(settings.overheadPct||0)/100;
  const contingency=base.directNet*Number(settings.contingencyPct||0)/100;
  const projectCost=base.directNet+overhead+contingency;
  const beforeDiscount=base.lineBid+overhead+contingency;
  const discount=beforeDiscount*Number(settings.discountPct||0)/100;
  const bidExVat=Math.max(0,beforeDiscount-discount);
  const vat=bidExVat*Number(settings.vatPct||0)/100;
  const grandTotal=bidExVat+vat;
  const profit=bidExVat-projectCost;
  const margin=bidExVat?profit/bidExVat*100:0;
  const lineProfit=base.lineBid-base.directNet;
  const lineMargin=base.lineBid?lineProfit/base.lineBid*100:0;
  return {...base,overhead,contingency,projectCost,beforeDiscount,discount,bidExVat,vat,grandTotal,profit,margin,lineProfit,lineMargin};
}

function stripId(x){const {id,...rest}=x;return rest}
function num(v,digits=2){return Number(v||0).toLocaleString("vi-VN",{maximumFractionDigits:digits})}
function metric(label,value,icon,c,s,foot){return `<div class="metric" style="--c:${c};--s:${s}"><div class="metric-head"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></div>`}
function summaryLine(label,value,bold=false,cls=""){return `<div class="pricing-line ${bold?"pricing-bold":""} ${cls}"><span>${label}</span><b>${money(value)}</b></div>`}
function controlLine(label,value,color="gray"){return `<div class="pricing-line"><span>${label}</span>${badge(String(value),color)}</div>`}

function csvEscape(v){const s=String(v??"");return `"${s.replaceAll('"','""')}"`}
function downloadText(name,text){const blob=new Blob(["\ufeff"+text],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
function exportCsv(){
  const p=projects.find(x=>x.id===selectedProjectId),t=calcProjectTotals(items,pricing);
  const head=["STT","Hệ","Nhóm","Mô tả","Thông số","ĐVT","Khối lượng","Giá vật tư","Nhân công","Thầu phụ","Khác","Hao hụt %","Markup %","NCC đã chọn","Hãng","NET/ĐVT","Giá chào/ĐVT","NET thành tiền","Chào thành tiền"];
  const rows=items.map(x=>{const c=calcLine(x);return [x.itemNo,x.discipline,x.category,x.description,x.specification,x.unit,x.qty,x.materialUnit,x.laborUnit,x.subcontractUnit,x.otherUnit,x.wastePct,x.markupPct,x.selectedSupplier,x.brand,c.netUnit,c.bidUnit,c.netTotal,c.bidTotal]});
  rows.push([],['TỔNG HỢP'],['NET trực tiếp',t.directNet],['Chi phí chung %',pricing.overheadPct],['Chi phí chung',t.overhead],['Dự phòng %',pricing.contingencyPct],['Dự phòng',t.contingency],['Tổng chi phí dự án',t.projectCost],['Chiết khấu %',pricing.discountPct],['Giá chào trước VAT',t.bidExVat],['VAT %',pricing.vatPct],['VAT',t.vat],['Tổng sau VAT',t.grandTotal],['Lợi nhuận',t.profit],['Biên lợi nhuận %',t.margin]);
  downloadText(`BOQ_${p?.code||"DU_AN"}.csv`,[head,...rows].map(r=>r.map(csvEscape).join(";")).join("\r\n"));
}
function downloadTemplate(){const rows=[["STT","Hệ","Nhóm","Mô tả","Thông số","ĐVT","Khối lượng","Giá vật tư","Nhân công","Thầu phụ","Khác","Hao hụt %","Markup %"],["1","PCCC","Đường ống","Ống thép đen DN50","SCH40","m","100","0","25000","0","0","3","15"]];downloadText("MAU_BOQ_IMPORT.csv",rows.map(r=>r.map(csvEscape).join(";")).join("\r\n"))}
async function importCsv(file,container){
  if(!file)return;try{const text=await file.text(),rows=parseCsv(text);if(rows.length<2)throw new Error("File CSV không có dữ liệu.");const headers=rows[0].map(x=>norm(x).replace(/\s+/g," ")),idx=(...names)=>headers.findIndex(h=>names.some(n=>h===norm(n))),map={itemNo:idx("stt","ma","mã"),discipline:idx("he","hệ"),category:idx("nhom","nhóm"),description:idx("mo ta","mô tả"),specification:idx("thong so","thông số","spec"),unit:idx("dvt","đvt"),qty:idx("khoi luong","khối lượng"),materialUnit:idx("gia vat tu","giá vật tư"),laborUnit:idx("nhan cong","nhân công"),subcontractUnit:idx("thau phu","thầu phụ"),otherUnit:idx("khac","khác"),wastePct:idx("hao hut %","hao hụt %"),markupPct:idx("markup %","loi nhuan %","lợi nhuận %")};if(map.description<0||map.qty<0)throw new Error("File phải có ít nhất cột Mô tả và Khối lượng.");let count=0;const updates={};
    for(let i=1;i<rows.length;i++){const r=rows[i];if(!r.some(x=>String(x).trim()))continue;const key=refs.boqProject(selectedProjectId).push().key,get=k=>map[k]>=0?(r[map[k]]??""):"",d={itemNo:String(get("itemNo")||i),discipline:String(get("discipline")||"KHÁC").trim().toUpperCase(),category:String(get("category")||"").trim(),description:String(get("description")||"").trim(),specification:String(get("specification")||"").trim(),unit:String(get("unit")||"").trim(),qty:toNumber(get("qty")),materialUnit:toNumber(get("materialUnit")),laborUnit:toNumber(get("laborUnit")),subcontractUnit:toNumber(get("subcontractUnit")),otherUnit:toNumber(get("otherUnit")),wastePct:toNumber(get("wastePct")),markupPct:toNumber(get("markupPct")),createdAt:Date.now(),updatedAt:Date.now()};if(!DISCIPLINES.includes(d.discipline))d.discipline="KHÁC";updates[key]=d;count++}
    if(!count)throw new Error("Không tìm thấy dòng dữ liệu hợp lệ.");await refs.boqProject(selectedProjectId).update(updates);await refs.project(selectedProjectId).update({tenderStatus:"PRICING",updatedAt:ts()});await logActivity("BOQ_IMPORTED",`Nhập ${count} dòng BOQ từ CSV`,{projectId:selectedProjectId});toast(`Đã nhập ${count} dòng BOQ.`);await loadProjectData();paint(container);
  }catch(e){console.error(e);toast(e.message||"Không thể nhập CSV.","error")}
}
function parseCsv(text){const first=(text.split(/\r?\n/,1)[0]||""),delim=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?";":",",rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(ch===delim&&!quoted){row.push(cell);cell=""}else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);rows.push(row);row=[];cell=""}else cell+=ch}if(cell.length||row.length){row.push(cell);rows.push(row)}return rows.map(r=>r.map(x=>x.trim()))}
function toNumber(v){const s=String(v??"").trim().replace(/\s/g,"");if(!s)return 0;if(s.includes(",")&&!s.includes("."))return Number(s.replace(",","."))||0;return Number(s.replaceAll(",",""))||0}
