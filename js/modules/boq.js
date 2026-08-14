import {
  refs, arr, ts, logActivity, can, esc, norm, money, fmtDate,
  DISCIPLINES, setPage, loading, empty, badge, modal, toast, confirmBox
} from "../core.js";

let projects = [];
let items = [];
let quotesByItem = {};
let selectedProjectId = "";
let q = "";
let disciplineFilter = "ALL";

export async function renderBOQ(container) {
  setPage("BOQ & Lập giá", "Công việc / Đấu thầu / BOQ");
  container.innerHTML = loading();

  projects = await arr(refs.projects());
  const tenderProjects = projects.filter(p => p.phase === "TENDER" || p.phase === "EXECUTION");
  if (!selectedProjectId && tenderProjects.length) selectedProjectId = tenderProjects[0].id;
  if (selectedProjectId && !tenderProjects.some(p => p.id === selectedProjectId)) {
    selectedProjectId = tenderProjects[0]?.id || "";
  }

  await loadProjectData();
  paint(container);
}

async function loadProjectData() {
  if (!selectedProjectId) {
    items = [];
    quotesByItem = {};
    return;
  }

  const [boqSnap, quoteSnap] = await Promise.all([
    refs.boqProject(selectedProjectId).once("value"),
    refs.supplierQuotesProject(selectedProjectId).once("value")
  ]);

  const boqVal = boqSnap.val() || {};
  items = Object.entries(boqVal).map(([id, x]) => ({ id, ...(x || {}) }));
  items.sort((a,b) => String(a.itemNo || "").localeCompare(String(b.itemNo || ""), "vi", {numeric:true}));

  quotesByItem = quoteSnap.val() || {};
}

function paint(container) {
  const p = projects.find(x => x.id === selectedProjectId);
  const visible = items.filter(x => {
    const okQ = !q || norm(`${x.itemNo} ${x.discipline} ${x.category} ${x.description} ${x.specification} ${x.brand} ${x.selectedSupplier}`).includes(norm(q));
    const okD = disciplineFilter === "ALL" || x.discipline === disciplineFilter;
    return okQ && okD;
  });

  const totals = calcTotals(items);
  const missingPrice = items.filter(x => Number(x.materialUnit || 0) <= 0).length;
  const noQuotes = items.filter(x => quoteList(x.id).length === 0).length;

  container.innerHTML = `
    <div class="page-head">
      <div>
        <h2>BOQ & Lập giá</h2>
        <p>Quản lý chi tiết BOQ, hỏi giá nhiều nhà cung cấp, chọn giá và tự tính giá NET / giá chào.</p>
      </div>
      <div class="actions">
        ${selectedProjectId ? `<button class="btn" id="downloadTemplateBtn">Tải mẫu CSV</button>
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
      <select id="boqDiscipline">
        <option value="ALL">Tất cả hệ</option>
        ${DISCIPLINES.map(d=>`<option value="${d}" ${disciplineFilter===d?"selected":""}>${d}</option>`).join("")}
      </select>
    </div>

    ${selectedProjectId ? `
      <div class="grid g5">
        ${metric("Số dòng BOQ", items.length, "▦", "#2563eb", "#eff6ff", `${visible.length} dòng đang hiển thị`)}
        ${metric("Giá NET", money(totals.net,true), "N", "#64748b", "#f8fafc", money(totals.net))}
        ${metric("Giá chào", money(totals.bid,true), "₫", "#2563eb", "#eff6ff", money(totals.bid))}
        ${metric("LN gộp", totals.margin.toFixed(1)+"%", "↗", "#16a34a", "#f0fdf4", money(totals.profit))}
        ${metric("Cần xử lý", missingPrice + noQuotes, "!", "#d97706", "#fff7ed", `${missingPrice} chưa có giá · ${noQuotes} chưa có báo giá`)}
      </div>

      <div class="card mt">
        <div class="card-head">
          <div>
            <h3>${esc(p?.code || "")} · ${esc(p?.name || "")}</h3>
            <div class="secondary-text">${esc(p?.client || "")}</div>
          </div>
          <div class="actions">
            ${badge(`${items.length} dòng BOQ`, "blue")}
            ${missingPrice ? badge(`${missingPrice} thiếu giá`, "orange") : badge("Đã có giá vật tư", "green")}
          </div>
        </div>
        <div class="table-wrap" style="border:0;border-radius:0 0 11px 11px">
          <table class="table boq-table">
            <thead>
              <tr>
                <th>STT</th><th>HỆ</th><th>MÔ TẢ / THÔNG SỐ</th><th>ĐVT</th><th>KL</th>
                <th>GIÁ VT</th><th>NHÂN CÔNG</th><th>THẦU PHỤ</th><th>KHÁC</th>
                <th>HAO HỤT</th><th>NET / ĐVT</th><th>MARKUP</th><th>GIÁ CHÀO / ĐVT</th>
                <th>THÀNH TIỀN CHÀO</th><th>NCC ĐÃ CHỌN</th><th style="text-align:right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              ${visible.length ? visible.map(rowHtml).join("") :
                `<tr><td colspan="16">${empty("Chưa có dữ liệu BOQ","Thêm dòng BOQ mới hoặc nhập file CSV theo mẫu.","▦")}</td></tr>`}
            </tbody>
            ${items.length ? `<tfoot><tr>
              <th colspan="10" style="text-align:right">TỔNG CỘNG</th>
              <th>${money(totals.net)}</th><th></th><th></th><th>${money(totals.bid)}</th><th colspan="2">${badge(`LN ${totals.margin.toFixed(1)}%`,"green")}</th>
            </tr></tfoot>` : ""}
          </table>
        </div>
      </div>
    ` : empty("Chưa có dự án","Tạo dự án trước rồi quay lại BOQ & Lập giá.","▣")}
  `;

  bind(container);
}

function bind(container) {
  container.querySelector("#boqProjectSelect")?.addEventListener("change", async e => {
    selectedProjectId = e.target.value;
    q = "";
    disciplineFilter = "ALL";
    container.innerHTML = loading();
    await loadProjectData();
    paint(container);
  });

  container.querySelector("#boqSearch")?.addEventListener("input", e => {
    q = e.target.value;
    paint(container);
    requestAnimationFrame(() => {
      const input = container.querySelector("#boqSearch");
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
  });

  container.querySelector("#boqDiscipline")?.addEventListener("change", e => {
    disciplineFilter = e.target.value;
    paint(container);
  });

  container.querySelector("#addBoqBtn")?.addEventListener("click", () => openItem(null, container));
  container.querySelectorAll("[data-edit-item]").forEach(b => b.addEventListener("click", () => openItem(b.dataset.editItem, container)));
  container.querySelectorAll("[data-del-item]").forEach(b => b.addEventListener("click", () => deleteItem(b.dataset.delItem, container)));
  container.querySelectorAll("[data-quotes]").forEach(b => b.addEventListener("click", () => openQuotes(b.dataset.quotes, container)));

  container.querySelector("#exportBoqBtn")?.addEventListener("click", exportCsv);
  container.querySelector("#downloadTemplateBtn")?.addEventListener("click", downloadTemplate);
  container.querySelector("#importCsvInput")?.addEventListener("change", e => importCsv(e.target.files?.[0], container));
}

function rowHtml(x) {
  const c = calcLine(x);
  const quoteCount = quoteList(x.id).length;
  return `<tr>
    <td><div class="primary-text">${esc(x.itemNo || "—")}</div><div class="secondary-text">${esc(x.category || "")}</div></td>
    <td>${badge(x.discipline || "KHÁC","gray")}</td>
    <td style="min-width:280px"><div class="primary-text">${esc(x.description || "—")}</div><div class="secondary-text">${esc(x.specification || "")}${x.brand?` · Hãng: ${esc(x.brand)}`:""}</div></td>
    <td>${esc(x.unit || "—")}</td>
    <td>${num(x.qty,3)}</td>
    <td class="${Number(x.materialUnit||0)<=0?"danger-text":""}">${money(x.materialUnit)}</td>
    <td>${money(x.laborUnit)}</td>
    <td>${money(x.subcontractUnit)}</td>
    <td>${money(x.otherUnit)}</td>
    <td>${num(x.wastePct,1)}%</td>
    <td><b>${money(c.netUnit)}</b></td>
    <td>${num(x.markupPct,1)}%</td>
    <td><b>${money(c.bidUnit)}</b></td>
    <td><b>${money(c.bidTotal)}</b><div class="secondary-text">NET ${money(c.netTotal)}</div></td>
    <td><div>${esc(x.selectedSupplier || "—")}</div><div class="secondary-text">${quoteCount} báo giá${x.selectedQuoteId?" · đã chọn":""}</div></td>
    <td><div class="row-actions">
      <button class="btn sm soft" data-quotes="${x.id}">So giá (${quoteCount})</button>
      ${can("boqEdit")?`<button class="btn sm" data-edit-item="${x.id}">Sửa</button><button class="btn red sm" data-del-item="${x.id}">Xóa</button>`:""}
    </div></td>
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
  modal({
    title: id ? "Cập nhật dòng BOQ" : "Thêm dòng BOQ",
    eyebrow: projects.find(p=>p.id===selectedProjectId)?.code || "BOQ",
    size:"lg",
    submitText:id?"Lưu thay đổi":"Thêm vào BOQ",
    body:itemForm(x),
    onSubmit:async fd=>{
      const d = Object.fromEntries(fd.entries());
      ["qty","materialUnit","laborUnit","subcontractUnit","otherUnit","wastePct","markupPct"].forEach(k=>d[k]=Number(d[k]||0));
      d.updatedAt=ts();
      if(id){
        await refs.boqItem(selectedProjectId,id).update(d);
        await logActivity("BOQ_UPDATED",`Cập nhật BOQ ${d.itemNo} - ${d.description}`,{projectId:selectedProjectId,boqItemId:id});
      }else{
        const key=refs.boqProject(selectedProjectId).push().key;
        d.createdAt=ts();
        await refs.boqItem(selectedProjectId,key).set(d);
        await logActivity("BOQ_CREATED",`Thêm BOQ ${d.itemNo} - ${d.description}`,{projectId:selectedProjectId,boqItemId:key});
      }
      await refs.project(selectedProjectId).update({tenderStatus:"PRICING",updatedAt:ts()});
      toast(id?"Đã cập nhật BOQ.":"Đã thêm dòng BOQ.");
      await loadProjectData();paint(container);return true;
    }
  });
}

async function deleteItem(id,container){
  const x=items.find(i=>i.id===id);
  if(!await confirmBox("Xóa dòng BOQ",`Xóa ${x?.itemNo||""} - ${x?.description||""}? Các báo giá gắn với dòng này cũng sẽ bị xóa.`,"Xóa"))return;
  await Promise.all([
    refs.boqItem(selectedProjectId,id).remove(),
    refs.supplierQuotesItem(selectedProjectId,id).remove()
  ]);
  await logActivity("BOQ_DELETED",`Xóa BOQ ${x?.itemNo||id}`,{projectId:selectedProjectId,boqItemId:id});
  toast("Đã xóa dòng BOQ.","warning");
  await loadProjectData();paint(container);
}

function quoteList(itemId){
  const val=quotesByItem[itemId]||{};
  return Object.entries(val).map(([id,x])=>({id,...(x||{})})).sort((a,b)=>Number(a.unitPrice||0)-Number(b.unitPrice||0));
}

function openQuotes(itemId,container){
  const item=items.find(x=>x.id===itemId);if(!item)return;
  const list=quoteList(itemId);
  const current=item.selectedQuoteId||"";

  modal({
    title:`So sánh báo giá · ${item.itemNo}`,
    eyebrow:item.description||"VẬT TƯ",
    size:"lg",
    showSubmit:false,
    body:`
      <div class="page-head" style="margin-bottom:12px">
        <div><h2 style="font-size:16px">${esc(item.description||"")}</h2><p>${esc(item.specification||"")} · KL ${num(item.qty,3)} ${esc(item.unit||"")}</p></div>
        ${can("quoteEdit")?`<button type="button" class="btn primary" id="addQuoteBtn">＋ Thêm báo giá NCC</button>`:""}
      </div>
      <div class="table-wrap"><table class="table quote-table"><thead><tr>
        <th>NHÀ CUNG CẤP</th><th>HÃNG</th><th>ĐƠN GIÁ</th><th>NGÀY BÁO</th><th>LEAD TIME</th><th>THANH TOÁN</th><th>HIỆU LỰC</th><th>GHI CHÚ</th><th style="text-align:right">THAO TÁC</th>
      </tr></thead><tbody>
        ${list.length?list.map((q,i)=>quoteRow(item,q,current,i)).join(""):`<tr><td colspan="9">${empty("Chưa có báo giá","Thêm báo giá từ các nhà cung cấp để so sánh và chọn giá.","◆")}</td></tr>`}
      </tbody></table></div>
    `
  });

  document.querySelector("#addQuoteBtn")?.addEventListener("click",()=>openQuoteForm(itemId,null,container));
  document.querySelectorAll("[data-edit-quote]").forEach(b=>b.addEventListener("click",()=>openQuoteForm(itemId,b.dataset.editQuote,container)));
  document.querySelectorAll("[data-del-quote]").forEach(b=>b.addEventListener("click",()=>deleteQuote(itemId,b.dataset.delQuote,container)));
  document.querySelectorAll("[data-select-quote]").forEach(b=>b.addEventListener("click",()=>selectQuote(itemId,b.dataset.selectQuote,container)));
}

function quoteRow(item,q,current,index){
  const selected=current===q.id;
  return `<tr class="${selected?"selected-quote":""}">
    <td><div class="primary-text">${esc(q.supplier||"—")}</div><div class="secondary-text">${esc(q.contact||"")}</div></td>
    <td>${esc(q.brand||"—")}</td>
    <td><b>${money(q.unitPrice)}</b>${index===0?`<div class="secondary-text" style="color:#15803d">Giá thấp nhất</div>`:""}</td>
    <td>${fmtDate(q.quoteDate)}</td>
    <td>${esc(q.leadTime||"—")}</td>
    <td>${esc(q.paymentTerms||"—")}</td>
    <td>${esc(q.validity||"—")}</td>
    <td>${esc(q.notes||"—")}</td>
    <td><div class="row-actions">
      ${selected?badge("Đang chọn","green"):(can("quoteEdit")?`<button type="button" class="btn green sm" data-select-quote="${q.id}">Chọn giá</button>`:"")}
      ${can("quoteEdit")?`<button type="button" class="btn sm" data-edit-quote="${q.id}">Sửa</button><button type="button" class="btn red sm" data-del-quote="${q.id}">Xóa</button>`:""}
    </div></td>
  </tr>`;
}

function quoteForm(q={}){
  return `<div class="form-grid">
    <label class="field"><span>Nhà cung cấp *</span><input required name="supplier" value="${esc(q.supplier||"")}"></label>
    <label class="field"><span>Hãng / Brand</span><input name="brand" value="${esc(q.brand||"")}"></label>
    <label class="field"><span>Đơn giá / ĐVT *</span><input required type="number" min="0" step="any" name="unitPrice" value="${Number(q.unitPrice||0)}"></label>
    <label class="field"><span>Ngày báo giá</span><input type="date" name="quoteDate" value="${esc(q.quoteDate||"")}"></label>
    <label class="field"><span>Liên hệ</span><input name="contact" value="${esc(q.contact||"")}"></label>
    <label class="field"><span>Lead time</span><input name="leadTime" value="${esc(q.leadTime||"")}" placeholder="Ví dụ: 4-6 tuần"></label>
    <label class="field"><span>Điều khoản thanh toán</span><input name="paymentTerms" value="${esc(q.paymentTerms||"")}"></label>
    <label class="field"><span>Hiệu lực báo giá</span><input name="validity" value="${esc(q.validity||"")} placeholder="Ví dụ: 30 ngày"></label>
    <label class="field span2"><span>Ghi chú</span><textarea name="notes">${esc(q.notes||"")}</textarea></label>
  </div>`;
}

function openQuoteForm(itemId,quoteId,container){
  const q0=quoteList(itemId).find(x=>x.id===quoteId)||{};
  modal({
    title:quoteId?"Cập nhật báo giá":"Thêm báo giá nhà cung cấp",
    eyebrow:items.find(x=>x.id===itemId)?.description||"BÁO GIÁ",
    size:"lg",
    submitText:quoteId?"Lưu báo giá":"Thêm báo giá",
    body:quoteForm(q0),
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());d.unitPrice=Number(d.unitPrice||0);d.updatedAt=ts();
      if(quoteId){
        await refs.supplierQuote(selectedProjectId,itemId,quoteId).update(d);
      }else{
        const key=refs.supplierQuotesItem(selectedProjectId,itemId).push().key;d.createdAt=ts();
        await refs.supplierQuote(selectedProjectId,itemId,key).set(d);
      }
      await logActivity("SUPPLIER_QUOTE_SAVED",`${quoteId?"Cập nhật":"Thêm"} báo giá ${d.supplier}`,{projectId:selectedProjectId,boqItemId:itemId});
      toast("Đã lưu báo giá.");
      await loadProjectData();openQuotes(itemId,container);return false;
    }
  });
}

async function deleteQuote(itemId,quoteId,container){
  const q0=quoteList(itemId).find(x=>x.id===quoteId);
  if(!await confirmBox("Xóa báo giá",`Xóa báo giá của ${q0?.supplier||""}?`,"Xóa"))return;
  await refs.supplierQuote(selectedProjectId,itemId,quoteId).remove();
  const item=items.find(x=>x.id===itemId);
  if(item?.selectedQuoteId===quoteId){
    await refs.boqItem(selectedProjectId,itemId).update({selectedQuoteId:"",selectedSupplier:"",updatedAt:ts()});
  }
  toast("Đã xóa báo giá.","warning");
  await loadProjectData();openQuotes(itemId,container);
}

async function selectQuote(itemId,quoteId,container){
  const q0=quoteList(itemId).find(x=>x.id===quoteId);if(!q0)return;
  await refs.boqItem(selectedProjectId,itemId).update({
    materialUnit:Number(q0.unitPrice||0),
    brand:q0.brand||"",
    selectedSupplier:q0.supplier||"",
    selectedQuoteId:quoteId,
    updatedAt:ts()
  });
  await logActivity("SUPPLIER_QUOTE_SELECTED",`Chọn giá ${q0.supplier} - ${money(q0.unitPrice)}`,{projectId:selectedProjectId,boqItemId:itemId,quoteId});
  toast(`Đã chọn giá của ${q0.supplier} và cập nhật vào BOQ.`);
  await loadProjectData();openQuotes(itemId,container);
}

export function calcLine(x){
  const qty=Number(x.qty||0);
  const base=Number(x.materialUnit||0)+Number(x.laborUnit||0)+Number(x.subcontractUnit||0)+Number(x.otherUnit||0);
  const netUnit=base*(1+Number(x.wastePct||0)/100);
  const bidUnit=netUnit*(1+Number(x.markupPct||0)/100);
  return {netUnit,bidUnit,netTotal:qty*netUnit,bidTotal:qty*bidUnit};
}

export function calcTotals(list){
  const t=list.reduce((a,x)=>{const c=calcLine(x);a.net+=c.netTotal;a.bid+=c.bidTotal;return a},{net:0,bid:0});
  t.profit=t.bid-t.net;t.margin=t.bid?t.profit/t.bid*100:0;return t;
}

function num(v,digits=2){return Number(v||0).toLocaleString("vi-VN",{maximumFractionDigits:digits})}

function metric(label,value,icon,c,s,foot){
  return `<div class="metric" style="--c:${c};--s:${s}"><div class="metric-head"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></div>`;
}

function csvEscape(v){
  const s=String(v??"");
  return `"${s.replaceAll('"','""')}"`;
}
function downloadText(name,text){
  const blob=new Blob(["\ufeff"+text],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function exportCsv(){
  const p=projects.find(x=>x.id===selectedProjectId);
  const head=["STT","Hệ","Nhóm","Mô tả","Thông số","ĐVT","Khối lượng","Giá vật tư","Nhân công","Thầu phụ","Khác","Hao hụt %","Markup %","NCC đã chọn","Hãng","NET/ĐVT","Giá chào/ĐVT","NET thành tiền","Chào thành tiền"];
  const rows=items.map(x=>{const c=calcLine(x);return [x.itemNo,x.discipline,x.category,x.description,x.specification,x.unit,x.qty,x.materialUnit,x.laborUnit,x.subcontractUnit,x.otherUnit,x.wastePct,x.markupPct,x.selectedSupplier,x.brand,c.netUnit,c.bidUnit,c.netTotal,c.bidTotal]});
  downloadText(`BOQ_${p?.code||"DU_AN"}.csv`,[head,...rows].map(r=>r.map(csvEscape).join(";")).join("\r\n"));
}
function downloadTemplate(){
  const rows=[
    ["STT","Hệ","Nhóm","Mô tả","Thông số","ĐVT","Khối lượng","Giá vật tư","Nhân công","Thầu phụ","Khác","Hao hụt %","Markup %"],
    ["1","PCCC","Đường ống","Ống thép đen DN50","SCH40","m","100","0","25000","0","0","3","15"]
  ];
  downloadText("MAU_BOQ_IMPORT.csv",rows.map(r=>r.map(csvEscape).join(";")).join("\r\n"));
}
async function importCsv(file,container){
  if(!file)return;
  try{
    const text=await file.text();
    const rows=parseCsv(text);
    if(rows.length<2)throw new Error("File CSV không có dữ liệu.");
    const headers=rows[0].map(x=>norm(x).replace(/\s+/g," "));
    const idx=(...names)=>headers.findIndex(h=>names.some(n=>h===norm(n)));
    const map={
      itemNo:idx("stt","ma","mã"),
      discipline:idx("he","hệ"),
      category:idx("nhom","nhóm"),
      description:idx("mo ta","mô tả"),
      specification:idx("thong so","thông số","spec"),
      unit:idx("dvt","đvt"),
      qty:idx("khoi luong","khối lượng"),
      materialUnit:idx("gia vat tu","giá vật tư"),
      laborUnit:idx("nhan cong","nhân công"),
      subcontractUnit:idx("thau phu","thầu phụ"),
      otherUnit:idx("khac","khác"),
      wastePct:idx("hao hut %","hao hụt %"),
      markupPct:idx("markup %","loi nhuan %","lợi nhuận %")
    };
    if(map.description<0||map.qty<0)throw new Error("File phải có ít nhất cột Mô tả và Khối lượng.");

    let count=0;
    const updates={};
    for(let i=1;i<rows.length;i++){
      const r=rows[i];if(!r.some(x=>String(x).trim()))continue;
      const key=refs.boqProject(selectedProjectId).push().key;
      const get=k=>map[k]>=0?(r[map[k]]??""):"";
      const d={
        itemNo:String(get("itemNo")||i),
        discipline:String(get("discipline")||"KHÁC").trim().toUpperCase(),
        category:String(get("category")||"").trim(),
        description:String(get("description")||"").trim(),
        specification:String(get("specification")||"").trim(),
        unit:String(get("unit")||"").trim(),
        qty:toNumber(get("qty")),materialUnit:toNumber(get("materialUnit")),laborUnit:toNumber(get("laborUnit")),
        subcontractUnit:toNumber(get("subcontractUnit")),otherUnit:toNumber(get("otherUnit")),
        wastePct:toNumber(get("wastePct")),markupPct:toNumber(get("markupPct")),
        createdAt:Date.now(),updatedAt:Date.now()
      };
      if(!DISCIPLINES.includes(d.discipline))d.discipline="KHÁC";
      updates[key]=d;count++;
    }
    if(!count)throw new Error("Không tìm thấy dòng dữ liệu hợp lệ.");
    await refs.boqProject(selectedProjectId).update(updates);
    await refs.project(selectedProjectId).update({tenderStatus:"PRICING",updatedAt:ts()});
    await logActivity("BOQ_IMPORTED",`Nhập ${count} dòng BOQ từ CSV`,{projectId:selectedProjectId});
    toast(`Đã nhập ${count} dòng BOQ.`);
    await loadProjectData();paint(container);
  }catch(e){console.error(e);toast(e.message||"Không thể nhập CSV.","error")}
}
function parseCsv(text){
  const first=(text.split(/\r?\n/,1)[0]||"");
  const delim=(first.match(/;/g)||[]).length >= (first.match(/,/g)||[]).length ? ";" : ",";
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
    }else if(ch===delim&&!quoted){row.push(cell);cell=""}
    else if((ch==="\n"||ch==="\r")&&!quoted){
      if(ch==="\r"&&text[i+1]==="\n")i++;
      row.push(cell);rows.push(row);row=[];cell="";
    }else cell+=ch;
  }
  if(cell.length||row.length){row.push(cell);rows.push(row)}
  return rows.map(r=>r.map(x=>x.trim()));
}
function toNumber(v){
  const s=String(v??"").trim().replace(/\s/g,"");
  if(!s)return 0;
  if(s.includes(",")&&!s.includes("."))return Number(s.replace(",","."))||0;
  return Number(s.replaceAll(",",""))||0;
}
