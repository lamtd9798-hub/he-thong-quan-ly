import {
  refs, arr, ts, logActivity, can, getProfile, esc, norm, money, fmtDateTime,
  setPage, loading, empty, badge, modal, toast, confirmBox
} from "../core.js?v=2.18.2";

let projects=[];
let selectedProjectId="";
let boqItems=[];
let boqMeta={};
let materialImports=[];
let materialRows=[];
let tab="BOQ";
let q="";
let matchCache=new Map();

const BOQ_ALIASES={
  itemNo:["muc","mục","stt","item no","no","ma boq","mã boq","code"],
  description:["dien giai","diễn giải","mo ta","mô tả","noi dung","nội dung","ten vat tu","tên vật tư","ten hang","tên hàng","description","item description"],
  specification:["model thong so ky thuat","model/thông số kỹ thuật","model","thong so ky thuat","thông số kỹ thuật","thong so","thông số","quy cach","quy cách","spec","specification"],
  unit:["don vi","đơn vị","dvt","đvt","unit","uom"],
  qty:["khoi luong","khối lượng","so luong","số lượng","qty","quantity"],
  brand:["nhan hieu","nhãn hiệu","thuong hieu","thương hiệu","brand","manufacturer"],
  origin:["xuat xu","xuất xứ","origin","country of origin"],
  materialUnit:["vat tu chinh","vật tư chính","gia vat tu","giá vật tư","don gia vat tu","đơn giá vật tư","material price"],
  laborUnit:["nhan cong va vat tu phu","nhân công và vật tư phụ","nhan cong","nhân công","gia nhan cong","giá nhân công","labor"]
};

const PRICE_ALIASES={
  code:["ma hang","mã hàng","ma vat tu","mã vật tư","item code","code","sku","part no","part number"],
  description:["ten vat tu","tên vật tư","ten hang","tên hàng","mo ta","mô tả","dien giai","diễn giải","description","item description","product"],
  specification:["quy cach","quy cách","model","thong so","thông số","spec","specification","kich thuoc","kích thước"],
  unit:["don vi","đơn vị","dvt","đvt","unit","uom"],
  brand:["nhan hieu","nhãn hiệu","thuong hieu","thương hiệu","hang","hãng","brand","manufacturer"],
  origin:["xuat xu","xuất xứ","origin","country of origin"],
  unitPrice:["don gia","đơn giá","gia ban","giá bán","gia vat tu","giá vật tư","unit price","unit rate","price","gia","giá"],
  supplier:["nha cung cap","nhà cung cấp","ncc","supplier","vendor"]
};

export async function renderBOQ(container){
  setPage("Lập giá đấu thầu","Công việc / Đấu thầu / Lập giá");
  container.innerHTML=loading();

  projects=await arr(refs.projects());
  const allowed=projects.filter(p=>p.phase==="TENDER"||p.phase==="EXECUTION");
  if(!selectedProjectId&&allowed.length)selectedProjectId=allowed[0].id;
  if(selectedProjectId&&!allowed.some(p=>p.id===selectedProjectId))selectedProjectId=allowed[0]?.id||"";

  await loadProjectData();
  paint(container);
}

async function loadProjectData(){
  if(!selectedProjectId){
    boqItems=[];boqMeta={};materialImports=[];materialRows=[];matchCache=new Map();return;
  }

  // V2.18.2 chỉ đọc MỘT vùng Firebase đã hoạt động ổn định: /boq/{projectId}.
  // Metadata và kho giá nằm trong nhánh hệ thống __PRICING_DATA__, tránh mọi read permission mới.
  const boqSnap=await refs.boqProject(selectedProjectId).once("value");
  const b=boqSnap.val()||{};
  const pricingData=b.__PRICING_DATA__||{};

  boqItems=Object.entries(b)
    .filter(([id])=>!String(id).startsWith("__"))
    .map(([id,x])=>({id,...(x||{})}))
    .sort(sortBoqRows);
  boqMeta=pricingData.boqImportMeta||{};

  const pv=pricingData.materialPriceImports||{};
  materialImports=Object.entries(pv).map(([id,x])=>({id,...(x||{})})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  materialRows=[];
  for(const imp of materialImports){
    for(const [rowId,row] of Object.entries(imp.rows||{})){
      materialRows.push({
        id:`${imp.id}:${rowId}`,importId:imp.id,rowId,...(row||{}),
        sourceFileName:imp.fileName||row.sourceFileName||"",
        sourceSheetName:imp.sheetName||row.sourceSheetName||"",
        supplier:row.supplier||imp.supplier||baseFileName(imp.fileName||"")
      });
    }
  }
  rebuildMatchCache();
}

function paint(container){
  const project=projects.find(p=>p.id===selectedProjectId);
  const itemRows=boqItems.filter(isPriceableItem);
  const priced=itemRows.filter(x=>Number(x.materialUnit||0)>0).length;
  const sourced=itemRows.filter(x=>x.materialPriceSource?.fileName).length;
  const high=matchingRows().filter(x=>x.best?.score>=95).length;
  const suggest=matchingRows().filter(x=>x.best?.score>=78&&x.best?.score<95).length;

  container.innerHTML=`
    <div class="page-head tender-pricing-head">
      <div>
        <h2>Lập giá đấu thầu</h2>
        <p>BOQ → tải báo giá vật tư → tự nhận diện → ráp giá có nguồn truy vết.</p>
      </div>
      <div class="actions">
        ${selectedProjectId&&can("boqEdit")?`<button class="btn primary" id="uploadBoqBtn">＋ Tải BOQ Excel / CSV</button>`:""}
      </div>
    </div>

    <div class="toolbar tender-project-toolbar">
      <select id="pricingProjectSelect" style="min-width:360px">
        <option value="">-- Chọn dự án --</option>
        ${projects.filter(p=>p.phase==="TENDER"||p.phase==="EXECUTION").map(p=>`<option value="${p.id}" ${p.id===selectedProjectId?"selected":""}>${esc(p.code||"")} - ${esc(p.name||"")}</option>`).join("")}
      </select>
      ${selectedProjectId?`<div class="pricing-project-chip">${esc(project?.client||"")}</div>`:""}
    </div>

    ${selectedProjectId?`
      <div class="grid g4 tender-pricing-metrics">
        ${metricCard("Dòng cần lập giá",itemRows.length,"▦","blue")}
        ${metricCard("Đã có giá vật tư",priced,"₫",priced===itemRows.length&&itemRows.length?"green":"orange")}
        ${metricCard("Có nguồn báo giá",sourced,"✓",sourced?"green":"gray")}
        ${metricCard("Đề xuất cần kiểm tra",suggest,"!",suggest?"orange":"green")}
      </div>

      <div class="tender-pricing-tabs mt">
        ${pricingTab("BOQ","1. BOQ")}
        ${pricingTab("MATERIAL","2. Báo giá vật tư",materialImports.length?String(materialImports.length):"")}
        ${pricingTab("MATCH","3. Ráp giá",high+suggest?String(high+suggest):"")}
        <button class="pricing-tab disabled" type="button" title="Sẽ triển khai sau khi phần giá vật tư ổn định">4. Giá nhân công <span>Sắp làm</span></button>
      </div>

      ${tab==="BOQ"?boqPanel(project):tab==="MATERIAL"?materialPanel(project):matchPanel(project)}
    `:empty("Chưa có dự án","Tạo/chọn dự án đấu thầu trước khi lập giá.","▣")}
  `;

  bind(container);
}

function pricingTab(key,label,count=""){
  return `<button class="pricing-tab ${tab===key?"active":""}" type="button" data-pricing-tab="${key}">${label}${count?`<span>${count}</span>`:""}</button>`;
}

function metricCard(label,value,icon,color){
  return `<div class="pricing-kpi ${color}"><div><span>${label}</span><b>${value}</b></div><i>${icon}</i></div>`;
}

function boqPanel(project){
  const visible=boqItems.filter(x=>!q||norm(`${x.itemNo} ${x.description} ${x.specification} ${x.unit} ${x.brand}`).includes(norm(q)));
  const itemCount=boqItems.filter(isPriceableItem).length;

  return `<div class="card tender-pricing-card">
    <div class="card-head">
      <div>
        <h3>BOQ đang lập giá</h3>
        <div class="secondary-text">${boqMeta.fileName?`${esc(boqMeta.fileName)} · Sheet ${esc(boqMeta.sheetName||"—")}`:"Chưa có file BOQ gốc"}</div>
      </div>
      <div class="actions">
        ${boqItems.length?badge(`${itemCount} dòng vật tư`,"blue"):""}
        ${can("boqEdit")?`<button class="btn" id="uploadBoqInlineBtn">${boqItems.length?"Thay BOQ":"＋ Tải BOQ"}</button>`:""}
      </div>
    </div>

    ${boqItems.length?`
      <div class="pricing-filterbar">
        <div class="search"><input id="pricingSearch" value="${esc(q)}" placeholder="Tìm mục, mô tả, model, đơn vị..."></div>
        <div class="pricing-hint">Khối lượng và giá vật tư có thể nhập trực tiếp. Giá ráp tự động luôn ghi kèm nguồn.</div>
      </div>
      <div class="table-wrap tender-boq-wrap">
        <table class="table tender-boq-table">
          <thead><tr>
            <th>MỤC</th><th>DIỄN GIẢI</th><th>MODEL / THÔNG SỐ</th><th>ĐVT</th><th>KHỐI LƯỢNG</th><th>GIÁ VẬT TƯ</th><th>NGUỒN GIÁ</th><th>TRẠNG THÁI</th>
          </tr></thead>
          <tbody>${visible.map(tenderBoqRow).join("")}</tbody>
        </table>
      </div>
    `:empty("Chưa có BOQ","Bấm “Tải BOQ Excel / CSV”. Hệ thống sẽ tự nhận Sheet, dòng tiêu đề và các cột Mục / Diễn giải / ĐVT / Khối lượng.","▦")}
  </div>`;
}

function tenderBoqRow(x){
  if(x.rowType==="SECTION")return `<tr class="tender-section-row"><td><b>${esc(x.itemNo||"")}</b></td><td colspan="7"><b>${esc(x.description||"")}</b></td></tr>`;
  if(x.rowType==="NOTE")return `<tr class="tender-note-row"><td>${esc(x.itemNo||"")}</td><td colspan="7">${esc(x.description||"")}</td></tr>`;

  const source=x.materialPriceSource||{};
  const status=source.fileName?badge(x.matchStatus==="MANUAL"?"Nhập tay":"Đã ráp giá","green"):Number(x.materialUnit||0)>0?badge("Nhập tay","blue"):badge("Chưa có giá","orange");
  const sourceHtml=source.fileName?`<button type="button" class="price-source-link" data-source-item="${x.id}"><b>${esc(source.supplier||x.selectedSupplier||"NCC")}</b><span>${esc(source.fileName)} · ${esc(source.sheetName||"")} · dòng ${Number(source.sourceRow||0)||"—"}</span></button>`:`<span class="secondary-text">—</span>`;

  return `<tr>
    <td><b>${esc(x.itemNo||"")}</b></td>
    <td><div class="primary-text">${esc(x.description||"")}</div>${x.brand?`<div class="secondary-text">${esc(x.brand)}</div>`:""}</td>
    <td>${esc(x.specification||"—")}</td>
    <td style="text-align:center">${esc(x.unit||"")}</td>
    <td><input class="pricing-inline-number" type="number" step="any" min="0" value="${Number(x.qty||0)}" data-inline-item="${x.id}" data-inline-field="qty" ${can("boqEdit")?"":"disabled"}></td>
    <td><input class="pricing-inline-number money-input" type="number" step="any" min="0" value="${Number(x.materialUnit||0)}" data-inline-item="${x.id}" data-inline-field="materialUnit" ${can("boqEdit")?"":"disabled"}></td>
    <td>${sourceHtml}</td>
    <td>${status}</td>
  </tr>`;
}

function materialPanel(project){
  return `<div class="card tender-pricing-card">
    <div class="card-head">
      <div><h3>Kho báo giá vật tư của dự án</h3><div class="secondary-text">Có thể tải nhiều file Excel/CSV. Hệ thống tự tìm Sheet và cột đơn giá.</div></div>
      <div class="actions">${can("quoteEdit")?`<button class="btn primary" id="uploadMaterialPricesBtn">＋ Tải file giá vật tư</button>`:""}</div>
    </div>

    ${materialImports.length?`
      <div class="material-import-list">
        ${materialImports.map(materialImportCard).join("")}
      </div>
      <div class="pricing-library-head">
        <div><h4>Dữ liệu giá đã đọc</h4><span>${materialRows.length.toLocaleString("vi-VN")} dòng giá</span></div>
      </div>
      <div class="table-wrap material-library-wrap"><table class="table material-library-table"><thead><tr>
        <th>MÃ</th><th>VẬT TƯ / MÔ TẢ</th><th>QUY CÁCH / MODEL</th><th>ĐVT</th><th>HÃNG</th><th>NCC</th><th>ĐƠN GIÁ</th><th>NGUỒN</th>
      </tr></thead><tbody>${materialRows.slice(0,400).map(materialPriceRowHtml).join("")}</tbody></table></div>
      ${materialRows.length>400?`<div class="pricing-limit-note">Đang hiển thị 400/${materialRows.length} dòng. Toàn bộ dữ liệu vẫn được dùng khi ráp giá.</div>`:""}
    `:empty("Chưa có báo giá vật tư","Tải báo giá của NCC lên. File có thể khác thứ tự cột; hệ thống sẽ tự nhận Mô tả / Quy cách / ĐVT / Đơn giá.","◆")}
  </div>`;
}

function materialImportCard(x){
  return `<div class="material-import-card">
    <div class="material-file-icon">XLS</div>
    <div class="material-file-main"><b>${esc(x.fileName||"")}</b><span>${esc(x.supplier||baseFileName(x.fileName||""))} · Sheet ${esc(x.sheetName||"—")} · ${Number(x.rowCount||0)} dòng</span></div>
    <div class="material-file-time">${fmtDateTime(x.createdAt)}</div>
    ${can("quoteEdit")?`<button class="btn red sm" data-delete-price-import="${x.id}">Xóa</button>`:""}
  </div>`;
}

function materialPriceRowHtml(x){
  return `<tr><td>${esc(x.code||"—")}</td><td><b>${esc(x.description||"")}</b></td><td>${esc(x.specification||"—")}</td><td>${esc(x.unit||"")}</td><td>${esc(x.brand||"—")}</td><td>${esc(x.supplier||"—")}</td><td><b>${money(x.unitPrice)}</b></td><td><div class="secondary-text">${esc(x.sourceFileName||"")}<br>${esc(x.sourceSheetName||"")} · dòng ${x.sourceRow||"—"}</div></td></tr>`;
}

function matchPanel(project){
  const rows=matchingRows();
  const exact=rows.filter(x=>x.best?.score>=95).length;
  const suggested=rows.filter(x=>x.best?.score>=78&&x.best?.score<95).length;
  const missing=rows.filter(x=>!x.best||x.best.score<78).length;

  return `<div class="card tender-pricing-card">
    <div class="card-head">
      <div><h3>Ráp giá vật tư vào BOQ</h3><div class="secondary-text">Ưu tiên mã → mô tả → quy cách → ĐVT. Chỉ tự áp dụng khi độ tin cậy cao.</div></div>
      <div class="actions">
        ${can("boqEdit")&&materialRows.length?`<button class="btn" id="recalcMatchesBtn">Tính lại đối chiếu</button><button class="btn primary" id="applyHighMatchesBtn">Áp dụng tất cả ≥95%</button>`:""}
      </div>
    </div>

    <div class="match-summary">
      <div class="match-stat green"><b>${exact}</b><span>Khớp cao ≥95%</span></div>
      <div class="match-stat orange"><b>${suggested}</b><span>Cần kiểm tra 78–94%</span></div>
      <div class="match-stat red"><b>${missing}</b><span>Chưa tìm được</span></div>
    </div>

    ${boqItems.filter(isPriceableItem).length&&!materialRows.length?empty("Chưa có dữ liệu giá","Qua tab “Báo giá vật tư” và tải ít nhất một file giá trước.","◆"):
      `<div class="table-wrap material-match-wrap"><table class="table material-match-table"><thead><tr>
        <th>MỤC</th><th>BOQ</th><th>ĐVT</th><th>GIÁ HIỆN TẠI</th><th>ỨNG VIÊN TỐT NHẤT</th><th>ĐƠN GIÁ</th><th>ĐỘ KHỚP</th><th>NGUỒN</th><th>THAO TÁC</th>
      </tr></thead><tbody>${rows.map(matchRowHtml).join("")}</tbody></table></div>`}
  </div>`;
}

function matchRowHtml(m){
  const x=m.item,b=m.best;
  if(!b)return `<tr><td>${esc(x.itemNo||"")}</td><td><b>${esc(x.description||"")}</b><div class="secondary-text">${esc(x.specification||"")}</div></td><td>${esc(x.unit||"")}</td><td>${money(x.materialUnit)}</td><td colspan="4">${badge("Không tìm thấy ứng viên","red")}</td><td>—</td></tr>`;

  const color=b.score>=95?"green":b.score>=78?"orange":"red";
  const applied=x.materialPriceSource?.priceRowId===b.row.id;
  return `<tr>
    <td><b>${esc(x.itemNo||"")}</b></td>
    <td><b>${esc(x.description||"")}</b><div class="secondary-text">${esc(x.specification||"")}</div></td>
    <td>${esc(x.unit||"")}</td>
    <td>${money(x.materialUnit)}</td>
    <td><b>${esc(b.row.description||"")}</b><div class="secondary-text">${esc(b.row.specification||"")} · ${esc(b.row.brand||"")}</div></td>
    <td><b>${money(b.row.unitPrice)}</b></td>
    <td>${badge(`${Math.round(b.score)}%`,color)}<div class="secondary-text match-reason">${esc(b.reason)}</div></td>
    <td><div class="primary-text">${esc(b.row.supplier||"NCC")}</div><div class="secondary-text">${esc(b.row.sourceFileName||"")} · dòng ${b.row.sourceRow||"—"}</div></td>
    <td>${can("boqEdit")?applied?badge("Đang dùng","green"):`<button class="btn ${b.score>=95?"green":"orange"} sm" data-apply-match="${x.id}">Dùng giá</button>`:"—"}</td>
  </tr>`;
}

function bind(container){
  container.querySelector("#pricingProjectSelect")?.addEventListener("change",async e=>{
    selectedProjectId=e.target.value;tab="BOQ";q="";container.innerHTML=loading();await loadProjectData();paint(container);
  });

  container.querySelectorAll("[data-pricing-tab]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.pricingTab;paint(container)}));
  container.querySelector("#uploadBoqBtn")?.addEventListener("click",()=>openBoqUpload(container));
  container.querySelector("#uploadBoqInlineBtn")?.addEventListener("click",()=>openBoqUpload(container));
  container.querySelector("#uploadMaterialPricesBtn")?.addEventListener("click",()=>openMaterialUpload(container));

  container.querySelector("#pricingSearch")?.addEventListener("input",e=>{
    q=e.target.value;paint(container);requestAnimationFrame(()=>{const i=container.querySelector("#pricingSearch");i?.focus();i?.setSelectionRange(i.value.length,i.value.length)});
  });

  container.querySelectorAll("[data-inline-item]").forEach(input=>input.addEventListener("change",async()=>{
    const item=boqItems.find(x=>x.id===input.dataset.inlineItem);if(!item)return;
    const field=input.dataset.inlineField,value=Math.max(0,Number(input.value||0));
    const patch={[field]:value,updatedAt:Date.now()};
    if(field==="materialUnit")Object.assign(patch,{materialPriceSource:null,selectedSupplier:"",matchStatus:"MANUAL"});
    try{
      await refs.boqItem(selectedProjectId,item.id).update(patch);
      Object.assign(item,patch);rebuildMatchCache();toast("Đã cập nhật BOQ.");
    }catch(e){toast(e.message||"Không lưu được BOQ.","error")}
  }));

  container.querySelectorAll("[data-source-item]").forEach(b=>b.addEventListener("click",()=>showPriceSource(b.dataset.sourceItem)));
  container.querySelectorAll("[data-delete-price-import]").forEach(b=>b.addEventListener("click",()=>deleteMaterialImport(b.dataset.deletePriceImport,container)));
  container.querySelectorAll("[data-apply-match]").forEach(b=>b.addEventListener("click",()=>applyBestMatch(b.dataset.applyMatch,container)));
  container.querySelector("#recalcMatchesBtn")?.addEventListener("click",()=>{rebuildMatchCache();toast("Đã tính lại đối chiếu.");paint(container)});
  container.querySelector("#applyHighMatchesBtn")?.addEventListener("click",()=>applyHighConfidenceMatches(container));
}

function openBoqUpload(container){
  if(!can("boqEdit"))return;
  modal({
    title:boqItems.length?"Thay / nhập lại BOQ":"Tải BOQ đấu thầu",
    eyebrow:"BƯỚC 1 · BOQ",
    size:"lg",submitText:"Nhập BOQ",
    body:`<div class="pricing-upload-note"><b>Hệ thống tự nhận BOQ.</b> File có thể có tên dự án/ghi chú ở phía trên, tiêu đề 1–3 hàng và ô gộp.</div>
      <div class="form-grid mt">
        <label class="field span2"><span>File BOQ Excel / CSV *</span><input required type="file" name="boqFile" id="tenderBoqFile" accept=".xlsx,.xls,.csv"></label>
        <label class="field span2 hidden" id="tenderBoqSheetWrap"><span>Sheet BOQ</span><select name="boqSheet" id="tenderBoqSheet"></select></label>
        <label class="field span2"><span>Cách nhập</span><select name="importMode"><option value="REPLACE">Thay toàn bộ BOQ hiện tại</option><option value="APPEND">Nối thêm vào BOQ hiện tại</option></select></label>
        <div class="span2 hidden pricing-file-preview" id="tenderBoqPreview"></div>
      </div>`,
    onSubmit:async fd=>{
      const file=fd.get("boqFile");if(!(file instanceof File)||!file.size){toast("Chọn file BOQ.","error");return false}
      const inspection=document.querySelector("#tenderBoqFile")?._inspection||await inspectSpreadsheet(file,"BOQ");
      const sheetName=String(fd.get("boqSheet")||inspection.defaultSheet||"");
      const meta=inspection.sheets[sheetName]||inspection.sheets[inspection.defaultSheet];
      const parsed=parseBoqSheet(meta.aoa,meta.headerRow-1,meta.headerDepth);
      if(!parsed.length){toast("Không đọc được dòng BOQ nào.","error");return false}
      if(fd.get("importMode")==="REPLACE"&&boqItems.length){
        if(!await confirmBox("Thay BOQ hiện tại",`BOQ mới có ${parsed.filter(isPriceableItem).length} dòng vật tư. Thay toàn bộ BOQ đang có?`,"Thay BOQ"))return false;
      }
      await saveBoqImport(parsed,{fileName:file.name,sheetName:sheetName,headerRow:meta.headerRow,headerDepth:meta.headerDepth,mode:String(fd.get("importMode")||"REPLACE")});
      toast(`Đã nhập ${parsed.filter(isPriceableItem).length} dòng vật tư từ BOQ.`);
      await loadProjectData();tab="BOQ";paint(container);return true;
    }
  });

  const input=document.querySelector("#tenderBoqFile"),sheet=document.querySelector("#tenderBoqSheet"),wrap=document.querySelector("#tenderBoqSheetWrap"),preview=document.querySelector("#tenderBoqPreview");
  input?.addEventListener("change",async()=>{
    const file=input.files?.[0];if(!file)return;
    try{
      const inspection=await inspectSpreadsheet(file,"BOQ");input._inspection=inspection;
      if(inspection.kind==="EXCEL"){
        wrap?.classList.remove("hidden");sheet.innerHTML=Object.keys(inspection.sheets).map(name=>{const m=inspection.sheets[name];return `<option value="${esc(name)}" ${name===inspection.defaultSheet?"selected":""}>${esc(name)} · tiêu đề ${m.headerRow}${m.headerDepth>1?`–${m.headerRow+m.headerDepth-1}`:""}</option>`}).join("");
      }else{wrap?.classList.add("hidden");sheet.innerHTML=`<option value="CSV">CSV</option>`}
      renderBoqPreview(inspection,sheet.value||inspection.defaultSheet,preview);
    }catch(e){console.error(e);toast(e.message||"Không đọc được file.","error")}
  });
  sheet?.addEventListener("change",()=>{const ins=input?._inspection;if(ins)renderBoqPreview(ins,sheet.value,preview)});
}

async function saveBoqImport(parsed,meta){
  const updates={};
  for(const row of parsed){
    const key=refs.boqProject(selectedProjectId).push().key;
    updates[key]={...row,createdAt:Date.now(),updatedAt:Date.now()};
  }
  if(meta.mode==="REPLACE"){
    // Không dùng .set() ở /boq/{projectId} vì sẽ xóa luôn __PRICING_DATA__.
    // Chỉ xóa các dòng BOQ thật, giữ nguyên nhánh hệ thống/kho báo giá.
    const patch={};
    for(const item of boqItems)patch[item.id]=null;
    Object.assign(patch,updates);
    await refs.boqProject(selectedProjectId).update(patch);
  }else{
    await refs.boqProject(selectedProjectId).update(updates);
  }

  try{
    await refs.boqImportMeta(selectedProjectId).set({...meta,rowCount:parsed.length,itemCount:parsed.filter(isPriceableItem).length,updatedAt:Date.now(),updatedByName:getProfile()?.displayName||getProfile()?.email||""});
  }catch(e){
    // BOQ chính đã lưu thành công. Metadata chỉ là thông tin phụ, không được làm hỏng import.
    console.warn("[V2.18.2] Không lưu được metadata BOQ nhưng BOQ chính đã lưu:",e);
  }

  // Trạng thái dự án chỉ là thông tin phụ; không để nó làm hỏng cả quá trình import BOQ.
  try{await refs.project(selectedProjectId).update({tenderStatus:"PRICING",updatedAt:ts()})}
  catch(e){console.warn("[V2.18.2] Không cập nhật được tenderStatus:",e)}
  try{await logActivity("TENDER_BOQ_IMPORTED",`Nhập BOQ ${meta.fileName} / ${meta.sheetName}`,{projectId:selectedProjectId,itemCount:parsed.filter(isPriceableItem).length})}catch{}
}

function renderBoqPreview(inspection,sheetName,box){
  const m=inspection.sheets[sheetName]||inspection.sheets[inspection.defaultSheet];if(!m||!box)return;
  const rows=parseBoqSheet(m.aoa,m.headerRow-1,m.headerDepth);
  box.classList.remove("hidden");
  box.innerHTML=`<div><b>${esc(inspection.fileName)}</b><span>Sheet ${esc(sheetName)} · tiêu đề dòng ${m.headerRow}${m.headerDepth>1?`–${m.headerRow+m.headerDepth-1}`:""} · nhận ${rows.filter(isPriceableItem).length} dòng vật tư</span></div>${badge("Đã nhận BOQ","green")}`;
}

function openMaterialUpload(container){
  if(!can("quoteEdit"))return;
  modal({
    title:"Tải báo giá vật tư",
    eyebrow:"BƯỚC 2 · GIÁ VẬT TƯ",
    size:"lg",submitText:"Đọc giá & ráp tự động",
    body:`<div class="pricing-upload-note"><b>Có thể chọn nhiều file cùng lúc.</b> Hệ thống tự tìm cột Tên vật tư / Quy cách / ĐVT / Đơn giá và lấy tên file làm tên NCC nếu không có cột NCC.</div>
      <div class="form-grid mt">
        <label class="field span2"><span>File báo giá Excel / CSV *</span><input required multiple type="file" name="priceFiles" id="materialPriceFiles" accept=".xlsx,.xls,.csv"></label>
        <label class="field span2"><span>Tên NCC mặc định (không bắt buộc)</span><input name="defaultSupplier" placeholder="Để trống: dùng tên file làm tên NCC"></label>
        <div class="span2 hidden pricing-file-preview-list" id="materialFilesPreview"></div>
      </div>`,
    onSubmit:async fd=>{
      const input=document.querySelector("#materialPriceFiles");const files=[...(input?.files||[])];
      if(!files.length){toast("Chọn ít nhất một file giá.","error");return false}
      const defaultSupplier=String(fd.get("defaultSupplier")||"").trim();
      let total=0;
      for(const file of files){
        const inspection=await inspectSpreadsheet(file,"PRICE");
        const sheetName=inspection.defaultSheet,m=inspection.sheets[sheetName];
        const rows=parsePriceSheet(m.aoa,m.headerRow-1,m.headerDepth,{fileName:file.name,sheetName,defaultSupplier});
        if(!rows.length)continue;
        const importId=refs.materialPriceImportsProject(selectedProjectId).push().key;
        const rowObj={};rows.forEach((r,i)=>rowObj[`r${String(i+1).padStart(5,"0")}`]=r);
        try{
          await refs.materialPriceImport(selectedProjectId,importId).set({
            fileName:file.name,sheetName,supplier:defaultSupplier||baseFileName(file.name),rowCount:rows.length,
            headerRow:m.headerRow,headerDepth:m.headerDepth,createdAt:Date.now(),createdByName:getProfile()?.displayName||getProfile()?.email||"",rows:rowObj
          });
        }catch(e){
          console.error("[V2.18.2] Lỗi lưu file giá",e);
          throw new Error(`Không lưu được file giá ${file.name}. ${firebaseErrorText(e)}`);
        }
        total+=rows.length;
      }
      if(!total){toast("Không file nào có dữ liệu giá hợp lệ. Cần tối thiểu Mô tả + Đơn giá.","error");return false}
      await loadProjectData();
      const applied=await autoApplyMatches(95);
      await loadProjectData();
      toast(`Đã đọc ${total} dòng giá. Tự ráp ${applied} dòng BOQ có độ khớp ≥95%.`);
      tab="MATCH";paint(container);return true;
    }
  });

  const input=document.querySelector("#materialPriceFiles"),preview=document.querySelector("#materialFilesPreview");
  input?.addEventListener("change",async()=>{
    const files=[...(input.files||[])];if(!files.length)return;
    preview.classList.remove("hidden");preview.innerHTML=`<div class="pricing-reading">Đang đọc ${files.length} file...</div>`;
    const cards=[];
    for(const file of files){
      try{
        const ins=await inspectSpreadsheet(file,"PRICE"),m=ins.sheets[ins.defaultSheet];
        const rows=parsePriceSheet(m.aoa,m.headerRow-1,m.headerDepth,{fileName:file.name,sheetName:ins.defaultSheet,defaultSupplier:""});
        cards.push(`<div class="pricing-file-mini ok"><b>${esc(file.name)}</b><span>Sheet ${esc(ins.defaultSheet)} · tiêu đề ${m.headerRow}${m.headerDepth>1?`–${m.headerRow+m.headerDepth-1}`:""} · ${rows.length} dòng giá</span></div>`);
      }catch(e){cards.push(`<div class="pricing-file-mini bad"><b>${esc(file.name)}</b><span>${esc(e.message||"Không nhận diện được")}</span></div>`)}
    }
    preview.innerHTML=cards.join("");
  });
}

async function deleteMaterialImport(importId,container){
  const imp=materialImports.find(x=>x.id===importId);if(!imp)return;
  if(!await confirmBox("Xóa file giá",`Xóa dữ liệu giá đã đọc từ ${imp.fileName||"file này"}? Giá đã ráp vào BOQ sẽ không tự xóa.`,"Xóa"))return;
  await refs.materialPriceImport(selectedProjectId,importId).remove();
  toast("Đã xóa file giá khỏi kho dữ liệu.","warning");await loadProjectData();paint(container);
}

function firebaseErrorText(e){
  const code=String(e?.code||"");
  if(code.toLowerCase().includes("permission")||String(e?.message||"").toLowerCase().includes("permission"))
    return "Firebase đang từ chối quyền ghi tại vùng dữ liệu lập giá.";
  return e?.message||code||"Lỗi Firebase";
}

function rebuildMatchCache(){
  matchCache=new Map();
  for(const item of boqItems.filter(isPriceableItem))matchCache.set(item.id,rankMaterialCandidates(item,materialRows));
}

function matchingRows(){
  return boqItems.filter(isPriceableItem).map(item=>({item,best:(matchCache.get(item.id)||[])[0]||null}));
}

function rankMaterialCandidates(item,rows){
  const ranked=[];
  for(const row of rows){
    const m=scoreMaterialMatch(item,row);
    if(m.score>=55)ranked.push({row,score:m.score,reason:m.reason});
  }
  return ranked.sort((a,b)=>b.score-a.score||Number(a.row.unitPrice||0)-Number(b.row.unitPrice||0)).slice(0,8);
}

function scoreMaterialMatch(item,row){
  const codeA=cleanKey(item.itemNo||item.code||""),codeB=cleanKey(row.code||"");
  const descA=cleanText(item.description),descB=cleanText(row.description);
  const specA=cleanText(item.specification),specB=cleanText(row.specification);
  const unitA=canonUnit(item.unit),unitB=canonUnit(row.unit);
  const brandA=cleanText(item.brand),brandB=cleanText(row.brand);

  if(codeA&&codeB&&codeA===codeB)return {score:100,reason:"Trùng mã hàng / mã BOQ"};
  if(!descA||!descB)return {score:0,reason:"Thiếu mô tả"};

  const descSim=textSimilarity(descA,descB);
  const specSim=specA&&specB?textSimilarity(specA,specB):0;
  const sizeBonus=sharedTechnicalTokens(descA+" "+specA,descB+" "+specB);
  const unitMatch=unitA&&unitB&&unitA===unitB;
  const unitMismatch=unitA&&unitB&&unitA!==unitB;
  const brandMatch=brandA&&brandB&&(brandA===brandB||brandA.includes(brandB)||brandB.includes(brandA));

  let score=descSim*72 + specSim*12 + sizeBonus*8 + (unitMatch?8:0) + (brandMatch?4:0) - (unitMismatch?12:0);
  if(descA===descB)score=Math.max(score,92+(unitMatch?4:0)+(specA&&specB&&specA===specB?4:0));
  score=Math.max(0,Math.min(100,score));

  const reason=[];
  reason.push(`Mô tả ${Math.round(descSim*100)}%`);
  if(specA&&specB)reason.push(`Thông số ${Math.round(specSim*100)}%`);
  if(unitMatch)reason.push("ĐVT trùng");
  if(unitMismatch)reason.push("ĐVT khác");
  if(sizeBonus>.6)reason.push("Kích thước trùng");
  return {score,reason:reason.join(" · ")};
}

async function autoApplyMatches(threshold=95){
  rebuildMatchCache();
  const updates={};let count=0;
  for(const item of boqItems.filter(isPriceableItem)){
    const best=(matchCache.get(item.id)||[])[0];if(!best||best.score<threshold)continue;
    fillMatchUpdates(updates,item,best,"AUTO");count++;
  }
  if(Object.keys(updates).length)await refs.boqProject(selectedProjectId).update(updates);
  return count;
}

async function applyHighConfidenceMatches(container){
  const count=await autoApplyMatches(95);await loadProjectData();toast(`Đã áp dụng ${count} dòng có độ khớp ≥95%.`);paint(container);
}

function fillMatchUpdates(updates,item,best,status){
  const base=item.id;
  updates[`${base}/materialUnit`]=Number(best.row.unitPrice||0);
  updates[`${base}/selectedSupplier`]=best.row.supplier||"";
  if(best.row.brand)updates[`${base}/brand`]=best.row.brand;
  updates[`${base}/matchStatus`]=status;
  updates[`${base}/matchScore`]=Math.round(best.score*10)/10;
  updates[`${base}/materialPriceSource`]={
    priceRowId:best.row.id,importId:best.row.importId||"",supplier:best.row.supplier||"",
    fileName:best.row.sourceFileName||"",sheetName:best.row.sourceSheetName||"",sourceRow:Number(best.row.sourceRow||0),
    unitPrice:Number(best.row.unitPrice||0),matchScore:Math.round(best.score*10)/10,matchReason:best.reason||""
  };
  updates[`${base}/updatedAt`]=Date.now();
}

async function applyBestMatch(itemId,container){
  const item=boqItems.find(x=>x.id===itemId),best=(matchCache.get(itemId)||[])[0];if(!item||!best)return;
  const updates={};fillMatchUpdates(updates,item,best,"REVIEWED");await refs.boqProject(selectedProjectId).update(updates);
  toast(`Đã dùng giá ${money(best.row.unitPrice)} từ ${best.row.supplier||best.row.sourceFileName}.`);await loadProjectData();paint(container);
}

function showPriceSource(itemId){
  const item=boqItems.find(x=>x.id===itemId),s=item?.materialPriceSource;if(!item||!s)return;
  modal({title:"Nguồn giá vật tư",eyebrow:item.itemNo||"BOQ",size:"sm",showSubmit:false,body:`
    <div class="price-source-detail">
      <div><span>Vật tư BOQ</span><b>${esc(item.description||"")}</b></div>
      <div><span>Đơn giá đang dùng</span><b>${money(item.materialUnit)}</b></div>
      <div><span>Nhà cung cấp</span><b>${esc(s.supplier||item.selectedSupplier||"—")}</b></div>
      <div><span>File nguồn</span><b>${esc(s.fileName||"—")}</b></div>
      <div><span>Sheet / dòng</span><b>${esc(s.sheetName||"—")} / ${s.sourceRow||"—"}</b></div>
      <div><span>Mức khớp</span><b>${Number(s.matchScore||0).toFixed(0)}%</b></div>
      <div class="span2"><span>Lý do</span><b>${esc(s.matchReason||"—")}</b></div>
    </div>`});
}

function sortBoqRows(a,b){
  const oa=Number(a.sourceOrder??999999),ob=Number(b.sourceOrder??999999);if(oa!==ob)return oa-ob;
  return String(a.itemNo||"").localeCompare(String(b.itemNo||""),"vi",{numeric:true});
}

function isPriceableItem(x){return x?.rowType!=="SECTION"&&x?.rowType!=="NOTE"&&String(x?.description||"").trim()!==""}

async function inspectSpreadsheet(file,mode){
  const ext=fileExtension(file.name);if(!["xlsx","xls","csv"].includes(ext))throw new Error("Chỉ hỗ trợ .xlsx, .xls hoặc .csv.");
  if(ext==="csv"){
    const aoa=parseCsv(await file.text());const d=detectHeader(aoa,mode);
    return {kind:"CSV",fileName:file.name,defaultSheet:"CSV",sheets:{CSV:{aoa,headerRow:d.headerRow,headerDepth:d.headerDepth,score:d.score}}};
  }
  const XLSX=globalThis.XLSX;if(!XLSX)throw new Error("Thư viện Excel chưa tải được. Tải lại trang rồi thử lại.");
  const wb=XLSX.read(await file.arrayBuffer(),{type:"array",raw:true,cellDates:false});
  const sheets={};
  for(const name of wb.SheetNames){
    const ws=wb.Sheets[name];
    const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false,blankrows:true});
    const aoa=expandMergedCells(raw,ws["!merges"]||[]);const d=detectHeader(aoa,mode);
    sheets[name]={aoa,headerRow:d.headerRow,headerDepth:d.headerDepth,score:d.score};
  }
  const defaultSheet=[...wb.SheetNames].sort((a,b)=>(sheets[b]?.score||0)-(sheets[a]?.score||0))[0];
  return {kind:"EXCEL",fileName:file.name,defaultSheet,sheets};
}

function detectHeader(aoa,mode){
  const aliases=mode==="PRICE"?PRICE_ALIASES:BOQ_ALIASES;
  let best={headerRow:1,headerDepth:1,score:-1};const limit=Math.min(50,aoa.length);
  for(let r=0;r<limit;r++){
    if(!(aoa[r]||[]).some(x=>String(x??"").trim()))continue;
    for(let depth=1;depth<=3;depth++){
      if(r+depth>aoa.length)break;
      const headers=combineHeaders(aoa,r,depth);const map=mapHeaders(headers,aliases,mode);
      let score=Object.values(map).filter(i=>i>=0).length*3;
      if(map.description>=0)score+=18;
      if(mode==="PRICE"&&map.unitPrice>=0)score+=20;
      if(mode==="BOQ"&&map.qty>=0)score+=12;
      if(map.unit>=0)score+=4;if(map.specification>=0)score+=3;
      score+=dataLikelihood(aoa,r+depth,map,mode);
      if(score>best.score)best={headerRow:r+1,headerDepth:depth,score};
    }
  }
  return best;
}

function combineHeaders(aoa,start,depth){
  let max=0;for(let r=start;r<start+depth;r++)max=Math.max(max,(aoa[r]||[]).length);
  return Array.from({length:max},(_,c)=>{
    const parts=[];for(let r=start;r<start+depth;r++){
      const t=String(aoa[r]?.[c]??"").replace(/\s+/g," ").trim();if(t&&!parts.some(p=>cleanHeader(p)===cleanHeader(t)))parts.push(t);
    }return parts.join(" / ");
  });
}

function mapHeaders(headers,aliases,mode){
  const clean=headers.map(cleanHeader),map={};
  for(const [key,list] of Object.entries(aliases))map[key]=bestHeaderIndex(clean,list.map(cleanHeader),key,mode);
  return map;
}

function bestHeaderIndex(headers,aliases,key,mode){
  let best=-1,bestScore=-1;
  headers.forEach((h,i)=>{
    if(!h)return;
    aliases.forEach(a=>{
      let score=-1;
      if(h===a)score=120+a.length;
      else if(h.startsWith(a+" ")||h.endsWith(" "+a))score=95+a.length;
      else if(a.length>=4&&h.includes(a))score=70+a.length;
      if(key==="qty"&&h==="khoi luong")score=Math.max(score,145);
      if(key==="description"&&(h==="dien giai"||h==="mo ta"||h==="ten vat tu"||h==="ten hang"))score=Math.max(score,140);
      if(key==="unitPrice"){
        if(h.includes("thanh tien")||h.includes("tong tien"))score=-1;
        else if(h==="don gia"||h==="gia ban"||h==="gia vat tu")score=Math.max(score,150);
      }
      if(score>bestScore){bestScore=score;best=i}
    });
  });return best;
}

function dataLikelihood(aoa,start,map,mode){
  let n=0;for(let r=start;r<Math.min(aoa.length,start+30);r++){
    const row=aoa[r]||[];const desc=map.description>=0?String(row[map.description]??"").trim():"";
    if(!desc)continue;
    if(mode==="PRICE"){const price=map.unitPrice>=0?row[map.unitPrice]:"";if(isNumericLike(price)&&toNumber(price)>0)n+=3}
    else{const qty=map.qty>=0?row[map.qty]:"";n+=isNumericLike(qty)?2:1}
  }return Math.min(30,n);
}

function parseBoqSheet(aoa,headerIndex,headerDepth){
  const headers=combineHeaders(aoa,headerIndex,headerDepth),map=mapHeaders(headers,BOQ_ALIASES,"BOQ");
  if(map.description<0)throw new Error("Không nhận được cột Diễn giải/Mô tả trong BOQ.");
  const out=[];
  for(let r=headerIndex+headerDepth;r<aoa.length;r++){
    const row=aoa[r]||[];if(!row.some(x=>String(x??"").trim()))continue;
    const get=k=>map[k]>=0?(row[map[k]]??""):"";
    const itemNo=String(get("itemNo")??"").trim(),description=String(get("description")??"").trim();
    if(!itemNo&&!description)continue;
    const unit=String(get("unit")??"").trim(),qtyRaw=get("qty");
    const hasQty=isNumericLike(qtyRaw),materialRaw=get("materialUnit"),laborRaw=get("laborUnit");
    let rowType="ITEM";
    const descNorm=cleanText(description),unitNorm=cleanText(unit);
    if(descNorm==="ghi chu chung"||unitNorm==="note")rowType="NOTE";
    else if(!unit&&!hasQty&&!isNumericLike(materialRaw)&&!isNumericLike(laborRaw)&&looksLikeSection(itemNo,description))rowType="SECTION";
    else if(!unit&&!hasQty&&!itemNo&&description.length>45)rowType="NOTE";
    out.push({
      sourceRow:r+1,sourceOrder:r-(headerIndex+headerDepth),rowType,itemNo,description,
      specification:String(get("specification")??"").trim(),unit,qty:hasQty?toNumber(qtyRaw):0,
      brand:String(get("brand")??"").trim(),origin:String(get("origin")??"").trim(),
      materialUnit:isNumericLike(materialRaw)?toNumber(materialRaw):0,laborUnit:isNumericLike(laborRaw)?toNumber(laborRaw):0,
      subcontractUnit:0,otherUnit:0,wastePct:0,markupPct:0
    });
  }
  return out;
}

function parsePriceSheet(aoa,headerIndex,headerDepth,{fileName,sheetName,defaultSupplier}){
  const headers=combineHeaders(aoa,headerIndex,headerDepth),map=mapHeaders(headers,PRICE_ALIASES,"PRICE");
  if(map.description<0||map.unitPrice<0)throw new Error(`${fileName}: cần cột Mô tả/Tên hàng và Đơn giá.`);
  const out=[];
  for(let r=headerIndex+headerDepth;r<aoa.length;r++){
    const row=aoa[r]||[];const get=k=>map[k]>=0?(row[map[k]]??""):"";
    const description=String(get("description")??"").trim(),price=toNumber(get("unitPrice"));
    if(!description||!(price>0))continue;
    out.push({
      code:String(get("code")??"").trim(),description,specification:String(get("specification")??"").trim(),
      unit:String(get("unit")??"").trim(),brand:String(get("brand")??"").trim(),origin:String(get("origin")??"").trim(),
      supplier:String(get("supplier")||defaultSupplier||baseFileName(fileName)).trim(),unitPrice:price,
      sourceFileName:fileName,sourceSheetName:sheetName,sourceRow:r+1,createdAt:Date.now()
    });
  }return out;
}

function expandMergedCells(source,merges){
  const aoa=(source||[]).map(r=>Array.isArray(r)?[...r]:[]);
  for(const m of merges||[]){
    const sr=Number(m.s?.r),sc=Number(m.s?.c),er=Number(m.e?.r),ec=Number(m.e?.c);if(![sr,sc,er,ec].every(Number.isInteger))continue;
    const value=aoa[sr]?.[sc];if(value===undefined||value===null||String(value).trim()==="")continue;
    for(let r=sr;r<=er;r++){if(!aoa[r])aoa[r]=[];for(let c=sc;c<=ec;c++)if(aoa[r][c]===undefined||aoa[r][c]===null||String(aoa[r][c]).trim()==="")aoa[r][c]=value}
  }return aoa;
}

function looksLikeSection(itemNo,description){
  const no=String(itemNo||"").trim(),d=String(description||"").trim();
  if(/^\d+(?:\.\d+)*\.?$/.test(no))return true;
  const letters=d.replace(/[^A-Za-zÀ-ỹĐđ]/g,"");const upper=d.replace(/[^A-ZÀ-ỸĐ]/g,"");
  return d.length>4&&letters.length>0&&upper.length/letters.length>=.72;
}

function cleanHeader(v){return norm(String(v??"")).replace(/đ/g,"d").replace(/[^a-z0-9%]+/g," ").replace(/\s+/g," ").trim()}
function cleanKey(v){return cleanText(v).replace(/\s+/g,"")}
function cleanText(v){return norm(String(v??"")).replace(/đ/g,"d").replace(/[^a-z0-9.%/+-]+/g," ").replace(/\s+/g," ").trim()}
function canonUnit(v){const x=cleanText(v).replace(/\s/g,"");const m={"bo":"bo","bộ":"bo","cai":"cai","cái":"cai","m2":"m2","m²":"m2","m3":"m3","m³":"m3","met":"m","meter":"m","md":"m","m":"m","set":"bo","lot":"lot"};return m[x]||x}
function textSimilarity(a,b){
  if(!a||!b)return 0;if(a===b)return 1;
  const A=new Set(a.split(" ").filter(x=>x.length>1)),B=new Set(b.split(" ").filter(x=>x.length>1));if(!A.size||!B.size)return 0;
  let inter=0;for(const x of A)if(B.has(x))inter++;
  const j=inter/(A.size+B.size-inter);
  const coverage=inter/Math.min(A.size,B.size);
  const contain=(a.includes(b)||b.includes(a))?0.10:0;
  return Math.min(1,Math.max(j,coverage*0.84)+contain);
}
function sharedTechnicalTokens(a,b){
  const re=/(?:dn|d|ø|phi)?\s*\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)?|\d+(?:[.,]\d+)?\s*(?:kw|hp|mm|cm|m|l\/s|m3\/h|m³\/h|bar|pa)/gi;
  const A=new Set((a.match(re)||[]).map(cleanKey)),B=new Set((b.match(re)||[]).map(cleanKey));if(!A.size||!B.size)return 0;
  let n=0;for(const x of A)if(B.has(x))n++;return n/Math.max(A.size,B.size);
}
function isNumericLike(v){if(typeof v==="number")return Number.isFinite(v);const s=String(v??"").trim();return !!s&&/^[-+]?\d[\d.,\s]*$/.test(s)}
function toNumber(v){
  if(typeof v==="number")return Number.isFinite(v)?v:0;let s=String(v??"").trim().replace(/\s/g,"").replace(/[₫đ]/gi,"");if(!s)return 0;
  const comma=s.lastIndexOf(","),dot=s.lastIndexOf(".");
  if(comma>=0&&dot>=0){if(comma>dot)s=s.replaceAll(".","").replace(",",".");else s=s.replaceAll(",","")}
  else if(comma>=0){const p=s.split(",");s=p.length===2&&p[1].length<=3?p[0]+"."+p[1]:s.replaceAll(",","")}
  const n=Number(s);return Number.isFinite(n)?n:0;
}
function fileExtension(name){return String(name||"").split(".").pop().toLowerCase()}
function baseFileName(name){return String(name||"").replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").trim()||"NCC"}

function parseCsv(text){
  const first=(text.split(/\r?\n/,1)[0]||""),delim=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?";":",";
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
    else if(ch===delim&&!quoted){row.push(cell);cell=""}
    else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);rows.push(row);row=[];cell=""}
    else cell+=ch;
  }
  if(cell.length||row.length){row.push(cell);rows.push(row)}return rows.map(r=>r.map(x=>x.trim()));
}

export function calcLine(x){
  const qty=Number(x.qty||0),base=Number(x.materialUnit||0)+Number(x.laborUnit||0)+Number(x.subcontractUnit||0)+Number(x.otherUnit||0),netUnit=base*(1+Number(x.wastePct||0)/100),bidUnit=netUnit*(1+Number(x.markupPct||0)/100);
  return {netUnit,bidUnit,netTotal:qty*netUnit,bidTotal:qty*bidUnit};
}

export function calcProjectTotals(list,settings={overheadPct:0,contingencyPct:0,discountPct:0,vatPct:10}){
  const base=list.filter(isPriceableItem).reduce((a,x)=>{const c=calcLine(x);a.directNet+=c.netTotal;a.lineBid+=c.bidTotal;return a},{directNet:0,lineBid:0});
  const overhead=base.directNet*Number(settings.overheadPct||0)/100,contingency=base.directNet*Number(settings.contingencyPct||0)/100,projectCost=base.directNet+overhead+contingency,beforeDiscount=base.lineBid+overhead+contingency,discount=beforeDiscount*Number(settings.discountPct||0)/100,bidExVat=Math.max(0,beforeDiscount-discount),vat=bidExVat*Number(settings.vatPct||0)/100,grandTotal=bidExVat+vat,profit=bidExVat-projectCost,margin=bidExVat?profit/bidExVat*100:0;
  return {...base,overhead,contingency,projectCost,beforeDiscount,discount,bidExVat,vat,grandTotal,profit,margin};
}
