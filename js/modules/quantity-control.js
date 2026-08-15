import {
  refs,arr,ts,logActivity,getProfile,can,esc,norm,money,fmtDate,fmtDateTime,
  loading,empty,badge,modal,toast,confirmBox
} from "../core.js?v=2.18.0";

let projectId="";
let mountEl=null;
let baseline=[];
let baselineMeta={};
let requests=[];
let audits=[];
let variations=[];
let revisions=[];
let tenderRevision=null;
let activeRevision=null;
let view="SUMMARY";
let q="";
let boqEditorDirty=false;

const COUNTED_STATUSES=new Set(["APPROVED","ORDERED"]);
const ORDER_STATUSES={
  DRAFT:["Nháp","gray"],
  PENDING:["Chờ duyệt","orange"],
  APPROVED:["Đã duyệt","green"],
  ORDERED:["Đã đặt hàng","purple"],
  CANCELLED:["Đã hủy","red"]
};
const REASONS=[
  ["DESIGN_CHANGE","Thay đổi thiết kế"],
  ["BOQ_MISSING","BOQ thiếu"],
  ["CLIENT_REQUEST","Khách hàng yêu cầu bổ sung"],
  ["SITE_CONDITION","Điều kiện thực tế công trường"],
  ["WASTE","Hao hụt thi công"],
  ["REWORK","Thi công sai / làm lại"],
  ["OTHER","Khác"]
];

export async function renderQuantityControl(el,selectedProjectId){
  mountEl=typeof el==="string"?document.querySelector(el):el;
  projectId=selectedProjectId||"";
  boqEditorDirty=false;
  if(!mountEl)return;
  mountEl.innerHTML=loading();
  await loadData();
  paint();
}

async function loadData(){
  if(!projectId){baseline=[];baselineMeta={};requests=[];audits=[];variations=[];revisions=[];tenderRevision=null;activeRevision=null;return}
  const reads=[
    refs.quantityBaselineProject(projectId).once("value"),
    refs.quantityBaselineMeta(projectId).once("value"),
    refs.orderRequestsProject(projectId).once("value"),
    refs.quantityAuditProject(projectId).once("value"),
    refs.quantityBoqRevisionsProject(projectId).once("value")
  ];
  if(can("quantityVariationCreate"))reads.push(refs.variationsProject(projectId).once("value"));
  else reads.push(Promise.resolve({val:()=>({})}));

  const [b,m,r,a,rev,v]=await Promise.all(reads);
  baseline=toArray(b.val()).sort(itemSort);
  baselineMeta=m.val()||{};
  requests=toArray(r.val()).sort((x,y)=>String(y.requestDate||"").localeCompare(String(x.requestDate||""))||(y.createdAt||0)-(x.createdAt||0));
  audits=toArray(a.val()).sort((x,y)=>(y.createdAt||0)-(x.createdAt||0));
  revisions=toArray(rev.val()).sort(revisionSort);
  variations=toArray(v.val());

  tenderRevision=revisions.find(x=>x.id===baselineMeta.tenderRevisionId)||revisions.find(x=>x.revisionNo===0)||null;
  activeRevision=revisions.find(x=>x.id===baselineMeta.activeRevisionId)||revisions.find(x=>x.status==="ACTIVE")||null;

  if(baseline.length&&!revisions.length&&can("quantityRevisionActivate")){
    await migrateLegacyBaselineToR0();
  }
}

function paint(){
  if(!mountEl)return;

  const rev=boqMirrorRevision();
  const grid=revisionSourceGridFrom(rev);

  mountEl.innerHTML=`
    <div class="boq-mirror-head">
      <div>
        <h2>BOQ dự án</h2>
        <p>Tải file BOQ lên và hiển thị nguyên bảng theo Sheet Excel. Không thêm cột quản lý, không đổi thứ tự hàng/cột.</p>
      </div>
      <div class="actions">
        ${can("quantityRevisionManage")||can("quantityRevisionActivate")?`
          <button class="btn primary" id="boqMirrorUploadBtn">${grid?"Thay / Nạp lại BOQ":"＋ Tải BOQ Excel / CSV"}</button>
        `:""}
      </div>
    </div>

    ${grid?`
      <div class="boq-mirror-filebar">
        <div>
          <b>${esc(rev?.sourceFileName||"BOQ")}</b>
          <span>Sheet: ${esc(grid.sheetName||rev?.sourceSheetName||"—")} · ${Number(grid.rowCount||0)} hàng × ${Number(grid.colCount||0)} cột</span>
        </div>
        <div>${badge("BOQ GỐC","blue")}</div>
      </div>
      ${sourceExcelGridHtml(grid)}
    `:`
      <div class="boq-mirror-empty">
        ${empty(
          "Chưa có BOQ",
          "Tải file Excel/CSV lên. Hệ thống sẽ tạo lại nguyên bảng theo Sheet anh chọn trước, chưa thêm các cột quản lý khác.",
          "▦"
        )}
        ${can("quantityRevisionManage")||can("quantityRevisionActivate")?`
          <button class="btn primary" id="boqMirrorUploadEmptyBtn">＋ Tải BOQ Excel / CSV</button>
        `:""}
      </div>
    `}
  `;

  mountEl.querySelector("#boqMirrorUploadBtn")?.addEventListener("click",uploadBoqMirrorDialog);
  mountEl.querySelector("#boqMirrorUploadEmptyBtn")?.addEventListener("click",uploadBoqMirrorDialog);
  if(grid)bindExcelBoqGrid(grid,rev);
}

function boqMirrorRevision(){
  const withGrid=revisions.filter(r=>r?.sourceGrid);
  if(activeRevision?.sourceGrid)return activeRevision;
  if(withGrid.length)return [...withGrid].sort((a,b)=>(b.sourceGridUpdatedAt||b.updatedAt||b.createdAt||0)-(a.sourceGridUpdatedAt||a.updatedAt||a.createdAt||0))[0];
  if(activeRevision)return activeRevision;
  if(revisions.length)return revisions[0];
  return null;
}

function revisionSourceGridFrom(rev){
  const g=rev?.sourceGrid;
  if(!g)return null;
  return prepareBoqGridV217({
    ...g,
    rows:normalizeIndexedArray(g.rows).map(r=>normalizeIndexedArray(r)),
    colWidths:normalizeIndexedArray(g.colWidths),
    rowHeights:normalizeIndexedArray(g.rowHeights),
    merges:normalizeIndexedArray(g.merges),
    rowGroups:normalizeIndexedArray(g.rowGroups).filter(Boolean),
    colGroups:normalizeIndexedArray(g.colGroups).filter(Boolean),
    styles:g.styles||{}
  });
}

function uploadBoqMirrorDialog(){
  if(!(can("quantityRevisionManage")||can("quantityRevisionActivate")))return;

  const current=boqMirrorRevision();

  modal({
    title:current?.sourceGrid?"Thay / nạp lại BOQ":"Tải BOQ dự án",
    eyebrow:"BOQ GỐC",
    size:"lg",
    submitText:"Tạo bảng BOQ",
    body:`<div class="revision-upload-note">
      <b>Chức năng này chỉ tạo bảng BOQ giống file upload.</b>
      Chọn đúng file và đúng Sheet. Hệ thống không thêm Tender/Baseline/Đã đặt/Vượt... vào bảng này.
    </div>

    <div class="form-grid mt">
      <label class="field span2"><span>File BOQ Excel / CSV *</span>
        <input required type="file" name="boqFile" id="boqMirrorFile"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv">
        <small>Hỗ trợ .xlsx, .xls và .csv</small>
      </label>

      <label class="field span2 hidden" id="boqMirrorSheetWrap"><span>Sheet cần tạo bảng *</span>
        <select name="boqSheet" id="boqMirrorSheet"></select>
        <small>Nếu file có nhiều Sheet, chọn đúng Sheet BOQ cần hiển thị.</small>
      </label>

      <div class="span2 hidden revision-file-preview" id="boqMirrorPreview"></div>
    </div>`,
    onSubmit:async fd=>{
      try{
        const file=fd.get("boqFile");
        if(!(file instanceof File)||!file.size){
          toast("Vui lòng chọn file Excel hoặc CSV.","error");
          return false;
        }

        const input=document.querySelector("#boqMirrorFile");
        const inspection=input?._boqInspection||await inspectRevisionSpreadsheet(file);
        const selected=String(fd.get("boqSheet")||inspection.defaultSheet||"");
        const meta=inspection.sheets?.[selected]||inspection.sheets?.[inspection.defaultSheet];
        if(!meta?.sourceGrid){
          toast("Không đọc được Sheet đã chọn.","error");
          return false;
        }

        const grid=prepareBoqGridV217({...meta.sourceGrid,sheetName:selected});
        const now=Date.now();
        const u=getProfile()||{};
        let revisionId=current?.id||"";

        if(revisionId){
          await refs.quantityBoqRevision(projectId,revisionId).update({
            sourceGrid:grid,
            sourceFileName:file.name,
            sourceSheetName:selected,
            sourceHeaderRow:Number(meta.headerRow||0),
            sourceHeaderDepth:Number(meta.headerDepth||1),
            sourceGridUpdatedAt:now,
            updatedAt:now
          });
        }else{
          revisionId=refs.quantityBoqRevisionsProject(projectId).push().key;
          await refs.quantityBoqRevision(projectId,revisionId).set({
            code:"R0",
            revisionNo:0,
            name:"BOQ gốc",
            type:"TENDER",
            status:"ACTIVE",
            source:"BOQ_MIRROR",
            sourceFileName:file.name,
            sourceSheetName:selected,
            sourceHeaderRow:Number(meta.headerRow||0),
            sourceHeaderDepth:Number(meta.headerDepth||1),
            sourceGrid:grid,
            lineCount:0,
            totalBidValue:0,
            createdAt:now,
            updatedAt:now,
            createdByUid:u.uid||"",
            createdByName:u.displayName||u.email||""
          });
        }

        try{
          await audit(
            current?.sourceGrid?"BOQ_MIRROR_RELOADED":"BOQ_MIRROR_CREATED",
            `${current?.sourceGrid?"Nạp lại":"Tạo"} BOQ gốc từ ${file.name} / ${selected} · ${grid.rowCount} hàng × ${grid.colCount} cột`,
            {revisionId,fileName:file.name,sheetName:selected,rowCount:grid.rowCount,colCount:grid.colCount}
          );
        }catch(auditError){
          console.warn("Không ghi được audit BOQ:",auditError);
        }

        toast(`Đã tạo bảng BOQ: ${grid.rowCount} hàng × ${grid.colCount} cột.`);
        await reload();
        paint();
        return true;
      }catch(e){
        console.error(e);
        toast(e.message||"Không thể tạo bảng BOQ.","error");
        return false;
      }
    }
  });

  const input=document.querySelector("#boqMirrorFile");
  const sheetWrap=document.querySelector("#boqMirrorSheetWrap");
  const sheet=document.querySelector("#boqMirrorSheet");
  const preview=document.querySelector("#boqMirrorPreview");

  input?.addEventListener("change",async()=>{
    const file=input.files?.[0];
    if(!file)return;
    try{
      const inspection=await inspectRevisionSpreadsheet(file);
      input._boqInspection=inspection;

      if(inspection.kind==="EXCEL"){
        sheetWrap?.classList.remove("hidden");
        if(sheet)sheet.innerHTML=Object.keys(inspection.sheets).map(name=>{
          const g=inspection.sheets[name]?.sourceGrid;
          return `<option value="${esc(name)}" ${name===inspection.defaultSheet?"selected":""}>${esc(name)}${g?` · ${g.rowCount}×${g.colCount}`:""}</option>`;
        }).join("");
      }else{
        sheetWrap?.classList.add("hidden");
        if(sheet)sheet.innerHTML=`<option value="CSV">CSV</option>`;
      }

      showBoqMirrorPreview(inspection,sheet?.value||inspection.defaultSheet,preview);
    }catch(e){
      console.error(e);
      toast(e.message||"Không thể đọc file.","error");
    }
  });

  sheet?.addEventListener("change",()=>{
    const inspection=input?._boqInspection;
    if(inspection)showBoqMirrorPreview(inspection,sheet.value,preview);
  });
}

function showBoqMirrorPreview(inspection,sheetName,box){
  if(!box)return;
  const meta=inspection.sheets?.[sheetName]||inspection.sheets?.[inspection.defaultSheet];
  const raw=meta?.sourceGrid;
  if(!raw)return;
  const g=prepareBoqGridV217({...raw,sheetName});
  box.classList.remove("hidden");
  box.innerHTML=`<div class="revision-file-preview-head">
    <div>
      <b>${esc(inspection.fileName)}</b>
      <span>Sheet: ${esc(sheetName)} · ${g.rowCount} hàng × ${g.colCount} cột · trên web giữ ${esc(g.range||"")} (tối đa A→K)</span>
    </div>
    ${badge("Sẵn sàng tạo bảng","green")}
  </div>`;
}

function baselineEmptyHtml(){
  return `<div class="quantity-empty">
    ${empty("Chưa có BOQ Baseline","Cần tạo R0 từ BOQ trúng thầu trước. Sau đó mới tải R1/R2/R3 và chọn Revision áp dụng.","▦")}
    ${can("quantityBaselineCreate")?`<div class="baseline-empty-actions">
      <button class="btn primary" id="initQuantityBaselineBtn">Khởi tạo R0 từ BOQ hiện tại</button>
      <button class="btn" id="uploadTenderR0Btn">Tải BOQ R0 từ CSV</button>
      <div class="secondary-text">R0 là BOQ đấu thầu/trúng thầu gốc và được giữ vĩnh viễn để so sánh.</div>
    </div>`:""}
  </div>`;
}

function summaryHtml(rows){
  return `<div class="qty-info-strip">
    <b>Tách 2 loại chênh:</b> Δ HĐ = Baseline Revision hiện hành − Tender R0. 
    Vượt công trường = Tổng phiếu đã duyệt/đặt − Baseline hiện hành. Hai số này không cộng lẫn nhau.
    ${revisionDisplayRows().length?` Cấu trúc hệ thống/khu vực/ghi chú từ Excel cũng được giữ lại.`:""}
  </div>
  <div class="table-wrap"><table class="table quantity-summary-table"><thead><tr>
    <th>MÃ BOQ</th><th>HỆ</th><th>VẬT TƯ / CÔNG VIỆC</th><th>ĐVT</th>
    <th>TENDER R0</th><th>BASELINE ${esc(activeRevision?.code||"HIỆN HÀNH")}</th><th>Δ HĐ</th>
    <th>ĐÃ DUYỆT/ĐẶT</th><th>CHỜ DUYỆT</th><th>CÒN LẠI</th><th>VƯỢT CT</th>
    <th>% SỬ DỤNG</th><th>GIÁ HĐ/ĐVT</th><th>GT Δ HĐ</th><th>GT VƯỢT CT</th>
    <th>CHI PHÍ VƯỢT</th><th>TRẠNG THÁI</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${rows.length?structuredSummaryBody(rows):`<tr><td colspan="18">${empty("Không có dữ liệu","Không có đầu mục phù hợp bộ lọc.","▦")}</td></tr>`}
  </tbody></table></div>`;
}

function structuredSummaryBody(rows){
  const structure=revisionDisplayRows();
  if(q||!structure.length)return rows.map(summaryRow).join("");

  const rowMap=new Map(rows.filter(r=>!r.isOutside).map(r=>[r.key,r]));
  const used=new Set();
  const html=[];

  structure.forEach(sr=>{
    if(sr.rowType==="ITEM"){
      const r=rowMap.get(sr.stableItemId);
      if(r){html.push(summaryRow(r));used.add(r.key)}
      return;
    }
    html.push(structureSummaryRow(sr));
  });

  const removed=rows.filter(r=>!r.isOutside&&!used.has(r.key));
  if(removed.length){
    html.push(`<tr class="qty-structure-section removed"><td colspan="18"><b>ĐẦU MỤC KHÔNG CÒN TRONG REVISION HIỆN HÀNH</b></td></tr>`);
    removed.forEach(r=>html.push(summaryRow(r)));
  }

  const outside=rows.filter(r=>r.isOutside);
  if(outside.length){
    html.push(`<tr class="qty-structure-section outside"><td colspan="18"><b>PHÁT SINH NGOÀI BOQ</b></td></tr>`);
    outside.forEach(r=>html.push(summaryRow(r)));
  }
  return html.join("");
}

function structureSummaryRow(sr){
  const level=structureLevel(sr.itemNo);
  if(sr.rowType==="SECTION"){
    return `<tr class="qty-structure-section level-${level}"><td><b>${esc(sr.itemNo||"")}</b></td><td colspan="17"><b>${esc(sr.description||"")}</b></td></tr>`;
  }
  if(sr.rowType==="NOTE_HEADER"){
    return `<tr class="qty-structure-note-header"><td></td><td colspan="17"><b>${esc(sr.description||"GHI CHÚ CHUNG")}</b></td></tr>`;
  }
  return `<tr class="qty-structure-note"><td>${esc(sr.itemNo||"")}</td><td></td><td colspan="15">${esc(sr.description||"")}</td><td>${sr.sourceRow?`<span class="secondary-text">Dòng ${sr.sourceRow}</span>`:""}</td></tr>`;
}

function structureLevel(itemNo){
  const no=String(itemNo||"").trim();
  if(!no)return 1;
  return Math.min(4,Math.max(1,no.split(".").filter(Boolean).length));
}

function summaryRow(r){
  const state=rowState(r);
  const remaining=r.baselineQty-r.confirmedQty;
  const siteExcess=Math.max(0,r.confirmedQty-r.baselineQty);
  const contractClass=r.contractDeltaQty>0?"danger-text":r.contractDeltaQty<0?"positive-text":"";
  return `<tr class="qty-row-${state.key.toLowerCase()}">
    <td><b>${esc(r.itemNo||"—")}</b>${r.lineStatus==="REMOVED"?`<div>${badge("Loại khỏi Revision","red")}</div>`:""}</td>
    <td>${badge(r.discipline||"KHÁC","gray")}</td>
    <td><div class="primary-text">${esc(r.description||"—")}</div><div class="secondary-text">${esc(r.specification||"")}</div></td>
    <td>${esc(r.unit||"—")}</td>
    <td>${num(r.tenderQty,3)}</td>
    <td><b>${num(r.baselineQty,3)}</b></td>
    <td class="${contractClass}"><b>${signedQty(r.contractDeltaQty)}</b></td>
    <td><b>${num(r.confirmedQty,3)}</b></td>
    <td>${r.pendingQty?`<span class="qty-pending">${num(r.pendingQty,3)}</span>`:"0"}</td>
    <td class="${remaining<0?"danger-text":""}">${num(remaining,3)}</td>
    <td class="${siteExcess>0?"danger-text":""}"><b>${siteExcess?`+${num(siteExcess,3)}`:"0"}</b></td>
    <td>${usageHtml(r)}</td>
    <td>${money(r.bidUnit)}</td>
    <td class="${r.contractDeltaValue>0?"danger-text":r.contractDeltaValue<0?"positive-text":""}"><b>${signedMoney(r.contractDeltaValue)}</b></td>
    <td class="${r.excessBidValue>0?"danger-text":""}"><b>${money(r.excessBidValue)}</b></td>
    <td class="${r.excessCost>0?"danger-text":""}"><b>${money(r.excessCost)}</b></td>
    <td>${badge(state.label,state.color)}</td>
    <td><div class="row-actions">
      <button class="btn sm" data-qty-history="${esc(r.key)}">Lịch sử</button>
      ${r.excessBidValue>0&&can("quantityVariationCreate")?`<button class="btn orange sm" data-qty-vo="${esc(r.key)}">Tạo VO</button>`:""}
    </div></td>
  </tr>`;
}

function usageHtml(r){
  const pctVal=r.baselineQty>0?r.confirmedQty/r.baselineQty*100:(r.confirmedQty>0?100:0);
  const cls=pctVal>100?"bar-danger":pctVal>=90?"bar-warning":"";
  return `<div class="qty-usage"><div><span>${num(pctVal,1)}%</span></div><div class="progress"><div class="bar ${cls}" style="width:${Math.min(100,pctVal)}%"></div></div></div>`;
}

function sourceBoqHtml(){
  const grid=revisionSourceGrid();
  const structure=revisionDisplayRows();

  if(grid?.rows?.length){
    return `<div class="page-head" style="margin-bottom:10px">
      <div>
        <h2 style="font-size:17px">BOQ gốc · ${esc(activeRevision?.code||"R0")}</h2>
        <p>Hiển thị trực tiếp theo Sheet đã upload: giữ hàng, cột, ô gộp, thứ tự, độ rộng cột và chiều cao dòng. Cuộn ngang để xem toàn bộ bảng.</p>
      </div>
      <div class="row-actions">
        ${badge(esc(grid.sheetName||activeRevision?.sourceSheetName||"Sheet"),"blue")}
        ${badge(`${grid.rowCount||grid.rows.length} hàng × ${grid.colCount||0} cột`,"gray")}
        ${can("quantityRevisionActivate")?`<button class="btn sm" id="refreshBoqStructureBtn">Nạp lại BOQ gốc</button>`:""}
      </div>
    </div>
    ${sourceExcelGridHtml(grid)}`;
  }

  if(!structure.length){
    return `<div class="card"><div class="card-body">
      ${empty(
        "Revision này chưa lưu bảng BOQ gốc",
        "Revision được tạo ở phiên bản cũ. Hãy nạp lại đúng file Excel/CSV để tạo lại nguyên hàng và cột của BOQ mà không thay đổi Baseline.",
        "▦"
      )}
      ${can("quantityRevisionActivate")?`<div style="text-align:center;margin-top:12px"><button class="btn primary" id="refreshBoqStructureBtn">Tải lại BOQ gốc từ Excel / CSV</button></div>`:""}
    </div></div>`;
  }

  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">BOQ gốc · ${esc(activeRevision?.code||"R0")}</h2><p>Revision cũ chưa có bản sao toàn Sheet. Đang hiển thị dữ liệu cấu trúc tạm thời.</p></div>
    ${can("quantityRevisionActivate")?`<button class="btn primary" id="refreshBoqStructureBtn">Tải lại BOQ gốc</button>`:""}
  </div>
  ${sourceMappedTableHtml(structure)}`;
}

function revisionSourceGrid(){
  const g=activeRevision?.sourceGrid;
  if(!g)return null;
  return {
    ...g,
    rows:normalizeIndexedArray(g.rows).map(r=>normalizeIndexedArray(r)),
    colWidths:normalizeIndexedArray(g.colWidths),
    rowHeights:normalizeIndexedArray(g.rowHeights),
    merges:normalizeIndexedArray(g.merges),
    styles:g.styles||{}
  };
}

function prepareBoqGridV217(input){
  const g={...input};
  g.rows=normalizeIndexedArray(g.rows).map(r=>normalizeIndexedArray(r));
  g.colWidths=normalizeIndexedArray(g.colWidths);
  g.rowHeights=normalizeIndexedArray(g.rowHeights);
  g.merges=normalizeIndexedArray(g.merges).filter(Boolean);
  g.rowGroups=normalizeIndexedArray(g.rowGroups).filter(Boolean);
  g.colGroups=normalizeIndexedArray(g.colGroups).filter(Boolean);
  g.styles=g.styles||{};

  const startCol=Math.max(0,Number(g.startCol||0));
  const currentCount=Math.max(0,Number(g.colCount||Math.max(0,...g.rows.map(r=>r.length))));
  // Yêu cầu V2.17: bỏ cột L trở đi, chỉ giữ tối đa A:K.
  const keepCount=Math.max(0,Math.min(currentCount,11-startCol));

  if(currentCount>keepCount){
    g.rows=g.rows.map(r=>r.slice(0,keepCount));
    g.colWidths=g.colWidths.slice(0,keepCount);

    const styles={};
    Object.entries(g.styles||{}).forEach(([key,val])=>{
      const m=key.match(/^(\d+)_(\d+)$/);
      if(!m){styles[key]=val;return}
      if(Number(m[2])<keepCount)styles[key]=val;
    });
    g.styles=styles;

    g.merges=g.merges
      .filter(m=>Number(m.c1)<keepCount)
      .map(m=>({...m,c2:Math.min(Number(m.c2),keepCount-1)}))
      .filter(m=>Number(m.c2)>=Number(m.c1));

    g.colGroups=g.colGroups
      .filter(x=>Number(x.start)<keepCount)
      .map(x=>({...x,end:Math.min(Number(x.end),keepCount-1)}))
      .filter(x=>Number(x.end)>Number(x.start));

    g.colCount=keepCount;
    g.range=boqGridRange(g);
  }else{
    g.colCount=currentCount;
  }

  return g;
}

function boqVisualMeta(grid,rev){
  const expanded=expandBoqGridForDetection(grid);
  let headerStart=-1,headerDepth=1;

  const savedHeader=Number(rev?.sourceHeaderRow||0);
  if(savedHeader>0){
    const candidate=savedHeader-Number(grid.startRow||1);
    if(candidate>=0&&candidate<Number(grid.rowCount||0)){
      headerStart=candidate;
      headerDepth=Math.min(3,Math.max(1,Number(rev?.sourceHeaderDepth||1)));
    }
  }

  if(headerStart<0){
    try{
      const d=detectRevisionHeader(expanded);
      headerStart=Math.max(0,Number(d?.headerRow||1)-1);
      headerDepth=Math.min(3,Math.max(1,Number(d?.headerDepth||1)));
    }catch{
      headerStart=0;headerDepth=1;
    }
  }

  // Không để nhận nhầm hàng mã phụ/filter như 0.2/1, T1/1... làm tầng tiêu đề.
  while(headerDepth>1){
    const last=expanded[headerStart+headerDepth-1]||[];
    const labels=last.filter(x=>String(x??"").trim()!=="");
    const numeric=labels.filter(isRevisionNumeric).length;
    const keywordScore=boqHeaderKeywordScore(last);
    if(keywordScore>0&&labels.length&&numeric<labels.length/2)break;
    headerDepth--;
  }

  const titleRows=new Set();
  const noteHeaderRows=new Set();
  (grid.rows||[]).forEach((row,r)=>{
    const text=norm(row.map(x=>String(x??"")).join(" "));
    if(text.includes("bang khoi luong cong viec"))titleRows.add(r);
    if(text.includes("ghi chu chung"))noteHeaderRows.add(r);
  });

  return {
    headerStart,
    headerDepth,
    headerEnd:headerStart+headerDepth-1,
    titleRows,
    noteHeaderRows,
    expanded
  };
}

function boqHeaderKeywordScore(row){
  const t=norm((row||[]).map(x=>String(x??"")).join(" "));
  const words=[
    "muc","stt","dien giai","mo ta","don vi","khoi luong","model","thong so",
    "nhan hieu","xuat xu","don gia","vat tu chinh","nhan cong","tong cong",
    "thanh tien","ghi chu"
  ];
  return words.reduce((n,w)=>n+(t.includes(w)?1:0),0);
}

function expandBoqGridForDetection(grid){
  const rows=(grid.rows||[]).map(r=>[...r]);
  (grid.merges||[]).forEach(m=>{
    const r1=Number(m.r1),c1=Number(m.c1),r2=Number(m.r2),c2=Number(m.c2);
    if(![r1,c1,r2,c2].every(Number.isFinite))return;
    const value=rows[r1]?.[c1];
    if(value===undefined||value===null||String(value).trim()==="")return;
    for(let r=r1;r<=r2;r++){
      if(!rows[r])rows[r]=[];
      for(let c=c1;c<=c2;c++){
        if(rows[r][c]===undefined||rows[r][c]===null||String(rows[r][c]).trim()==="")rows[r][c]=value;
      }
    }
  });
  return rows;
}

function boqRowVisual(grid,r,meta){
  const row=grid.rows?.[r]||[];
  const nonEmpty=row.map((v,c)=>({v:String(v??"").trim(),c})).filter(x=>x.v!=="");
  const fullText=nonEmpty.map(x=>x.v).join(" ");

  if(meta.titleRows.has(r))return {kind:"title",level:0};
  if(r===meta.headerStart)return {kind:"header-main",level:0};
  if(r>meta.headerStart&&r<=meta.headerEnd)return {kind:"header-sub",level:0};
  if(meta.noteHeaderRows.has(r))return {kind:"note-header",level:0};

  const unitText=norm(nonEmpty.map(x=>x.v).join(" "));
  if(/\bnote\b/.test(unitText))return {kind:"note",level:0};

  const codeCell=nonEmpty.find(x=>/^\d+(?:\.\d+)+$/.test(x.v));
  if(codeCell){
    const code=codeCell.v;
    const parts=code.split(".");
    const last=parts[parts.length-1]||"";
    const desc=nonEmpty.find(x=>x.c>codeCell.c)?.v||"";
    const hasUnitOrQty=row.some((v,c)=>{
      if(c<=codeCell.c+1)return false;
      const t=String(v??"").trim();
      return t!==""&&(isRevisionNumeric(t)||/^(bo|bộ|m|m2|m²|m3|m³|cai|cái|tu|tủ|set|lot)$/i.test(norm(t)));
    });

    if(last==="0"&&!hasUnitOrQty)return {kind:"section",level:1};
    if(last.length<=1&&!hasUnitOrQty)return {kind:"section",level:Math.min(3,parts.length)};
    if(desc&&isMostlyUpper(desc)&&!hasUnitOrQty)return {kind:"section",level:1};
  }

  if(nonEmpty.length<=3){
    const desc=nonEmpty.map(x=>x.v).sort((a,b)=>b.length-a.length)[0]||"";
    if(desc.length>8&&isMostlyUpper(desc))return {kind:"section",level:1};
  }

  return {kind:"detail",level:0};
}

function isMostlyUpper(text){
  const letters=String(text||"").replace(/[^A-Za-zÀ-ỹĐđ]/g,"");
  if(letters.length<5)return false;
  const upper=String(text||"").replace(/[^A-ZÀ-ỸĐ]/g,"");
  return upper.length/letters.length>=0.72;
}

function boqRowClass(v){
  if(v.kind==="section")return `boq-section-row level-${v.level}`;
  return `boq-${v.kind}-row`;
}

function boqColumnRole(c,meta){
  const parts=[];
  for(let r=meta.headerStart;r<=meta.headerEnd;r++){
    const t=String(meta.expanded?.[r]?.[c]??"").trim();
    if(t&&!parts.some(x=>norm(x)===norm(t)))parts.push(t);
  }
  const h=norm(parts.join(" "));
  if(/\bmuc\b|\bstt\b|\bcode\b/.test(h))return "code";
  if(h.includes("dien giai")||h.includes("mo ta")||h.includes("noi dung"))return "description";
  if(h.includes("don vi")||h==="dvt")return "unit";
  if(h.includes("khoi luong")||h.startsWith("kl "))return "quantity";
  if(h.includes("model")||h.includes("thong so")||h.includes("quy cach"))return "spec";
  if(h.includes("nhan hieu")||h.includes("thuong hieu"))return "brand";
  if(h.includes("xuat xu"))return "origin";
  if(h.includes("don gia")||h.includes("vat tu chinh")||h.includes("nhan cong")||h.includes("tong cong"))return "price";
  return "generic";
}

function boqSmartColumnWidth(grid,c,meta){
  const headerParts=[];
  for(let r=meta.headerStart;r<=meta.headerEnd;r++){
    const t=String(meta.expanded?.[r]?.[c]??"").trim();
    if(t&&!headerParts.some(x=>norm(x)===norm(t)))headerParts.push(t);
  }
  const header=norm(headerParts.join(" "));
  if(/\bmuc\b|\bstt\b|\bcode\b/.test(header))return 82;
  if(header.includes("dien giai")||header.includes("mo ta")||header.includes("noi dung"))return 320;
  if(header.includes("don vi")||header==="dvt")return 72;
  if(header.includes("khoi luong"))return 88;
  if(header.includes("kl tuan")||header.startsWith("kl "))return 105;
  if(header.includes("model")||header.includes("thong so")||header.includes("quy cach"))return 190;
  if(header.includes("nhan hieu")||header.includes("thuong hieu"))return 100;
  if(header.includes("xuat xu"))return 90;
  if(header.includes("don gia")||header.includes("vat tu chinh")||header.includes("nhan cong")||header.includes("tong cong"))return 110;

  let max=58;
  const mergeInfo=buildGridMergeLookup(grid.merges||[]);
  const limit=Math.min(Number(grid.rowCount||0),450);
  for(let r=0;r<limit;r++){
    if(meta.titleRows.has(r)||r>=meta.headerStart&&r<=meta.headerEnd)continue;
    const key=`${r}_${c}`;
    if(mergeInfo.covered.has(key))continue;
    const merge=mergeInfo.starts.get(key);
    if(merge&&Number(merge.c2)>Number(merge.c1))continue;
    const text=String(grid.rows?.[r]?.[c]??"").trim();
    if(!text)continue;
    const sample=text.length>80?text.slice(0,80):text;
    max=Math.max(max,measureBoqText(sample,false,10)+20);
  }
  return Math.max(60,Math.min(250,Math.ceil(max)));
}

function boqProfessionalRowHeight(grid,r,visual){
  const original=gridRowHeight(grid.rowHeights?.[r]);
  if(visual.kind==="title")return Math.max(original,34);
  if(visual.kind==="header-main")return Math.max(original,42);
  if(visual.kind==="header-sub")return Math.max(original,36);
  if(visual.kind==="section")return Math.max(original,30);
  if(visual.kind==="note-header")return Math.max(original,28);
  if(visual.kind==="note"){
    const len=(grid.rows?.[r]||[]).reduce((n,x)=>n+String(x??"").length,0);
    return Math.max(original,len>110?48:36);
  }
  return Math.max(original,25);
}

function sourceExcelGridHtml(grid,rev=boqMirrorRevision()){
  const rows=grid.rows||[];
  const colCount=Number(grid.colCount||Math.max(0,...rows.map(r=>r.length)));
  const rowCount=Number(grid.rowCount||rows.length);
  const startRow=Number(grid.startRow||1);
  const startCol=Number(grid.startCol||0);
  const mergeInfo=buildGridMergeLookup(grid.merges||[]);
  const widths=grid.colWidths||[];
  const heights=grid.rowHeights||[];
  const prefs=loadBoqGridPrefs(grid,rev);
  const customWidths=prefs.widths||{};
  const zoom=clampBoqZoom(Number(prefs.zoom||1));
  const visualMeta=boqVisualMeta(grid,rev);
  const hiddenRows=boqCollapsedIndexes(grid.rowGroups||[]);
  const hiddenCols=boqCollapsedIndexes(grid.colGroups||[]);
  const rowGroupStarts=boqGroupStartMap(grid.rowGroups||[]);
  const colGroupStarts=boqGroupStartMap(grid.colGroups||[]);

  const colgroup=`<colgroup><col class="excel-row-number-col" style="width:48px">`+
    Array.from({length:colCount},(_,c)=>{
      const width=hiddenCols.has(c)?0:(Number(customWidths[c]||customWidths[String(c)]||0)||boqSmartColumnWidth(grid,c,visualMeta));
      return `<col data-boq-col="${c}" style="width:${Math.round(width)}px"${hiddenCols.has(c)?' class="boq-hidden-col"':""}>`;
    }).join("")+
    `</colgroup>`;

  const letters=`<tr class="excel-col-head"><th class="excel-corner"></th>`+
    Array.from({length:colCount},(_,c)=>{
      const grp=colGroupStarts.get(c);
      return `
      <th class="excel-column-header${hiddenCols.has(c)?" boq-hidden-col":""}" data-col-index="${c}">
        ${grp?`<button type="button" class="excel-group-toggle col" data-col-group="${c}" title="Thu gọn / mở rộng nhóm cột">${grp.collapsed?"+":"−"}</button>`:""}
        <span class="excel-col-label">${excelColumnName(startCol+c)}</span>
        <span class="excel-col-resizer" data-resize-col="${c}" title="Kéo để đổi độ rộng · Nhấp đúp để AutoFit"></span>
      </th>`;
    }).join("")+
    `</tr>`;

  const body=Array.from({length:rowCount},(_,r)=>{
    const row=rows[r]||[];
    const visual=boqRowVisual(grid,r,visualMeta);
    const rowHeight=boqProfessionalRowHeight(grid,r,visual);
    const rowClass=boqRowClass(visual);
    const rg=rowGroupStarts.get(r);
    let cells=`<th class="excel-row-head ${rowClass}" data-row-index="${r}">
      ${rg?`<button type="button" class="excel-group-toggle row" data-row-group="${r}" title="Thu gọn / mở rộng nhóm hàng">${rg.collapsed?"+":"−"}</button>`:""}
      <span>${startRow+r}</span>
    </th>`;

    for(let c=0;c<colCount;c++){
      const key=`${r}_${c}`;
      if(mergeInfo.covered.has(key))continue;

      const merge=mergeInfo.starts.get(key);
      const rowspan=merge?merge.r2-merge.r1+1:1;
      const colspan=merge?merge.c2-merge.c1+1:1;
      const value=row[c]??"";
      const style=sourceGridCellStyle(grid.styles?.[key]);
      const colRole=boqColumnRole(c,visualMeta);
      const cellClasses=[rowClass,`boq-col-${colRole}`,hiddenCols.has(c)?"boq-hidden-col-cell":""].filter(Boolean).join(" ");
      cells+=`<td data-grid-row="${r}" data-grid-col="${c}" class="${cellClasses}"${rowspan>1?` rowspan="${rowspan}"`:""}${colspan>1?` colspan="${colspan}"`:""}${style?` style="${style}"`:""}>${formatGridCell(value)}</td>`;
    }
    return `<tr data-grid-row-wrap="${r}" class="${hiddenRows.has(r)?"boq-hidden-row ":""}${rowClass}" style="height:${rowHeight}px">${cells}</tr>`;
  }).join("");

  const canEdit=can("quantityRevisionManage")||can("quantityRevisionActivate");

  return `<div class="excel-boq-shell" data-boq-pref-key="${esc(boqGridPreferenceKey(grid,rev))}">
    <div class="boq-ribbon">
      <div class="boq-ribbon-tabs">
        <button type="button" class="boq-ribbon-tab active" data-ribbon-tab="home">TRANG CHỦ</button>
        <button type="button" class="boq-ribbon-tab" data-ribbon-tab="insert">CHÈN</button>
        <button type="button" class="boq-ribbon-tab" data-ribbon-tab="view">HIỂN THỊ</button>
        <button type="button" class="boq-ribbon-tab" data-ribbon-tab="data">DỮ LIỆU</button>
        <div class="boq-ribbon-spacer"></div>
        <span class="boq-save-state ${boqEditorDirty?"dirty":"saved"}" data-boq-save-state>${boqEditorDirty?"● Chưa lưu":"✓ Đã lưu"}</span>
        ${canEdit?`<button type="button" class="btn primary sm" data-boq-action="save-grid">Lưu thay đổi</button>`:""}
      </div>

      <div class="boq-ribbon-panel active" data-ribbon-panel="home">
        <div class="boq-ribbon-group">
          <div class="boq-ribbon-controls">
            <select class="boq-font-select" data-boq-font-family title="Font chữ">
              ${["Arial","Calibri","Times New Roman","Tahoma","Verdana"].map(f=>`<option value="${f}">${f}</option>`).join("")}
            </select>
            <select class="boq-size-select" data-boq-font-size title="Cỡ chữ">
              ${[8,9,10,11,12,14,16,18,20,24].map(n=>`<option value="${n}" ${n===10?"selected":""}>${n}</option>`).join("")}
            </select>
            <button type="button" class="excel-format-btn bold" data-boq-format="bold" title="In đậm">B</button>
            <button type="button" class="excel-format-btn italic" data-boq-format="italic" title="In nghiêng">I</button>
          </div>
          <span class="boq-ribbon-label">Font</span>
        </div>

        <div class="boq-ribbon-group">
          <div class="boq-ribbon-controls">
            <button type="button" class="excel-format-btn" data-boq-align="left" title="Căn trái">≡</button>
            <button type="button" class="excel-format-btn center" data-boq-align="center" title="Căn giữa">≡</button>
            <button type="button" class="excel-format-btn right" data-boq-align="right" title="Căn phải">≡</button>
            <button type="button" class="excel-tool-text" data-boq-format="wrap">Xuống dòng</button>
          </div>
          <span class="boq-ribbon-label">Căn chỉnh</span>
        </div>

        <div class="boq-ribbon-group">
          <div class="boq-ribbon-controls">
            <button type="button" class="excel-tool-text" data-boq-action="reset-widths">Khôi phục độ rộng</button>
          </div>
          <span class="boq-ribbon-label">Cột</span>
        </div>
      </div>

      <div class="boq-ribbon-panel" data-ribbon-panel="insert">
        <div class="boq-ribbon-group">
          <div class="boq-ribbon-controls">
            <button type="button" class="excel-tool-text" data-boq-action="insert-row-above">＋ Hàng phía trên</button>
            <button type="button" class="excel-tool-text" data-boq-action="insert-row-below">＋ Hàng phía dưới</button>
          </div>
          <span class="boq-ribbon-label">Hàng</span>
        </div>
        <div class="boq-ribbon-group">
          <div class="boq-ribbon-controls">
            <button type="button" class="excel-tool-text" data-boq-action="insert-col-left">＋ Cột bên trái</button>
            <button type="button" class="excel-tool-text" data-boq-action="insert-col-right">＋ Cột bên phải</button>
          </div>
          <span class="boq-ribbon-label">Cột</span>
        </div>
      </div>

      <div class="boq-ribbon-panel" data-ribbon-panel="view">
        <div class="boq-ribbon-group">
          <div class="boq-ribbon-controls">
            <button type="button" class="excel-tool-text" data-boq-action="freeze-selection">Cố định tại ô chọn</button>
            <button type="button" class="excel-tool-text" data-boq-action="freeze-top-row">Cố định hàng đầu</button>
            <button type="button" class="excel-tool-text" data-boq-action="freeze-first-col">Cố định cột đầu</button>
            <button type="button" class="excel-tool-text" data-boq-action="unfreeze">Bỏ cố định</button>
          </div>
          <span class="boq-ribbon-label">Cố định</span>
        </div>

        <div class="boq-ribbon-group">
          <div class="boq-ribbon-controls">
            <button type="button" class="excel-tool-btn" data-boq-action="zoom-out">−</button>
            <button type="button" class="excel-zoom-value" data-boq-action="zoom-100">${Math.round(zoom*100)}%</button>
            <button type="button" class="excel-tool-btn" data-boq-action="zoom-in">＋</button>
            <button type="button" class="excel-tool-text" data-boq-action="fit-width">Vừa màn hình</button>
          </div>
          <span class="boq-ribbon-label">Thu phóng</span>
        </div>
      </div>

      <div class="boq-ribbon-panel" data-ribbon-panel="data">
        <div class="boq-ribbon-group">
          <div class="boq-ribbon-controls">
            <button type="button" class="excel-tool-text" data-boq-action="group-rows">Group hàng</button>
            <button type="button" class="excel-tool-text" data-boq-action="ungroup-rows">Ungroup hàng</button>
          </div>
          <span class="boq-ribbon-label">Nhóm hàng</span>
        </div>
        <div class="boq-ribbon-group">
          <div class="boq-ribbon-controls">
            <button type="button" class="excel-tool-text" data-boq-action="group-cols">Group cột</button>
            <button type="button" class="excel-tool-text" data-boq-action="ungroup-cols">Ungroup cột</button>
          </div>
          <span class="boq-ribbon-label">Nhóm cột</span>
        </div>
      </div>
    </div>

    <div class="excel-boq-meta">
      <span>Sheet: <b>${esc(grid.sheetName||"")}</b></span>
      <span>Vùng dữ liệu: <b>${esc(grid.range||"")}</b></span>
      <span>Hiển thị: <b>A → ${excelColumnName(Number(grid.startCol||0)+Number(grid.colCount||1)-1)}</b></span>
      <span>Ô gộp: <b>${(grid.merges||[]).length}</b></span>
      <span data-boq-selection-label>Chưa chọn ô</span>
    </div>

    <div class="excel-boq-scroll">
      <table class="excel-boq-grid" data-boq-table data-zoom="${zoom}" style="zoom:${zoom}">
        ${colgroup}<thead>${letters}</thead><tbody>${body}</tbody>
      </table>
    </div>
  </div>`;
}

function bindExcelBoqGrid(grid,rev){
  const shell=mountEl?.querySelector(".excel-boq-shell");
  if(!shell)return;

  const table=shell.querySelector("[data-boq-table]");
  const scroll=shell.querySelector(".excel-boq-scroll");
  if(!table||!scroll)return;

  let prefs=loadBoqGridPrefs(grid,rev);
  let zoom=clampBoqZoom(Number(prefs.zoom||1));
  const visualMeta=boqVisualMeta(grid,rev);
  let selection=null;
  let anchor=null;

  const getCol=c=>table.querySelector(`col[data-boq-col="${c}"]`);
  const zoomLabel=()=>shell.querySelector('[data-boq-action="zoom-100"]');

  shell.querySelectorAll("[data-ribbon-tab]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      shell.querySelectorAll("[data-ribbon-tab]").forEach(x=>x.classList.toggle("active",x===btn));
      shell.querySelectorAll("[data-ribbon-panel]").forEach(p=>p.classList.toggle("active",p.dataset.ribbonPanel===btn.dataset.ribbonTab));
    });
  });

  const markDirty=()=>{
    boqEditorDirty=true;
    const el=shell.querySelector("[data-boq-save-state]");
    if(el){el.textContent="● Chưa lưu";el.classList.remove("saved");el.classList.add("dirty")}
    if(rev)rev.sourceGrid=grid;
  };

  const applyZoom=value=>{
    zoom=clampBoqZoom(value);
    table.style.zoom=String(zoom);
    table.dataset.zoom=String(zoom);
    const label=zoomLabel();
    if(label)label.textContent=`${Math.round(zoom*100)}%`;
    prefs.zoom=zoom;
    saveBoqGridPrefs(grid,rev,prefs);
    requestAnimationFrame(()=>applyBoqFreeze(shell,grid,prefs));
  };

  const setColWidth=(c,width,save=true)=>{
    const col=getCol(c);
    if(!col)return;
    const w=Math.max(34,Math.min(760,Math.round(Number(width)||96)));
    col.style.width=`${w}px`;
    if(save){
      prefs.widths={...(prefs.widths||{}),[c]:w};
      saveBoqGridPrefs(grid,rev,prefs);
      requestAnimationFrame(()=>applyBoqFreeze(shell,grid,prefs));
    }
  };

  const normalizeSel=s=>({
    type:s?.type||"cell",
    r1:Math.min(Number(s?.r1||0),Number(s?.r2??s?.r1??0)),
    r2:Math.max(Number(s?.r1||0),Number(s?.r2??s?.r1??0)),
    c1:Math.min(Number(s?.c1||0),Number(s?.c2??s?.c1??0)),
    c2:Math.max(Number(s?.c1||0),Number(s?.c2??s?.c1??0))
  });

  const setSelection=s=>{
    selection=normalizeSel(s);
    paintBoqSelection(table,selection,grid);
    const label=shell.querySelector("[data-boq-selection-label]");
    if(label){
      if(selection.type==="row")label.textContent=`Hàng ${Number(grid.startRow||1)+selection.r1}${selection.r2>selection.r1?`:${Number(grid.startRow||1)+selection.r2}`:""}`;
      else if(selection.type==="col")label.textContent=`Cột ${excelColumnName(Number(grid.startCol||0)+selection.c1)}${selection.c2>selection.c1?`:${excelColumnName(Number(grid.startCol||0)+selection.c2)}`:""}`;
      else label.textContent=`Ô ${excelColumnName(Number(grid.startCol||0)+selection.c1)}${Number(grid.startRow||1)+selection.r1}${selection.r2!==selection.r1||selection.c2!==selection.c1?` → ${excelColumnName(Number(grid.startCol||0)+selection.c2)}${Number(grid.startRow||1)+selection.r2}`:""}`;
    }
  };

  const requireSelection=()=>{
    if(selection)return true;
    toast("Chọn ô, hàng hoặc cột trước.","warning");
    return false;
  };

  shell.querySelectorAll(".excel-col-resizer").forEach(handle=>{
    handle.addEventListener("pointerdown",e=>{
      if(e.button!==0)return;
      e.preventDefault();e.stopPropagation();
      const c=Number(handle.dataset.resizeCol);
      const col=getCol(c);
      if(!col)return;

      const startX=e.clientX;
      const startWidth=parseFloat(col.style.width)||boqSmartColumnWidth(grid,c,visualMeta);
      const currentZoom=Number(table.dataset.zoom||1)||1;
      document.body.classList.add("boq-column-resizing");
      handle.classList.add("dragging");

      const onMove=ev=>{
        const delta=(ev.clientX-startX)/currentZoom;
        setColWidth(c,startWidth+delta,false);
      };
      const onUp=()=>{
        document.removeEventListener("pointermove",onMove);
        document.body.classList.remove("boq-column-resizing");
        handle.classList.remove("dragging");
        setColWidth(c,parseFloat(col.style.width)||startWidth,true);
      };
      document.addEventListener("pointermove",onMove);
      document.addEventListener("pointerup",onUp,{once:true});
    });

    handle.addEventListener("dblclick",e=>{
      e.preventDefault();e.stopPropagation();
      const c=Number(handle.dataset.resizeCol);
      setColWidth(c,autoFitBoqColumn(grid,c),true);
    });
  });

  table.querySelectorAll("tbody td").forEach(td=>{
    td.addEventListener("click",e=>{
      const r=Number(td.dataset.gridRow),c=Number(td.dataset.gridCol);
      if(e.shiftKey&&anchor){
        setSelection({type:"cell",r1:anchor.r,c1:anchor.c,r2:r,c2:c});
      }else{
        anchor={r,c};
        setSelection({type:"cell",r1:r,c1:c,r2:r,c2:c});
      }
    });
  });

  table.querySelectorAll(".excel-row-head").forEach(th=>{
    th.addEventListener("click",e=>{
      if(e.target.closest(".excel-group-toggle"))return;
      const r=Number(th.dataset.rowIndex);
      if(e.shiftKey&&anchor?.type==="row"){
        setSelection({type:"row",r1:anchor.r,r2:r,c1:0,c2:Number(grid.colCount||1)-1});
      }else{
        anchor={type:"row",r};
        setSelection({type:"row",r1:r,r2:r,c1:0,c2:Number(grid.colCount||1)-1});
      }
    });
  });

  table.querySelectorAll(".excel-column-header").forEach(th=>{
    th.addEventListener("click",e=>{
      if(e.target.closest(".excel-col-resizer,.excel-group-toggle"))return;
      const c=Number(th.dataset.colIndex);
      if(e.shiftKey&&anchor?.type==="col"){
        setSelection({type:"col",c1:anchor.c,c2:c,r1:0,r2:Number(grid.rowCount||1)-1});
      }else{
        anchor={type:"col",c};
        setSelection({type:"col",c1:c,c2:c,r1:0,r2:Number(grid.rowCount||1)-1});
      }
    });
  });

  shell.querySelector("[data-boq-font-family]")?.addEventListener("change",e=>{
    if(!requireSelection())return;
    applyBoqStyle(grid,selection,{ff:String(e.target.value||"Arial")});
    applyBoqStylesToDom(table,grid,selection);
    requestAnimationFrame(()=>applyBoqFreeze(shell,grid,prefs));
    markDirty();
  });

  shell.querySelector("[data-boq-font-size]")?.addEventListener("change",e=>{
    if(!requireSelection())return;
    applyBoqStyle(grid,selection,{fs:Number(e.target.value||10)});
    applyBoqStylesToDom(table,grid,selection);
    requestAnimationFrame(()=>applyBoqFreeze(shell,grid,prefs));
    markDirty();
  });

  shell.querySelectorAll("[data-boq-format]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(!requireSelection())return;
      const f=btn.dataset.boqFormat;
      if(f==="bold")applyBoqToggleStyle(grid,selection,"b");
      else if(f==="italic")applyBoqToggleStyle(grid,selection,"i");
      else if(f==="wrap")applyBoqToggleStyle(grid,selection,"w");
      applyBoqStylesToDom(table,grid,selection);
      requestAnimationFrame(()=>applyBoqFreeze(shell,grid,prefs));
      markDirty();
    });
  });

  shell.querySelectorAll("[data-boq-align]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(!requireSelection())return;
      applyBoqStyle(grid,selection,{h:btn.dataset.boqAlign});
      applyBoqStylesToDom(table,grid,selection);
      requestAnimationFrame(()=>applyBoqFreeze(shell,grid,prefs));
      markDirty();
    });
  });

  shell.querySelectorAll(".excel-group-toggle.row").forEach(btn=>{
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      grid.rowGroups=toggleBoqGroup(grid.rowGroups,Number(btn.dataset.rowGroup));
      markDirty();
      rev.sourceGrid=grid;paint();
    });
  });
  shell.querySelectorAll(".excel-group-toggle.col").forEach(btn=>{
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      grid.colGroups=toggleBoqGroup(grid.colGroups,Number(btn.dataset.colGroup));
      markDirty();
      rev.sourceGrid=grid;paint();
    });
  });

  shell.querySelectorAll("[data-boq-action]").forEach(btn=>{
    btn.addEventListener("click",async()=>{
      const action=btn.dataset.boqAction;

      if(action==="save-grid"){
        await saveBoqGridChanges(grid,rev,shell);
        return;
      }

      if(action==="zoom-out")applyZoom(zoom-0.1);
      else if(action==="zoom-in")applyZoom(zoom+0.1);
      else if(action==="zoom-100")applyZoom(1);
      else if(action==="fit-width"){
        const widthsNow=Array.from({length:Number(grid.colCount||0)},(_,c)=>{
          const col=getCol(c);
          return parseFloat(col?.style.width)||boqSmartColumnWidth(grid,c,visualMeta);
        });
        const natural=48+widthsNow.reduce((a,b)=>a+b,0);
        const available=Math.max(300,scroll.clientWidth-14);
        applyZoom(Math.max(0.5,Math.min(1.15,available/natural)));
        scroll.scrollLeft=0;
      }
      else if(action==="reset-widths"){
        prefs.widths={};
        Array.from({length:Number(grid.colCount||0)},(_,c)=>setColWidth(c,boqSmartColumnWidth(grid,c,visualMeta),false));
        saveBoqGridPrefs(grid,rev,prefs);
        requestAnimationFrame(()=>applyBoqFreeze(shell,grid,prefs));
      }
      else if(action==="freeze-top-row"){
        prefs.freezeRows=1;saveBoqGridPrefs(grid,rev,prefs);applyBoqFreeze(shell,grid,prefs);
      }
      else if(action==="freeze-first-col"){
        prefs.freezeCols=1;saveBoqGridPrefs(grid,rev,prefs);applyBoqFreeze(shell,grid,prefs);
      }
      else if(action==="unfreeze"){
        prefs.freezeRows=0;prefs.freezeCols=0;saveBoqGridPrefs(grid,rev,prefs);applyBoqFreeze(shell,grid,prefs);
      }
      else if(action==="freeze-selection"){
        if(!requireSelection())return;
        prefs.freezeRows=selection.r1;
        prefs.freezeCols=selection.c1;
        saveBoqGridPrefs(grid,rev,prefs);
        applyBoqFreeze(shell,grid,prefs);
      }
      else if(action==="insert-row-above"||action==="insert-row-below"){
        if(!requireSelection())return;
        const idx=action==="insert-row-above"?selection.r1:selection.r2+1;
        insertBoqRow(grid,idx);
        prefs.widths={};saveBoqGridPrefs(grid,rev,prefs);
        markDirty();rev.sourceGrid=grid;paint();
      }
      else if(action==="insert-col-left"||action==="insert-col-right"){
        if(!requireSelection())return;
        const idx=action==="insert-col-left"?selection.c1:selection.c2+1;
        insertBoqColumn(grid,idx);
        prefs.widths={};saveBoqGridPrefs(grid,rev,prefs);
        markDirty();rev.sourceGrid=grid;paint();
      }
      else if(action==="group-rows"){
        if(!requireSelection())return;
        addBoqGroup(grid,"row",selection.r1,selection.r2);
        markDirty();rev.sourceGrid=grid;paint();
      }
      else if(action==="ungroup-rows"){
        if(!requireSelection())return;
        removeBoqGroups(grid,"row",selection.r1,selection.r2);
        markDirty();rev.sourceGrid=grid;paint();
      }
      else if(action==="group-cols"){
        if(!requireSelection())return;
        addBoqGroup(grid,"col",selection.c1,selection.c2);
        markDirty();rev.sourceGrid=grid;paint();
      }
      else if(action==="ungroup-cols"){
        if(!requireSelection())return;
        removeBoqGroups(grid,"col",selection.c1,selection.c2);
        markDirty();rev.sourceGrid=grid;paint();
      }
    });
  });

  applyBoqFreeze(shell,grid,prefs);
}

function paintBoqSelection(table,selection,grid){
  table.querySelectorAll(".excel-cell-selected,.excel-cell-range,.excel-row-selected,.excel-col-selected").forEach(x=>
    x.classList.remove("excel-cell-selected","excel-cell-range","excel-row-selected","excel-col-selected")
  );
  if(!selection)return;

  const s=selection;
  for(let r=s.r1;r<=s.r2;r++){
    table.querySelector(`.excel-row-head[data-row-index="${r}"]`)?.classList.add("excel-row-selected");
  }
  for(let c=s.c1;c<=s.c2;c++){
    table.querySelector(`.excel-column-header[data-col-index="${c}"]`)?.classList.add("excel-col-selected");
  }
  table.querySelectorAll("tbody td[data-grid-row][data-grid-col]").forEach(td=>{
    const r=Number(td.dataset.gridRow),c=Number(td.dataset.gridCol);
    if(r>=s.r1&&r<=s.r2&&c>=s.c1&&c<=s.c2)td.classList.add(s.r1===s.r2&&s.c1===s.c2?"excel-cell-selected":"excel-cell-range");
  });
}

function selectedBoqCells(selection){
  const out=[];
  if(!selection)return out;
  for(let r=selection.r1;r<=selection.r2;r++)for(let c=selection.c1;c<=selection.c2;c++)out.push([r,c]);
  return out;
}

function applyBoqStyle(grid,selection,patch){
  grid.styles=grid.styles||{};
  selectedBoqCells(selection).forEach(([r,c])=>{
    const key=`${r}_${c}`;
    grid.styles[key]={...(grid.styles[key]||{}),...patch};
  });
}

function applyBoqToggleStyle(grid,selection,key){
  grid.styles=grid.styles||{};
  const first=grid.styles?.[`${selection.r1}_${selection.c1}`]||{};
  const value=first[key]?0:1;
  selectedBoqCells(selection).forEach(([r,c])=>{
    const k=`${r}_${c}`;
    grid.styles[k]={...(grid.styles[k]||{}),[key]:value};
  });
}

function applyBoqStylesToDom(table,grid,selection){
  selectedBoqCells(selection).forEach(([r,c])=>{
    const td=table.querySelector(`td[data-grid-row="${r}"][data-grid-col="${c}"]`);
    if(!td)return;
    td.style.cssText=sourceGridCellStyle(grid.styles?.[`${r}_${c}`]||{});
  });
  paintBoqSelection(table,selection,grid);
}

async function saveBoqGridChanges(grid,rev,shell){
  if(!rev?.id){toast("Không xác định được BOQ để lưu.","error");return}
  try{
    const btn=shell?.querySelector('[data-boq-action="save-grid"]');
    if(btn){btn.disabled=true;btn.textContent="Đang lưu..."}
    await refs.quantityBoqRevision(projectId,rev.id).update({
      sourceGrid:grid,
      sourceGridUpdatedAt:Date.now(),
      updatedAt:Date.now()
    });
    rev.sourceGrid=grid;
    boqEditorDirty=false;
    const st=shell?.querySelector("[data-boq-save-state]");
    if(st){st.textContent="✓ Đã lưu";st.classList.remove("dirty");st.classList.add("saved")}
    try{
      await audit("BOQ_GRID_EDITED","Cập nhật định dạng/cấu trúc BOQ gốc",{revisionId:rev.id,revisionCode:rev.code||""});
    }catch{}
    toast("Đã lưu thay đổi BOQ.");
    if(btn){btn.disabled=false;btn.textContent="Lưu thay đổi"}
  }catch(e){
    console.error(e);
    const btn=shell?.querySelector('[data-boq-action="save-grid"]');
    if(btn){btn.disabled=false;btn.textContent="Lưu thay đổi"}
    toast(e.message||"Không thể lưu thay đổi BOQ.","error");
  }
}

function insertBoqRow(grid,index){
  const cols=Math.max(1,Number(grid.colCount||0));
  const i=Math.max(0,Math.min(Number(grid.rowCount||0),Number(index||0)));
  grid.rows=normalizeIndexedArray(grid.rows).map(r=>normalizeIndexedArray(r));
  grid.rows.splice(i,0,Array.from({length:cols},()=>""));
  grid.rowHeights=normalizeIndexedArray(grid.rowHeights);
  grid.rowHeights.splice(i,0,22);
  grid.rowCount=Number(grid.rowCount||grid.rows.length-1)+1;
  grid.styles=shiftBoqStyleKeys(grid.styles||{},"row",i,1);
  grid.merges=shiftBoqMerges(grid.merges||[],"row",i,1);
  grid.rowGroups=shiftBoqGroups(grid.rowGroups||[],i,1);
  grid.range=boqGridRange(grid);
}

function insertBoqColumn(grid,index){
  const i=Math.max(0,Math.min(Number(grid.colCount||0),Number(index||0)));
  grid.rows=normalizeIndexedArray(grid.rows).map(r=>normalizeIndexedArray(r));
  grid.rows.forEach(r=>r.splice(i,0,""));
  grid.colWidths=normalizeIndexedArray(grid.colWidths);
  grid.colWidths.splice(i,0,96);
  grid.colCount=Number(grid.colCount||0)+1;
  grid.styles=shiftBoqStyleKeys(grid.styles||{},"col",i,1);
  grid.merges=shiftBoqMerges(grid.merges||[],"col",i,1);
  grid.colGroups=shiftBoqGroups(grid.colGroups||[],i,1);
  grid.range=boqGridRange(grid);
}

function shiftBoqStyleKeys(styles,axis,index,delta){
  const out={};
  Object.entries(styles||{}).forEach(([key,val])=>{
    const m=key.match(/^(\d+)_(\d+)$/);
    if(!m){out[key]=val;return}
    let r=Number(m[1]),c=Number(m[2]);
    if(axis==="row"&&r>=index)r+=delta;
    if(axis==="col"&&c>=index)c+=delta;
    out[`${r}_${c}`]=val;
  });
  return out;
}

function shiftBoqMerges(merges,axis,index,delta){
  return normalizeIndexedArray(merges).map(m=>{
    const x={...m,r1:Number(m.r1),r2:Number(m.r2),c1:Number(m.c1),c2:Number(m.c2)};
    if(axis==="row"){
      if(index<=x.r1){x.r1+=delta;x.r2+=delta}
      else if(index<=x.r2)x.r2+=delta;
    }else{
      if(index<=x.c1){x.c1+=delta;x.c2+=delta}
      else if(index<=x.c2)x.c2+=delta;
    }
    return x;
  });
}

function shiftBoqGroups(groups,index,delta){
  return normalizeIndexedArray(groups).map(g=>{
    const x={...g,start:Number(g.start),end:Number(g.end)};
    if(index<=x.start){x.start+=delta;x.end+=delta}
    else if(index<=x.end)x.end+=delta;
    return x;
  });
}

function boqGridRange(grid){
  const startRow=Math.max(1,Number(grid.startRow||1));
  const startCol=Math.max(0,Number(grid.startCol||0));
  const endRow=startRow+Math.max(1,Number(grid.rowCount||1))-1;
  const endCol=startCol+Math.max(1,Number(grid.colCount||1))-1;
  return `${excelColumnName(startCol)}${startRow}:${excelColumnName(endCol)}${endRow}`;
}

function addBoqGroup(grid,axis,start,end){
  const s=Math.min(Number(start),Number(end)),e=Math.max(Number(start),Number(end));
  if(e<=s){toast(`Chọn ít nhất 2 ${axis==="row"?"hàng":"cột"} để Group.`,"warning");return}
  const key=axis==="row"?"rowGroups":"colGroups";
  const groups=normalizeIndexedArray(grid[key]).filter(Boolean);
  if(!groups.some(g=>Number(g.start)===s&&Number(g.end)===e))groups.push({start:s,end:e,collapsed:false});
  grid[key]=groups.sort((a,b)=>Number(a.start)-Number(b.start));
}

function removeBoqGroups(grid,axis,start,end){
  const s=Math.min(Number(start),Number(end)),e=Math.max(Number(start),Number(end));
  const key=axis==="row"?"rowGroups":"colGroups";
  grid[key]=normalizeIndexedArray(grid[key]).filter(g=>Number(g.end)<s||Number(g.start)>e);
}

function toggleBoqGroup(groups,start){
  const arr=normalizeIndexedArray(groups);
  const g=arr.find(x=>Number(x.start)===Number(start));
  if(g)g.collapsed=!g.collapsed;
  return arr;
}

function boqCollapsedIndexes(groups){
  const set=new Set();
  normalizeIndexedArray(groups).filter(Boolean).forEach(g=>{
    if(!g.collapsed)return;
    for(let i=Number(g.start)+1;i<=Number(g.end);i++)set.add(i);
  });
  return set;
}

function boqGroupStartMap(groups){
  const m=new Map();
  normalizeIndexedArray(groups).filter(Boolean).forEach(g=>m.set(Number(g.start),g));
  return m;
}

function applyBoqFreeze(shell,grid,prefs){
  const table=shell?.querySelector("[data-boq-table]");
  if(!table)return;

  table.querySelectorAll(".boq-frozen-row,.boq-frozen-col,.boq-frozen-both").forEach(el=>{
    el.classList.remove("boq-frozen-row","boq-frozen-col","boq-frozen-both");
    el.style.removeProperty("top");
    el.style.removeProperty("left");
    el.style.removeProperty("z-index");
    if(el.tagName==="TD")el.style.removeProperty("position");
  });

  const freezeRows=Math.max(0,Math.min(Number(grid.rowCount||0),Number(prefs.freezeRows||0)));
  const freezeCols=Math.max(0,Math.min(Number(grid.colCount||0),Number(prefs.freezeCols||0)));

  let top=29;
  for(let r=0;r<freezeRows;r++){
    const tr=table.querySelector(`tr[data-grid-row-wrap="${r}"]`);
    if(!tr||tr.classList.contains("boq-hidden-row"))continue;
    const rowH=tr.getBoundingClientRect().height/(Number(table.dataset.zoom||1)||1);
    tr.querySelectorAll("th,td").forEach(cell=>{
      cell.classList.add("boq-frozen-row");
      cell.style.position="sticky";
      cell.style.top=`${top}px`;
      cell.style.zIndex=cell.classList.contains("excel-row-head")?"7":"4";
    });
    top+=rowH;
  }

  let left=48;
  for(let c=0;c<freezeCols;c++){
    const col=table.querySelector(`col[data-boq-col="${c}"]`);
    const width=parseFloat(col?.style.width)||boqSmartColumnWidth(grid,c,boqVisualMeta(grid,boqMirrorRevision()));
    table.querySelector(`.excel-column-header[data-col-index="${c}"]`)?.classList.add("boq-frozen-col");
    const header=table.querySelector(`.excel-column-header[data-col-index="${c}"]`);
    if(header){header.style.left=`${left}px`;header.style.zIndex="8"}
    table.querySelectorAll(`td[data-grid-col="${c}"]`).forEach(td=>{
      td.classList.add("boq-frozen-col");
      td.style.position="sticky";
      td.style.left=`${left}px`;
      td.style.zIndex=td.classList.contains("boq-frozen-row")?"6":"3";
      if(td.classList.contains("boq-frozen-row"))td.classList.add("boq-frozen-both");
    });
    left+=width;
  }
}

function autoFitBoqColumn(grid,c){
  const mergeInfo=buildGridMergeLookup(grid.merges||[]);
  const startCol=Number(grid.startCol||0);
  let max=measureBoqText(excelColumnName(startCol+c),true)+28;
  const rows=grid.rows||[];
  const limit=Math.min(rows.length,800);

  for(let r=0;r<limit;r++){
    const key=`${r}_${c}`;
    const merge=mergeInfo.starts.get(key);
    if(merge&&(merge.c2-merge.c1)>=1)continue;
    if(mergeInfo.covered.has(key))continue;

    const text=String(rows[r]?.[c]??"").trim();
    if(!text)continue;
    const sample=text.length>180?text.slice(0,180):text;
    const style=grid.styles?.[key]||{};
    const measured=measureBoqText(sample,Boolean(style.b),Number(style.fs||10))+22;
    max=Math.max(max,measured);
  }
  return Math.max(42,Math.min(620,Math.ceil(max)));
}

let _boqMeasureCanvas;
function measureBoqText(text,bold=false,fontSize=10){
  try{
    _boqMeasureCanvas=_boqMeasureCanvas||document.createElement("canvas");
    const ctx=_boqMeasureCanvas.getContext("2d");
    ctx.font=`${bold?"700 ":""}${Math.max(8,Number(fontSize)||10)}px Arial, sans-serif`;
    return ctx.measureText(String(text||"")).width;
  }catch{
    return String(text||"").length*7;
  }
}

function boqGridPreferenceKey(grid,rev){
  const revId=rev?.id||rev?.code||"boq";
  const sheet=grid?.sheetName||rev?.sourceSheetName||"sheet";
  return `companyhub:boq-grid:v2:${projectId||"project"}:${revId}:${sheet}`;
}

function loadBoqGridPrefs(grid,rev){
  try{
    const raw=localStorage.getItem(boqGridPreferenceKey(grid,rev));
    const parsed=raw?JSON.parse(raw):{};
    return {
      widths:parsed?.widths&&typeof parsed.widths==="object"?parsed.widths:{},
      zoom:clampBoqZoom(Number(parsed?.zoom||1)),
      freezeRows:Math.max(0,Number(parsed?.freezeRows||0)),
      freezeCols:Math.max(0,Number(parsed?.freezeCols||0))
    };
  }catch{
    return {widths:{},zoom:1,freezeRows:0,freezeCols:0};
  }
}

function saveBoqGridPrefs(grid,rev,prefs){
  try{
    localStorage.setItem(boqGridPreferenceKey(grid,rev),JSON.stringify({
      widths:prefs?.widths||{},
      zoom:clampBoqZoom(Number(prefs?.zoom||1)),
      freezeRows:Math.max(0,Number(prefs?.freezeRows||0)),
      freezeCols:Math.max(0,Number(prefs?.freezeCols||0))
    }));
  }catch{}
}

function clampBoqZoom(v){
  return Math.max(0.5,Math.min(1.5,Number(v)||1));
}

function buildGridMergeLookup(merges){
  const starts=new Map(),covered=new Set();
  (merges||[]).forEach(m=>{
    const r1=Number(m?.r1),c1=Number(m?.c1),r2=Number(m?.r2),c2=Number(m?.c2);
    if(![r1,c1,r2,c2].every(Number.isFinite))return;
    starts.set(`${r1}_${c1}`,{r1,c1,r2,c2});
    for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){
      if(r!==r1||c!==c1)covered.add(`${r}_${c}`);
    }
  });
  return {starts,covered};
}

function normalizeIndexedArray(v){
  if(Array.isArray(v))return v;
  if(!v||typeof v!=="object")return [];
  const keys=Object.keys(v).filter(k=>/^\d+$/.test(k)).map(Number);
  const max=keys.length?Math.max(...keys):-1;
  return Array.from({length:max+1},(_,i)=>v[i]??v[String(i)]??"");
}

function gridColWidth(v){
  const n=typeof v==="object"?Number(v?.width||0):Number(v||0);
  return Math.max(34,Math.min(520,n||96));
}

function gridRowHeight(v){
  const n=typeof v==="object"?Number(v?.height||0):Number(v||0);
  return Math.max(18,Math.min(240,n||22));
}

function excelColumnName(index){
  let n=Number(index)+1,s="";
  while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}
  return s;
}

function formatGridCell(v){
  if(v===null||v===undefined||v==="")return "";
  return esc(String(v));
}

function sourceGridCellStyle(st){
  if(!st||typeof st!=="object")return "";
  const out=[];
  if(st.h)out.push(`text-align:${safeCssAlign(st.h)}`);
  if(st.v)out.push(`vertical-align:${safeCssVertical(st.v)}`);
  if(st.w)out.push("white-space:pre-wrap");
  if(st.b)out.push("font-weight:700");
  if(st.i)out.push("font-style:italic");
  if(st.ff)out.push(`font-family:${safeBoqFont(st.ff)}`);
  if(st.fs)out.push(`font-size:${Math.max(7,Math.min(32,Number(st.fs)||10))}px`);
  if(st.bg&&/^#[0-9A-F]{6}$/i.test(st.bg))out.push(`background:${st.bg}`);
  if(st.fg&&/^#[0-9A-F]{6}$/i.test(st.fg))out.push(`color:${st.fg}`);
  return out.join(";");
}

function safeBoqFont(v){
  const allowed={
    "Arial":"Arial, sans-serif",
    "Calibri":"Calibri, Arial, sans-serif",
    "Times New Roman":"'Times New Roman', serif",
    "Tahoma":"Tahoma, Arial, sans-serif",
    "Verdana":"Verdana, Arial, sans-serif"
  };
  return allowed[String(v||"")]||"Arial, sans-serif";
}

function safeCssAlign(v){
  return ["left","center","right","justify"].includes(v)?v:"left";
}

function safeCssVertical(v){
  return ["top","middle","bottom"].includes(v)?v:"middle";
}

function sourceMappedTableHtml(structure){
  return `<div class="table-wrap"><table class="table boq-source-table"><thead><tr>
    <th>MỤC</th><th>DIỄN GIẢI</th><th>ĐƠN VỊ</th><th>KHỐI LƯỢNG</th>
    <th>MODEL/THÔNG SỐ</th><th>NHÃN HIỆU</th><th>XUẤT XỨ</th>
    <th>VẬT TƯ CHÍNH</th><th>NC + VẬT TƯ PHỤ</th><th>TỔNG ĐƠN GIÁ</th><th>THÀNH TIỀN</th>
  </tr></thead><tbody>${structure.map(sourceMappedRow).join("")}</tbody></table></div>`;
}

function sourceMappedRow(sr){
  if(sr.rowType==="SECTION"){
    const level=structureLevel(sr.itemNo);
    return `<tr class="boq-source-section level-${level}"><td><b>${esc(sr.itemNo||"")}</b></td><td colspan="10"><b>${esc(sr.description||"")}</b></td></tr>`;
  }
  if(sr.rowType==="NOTE_HEADER"){
    return `<tr class="boq-source-note-header"><td></td><td colspan="10"><b>${esc(sr.description||"GHI CHÚ CHUNG")}</b></td></tr>`;
  }
  if(sr.rowType==="NOTE"){
    return `<tr class="boq-source-note"><td>${esc(sr.itemNo||"")}</td><td>${esc(sr.description||"")}</td><td>${esc(sr.unit||"")}</td><td colspan="8"></td></tr>`;
  }
  const totalUnit=Number(sr.bidUnit||0),qty=Number(sr.qty||0);
  return `<tr class="boq-source-item">
    <td><b>${esc(sr.itemNo||"")}</b></td><td>${esc(sr.description||"")}</td><td>${esc(sr.unit||"")}</td>
    <td><b>${num(qty,3)}</b></td><td>${esc(sr.specification||"")}</td><td>${esc(sr.brand||"")}</td><td>${esc(sr.origin||"")}</td>
    <td>${money(sr.materialUnit)}</td><td>${money(sr.laborUnit)}</td><td><b>${money(totalUnit)}</b></td><td><b>${money(qty*totalUnit)}</b></td>
  </tr>`;
}


function revisionDisplayRows(){
  const raw=activeRevision?.displayRows;
  if(Array.isArray(raw))return raw.filter(Boolean).sort((a,b)=>Number(a.sourceOrder||0)-Number(b.sourceOrder||0));
  return Object.values(raw||{}).filter(Boolean).sort((a,b)=>Number(a.sourceOrder||0)-Number(b.sourceOrder||0));
}

function requestsHtml(){
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">Phiếu đặt hàng công trường</h2><p>Mỗi lần công trường đề nghị vật tư được lưu thành một phiếu riêng. Chỉ phiếu Đã duyệt/Đã đặt hàng mới cộng vào khối lượng kiểm soát.</p></div>
  </div>
  <div class="table-wrap"><table class="table quantity-request-table"><thead><tr>
    <th>PHIẾU</th><th>NGÀY</th><th>NGƯỜI ĐỀ NGHỊ</th><th>KHU VỰC</th><th>SỐ DÒNG</th><th>KL QUY ĐỔI</th><th>GIÁ TRỊ THEO BOQ</th><th>TRẠNG THÁI</th><th>GHI CHÚ</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${requests.length?requests.map(requestRow).join(""):`<tr><td colspan="10">${empty("Chưa có phiếu đặt hàng","Tạo phiếu đầu tiên khi công trường có nhu cầu đặt vật tư.","▣")}</td></tr>`}
  </tbody></table></div>`;
}

function requestRow(r){
  const st=statusInfo(r.status),lines=linesOf(r),qty=lines.reduce((s,l)=>s+Number(l.boqQty||0),0),value=lines.reduce((s,l)=>s+Number(l.boqQty||0)*Number(l.bidUnit||0),0);
  return `<tr>
    <td><b>${esc(r.code||"—")}</b></td><td>${fmtDate(r.requestDate)}</td>
    <td><div>${esc(r.requesterName||r.requesterEmail||"—")}</div><div class="secondary-text">${esc(r.department||"")}</div></td>
    <td>${esc(r.location||"—")}</td><td>${lines.length}</td><td>${num(qty,3)}</td><td>${money(value)}</td>
    <td>${badge(st.label,st.color)}</td><td>${esc(r.notes||"—")}</td>
    <td><div class="row-actions"><button class="btn sm" data-request-view="${r.id}">Chi tiết</button>${canEditRequest(r)?`<button class="btn sm" data-request-edit="${r.id}">Sửa phiếu</button>`:""}</div></td>
  </tr>`;
}

function outsideHtml(rows){
  const list=rows.filter(r=>r.isOutside);
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">Đầu mục ngoài BOQ</h2><p>Toàn bộ khối lượng ngoài Baseline được coi là phát sinh và cần có lý do/đề xuất xử lý thương mại.</p></div>
  </div>
  <div class="table-wrap"><table class="table quantity-outside-table"><thead><tr>
    <th>VẬT TƯ NGOÀI BOQ</th><th>HỆ</th><th>ĐVT</th><th>ĐÃ DUYỆT/ĐẶT</th><th>CHỜ DUYỆT</th><th>GIÁ CHÀO TB</th><th>GT PHÁT SINH</th><th>CHI PHÍ DỰ KIẾN</th><th>LÝ DO</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${list.length?list.map(r=>`<tr class="qty-row-red">
      <td><div class="primary-text">${esc(r.description)}</div><div class="secondary-text">${esc(r.specification||"")}</div></td>
      <td>${badge(r.discipline||"KHÁC","gray")}</td><td>${esc(r.unit||"—")}</td>
      <td class="danger-text"><b>${num(r.confirmedQty,3)}</b></td><td>${num(r.pendingQty,3)}</td>
      <td>${money(r.bidUnit)}</td><td class="danger-text"><b>${money(r.excessBidValue)}</b></td><td>${money(r.excessCost)}</td>
      <td>${esc(r.reasonLabel||"Ngoài BOQ")}</td>
      <td><div class="row-actions"><button class="btn sm" data-qty-history="${esc(r.key)}">Lịch sử</button>${r.excessBidValue>0&&can("quantityVariationCreate")?`<button class="btn orange sm" data-qty-vo="${esc(r.key)}">Tạo VO</button>`:""}</div></td>
    </tr>`).join(""):`<tr><td colspan="10">${empty("Chưa có đầu mục ngoài BOQ","Các vật tư không tồn tại trong Baseline sẽ xuất hiện ở đây.","✓")}</td></tr>`}
  </tbody></table></div>`;
}

function historyHtml(){
  return `<div class="card">
    <div class="card-head"><h3>Lịch sử kiểm soát khối lượng</h3><span class="secondary-text">${audits.length} sự kiện</span></div>
    <div class="card-body">
      ${audits.length?`<div class="quantity-audit-list">${audits.map(a=>`<div class="quantity-audit-item">
        <div class="audit-dot"></div>
        <div class="audit-main"><b>${esc(a.message||a.action||"Cập nhật")}</b><span>${esc(a.userName||a.userEmail||"")} · ${fmtDateTime(a.createdAt)}</span></div>
        <div>${a.requestCode?badge(a.requestCode,"blue"):""}</div>
      </div>`).join("")}</div>`:empty("Chưa có lịch sử","Các thao tác tạo phiếu, duyệt, đặt hàng và thay đổi đầu mục sẽ được lưu ở đây.","◉")}
    </div>
  </div>`;
}

function refreshActiveRevisionStructure(){
  if(!activeRevision||!can("quantityRevisionActivate"))return;

  modal({
    title:`Nạp lại BOQ gốc · ${activeRevision.code||"Revision"}`,
    eyebrow:"CHỈ CẬP NHẬT BẢN SAO SHEET",
    size:"lg",
    submitText:"Lưu BOQ gốc",
    body:`<div class="revision-upload-note">
      <b>Không thay đổi Baseline.</b> Chức năng này chỉ tạo lại nguyên hàng/cột của file Excel để hiển thị BOQ gốc.
      Khối lượng kiểm soát, đơn giá và phiếu đặt hàng hiện tại không bị sửa.
    </div>
    <div class="form-grid mt">
      <label class="field span2"><span>File BOQ Excel / CSV *</span>
        <input required type="file" name="revisionFile" id="revisionFile"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv">
      </label>
      <label class="field span2 hidden" id="sourceGridSheetWrap"><span>Sheet cần hiển thị</span>
        <select name="revisionSheet" id="sourceGridSheet"></select>
      </label>
      <div class="span2 hidden revision-file-preview" id="sourceGridPreview"></div>
    </div>`,
    onSubmit:async fd=>{
      try{
        const file=fd.get("revisionFile");
        if(!(file instanceof File)||!file.size){toast("Vui lòng chọn file Excel hoặc CSV.","error");return false}

        const input=document.querySelector("#revisionFile");
        const inspection=input?._revisionInspection||await inspectRevisionSpreadsheet(file);
        const selected=String(fd.get("revisionSheet")||inspection.defaultSheet||"");
        const meta=inspection.sheets?.[selected]||inspection.sheets?.[inspection.defaultSheet];
        if(!meta?.sourceGrid){toast("Không đọc được Sheet đã chọn.","error");return false}

        const parsedInfo=await parseRevisionSpreadsheet(file,{
          sheetName:selected,
          headerRow:meta.headerRow||1,
          headerDepth:meta.headerDepth||1
        });

        const attached=attachStructureToExistingItems(parsedInfo.structureRows||[],activeRevision.items||{});
        await refs.quantityBoqRevision(projectId,activeRevision.id).update({
          sourceGrid:parsedInfo.sourceGrid||meta.sourceGrid,
          sourceHeaders:parsedInfo.sourceHeaders||[],
          displayRows:attached.rows,
          structureLineCount:attached.rows.length,
          structureMatchedItems:attached.matched,
          sourceSheetName:parsedInfo.sheetName||selected,
          sourceFileName:file.name,
          sourceHeaderRow:parsedInfo.headerRow||meta.headerRow||1,
          sourceHeaderDepth:parsedInfo.headerDepth||meta.headerDepth||1,
          sourceGridUpdatedAt:Date.now()
        });

        await audit(
          "REVISION_SOURCE_GRID_REFRESHED",
          `Nạp lại BOQ gốc ${activeRevision.code||""} từ ${file.name} / ${selected}`,
          {revisionId:activeRevision.id,revisionCode:activeRevision.code||"",matched:attached.matched}
        );

        toast("Đã tạo lại nguyên hàng/cột BOQ gốc. Baseline không thay đổi.");
        await reload();view="SOURCE";paint();return true;
      }catch(e){
        console.error(e);toast(e.message||"Không thể nạp lại BOQ gốc.","error");return false;
      }
    }
  });

  const input=document.querySelector("#revisionFile");
  const sheetWrap=document.querySelector("#sourceGridSheetWrap");
  const sheet=document.querySelector("#sourceGridSheet");
  const preview=document.querySelector("#sourceGridPreview");

  input?.addEventListener("change",async()=>{
    const file=input.files?.[0];
    if(!file)return;
    try{
      const inspection=await inspectRevisionSpreadsheet(file);
      input._revisionInspection=inspection;

      if(inspection.kind==="EXCEL"){
        sheetWrap?.classList.remove("hidden");
        if(sheet)sheet.innerHTML=Object.keys(inspection.sheets).map(name=>
          `<option value="${esc(name)}" ${name===inspection.defaultSheet?"selected":""}>${esc(name)}</option>`
        ).join("");
      }else{
        sheetWrap?.classList.add("hidden");
        if(sheet)sheet.innerHTML=`<option value="CSV">CSV</option>`;
      }
      showSourceGridPreview(inspection,sheet?.value||inspection.defaultSheet,preview);
    }catch(e){
      console.error(e);toast(e.message||"Không thể đọc file.","error");
    }
  });

  sheet?.addEventListener("change",()=>{
    const inspection=input?._revisionInspection;
    if(inspection)showSourceGridPreview(inspection,sheet.value,preview);
  });
}

function showSourceGridPreview(inspection,sheetName,box){
  if(!box)return;
  const meta=inspection.sheets?.[sheetName]||inspection.sheets?.[inspection.defaultSheet];
  const g=meta?.sourceGrid;
  if(!g)return;
  box.classList.remove("hidden");
  box.innerHTML=`<div class="revision-file-preview-head">
    <div><b>${esc(inspection.fileName)}</b><span>Sheet: ${esc(sheetName)} · ${g.rowCount} hàng × ${g.colCount} cột · vùng ${esc(g.range||"")}</span></div>
    ${badge("Sẵn sàng tạo BOQ gốc","green")}
  </div>`;
}

function attachStructureToExistingItems(structureRows,items){
  const entries=Object.entries(items||{});
  const byNo=new Map(),bySig=new Map();
  entries.forEach(([id,x])=>{
    const no=norm(x.itemNo||"");
    if(no){
      if(!byNo.has(no))byNo.set(no,[]);
      byNo.get(no).push(id);
    }
    const sig=itemSignature(x);
    if(sig){
      if(!bySig.has(sig))bySig.set(sig,[]);
      bySig.get(sig).push(id);
    }
  });

  const used=new Set();let matched=0;
  const rows=(structureRows||[]).map(sr=>{
    if(sr.rowType!=="ITEM")return {...sr,stableItemId:""};
    let id="";
    const no=norm(sr.itemNo||"");
    if(no&&byNo.get(no)?.length===1&&!used.has(byNo.get(no)[0]))id=byNo.get(no)[0];
    if(!id){
      const sig=itemSignature(sr);
      if(sig&&bySig.get(sig)?.length===1&&!used.has(bySig.get(sig)[0]))id=bySig.get(sig)[0];
    }
    if(id){used.add(id);matched++}
    return {...sr,stableItemId:id};
  });

  return {rows,matched};
}

function bind(){
  mountEl.querySelectorAll("[data-qty-view]").forEach(b=>b.addEventListener("click",()=>{view=b.dataset.qtyView;paint()}));
  mountEl.querySelector("#qtySearch")?.addEventListener("input",e=>{
    q=e.target.value;paint();requestAnimationFrame(()=>{const i=mountEl.querySelector("#qtySearch");i?.focus();i?.setSelectionRange(i.value.length,i.value.length)});
  });
  mountEl.querySelector("#newOrderRequestBtn")?.addEventListener("click",()=>editRequest(null));
  mountEl.querySelector("#uploadRevisionBtn")?.addEventListener("click",()=>uploadRevisionDialog(false));
  mountEl.querySelector("#uploadRevisionInlineBtn")?.addEventListener("click",()=>uploadRevisionDialog(false));
  mountEl.querySelector("#refreshBoqStructureBtn")?.addEventListener("click",refreshActiveRevisionStructure);
  mountEl.querySelector("#exportQtyCsvBtn")?.addEventListener("click",exportCsv);
  mountEl.querySelectorAll("[data-request-view]").forEach(b=>b.addEventListener("click",()=>viewRequest(b.dataset.requestView)));
  mountEl.querySelectorAll("[data-request-edit]").forEach(b=>b.addEventListener("click",()=>editRequest(b.dataset.requestEdit)));
  mountEl.querySelectorAll("[data-qty-history]").forEach(b=>b.addEventListener("click",()=>itemHistory(b.dataset.qtyHistory)));
  mountEl.querySelectorAll("[data-qty-vo]").forEach(b=>b.addEventListener("click",()=>createVariationFromRow(b.dataset.qtyVo)));
  mountEl.querySelectorAll("[data-revision-compare]").forEach(b=>b.addEventListener("click",()=>compareRevisionDialog(b.dataset.revisionCompare)));
  mountEl.querySelectorAll("[data-revision-activate]").forEach(b=>b.addEventListener("click",()=>activateRevision(b.dataset.revisionActivate)));
  mountEl.querySelectorAll("[data-revision-delete]").forEach(b=>b.addEventListener("click",()=>deleteDraftRevision(b.dataset.revisionDelete)));
}

async function initializeBaseline(){
  if(!can("quantityBaselineCreate"))return;
  const existing=await refs.quantityBaselineProject(projectId).once("value");
  if(existing.exists()){toast("Baseline đã tồn tại. Hãy quản lý bằng BOQ Revision.","warning");await reload();return}

  const boq=await arr(refs.boqProject(projectId));
  if(!boq.length){toast("Dự án chưa có BOQ để tạo R0.","error");return}
  if(!await confirmBox("Khóa Tender R0",`Khóa ${boq.length} đầu mục BOQ hiện tại thành R0 – BOQ đấu thầu/trúng thầu? R0 sẽ được giữ để so sánh vĩnh viễn.`,"Khóa R0"))return;

  const items={};
  let total=0;
  boq.forEach(x=>{
    const c=calcBoq(x);
    items[x.id]={
      sourceBoqId:x.id,itemNo:x.itemNo||"",discipline:x.discipline||"KHÁC",category:x.category||"",
      description:x.description||"",specification:x.specification||"",unit:x.unit||"",
      qty:Number(x.qty||0),materialUnit:Number(x.materialUnit||0),laborUnit:Number(x.laborUnit||0),
      subcontractUnit:Number(x.subcontractUnit||0),otherUnit:Number(x.otherUnit||0),
      wastePct:Number(x.wastePct||0),markupPct:Number(x.markupPct||0),
      netUnit:c.netUnit,bidUnit:c.bidUnit,selectedSupplier:x.selectedSupplier||"",brand:x.brand||"",
      lineStatus:"ACTIVE",createdAt:Date.now()
    };
    total+=Number(x.qty||0)*c.bidUnit;
  });

  const u=getProfile()||{};
  const revisionId=refs.quantityBoqRevisionsProject(projectId).push().key;
  const revision={
    code:"R0",revisionNo:0,name:"BOQ đấu thầu / Trúng thầu",type:"TENDER",effectiveDate:todayIso(),
    status:"ACTIVE",source:"CURRENT_BOQ",sourceFileName:"",lineCount:Object.keys(items).length,totalBidValue:total,
    createdAt:Date.now(),createdByUid:u.uid||"",createdByName:u.displayName||u.email||"",
    activatedAt:Date.now(),activatedByUid:u.uid||"",activatedByName:u.displayName||u.email||"",
    items
  };

  const meta={
    source:"BOQ_AT_EXECUTION",frozenAt:Date.now(),frozenByUid:u.uid||"",frozenByName:u.displayName||"",frozenByEmail:u.email||"",
    lineCount:Object.keys(items).length,totalBidValue:total,
    tenderRevisionId:revisionId,tenderRevisionCode:"R0",
    activeRevisionId:revisionId,activeRevisionCode:"R0",activeRevisionName:revision.name,
    activeEffectiveDate:revision.effectiveDate,activatedAt:Date.now(),activatedByName:u.displayName||u.email||""
  };

  await Promise.all([
    refs.quantityBoqRevision(projectId,revisionId).set(revision),
    refs.quantityBaselineProject(projectId).set(items),
    refs.quantityBaselineMeta(projectId).set(meta)
  ]);
  await audit("BASELINE_CREATED",`Khóa Tender R0 · ${Object.keys(items).length} đầu mục · ${money(total)}`,{revisionId,revisionCode:"R0"});
  await logActivity("QTY_BASELINE_CREATED",`Khóa Tender R0 ${Object.keys(items).length} đầu mục`,{projectId,revisionId});
  toast("Đã khóa R0 và kích hoạt làm Baseline.");await reload();
}

async function migrateLegacyBaselineToR0(){
  if(!baseline.length||revisions.length||!can("quantityRevisionActivate"))return;
  const u=getProfile()||{},items={};
  baseline.forEach(b=>{const {id,...rest}=b;items[id]={...rest,lineStatus:rest.lineStatus||"ACTIVE"}});
  const total=Object.values(items).reduce((sum,x)=>sum+Number(x.qty||0)*Number(x.bidUnit||0),0);
  const revisionId=refs.quantityBoqRevisionsProject(projectId).push().key;
  const revision={
    code:"R0",revisionNo:0,name:"BOQ đấu thầu / Trúng thầu",type:"TENDER",
    effectiveDate:baselineMeta.activeEffectiveDate||todayIso(),status:"ACTIVE",source:"MIGRATED_V2_7",
    lineCount:Object.keys(items).length,totalBidValue:total,items,
    createdAt:baselineMeta.frozenAt||Date.now(),createdByUid:baselineMeta.frozenByUid||u.uid||"",
    createdByName:baselineMeta.frozenByName||u.displayName||u.email||"",
    activatedAt:baselineMeta.frozenAt||Date.now(),activatedByUid:u.uid||"",activatedByName:u.displayName||u.email||""
  };
  await refs.quantityBoqRevision(projectId,revisionId).set(revision);
  await refs.quantityBaselineMeta(projectId).update({
    tenderRevisionId:revisionId,tenderRevisionCode:"R0",
    activeRevisionId:revisionId,activeRevisionCode:"R0",activeRevisionName:revision.name,
    activeEffectiveDate:revision.effectiveDate,activatedAt:baselineMeta.frozenAt||Date.now()
  });
  revisions=[{id:revisionId,...revision}];
  tenderRevision=revisions[0];activeRevision=revisions[0];
  baselineMeta={...baselineMeta,tenderRevisionId:revisionId,activeRevisionId:revisionId,activeRevisionCode:"R0",activeRevisionName:revision.name};
  await audit("REVISION_MIGRATED",`Nâng Baseline V2.7 thành Tender R0 · ${baseline.length} đầu mục`,{revisionId});
}

function revisionsHtml(){
  const ordered=[...revisions].sort((a,b)=>Number(a.revisionNo||0)-Number(b.revisionNo||0));
  return `<div class="page-head" style="margin-bottom:12px">
    <div><h2 style="font-size:17px">BOQ Revision & Baseline hợp đồng</h2><p>R0 luôn giữ BOQ đấu thầu. R1/R2/R3 là BOQ hợp đồng/phụ lục; chỉ một Revision được dùng làm Baseline đặt hàng.</p></div>
    ${can("quantityRevisionManage")?`<button class="btn primary" id="uploadRevisionInlineBtn">＋ Tải BOQ Revision</button>`:""}
  </div>

  <div class="revision-flow">
    <div><b>R0 Tender</b><span>Giữ nguyên lịch sử đấu thầu</span></div><i>→</i>
    <div><b>R1/R2/R3...</b><span>Hợp đồng / Phụ lục</span></div><i>→</i>
    <div><b>Baseline đang áp dụng</b><span>${esc(activeRevision?.code||"R0")} · dùng để so phiếu đặt hàng</span></div>
  </div>

  <div class="table-wrap mt"><table class="table revision-table"><thead><tr>
    <th>REV</th><th>LOẠI</th><th>TÊN PHIÊN BẢN</th><th>NGÀY HIỆU LỰC</th><th>SỐ DÒNG</th>
    <th>GIÁ TRỊ BOQ</th><th>Δ SO TENDER R0</th><th>TRẠNG THÁI</th><th>NGUỒN</th><th>NGƯỜI TẠO</th><th style="text-align:right">THAO TÁC</th>
  </tr></thead><tbody>
    ${ordered.length?ordered.map(revisionRow).join(""):`<tr><td colspan="11">${empty("Chưa có Revision","Khởi tạo R0 trước khi tải BOQ hợp đồng.","R")}</td></tr>`}
  </tbody></table></div>

  <div class="revision-help mt">
    <b>Nguyên tắc:</b> kích hoạt Revision mới không xóa phiếu đặt hàng cũ. Hệ thống giữ cùng mã định danh cho các đầu mục được map,
    vì vậy toàn bộ khối lượng đã đặt sẽ được tính lại trên Baseline mới. Đầu mục bị loại khỏi Revision mới có Baseline = 0 và mọi khối lượng đã đặt của đầu mục đó sẽ trở thành vượt công trường.
  </div>`;
}

function revisionRow(r){
  const tenderItems=tenderRevision?.items||{};
  const currentItems=r.items||{};
  const tenderValue=revisionTotal(tenderItems),value=revisionTotal(currentItems),delta=value-tenderValue;
  const st=r.status==="ACTIVE"?["Đang áp dụng","green"]:r.status==="DRAFT"?["Chờ áp dụng","orange"]:["Lịch sử","gray"];
  const typeLabel={TENDER:"Tender R0",CONTRACT:"BOQ Hợp đồng",ADDENDUM:"Phụ lục",OTHER:"Revision khác"}[r.type]||r.type||"Revision";
  return `<tr class="${r.status==="ACTIVE"?"revision-active-row":""}">
    <td><b>${esc(r.code||`R${r.revisionNo||0}`)}</b></td><td>${badge(typeLabel,r.type==="TENDER"?"blue":r.type==="CONTRACT"?"purple":"gray")}</td>
    <td><div class="primary-text">${esc(r.name||"—")}</div></td><td>${fmtDate(r.effectiveDate)}</td>
    <td>${Number(r.lineCount||Object.keys(currentItems).length)}</td><td>${money(value)}</td>
    <td class="${delta>0?"danger-text":delta<0?"positive-text":""}"><b>${signedMoney(delta)}</b></td>
    <td>${badge(st[0],st[1])}</td><td>${esc(r.sourceFileName||r.source||"—")}</td><td>${esc(r.createdByName||"—")}</td>
    <td><div class="row-actions">
      <button class="btn sm" data-revision-compare="${r.id}">So sánh</button>
      ${r.status==="DRAFT"&&can("quantityRevisionActivate")?`<button class="btn green sm" data-revision-activate="${r.id}">Áp dụng Baseline</button>`:""}
      ${r.status==="DRAFT"&&can("quantityRevisionManage")?`<button class="btn red sm" data-revision-delete="${r.id}">Xóa</button>`:""}
    </div></td>
  </tr>`;
}

const REVISION_HEADER_ALIASES={
  itemNo:["muc","mục","stt","item no","item","no","ma boq","mã boq","ma","mã"],
  discipline:["he","hệ","he thong","hệ thống","system","discipline"],
  category:["nhom","nhóm","hang muc","hạng mục","category","group"],
  description:["dien giai","diễn giải","mo ta","mô tả","mo ta cong viec","mô tả công việc","noi dung","nội dung","noi dung cong viec","nội dung công việc","ten vat tu","tên vật tư","ten hang","tên hàng","description","item description","work description"],
  specification:["model thong so ky thuat","model/thông số kỹ thuật","model","thong so ky thuat","thông số kỹ thuật","thong so","thông số","quy cach","quy cách","spec","specification","kich thuoc","kích thước"],
  brand:["nhan hieu","nhãn hiệu","thuong hieu","thương hiệu","brand","manufacturer"],
  origin:["xuat xu","xuất xứ","origin","country of origin","co"],
  unit:["don vi","đơn vị","dvt","đvt","unit","uom"],
  qty:["khoi luong","khối lượng","kl","so luong","số lượng","qty","quantity","boq qty","contract quantity"],
  bidUnit:["don gia vnd tong cong","đơn giá vnd tổng cộng","tong cong","tổng cộng","gia chao/dvt","giá chào/đvt","gia chao","giá chào","don gia hd","đơn giá hđ","don gia hop dong","đơn giá hợp đồng","don gia","đơn giá","unit price","unit rate","bid unit price","gia ban","giá bán"],
  materialUnit:["don gia vnd vat tu chinh","đơn giá vnd vật tư chính","vat tu chinh","vật tư chính","gia vat tu","giá vật tư","material unit","material price"],
  laborUnit:["don gia vnd nhan cong va vat tu phu","đơn giá vnd nhân công và vật tư phụ","nhan cong va vat tu phu","nhân công và vật tư phụ","gia nhan cong","giá nhân công","nhan cong","nhân công","labor unit","labor price"],
  subcontractUnit:["gia thau phu","giá thầu phụ","thau phu","thầu phụ","subcontract unit","subcontract price"],
  otherUnit:["gia khac","giá khác","khac","khác","other unit","other price"],
  wastePct:["hao hut %","hao hụt %","hao hut","hao hụt","waste %","wastage %"],
  markupPct:["markup %","loi nhuan %","lợi nhuận %","margin %"]
};

function uploadRevisionDialog(isTenderR0=false){
  if(!can("quantityRevisionManage"))return;
  if(isTenderR0&&baseline.length){toast("Dự án đã có R0/Baseline.","warning");return}
  if(!isTenderR0&&!tenderRevision){toast("Cần tạo Tender R0 trước khi tải Revision hợp đồng.","error");return}
  if(!isTenderR0&&revisions.some(x=>x.status==="DRAFT")){
    toast("Đang có một Revision Chờ áp dụng. Hãy kiểm tra/kích hoạt hoặc xóa Revision đó trước khi tải phiên bản tiếp theo.","warning");
    view="REVISIONS";paint();return;
  }

  const nextNo=isTenderR0?0:nextRevisionNo();
  const code=`R${nextNo}`;
  modal({
    title:isTenderR0?"Tải Tender R0 từ Excel / CSV":`Tải BOQ ${code}`,
    eyebrow:isTenderR0?"BOQ ĐẤU THẦU / TRÚNG THẦU":"BOQ HỢP ĐỒNG / PHỤ LỤC",
    size:"lg",submitText:isTenderR0?"Tạo R0":"Tải & So sánh",
    body:`<div class="revision-upload-note">
      ${isTenderR0
        ?"<b>R0 sẽ là mốc gốc.</b> Có thể tải Excel .xlsx/.xls hoặc CSV. File cần có tối thiểu Mô tả và Khối lượng."
        :`File mới sẽ được lưu thành <b>${code} – Chờ áp dụng</b>. Hỗ trợ Excel .xlsx/.xls và CSV. Khối lượng đặt hàng chưa thay đổi cho tới khi bấm “Áp dụng Baseline”.`}
    </div>
    <div class="form-grid mt">
      <label class="field"><span>Mã Revision</span><input name="code" value="${code}" readonly></label>
      <label class="field"><span>Loại Revision</span><select name="type">
        ${isTenderR0?`<option value="TENDER">Tender R0</option>`:`<option value="CONTRACT">BOQ Hợp đồng</option><option value="ADDENDUM">Phụ lục hợp đồng</option><option value="OTHER">Revision khác</option>`}
      </select></label>
      <label class="field span2"><span>Tên phiên bản *</span><input required name="name" value="${isTenderR0?"BOQ đấu thầu / Trúng thầu":code+" - BOQ Hợp đồng"}"></label>
      <label class="field"><span>Ngày hiệu lực *</span><input required type="date" name="effectiveDate" value="${todayIso()}"></label>
      <label class="field"><span>File BOQ Excel / CSV *</span>
        <input required type="file" name="revisionFile" id="revisionFile" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv">
        <small>Hỗ trợ .xlsx, .xls và .csv</small>
      </label>

      <label class="field hidden" id="revisionSheetWrap"><span>Sheet cần nhập *</span>
        <select name="revisionSheet" id="revisionSheet"></select>
        <small>Nếu Excel có nhiều Sheet, chọn đúng Sheet chứa BOQ.</small>
      </label>
      <label class="field hidden" id="revisionHeaderRowWrap"><span>Dòng tiêu đề bắt đầu</span>
        <input type="number" min="1" step="1" name="revisionHeaderRow" id="revisionHeaderRow" value="1">
        <small>Hệ thống tự nhận; có thể sửa nếu phía trên có tên dự án/ghi chú.</small>
      </label>
      <label class="field hidden" id="revisionHeaderDepthWrap"><span>Số hàng tiêu đề</span>
        <select name="revisionHeaderDepth" id="revisionHeaderDepth">
          <option value="1">1 hàng</option>
          <option value="2">2 hàng</option>
          <option value="3">3 hàng</option>
        </select>
        <small>Tự nhận 1–3 hàng, kể cả tiêu đề có ô gộp.</small>
      </label>

      <div class="span2 hidden revision-file-preview" id="revisionFilePreview"></div>

      <label class="field span2"><span>Ghi chú</span><textarea name="notes" placeholder="Ví dụ: BOQ theo HĐ số..., Phụ lục 01..."></textarea></label>
    </div>
    <div class="revision-template-box">
      <span>Không bắt buộc đúng thứ tự cột. Hệ thống tự nhận STT/Mã, Hệ, Nhóm, Mô tả/Nội dung, Thông số/Quy cách, ĐVT/Đơn vị, Khối lượng/Số lượng, Giá chào/ĐVT hoặc Giá vật tư/Nhân công/Thầu phụ/Khác.</span>
      <div class="row-actions">
        <button type="button" class="btn sm" id="downloadRevisionExcelTemplateBtn">Tải mẫu Excel</button>
        <button type="button" class="btn sm" id="downloadRevisionCsvTemplateBtn">Tải mẫu CSV</button>
      </div>
    </div>`,
    onSubmit:async fd=>{
      try{
        const file=fd.get("revisionFile");
        if(!(file instanceof File)||!file.size){toast("Vui lòng chọn file Excel hoặc CSV.","error");return false}

        const sheetName=String(fd.get("revisionSheet")||"");
        const headerRow=Math.max(1,Number(fd.get("revisionHeaderRow")||1));
        const headerDepth=Math.min(3,Math.max(1,Number(fd.get("revisionHeaderDepth")||1)));
        const parsedInfo=await parseRevisionSpreadsheet(file,{sheetName,headerRow,headerDepth});
        const parsed=parsedInfo.rows;
        if(!parsed.length){toast("Không có dòng BOQ hợp lệ trong Sheet đã chọn. Hệ thống đã thử tự nhận lại tiêu đề nhưng vẫn không đọc được Khối lượng.","error");return false}
        if(parsedInfo.autoCorrected){
          toast(`Đã tự sửa nhận diện tiêu đề thành dòng ${parsedInfo.headerRow}${parsedInfo.headerDepth>1?`–${parsedInfo.headerRow+parsedInfo.headerDepth-1}`:""} (${parsedInfo.headerDepth} hàng).`,"warning");
        }

        const items=mapRevisionItems(parsed);
        const displayRows=attachStableIdsToStructure(parsedInfo.structureRows,items);
        const u=getProfile()||{},revisionId=refs.quantityBoqRevisionsProject(projectId).push().key;
        const total=revisionTotal(items);
        const ext=fileExtension(file.name);
        const sourceType=["xlsx","xls"].includes(ext)?"EXCEL_UPLOAD":"CSV_UPLOAD";
        const revision={
          code:String(fd.get("code")||code),revisionNo:nextNo,type:String(fd.get("type")||"CONTRACT"),
          name:String(fd.get("name")||code),effectiveDate:String(fd.get("effectiveDate")||todayIso()),
          notes:String(fd.get("notes")||""),status:isTenderR0?"ACTIVE":"DRAFT",
          source:sourceType,sourceFileName:file.name,sourceSheetName:parsedInfo.sheetName||"",
          sourceHeaderRow:parsedInfo.headerRow,sourceHeaderDepth:parsedInfo.headerDepth,
          sourceHeaders:parsedInfo.sourceHeaders||[],
          sourceGrid:parsedInfo.sourceGrid||null,
          lineCount:Object.keys(items).length,structureLineCount:displayRows.length,totalBidValue:total,
          createdAt:Date.now(),createdByUid:u.uid||"",createdByName:u.displayName||u.email||"",
          displayRows,items
        };

        if(isTenderR0){
          revision.activatedAt=Date.now();revision.activatedByUid=u.uid||"";revision.activatedByName=u.displayName||u.email||"";
          const baselineItems=materializeBaseline(items);
          const meta={
            source:sourceType==="EXCEL_UPLOAD"?"EXCEL_R0":"CSV_R0",
            frozenAt:Date.now(),frozenByUid:u.uid||"",frozenByName:u.displayName||"",frozenByEmail:u.email||"",
            lineCount:Object.keys(baselineItems).length,totalBidValue:total,
            tenderRevisionId:revisionId,tenderRevisionCode:"R0",
            activeRevisionId:revisionId,activeRevisionCode:"R0",activeRevisionName:revision.name,
            activeEffectiveDate:revision.effectiveDate,activatedAt:Date.now(),activatedByName:u.displayName||u.email||""
          };
          await Promise.all([
            refs.quantityBoqRevision(projectId,revisionId).set(revision),
            refs.quantityBaselineProject(projectId).set(baselineItems),
            refs.quantityBaselineMeta(projectId).set(meta)
          ]);
          await audit("R0_UPLOADED",`Tải Tender R0 từ ${file.name}${parsedInfo.sheetName?` / ${parsedInfo.sheetName}`:""} · ${Object.keys(items).length} đầu mục`,{revisionId,revisionCode:"R0"});
          toast("Đã tạo Tender R0. Đang mở nguyên bảng BOQ gốc.");
          await reload();view="SOURCE";paint();return true;
        }

        await refs.quantityBoqRevision(projectId,revisionId).set(revision);
        await audit("REVISION_UPLOADED",`Tải ${revision.code} từ ${file.name}${parsedInfo.sheetName?` / ${parsedInfo.sheetName}`:""} · ${Object.keys(items).length} đầu mục`,{revisionId,revisionCode:revision.code});
        await logActivity("QTY_REVISION_UPLOADED",`Tải ${revision.code} - ${revision.name}`,{projectId,revisionId});
        toast(`Đã tải ${revision.code}. Hãy kiểm tra so sánh trước khi áp dụng.`);
        await reload();view="REVISIONS";paint();compareRevisionDialog(revisionId);return false;
      }catch(e){
        console.error(e);toast(e.message||"Không thể đọc BOQ Revision.","error");return false;
      }
    }
  });

  const fileInput=document.querySelector("#revisionFile");
  const sheetSelect=document.querySelector("#revisionSheet");
  const headerInput=document.querySelector("#revisionHeaderRow");
  const headerDepthSelect=document.querySelector("#revisionHeaderDepth");

  fileInput?.addEventListener("change",async()=>{
    const file=fileInput.files?.[0];
    if(!file){resetRevisionFileUi();return}
    try{
      const inspection=await inspectRevisionSpreadsheet(file);
      fileInput._revisionInspection=inspection;
      renderRevisionFileInspection(inspection);
    }catch(e){
      console.error(e);resetRevisionFileUi();
      toast(e.message||"Không thể đọc file Excel/CSV.","error");
    }
  });

  sheetSelect?.addEventListener("change",()=>{
    const inspection=fileInput?._revisionInspection;
    if(!inspection)return;
    const meta=inspection.sheets?.[sheetSelect.value];
    if(meta){
      headerInput.value=meta.headerRow;
      if(headerDepthSelect)headerDepthSelect.value=String(meta.headerDepth||1);
      renderRevisionFilePreview(inspection,sheetSelect.value,meta.headerRow,meta.headerDepth||1);
    }
  });

  headerInput?.addEventListener("input",()=>{
    const inspection=fileInput?._revisionInspection;
    if(!inspection)return;
    renderRevisionFilePreview(
      inspection,
      sheetSelect?.value||inspection.defaultSheet,
      Math.max(1,Number(headerInput.value||1)),
      Math.min(3,Math.max(1,Number(headerDepthSelect?.value||1)))
    );
  });
  headerDepthSelect?.addEventListener("change",()=>{
    const inspection=fileInput?._revisionInspection;
    if(!inspection)return;
    renderRevisionFilePreview(
      inspection,
      sheetSelect?.value||inspection.defaultSheet,
      Math.max(1,Number(headerInput?.value||1)),
      Math.min(3,Math.max(1,Number(headerDepthSelect.value||1)))
    );
  });

  document.querySelector("#downloadRevisionExcelTemplateBtn")?.addEventListener("click",downloadRevisionExcelTemplate);
  document.querySelector("#downloadRevisionCsvTemplateBtn")?.addEventListener("click",downloadRevisionTemplate);
}

async function inspectRevisionSpreadsheet(file){
  const ext=fileExtension(file.name);
  if(!["xlsx","xls","csv"].includes(ext))throw new Error("Chỉ hỗ trợ file .xlsx, .xls hoặc .csv.");

  if(ext==="csv"){
    const text=await file.text(),aoa=parseCsv(text);
    const detected=detectRevisionHeader(aoa);
    return {
      kind:"CSV",fileName:file.name,defaultSheet:"CSV",
      sheets:{CSV:{
        aoa,rawAoa:aoa,merges:[],
        sourceGrid:buildSourceGridFromAoa(aoa),
        headerRow:detected.headerRow,headerDepth:detected.headerDepth,score:detected.score
      }}
    };
  }

  const XLSX=globalThis.XLSX;
  if(!XLSX)throw new Error("Thư viện đọc Excel chưa tải được. Kiểm tra kết nối Internet rồi tải lại trang.");
  const buffer=await file.arrayBuffer();
  const workbook=XLSX.read(buffer,{type:"array",cellDates:false,cellText:true,raw:true,cellStyles:true});
  if(!workbook.SheetNames?.length)throw new Error("File Excel không có Sheet.");

  const sheets={};
  workbook.SheetNames.forEach(name=>{
    const ws=workbook.Sheets[name];
    // blankrows:true để dòng Excel hiển thị đúng số dòng thật.
    const rawAoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true,blankrows:true});
    const merges=Array.isArray(ws["!merges"])?ws["!merges"]:[];
    // Trải giá trị ô gộp xuống vùng merge để các tiêu đề 2 tầng như
    // "Đơn giá (VND)" -> "Vật tư chính / Nhân công... / Tổng cộng" được hiểu đúng.
    const aoa=expandMergedHeaderCells(rawAoa,merges);
    const detected=detectRevisionHeader(aoa);
    sheets[name]={
      aoa,rawAoa,merges,
      sourceGrid:{...buildSourceGridFromWorksheet(ws,XLSX),sheetName:name},
      headerRow:detected.headerRow,
      headerDepth:detected.headerDepth,
      score:detected.score
    };
  });

  const defaultSheet=[...workbook.SheetNames].sort((a,b)=>(sheets[b]?.score||0)-(sheets[a]?.score||0))[0];
  return {kind:"EXCEL",fileName:file.name,workbook,sheets,defaultSheet};
}

function buildSourceGridFromWorksheet(ws,XLSX){
  if(!ws?.["!ref"])return buildSourceGridFromAoa([]);

  const range=XLSX.utils.decode_range(ws["!ref"]);
  const startRow=range.s.r,startCol=range.s.c,endRow=range.e.r,endCol=range.e.c;
  const rowCount=endRow-startRow+1,colCount=endCol-startCol+1;
  const rows=[],styles={};

  for(let r=startRow;r<=endRow;r++){
    const out=[];
    for(let c=startCol;c<=endCol;c++){
      const addr=XLSX.utils.encode_cell({r,c});
      const cell=ws[addr];
      out.push(sourceCellDisplayValue(cell,XLSX));
      const st=extractSourceGridStyle(cell);
      if(st)styles[`${r-startRow}_${c-startCol}`]=st;
    }
    rows.push(out);
  }

  const merges=(ws["!merges"]||[])
    .filter(m=>m.e.r>=startRow&&m.s.r<=endRow&&m.e.c>=startCol&&m.s.c<=endCol)
    .map(m=>({
      r1:Math.max(m.s.r,startRow)-startRow,
      c1:Math.max(m.s.c,startCol)-startCol,
      r2:Math.min(m.e.r,endRow)-startRow,
      c2:Math.min(m.e.c,endCol)-startCol
    }));

  const cols=ws["!cols"]||[];
  const colWidths=Array.from({length:colCount},(_,i)=>sourceColWidth(cols[startCol+i]));
  const rowMeta=ws["!rows"]||[];
  const rowHeights=Array.from({length:rowCount},(_,i)=>sourceRowHeight(rowMeta[startRow+i]));

  return {
    sheetName:"",
    range:ws["!ref"]||"",
    startRow:startRow+1,
    startCol,
    rowCount,
    colCount,
    rows,
    merges,
    colWidths,
    rowHeights,
    styles
  };
}

function buildSourceGridFromAoa(aoa){
  const rows=(aoa||[]).map(r=>(Array.isArray(r)?r:[]).map(v=>sourceCellValue(v)));
  const colCount=Math.max(0,...rows.map(r=>r.length));
  rows.forEach(r=>{while(r.length<colCount)r.push("")});

  const colWidths=Array.from({length:colCount},(_,c)=>{
    let max=8;
    for(let r=0;r<Math.min(rows.length,800);r++){
      const t=String(rows[r]?.[c]??"");
      max=Math.max(max,Math.min(48,t.length));
    }
    return Math.max(60,Math.min(360,max*7+18));
  });

  return {
    sheetName:"CSV",
    range:rows.length&&colCount?`A1:${excelColumnName(colCount-1)}${rows.length}`:"",
    startRow:1,startCol:0,rowCount:rows.length,colCount,
    rows,merges:[],colWidths,rowHeights:Array.from({length:rows.length},()=>22),styles:{}
  };
}

function sourceCellDisplayValue(cell,XLSX){
  if(!cell)return "";
  if(cell.w!==undefined&&cell.w!==null)return String(cell.w);
  try{
    const formatted=XLSX?.utils?.format_cell?.(cell);
    if(formatted!==undefined&&formatted!==null&&formatted!=="")return String(formatted);
  }catch{}
  const v=cell.v;
  if(v===undefined||v===null)return "";
  if(v instanceof Date)return v.toLocaleDateString("vi-VN");
  return String(v);
}

function sourceColWidth(info){
  if(info?.hidden)return 34;
  if(Number(info?.wpx)>0)return Math.max(34,Math.min(520,Math.round(Number(info.wpx))));
  if(Number(info?.wch)>0)return Math.max(34,Math.min(520,Math.round(Number(info.wch)*7+14)));
  if(Number(info?.width)>0)return Math.max(34,Math.min(520,Math.round(Number(info.width)*7+14)));
  return 96;
}

function sourceRowHeight(info){
  if(info?.hidden)return 18;
  if(Number(info?.hpx)>0)return Math.max(18,Math.min(240,Math.round(Number(info.hpx))));
  if(Number(info?.hpt)>0)return Math.max(18,Math.min(240,Math.round(Number(info.hpt)*96/72)));
  return 22;
}

function extractSourceGridStyle(cell){
  const s=cell?.s;
  if(!s||typeof s!=="object")return null;
  const o={};

  const a=s.alignment||{};
  const h=String(a.horizontal||"").toLowerCase();
  const v=String(a.vertical||"").toLowerCase();
  if(["left","center","right","justify"].includes(h))o.h=h;
  if(["top","center","bottom"].includes(v))o.v=v==="center"?"middle":v;
  if(a.wrapText)o.w=1;

  const f=s.font||{};
  if(f.bold)o.b=1;
  if(f.italic)o.i=1;
  if(f.name)o.ff=String(f.name);
  if(Number(f.sz)>0)o.fs=Number(f.sz);
  const fg=sourceRgb(f.color);
  if(fg)o.fg=fg;

  const fill=s.fill||{};
  const bg=sourceRgb(fill.fgColor)||sourceRgb(fill.bgColor);
  if(bg)o.bg=bg;

  return Object.keys(o).length?o:null;
}

function sourceRgb(c){
  let rgb=String(c?.rgb||"").replace(/^FF/i,"").toUpperCase();
  if(/^[0-9A-F]{6}$/.test(rgb))return `#${rgb}`;
  return "";
}

function expandMergedHeaderCells(source,merges){
  const aoa=(source||[]).map(r=>Array.isArray(r)?[...r]:[]);
  (merges||[]).forEach(m=>{
    const sr=Number(m?.s?.r),sc=Number(m?.s?.c),er=Number(m?.e?.r),ec=Number(m?.e?.c);
    if(!Number.isInteger(sr)||!Number.isInteger(sc)||!Number.isInteger(er)||!Number.isInteger(ec))return;
    const value=aoa[sr]?.[sc];
    if(value===undefined||value===null||String(value).trim()==="")return;
    for(let r=sr;r<=er;r++){
      if(!aoa[r])aoa[r]=[];
      for(let c=sc;c<=ec;c++){
        if(aoa[r][c]===undefined||aoa[r][c]===null||String(aoa[r][c]).trim()==="")aoa[r][c]=value;
      }
    }
  });
  return aoa;
}

function renderRevisionFileInspection(inspection){
  const sheetWrap=document.querySelector("#revisionSheetWrap");
  const headerWrap=document.querySelector("#revisionHeaderRowWrap");
  const depthWrap=document.querySelector("#revisionHeaderDepthWrap");
  const sheet=document.querySelector("#revisionSheet");
  const header=document.querySelector("#revisionHeaderRow");
  const depth=document.querySelector("#revisionHeaderDepth");

  if(inspection.kind==="EXCEL"){
    sheetWrap?.classList.remove("hidden");
    if(sheet)sheet.innerHTML=Object.keys(inspection.sheets).map(name=>{
      const m=inspection.sheets[name];
      const start=Number(m.headerRow||1),d=Number(m.headerDepth||1);
      const label=d>1?`tiêu đề ${start}–${start+d-1}`:`tiêu đề ${start}`;
      return `<option value="${esc(name)}" ${name===inspection.defaultSheet?"selected":""}>${esc(name)} · ${label}</option>`;
    }).join("");
  }else{
    sheetWrap?.classList.add("hidden");
    if(sheet)sheet.innerHTML=`<option value="CSV">CSV</option>`;
  }

  headerWrap?.classList.remove("hidden");
  depthWrap?.classList.remove("hidden");
  const meta=inspection.sheets[inspection.defaultSheet];
  if(header)header.value=meta?.headerRow||1;
  if(depth)depth.value=String(meta?.headerDepth||1);
  renderRevisionFilePreview(inspection,inspection.defaultSheet,meta?.headerRow||1,meta?.headerDepth||1);
}

function renderRevisionFilePreview(inspection,sheetName,headerRow,headerDepth=1){
  const box=document.querySelector("#revisionFilePreview");
  if(!box)return;
  const meta=inspection.sheets?.[sheetName]||inspection.sheets?.[inspection.defaultSheet];
  const aoa=meta?.aoa||[];
  const rowIndex=Math.max(0,Number(headerRow||1)-1);
  const depth=Math.min(3,Math.max(1,Number(headerDepth||1)));
  const analyzed=analyzeRevisionHeaders(aoa,rowIndex,depth);
  const headers=analyzed.displayHeaders.filter(Boolean);
  const dataRows=Math.max(0,aoa.length-rowIndex-depth);
  const endRow=rowIndex+depth;
  const headerLabel=depth>1?`${rowIndex+1}–${endRow}`:`${rowIndex+1}`;

  box.classList.remove("hidden");
  box.innerHTML=`<div class="revision-file-preview-head">
      <div><b>${inspection.kind==="EXCEL"?"Excel":"CSV"} · ${esc(inspection.fileName)}</b>
        <span>${inspection.kind==="EXCEL"?`Sheet: ${esc(sheetName)} · `:""}Tiêu đề: dòng ${headerLabel} (${depth} hàng) · khoảng ${dataRows} dòng dữ liệu</span>
      </div>
      ${analyzed.valid&&analyzed.validRows>0?badge(`Đã nhận ${analyzed.validRows} dòng BOQ`,"green"):analyzed.valid?badge("Nhận tiêu đề nhưng chưa thấy dòng KL hợp lệ","orange"):badge("Cần kiểm tra tiêu đề","orange")}
    </div>
    <div class="revision-file-columns">${headers.slice(0,16).map(h=>`<span>${esc(h)}</span>`).join("")}${headers.length>16?`<span>+${headers.length-16} cột</span>`:""}</div>
    <div class="revision-detected-map">
      ${detectedFieldPill("Mô tả",analyzed.map.description,analyzed.displayHeaders)}
      ${detectedFieldPill("ĐVT",analyzed.map.unit,analyzed.displayHeaders)}
      ${detectedFieldPill("Khối lượng",analyzed.map.qty,analyzed.displayHeaders)}
      ${detectedFieldPill("Model/Thông số",analyzed.map.specification,analyzed.displayHeaders)}
      ${detectedFieldPill("Nhãn hiệu",analyzed.map.brand,analyzed.displayHeaders)}
      ${detectedFieldPill("Xuất xứ",analyzed.map.origin,analyzed.displayHeaders)}
      ${detectedFieldPill("Giá vật tư",analyzed.map.materialUnit,analyzed.displayHeaders)}
      ${detectedFieldPill("Nhân công + VTP",analyzed.map.laborUnit,analyzed.displayHeaders)}
      ${detectedFieldPill("Tổng đơn giá",analyzed.map.bidUnit,analyzed.displayHeaders)}
    </div>
    ${!analyzed.valid?`<div class="revision-file-warning">Chưa nhận ra đủ <b>Mô tả/Diễn giải</b> và <b>Khối lượng/Số lượng</b>. Hãy đổi “Dòng tiêu đề bắt đầu” hoặc “Số hàng tiêu đề”.</div>`:
      analyzed.validRows===0?`<div class="revision-file-warning">Đã nhận tên cột nhưng chưa tìm thấy dòng nào có đồng thời <b>Diễn giải + Khối lượng dạng số</b>. Khi bấm Lưu, hệ thống sẽ tự thử lại các cấu trúc tiêu đề khác.</div>`:""}`;
}

function detectedFieldPill(label,index,headers){
  return `<span class="${index>=0?"ok":"miss"}">${index>=0?"✓":"×"} ${esc(label)}${index>=0?` → ${esc(headers[index]||"")}`:""}</span>`;
}

function resetRevisionFileUi(){
  document.querySelector("#revisionSheetWrap")?.classList.add("hidden");
  document.querySelector("#revisionHeaderRowWrap")?.classList.add("hidden");
  document.querySelector("#revisionHeaderDepthWrap")?.classList.add("hidden");
  document.querySelector("#revisionFilePreview")?.classList.add("hidden");
}

async function parseRevisionSpreadsheet(file,{sheetName="",headerRow=1,headerDepth=1}={}){
  const inspection=document.querySelector("#revisionFile")?._revisionInspection||await inspectRevisionSpreadsheet(file);
  const selected=sheetName&&inspection.sheets?.[sheetName]?sheetName:inspection.defaultSheet;
  const aoa=inspection.sheets?.[selected]?.aoa||[];
  const requestedRow=Math.max(0,Number(headerRow||1)-1);
  const requestedDepth=Math.min(3,Math.max(1,Number(headerDepth||1)));

  let rows=[];
  let usedRow=requestedRow,usedDepth=requestedDepth,autoCorrected=false;

  try{
    rows=parseRevisionAoa(aoa,requestedRow,requestedDepth);
  }catch(e){
    rows=[];
  }

  // Nếu cấu hình đang chọn đọc ra 0 dòng, tự quét lại 40 dòng đầu + 1–3 hàng tiêu đề.
  if(!rows.length){
    const detected=detectRevisionHeader(aoa);
    const altRow=Math.max(0,Number(detected.headerRow||1)-1);
    const altDepth=Math.min(3,Math.max(1,Number(detected.headerDepth||1)));
    const altRows=parseRevisionAoa(aoa,altRow,altDepth);
    if(altRows.length){
      rows=altRows;
      usedRow=altRow;
      usedDepth=altDepth;
      autoCorrected=altRow!==requestedRow||altDepth!==requestedDepth;
    }
  }

  const structureRows=parseRevisionStructure(aoa,usedRow,usedDepth);
  const sourceHeaders=analyzeRevisionHeaders(aoa,usedRow,usedDepth).displayHeaders.map(x=>String(x||""));
  return {
    rows,
    structureRows,
    sourceHeaders,
    sourceGrid:inspection.sheets?.[selected]?.sourceGrid||null,
    sheetName:inspection.kind==="EXCEL"?selected:"",
    headerRow:usedRow+1,
    headerDepth:usedDepth,
    autoCorrected
  };
}

function parseRevisionStructure(aoa,headerRowIndex,headerDepth=1){
  const depth=Math.min(3,Math.max(1,Number(headerDepth||1)));
  const analyzed=analyzeRevisionHeaders(aoa,headerRowIndex,depth);
  const map=analyzed.map;
  const out=[];

  for(let i=headerRowIndex+depth;i<aoa.length;i++){
    const r=aoa[i]||[];
    if(!r.some(x=>String(x??"").trim()))continue;
    const get=k=>map[k]>=0?(r[map[k]]??""):"";

    const itemNo=String(get("itemNo")??"").trim();
    const description=String(get("description")??"").trim();
    const unit=String(get("unit")??"").trim();
    const qtyPick=pickRevisionQtyValue(r,analyzed);
    const qtyRaw=qtyPick.value;
    const hasNumericQty=isRevisionNumeric(qtyRaw);
    if(!itemNo&&!description)continue;

    let rowType="NOTE";
    if(description&&hasNumericQty)rowType="ITEM";
    else if(/^ghi\s*chu\s*chung$/i.test(norm(description)))rowType="NOTE_HEADER";
    else if(isRevisionSectionRow(itemNo,description,unit))rowType="SECTION";

    out.push({
      sourceRow:i+1,
      sourceOrder:i-(headerRowIndex+depth),
      sourceValues:r.map(sourceCellValue),
      rowType,
      itemNo,
      discipline:String(get("discipline")||"").trim().toUpperCase(),
      category:String(get("category")||"").trim(),
      description,
      specification:String(get("specification")||"").trim(),
      brand:String(get("brand")||"").trim(),
      origin:String(get("origin")||"").trim(),
      unit,
      qty:hasNumericQty?toNumber(qtyRaw):null,
      qtySourceColumn:qtyPick.index,qtySourceHeader:analyzed.displayHeaders[qtyPick.index]||"",
      bidUnit:toNumber(get("bidUnit")),
      materialUnit:toNumber(get("materialUnit")),
      laborUnit:toNumber(get("laborUnit")),
      subcontractUnit:toNumber(get("subcontractUnit")),
      otherUnit:toNumber(get("otherUnit"))
    });
  }
  return out;
}

function sourceCellValue(v){
  if(v===null||v===undefined)return "";
  if(typeof v==="number"||typeof v==="boolean")return v;
  return String(v);
}

function isRevisionSectionRow(itemNo,description,unit){
  const no=String(itemNo||"").trim();
  const desc=String(description||"").trim();
  const u=norm(unit||"");
  if(u==="note"||u==="ghi chu"||u==="ghi chú")return false;
  if(/ghi\s*chu/i.test(norm(desc)))return false;
  if(/^\d+(?:\.\d+)*\.?$/.test(no))return true;
  if(no&&/^[A-ZIVX]+(?:\.\d+)*$/i.test(no))return true;

  const letters=desc.replace(/[^A-Za-zÀ-ỹĐđ]/g,"");
  const upperLetters=desc.replace(/[^A-ZÀ-ỸĐ]/g,"");
  if(desc.length>3&&letters.length>0&&upperLetters.length/letters.length>=0.78&&!unit)return true;
  return false;
}

function attachStableIdsToStructure(structureRows,items){
  const bySourceRow=new Map();
  Object.entries(items||{}).forEach(([id,x])=>{
    if(Number(x.sourceRow||0)>0)bySourceRow.set(Number(x.sourceRow),id);
  });
  return (structureRows||[]).map(r=>({
    ...r,
    stableItemId:r.rowType==="ITEM"?(bySourceRow.get(Number(r.sourceRow))||""):""
  }));
}

function parseRevisionAoa(aoa,headerRowIndex,headerDepth=1){
  if(!Array.isArray(aoa)||aoa.length<=headerRowIndex)throw new Error("Sheet không có dữ liệu.");
  const depth=Math.min(3,Math.max(1,Number(headerDepth||1)));
  const analyzed=analyzeRevisionHeaders(aoa,headerRowIndex,depth);
  const map=analyzed.map;
  if(map.description<0||map.qty<0){
    const end=headerRowIndex+depth;
    throw new Error(`Tiêu đề dòng ${headerRowIndex+1}${depth>1?`–${end}`:""} chưa nhận được Mô tả/Diễn giải và Khối lượng.`);
  }

  const out=[];
  for(let i=headerRowIndex+depth;i<aoa.length;i++){
    const r=aoa[i]||[];
    if(!r.some(x=>String(x??"").trim()))continue;
    const get=k=>map[k]>=0?(r[map[k]]??""):"";
    const description=String(get("description")??"").trim();
    if(!description)continue;

    const qtyPick=pickRevisionQtyValue(r,analyzed);
    const qtyRaw=qtyPick.value;
    if(qtyRaw===null||qtyRaw===undefined||String(qtyRaw).trim()==="")continue;
    const qty=toNumber(qtyRaw);

    // Nếu cột KL chính trống, tự fallback sang KL/Số lượng khác có số trên cùng dòng.
    if(!isRevisionNumeric(qtyRaw))continue;

    const d={
      sourceRow:i+1,sourceOrder:i-(headerRowIndex+depth),
      qtySourceColumn:qtyPick.index,qtySourceHeader:analyzed.displayHeaders[qtyPick.index]||"",
      itemNo:String(get("itemNo")||out.length+1).trim(),
      discipline:String(get("discipline")||"KHÁC").trim().toUpperCase(),
      category:String(get("category")||"").trim(),
      description,
      specification:String(get("specification")||"").trim(),
      brand:String(get("brand")||"").trim(),
      origin:String(get("origin")||"").trim(),
      unit:String(get("unit")||"").trim(),
      qty,
      bidUnit:toNumber(get("bidUnit")),
      materialUnit:toNumber(get("materialUnit")),
      laborUnit:toNumber(get("laborUnit")),
      subcontractUnit:toNumber(get("subcontractUnit")),
      otherUnit:toNumber(get("otherUnit")),
      wastePct:toNumber(get("wastePct")),
      markupPct:toNumber(get("markupPct"))
    };
    out.push(d);
  }
  return out;
}

function pickRevisionQtyValue(row,analyzed){
  const primary=Number(analyzed?.map?.qty??-1);
  if(primary>=0&&isRevisionNumeric(row?.[primary]))return {value:row[primary],index:primary};

  const headers=analyzed?.headers||[];
  const aliases=(REVISION_HEADER_ALIASES.qty||[]).map(cleanRevisionHeader).filter(Boolean);
  const candidates=[];

  headers.forEach((h,i)=>{
    if(i===primary||!h)return;
    let score=headerSemanticScore(h,aliases,"qty");
    if(score<0)return;
    if(isRevisionNumeric(row?.[i]))candidates.push({i,score});
  });

  candidates.sort((a,b)=>b.score-a.score);
  if(candidates.length)return {value:row[candidates[0].i],index:candidates[0].i};
  return {value:primary>=0?row?.[primary]:"",index:primary};
}

function analyzeRevisionHeaders(aoa,rowIndex,headerDepth=1){
  const depth=Math.min(3,Math.max(1,Number(headerDepth||1)));
  const displayHeaders=buildCombinedRevisionHeaders(aoa,rowIndex,depth);
  const headers=displayHeaders.map(cleanRevisionHeader);
  const dataStart=rowIndex+depth;
  const map={};

  // Chọn Khối lượng trước dựa trên cả tên cột lẫn số lượng ô số phía dưới.
  map.qty=findBestHeaderMatchDataAware(headers,REVISION_HEADER_ALIASES.qty,"qty",aoa,dataStart,-1);

  // Mô tả ưu tiên cột có text cùng hàng với cột KL thực tế.
  map.description=findBestHeaderMatchDataAware(headers,REVISION_HEADER_ALIASES.description,"description",aoa,dataStart,map.qty);

  // Các cột còn lại ưu tiên dữ liệu cùng các dòng BOQ có KL.
  for(const key of ["itemNo","discipline","category","specification","brand","origin","unit","bidUnit","materialUnit","laborUnit","subcontractUnit","otherUnit","wastePct","markupPct"]){
    map[key]=findBestHeaderMatchDataAware(headers,REVISION_HEADER_ALIASES[key]||[],key,aoa,dataStart,map.qty);
  }

  const validRows=countRevisionValidRows(aoa,dataStart,map);
  return {
    map,
    valid:map.description>=0&&map.qty>=0,
    validRows,
    headers,
    displayHeaders,
    headerDepth:depth
  };
}

function buildCombinedRevisionHeaders(aoa,rowIndex,depth){
  let maxCols=0;
  for(let r=rowIndex;r<Math.min(aoa.length,rowIndex+depth);r++)maxCols=Math.max(maxCols,(aoa[r]||[]).length);
  const out=[];
  for(let c=0;c<maxCols;c++){
    const parts=[];
    for(let r=rowIndex;r<Math.min(aoa.length,rowIndex+depth);r++){
      const raw=String(aoa[r]?.[c]??"").trim();
      if(!raw)continue;
      const cleanedDisplay=raw.replace(/\s+/g," ").trim();
      if(!parts.some(x=>cleanRevisionHeader(x)===cleanRevisionHeader(cleanedDisplay)))parts.push(cleanedDisplay);
    }
    out[c]=parts.join(" / ");
  }
  return out;
}

function findBestHeaderMatchDataAware(headers,aliases,key,aoa,dataStart,qtyIndex=-1){
  const normalized=(aliases||[]).map(cleanRevisionHeader).filter(Boolean);
  let best=-1,bestScore=-Infinity;

  headers.forEach((h,i)=>{
    if(!h)return;
    let headerScore=headerSemanticScore(h,normalized,key);
    if(headerScore<0)return;

    const stats=columnDataStats(aoa,i,dataStart,qtyIndex);
    let dataScore=0;

    if(key==="qty"){
      dataScore=stats.numeric*7 + stats.nonEmpty*0.5;
      // Các cột dạng "KL xxx" cũng là ứng viên số lượng.
      if(h==="khoi luong")headerScore+=18;
      else if(h==="kl"||h.startsWith("kl "))headerScore+=8;
    }else if(key==="description"){
      dataScore=stats.text*3 + stats.coNumericQty*8 + stats.nonEmpty*0.5;
    }else if(key==="unit"){
      dataScore=stats.coNumericQty*4 + stats.shortText*2 + stats.nonEmpty*0.25;
    }else if(["bidUnit","materialUnit","laborUnit","subcontractUnit","otherUnit"].includes(key)){
      dataScore=stats.numeric*2 + stats.coNumericQty*3;
    }else{
      dataScore=stats.coNumericQty*2 + stats.nonEmpty*0.5;
    }

    const score=headerScore+dataScore;
    if(score>bestScore){bestScore=score;best=i}
  });

  return best;
}

function headerSemanticScore(h,aliases,key){
  let best=-1;
  for(const a of aliases){
    if(!a)continue;
    let score=-1;
    if(h===a)score=120+a.length;
    else if(h.endsWith(` ${a}`)||h.startsWith(`${a} `))score=95+a.length;
    else if(h.includes(a)&&a.length>=4)score=75+a.length;
    best=Math.max(best,score);
  }

  // Heuristic thêm cho các BOQ thực tế.
  if(key==="qty"&&(h==="kl"||h.startsWith("kl ")||h.includes("khoi luong")))best=Math.max(best,105);
  if(key==="description"&&h.includes("dien giai"))best=Math.max(best,135);
  if(key==="unit"&&h.includes("don vi"))best=Math.max(best,130);
  if(key==="specification"&&(h.includes("model")||h.includes("thong so")))best=Math.max(best,120);
  if(key==="brand"&&h.includes("nhan hieu"))best=Math.max(best,125);
  if(key==="origin"&&h.includes("xuat xu"))best=Math.max(best,125);
  if(key==="materialUnit"&&h.includes("vat tu chinh"))best=Math.max(best,140);
  if(key==="laborUnit"&&h.includes("nhan cong")&&h.includes("vat tu phu"))best=Math.max(best,145);
  if(key==="bidUnit"&&h.includes("tong cong"))best=Math.max(best,140);

  return best;
}

function columnDataStats(aoa,col,start,qtyIndex=-1){
  let numeric=0,nonEmpty=0,text=0,shortText=0,coNumericQty=0;
  const end=Math.min(aoa.length,start+500);

  for(let r=start;r<end;r++){
    const row=aoa[r]||[];
    const v=row[col];
    const raw=String(v??"").trim();
    if(!raw)continue;
    nonEmpty++;
    if(isRevisionNumeric(v))numeric++;
    else{
      text++;
      if(raw.length<=20)shortText++;
    }
    if(qtyIndex>=0&&isRevisionNumeric(row[qtyIndex]))coNumericQty++;
  }
  return {numeric,nonEmpty,text,shortText,coNumericQty};
}

function countRevisionValidRows(aoa,start,map){
  if(map.description<0||map.qty<0)return 0;
  let count=0;
  const end=aoa.length;
  for(let r=start;r<end;r++){
    const row=aoa[r]||[];
    const desc=String(row[map.description]??"").trim();
    const qty=row[map.qty];
    if(desc&&isRevisionNumeric(qty))count++;
  }
  return count;
}

function detectRevisionHeader(aoa){
  let best={headerRow:1,headerDepth:1,score:-Infinity,validRows:0};
  const limit=Math.min(40,aoa.length);

  for(let i=0;i<limit;i++){
    const firstRowNonEmpty=(aoa[i]||[]).filter(x=>String(x??"").trim()!=="").length;
    if(firstRowNonEmpty===0)continue;

    for(let depth=1;depth<=3;depth++){
      if(i+depth>aoa.length)break;
      const analyzed=analyzeRevisionHeaders(aoa,i,depth);

      let score=0;
      Object.values(analyzed.map).forEach(idx=>{if(idx>=0)score+=2});
      if(analyzed.map.description>=0)score+=14;
      if(analyzed.map.qty>=0)score+=14;
      if(analyzed.map.unit>=0)score+=4;
      if(analyzed.map.specification>=0)score+=2;
      if(analyzed.map.materialUnit>=0)score+=3;
      if(analyzed.map.laborUnit>=0)score+=3;
      if(analyzed.map.bidUnit>=0)score+=3;

      // Quan trọng nhất: cấu trúc nào đọc ra được nhiều dòng BOQ hợp lệ hơn sẽ thắng.
      score+=Math.min(80,analyzed.validRows*2);

      if(
        score>best.score ||
        (score===best.score && analyzed.validRows>best.validRows) ||
        (score===best.score && analyzed.validRows===best.validRows && (i+1)<best.headerRow) ||
        (score===best.score && analyzed.validRows===best.validRows && (i+1)===best.headerRow && depth<best.headerDepth)
      ){
        best={headerRow:i+1,headerDepth:depth,score,validRows:analyzed.validRows};
      }
    }
  }
  return best;
}

function revisionDataLikelihood(aoa,start,map){
  if(map.description<0||map.qty<0)return -10;
  let numericQty=0,descriptions=0,units=0;
  const end=Math.min(aoa.length,start+20);
  for(let r=start;r<end;r++){
    const row=aoa[r]||[];
    const d=String(row[map.description]??"").trim();
    const q=row[map.qty];
    if(d)descriptions++;
    if(isRevisionNumeric(q))numericQty++;
    if(map.unit>=0&&String(row[map.unit]??"").trim())units++;
  }
  return Math.min(12,numericQty*3)+Math.min(4,descriptions)+Math.min(3,units);
}

function isRevisionNumeric(v){
  if(typeof v==="number")return Number.isFinite(v);
  const raw=String(v??"").trim();
  if(!raw)return false;
  const cleaned=raw.replace(/\s/g,"").replace(/[₫đ]/gi,"").replace(/%$/,"");
  return /^[-+]?\d[\d.,]*$/.test(cleaned);
}

function cleanRevisionHeader(v){
  return norm(String(v??""))
    .replace(/đ/g,"d")
    .replace(/[^a-z0-9%]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function fileExtension(name){
  return String(name||"").split(".").pop().toLowerCase();
}

function downloadRevisionExcelTemplate(){
  const XLSX=globalThis.XLSX;
  if(!XLSX){toast("Thư viện Excel chưa tải được. Có thể dùng mẫu CSV tạm thời.","error");return}

  const wb=XLSX.utils.book_new();

  // Mẫu đơn giản 1 hàng tiêu đề.
  const ws1=XLSX.utils.aoa_to_sheet(revisionTemplateRows());
  ws1["!cols"]=[{wch:8},{wch:12},{wch:18},{wch:34},{wch:24},{wch:10},{wch:14},{wch:18},{wch:16},{wch:14},{wch:14},{wch:12},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws1,"BOQ_1_HANG");

  // Mẫu thực tế 2 hàng, có merged cell giống nhiều BOQ công trình.
  const rows2=[
    ["BẢNG KHỐI LƯỢNG CÔNG VIỆC","","","","","","","","","",""],
    ["CODE GIÁ","Mục","Diễn giải","Đơn vị","Khối lượng","Model/Thông số kỹ thuật","Nhãn hiệu","Xuất xứ","Đơn giá (VND)","","","Thành tiền (VND)"],
    ["","","","","","","","","Vật tư chính","Nhân công và vật tư phụ","Tổng cộng",""],
    ["FF.BOM-D","1.101","Bơm chữa cháy chính","bộ",1,"GS 100-315L/90","EBARA","INDO",136100000,20400000,156500000,156500000]
  ];
  const ws2=XLSX.utils.aoa_to_sheet(rows2);
  ws2["!merges"]=[
    {s:{r:0,c:0},e:{r:0,c:11}},
    {s:{r:1,c:0},e:{r:2,c:0}},
    {s:{r:1,c:1},e:{r:2,c:1}},
    {s:{r:1,c:2},e:{r:2,c:2}},
    {s:{r:1,c:3},e:{r:2,c:3}},
    {s:{r:1,c:4},e:{r:2,c:4}},
    {s:{r:1,c:5},e:{r:2,c:5}},
    {s:{r:1,c:6},e:{r:2,c:6}},
    {s:{r:1,c:7},e:{r:2,c:7}},
    {s:{r:1,c:8},e:{r:1,c:10}},
    {s:{r:1,c:11},e:{r:2,c:11}}
  ];
  ws2["!cols"]=[{wch:16},{wch:10},{wch:36},{wch:10},{wch:14},{wch:24},{wch:14},{wch:12},{wch:18},{wch:24},{wch:16},{wch:18}];
  XLSX.utils.book_append_sheet(wb,ws2,"BOQ_2_HANG_MERGE");

  XLSX.writeFile(wb,"MAU_BOQ_REVISION.xlsx");
}

function revisionTemplateRows(){
  return [
    ["STT","Hệ","Nhóm","Mô tả","Thông số","ĐVT","Khối lượng","Giá chào/ĐVT","Giá vật tư","Nhân công","Thầu phụ","Khác","Hao hụt %","Markup %"],
    ["1","PCCC","Đường ống","Ống thép đen DN50","SCH40","m",1200,120000,85000,0,0,0,0,0]
  ];
}


function mapRevisionItems(parsed){
  const historyItems=historicalItemRegistry();
  const noIndex=new Map(),sigIndex=new Map();
  Object.entries(historyItems).forEach(([id,x])=>{
    const n=norm(x.itemNo||"");
    if(n){if(!noIndex.has(n))noIndex.set(n,[]);noIndex.get(n).push(id)}
    const sig=itemSignature(x);if(sig){if(!sigIndex.has(sig))sigIndex.set(sig,[]);sigIndex.get(sig).push(id)}
  });

  const result={},usedIds=new Set();
  parsed.forEach((d,i)=>{
    let id="",method="NEW";
    const n=norm(d.itemNo||"");
    if(n&&noIndex.get(n)?.length===1&&!usedIds.has(noIndex.get(n)[0])){id=noIndex.get(n)[0];method="ITEM_NO"}
    if(!id){
      const sig=itemSignature(d);
      if(sig&&sigIndex.get(sig)?.length===1&&!usedIds.has(sigIndex.get(sig)[0])){id=sigIndex.get(sig)[0];method="DESCRIPTION_SPEC_UNIT"}
    }
    if(!id)id=refs.quantityBoqRevisionItems(projectId,"_temp").push().key;
    usedIds.add(id);

    const old=historyItems[id]||{};
    const hasNewCost=[d.materialUnit,d.laborUnit,d.subcontractUnit,d.otherUnit,d.bidUnit].some(x=>Number(x||0)!==0);
    let bidUnit=Number(d.bidUnit||0);
    let materialUnit=Number(d.materialUnit||0),laborUnit=Number(d.laborUnit||0),
      subcontractUnit=Number(d.subcontractUnit||0),otherUnit=Number(d.otherUnit||0),
      wastePct=Number(d.wastePct||0),markupPct=Number(d.markupPct||0);

    if(!hasNewCost&&old){
      bidUnit=Number(old.bidUnit||0);materialUnit=Number(old.materialUnit||0);laborUnit=Number(old.laborUnit||0);
      subcontractUnit=Number(old.subcontractUnit||0);otherUnit=Number(old.otherUnit||0);
      wastePct=Number(old.wastePct||0);markupPct=Number(old.markupPct||0);
    }else if(!bidUnit){
      const base=materialUnit+laborUnit+subcontractUnit+otherUnit;
      const net=base*(1+wastePct/100);bidUnit=net*(1+markupPct/100);
    }

    result[id]={
      stableItemId:id,itemNo:d.itemNo||old.itemNo||String(i+1),discipline:d.discipline||old.discipline||"KHÁC",
      category:d.category||old.category||"",description:d.description||old.description||"",
      specification:d.specification||old.specification||"",unit:d.unit||old.unit||"",
      qty:Number(d.qty||0),materialUnit,laborUnit,subcontractUnit,otherUnit,wastePct,markupPct,
      netUnit:(materialUnit+laborUnit+subcontractUnit+otherUnit)*(1+wastePct/100),bidUnit,
      selectedSupplier:old.selectedSupplier||"",
      brand:d.brand||old.brand||"",origin:d.origin||old.origin||"",
      sourceRow:Number(d.sourceRow||old.sourceRow||0),sourceOrder:Number(d.sourceOrder??old.sourceOrder??i),
      matchMethod:method,lineStatus:"ACTIVE",updatedAt:Date.now()
    };
  });
  return result;
}

function historicalItemRegistry(){
  const out={};
  if(tenderRevision?.items)Object.entries(tenderRevision.items).forEach(([id,x])=>out[id]={...x});
  revisions.forEach(r=>Object.entries(r.items||{}).forEach(([id,x])=>{if(!out[id])out[id]={...x}}));
  baseline.forEach(b=>{if(!out[b.id]){const {id,...rest}=b;out[b.id]={...rest}}});
  return out;
}

function compareRevisionDialog(revisionId){
  const r=revisions.find(x=>x.id===revisionId);if(!r)return;
  const previous=previousRevision(r);
  const base=previous||tenderRevision;
  const changes=compareRevisionItems(base?.items||{},r.items||{});
  const tenderChanges=compareRevisionItems(tenderRevision?.items||{},r.items||{});
  const sum=compareSummary(changes),tenderSum=compareSummary(tenderChanges);

  modal({
    title:`So sánh ${r.code} · ${r.name}`,
    eyebrow:`So với ${base?.code||"R0"} · Tender Δ ${signedMoney(tenderSum.deltaValue)}`,
    size:"xl",showSubmit:false,
    body:`<div class="grid g5">
      ${smallMetric("Thêm mới",sum.added,sum.added?"red":"green")}
      ${smallMetric("Tăng KL",sum.increased,sum.increased?"orange":"green")}
      ${smallMetric("Giảm KL",sum.decreased,sum.decreased?"blue":"green")}
      ${smallMetric("Loại bỏ",sum.removed,sum.removed?"orange":"green")}
      ${smallMetric("Δ giá trị",signedMoney(sum.deltaValue),sum.deltaValue>0?"red":"green")}
    </div>
    <div class="revision-compare-note mt">
      <b>So với Tender R0:</b> ${tenderSum.changed} đầu mục thay đổi · Giá trị BOQ ${money(revisionTotal(r.items||{}))} · Δ ${signedMoney(tenderSum.deltaValue)}.
      ${r.status==="DRAFT"?"Revision này chưa ảnh hưởng kiểm soát đặt hàng cho tới khi kích hoạt.":""}
    </div>
    <div class="table-wrap mt"><table class="table revision-compare-table"><thead><tr>
      <th>TRẠNG THÁI</th><th>MÃ</th><th>VẬT TƯ</th><th>ĐVT</th><th>${esc(base?.code||"TRƯỚC")}</th><th>${esc(r.code)}</th><th>Δ KL</th>
      <th>ĐƠN GIÁ CŨ</th><th>ĐƠN GIÁ MỚI</th><th>Δ GIÁ TRỊ</th><th>MAP</th><th>KIỂM TRA MAP</th>
    </tr></thead><tbody>
      ${changes.filter(x=>x.change!=="UNCHANGED").length?changes.filter(x=>x.change!=="UNCHANGED").map(x=>changeRow(x,r.id)).join(""):`<tr><td colspan="12">${empty("Không có thay đổi","Khối lượng và giá trị giống phiên bản trước.","✓")}</td></tr>`}
    </tbody></table></div>
    ${r.status==="DRAFT"&&can("quantityRevisionActivate")?`<div class="actions mt" style="justify-content:flex-end"><button type="button" class="btn green" id="activateRevisionFromCompare">✓ Xác nhận dùng ${esc(r.code)} làm Baseline</button></div>`:""}`
  });
  document.querySelector("#activateRevisionFromCompare")?.addEventListener("click",()=>activateRevision(revisionId));
  document.querySelectorAll("[data-revision-remap]").forEach(b=>b.addEventListener("click",()=>remapRevisionItem(b.dataset.revisionRemap,b.dataset.itemId)));
}

function changeRow(x,revisionId){
  const info={
    ADDED:["THÊM MỚI","green"],REMOVED:["LOẠI BỎ","red"],INCREASE:["TĂNG","orange"],
    DECREASE:["GIẢM","blue"],PRICE:["ĐỔI GIÁ","purple"],MIXED:["KL + GIÁ","orange"]
  }[x.change]||[x.change,"gray"];
  return `<tr class="revision-change-${String(x.change).toLowerCase()}">
    <td>${badge(info[0],info[1])}</td><td><b>${esc(x.itemNo||"—")}</b></td>
    <td><div class="primary-text">${esc(x.description||"—")}</div><div class="secondary-text">${esc(x.specification||"")}</div></td>
    <td>${esc(x.unit||"—")}</td><td>${num(x.oldQty,3)}</td><td><b>${num(x.newQty,3)}</b></td>
    <td class="${x.deltaQty>0?"danger-text":x.deltaQty<0?"positive-text":""}"><b>${signedQty(x.deltaQty)}</b></td>
    <td>${money(x.oldBid)}</td><td>${money(x.newBid)}</td>
    <td class="${x.deltaValue>0?"danger-text":x.deltaValue<0?"positive-text":""}"><b>${signedMoney(x.deltaValue)}</b></td>
    <td>${x.matchMethod==="NEW"?badge("CHƯA MAP","orange"):esc(x.matchMethod||"—")}</td>
    <td>${x.change==="ADDED"&&x.matchMethod==="NEW"&&can("quantityRevisionManage")?`<button type="button" class="btn sm" data-revision-remap="${revisionId}" data-item-id="${x.id}">Map lại</button>`:"—"}</td>
  </tr>`;
}

function remapRevisionItem(revisionId,itemId){
  const r=revisions.find(x=>x.id===revisionId),item=r?.items?.[itemId];
  if(!r||r.status!=="DRAFT"||!item)return;

  const currentIds=new Set(Object.keys(r.items||{}));
  const history=historicalItemRegistry();
  const candidates=Object.entries(history).filter(([id])=>!currentIds.has(id));
  if(!candidates.length){toast("Không còn đầu mục phiên bản trước để map.","warning");return}

  modal({
    title:"Map đầu mục Revision",
    eyebrow:`${r.code} · ${item.itemNo||""}`,
    size:"lg",submitText:"Xác nhận Mapping",
    body:`<div class="revision-map-source">
      <span>Đầu mục mới</span><b>${esc(item.description||"")}</b><small>${esc(item.specification||"")} · ${esc(item.unit||"")}</small>
    </div>
    <div class="form-grid mt">
      <label class="field span2"><span>Map với đầu mục phiên bản trước *</span><select required name="targetId">
        <option value="">-- Chọn đầu mục --</option>
        ${candidates.map(([id,x])=>`<option value="${id}">${esc(x.itemNo||"")} · ${esc(x.description||"")} · ${esc(x.specification||"")} · ${esc(x.unit||"")} · KL ${num(x.qty,3)}</option>`).join("")}
      </select></label>
    </div>
    <div class="revision-help mt">Dùng khi hệ thống không nhận ra cùng một đầu mục do mã/mô tả đã đổi. Mapping thủ công sẽ giữ lịch sử đặt hàng của đầu mục cũ.</div>`,
    onSubmit:async fd=>{
      const targetId=String(fd.get("targetId")||"");if(!targetId)return false;
      if(r.items?.[targetId]){toast("Đầu mục đích đã tồn tại trong Revision này.","error");return false}
      const mapped={...item,stableItemId:targetId,matchMethod:"MANUAL_MAP",updatedAt:Date.now()};
      const updates={};updates[`items/${targetId}`]=mapped;updates[`items/${itemId}`]=null;
      await refs.quantityBoqRevision(projectId,revisionId).update(updates);
      await audit("REVISION_REMAP",`Map thủ công ${item.description} vào đầu mục lịch sử ${targetId}`,{revisionId,itemId,targetId});
      toast("Đã cập nhật mapping.");await reload();compareRevisionDialog(revisionId);return false;
    }
  });
}

function compareRevisionItems(oldItems,newItems){
  const keys=new Set([...Object.keys(oldItems||{}),...Object.keys(newItems||{})]),out=[];
  keys.forEach(id=>{
    const a=oldItems?.[id],b=newItems?.[id];
    const oldQty=Number(a?.qty||0),newQty=Number(b?.qty||0),oldBid=Number(a?.bidUnit||0),newBid=Number(b?.bidUnit||0);
    const deltaQty=newQty-oldQty,deltaValue=newQty*newBid-oldQty*oldBid;
    let change="UNCHANGED";
    if(!a&&b)change="ADDED";
    else if(a&&!b)change="REMOVED";
    else{
      const qtyChanged=Math.abs(deltaQty)>1e-9,priceChanged=Math.abs(newBid-oldBid)>0.5;
      if(qtyChanged&&priceChanged)change="MIXED";
      else if(deltaQty>0)change="INCREASE";
      else if(deltaQty<0)change="DECREASE";
      else if(priceChanged)change="PRICE";
    }
    out.push({
      id,itemNo:b?.itemNo||a?.itemNo||"",description:b?.description||a?.description||"",
      specification:b?.specification||a?.specification||"",unit:b?.unit||a?.unit||"",
      oldQty,newQty,deltaQty,oldBid,newBid,deltaValue,change,matchMethod:b?.matchMethod||""
    });
  });
  return out.sort((x,y)=>changeOrder(x.change)-changeOrder(y.change)||String(x.itemNo).localeCompare(String(y.itemNo),"vi",{numeric:true}));
}

function compareSummary(changes){
  const changed=changes.filter(x=>x.change!=="UNCHANGED");
  return {
    changed:changed.length,added:changed.filter(x=>x.change==="ADDED").length,
    removed:changed.filter(x=>x.change==="REMOVED").length,
    increased:changed.filter(x=>["INCREASE","MIXED"].includes(x.change)&&x.deltaQty>0).length,
    decreased:changed.filter(x=>["DECREASE","MIXED"].includes(x.change)&&x.deltaQty<0).length,
    deltaValue:changes.reduce((s,x)=>s+Number(x.deltaValue||0),0)
  };
}

async function activateRevision(revisionId){
  if(!can("quantityRevisionActivate"))return;
  const r=revisions.find(x=>x.id===revisionId);if(!r||r.status!=="DRAFT")return;
  const current=activeRevision||tenderRevision;
  const changes=compareRevisionItems(current?.items||{},r.items||{}),sum=compareSummary(changes);
  const tenderSum=compareSummary(compareRevisionItems(tenderRevision?.items||{},r.items||{}));
  const orderedCount=requests.filter(x=>COUNTED_STATUSES.has(x.status)).length;
  const message=`Kích hoạt ${r.code} làm Baseline? ${sum.changed} đầu mục thay đổi so với ${current?.code||"R0"}, Δ giá trị ${signedMoney(sum.deltaValue)}. `+
    `So Tender R0: ${signedMoney(tenderSum.deltaValue)}. ${orderedCount?`${orderedCount} phiếu đã duyệt/đặt sẽ được tính lại trên Baseline mới.`:""}`;
  if(!await confirmBox(`Áp dụng ${r.code}`,message,`Áp dụng ${r.code}`))return;

  const u=getProfile()||{};
  const materialized=materializeBaseline(r.items||{});
  const total=revisionTotal(r.items||{});
  const oldId=activeRevision?.id;

  await refs.quantityBaselineProject(projectId).set(materialized);
  await refs.quantityBaselineMeta(projectId).update({
    lineCount:Object.keys(materialized).length,totalBidValue:total,
    activeRevisionId:revisionId,activeRevisionCode:r.code,activeRevisionName:r.name,
    activeEffectiveDate:r.effectiveDate,activatedAt:Date.now(),activatedByUid:u.uid||"",activatedByName:u.displayName||u.email||""
  });
  if(oldId&&oldId!==revisionId)await refs.quantityBoqRevision(projectId,oldId).update({status:"SUPERSEDED",supersededAt:Date.now()});
  await refs.quantityBoqRevision(projectId,revisionId).update({
    status:"ACTIVE",activatedAt:Date.now(),activatedByUid:u.uid||"",activatedByName:u.displayName||u.email||""
  });

  await audit("REVISION_ACTIVATED",`Áp dụng ${r.code} làm Baseline · Δ so Tender ${signedMoney(tenderSum.deltaValue)}`,{
    revisionId,revisionCode:r.code,previousRevisionId:oldId||"",changeSummary:sum,tenderSummary:tenderSum
  });
  await logActivity("QTY_REVISION_ACTIVATED",`Áp dụng ${r.code} - ${r.name} làm Baseline`,{projectId,revisionId});
  toast(`Đã áp dụng ${r.code}. Toàn bộ phiếu đặt hàng đã được tính lại theo Baseline mới.`);
  await reload();view="SUMMARY";paint();
}

function materializeBaseline(targetItems){
  const registry=historicalItemRegistry(),out={};
  Object.entries(targetItems||{}).forEach(([id,x])=>out[id]={...x,lineStatus:"ACTIVE",activeRevisionCode:""});
  Object.entries(registry).forEach(([id,x])=>{
    if(out[id])return;
    out[id]={...x,qty:0,lineStatus:"REMOVED",activeRevisionCode:""};
  });
  return out;
}

async function deleteDraftRevision(id){
  const r=revisions.find(x=>x.id===id);if(!r||r.status!=="DRAFT"||!can("quantityRevisionManage"))return;
  if(!await confirmBox("Xóa BOQ Revision",`Xóa ${r.code} - ${r.name}? Revision chưa áp dụng nên không ảnh hưởng phiếu đặt hàng.`,"Xóa"))return;
  await refs.quantityBoqRevision(projectId,id).remove();
  await audit("REVISION_DELETED",`Xóa Revision nháp ${r.code}`,{revisionId:id,revisionCode:r.code});
  toast(`Đã xóa ${r.code}.`,"warning");await reload();view="REVISIONS";paint();
}

function previousRevision(r){
  const candidates=revisions.filter(x=>Number(x.revisionNo||0)<Number(r.revisionNo||0)).sort((a,b)=>Number(b.revisionNo||0)-Number(a.revisionNo||0));
  return candidates[0]||null;
}

function nextRevisionNo(){
  return revisions.reduce((m,r)=>Math.max(m,Number(r.revisionNo||0)),0)+1;
}

function revisionTotal(items){
  return Object.values(items||{}).reduce((s,x)=>s+Number(x.qty||0)*Number(x.bidUnit||0),0);
}

function revisionSort(a,b){
  return Number(b.revisionNo||0)-Number(a.revisionNo||0);
}

function changeOrder(k){
  return {ADDED:0,INCREASE:1,MIXED:2,PRICE:3,DECREASE:4,REMOVED:5,UNCHANGED:9}[k]??8;
}

function itemSignature(x){
  const desc=norm(x.description||"").replace(/[^a-z0-9]+/g," ");
  const spec=norm(x.specification||"").replace(/[^a-z0-9]+/g," ");
  const unit=norm(x.unit||"");
  return `${desc}|${spec}|${unit}`.trim();
}

function downloadRevisionTemplate(){
  downloadCsv("MAU_BOQ_REVISION.csv",revisionTemplateRows());
}

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
  if(cell.length||row.length){row.push(cell);rows.push(row)}
  return rows.map(r=>r.map(x=>x.trim()));
}

function toNumber(v){
  if(typeof v==="number")return Number.isFinite(v)?v:0;
  let raw=String(v??"").trim();
  if(!raw)return 0;
  raw=raw.replace(/\s/g,"").replace(/[₫đ]/gi,"").replace(/%$/,"");
  const comma=raw.lastIndexOf(","),dot=raw.lastIndexOf(".");
  if(comma>=0&&dot>=0){
    if(comma>dot)raw=raw.replaceAll(".","").replace(",",".");
    else raw=raw.replaceAll(",","");
  }else if(comma>=0){
    const parts=raw.split(",");
    raw=parts.length===2&&parts[1].length<=3?parts[0].replaceAll(".","")+"."+parts[1]:raw.replaceAll(",","");
  }
  const n=Number(raw);
  return Number.isFinite(n)?n:0;
}

function editRequest(id){
  const r=requests.find(x=>x.id===id)||{};
  const u=getProfile()||{};
  if(id&&!canEditRequest(r)){toast("Phiếu này không còn được phép sửa.","error");return}

  modal({
    title:id?"Cập nhật phiếu đặt hàng":"Tạo phiếu đặt hàng công trường",
    eyebrow:"ĐỀ NGHỊ VẬT TƯ",
    size:"lg",
    submitText:id?"Lưu phiếu":"Tạo phiếu",
    body:`<div class="form-grid">
      <label class="field"><span>Mã phiếu *</span><input required name="code" value="${esc(r.code||nextRequestCode())}"></label>
      <label class="field"><span>Ngày đề nghị *</span><input required type="date" name="requestDate" value="${esc(r.requestDate||todayIso())}"></label>
      <label class="field"><span>Người đề nghị</span><input name="requesterName" value="${esc(r.requesterName||u.displayName||u.email||"")}"></label>
      <label class="field"><span>Khu vực / Tầng / Zone</span><input name="location" value="${esc(r.location||"")}" placeholder="Ví dụ: Tầng 2 - Zone A"></label>
      <label class="field span2"><span>Mục đích / Ghi chú</span><textarea name="notes">${esc(r.notes||"")}</textarea></label>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());
      d.updatedAt=ts();
      if(id){
        const before={...r};delete before.lines;
        await refs.orderRequest(projectId,id).update(d);
        await audit("REQUEST_UPDATED",`Cập nhật phiếu ${d.code}`,{requestId:id,requestCode:d.code,before,after:d});
      }else{
        const key=refs.orderRequestsProject(projectId).push().key;
        d.status="DRAFT";d.requesterUid=u.uid||"";d.requesterEmail=u.email||"";d.department=u.department||"";
        d.createdAt=ts();d.createdByUid=u.uid||"";d.createdByName=u.displayName||u.email||"";
        await refs.orderRequest(projectId,key).set(d);
        await audit("REQUEST_CREATED",`Tạo phiếu ${d.code}`,{requestId:key,requestCode:d.code,after:d});
      }
      toast(id?"Đã cập nhật phiếu.":"Đã tạo phiếu. Hãy thêm đầu mục vật tư.");
      await reload();
      if(!id){
        const created=requests.find(x=>x.code===d.code);
        if(created){viewRequest(created.id);return false}
      }
      return true;
    }
  });
}

function viewRequest(id){
  const r=requests.find(x=>x.id===id);if(!r)return;
  const lines=linesOf(r),st=statusInfo(r.status),impact=requestImpact(r);
  const editable=r.status==="DRAFT"&&canEditRequest(r);

  modal({
    title:`${r.code||"Phiếu đặt hàng"} · ${st.label}`,
    eyebrow:`${fmtDate(r.requestDate)} · ${r.location||"Công trường"}`,
    size:"xl",showSubmit:false,
    body:`<div class="grid g5">
      ${smallMetric("Số dòng",lines.length)}
      ${smallMetric("KL quy đổi",num(lines.reduce((s,l)=>s+Number(l.boqQty||0),0),3))}
      ${smallMetric("GT theo giá BOQ",money(lines.reduce((s,l)=>s+Number(l.boqQty||0)*Number(l.bidUnit||0),0),true))}
      ${smallMetric("Đầu mục sẽ vượt",impact.overCount,impact.overCount?"red":"green")}
      ${smallMetric("GT vượt do phiếu",money(impact.excessBidValue,true),impact.excessBidValue?"red":"green")}
    </div>

    ${impact.overCount?`<div class="qty-warning-box mt"><b>⚠ Phiếu này có thể làm vượt Baseline.</b><span>${impact.overCount} đầu mục · giá trị vượt theo giá chào ${money(impact.excessBidValue)} · chi phí vượt dự kiến ${money(impact.excessCost)}</span></div>`:""}

    <div class="card mt">
      <div class="card-head"><div><h3>Chi tiết vật tư</h3><div class="secondary-text">${esc(r.requesterName||r.requesterEmail||"")} · ${esc(r.notes||"")}</div></div>${editable?`<button type="button" class="btn primary sm" id="addRequestLineBtn">＋ Thêm đầu mục</button>`:""}</div>
      <div class="table-wrap" style="border:0;border-radius:0 0 11px 11px"><table class="table request-lines-table"><thead><tr>
        <th>VẬT TƯ</th><th>NGUỒN</th><th>ĐVT BOQ</th><th>ĐVT ĐẶT</th><th>QUY ĐỔI</th><th>SL ĐẶT</th><th>KL QUY ĐỔI</th><th>GIÁ CHÀO</th><th>GIÁ MUA DK</th><th>LÝ DO</th><th style="text-align:right">THAO TÁC</th>
      </tr></thead><tbody>
        ${lines.length?lines.map(l=>`<tr>
          <td><div class="primary-text">${esc(l.description||"—")}</div><div class="secondary-text">${esc(l.specification||"")}</div></td>
          <td>${l.isOutsideBoq?badge("NGOÀI BOQ","red"):badge(l.itemNo||"BOQ","blue")}</td>
          <td>${esc(l.unit||"—")}</td><td>${esc(l.orderUnit||l.unit||"—")}</td><td>1 ${esc(l.orderUnit||l.unit||"")} = ${num(l.conversionFactor||1,3)} ${esc(l.unit||"")}</td>
          <td>${num(l.orderQty,3)}</td><td><b>${num(l.boqQty,3)}</b></td><td>${money(l.bidUnit)}</td><td>${money(l.costUnitPrice)}</td>
          <td>${esc(reasonLabel(l.reasonCode))}${l.reasonNote?`<div class="secondary-text">${esc(l.reasonNote)}</div>`:""}</td>
          <td><div class="row-actions">${editable?`<button type="button" class="btn sm" data-line-edit="${l.id}">Sửa</button><button type="button" class="btn red sm" data-line-del="${l.id}">Xóa</button>`:""}</div></td>
        </tr>`).join(""):`<tr><td colspan="11">${empty("Phiếu chưa có vật tư","Thêm các đầu mục cần đặt hàng vào phiếu.","▦")}</td></tr>`}
      </tbody></table></div>
    </div>

    <div class="actions mt">
      ${r.status==="DRAFT"&&canEditRequest(r)&&lines.length?`<button type="button" class="btn primary" id="submitRequestBtn">Gửi duyệt</button>`:""}
      ${r.status==="PENDING"&&can("quantityRequestApprove")?`<button type="button" class="btn green" id="approveRequestBtn">✓ Duyệt phiếu</button><button type="button" class="btn" id="returnDraftBtn">Trả về Nháp</button>`:""}
      ${r.status==="APPROVED"&&can("quantityRequestOrder")?`<button type="button" class="btn primary" id="markOrderedBtn">Đánh dấu Đã đặt hàng</button>`:""}
      ${["PENDING","APPROVED","ORDERED"].includes(r.status)&&can("quantityRequestCancel")?`<button type="button" class="btn red" id="cancelRequestBtn">Hủy phiếu</button>`:""}
      ${r.status==="DRAFT"&&canEditRequest(r)?`<button type="button" class="btn red" id="deleteRequestBtn">Xóa phiếu</button>`:""}
    </div>`
  });

  document.querySelector("#addRequestLineBtn")?.addEventListener("click",()=>editLine(r.id,null));
  document.querySelectorAll("[data-line-edit]").forEach(b=>b.addEventListener("click",()=>editLine(r.id,b.dataset.lineEdit)));
  document.querySelectorAll("[data-line-del]").forEach(b=>b.addEventListener("click",()=>deleteLine(r.id,b.dataset.lineDel)));
  document.querySelector("#submitRequestBtn")?.addEventListener("click",()=>transitionRequest(r.id,"PENDING"));
  document.querySelector("#approveRequestBtn")?.addEventListener("click",()=>approveRequest(r.id));
  document.querySelector("#returnDraftBtn")?.addEventListener("click",()=>transitionRequest(r.id,"DRAFT"));
  document.querySelector("#markOrderedBtn")?.addEventListener("click",()=>transitionRequest(r.id,"ORDERED"));
  document.querySelector("#cancelRequestBtn")?.addEventListener("click",()=>transitionRequest(r.id,"CANCELLED"));
  document.querySelector("#deleteRequestBtn")?.addEventListener("click",()=>deleteRequest(r.id));
}

function editLine(requestId,lineId){
  const r=requests.find(x=>x.id===requestId);if(!r||r.status!=="DRAFT"||!canEditRequest(r))return;
  const old=linesOf(r).find(x=>x.id===lineId)||{};
  const selectedKey=old.isOutsideBoq?"__OUTSIDE__":(old.baselineItemId||baseline[0]?.id||"__OUTSIDE__");

  modal({
    title:lineId?"Cập nhật đầu mục":"Thêm đầu mục đặt hàng",
    eyebrow:r.code||"PHIẾU ĐẶT HÀNG",
    size:"lg",
    submitText:lineId?"Lưu đầu mục":"Thêm vào phiếu",
    body:`<div class="form-grid">
      <label class="field span2"><span>Đầu mục Baseline *</span><select name="sourceKey" id="lineSourceKey">
        ${baseline.map(b=>`<option value="${b.id}" ${selectedKey===b.id?"selected":""}>${esc(b.itemNo||"")} · ${esc(b.description||"")} · BOQ ${num(b.qty,3)} ${esc(b.unit||"")}</option>`).join("")}
        <option value="__OUTSIDE__" ${selectedKey==="__OUTSIDE__"?"selected":""}>＋ ĐẦU MỤC NGOÀI BOQ</option>
      </select></label>

      <div class="span2 qty-line-baseline" id="lineBaselineInfo"></div>

      <label class="field span2 qty-outside-field"><span>Mô tả đầu mục ngoài BOQ *</span><input name="description" id="lineDescription" value="${esc(old.description||"")}"></label>
      <label class="field span2 qty-outside-field"><span>Thông số / Model</span><input name="specification" id="lineSpecification" value="${esc(old.specification||"")}"></label>
      <label class="field qty-outside-field"><span>Hệ thống</span><input name="discipline" id="lineDiscipline" value="${esc(old.discipline||"KHÁC")}"></label>
      <label class="field qty-outside-field"><span>ĐVT BOQ để quy đổi *</span><input name="unit" id="lineUnit" value="${esc(old.unit||"")}"></label>

      <label class="field"><span>Đơn vị đặt hàng *</span><input required name="orderUnit" id="lineOrderUnit" value="${esc(old.orderUnit||old.unit||"")}"></label>
      <label class="field"><span>Hệ số quy đổi *</span><input required type="number" min="0.000001" step="any" name="conversionFactor" id="lineFactor" value="${Number(old.conversionFactor||1)}"><small>1 ĐVT đặt = bao nhiêu ĐVT BOQ. Ví dụ 1 cây = 6 m.</small></label>
      <label class="field"><span>Số lượng đặt *</span><input required type="number" min="0.000001" step="any" name="orderQty" id="lineOrderQty" value="${Number(old.orderQty||0)}"></label>
      <label class="field"><span>Giá chào / ĐVT BOQ</span><input type="number" min="0" step="any" name="bidUnit" id="lineBidUnit" value="${Number(old.bidUnit||0)}"></label>
      <label class="field"><span>Giá mua dự kiến / ĐVT BOQ</span><input type="number" min="0" step="any" name="costUnitPrice" id="lineCostUnit" value="${Number(old.costUnitPrice||0)}"></label>
      <label class="field"><span>Lý do phát sinh / vượt</span><select name="reasonCode" id="lineReason"><option value="">-- Chọn lý do --</option>${REASONS.map(x=>`<option value="${x[0]}" ${old.reasonCode===x[0]?"selected":""}>${x[1]}</option>`).join("")}</select></label>
      <label class="field span2"><span>Giải trình</span><textarea name="reasonNote" id="lineReasonNote">${esc(old.reasonNote||"")}</textarea></label>

      <div class="span2 qty-line-preview" id="linePreview"></div>
    </div>`,
    onSubmit:async fd=>{
      const d=Object.fromEntries(fd.entries());
      const sourceKey=d.sourceKey;
      const outside=sourceKey==="__OUTSIDE__";
      const b=baseline.find(x=>x.id===sourceKey);

      d.isOutsideBoq=outside;
      d.baselineItemId=outside?"":sourceKey;
      d.orderQty=Number(d.orderQty||0);
      d.conversionFactor=Number(d.conversionFactor||1);
      d.boqQty=d.orderQty*d.conversionFactor;
      d.bidUnit=Number(d.bidUnit||0);
      d.costUnitPrice=Number(d.costUnitPrice||0);
      d.orderUnit=String(d.orderUnit||"").trim();

      if(outside){
        d.description=String(d.description||"").trim();
        d.specification=String(d.specification||"").trim();
        d.discipline=String(d.discipline||"KHÁC").trim()||"KHÁC";
        d.unit=String(d.unit||"").trim();
        if(!d.description||!d.unit){toast("Đầu mục ngoài BOQ phải có Mô tả và ĐVT BOQ.","error");return false}
        d.outsideKey=outsideKey(d.description,d.specification,d.unit);
        d.itemNo="NGOÀI BOQ";
      }else{
        if(!b){toast("Không tìm thấy đầu mục Baseline.","error");return false}
        d.itemNo=b.itemNo||"";d.description=b.description||"";d.specification=b.specification||"";
        d.discipline=b.discipline||"KHÁC";d.unit=b.unit||"";d.outsideKey="";
        if(!d.bidUnit)d.bidUnit=Number(b.bidUnit||0);
        if(!d.costUnitPrice)d.costUnitPrice=Number(b.materialUnit||0);
      }

      const projected=projectedLineImpact(d);
      if((outside||projected.excessQty>0)&&!d.reasonCode){toast("Đầu mục vượt/ngoài BOQ phải chọn lý do.","error");return false}
      d.updatedAt=ts();

      if(lineId){
        const before={...old};
        await refs.orderRequestLine(projectId,requestId,lineId).update(d);
        await audit("LINE_UPDATED",`Cập nhật ${d.description} · ${num(d.boqQty,3)} ${d.unit}`,{requestId,requestCode:r.code,lineId,before,after:d});
      }else{
        const key=refs.orderRequestLines(projectId,requestId).push().key;d.createdAt=ts();
        await refs.orderRequestLine(projectId,requestId,key).set(d);
        await audit("LINE_CREATED",`Thêm ${d.description} · ${num(d.boqQty,3)} ${d.unit}`,{requestId,requestCode:r.code,lineId:key,after:d});
      }

      toast("Đã lưu đầu mục.");await reload();viewRequest(requestId);return false;
    }
  });

  const source=document.querySelector("#lineSourceKey");
  const update=()=>{
    const key=source?.value||"__OUTSIDE__",outside=key==="__OUTSIDE__",b=baseline.find(x=>x.id===key);
    document.querySelectorAll(".qty-outside-field").forEach(el=>el.classList.toggle("hidden",!outside));

    if(!outside&&b){
      const oldSame=!old.isOutsideBoq&&old.baselineItemId===b.id;
      const orderUnit=document.querySelector("#lineOrderUnit"),factor=document.querySelector("#lineFactor"),bid=document.querySelector("#lineBidUnit"),cost=document.querySelector("#lineCostUnit");
      if(!oldSame){
        if(orderUnit)orderUnit.value=b.unit||"";
        if(factor)factor.value=1;
        if(bid)bid.value=Number(b.bidUnit||0);
        if(cost)cost.value=Number(b.materialUnit||0);
      }
      const row=aggregateRows().find(x=>x.key===b.id);
      const info=document.querySelector("#lineBaselineInfo");
      if(info)info.innerHTML=`<div><span>Baseline</span><b>${num(b.qty,3)} ${esc(b.unit||"")}</b></div><div><span>Đã duyệt/đặt</span><b>${num(row?.confirmedQty||0,3)}</b></div><div><span>Còn lại</span><b>${num(Number(b.qty||0)-Number(row?.confirmedQty||0),3)}</b></div><div><span>Giá chào</span><b>${money(b.bidUnit)}</b></div>`;
    }else{
      const info=document.querySelector("#lineBaselineInfo");
      if(info)info.innerHTML=`<div class="qty-outside-warning"><b>ĐẦU MỤC NGOÀI BOQ</b><span>Toàn bộ khối lượng được xem là phát sinh.</span></div>`;

      // Khi chuyển từ một dòng Baseline sang "Ngoài BOQ", không giữ lại giá/đơn vị
      // của vật tư trước đó để tránh người dùng vô tình lưu sai giá.
      if(!old.isOutsideBoq && source?.dataset.lastKey && source.dataset.lastKey!=="__OUTSIDE__"){
        const orderUnit=document.querySelector("#lineOrderUnit"),factor=document.querySelector("#lineFactor"),
          bid=document.querySelector("#lineBidUnit"),cost=document.querySelector("#lineCostUnit"),
          unit=document.querySelector("#lineUnit");
        if(orderUnit)orderUnit.value="";
        if(unit)unit.value="";
        if(factor)factor.value=1;
        if(bid)bid.value=0;
        if(cost)cost.value=0;
      }
    }
    if(source)source.dataset.lastKey=key;
    updatePreview();
  };

  const updatePreview=()=>{
    const key=source?.value||"__OUTSIDE__",outside=key==="__OUTSIDE__",b=baseline.find(x=>x.id===key);
    const orderQty=Number(document.querySelector("#lineOrderQty")?.value||0);
    const factor=Number(document.querySelector("#lineFactor")?.value||1);
    const boqQty=orderQty*factor;
    const bid=Number(document.querySelector("#lineBidUnit")?.value||(!outside?b?.bidUnit:0)||0);
    const cost=Number(document.querySelector("#lineCostUnit")?.value||(!outside?b?.materialUnit:0)||0);
    let before=0,baselineQty=0;
    if(!outside&&b){
      const row=aggregateRows().find(x=>x.key===b.id);before=Number(row?.confirmedQty||0);baselineQty=Number(b.qty||0);
    }
    const after=before+boqQty;
    const excess=Math.max(0,after-baselineQty);
    const box=document.querySelector("#linePreview");
    if(box)box.innerHTML=`<div><span>KL quy đổi phiếu này</span><b>${num(boqQty,3)} ${esc(outside?(document.querySelector("#lineUnit")?.value||""):b?.unit||"")}</b></div><div><span>Đã đặt trước đó</span><b>${num(before,3)}</b></div><div><span>Sau phiếu</span><b>${num(after,3)}</b></div><div class="${excess>0?"danger-text":""}"><span>Vượt Baseline</span><b>${num(excess,3)}</b></div><div class="${excess>0?"danger-text":""}"><span>GT vượt theo giá chào</span><b>${money(excess*bid)}</b></div><div><span>Chi phí vượt dự kiến</span><b>${money(excess*cost)}</b></div>`;
  };

  source?.addEventListener("change",update);
  ["#lineOrderQty","#lineFactor","#lineBidUnit","#lineCostUnit","#lineUnit"].forEach(sel=>document.querySelector(sel)?.addEventListener("input",updatePreview));
  update();
}

async function deleteLine(requestId,lineId){
  const r=requests.find(x=>x.id===requestId),line=linesOf(r).find(x=>x.id===lineId);if(!r||!line)return;
  if(!await confirmBox("Xóa đầu mục",`Xóa "${line.description}" khỏi ${r.code}?`,"Xóa"))return;
  await refs.orderRequestLine(projectId,requestId,lineId).remove();
  await audit("LINE_DELETED",`Xóa ${line.description} khỏi ${r.code}`,{requestId,requestCode:r.code,lineId,before:line});
  toast("Đã xóa đầu mục.","warning");await reload();viewRequest(requestId);
}

async function transitionRequest(id,status){
  const r=requests.find(x=>x.id===id);if(!r)return;
  if(status==="PENDING"&&!linesOf(r).length){toast("Phiếu chưa có đầu mục để gửi duyệt.","error");return}
  if(status==="CANCELLED"&&!await confirmBox("Hủy phiếu",`Hủy ${r.code}? Phiếu sẽ không còn được tính vào khối lượng cộng dồn.`,"Hủy phiếu"))return;

  const u=getProfile()||{},patch={status,updatedAt:ts()};
  if(status==="PENDING"){patch.submittedAt=ts();patch.submittedByUid=u.uid||""}
  if(status==="DRAFT"){patch.returnedAt=ts();patch.returnedByUid=u.uid||""}
  if(status==="ORDERED"){patch.orderedAt=ts();patch.orderedByUid=u.uid||"";patch.orderedByName=u.displayName||u.email||""}
  if(status==="CANCELLED"){patch.cancelledAt=ts();patch.cancelledByUid=u.uid||"";patch.cancelledByName=u.displayName||u.email||""}

  await refs.orderRequest(projectId,id).update(patch);
  await audit("REQUEST_STATUS",`${r.code}: ${statusInfo(r.status).label} → ${statusInfo(status).label}`,{requestId:id,requestCode:r.code,before:{status:r.status},after:{status}});
  await logActivity("QTY_REQUEST_STATUS",`${r.code} → ${statusInfo(status).label}`,{projectId,requestId:id});
  toast("Đã cập nhật trạng thái phiếu.");await reload();viewRequest(id);
}

async function approveRequest(id){
  const r=requests.find(x=>x.id===id);if(!r||r.status!=="PENDING"||!can("quantityRequestApprove"))return;
  const impact=requestImpact(r);
  const msg=impact.overCount
    ?`${r.code} sẽ làm vượt ${impact.overCount} đầu mục. Giá trị vượt theo giá chào: ${money(impact.excessBidValue)}; chi phí vượt dự kiến: ${money(impact.excessCost)}. Vẫn duyệt?`
    :`Duyệt ${r.code} và cộng khối lượng phiếu này vào kiểm soát BOQ?`;
  if(!await confirmBox("Duyệt phiếu đặt hàng",msg,"Duyệt phiếu"))return;

  const u=getProfile()||{};
  await refs.orderRequest(projectId,id).update({status:"APPROVED",approvedAt:ts(),approvedByUid:u.uid||"",approvedByName:u.displayName||u.email||"",updatedAt:ts()});
  await audit("REQUEST_APPROVED",`Duyệt ${r.code}${impact.overCount?` · vượt ${impact.overCount} đầu mục · ${money(impact.excessBidValue)}`:""}`,{requestId:id,requestCode:r.code,impact});
  await logActivity("QTY_REQUEST_APPROVED",`Duyệt ${r.code}`,{projectId,requestId:id,excessValue:impact.excessBidValue});
  toast(impact.overCount?"Đã duyệt phiếu. Có khối lượng vượt BOQ cần xử lý.":"Đã duyệt phiếu.",impact.overCount?"warning":"success");
  await reload();viewRequest(id);
}

async function deleteRequest(id){
  const r=requests.find(x=>x.id===id);if(!r||r.status!=="DRAFT")return;
  if(!await confirmBox("Xóa phiếu",`Xóa hoàn toàn ${r.code}?`,"Xóa"))return;
  await refs.orderRequest(projectId,id).remove();
  await audit("REQUEST_DELETED",`Xóa phiếu ${r.code}`,{requestId:id,requestCode:r.code,before:r});
  toast("Đã xóa phiếu.","warning");await reload();
}

function itemHistory(key){
  const row=aggregateRows().find(x=>x.key===key);if(!row)return;
  const events=lineEventsForKey(key);
  modal({
    title:`Lịch sử · ${row.description}`,
    eyebrow:row.isOutside?"NGOÀI BOQ":row.itemNo||"BOQ",
    size:"lg",showSubmit:false,
    body:`<div class="grid g4">
      ${smallMetric("KL Baseline",`${num(row.baselineQty,3)} ${esc(row.unit||"")}`)}
      ${smallMetric("Đã duyệt/đặt",num(row.confirmedQty,3))}
      ${smallMetric("Chờ duyệt",num(row.pendingQty,3))}
      ${smallMetric("GT vượt",money(row.excessBidValue,true),row.excessBidValue?"red":"green")}
    </div>
    <div class="table-wrap mt"><table class="table qty-history-table"><thead><tr>
      <th>PHIẾU</th><th>NGÀY</th><th>TRẠNG THÁI</th><th>SL ĐẶT</th><th>ĐVT ĐẶT</th><th>HỆ SỐ</th><th>KL QUY ĐỔI</th><th>GIÁ CHÀO</th><th>GIÁ MUA DK</th><th>LÝ DO</th>
    </tr></thead><tbody>${events.length?events.map(e=>`<tr>
      <td><b>${esc(e.request.code||"")}</b></td><td>${fmtDate(e.request.requestDate)}</td><td>${badge(statusInfo(e.request.status).label,statusInfo(e.request.status).color)}</td>
      <td>${num(e.line.orderQty,3)}</td><td>${esc(e.line.orderUnit||"")}</td><td>${num(e.line.conversionFactor||1,3)}</td><td><b>${num(e.line.boqQty,3)} ${esc(e.line.unit||"")}</b></td>
      <td>${money(e.line.bidUnit)}</td><td>${money(e.line.costUnitPrice)}</td><td>${esc(reasonLabel(e.line.reasonCode))}</td>
    </tr>`).join(""):`<tr><td colspan="10">Chưa có lịch sử.</td></tr>`}</tbody></table></div>`
  });
}

async function createVariationFromRow(key){
  if(!can("quantityVariationCreate"))return;
  const row=aggregateRows().find(x=>x.key===key);if(!row||row.excessBidValue<=0)return;

  const existing=variations.find(v=>v.source==="QTY_CONTROL"&&v.sourceQuantityKey===key&&v.status!=="REJECTED");
  if(existing){toast(`Đã có ${existing.code||"Variation"} liên kết đầu mục này (${statusVariation(existing.status)}).`,"warning");return}

  if(!await confirmBox("Tạo Variation từ khối lượng vượt",`Tạo VO nháp cho "${row.description}" với giá trị ${money(row.excessBidValue)}?`,"Tạo VO"))return;

  const keyVar=refs.variationsProject(projectId).push().key;
  const code=`VO-QTY-${String(variations.length+1).padStart(2,"0")}`;
  const d={
    code,date:todayIso(),title:`Vượt BOQ: ${row.description}`,direction:"INCREASE",amount:Number(row.excessBidValue||0),status:"DRAFT",
    clientRef:"",source:"QTY_CONTROL",sourceQuantityKey:key,
    notes:`Tạo từ kiểm soát khối lượng. Baseline: ${num(row.baselineQty,3)} ${row.unit}; Đã duyệt/đặt: ${num(row.confirmedQty,3)} ${row.unit}; Vượt: ${num(Math.max(0,row.confirmedQty-row.baselineQty),3)} ${row.unit}.`,
    createdAt:ts(),updatedAt:ts()
  };
  await refs.variation(projectId,keyVar).set(d);
  await audit("VARIATION_CREATED",`Tạo ${code} từ khối lượng vượt · ${money(row.excessBidValue)}`,{after:d});
  await logActivity("QTY_VARIATION_CREATED",`Tạo ${code} từ kiểm soát khối lượng`,{projectId,variationId:keyVar});
  toast(`Đã tạo ${code} ở Tài chính → Phát sinh.`);await reload();
}

function aggregateRows(){
  const baseMap=new Map();
  const tenderItems=tenderRevision?.items||{};
  baseline.forEach(b=>{
    const t=tenderItems[b.id]||{};
    const baselineQty=Number(b.qty||0),tenderQty=Number(t.qty||0);
    const bidUnit=Number(b.bidUnit||0),tenderBidUnit=Number(t.bidUnit||bidUnit||0);
    baseMap.set(b.id,{
      key:b.id,isOutside:false,itemNo:b.itemNo||t.itemNo||"",discipline:b.discipline||t.discipline||"KHÁC",
      description:b.description||t.description||"",specification:b.specification||t.specification||"",
      unit:b.unit||t.unit||"",baselineQty,tenderQty,bidUnit,tenderBidUnit,defaultCost:Number(b.materialUnit||t.materialUnit||0),
      lineStatus:b.lineStatus||"ACTIVE",
      contractDeltaQty:baselineQty-tenderQty,
      contractDeltaValue:baselineQty*bidUnit-tenderQty*tenderBidUnit,
      confirmedQty:0,pendingQty:0,orderedValue:0,excessBidValue:0,excessCost:0,diffBidValue:0,reasonLabel:""
    });
  });

  const outsideMap=new Map();

  requests.forEach(req=>{
    const counted=COUNTED_STATUSES.has(req.status),pending=req.status==="PENDING";
    if(!counted&&!pending)return;
    linesOf(req).forEach(line=>{
      const qty=Number(line.boqQty||0);
      if(line.isOutsideBoq){
        const key=`OUT:${line.outsideKey||outsideKey(line.description,line.specification,line.unit)}`;
        if(!outsideMap.has(key))outsideMap.set(key,{
          key,isOutside:true,itemNo:"NGOÀI BOQ",discipline:line.discipline||"KHÁC",description:line.description||"",specification:line.specification||"",
          unit:line.unit||"",baselineQty:0,tenderQty:0,bidUnit:0,tenderBidUnit:0,defaultCost:0,lineStatus:"OUTSIDE",
          contractDeltaQty:0,contractDeltaValue:0,
          confirmedQty:0,pendingQty:0,orderedValue:0,excessBidValue:0,excessCost:0,diffBidValue:0,
          bidValueSum:0,costValueSum:0,reasonLabel:reasonLabel(line.reasonCode)
        });
        const row=outsideMap.get(key);
        if(counted){
          row.confirmedQty+=qty;row.bidValueSum+=qty*Number(line.bidUnit||0);row.costValueSum+=qty*Number(line.costUnitPrice||0);row.orderedValue+=qty*Number(line.bidUnit||0);
        }else row.pendingQty+=qty;
      }else{
        const row=baseMap.get(line.baselineItemId);if(!row)return;
        if(counted){row.confirmedQty+=qty;row.orderedValue+=qty*Number(line.bidUnit||row.bidUnit||0)}
        else row.pendingQty+=qty;
      }
    });
  });

  // Accurate excess cost: only the portion crossing the baseline is multiplied by the unit cost at that order event.
  baseMap.forEach(row=>{
    let used=0,cost=0;
    const events=lineEventsForKey(row.key).filter(e=>COUNTED_STATUSES.has(e.request.status))
      .sort((a,b)=>String(a.request.requestDate||"").localeCompare(String(b.request.requestDate||""))||(a.request.createdAt||0)-(b.request.createdAt||0));
    events.forEach(e=>{
      const q=Number(e.line.boqQty||0),before=used,after=used+q;
      const extra=Math.max(0,after-row.baselineQty)-Math.max(0,before-row.baselineQty);
      if(extra>0)cost+=extra*Number(e.line.costUnitPrice||row.defaultCost||0);
      used=after;
    });
    const diff=row.confirmedQty-row.baselineQty;
    row.excessBidValue=Math.max(0,diff)*row.bidUnit;
    row.diffBidValue=diff*row.bidUnit;
    row.excessCost=cost;
  });

  outsideMap.forEach(row=>{
    row.bidUnit=row.confirmedQty?row.bidValueSum/row.confirmedQty:0;
    row.excessBidValue=row.bidValueSum;row.diffBidValue=row.bidValueSum;row.excessCost=row.costValueSum;
  });

  return [...baseMap.values(),...outsideMap.values()];
}

function lineEventsForKey(key){
  const outside=String(key).startsWith("OUT:");
  const outKey=outside?String(key).slice(4):"";
  const events=[];
  requests.forEach(request=>linesOf(request).forEach(line=>{
    const match=outside
      ?line.isOutsideBoq&&(line.outsideKey||outsideKey(line.description,line.specification,line.unit))===outKey
      :!line.isOutsideBoq&&line.baselineItemId===key;
    if(match)events.push({request,line});
  }));
  return events;
}

function requestImpact(req){
  let overCount=0,excessBidValue=0,excessCost=0;
  const grouped=new Map();

  linesOf(req).forEach(line=>{
    const key=line.isOutsideBoq?`OUT:${line.outsideKey||outsideKey(line.description,line.specification,line.unit)}`:line.baselineItemId;
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(line);
  });

  grouped.forEach((lines,key)=>{
    const outside=String(key).startsWith("OUT:");
    const b=outside?null:baseline.find(x=>x.id===key);

    // Lấy phần đã duyệt/đặt TRƯỚC phiếu đang xem để không cộng phiếu này hai lần
    // khi phiếu đã ở trạng thái APPROVED/ORDERED.
    const before=lineEventsForKey(key)
      .filter(e=>e.request.id!==req.id&&COUNTED_STATUSES.has(e.request.status))
      .reduce((sum,e)=>sum+Number(e.line.boqQty||0),0);

    const baselineQty=outside?0:Number(b?.qty||0);
    let cursor=before,itemExcessCost=0,itemBid=0;

    lines.forEach(line=>{
      const qty=Number(line.boqQty||0),after=cursor+qty;
      const extra=Math.max(0,after-baselineQty)-Math.max(0,cursor-baselineQty);
      if(extra>0){
        itemExcessCost+=extra*Number(line.costUnitPrice||b?.materialUnit||0);
        itemBid+=extra*Number(line.bidUnit||b?.bidUnit||0);
      }
      cursor=after;
    });

    if(cursor>baselineQty){
      overCount++;
      excessBidValue+=itemBid;
      excessCost+=itemExcessCost;
    }
  });

  return {overCount,excessBidValue,excessCost};
}

function projectedLineImpact(line){
  if(line.isOutsideBoq)return {excessQty:Number(line.boqQty||0)};
  const b=baseline.find(x=>x.id===line.baselineItemId),row=aggregateRows().find(x=>x.key===line.baselineItemId);
  const before=Number(row?.confirmedQty||0),after=before+Number(line.boqQty||0);
  return {excessQty:Math.max(0,after-Number(b?.qty||0))};
}

function summaryTotals(rows){
  const baselineValue=rows.filter(r=>!r.isOutside).reduce((s,r)=>s+Number(r.baselineQty||0)*Number(r.bidUnit||0),0);
  const tenderValue=rows.filter(r=>!r.isOutside).reduce((s,r)=>s+Number(r.tenderQty||0)*Number(r.tenderBidUnit||0),0);
  const contractRows=rows.filter(r=>!r.isOutside&&(Math.abs(Number(r.contractDeltaQty||0))>1e-9||Math.abs(Number(r.contractDeltaValue||0))>0.5));
  const confirmed=requests.filter(r=>COUNTED_STATUSES.has(r.status));
  const orderedValue=rows.reduce((s,r)=>s+Number(r.confirmedQty||0)*Number(r.bidUnit||0),0);
  const over=rows.filter(r=>(r.isOutside&&r.confirmedQty>0)||r.confirmedQty>r.baselineQty);
  return {
    baselineValue,tenderValue,contractDeltaValue:baselineValue-tenderValue,contractChangedCount:contractRows.length,
    orderedValue,confirmedRequests:confirmed.length,
    overCount:over.length,outsideCount:rows.filter(r=>r.isOutside&&r.confirmedQty>0).length,
    excessBidValue:over.reduce((s,r)=>s+Number(r.excessBidValue||0),0),
    excessCost:over.reduce((s,r)=>s+Number(r.excessCost||0),0),
    nearCount:rows.filter(r=>!r.isOutside&&r.baselineQty>0&&r.confirmedQty/r.baselineQty>=0.9&&r.confirmedQty<=r.baselineQty).length
  };
}

function rowState(r){
  if(r.isOutside&&r.confirmedQty>0)return {key:"RED",label:"NGOÀI BOQ",color:"red"};
  if(r.confirmedQty>r.baselineQty)return {key:"RED",label:"VƯỢT BOQ",color:"red"};
  if(!r.isOutside&&r.baselineQty>0&&r.confirmedQty+r.pendingQty>r.baselineQty)return {key:"YELLOW",label:"CHỜ DUYỆT SẼ VƯỢT",color:"orange"};
  const usage=r.baselineQty?r.confirmedQty/r.baselineQty:0;
  const projected=r.baselineQty?(r.confirmedQty+r.pendingQty)/r.baselineQty:0;
  if(usage>=0.9||projected>=0.9)return {key:"YELLOW",label:usage>=0.9?"GẦN HẾT":"CHỜ DUYỆT GẦN HẾT",color:"orange"};
  if(r.confirmedQty>0)return {key:"GREEN",label:"TRONG BOQ",color:"green"};
  return {key:"GRAY",label:"CHƯA ĐẶT",color:"gray"};
}

function canEditRequest(r){
  const u=getProfile()||{};
  if(["ADMIN","DIRECTOR","MANAGER"].includes(u.role))return r.status==="DRAFT";
  return r.status==="DRAFT"&&r.requesterUid===u.uid&&can("quantityRequestCreate");
}

async function audit(action,message,extra={}){
  const u=getProfile()||{},key=refs.quantityAuditProject(projectId).push().key;
  await refs.quantityAuditItem(projectId,key).set({
    action,message,...sanitize(extra),userUid:u.uid||"",userName:u.displayName||"",userEmail:u.email||"",createdAt:ts()
  });
}

async function reload(){
  await loadData();paint();
}

function exportCsv(){
  const rows=aggregateRows(),totals=summaryTotals(rows);
  const data=[
    ["KIỂM SOÁT KHỐI LƯỢNG ĐẶT HÀNG"],
    ["Tender Revision",tenderRevision?.code||"R0",tenderRevision?.name||""],
    ["Baseline áp dụng",activeRevision?.code||baselineMeta.activeRevisionCode||"R0",activeRevision?.name||baselineMeta.activeRevisionName||""],
    ["Ngày kích hoạt",fmtDateTime(baselineMeta.activatedAt||baselineMeta.frozenAt)],
    ["Giá trị Tender R0",totals.tenderValue],
    ["Giá trị Baseline hiện hành",totals.baselineValue],
    ["Chênh HĐ so Tender",totals.contractDeltaValue],
    ["Giá trị vượt do công trường",totals.excessBidValue],
    [],
    ["Mã BOQ","Hệ","Mô tả","Thông số","ĐVT","Tender R0","Baseline hiện hành","Δ HĐ","Đã duyệt/đặt","Chờ duyệt","Còn lại","Vượt công trường","% sử dụng","Giá HĐ/ĐVT","GT Δ HĐ","GT vượt công trường","Chi phí vượt","Trạng thái"],
    ...rows.map(r=>[
      r.itemNo,r.discipline,r.description,r.specification,r.unit,r.tenderQty,r.baselineQty,r.contractDeltaQty,
      r.confirmedQty,r.pendingQty,r.baselineQty-r.confirmedQty,Math.max(0,r.confirmedQty-r.baselineQty),
      r.baselineQty?r.confirmedQty/r.baselineQty*100:(r.confirmedQty?100:0),r.bidUnit,r.contractDeltaValue,r.excessBidValue,r.excessCost,rowState(r).label
    ]),
    [],
    ["BOQ REVISION"],
    ["Rev","Loại","Tên","Ngày hiệu lực","Trạng thái","Số dòng","Giá trị","Nguồn file"],
    ...[...revisions].sort((a,b)=>Number(a.revisionNo||0)-Number(b.revisionNo||0)).map(r=>[
      r.code,r.type,r.name,r.effectiveDate,r.status,r.lineCount||Object.keys(r.items||{}).length,revisionTotal(r.items||{}),r.sourceFileName||r.source||""
    ]),
    [],
    ["PHIẾU ĐẶT HÀNG"],
    ["Mã phiếu","Ngày","Người đề nghị","Khu vực","Trạng thái","Số dòng","Ghi chú"],
    ...requests.map(r=>[r.code,r.requestDate,r.requesterName,r.location,statusInfo(r.status).label,linesOf(r).length,r.notes])
  ];
  downloadCsv(`KIEM_SOAT_KHOI_LUONG_${activeRevision?.code||"R0"}_${projectId}.csv`,data);
}

function linesOf(r){return toArray(r?.lines||{})}
function statusInfo(k){const x=ORDER_STATUSES[k]||[k||"Nháp","gray"];return{label:x[0],color:x[1]}}
function reasonLabel(k){return REASONS.find(x=>x[0]===k)?.[1]||"Khác"}
function statusVariation(k){return {DRAFT:"Nháp",SUBMITTED:"Đã trình",APPROVED:"Đã duyệt",REJECTED:"Từ chối"}[k]||k||""}
function calcBoq(x){const base=Number(x.materialUnit||0)+Number(x.laborUnit||0)+Number(x.subcontractUnit||0)+Number(x.otherUnit||0),netUnit=base*(1+Number(x.wastePct||0)/100),bidUnit=netUnit*(1+Number(x.markupPct||0)/100);return{netUnit,bidUnit}}
function itemSort(a,b){return String(a.itemNo||"").localeCompare(String(b.itemNo||""),"vi",{numeric:true})}
function outsideKey(desc,spec,unit){return norm(`${desc}|${spec}|${unit}`).replace(/[^a-z0-9|_-]+/g,"-").slice(0,160)}
function nextRequestCode(){
  const y=new Date().getFullYear();
  const max=requests.reduce((m,r)=>{const x=String(r.code||"").match(new RegExp(`^DDH-${y}-(\\d+)$`));return x?Math.max(m,Number(x[1]||0)):m},0);
  return `DDH-${y}-${String(max+1).padStart(3,"0")}`;
}
function todayIso(){return new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)}
function num(v,d=2){return Number(v||0).toLocaleString("vi-VN",{maximumFractionDigits:d})}
function signedQty(v){const n=Number(v||0);return `${n>0?"+":""}${num(n,3)}`}
function signedMoney(v){const n=Number(v||0);return `${n>0?"+":n<0?"-":""}${money(Math.abs(n))}`}
function toArray(v){return Object.entries(v||{}).map(([id,x])=>({id,...(x||{})}))}
function sanitize(v){try{return JSON.parse(JSON.stringify(v??{}))}catch{return{}}}
function metric(label,value,icon,c,s,foot){return `<div class="metric" style="--c:${c};--s:${s}"><div class="metric-head"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></div>`}
function smallMetric(label,value,color="blue"){return `<div class="mini-metric ${color}"><span>${label}</span><b>${value}</b></div>`}
function csvEscape(v){return `"${String(v??"").replaceAll('"','""')}"`}
function downloadCsv(name,rows){const csv=rows.map(r=>(r||[]).map(csvEscape).join(";")).join("\r\n"),blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
