import {
  refs, arr, ts, logActivity, can, getProfile, esc, norm, money, fmtDateTime,
  setPage, loading, empty, badge, modal, toast, confirmBox
} from "../core.js?v=2.20.1";

let projects=[];
let selectedProjectId="";
let boqItems=[];
let boqMeta={};
let materialImports=[];
let materialRows=[];
let tab="BOQ";
let q="";
let matchCache=new Map();
let boqEditorSelection=null;
let boqEditorAnchor=null;
let boqEditorDirty=false;
let univerInstance=null;
let univerAPI=null;
let univerDisposers=[];
let univerDirty=false;
let workspaceFilter="ALL";
let workspaceFullscreen=false;
let workspaceFullscreenKeyBound=false;
let materialIndex={byCode:new Map(),byUnit:new Map(),all:[]};

const BOQ_ALIASES={
  code:["code gia","code giá","ma gia","mã giá","ma vat tu","mã vật tư","code","item code"],
  itemNo:["tt","stt","muc","mục","item no","no","so thu tu","số thứ tự"],
  description:["dien giai","diễn giải","mo ta","mô tả","noi dung","nội dung","ten vat tu","tên vật tư","ten hang","tên hàng","description","item description"],
  specification:["model thong so ky thuat","model/thông số kỹ thuật","model","thong so ky thuat","thông số kỹ thuật","thong so","thông số","quy cach","quy cách","spec","specification"],
  unit:["don vi","đơn vị","dvt","đvt","unit","uom"],
  qty:["khoi luong","khối lượng","so luong","số lượng","qty","quantity"],
  brand:["nhan hieu","nhãn hiệu","thuong hieu","thương hiệu","brand","manufacturer"],
  origin:["xuat xu","xuất xứ","origin","country of origin"],
  materialUnit:["vat tu chinh","vật tư chính","gia vat tu","giá vật tư","don gia vat tu","đơn giá vật tư","material price"],
  laborUnit:["don gia nhan cong","đơn giá nhân công","nhan cong","nhân công","gia nhan cong","giá nhân công","labor"],
  totalUnit:["tong don gia","tổng đơn giá","don gia tong","đơn giá tổng","total unit","unit total"],
  amount:["thanh tien","thành tiền","tong thanh tien","tổng thành tiền","amount","total amount"]
};

const PRICE_ALIASES={
  code:[
    "ma hang","mã hàng","ma vat tu","mã vật tư","ma sp","mã sp","ma san pham","mã sản phẩm",
    "item code","code","sku","part no","part number","catalog no","model code"
  ],
  description:[
    "ten vat tu","tên vật tư","ten hang","tên hàng","ten hang hoa","tên hàng hóa","ten san pham","tên sản phẩm",
    "ten thiet bi","tên thiết bị","hang hoa","hàng hóa","mo ta","mô tả","mo ta hang hoa","mô tả hàng hóa",
    "dien giai","diễn giải","noi dung","nội dung","description","item description","product","product name",
    "goods description","description of goods","item","equipment","material"
  ],
  specification:[
    "quy cach","quy cách","model","model no","model number","thong so","thông số","thong so ky thuat","thông số kỹ thuật",
    "spec","specification","kich thuoc","kích thước","size","type","part number","catalog"
  ],
  unit:["don vi","đơn vị","dvt","đvt","unit","uom","unit of measure"],
  brand:["nhan hieu","nhãn hiệu","thuong hieu","thương hiệu","hang","hãng","brand","manufacturer","make"],
  origin:["xuat xu","xuất xứ","origin","country of origin","country"],
  unitPrice:[
    "don gia","đơn giá","don gia vnd","đơn giá vnd","don gia vnđ","đơn giá vnđ",
    "don gia chua vat","đơn giá chưa vat","don gia truoc thue","đơn giá trước thuế",
    "don gia sau chiet khau","đơn giá sau chiết khấu","don gia sau ck","đơn giá sau ck",
    "gia ban","giá bán","gia vat tu","giá vật tư","gia chao","giá chào","gia net","giá net",
    "unit price","unit rate","unit cost","price","price vnd","net price","rate","gia","giá"
  ],
  supplier:["nha cung cap","nhà cung cấp","ncc","supplier","vendor","seller"]
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
  disposeUniver();
  const project=projects.find(p=>p.id===selectedProjectId);
  const itemRows=boqItems.filter(isPriceableItem);
  const materialPriced=itemRows.filter(x=>Number(x.materialUnit||0)>0).length;
  const laborPriced=itemRows.filter(x=>Number(x.laborUnit||0)>0).length;
  const matches=matchingRows();
  const review=matches.filter(x=>Number(x.item.materialUnit||0)<=0&&x.best?.score>=78&&x.best?.score<95).length;
  const missing=itemRows.filter(x=>Number(x.materialUnit||0)<=0&&!((matchCache.get(x.id)||[])[0]?.score>=78)).length;

  container.innerHTML=`
    <div class="page-head tender-pricing-head v220-head">
      <div>
        <div class="eyebrow">BOQ PRICING WORKSPACE</div>
        <h2>Lập giá đấu thầu</h2>
        <p>Một màn hình duy nhất: sửa BOQ như spreadsheet, thêm báo giá khi có, tự ráp vật tư và tự lấy nhân công từ CTG/CTC.</p>
      </div>
      <div class="actions v220-actions">
        ${selectedProjectId&&can("boqEdit")?`<button class="btn" id="uploadBoqBtn">${boqItems.length?"Thay BOQ":"＋ Tải BOQ"}</button>`:""}
        ${selectedProjectId&&boqItems.length&&can("quoteEdit")?`<button class="btn primary" id="uploadMaterialQuickBtn">＋ Thêm báo giá</button>`:""}
        ${selectedProjectId&&boqItems.length?`<button class="btn" id="priceLibraryBtn">Kho giá <span class="v220-btn-count">${materialImports.length}</span></button>`:""}
        ${selectedProjectId&&boqItems.length?`<button class="btn green" id="exportOriginalXlsxBtn">⇩ Xuất Excel</button>`:""}
      </div>
    </div>

    <div class="toolbar tender-project-toolbar v220-projectbar">
      <select id="pricingProjectSelect" style="min-width:360px">
        <option value="">-- Chọn dự án --</option>
        ${projects.filter(p=>p.phase==="TENDER"||p.phase==="EXECUTION").map(p=>`<option value="${p.id}" ${p.id===selectedProjectId?"selected":""}>${esc(p.code||"")} - ${esc(p.name||"")}</option>`).join("")}
      </select>
      ${selectedProjectId?`<div class="pricing-project-chip">${esc(project?.client||"")}</div>`:""}
      ${boqMeta?.fileName?`<div class="v220-file-chip" title="File BOQ gốc"><b>${esc(boqMeta.fileName)}</b><span>${esc(boqMeta.sheetName||"")}</span></div>`:""}
    </div>

    ${selectedProjectId?`
      <div class="v220-status-row">
        ${v220Stat("Đầu mục có KL",itemRows.length,"blue")}
        ${v220Stat("Vật tư",`${materialPriced}/${itemRows.length}`,materialPriced===itemRows.length&&itemRows.length?"green":"orange")}
        ${v220Stat("Nhân công CTG/CTC",`${laborPriced}/${itemRows.length}`,laborPriced===itemRows.length&&itemRows.length?"green":"blue")}
        ${v220Stat("Cần kiểm tra",review,review?"orange":"green","review")}
        ${v220Stat("Chưa có giá VT",missing,missing?"red":"green","missing")}
      </div>
      ${workspaceBoqPanel()}
    `:empty("Chưa có dự án","Tạo/chọn dự án đấu thầu trước khi lập giá.","▣")}
  `;

  bind(container);
  if(selectedProjectId&&boqMeta?.sourceGrid?.rows?.length){
    requestAnimationFrame(()=>mountUniverBoq(container));
  }
}

function v220Stat(label,value,color,filter=""){
  const tag=filter?`button type="button" data-workspace-filter="${filter}"`:`div`;
  const close=filter?"button":"div";
  return `<${tag} class="v220-stat ${color}"><span>${label}</span><b>${value}</b></${close}>`;
}

function workspaceBoqPanel(){
  const grid=boqMeta?.sourceGrid||null;
  if(!grid?.rows?.length){
    return `<div class="card v220-empty-card">${empty("Chưa có BOQ","Bấm “Tải BOQ”. Nếu file có Sheet CTG/CTC, hệ thống tự lấy cột T làm nguồn nhân công ngay khi nhập.","▦")}</div>`;
  }
  const exact=matchingRows().filter(x=>x.best?.score>=95).length;
  const review=matchingRows().filter(x=>x.best?.score>=78&&x.best?.score<95).length;
  return `<div class="card v220-workbook-card ${workspaceFullscreen?"is-fullscreen":""}">
    <div class="v220-workbook-top">
      <div>
        <b>${esc(boqMeta.fileName||"BOQ.xlsx")}</b>
        <span>Sheet ${esc(boqMeta.sheetName||grid.sheetName||"")} · ${Number(grid.rowCount||0)} hàng × ${Number(grid.colCount||0)} cột</span>
      </div>
      <div class="v220-workbook-tools">
        ${can("boqEdit")?`<button class="btn sm primary" id="saveUniverBtn">Lưu BOQ</button>`:""}
        ${review?`<button class="btn sm orange" id="reviewPriceBtn">Kiểm tra ${review} giá</button>`:""}
        ${can("quoteEdit")?`<button class="btn sm v220-full-only" id="fullscreenAddQuoteBtn">＋ Báo giá</button>`:""}
        <button class="btn sm green v220-full-only" id="fullscreenExportBtn">⇩ Excel</button>
        <button class="btn sm v220-fullscreen-btn" id="toggleBoqFullscreenBtn" title="Mở BOQ toàn màn hình như ứng dụng Excel">⛶ Toàn màn hình</button>
        ${exact?`<span class="v220-auto-note">${exact} ứng viên ≥95% được tự dùng khi ô giá còn trống</span>`:""}
        <span id="univerSaveState" class="v220-save-state">✓ Đã lưu</span>
      </div>
    </div>
    <div class="v220-sheet-legend">
      <span><i class="dot auto"></i> Giá đã ráp</span>
      <span><i class="dot labor"></i> Nhân công từ CTG/CTC cột T</span>
      <span><i class="dot review"></i> Cần kiểm tra</span>
      <span><i class="dot missing"></i> Chưa có giá</span>
      <span class="push">Ctrl+C/V · kéo cột/hàng · merge · font · căn lề · <b>Esc để thoát toàn màn hình</b></span>
    </div>
    <div id="univerBoqHost" class="v220-univer-host"></div>
  </div>`;
}


function disposeUniver(){
  for(const d of univerDisposers||[]){
    try{if(typeof d==="function")d();else d?.dispose?.()}catch{}
  }
  univerDisposers=[];
  try{univerInstance?.dispose?.()}catch{}
  univerInstance=null;univerAPI=null;univerDirty=false;
}

function v220StyleToUniver(st){
  if(!st||typeof st!=="object")return undefined;
  const out={};
  if(st.ff)out.ff=String(st.ff);
  if(Number(st.fs)>0)out.fs=Number(st.fs);
  if(st.b)out.bl=1;
  if(st.i)out.it=1;
  if(st.bg&&/^#[0-9A-F]{6}$/i.test(st.bg))out.bg={rgb:st.bg};
  if(st.fg&&/^#[0-9A-F]{6}$/i.test(st.fg))out.cl={rgb:st.fg};
  const hm={left:1,center:2,right:3},vm={top:1,middle:2,bottom:3};
  if(hm[st.h])out.ht=hm[st.h];
  if(vm[st.v])out.vt=vm[st.v];
  if(st.w)out.tb=3;
  return Object.keys(out).length?out:undefined;
}

function v220UniverStyleToGrid(st){
  if(!st||typeof st!=="object")return null;
  const out={};
  if(st.ff)out.ff=String(st.ff);
  if(Number(st.fs)>0)out.fs=Number(st.fs);
  if(Number(st.bl||0))out.b=1;
  if(Number(st.it||0))out.i=1;
  if(st.bg?.rgb)out.bg=String(st.bg.rgb);
  if(st.cl?.rgb)out.fg=String(st.cl.rgb);
  const hm={1:"left",2:"center",3:"right"},vm={1:"top",2:"middle",3:"bottom"};
  if(hm[st.ht])out.h=hm[st.ht];
  if(vm[st.vt])out.v=vm[st.vt];
  if(Number(st.tb||0)===3)out.w=1;
  return Object.keys(out).length?out:null;
}

function v220OverlayStyle(base,extra){
  return {...(base||{}),...(extra||{})};
}

function buildUniverWorkbookData(rawGrid){
  const grid=normalizePricingSourceGrid(JSON.parse(JSON.stringify(rawGrid||{})));
  ensurePricingGridShape(grid);
  const map=boqMeta?.columnMap||{};
  const qtyCol=Number(map.qty??-1),materialCol=Number(map.materialUnit??-1),laborCol=Number(map.laborUnit??-1);
  const totalCol=Number(map.totalUnit??-1),amountCol=Number(map.amount??-1);
  syncPricingDynamicValuesIntoGrid(grid,{qtyCol,materialCol,laborCol,totalCol,amountCol});

  const itemByRow=new Map(boqItems.map(x=>[Number(x.sourceRow||0),x]));
  const cellData={},styles=grid.styles||{};
  for(let r=0;r<grid.rowCount;r++){
    const row=grid.rows[r]||[];
    const excelRow=Number(grid.startRow||1)+r;
    const item=itemByRow.get(excelRow);
    cellData[r]={};
    for(let c=0;c<grid.colCount;c++){
      let value=row[c]??"";
      const numericCol=[qtyCol,materialCol,laborCol,totalCol,amountCol].includes(c);
      if(numericCol&&String(value).trim()!==""&&isNumericLike(value))value=toNumber(value);
      let st=v220StyleToUniver(styles[`${r}_${c}`]);

      if(item&&isPriceableItem(item)){
        if(c===materialCol){
          const best=(matchCache.get(item.id)||[])[0];
          if(Number(item.materialUnit||0)>0&&item.materialPriceSource?.fileName)st=v220OverlayStyle(st,{bg:{rgb:"#DCFCE7"}});
          else if(Number(item.materialUnit||0)<=0&&best?.score>=78)st=v220OverlayStyle(st,{bg:{rgb:"#FEF3C7"}});
          else if(Number(item.materialUnit||0)<=0)st=v220OverlayStyle(st,{bg:{rgb:"#FEE2E2"}});
        }else if(c===laborCol&&item.laborPriceSource?.sheetName){
          st=v220OverlayStyle(st,{bg:{rgb:"#DBEAFE"}});
        }
      }
      const cell={v:value};
      if(st)cell.s=st;
      cellData[r][c]=cell;
    }
  }
  const rowData={},columnData={};
  for(let r=0;r<grid.rowCount;r++)rowData[r]={h:Math.max(18,Number(grid.rowHeights?.[r]||26))};
  for(let c=0;c<grid.colCount;c++)columnData[c]={w:Math.max(36,Number(grid.colWidths?.[c]||100))};
  const mergeData=(grid.merges||[]).map(m=>({
    startRow:Number(m.r1),endRow:Number(m.r2),startColumn:Number(m.c1),endColumn:Number(m.c2)
  }));
  const sheetId="boq-sheet";
  return {
    id:`boq-${selectedProjectId||"project"}`,
    name:boqMeta?.fileName||"BOQ",
    appVersion:"0.25.1",
    locale:"vi-VN",
    styles:{},
    sheetOrder:[sheetId],
    sheets:{
      [sheetId]:{
        id:sheetId,
        name:boqMeta?.sheetName||grid.sheetName||"BOQ",
        rowCount:Math.max(1,Number(grid.rowCount||1)),
        columnCount:Math.max(1,Number(grid.colCount||1)),
        defaultColumnWidth:100,
        defaultRowHeight:26,
        mergeData,cellData,rowData,columnData,
        rowHeader:{width:48,hidden:0},columnHeader:{height:24,hidden:0},showGridlines:1
      }
    }
  };
}

function mountUniverBoq(container){
  const host=container.querySelector("#univerBoqHost");
  if(!host||!boqMeta?.sourceGrid?.rows?.length)return;
  disposeUniver();

  try{
    const P=globalThis.UniverPresets,C=globalThis.UniverCore,S=globalThis.UniverPresetSheetsCore;
    if(!P?.createUniver||!S?.UniverSheetsCorePreset)throw new Error("Univer CDN chưa sẵn sàng");
    const vi=globalThis.UniverPresetSheetsCoreViVN||{};
    const merged=C?.mergeLocales?C.mergeLocales(vi):vi;
    const created=P.createUniver({
      locale:"vi-VN",
      locales:{"vi-VN":merged},
      presets:[S.UniverSheetsCorePreset({container:host,header:true,toolbar:true})]
    });
    univerInstance=created.univer;univerAPI=created.univerAPI;
    univerAPI.createWorkbook(buildUniverWorkbookData(boqMeta.sourceGrid));
    univerDirty=false;v220SetSaveState(false);

    const off=univerAPI.onCommandExecuted?.((command)=>{
      const id=String(command?.id||"").toLowerCase();
      if(/selection|scroll|focus|hover|activate|zoom/.test(id))return;
      univerDirty=true;v220SetSaveState(true);
    });
    if(off)univerDisposers.push(off);
  }catch(e){
    console.error("[V2.20] Không khởi tạo được Univer, dùng bảng dự phòng:",e);
    host.innerHTML=`<div class="v220-univer-fallback"><b>Spreadsheet engine chưa tải được.</b><span>Đang dùng BOQ Editor dự phòng; tải lại trang nếu muốn thanh công cụ Excel đầy đủ.</span>${pricingBoqOriginalGrid(boqMeta.sourceGrid)}</div>`;
    bindPricingBoqEditor(container);
  }
}

function v220SetSaveState(dirty){
  const el=document.querySelector("#univerSaveState");
  if(!el)return;
  el.textContent=dirty?"● Chưa lưu":"✓ Đã lưu";
  el.classList.toggle("dirty",dirty);
}

function univerSnapshotToGrid(snapshot,baseGrid){
  const grid=normalizePricingSourceGrid(JSON.parse(JSON.stringify(baseGrid||{})));
  const sid=snapshot?.sheetOrder?.[0]||Object.keys(snapshot?.sheets||{})[0];
  const sh=snapshot?.sheets?.[sid];
  if(!sh)return grid;
  const rowCount=Math.max(1,Number(sh.rowCount||grid.rowCount||1));
  const colCount=Math.max(1,Number(sh.columnCount||grid.colCount||1));
  const rows=Array.from({length:rowCount},()=>Array.from({length:colCount},()=>""));
  const styles={};
  for(const [rk,cols] of Object.entries(sh.cellData||{})){
    const r=Number(rk);if(!Number.isInteger(r)||r<0||r>=rowCount)continue;
    for(const [ck,cell] of Object.entries(cols||{})){
      const c=Number(ck);if(!Number.isInteger(c)||c<0||c>=colCount)continue;
      rows[r][c]=cell?.v??"";
      const st=typeof cell?.s==="object"?v220UniverStyleToGrid(cell.s):null;
      if(st)styles[`${r}_${c}`]=st;
    }
  }
  const rowHeights=Array.from({length:rowCount},(_,r)=>Number(sh.rowData?.[r]?.h||sh.rowData?.[String(r)]?.h||grid.rowHeights?.[r]||26));
  const colWidths=Array.from({length:colCount},(_,c)=>Number(sh.columnData?.[c]?.w||sh.columnData?.[String(c)]?.w||grid.colWidths?.[c]||100));
  const merges=(sh.mergeData||[]).map(m=>({r1:Number(m.startRow),c1:Number(m.startColumn),r2:Number(m.endRow),c2:Number(m.endColumn)}));
  return {...grid,rowCount,colCount,rows,styles,rowHeights,colWidths,merges,
    range:`${pricingExcelColName(Number(grid.startCol||0))}${Number(grid.startRow||1)}:${pricingExcelColName(Number(grid.startCol||0)+colCount-1)}${Number(grid.startRow||1)+rowCount-1}`};
}

async function saveUniverBoq(container){
  if(!selectedProjectId||!can("boqEdit"))return;
  const btn=container.querySelector("#saveUniverBtn");
  try{
    if(btn){btn.disabled=true;btn.textContent="Đang lưu..."}
    if(!univerAPI){
      if(boqMeta?.sourceGrid)await savePricingBoqEditor(boqMeta.sourceGrid,container,btn);
      return;
    }
    const fw=univerAPI.getActiveWorkbook?.();
    await fw?.endEditingAsync?.(true);
    const snapshot=fw?.save?.()||fw?.getSnapshot?.();
    if(!snapshot)throw new Error("Không lấy được dữ liệu spreadsheet.");
    const grid=univerSnapshotToGrid(snapshot,boqMeta.sourceGrid);
    boqEditorDirty=true;
    await savePricingBoqEditor(grid,container,btn);
    univerDirty=false;
  }catch(e){
    console.error(e);toast(e.message||"Không lưu được BOQ.","error");
    if(btn){btn.disabled=false;btn.textContent="Lưu BOQ"}
  }
}

function pricingTab(key,label,count=""){
  return `<button class="pricing-tab ${tab===key?"active":""}" type="button" data-pricing-tab="${key}">${label}${count?`<span>${count}</span>`:""}</button>`;
}

function metricCard(label,value,icon,color){
  return `<div class="pricing-kpi ${color}"><div><span>${label}</span><b>${value}</b></div><i>${icon}</i></div>`;
}


function boqPanel(project){
  const grid=boqMeta?.sourceGrid||null;
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

    ${grid?.rows?.length?`
      <div class="pricing-boq-original-note">
        <b>BOQ gốc</b>
        <span>Giữ nguyên cấu trúc Sheet nhưng cho phép chỉnh trực tiếp toàn bộ ô. Có thể sửa chữ/số, định dạng, gộp ô, chèn/xóa hàng cột và kéo chỉnh kích thước; giá tự ráp vẫn đổ vào đúng cột Vật tư chính.</span>
      </div>
      ${pricingBoqOriginalGrid(grid)}
    `:boqItems.length?`
      <div class="pricing-boq-migrate">
        ${empty("BOQ này được nhập bằng bản cũ","Hãy bấm “Thay BOQ” và chọn lại đúng file Excel để V2.19.1 lưu nguyên bảng BOQ gốc.","▦")}
      </div>
    `:empty("Chưa có BOQ","Bấm “Tải BOQ Excel / CSV”. Hệ thống sẽ giữ nguyên bảng BOQ gốc để lập giá trực tiếp.","▦")}
  </div>`;
}

function pricingBoqOriginalGrid(rawGrid){
  const grid=normalizePricingSourceGrid(rawGrid);
  // Luôn giữ object đang chỉnh ngay trong metadata để repaint không làm mất thay đổi chưa lưu.
  boqMeta.sourceGrid=grid;

  const rows=grid.rows;
  const colCount=Number(grid.colCount||0);
  const rowCount=Number(grid.rowCount||rows.length);
  const startRow=Number(grid.startRow||1);
  const startCol=Number(grid.startCol||0);
  const mergeInfo=pricingMergeLookup(grid.merges||[]);
  const itemByRow=new Map(boqItems.map(x=>[Number(x.sourceRow||0),x]));
  const map=boqMeta?.columnMap||{};
  const qtyCol=Number(map.qty??-1);
  const materialCol=Number(map.materialUnit??-1);
  const laborCol=Number(map.laborUnit??-1);
  const totalCol=Number(map.totalUnit??-1);
  const amountCol=Number(map.amount??-1);
  const canEdit=can("boqEdit");

  // Khi chưa có thay đổi cục bộ, đồng bộ giá trị động từ dữ liệu BOQ vào snapshot Sheet.
  // Nếu đang chỉnh dở thì KHÔNG ghi đè ô vừa sửa bằng dữ liệu cũ từ Firebase.
  if(!boqEditorDirty)syncPricingDynamicValuesIntoGrid(grid,{qtyCol,materialCol,laborCol,totalCol,amountCol});

  const colgroup=`<colgroup><col class="pricing-row-number-col" style="width:48px">`+
    Array.from({length:colCount},(_,c)=>`<col data-pricing-col="${c}" style="width:${pricingGridColWidth(grid.colWidths?.[c],c)}px">`).join("")+
    `</colgroup>`;

  const letters=`<tr class="pricing-excel-col-head"><th class="pricing-excel-corner"></th>${
    Array.from({length:colCount},(_,c)=>`<th data-pricing-col-head="${c}">
      <span>${pricingExcelColName(startCol+c)}</span>
      ${canEdit?`<i class="pricing-col-resizer" data-resize-col="${c}" title="Kéo để chỉnh độ rộng cột"></i>`:""}
    </th>`).join("")
  }</tr>`;

  const body=Array.from({length:rowCount},(_,r)=>{
    const excelRow=startRow+r;
    const item=itemByRow.get(excelRow);
    const row=rows[r]||[];
    let cells=`<th class="pricing-excel-row-head" data-pricing-row-head="${r}"><span>${excelRow}</span>${canEdit?`<i class="pricing-row-resizer" data-resize-row="${r}" title="Kéo để chỉnh chiều cao hàng"></i>`:""}</th>`;

    for(let c=0;c<colCount;c++){
      const key=`${r}_${c}`;
      if(mergeInfo.covered.has(key))continue;
      const m=mergeInfo.starts.get(key);
      const rowspan=m?m.r2-m.r1+1:1;
      const colspan=m?m.c2-m.c1+1:1;
      let value=row[c]??"";

      // Các giá trị động đang lập giá phải hiển thị ngay tại đúng ô BOQ gốc.
      if(item&&item.rowType!=="SECTION"&&item.rowType!=="NOTE"){
        if(c===qtyCol)value=Number(item.qty||0);
        else if(c===materialCol)value=Number(item.materialUnit||0);
        else if(c===laborCol)value=Number(item.laborUnit||0);
      }

      const st=pricingCellStyle(grid.styles?.[key]);
      const rowClass=pricingBoqRowClass(row,r,grid);
      const selected=pricingCellInSelection(r,c)?" pricing-cell-selected":"";
      const editable=canEdit?` contenteditable="true" spellcheck="false"`:"";
      const source=item&&c===materialCol&&item.materialPriceSource?.fileName
        ?`<button type="button" class="pricing-grid-source-dot" data-source-item="${item.id}" title="Xem nguồn giá">●</button>`:"";

      cells+=`<td class="${rowClass}${selected}" data-grid-row="${r}" data-grid-col="${c}"${rowspan>1?` rowspan="${rowspan}"`:""}${colspan>1?` colspan="${colspan}"`:""}${st?` style="${st}"`:""}>
        <div class="pricing-cell-edit-wrap">
          <div class="pricing-cell-editor" data-cell-editor="1" data-grid-row="${r}" data-grid-col="${c}"${editable}>${esc(String(value??""))}</div>
          ${source}
        </div>
      </td>`;
    }
    const rh=Math.max(18,Math.min(500,Number(grid.rowHeights?.[r]||26)));
    return `<tr data-pricing-row="${r}" style="height:${rh}px">${cells}</tr>`;
  }).join("");

  return `<div class="pricing-excel-shell pricing-editor-shell">
    ${canEdit?pricingBoqEditorToolbar():""}
    <div class="pricing-excel-meta">
      <span>Sheet: <b>${esc(boqMeta.sheetName||grid.sheetName||"")}</b></span>
      <span>Vùng: <b>${esc(grid.range||"")}</b></span>
      <span>${rowCount} hàng × ${colCount} cột</span>
      <span class="pricing-editor-help">Click ô để chọn · Shift+click để chọn vùng · Click đúp/chọn rồi gõ để sửa</span>
      ${canEdit?`<span class="pricing-editor-save-state ${boqEditorDirty?"dirty":"saved"}" data-pricing-save-state>${boqEditorDirty?"● Chưa lưu":"✓ Đã lưu"}</span>`:""}
    </div>
    <div class="pricing-excel-scroll">
      <table class="pricing-excel-grid pricing-editable-grid">${colgroup}<thead>${letters}</thead><tbody>${body}</tbody></table>
    </div>
  </div>`;
}

function pricingBoqEditorToolbar(){
  return `<div class="pricing-editor-toolbar">
    <div class="pricing-editor-group">
      <select data-pricing-font title="Font chữ">
        ${["Arial","Calibri","Times New Roman","Tahoma","Verdana"].map(x=>`<option value="${x}">${x}</option>`).join("")}
      </select>
      <select data-pricing-font-size title="Cỡ chữ">
        ${[8,9,10,11,12,14,16,18,20,24].map(x=>`<option value="${x}" ${x===10?"selected":""}>${x}</option>`).join("")}
      </select>
      <button type="button" class="pricing-format-btn bold" data-pricing-format="bold" title="In đậm">B</button>
      <button type="button" class="pricing-format-btn italic" data-pricing-format="italic" title="In nghiêng">I</button>
    </div>
    <div class="pricing-editor-sep"></div>
    <div class="pricing-editor-group">
      <button type="button" class="pricing-format-btn" data-pricing-align="left" title="Căn trái">≡</button>
      <button type="button" class="pricing-format-btn center" data-pricing-align="center" title="Căn giữa">≡</button>
      <button type="button" class="pricing-format-btn right" data-pricing-align="right" title="Căn phải">≡</button>
      <button type="button" class="pricing-editor-btn" data-pricing-action="wrap">Xuống dòng</button>
    </div>
    <div class="pricing-editor-sep"></div>
    <div class="pricing-editor-group">
      <button type="button" class="pricing-editor-btn" data-pricing-action="merge">Gộp ô</button>
      <button type="button" class="pricing-editor-btn" data-pricing-action="merge-across">Gộp ngang</button>
      <button type="button" class="pricing-editor-btn" data-pricing-action="unmerge">Bỏ gộp</button>
    </div>
    <div class="pricing-editor-sep"></div>
    <div class="pricing-editor-group">
      <button type="button" class="pricing-editor-btn" data-pricing-action="insert-row-above">＋ Hàng trên</button>
      <button type="button" class="pricing-editor-btn" data-pricing-action="insert-row-below">＋ Hàng dưới</button>
      <button type="button" class="pricing-editor-btn danger-soft" data-pricing-action="delete-row">Xóa hàng</button>
      <button type="button" class="pricing-editor-btn" data-pricing-action="insert-col-left">＋ Cột trái</button>
      <button type="button" class="pricing-editor-btn" data-pricing-action="insert-col-right">＋ Cột phải</button>
      <button type="button" class="pricing-editor-btn danger-soft" data-pricing-action="delete-col">Xóa cột</button>
    </div>
    <div class="pricing-editor-spacer"></div>
    <button type="button" class="btn primary sm" data-pricing-action="save-grid">Lưu BOQ</button>
  </div>`;
}

function pricingCellInSelection(r,c){
  const s=boqEditorSelection;if(!s)return false;
  return r>=s.r1&&r<=s.r2&&c>=s.c1&&c<=s.c2;
}

function syncPricingDynamicValuesIntoGrid(grid,{qtyCol=-1,materialCol=-1,laborCol=-1,totalCol=-1,amountCol=-1}={}){
  const startRow=Number(grid?.startRow||1);
  for(const item of boqItems||[]){
    const sourceRow=Number(item?.sourceRow||0);
    const r=sourceRow-startRow;
    if(r<0||r>=Number(grid?.rowCount||0)||!Array.isArray(grid.rows?.[r]))continue;
    if(item.rowType==="SECTION"||item.rowType==="NOTE")continue;
    const qty=Number(item.qty||0),material=Number(item.materialUnit||0),labor=Number(item.laborUnit||0);
    if(qtyCol>=0&&qtyCol<grid.colCount&&qty>0)grid.rows[r][qtyCol]=qty;
    if(materialCol>=0&&materialCol<grid.colCount)grid.rows[r][materialCol]=material||"";
    if(laborCol>=0&&laborCol<grid.colCount)grid.rows[r][laborCol]=labor||"";
    if(totalCol>=0&&totalCol<grid.colCount&&(material||labor))grid.rows[r][totalCol]=material+labor;
    if(amountCol>=0&&amountCol<grid.colCount&&qty&&(material||labor))grid.rows[r][amountCol]=(material+labor)*qty;
  }
}

function bindPricingBoqEditor(container){
  if(tab!=="BOQ"||!can("boqEdit"))return;
  const shell=container.querySelector(".pricing-editor-shell");
  const table=shell?.querySelector(".pricing-editable-grid");
  if(!shell||!table||!boqMeta?.sourceGrid)return;

  const grid=normalizePricingSourceGrid(boqMeta.sourceGrid);
  boqMeta.sourceGrid=grid;

  const markDirty=()=>{
    boqEditorDirty=true;
    boqMeta.sourceGrid=grid;
    const st=shell.querySelector("[data-pricing-save-state]");
    if(st){st.textContent="● Chưa lưu";st.classList.add("dirty");st.classList.remove("saved")}
  };

  const repaint=()=>{
    boqMeta.sourceGrid=grid;
    paint(container);
  };

  const setSelection=(sel,{anchor=true}={})=>{
    boqEditorSelection=normalizePricingSelection(sel,grid);
    if(anchor)boqEditorAnchor={...boqEditorSelection};
    paintPricingSelection(table,boqEditorSelection);
  };

  const requireSelection=()=>{
    if(boqEditorSelection)return true;
    toast("Chọn ô, hàng hoặc cột trước.","warning");
    return false;
  };

  // Chọn ô/vùng và chỉnh trực tiếp nội dung.
  table.querySelectorAll("td[data-grid-row][data-grid-col]").forEach(td=>{
    const r=Number(td.dataset.gridRow),c=Number(td.dataset.gridCol);
    td.addEventListener("mousedown",e=>{
      if(e.button!==0||e.target.closest(".pricing-grid-source-dot"))return;
      if(e.shiftKey&&boqEditorAnchor){
        setSelection({type:"cell",r1:boqEditorAnchor.r1,c1:boqEditorAnchor.c1,r2:r,c2:c},{anchor:false});
      }else{
        setSelection({type:"cell",r1:r,c1:c,r2:r,c2:c});
      }
    });
  });

  table.querySelectorAll("[data-cell-editor]").forEach(ed=>{
    const r=Number(ed.dataset.gridRow),c=Number(ed.dataset.gridCol);
    const commit=()=>{
      ensurePricingGridShape(grid);
      const value=String(ed.innerText??"").replace(/\r/g,"");
      if(String(grid.rows[r]?.[c]??"")===value)return;
      grid.rows[r][c]=value;
      markDirty();
    };
    ed.addEventListener("input",commit);
    ed.addEventListener("blur",commit);
    ed.addEventListener("paste",e=>{
      e.preventDefault();
      const text=e.clipboardData?.getData("text/plain")??"";
      document.execCommand?.("insertText",false,text);
    });
  });

  // Chọn cả hàng/cột bằng header giống Excel. Shift+click để chọn liên tiếp.
  table.querySelectorAll("[data-pricing-row-head]").forEach(th=>th.addEventListener("click",e=>{
    if(e.target.closest(".pricing-row-resizer"))return;
    const r=Number(th.dataset.pricingRowHead),lastC=Math.max(0,Number(grid.colCount||1)-1);
    if(e.shiftKey&&boqEditorAnchor?.type==="row"){
      setSelection({type:"row",r1:boqEditorAnchor.r1,r2:r,c1:0,c2:lastC},{anchor:false});
    }else setSelection({type:"row",r1:r,r2:r,c1:0,c2:lastC});
  }));
  table.querySelectorAll("[data-pricing-col-head]").forEach(th=>th.addEventListener("click",e=>{
    if(e.target.closest(".pricing-col-resizer"))return;
    const c=Number(th.dataset.pricingColHead),lastR=Math.max(0,Number(grid.rowCount||1)-1);
    if(e.shiftKey&&boqEditorAnchor?.type==="col"){
      setSelection({type:"col",c1:boqEditorAnchor.c1,c2:c,r1:0,r2:lastR},{anchor:false});
    }else setSelection({type:"col",c1:c,c2:c,r1:0,r2:lastR});
  }));

  // Định dạng chữ.
  shell.querySelector("[data-pricing-font]")?.addEventListener("change",e=>{
    if(!requireSelection())return;
    applyPricingStyle(grid,boqEditorSelection,{ff:String(e.target.value||"Arial")});
    markDirty();repaint();
  });
  shell.querySelector("[data-pricing-font-size]")?.addEventListener("change",e=>{
    if(!requireSelection())return;
    applyPricingStyle(grid,boqEditorSelection,{fs:Number(e.target.value||10)});
    markDirty();repaint();
  });
  shell.querySelectorAll("[data-pricing-format]").forEach(btn=>btn.addEventListener("click",()=>{
    if(!requireSelection())return;
    const k=btn.dataset.pricingFormat==="bold"?"b":"i";
    togglePricingStyle(grid,boqEditorSelection,k);
    markDirty();repaint();
  }));
  shell.querySelectorAll("[data-pricing-align]").forEach(btn=>btn.addEventListener("click",()=>{
    if(!requireSelection())return;
    applyPricingStyle(grid,boqEditorSelection,{h:btn.dataset.pricingAlign});
    markDirty();repaint();
  }));

  // Kéo chỉnh rộng cột.
  table.querySelectorAll("[data-resize-col]").forEach(handle=>{
    handle.addEventListener("pointerdown",e=>{
      if(e.button!==0)return;
      e.preventDefault();e.stopPropagation();
      const c=Number(handle.dataset.resizeCol);
      const col=table.querySelector(`col[data-pricing-col="${c}"]`);
      if(!col)return;
      const startX=e.clientX,startW=parseFloat(col.style.width)||pricingGridColWidth(grid.colWidths?.[c],c);
      document.body.classList.add("pricing-resizing-col");
      const move=ev=>{
        const w=Math.max(36,Math.min(900,startW+(ev.clientX-startX)));
        col.style.width=`${w}px`;
      };
      const up=()=>{
        document.removeEventListener("pointermove",move);
        document.body.classList.remove("pricing-resizing-col");
        grid.colWidths[c]=Math.max(36,Math.min(900,Math.round(parseFloat(col.style.width)||startW)));
        markDirty();
      };
      document.addEventListener("pointermove",move);
      document.addEventListener("pointerup",up,{once:true});
    });
    handle.addEventListener("dblclick",e=>{
      e.preventDefault();e.stopPropagation();
      const c=Number(handle.dataset.resizeCol);
      grid.colWidths[c]=pricingEditorAutoColWidth(grid,c);
      markDirty();repaint();
    });
  });

  // Kéo chỉnh cao hàng.
  table.querySelectorAll("[data-resize-row]").forEach(handle=>{
    handle.addEventListener("pointerdown",e=>{
      if(e.button!==0)return;
      e.preventDefault();e.stopPropagation();
      const r=Number(handle.dataset.resizeRow),tr=table.querySelector(`tr[data-pricing-row="${r}"]`);
      if(!tr)return;
      const startY=e.clientY,startH=parseFloat(tr.style.height)||Number(grid.rowHeights?.[r]||26);
      document.body.classList.add("pricing-resizing-row");
      const move=ev=>{tr.style.height=`${Math.max(18,Math.min(500,startH+(ev.clientY-startY)))}px`};
      const up=()=>{
        document.removeEventListener("pointermove",move);
        document.body.classList.remove("pricing-resizing-row");
        grid.rowHeights[r]=Math.max(18,Math.min(500,Math.round(parseFloat(tr.style.height)||startH)));
        markDirty();
      };
      document.addEventListener("pointermove",move);
      document.addEventListener("pointerup",up,{once:true});
    });
    handle.addEventListener("dblclick",e=>{
      e.preventDefault();e.stopPropagation();
      const r=Number(handle.dataset.resizeRow);
      grid.rowHeights[r]=pricingEditorAutoRowHeight(grid,r);
      markDirty();repaint();
    });
  });

  shell.querySelectorAll("[data-pricing-action]").forEach(btn=>btn.addEventListener("click",async()=>{
    const action=btn.dataset.pricingAction;
    if(action==="save-grid"){
      await savePricingBoqEditor(grid,container,btn);
      return;
    }
    if(action==="wrap"){
      if(!requireSelection())return;
      togglePricingStyle(grid,boqEditorSelection,"w");markDirty();repaint();return;
    }
    if(action==="merge"){
      if(!requireSelection())return;
      if(mergePricingSelection(grid,boqEditorSelection,false)){markDirty();repaint()}return;
    }
    if(action==="merge-across"){
      if(!requireSelection())return;
      if(mergePricingSelection(grid,boqEditorSelection,true)){markDirty();repaint()}return;
    }
    if(action==="unmerge"){
      if(!requireSelection())return;
      if(unmergePricingSelection(grid,boqEditorSelection)){markDirty();repaint()}return;
    }
    if(action==="insert-row-above"||action==="insert-row-below"){
      if(!requireSelection())return;
      const count=Math.max(1,boqEditorSelection.r2-boqEditorSelection.r1+1);
      const index=action==="insert-row-above"?boqEditorSelection.r1:boqEditorSelection.r2+1;
      insertPricingRows(grid,index,count);
      shiftPricingItemsForRows(index,count,0,grid);
      markDirty();boqEditorSelection={type:"row",r1:index,r2:index+count-1,c1:0,c2:Math.max(0,grid.colCount-1)};repaint();return;
    }
    if(action==="insert-col-left"||action==="insert-col-right"){
      if(!requireSelection())return;
      const count=Math.max(1,boqEditorSelection.c2-boqEditorSelection.c1+1);
      const index=action==="insert-col-left"?boqEditorSelection.c1:boqEditorSelection.c2+1;
      insertPricingCols(grid,index,count);
      boqMeta.columnMap=shiftPricingColumnMap(boqMeta.columnMap||{},index,count,0);
      markDirty();boqEditorSelection={type:"col",c1:index,c2:index+count-1,r1:0,r2:Math.max(0,grid.rowCount-1)};repaint();return;
    }
    if(action==="delete-row"){
      if(!requireSelection())return;
      const count=boqEditorSelection.r2-boqEditorSelection.r1+1;
      if(!await confirmBox("Xóa hàng",`Xóa ${count} hàng đang chọn khỏi BOQ?`,"Xóa"))return;
      const index=boqEditorSelection.r1;
      const deleted=deletePricingRows(grid,index,count);
      shiftPricingItemsForRows(index,0,deleted,grid);
      markDirty();boqEditorSelection=null;boqEditorAnchor=null;repaint();return;
    }
    if(action==="delete-col"){
      if(!requireSelection())return;
      const count=boqEditorSelection.c2-boqEditorSelection.c1+1;
      if(!await confirmBox("Xóa cột",`Xóa ${count} cột đang chọn khỏi BOQ?`,"Xóa"))return;
      const index=boqEditorSelection.c1;
      const deleted=deletePricingCols(grid,index,count);
      boqMeta.columnMap=shiftPricingColumnMap(boqMeta.columnMap||{},index,0,deleted);
      markDirty();boqEditorSelection=null;boqEditorAnchor=null;repaint();return;
    }
  }));
}

function normalizePricingSelection(sel,grid){
  const maxR=Math.max(0,Number(grid?.rowCount||1)-1),maxC=Math.max(0,Number(grid?.colCount||1)-1);
  let r1=Math.max(0,Math.min(maxR,Number(sel?.r1||0))),r2=Math.max(0,Math.min(maxR,Number(sel?.r2??sel?.r1??0)));
  let c1=Math.max(0,Math.min(maxC,Number(sel?.c1||0))),c2=Math.max(0,Math.min(maxC,Number(sel?.c2??sel?.c1??0)));
  if(r1>r2)[r1,r2]=[r2,r1];if(c1>c2)[c1,c2]=[c2,c1];
  return {type:sel?.type||"cell",r1,r2,c1,c2};
}

function paintPricingSelection(table,sel){
  table.querySelectorAll(".pricing-cell-selected,.pricing-range-selected,.pricing-head-selected").forEach(x=>x.classList.remove("pricing-cell-selected","pricing-range-selected","pricing-head-selected"));
  if(!sel)return;
  table.querySelectorAll("td[data-grid-row][data-grid-col]").forEach(td=>{
    const r=Number(td.dataset.gridRow),c=Number(td.dataset.gridCol);
    if(r>=sel.r1&&r<=sel.r2&&c>=sel.c1&&c<=sel.c2)td.classList.add(sel.r1===sel.r2&&sel.c1===sel.c2?"pricing-cell-selected":"pricing-range-selected");
  });
  for(let r=sel.r1;r<=sel.r2;r++)table.querySelector(`[data-pricing-row-head="${r}"]`)?.classList.add("pricing-head-selected");
  for(let c=sel.c1;c<=sel.c2;c++)table.querySelector(`[data-pricing-col-head="${c}"]`)?.classList.add("pricing-head-selected");
}

function ensurePricingGridShape(grid){
  grid.rows=Array.isArray(grid.rows)?grid.rows:[];
  grid.colWidths=Array.isArray(grid.colWidths)?grid.colWidths:[];
  grid.rowHeights=Array.isArray(grid.rowHeights)?grid.rowHeights:[];
  grid.merges=Array.isArray(grid.merges)?grid.merges:[];
  grid.styles=grid.styles&&typeof grid.styles==="object"?grid.styles:{};
  grid.rowCount=Math.max(0,Number(grid.rowCount||grid.rows.length));
  grid.colCount=Math.max(0,Number(grid.colCount||Math.max(0,...grid.rows.map(r=>Array.isArray(r)?r.length:0))));
  while(grid.rows.length<grid.rowCount)grid.rows.push([]);
  for(const row of grid.rows){while(row.length<grid.colCount)row.push("")}
  while(grid.colWidths.length<grid.colCount)grid.colWidths.push(100);
  while(grid.rowHeights.length<grid.rowCount)grid.rowHeights.push(26);
}

function pricingSelectedCells(sel){
  const out=[];if(!sel)return out;
  for(let r=sel.r1;r<=sel.r2;r++)for(let c=sel.c1;c<=sel.c2;c++)out.push([r,c]);
  return out;
}

function applyPricingStyle(grid,sel,patch){
  ensurePricingGridShape(grid);
  for(const [r,c] of pricingSelectedCells(sel)){
    const k=`${r}_${c}`;grid.styles[k]={...(grid.styles[k]||{}),...patch};
  }
}
function togglePricingStyle(grid,sel,key){
  ensurePricingGridShape(grid);
  const first=grid.styles?.[`${sel.r1}_${sel.c1}`]||{};
  const value=first[key]?0:1;
  for(const [r,c] of pricingSelectedCells(sel)){
    const k=`${r}_${c}`;grid.styles[k]={...(grid.styles[k]||{}),[key]:value};
  }
}

function pricingRectIntersects(a,b){return !(a.r2<b.r1||a.r1>b.r2||a.c2<b.c1||a.c1>b.c2)}
function pricingRectContains(a,b){return a.r1<=b.r1&&a.r2>=b.r2&&a.c1<=b.c1&&a.c2>=b.c2}

function mergePricingSelection(grid,sel,across=false){
  ensurePricingGridShape(grid);
  if(sel.r1===sel.r2&&sel.c1===sel.c2){toast("Chọn từ 2 ô trở lên để gộp.","warning");return false}
  const targets=across
    ?Array.from({length:sel.r2-sel.r1+1},(_,i)=>({r1:sel.r1+i,r2:sel.r1+i,c1:sel.c1,c2:sel.c2}))
    :[{r1:sel.r1,r2:sel.r2,c1:sel.c1,c2:sel.c2}];
  if(across&&sel.c1===sel.c2){toast("Gộp ngang cần chọn ít nhất 2 cột.","warning");return false}

  for(const target of targets){
    for(const m of grid.merges||[]){
      const mm={r1:Number(m.r1),r2:Number(m.r2),c1:Number(m.c1),c2:Number(m.c2)};
      if(pricingRectIntersects(target,mm)&&!pricingRectContains(target,mm)){
        toast("Vùng chọn đang cắt qua một ô đã gộp. Hãy bỏ gộp ô đó trước.","warning");return false;
      }
    }
  }

  for(const target of targets){
    grid.merges=(grid.merges||[]).filter(m=>!pricingRectContains(target,{r1:Number(m.r1),r2:Number(m.r2),c1:Number(m.c1),c2:Number(m.c2)}));
    const keep=grid.rows[target.r1]?.[target.c1]??"";
    for(let r=target.r1;r<=target.r2;r++)for(let c=target.c1;c<=target.c2;c++)if(r!==target.r1||c!==target.c1)grid.rows[r][c]="";
    grid.rows[target.r1][target.c1]=keep;
    grid.merges.push({...target});
  }
  return true;
}

function unmergePricingSelection(grid,sel){
  const before=(grid.merges||[]).length;
  grid.merges=(grid.merges||[]).filter(m=>!pricingRectIntersects(sel,{r1:Number(m.r1),r2:Number(m.r2),c1:Number(m.c1),c2:Number(m.c2)}));
  if(grid.merges.length===before){toast("Vùng chọn không có ô gộp.","warning");return false}
  return true;
}

function insertPricingRows(grid,index,count=1){
  ensurePricingGridShape(grid);
  index=Math.max(0,Math.min(grid.rowCount,index));count=Math.max(1,count);
  const blank=()=>Array.from({length:grid.colCount},()=>"");
  grid.rows.splice(index,0,...Array.from({length:count},blank));
  grid.rowHeights.splice(index,0,...Array.from({length:count},()=>26));
  grid.rowCount+=count;
  grid.styles=shiftPricingStyleMap(grid.styles,"row",index,count,0);
  grid.merges=shiftPricingMerges(grid.merges,"row",index,count,0);
  grid.range=pricingGridRange(grid);
}
function deletePricingRows(grid,index,count=1){
  ensurePricingGridShape(grid);if(grid.rowCount<=1){toast("BOQ phải còn ít nhất 1 hàng.","warning");return 0}
  count=Math.max(1,Math.min(count,grid.rowCount-index,grid.rowCount-1));
  grid.rows.splice(index,count);grid.rowHeights.splice(index,count);grid.rowCount-=count;
  grid.styles=shiftPricingStyleMap(grid.styles,"row",index,0,count);
  grid.merges=shiftPricingMerges(grid.merges,"row",index,0,count);
  grid.range=pricingGridRange(grid);
  return count;
}
function insertPricingCols(grid,index,count=1){
  ensurePricingGridShape(grid);
  index=Math.max(0,Math.min(grid.colCount,index));count=Math.max(1,count);
  grid.rows.forEach(r=>r.splice(index,0,...Array.from({length:count},()=>"")));
  grid.colWidths.splice(index,0,...Array.from({length:count},()=>100));grid.colCount+=count;
  grid.styles=shiftPricingStyleMap(grid.styles,"col",index,count,0);
  grid.merges=shiftPricingMerges(grid.merges,"col",index,count,0);
  grid.range=pricingGridRange(grid);
}
function deletePricingCols(grid,index,count=1){
  ensurePricingGridShape(grid);if(grid.colCount<=1){toast("BOQ phải còn ít nhất 1 cột.","warning");return 0}
  count=Math.max(1,Math.min(count,grid.colCount-index,grid.colCount-1));
  grid.rows.forEach(r=>r.splice(index,count));grid.colWidths.splice(index,count);grid.colCount-=count;
  grid.styles=shiftPricingStyleMap(grid.styles,"col",index,0,count);
  grid.merges=shiftPricingMerges(grid.merges,"col",index,0,count);
  grid.range=pricingGridRange(grid);
  return count;
}

function shiftPricingStyleMap(styles,axis,index,insertCount=0,deleteCount=0){
  const out={};
  for(const [key,val] of Object.entries(styles||{})){
    const m=key.match(/^(\d+)_(\d+)$/);if(!m){out[key]=val;continue}
    let r=Number(m[1]),c=Number(m[2]),v=axis==="row"?r:c;
    if(deleteCount&&v>=index&&v<index+deleteCount)continue;
    if(insertCount&&v>=index)v+=insertCount;
    if(deleteCount&&v>=index+deleteCount)v-=deleteCount;
    if(axis==="row")r=v;else c=v;
    out[`${r}_${c}`]=val;
  }
  return out;
}

function shiftPricingMerges(merges,axis,index,insertCount=0,deleteCount=0){
  const out=[];
  for(const m0 of merges||[]){
    const m={r1:Number(m0.r1),r2:Number(m0.r2),c1:Number(m0.c1),c2:Number(m0.c2)};
    let a=axis==="row"?m.r1:m.c1,b=axis==="row"?m.r2:m.c2;
    if(insertCount){
      if(index<=a){a+=insertCount;b+=insertCount}else if(index<=b)b+=insertCount;
    }
    if(deleteCount){
      const d1=index,d2=index+deleteCount-1;
      if(b<d1){/* unchanged */}
      else if(a>d2){a-=deleteCount;b-=deleteCount}
      else{
        const before=Math.max(0,d1-a),after=Math.max(0,b-d2),remaining=before+after;
        if(remaining<=0)continue;
        a=Math.min(a,d1);b=a+remaining-1;
      }
    }
    if(axis==="row"){m.r1=a;m.r2=b}else{m.c1=a;m.c2=b}
    if(m.r2>=m.r1&&m.c2>=m.c1)out.push(m);
  }
  return out;
}

function shiftPricingColumnMap(map,index,insertCount=0,deleteCount=0){
  const out={};
  for(const [k,v0] of Object.entries(map||{})){
    let v=Number(v0);if(!Number.isInteger(v)||v<0){out[k]=-1;continue}
    if(insertCount&&v>=index)v+=insertCount;
    if(deleteCount){
      if(v>=index&&v<index+deleteCount)v=-1;
      else if(v>=index+deleteCount)v-=deleteCount;
    }
    out[k]=v;
  }
  return out;
}

function shiftPricingItemsForRows(localIndex,insertCount=0,deleteCount=0,grid){
  const absStart=Number(grid.startRow||1)+localIndex;
  const absDeleteEnd=absStart+deleteCount-1;
  if(deleteCount)boqItems=boqItems.filter(x=>{
    const sr=Number(x.sourceRow||0);return !(sr>=absStart&&sr<=absDeleteEnd);
  });
  for(const item of boqItems){
    let sr=Number(item.sourceRow||0);if(!sr)continue;
    if(insertCount&&sr>=absStart)item.sourceRow=sr+insertCount;
    if(deleteCount&&sr>absDeleteEnd)item.sourceRow=sr-deleteCount;
  }
}

function pricingGridRange(grid){
  const sr=Math.max(1,Number(grid.startRow||1)),sc=Math.max(0,Number(grid.startCol||0));
  const er=sr+Math.max(1,Number(grid.rowCount||1))-1,ec=sc+Math.max(1,Number(grid.colCount||1))-1;
  return `${pricingExcelColName(sc)}${sr}:${pricingExcelColName(ec)}${er}`;
}

function pricingEditorAutoColWidth(grid,c){
  let max=pricingMeasureText(pricingExcelColName(Number(grid.startCol||0)+c),true,10)+26;
  const merge=pricingMergeLookup(grid.merges||[]);
  for(let r=0;r<Math.min(grid.rowCount,800);r++){
    const k=`${r}_${c}`;if(merge.covered.has(k))continue;
    const m=merge.starts.get(k);if(m&&m.c2>m.c1)continue;
    const t=String(grid.rows?.[r]?.[c]??"").trim();if(!t)continue;
    const st=grid.styles?.[k]||{};
    max=Math.max(max,pricingMeasureText(t.slice(0,180),Boolean(st.b),Number(st.fs||10))+24);
  }
  return Math.max(42,Math.min(700,Math.ceil(max)));
}
function pricingEditorAutoRowHeight(grid,r){
  let lines=1;
  for(let c=0;c<grid.colCount;c++){
    const t=String(grid.rows?.[r]?.[c]??"");
    const w=Math.max(40,Number(grid.colWidths?.[c]||100));
    const est=Math.ceil(pricingMeasureText(t,false,10)/Math.max(20,w-14));
    lines=Math.max(lines,Math.min(12,est));
  }
  return Math.max(22,Math.min(300,lines*18+8));
}
let _pricingMeasureCanvas;
function pricingMeasureText(text,bold=false,size=10){
  try{
    _pricingMeasureCanvas=_pricingMeasureCanvas||document.createElement("canvas");
    const ctx=_pricingMeasureCanvas.getContext("2d");ctx.font=`${bold?"700 ":""}${Math.max(8,size||10)}px Arial`;
    return ctx.measureText(String(text||"")).width;
  }catch{return String(text||"").length*7}
}

function expandPricingGridMerges(grid){
  const rows=(grid.rows||[]).map(r=>[...r]);
  for(const m of grid.merges||[]){
    const r1=Number(m.r1),c1=Number(m.c1),r2=Number(m.r2),c2=Number(m.c2);
    if(![r1,c1,r2,c2].every(Number.isFinite))continue;
    const v=rows[r1]?.[c1];if(v===undefined||v===null||String(v).trim()==="")continue;
    for(let r=r1;r<=r2;r++){if(!rows[r])rows[r]=[];for(let c=c1;c<=c2;c++)if(rows[r][c]===undefined||rows[r][c]===null||String(rows[r][c]).trim()==="")rows[r][c]=v}
  }
  return rows;
}

async function savePricingBoqEditor(grid,container,button){
  if(!selectedProjectId||!can("boqEdit"))return;
  try{
    if(button){button.disabled=true;button.textContent="Đang lưu..."}
    ensurePricingGridShape(grid);
    const expanded=expandPricingGridMerges(grid);
    let detected,parsed=[],newMap=boqMeta.columnMap||{};
    try{
      detected=detectHeader(expanded,"BOQ");
      const autoMap=mapBoqHeadersDataAware(expanded,detected.headerRow-1,detected.headerDepth);
      newMap=forceTemplateBoqMap(expanded,detected.headerRow-1,detected.headerDepth,autoMap,boqMeta.templateConfig||{});
      parsed=parseBoqSheet(expanded,detected.headerRow-1,detected.headerDepth,newMap);
      const offset=Number(grid.startRow||1)-1;
      parsed=parsed.map(x=>({...x,sourceRow:Number(x.sourceRow||0)+offset}));
    }catch(e){
      console.warn("[V2.20] BOQ đã lưu hình thức nhưng chưa thể tái nhận diện dữ liệu:",e);
    }

    if(parsed.length){
      const patch=rebuildPricingBoqItemsPatch(parsed);
      if(Object.keys(patch).length)await refs.boqProject(selectedProjectId).update(patch);
    }

    const metaPatch={
      sourceGrid:grid,
      columnMap:newMap,
      updatedAt:Date.now(),
      updatedByName:getProfile()?.displayName||getProfile()?.email||""
    };
    if(detected){
      metaPatch.headerRow=Number(grid.startRow||1)+Number(detected.headerRow||1)-1;
      metaPatch.headerDepth=Number(detected.headerDepth||1);
    }
    await refs.boqImportMeta(selectedProjectId).update(metaPatch);

    boqEditorDirty=false;boqEditorSelection=null;boqEditorAnchor=null;
    try{await logActivity("TENDER_BOQ_GRID_EDITED","Chỉnh sửa BOQ trực tiếp trên web",{projectId:selectedProjectId,rowCount:grid.rowCount,colCount:grid.colCount})}catch{}
    await loadProjectData();toast(parsed.length?"Đã lưu BOQ và đồng bộ lại dữ liệu lập giá.":"Đã lưu bảng BOQ. Hệ thống chưa nhận diện lại được các cột dữ liệu.",parsed.length?"success":"warning");paint(container);
  }catch(e){
    console.error(e);toast(e.message||"Không thể lưu thay đổi BOQ.","error");
    if(button){button.disabled=false;button.textContent="Lưu BOQ"}
  }
}

function rebuildPricingBoqItemsPatch(parsed){
  const patch={},used=new Set();
  const byNo=new Map(),bySig=new Map();
  for(const old of boqItems){
    const no=cleanKey(old.itemNo||"");if(no){if(!byNo.has(no))byNo.set(no,[]);byNo.get(no).push(old)}
    const sig=pricingBoqSignature(old);if(sig){if(!bySig.has(sig))bySig.set(sig,[]);bySig.get(sig).push(old)}
  }

  for(const row of parsed){
    let old=null;
    const no=cleanKey(row.itemNo||"");
    if(no){const xs=(byNo.get(no)||[]).filter(x=>!used.has(x.id));if(xs.length===1)old=xs[0]}
    if(!old){const sig=pricingBoqSignature(row),xs=(bySig.get(sig)||[]).filter(x=>!used.has(x.id));if(sig&&xs.length===1)old=xs[0]}
    const id=old?.id||refs.boqProject(selectedProjectId).push().key;
    if(old)used.add(old.id);
    const sameMaterial=old&&Number(old.materialUnit||0)===Number(row.materialUnit||0);
    const sameLabor=old&&Number(old.laborUnit||0)===Number(row.laborUnit||0);
    patch[id]={
      ...(old||{}),...row,
      laborPriceSource:sameLabor?(old.laborPriceSource||null):null,
      materialPriceSource:sameMaterial?(old.materialPriceSource||null):null,
      selectedSupplier:sameMaterial?(old.selectedSupplier||""):"",
      matchStatus:sameMaterial?(old.matchStatus||""):(Number(row.materialUnit||0)>0?"MANUAL":""),
      matchScore:sameMaterial?Number(old.matchScore||0):0,
      createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()
    };
    delete patch[id].id;
  }
  for(const old of boqItems)if(!used.has(old.id))patch[old.id]=null;
  return patch;
}
function pricingBoqSignature(x){
  const d=cleanText(x?.description||""),u=canonUnit(x?.unit||""),s=cleanText(x?.specification||"");
  return d?`${d}|${u}|${s}`:"";
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
      <div>
        <h3>Kho báo giá vật tư của dự án</h3>
        <div class="secondary-text"><b>Không cần chờ đủ báo giá.</b> NCC gửi file nào thì tải thêm file đó; các lần tải sau được cộng dồn và không xóa báo giá đã có.</div>
      </div>
      <div class="actions">${can("quoteEdit")?`<button class="btn primary" id="uploadMaterialPricesBtn">＋ Thêm báo giá mới</button>`:""}</div>
    </div>

    <div class="pricing-incremental-note">
      <div><b>${materialImports.length}</b><span>file/đợt giá đã nhận</span></div>
      <p>Quy trình: nhận báo giá → tải lên → hệ thống tự đọc → chỉ tự điền những dòng BOQ đang <b>chưa có giá</b>. Giá đã nhập/đã chọn trước đó không bị ghi đè tự động.</p>
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
    `:empty("Chưa có báo giá vật tư","Khi NCC gửi báo giá đầu tiên, bấm “Thêm báo giá mới”. Sau này có file mới thì tiếp tục tải thêm; không cần tải cùng lúc.","◆")}
  </div>`;
}

function materialImportCard(x){
  return `<div class="material-import-card">
    <div class="material-file-icon">XLS</div>
    <div class="material-file-main"><b>${esc(x.fileName||"")}</b><span>${esc(x.supplier||baseFileName(x.fileName||""))} · Sheet ${esc(x.sheetName||"—")} · ${Number(x.rowCount||0)} dòng · Đã thêm vào kho</span></div>
    <div class="material-file-time">Nhận ${fmtDateTime(x.createdAt)}</div>
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
      <div><h3>Ráp giá vật tư vào BOQ</h3><div class="secondary-text">Mỗi báo giá mới được cộng vào kho ứng viên. Tự động chỉ điền dòng đang trống; dòng đã có giá chỉ thay khi anh chủ động bấm “Dùng giá”.</div></div>
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
    selectedProjectId=e.target.value;q="";workspaceFilter="ALL";boqEditorDirty=false;univerDirty=false;workspaceFullscreen=false;document.body.classList.remove("boq-fullscreen-active");
    container.innerHTML=loading();await loadProjectData();paint(container);
  });

  container.querySelector("#uploadBoqBtn")?.addEventListener("click",()=>openBoqUpload(container));
  container.querySelector("#uploadMaterialQuickBtn")?.addEventListener("click",()=>openMaterialUpload(container));
  container.querySelector("#priceLibraryBtn")?.addEventListener("click",()=>openPriceLibrary(container));
  container.querySelector("#exportOriginalXlsxBtn")?.addEventListener("click",()=>exportOriginalWorkbook(container));
  container.querySelector("#reviewPriceBtn")?.addEventListener("click",()=>openReviewPrices(container,"REVIEW"));
  container.querySelector("#saveUniverBtn")?.addEventListener("click",()=>saveUniverBoq(container));
  container.querySelector("#toggleBoqFullscreenBtn")?.addEventListener("click",()=>toggleBoqFullscreen(container));
  container.querySelector("#fullscreenAddQuoteBtn")?.addEventListener("click",()=>openMaterialUpload(container));
  container.querySelector("#fullscreenExportBtn")?.addEventListener("click",()=>exportOriginalWorkbook(container));
  container.querySelectorAll("[data-workspace-filter]").forEach(b=>b.addEventListener("click",()=>openReviewPrices(container,b.dataset.workspaceFilter==="missing"?"MISSING":"REVIEW")));
  ensureBoqFullscreenKeyHandler(container);
  if(workspaceFullscreen)applyBoqFullscreenDom(container,true);
}

function ensureBoqFullscreenKeyHandler(container){
  if(workspaceFullscreenKeyBound)return;
  workspaceFullscreenKeyBound=true;
  document.addEventListener("keydown",e=>{
    if(e.key!=="Escape"||!workspaceFullscreen)return;
    e.preventDefault();
    const active=document.querySelector("#pageContent")||container;
    toggleBoqFullscreen(active,false);
  });
}

function toggleBoqFullscreen(container,force){
  const next=typeof force==="boolean"?force:!workspaceFullscreen;
  workspaceFullscreen=next;
  applyBoqFullscreenDom(container,next);
}

function applyBoqFullscreenDom(container,on){
  const root=container?.querySelector?.(".v220-workbook-card")||document.querySelector(".v220-workbook-card");
  if(!root)return;
  root.classList.toggle("is-fullscreen",Boolean(on));
  document.body.classList.toggle("boq-fullscreen-active",Boolean(on));
  const btn=root.querySelector("#toggleBoqFullscreenBtn");
  if(btn){
    btn.innerHTML=on?"↙ Thu nhỏ":"⛶ Toàn màn hình";
    btn.title=on?"Thoát chế độ toàn màn hình (Esc)":"Mở BOQ toàn màn hình như ứng dụng Excel";
  }
  // Univer tự phản ứng theo kích thước container; phát resize để cập nhật viewport ngay.
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.dispatchEvent(new Event("resize"))));
}

function openBoqUpload(container){
  if(!can("boqEdit"))return;
  modal({
    title:boqItems.length?"Thay BOQ gốc":"Tải BOQ đấu thầu",
    eyebrow:"BOQ GỐC · TỰ ĐỌC CTG/CTC",
    size:"lg",submitText:"Nhập BOQ",
    body:`<div class="pricing-upload-note v220-upload-note"><b>Chỉ cần chọn file BOQ.</b> Nếu trong workbook có Sheet CTG/CTC, hệ thống tự lấy <b>Code cột B → Nhân công cột T</b>. File Excel gốc được lưu nguyên để khi xuất vẫn giữ cấu trúc/format ban đầu.</div>
      <div class="form-grid mt">
        <label class="field span2"><span>File BOQ Excel *</span><input required type="file" name="boqFile" id="tenderBoqFile" accept=".xlsx"><small>V2.20 dùng chính file .xlsx này làm mẫu xuất cho cấp trên.</small></label>
        <label class="field span2 hidden" id="tenderBoqSheetWrap"><span>Sheet BOQ</span><select name="boqSheet" id="tenderBoqSheet"></select></label>
        <div class="span2 hidden pricing-file-preview" id="tenderBoqPreview"></div>
      </div>`,
    onSubmit:async fd=>{
      const file=fd.get("boqFile");
      if(!(file instanceof File)||!file.size){toast("Chọn file BOQ.","error");return false}
      const inspection=document.querySelector("#tenderBoqFile")?._inspection||await inspectSpreadsheet(file,"BOQ");
      const sheetName=String(fd.get("boqSheet")||inspection.defaultSheet||"");
      const meta=inspection.sheets[sheetName]||inspection.sheets[inspection.defaultSheet];
      const forcedMap=sheetName===inspection.defaultSheet?(inspection.targetColumnMap||meta.columnMap||{}):(meta.columnMap||{});
      let parsed=parseBoqSheet(meta.aoa,meta.headerRow-1,meta.headerDepth,forcedMap);
      parsed=applyLaborCatalog(parsed,inspection.laborCatalog||[],inspection.laborSheetName||"");
      if(!parsed.length){toast("Không đọc được dòng BOQ nào.","error");return false}
      if(boqItems.length){
        if(!await confirmBox("Thay BOQ hiện tại",`BOQ mới có ${parsed.filter(isPriceableItem).length} đầu mục có khối lượng. Thay toàn bộ BOQ đang có?`,"Thay BOQ"))return false;
      }

      const originalGrid=JSON.parse(JSON.stringify(meta.sourceGrid||null));
      await saveBoqImport(parsed,{
        fileName:file.name,sheetName,
        headerRow:meta.headerRow,headerDepth:meta.headerDepth,
        columnMap:forcedMap,
        sourceGrid:meta.sourceGrid||null,
        originalSourceGrid:originalGrid,
        laborSheetName:inspection.laborSheetName||"",
        laborCatalogMeta:buildLaborCatalogMeta(parsed,inspection),
        templateConfig:inspection.templateConfig||{},
        mode:"REPLACE",
        originalWorkbookStored:false
      });

      let sourceStored=false;
      if(fileExtension(file.name)==="xlsx"){
        try{await storeOriginalWorkbook(file,sheetName);sourceStored=true}
        catch(e){console.warn("[V2.20] Không lưu được file BOQ gốc:",e);toast("BOQ đã nhập nhưng chưa lưu được bản Excel gốc để xuất nguyên mẫu.","warning")}
      }
      if(sourceStored){
        try{await refs.boqImportMeta(selectedProjectId).update({originalWorkbookStored:true,updatedAt:Date.now()})}catch{}
      }

      const priceable=parsed.filter(isPriceableItem);
      const laborCount=priceable.filter(x=>Number(x.laborUnit||0)>0).length;
      toast(`Đã nhập ${priceable.length} đầu mục. Nhân công CTG/CTC tự điền ${laborCount}/${priceable.length} dòng.`);
      boqEditorDirty=false;univerDirty=false;
      await loadProjectData();paint(container);return true;
    }
  });

  const input=document.querySelector("#tenderBoqFile"),sheet=document.querySelector("#tenderBoqSheet"),wrap=document.querySelector("#tenderBoqSheetWrap"),preview=document.querySelector("#tenderBoqPreview");
  input?.addEventListener("change",async()=>{
    const file=input.files?.[0];if(!file)return;
    try{
      preview?.classList.remove("hidden");if(preview)preview.innerHTML=`<div class="pricing-reading">Đang đọc BOQ + CTG/CTC...</div>`;
      const inspection=await inspectSpreadsheet(file,"BOQ");input._inspection=inspection;
      wrap?.classList.remove("hidden");
      sheet.innerHTML=Object.keys(inspection.sheets).map(name=>{const m=inspection.sheets[name];return `<option value="${esc(name)}" ${name===inspection.defaultSheet?"selected":""}>${esc(name)} · ${m.sourceGrid?.rowCount||0}×${m.sourceGrid?.colCount||0}</option>`}).join("");
      renderBoqPreview(inspection,sheet.value||inspection.defaultSheet,preview);
    }catch(e){console.error(e);toast(e.message||"Không đọc được file.","error");if(preview)preview.innerHTML=`<div class="pricing-file-mini bad"><b>Không đọc được BOQ</b><span>${esc(e.message||"")}</span></div>`}
  });
  sheet?.addEventListener("change",()=>{const ins=input?._inspection;if(ins)renderBoqPreview(ins,sheet.value,preview)});
}

async function storeOriginalWorkbook(file,sheetName){
  const bytes=new Uint8Array(await file.arrayBuffer());
  const b64=bytesToBase64(bytes),chunkSize=650000,chunks={};
  for(let i=0,n=0;i<b64.length;i+=chunkSize,n++)chunks[`c${String(n).padStart(4,"0")}`]=b64.slice(i,i+chunkSize);
  await refs.boqOriginalWorkbook(selectedProjectId).set({
    fileName:file.name,mimeType:file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes:file.size,sheetName,encoding:"base64",chunks,updatedAt:Date.now(),updatedByName:getProfile()?.displayName||getProfile()?.email||""
  });
}

function bytesToBase64(bytes){
  let out="",step=0x8000;
  for(let i=0;i<bytes.length;i+=step)out+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+step)));
  return btoa(out);
}
function base64ToBytes(b64){
  const bin=atob(b64),out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}

function buildLaborCatalogMeta(parsed,inspection){
  const priceable=parsed.filter(isPriceableItem);
  const matched=priceable.filter(x=>x.laborPriceSource?.sheetName).length;
  const priced=priceable.filter(x=>Number(x.laborUnit||0)>0).length;
  return {sheetName:inspection.laborSheetName||"",sourceColumn:"T",codeColumn:"B",catalogRows:(inspection.laborCatalog||[]).length,matched,priced,missing:Math.max(0,priceable.length-priced)};
}

function applyLaborCatalog(parsed,catalog,sheetName){
  if(!Array.isArray(catalog)||!catalog.length)return parsed;
  const byCode=new Map();
  for(const r of catalog){
    const k=cleanKey(r.code||"");if(!k)continue;
    const old=byCode.get(k);
    if(!old||Number(r.laborRaw||0)>0)byCode.set(k,r);
  }
  return parsed.map(row=>{
    if(!(Number(row.qty||0)>0))return row;
    const src=byCode.get(cleanKey(row.code||""));
    if(!src)return row;
    const raw=Number(src.laborRaw||0);
    if(!(raw>0))return {...row,laborUnit:0,laborPriceSource:{sheetName,column:"T",codeColumn:"B",sourceRow:src.sourceRow,code:src.code,rawUnit:0,factor:1,unitPrice:0,status:"MISSING"}};
    const existing=Number(row.laborUnit||0);
    let factor=1;
    if(existing>0){
      const ratio=existing/raw;
      if(Math.abs(ratio-1)<=0.035)factor=1;
      else if(Math.abs(ratio-1.3)<=0.04)factor=1.3;
      else if(ratio>=0.5&&ratio<=3)factor=Math.round(ratio*10000)/10000;
    }
    const final=Math.round(raw*factor*100)/100;
    return {...row,laborUnit:final,laborPriceSource:{
      sheetName,column:"T",codeColumn:"B",sourceRow:src.sourceRow,code:src.code,rawUnit:raw,factor,unitPrice:final,
      model:src.model||"",brand:src.brand||"",origin:src.origin||"",status:"AUTO_CODE"
    }};
  });
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
  const forced=sheetName===inspection.defaultSheet?(inspection.targetColumnMap||m.columnMap):m.columnMap;
  let rows=[];
  try{rows=parseBoqSheet(m.aoa,m.headerRow-1,m.headerDepth,forced)}catch{}
  rows=applyLaborCatalog(rows,inspection.laborCatalog||[],inspection.laborSheetName||"");
  const priceable=rows.filter(isPriceableItem),labor=priceable.filter(x=>Number(x.laborUnit||0)>0).length;
  box.classList.remove("hidden");
  const g=m.sourceGrid;
  box.innerHTML=`<div class="v220-import-preview">
    <div><b>${esc(inspection.fileName)}</b><span>Sheet BOQ: ${esc(sheetName)} · ${g?.rowCount||0} hàng × ${g?.colCount||0} cột · ${priceable.length} đầu mục có KL</span></div>
    <div class="v220-preview-badges">${badge("Giữ file gốc để xuất Excel","green")}${inspection.laborSheetName?badge(`Nhân công ${inspection.laborSheetName}!T: ${labor}/${priceable.length}`,labor===priceable.length?"green":"blue"):badge("Không thấy CTG/CTC","orange")}</div>
  </div>`;
}

function openMaterialUpload(container){
  if(!can("quoteEdit"))return;
  modal({
    title:"Thêm báo giá vật tư",
    eyebrow:"CHỌN FILE → TỰ ĐỌC → TỰ RÁP, KHÔNG CẦN XÁC NHẬN THÊM",
    size:"lg",showSubmit:false,
    body:`<div class="pricing-upload-note"><b>Nhận giá tới đâu tải tới đó.</b> Nhập tên NCC nếu muốn, sau đó chọn 1 hoặc nhiều file. Ngay khi chọn file hệ thống tự thêm vào kho và tự điền các dòng BOQ khớp ≥95%; không có bước “xác nhận ráp giá”.</div>
      <div class="form-grid mt">
        <label class="field span2"><span>Tên NCC mặc định (không bắt buộc)</span><input id="materialDefaultSupplier" placeholder="Để trống: dùng tên file làm NCC"></label>
        <label class="field span2"><span>Chọn file báo giá Excel / CSV *</span><input multiple type="file" id="materialPriceFiles" accept=".xlsx,.xls,.csv"><small>Có thể tải từng file một ở bất kỳ thời điểm nào.</small></label>
        <div class="span2 hidden pricing-file-preview-list" id="materialFilesPreview"></div>
      </div>`
  });

  const input=document.querySelector("#materialPriceFiles"),preview=document.querySelector("#materialFilesPreview");
  input?.addEventListener("change",async()=>{
    const files=[...(input.files||[])];if(!files.length)return;
    const supplier=String(document.querySelector("#materialDefaultSupplier")?.value||"").trim();
    input.disabled=true;preview.classList.remove("hidden");preview.innerHTML=`<div class="pricing-reading">Đang đọc ${files.length} file và ráp giá...</div>`;
    try{
      const result=await processMaterialFiles(files,supplier,preview);
      await loadProjectData();
      const applied=await autoApplyMatches(95,{onlyEmpty:true});
      await loadProjectData();
      const msg=`Đã thêm ${result.success}/${files.length} file (${result.totalRows} dòng giá), tự điền ${applied} dòng BOQ.`+(result.failed.length?` Bỏ qua ${result.failed.length} file chưa đọc được.`:"");
      toast(msg,result.success?"success":"warning");
      setTimeout(()=>{document.querySelector("#modalRoot [data-modal-close]")?.click();paint(container)},350);
    }catch(e){console.error(e);toast(e.message||"Không thêm được báo giá.","error");input.disabled=false}
  });
}

async function processMaterialFiles(files,defaultSupplier,preview){
  let totalRows=0,success=0;const failed=[],cards=[];
  for(let fi=0;fi<files.length;fi++){
    const file=files[fi];
    try{
      if(preview)preview.innerHTML=`<div class="pricing-reading">Đang đọc ${fi+1}/${files.length}: ${esc(file.name)}</div>${cards.join("")}`;
      const inspection=await inspectSpreadsheet(file,"PRICE");
      const sheetName=inspection.defaultSheet,m=inspection.sheets[sheetName];
      const rows=parsePriceSheet(m.aoa,m.headerRow-1,m.headerDepth,{fileName:file.name,sheetName,defaultSupplier});
      const importId=refs.materialPriceImportsProject(selectedProjectId).push().key,rowObj={};
      rows.forEach((r,i)=>rowObj[`r${String(i+1).padStart(5,"0")}`]=r);
      await refs.materialPriceImport(selectedProjectId,importId).set({
        fileName:file.name,sheetName,supplier:defaultSupplier||baseFileName(file.name),rowCount:rows.length,
        headerRow:m.headerRow,headerDepth:m.headerDepth,detectedDescriptionColumn:m.columnMap?.description??-1,detectedPriceColumn:m.columnMap?.unitPrice??-1,
        createdAt:Date.now(),createdByName:getProfile()?.displayName||getProfile()?.email||"",rows:rowObj
      });
      totalRows+=rows.length;success++;
      const dc=Number(m.columnMap?.description??-1),pc=Number(m.columnMap?.unitPrice??-1);
      cards.push(`<div class="pricing-file-mini ok"><b>✓ ${esc(file.name)}</b><span>${rows.length} dòng · Mô tả ${dc>=0?pricingExcelColName(dc):"?"} · Giá ${pc>=0?pricingExcelColName(pc):"?"}</span></div>`);
    }catch(e){
      console.warn("[V2.20] Bỏ qua file giá:",file.name,e);failed.push({file:file.name,error:e?.message||"Không nhận diện được"});
      cards.push(`<div class="pricing-file-mini bad"><b>! ${esc(file.name)}</b><span>${esc(e?.message||"Không nhận diện được")}</span></div>`);
    }
  }
  if(preview)preview.innerHTML=cards.join("");
  if(!success)throw new Error(failed[0]?.error||"Không file nào có dữ liệu giá hợp lệ.");
  return {success,totalRows,failed};
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

function rebuildMaterialIndex(){
  const byCode=new Map(),byUnit=new Map();
  for(const row of materialRows||[]){
    const code=cleanKey(row.code||"");if(code){if(!byCode.has(code))byCode.set(code,[]);byCode.get(code).push(row)}
    const unit=canonUnit(row.unit||"");if(unit){if(!byUnit.has(unit))byUnit.set(unit,[]);byUnit.get(unit).push(row)}
  }
  materialIndex={byCode,byUnit,all:materialRows||[]};
}

function rebuildMatchCache(){
  rebuildMaterialIndex();
  matchCache=new Map();
  for(const item of boqItems.filter(isPriceableItem))matchCache.set(item.id,rankMaterialCandidates(item));
}

function matchingRows(){
  return boqItems.filter(isPriceableItem).map(item=>({item,best:(matchCache.get(item.id)||[])[0]||null}));
}

function rankMaterialCandidates(item){
  const code=cleanKey(item.code||"");
  let pool=code?(materialIndex.byCode.get(code)||[]):[];
  if(!pool.length){
    const unit=canonUnit(item.unit||"");
    pool=unit?(materialIndex.byUnit.get(unit)||[]):[];
    if(!pool.length)pool=materialIndex.all||[];

    // Lọc nhanh theo token kỹ thuật (DN50, 100x50, model...) khi kho giá lớn.
    if(pool.length>600){
      const text=cleanText(`${item.description||""} ${item.specification||""}`);
      const tokens=(text.match(/\b(?:dn\s*\d+|d\s*\d+|\d{2,4}\s*[x×]\s*\d{2,4}|[a-z]{1,5}[-_]?\d{2,}[a-z0-9_-]*)\b/gi)||[]).map(cleanKey).filter(x=>x.length>=3);
      if(tokens.length){
        const narrowed=pool.filter(r=>{const t=cleanKey(`${r.description||""} ${r.specification||""} ${r.code||""}`);return tokens.some(k=>t.includes(k))});
        if(narrowed.length)pool=narrowed;
      }
    }
  }
  const ranked=[];
  for(const row of pool){
    const m=scoreMaterialMatch(item,row);
    if(m.score>=55)ranked.push({row,score:m.score,reason:m.reason});
  }
  return ranked.sort((a,b)=>b.score-a.score||Number(a.row.unitPrice||0)-Number(b.row.unitPrice||0)).slice(0,8);
}

function scoreMaterialMatch(item,row){
  const codeA=cleanKey(item.code||item.itemNo||""),codeB=cleanKey(row.code||"");
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

async function autoApplyMatches(threshold=95,{onlyEmpty=false}={}){
  rebuildMatchCache();
  const updates={};let count=0;
  for(const item of boqItems.filter(isPriceableItem)){
    if(onlyEmpty && Number(item.materialUnit||0)>0)continue;
    const best=(matchCache.get(item.id)||[])[0];if(!best||best.score<threshold)continue;
    fillMatchUpdates(updates,item,best,"AUTO");count++;
  }
  if(Object.keys(updates).length)await refs.boqProject(selectedProjectId).update(updates);
  return count;
}

async function applyHighConfidenceMatches(container){
  const count=await autoApplyMatches(95,{onlyEmpty:false});await loadProjectData();toast(`Đã áp dụng ${count} dòng có độ khớp ≥95%.`);paint(container);
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


function openPriceLibrary(container){
  const rows=materialImports||[];
  modal({title:"Kho giá vật tư",eyebrow:"BÁO GIÁ ĐÃ LƯU",size:"lg",showSubmit:false,body:`
    <div class="v220-library-head"><div><b>${rows.length} file báo giá</b><span>${materialRows.length} dòng giá đã chuẩn hóa. File mới thêm sau vẫn cộng dồn vào kho.</span></div>${can("quoteEdit")?`<button type="button" class="btn primary sm" id="modalAddPriceBtn">＋ Thêm báo giá</button>`:""}</div>
    <div class="v220-library-list">${rows.length?rows.map(x=>`<div class="v220-library-item"><div><b>${esc(x.fileName||"Báo giá")}</b><span>${esc(x.supplier||"")} · Sheet ${esc(x.sheetName||"")} · ${Number(x.rowCount||0)} dòng · ${fmtDateTime(x.createdAt)}</span></div>${can("quoteEdit")?`<button type="button" class="btn sm danger-soft" data-modal-delete-import="${x.id}">Xóa</button>`:""}</div>`).join(""):empty("Kho giá đang trống","Khi nhận báo giá NCC, bấm “Thêm báo giá” để hệ thống ghi nhớ và dùng cho BOQ hiện tại.","▤")}</div>`});
  document.querySelector("#modalAddPriceBtn")?.addEventListener("click",()=>openMaterialUpload(container));
  document.querySelectorAll("[data-modal-delete-import]").forEach(b=>b.addEventListener("click",async()=>{
    const id=b.dataset.modalDeleteImport,imp=materialImports.find(x=>x.id===id);if(!imp)return;
    if(!await confirmBox("Xóa file giá",`Xóa dữ liệu ${imp.fileName||"file này"} khỏi kho?`,"Xóa"))return;
    await refs.materialPriceImport(selectedProjectId,id).remove();await loadProjectData();toast("Đã xóa file giá.","warning");document.querySelector("[data-modal-close]")?.click();paint(container);
  }));
}

function openReviewPrices(container,mode="REVIEW"){
  rebuildMatchCache();
  const all=boqItems.filter(isPriceableItem).map(item=>({item,best:(matchCache.get(item.id)||[])[0]||null}));
  const rows=mode==="MISSING"
    ?all.filter(x=>Number(x.item.materialUnit||0)<=0&&!(x.best?.score>=78))
    :all.filter(x=>Number(x.item.materialUnit||0)<=0&&x.best?.score>=78&&x.best?.score<95);
  const title=mode==="MISSING"?"Các dòng chưa có giá vật tư":"Giá cần kiểm tra";
  modal({title,eyebrow:mode==="MISSING"?"CHƯA CÓ ỨNG VIÊN ≥78%":"CHỈ XÁC NHẬN CÁC DÒNG CHƯA CHẮC",size:"xl",showSubmit:false,body:`
    <div class="v220-review-note">${mode==="MISSING"?"Các dòng này chưa tìm thấy ứng viên đủ tin cậy. Hãy thêm báo giá mới; hệ thống sẽ tự đối chiếu lại.":"Các giá ≥95% đã tự điền khi ô vật tư còn trống. Danh sách này chỉ còn ứng viên 78–94%."}</div>
    <div class="table-wrap"><table class="data-table v220-review-table"><thead><tr><th>BOQ</th><th>Ứng viên</th><th>Giá</th><th>Khớp</th><th>NCC / nguồn</th><th></th></tr></thead><tbody>
      ${rows.length?rows.map(x=>`<tr><td><b>${esc(x.item.itemNo||x.item.code||"")}</b><div>${esc(x.item.description||"")}</div><small>${esc(x.item.specification||"")} · ${esc(x.item.unit||"")}</small></td><td>${x.best?`<b>${esc(x.best.row.description||"")}</b><small>${esc(x.best.row.specification||"")}</small>`:"—"}</td><td>${x.best?`<b>${money(x.best.row.unitPrice)}</b>`:"—"}</td><td>${x.best?badge(`${Math.round(x.best.score)}%`,x.best.score>=90?"orange":"blue"):badge("Chưa có","red")}</td><td>${x.best?`${esc(x.best.row.supplier||"")}<small>${esc(x.best.row.sourceFileName||"")} · dòng ${x.best.row.sourceRow||"—"}</small>`:"—"}</td><td>${x.best&&can("boqEdit")?`<button type="button" class="btn sm orange" data-review-use="${x.item.id}">Dùng giá</button>`:""}</td></tr>`).join(""):`<tr><td colspan="6">${empty("Không có dòng nào","Danh sách này hiện đã sạch.","✓")}</td></tr>`}
    </tbody></table></div>`});
  document.querySelectorAll("[data-review-use]").forEach(b=>b.addEventListener("click",async()=>{
    const item=boqItems.find(x=>x.id===b.dataset.reviewUse),best=(matchCache.get(b.dataset.reviewUse)||[])[0];if(!item||!best)return;
    const updates={};fillMatchUpdates(updates,item,best,"REVIEWED");await refs.boqProject(selectedProjectId).update(updates);toast(`Đã dùng giá ${money(best.row.unitPrice)}.`);await loadProjectData();document.querySelector("[data-modal-close]")?.click();paint(container);
  }));
}

async function exportOriginalWorkbook(container){
  if(!selectedProjectId)return;
  const btn=container.querySelector("#exportOriginalXlsxBtn");
  try{
    if(btn){btn.disabled=true;btn.textContent="Đang xuất..."}
    if(univerDirty)await saveUniverBoq(container);
    const snap=await refs.boqOriginalWorkbook(selectedProjectId).once("value");
    const src=snap.val();
    if(!src?.chunks)throw new Error("Chưa có bản Excel gốc. Hãy bấm “Thay BOQ” và tải lại file .xlsx gốc một lần.");
    if(!globalThis.JSZip)throw new Error("JSZip chưa tải được. Tải lại trang rồi thử lại.");

    const b64=Object.keys(src.chunks).sort().map(k=>src.chunks[k]).join("");
    const zip=await JSZip.loadAsync(base64ToBytes(b64));
    const wbXml=await zip.file("xl/workbook.xml")?.async("string");
    const relXml=await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
    if(!wbXml||!relXml)throw new Error("File Excel gốc không đúng cấu trúc .xlsx.");
    const parser=new DOMParser(),serializer=new XMLSerializer();
    const wbDoc=parser.parseFromString(wbXml,"application/xml"),relDoc=parser.parseFromString(relXml,"application/xml");
    const wanted=boqMeta.sheetName||src.sheetName||"";
    const sheets=[...wbDoc.getElementsByTagNameNS("*","sheet")];
    const sheetNode=sheets.find(x=>x.getAttribute("name")===wanted)||sheets[0];
    if(!sheetNode)throw new Error("Không tìm được Sheet BOQ trong file gốc.");
    const rid=sheetNode.getAttribute("r:id")||sheetNode.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
    const rel=[...relDoc.getElementsByTagNameNS("*","Relationship")].find(x=>x.getAttribute("Id")===rid);
    let target=String(rel?.getAttribute("Target")||"").replace(/^\//,"");
    if(!target)throw new Error("Không tìm được đường dẫn XML của Sheet BOQ.");
    if(!target.startsWith("xl/"))target="xl/"+target.replace(/^\.\//,"");
    const sheetXml=await zip.file(target)?.async("string");
    if(!sheetXml)throw new Error("Không đọc được Sheet BOQ gốc.");
    const sheetDoc=parser.parseFromString(sheetXml,"application/xml");

    const current=normalizePricingSourceGrid(JSON.parse(JSON.stringify(boqMeta.sourceGrid||{})));
    const original=normalizePricingSourceGrid(JSON.parse(JSON.stringify(boqMeta.originalSourceGrid||boqMeta.sourceGrid||{})));
    if(Number(current.rowCount||0)!==Number(original.rowCount||0)||Number(current.colCount||0)!==Number(original.colCount||0)){
      throw new Error("BOQ đã thêm/xóa hàng hoặc cột. Chế độ xuất ‘giữ y chang file gốc’ chỉ áp các thay đổi ô trên cấu trúc gốc; hãy nhập lại BOQ gốc nếu cần xuất đúng mẫu.");
    }
    const map=boqMeta.columnMap||{};
    syncPricingDynamicValuesIntoGrid(current,{qtyCol:Number(map.qty??-1),materialCol:Number(map.materialUnit??-1),laborCol:Number(map.laborUnit??-1),totalCol:Number(map.totalUnit??-1),amountCol:Number(map.amount??-1)});
    const changes=collectGridChangesForExport(original,current,map);
    for(const ch of changes)patchXlsxSheetCell(sheetDoc,ch.row,ch.col,ch.value,ch.numeric);
    zip.file(target,serializer.serializeToString(sheetDoc));

    let calc=[...wbDoc.getElementsByTagNameNS("*","calcPr")][0];
    if(!calc){calc=wbDoc.createElementNS(wbDoc.documentElement.namespaceURI,"calcPr");wbDoc.documentElement.appendChild(calc)}
    calc.setAttribute("calcMode","auto");calc.setAttribute("fullCalcOnLoad","1");calc.setAttribute("forceFullCalc","1");
    zip.file("xl/workbook.xml",serializer.serializeToString(wbDoc));

    const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
    const base=String(src.fileName||boqMeta.fileName||"BOQ.xlsx").replace(/\.xlsx$/i,"");
    downloadBlob(blob,`${base}_LAP_GIA.xlsx`);
    toast(`Đã xuất BOQ theo file gốc, cập nhật ${changes.length} ô.`);
    try{await logActivity("TENDER_BOQ_EXPORTED","Xuất BOQ lập giá theo file Excel gốc",{projectId:selectedProjectId,changedCells:changes.length})}catch{}
  }catch(e){console.error(e);toast(e.message||"Không xuất được Excel.","error")}
  finally{const b=container.querySelector("#exportOriginalXlsxBtn");if(b){b.disabled=false;b.textContent="⇩ Xuất Excel"}}
}

function collectGridChangesForExport(original,current,map){
  const out=[];
  const startRow=Number(current.startRow||original.startRow||1),startCol=Number(current.startCol||original.startCol||0);
  const rr=Math.min(Number(current.rowCount||0),Number(original.rowCount||current.rowCount||0));
  const cc=Math.min(Number(current.colCount||0),Number(original.colCount||current.colCount||0));
  const numericCols=new Set([map.qty,map.materialUnit,map.laborUnit,map.totalUnit,map.amount].map(Number).filter(Number.isFinite));
  for(let r=0;r<rr;r++)for(let c=0;c<cc;c++){
    const a=original.rows?.[r]?.[c]??"",b=current.rows?.[r]?.[c]??"";
    if(v220Comparable(a)===v220Comparable(b))continue;
    const numeric=numericCols.has(startCol+c)&&String(b).trim()!==""&&isNumericLike(b);
    out.push({row:startRow+r,col:startCol+c,value:b,numeric});
  }
  return out;
}
function v220Comparable(v){
  if(v===null||v===undefined)return "";
  if(typeof v==="number")return String(Math.round(v*1e8)/1e8);
  return String(v).trim();
}

function patchXlsxSheetCell(doc,row1,col0,value,numeric){
  const ns=doc.documentElement.namespaceURI;
  const sheetData=doc.getElementsByTagNameNS("*","sheetData")[0];if(!sheetData)return;
  let row=[...sheetData.getElementsByTagNameNS("*","row")].find(x=>Number(x.getAttribute("r"))===row1);
  if(!row){
    row=doc.createElementNS(ns,"row");row.setAttribute("r",String(row1));
    const next=[...sheetData.children].find(x=>Number(x.getAttribute?.("r"))>row1);next?sheetData.insertBefore(row,next):sheetData.appendChild(row);
  }
  const ref=`${pricingExcelColName(col0)}${row1}`;
  let cell=[...row.getElementsByTagNameNS("*","c")].find(x=>x.getAttribute("r")===ref);
  if(!cell){
    cell=doc.createElementNS(ns,"c");cell.setAttribute("r",ref);
    const next=[...row.children].find(x=>xlsxCellColumnIndex(x.getAttribute?.("r")||"")>col0);next?row.insertBefore(cell,next):row.appendChild(cell);
  }
  [...cell.children].forEach(ch=>{const n=ch.localName;if(["f","v","is"].includes(n))cell.removeChild(ch)});
  if(value===null||value===undefined||String(value)===""){cell.removeAttribute("t");return}
  if(numeric){
    cell.removeAttribute("t");const v=doc.createElementNS(ns,"v");v.textContent=String(toNumber(value));cell.appendChild(v);return;
  }
  cell.setAttribute("t","inlineStr");const is=doc.createElementNS(ns,"is"),t=doc.createElementNS(ns,"t");
  t.setAttribute("xml:space","preserve");t.textContent=String(value);is.appendChild(t);cell.appendChild(is);
}
function xlsxCellColumnIndex(ref){
  const m=String(ref||"").match(/^([A-Z]+)/i);return m?excelColToIndex(m[1]):999999;
}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function sortBoqRows(a,b){
  const oa=Number(a.sourceOrder??999999),ob=Number(b.sourceOrder??999999);if(oa!==ob)return oa-ob;
  return String(a.itemNo||"").localeCompare(String(b.itemNo||""),"vi",{numeric:true});
}

function isPriceableItem(x){return x?.rowType!=="SECTION"&&x?.rowType!=="NOTE"&&String(x?.description||"").trim()!==""&&Number(x?.qty||0)>0}


async function inspectSpreadsheet(file,mode){
  const ext=fileExtension(file.name);
  if(!["xlsx","xls","csv"].includes(ext))throw new Error("Chỉ hỗ trợ .xlsx, .xls hoặc .csv.");

  if(ext==="csv"){
    const aoa=parseCsv(await file.text());
    const d=detectHeader(aoa,mode);
    const map=mode==="BOQ"?mapBoqHeadersDataAware(aoa,d.headerRow-1,d.headerDepth):mapPriceHeadersDataAware(aoa,d.headerRow-1,d.headerDepth);
    return {kind:"CSV",fileName:file.name,defaultSheet:"CSV",laborSheetName:"",laborCatalog:[],templateConfig:{},targetColumnMap:map,
      sheets:{CSV:{aoa,headerRow:d.headerRow,headerDepth:d.headerDepth,score:d.score,columnMap:map,sourceGrid:buildPricingGridFromAoa(aoa,"CSV")}}};
  }

  const XLSX=globalThis.XLSX;
  if(!XLSX)throw new Error("Thư viện Excel chưa tải được. Tải lại trang rồi thử lại.");
  const wb=XLSX.read(await file.arrayBuffer(),{type:"array",raw:true,cellDates:false,cellText:true,cellStyles:true});
  const sheets={};

  for(const name of wb.SheetNames){
    const ws=wb.Sheets[name];
    const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false,blankrows:true});
    const aoa=expandMergedCells(raw,ws["!merges"]||[]);
    const d=detectHeader(aoa,mode);
    const map=mode==="BOQ"?mapBoqHeadersDataAware(aoa,d.headerRow-1,d.headerDepth):mapPriceHeadersDataAware(aoa,d.headerRow-1,d.headerDepth);
    sheets[name]={aoa,headerRow:d.headerRow,headerDepth:d.headerDepth,score:d.score,columnMap:map,sourceGrid:buildPricingGridFromWorksheet(ws,XLSX,name)};
  }

  let laborSheetName="",laborCatalog=[],templateConfig={};
  if(mode==="BOQ"){
    laborSheetName=findLaborSheetName(wb.SheetNames);
    if(laborSheetName){
      const laborAoa=sheets[laborSheetName]?.aoa||[];
      templateConfig=parseTenderTemplateConfig(laborAoa);
      laborCatalog=parseLaborCatalog(laborAoa,laborSheetName);
    }
  }

  let defaultSheet="";
  if(mode==="BOQ"&&templateConfig.targetSheetName){
    defaultSheet=wb.SheetNames.find(n=>cleanKey(n)===cleanKey(templateConfig.targetSheetName))||"";
  }
  if(!defaultSheet){
    const candidates=wb.SheetNames.filter(n=>n!==laborSheetName&&!["INDEX","TONG HOP","TONGHOP"].includes(cleanHeader(n).toUpperCase()));
    defaultSheet=[...(candidates.length?candidates:wb.SheetNames)].sort((a,b)=>(sheets[b]?.score||0)-(sheets[a]?.score||0))[0]||wb.SheetNames[0];
  }

  let targetColumnMap=sheets[defaultSheet]?.columnMap||{};
  if(mode==="BOQ"&&sheets[defaultSheet]){
    targetColumnMap=forceTemplateBoqMap(sheets[defaultSheet].aoa,sheets[defaultSheet].headerRow-1,sheets[defaultSheet].headerDepth,targetColumnMap,templateConfig);
    sheets[defaultSheet].columnMap=targetColumnMap;
  }
  return {kind:"EXCEL",fileName:file.name,defaultSheet,sheets,laborSheetName,laborCatalog,templateConfig,targetColumnMap};
}

function findLaborSheetName(names){
  const exact=(names||[]).find(n=>["CTG","CTC"].includes(cleanHeader(n).toUpperCase()));
  if(exact)return exact;
  return (names||[]).find(n=>/^(ctg|ctc)(\b|[ _.-])/i.test(cleanHeader(n)))||"";
}

function parseTenderTemplateConfig(aoa){
  const targetSheetName=String(aoa?.[0]?.[1]??"").trim();
  const descriptionColumn=String(aoa?.[0]?.[3]??"").trim().toUpperCase();
  const unitColumn=String(aoa?.[1]?.[3]??"").trim().toUpperCase();
  const qtyColumn=String(aoa?.[2]?.[3]??"").trim().toUpperCase();
  return {targetSheetName,descriptionColumn,unitColumn,qtyColumn};
}

function excelColToIndex(letter){
  const s=String(letter||"").toUpperCase().replace(/[^A-Z]/g,"");if(!s)return -1;
  let n=0;for(const ch of s)n=n*26+(ch.charCodeAt(0)-64);return n-1;
}

function parseLaborCatalog(aoa,sheetName){
  const out=[];
  for(let r=0;r<(aoa||[]).length;r++){
    const row=aoa[r]||[];
    const code=String(row[1]??"").trim();
    if(!code||["code vat tu","code vật tư","ma vat tu","mã vật tư"].includes(cleanHeader(code)))continue;
    const laborRaw=toNumber(row[19]);
    const materialSelected=toNumber(row[18]);
    if(!laborRaw&&!materialSelected&&!String(row[20]??"").trim()&&!String(row[21]??"").trim())continue;
    out.push({code,laborRaw,materialSelected,model:String(row[20]??"").trim(),brand:String(row[21]??"").trim(),origin:String(row[22]??"").trim(),sheetName,sourceRow:r+1});
  }
  return out;
}

function forceTemplateBoqMap(aoa,start,depth,autoMap,config){
  const map={...(autoMap||{})};
  const d=excelColToIndex(config?.descriptionColumn),u=excelColToIndex(config?.unitColumn),qv=excelColToIndex(config?.qtyColumn);
  if(d>=0)map.description=d;if(u>=0)map.unit=u;if(qv>=0)map.qty=qv;

  const headers=combineHeaders(aoa,start,depth).map(cleanHeader);
  const exact=(patterns)=>{
    let best=-1,bestScore=-1;
    headers.forEach((h,c)=>{for(const p of patterns){const sc=p.test(h)?(h.length<40?200-h.length:120):-1;if(sc>bestScore){bestScore=sc;best=c}}});return best;
  };
  const code=exact([/^code gia$/,/^ma gia$/,/^code$/]);if(code>=0)map.code=code;
  const tt=exact([/^tt$/,/^stt$/,/^so thu tu$/]);if(tt>=0)map.itemNo=tt;
  const model=exact([/^ma hieu$/,/^model/,/^model .*thong so/]);if(model>=0)map.specification=model;
  const brand=exact([/^nhan hieu$/,/^thuong hieu$/]);if(brand>=0)map.brand=brand;
  const origin=exact([/^xuat xu$/]);if(origin>=0)map.origin=origin;

  const material=headers.findIndex(h=>h.includes("don gia")&&h.includes("vat tu")&&!h.includes("vat tu phu"));
  const labor=headers.findIndex(h=>h.includes("don gia")&&h.includes("nhan cong"));
  const total=headers.findIndex(h=>h.includes("tong don gia")||h.includes("tong cong don gia"));
  const amount=headers.findIndex(h=>h.includes("thanh tien")&&!h.includes("vat tu phu"));
  if(material>=0)map.materialUnit=material;if(labor>=0)map.laborUnit=labor;if(total>=0)map.totalUnit=total;if(amount>=0)map.amount=amount;
  return map;
}


function buildPricingGridFromWorksheet(ws,XLSX,sheetName){
  if(!ws?.["!ref"])return buildPricingGridFromAoa([],sheetName);

  const range=XLSX.utils.decode_range(ws["!ref"]);
  const startRow=range.s.r;
  const endRow=range.e.r;
  const startCol=range.s.c;

  // V2.19.3:
  // Module Lập giá đấu thầu phải giữ TOÀN BỘ cột BOQ thực sự có dữ liệu.
  // Không còn giới hạn A→K. Đồng thời bỏ các cột trống dư do Excel từng format xa bên phải.
  const endCol=findPricingMeaningfulEndCol(ws,XLSX,range);
  const rowCount=endRow-startRow+1;
  const colCount=Math.max(0,endCol-startCol+1);
  const rows=[],styles={};

  for(let r=startRow;r<=endRow;r++){
    const out=[];
    for(let c=startCol;c<=endCol;c++){
      const addr=XLSX.utils.encode_cell({r,c});
      const cell=ws[addr];
      let value="";
      if(cell){
        try{value=XLSX.utils.format_cell(cell)}
        catch{value=cell.w??cell.v??""}
      }
      out.push(value===undefined||value===null?"":String(value));
      const st=pricingExtractCellStyle(cell);
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
    }))
    .filter(m=>m.c2>=m.c1&&m.r2>=m.r1);

  const cols=ws["!cols"]||[],rowMeta=ws["!rows"]||[];
  const colWidths=Array.from({length:colCount},(_,i)=>{
    const sourceCol=startCol+i;
    const fromExcel=pricingSourceColWidth(cols[sourceCol],sourceCol);
    return Number(cols[sourceCol]?.wpx||cols[sourceCol]?.wch||cols[sourceCol]?.width)
      ?fromExcel
      :pricingAutoWidthFromRows(rows,i);
  });
  const rowHeights=Array.from({length:rowCount},(_,i)=>pricingSourceRowHeight(rowMeta[startRow+i]));

  return {
    sheetName,
    range:`${pricingExcelColName(startCol)}${startRow+1}:${pricingExcelColName(endCol)}${endRow+1}`,
    startRow:startRow+1,startCol,rowCount,colCount,rows,merges,colWidths,rowHeights,styles
  };
}

function findPricingMeaningfulEndCol(ws,XLSX,range){
  let end=Math.max(range.s.c,range.s.c);

  // Cell có dữ liệu / công thức / text hiển thị.
  for(const addr of Object.keys(ws||{})){
    if(addr.startsWith("!"))continue;
    let rc;
    try{rc=XLSX.utils.decode_cell(addr)}catch{continue}
    if(rc.r<range.s.r||rc.r>range.e.r||rc.c<range.s.c||rc.c>range.e.c)continue;

    const cell=ws[addr];
    let visible="";
    try{visible=XLSX.utils.format_cell(cell)}catch{visible=cell?.w??cell?.v??""}
    const hasFormula=Boolean(cell?.f);
    if(String(visible??"").trim()!==""||hasFormula)end=Math.max(end,rc.c);
  }

  // Merge có nội dung cũng phải giữ đủ tới cột cuối của vùng merge.
  for(const m of ws?.["!merges"]||[]){
    if(m.e.r<range.s.r||m.s.r>range.e.r)continue;
    const startAddr=XLSX.utils.encode_cell({r:m.s.r,c:m.s.c});
    const cell=ws[startAddr];
    let visible="";
    try{visible=XLSX.utils.format_cell(cell)}catch{visible=cell?.w??cell?.v??""}
    if(String(visible??"").trim()!=="")end=Math.max(end,m.e.c);
  }

  return Math.min(range.e.c,Math.max(range.s.c,end));
}

function buildPricingGridFromAoa(aoa,sheetName="CSV"){
  const rawRows=(aoa||[]).map(r=>(Array.isArray(r)?r:[]).map(v=>String(v??"")));
  let lastCol=-1;

  rawRows.forEach(r=>{
    for(let c=r.length-1;c>=0;c--){
      if(String(r[c]??"").trim()!==""){lastCol=Math.max(lastCol,c);break}
    }
  });

  const colCount=Math.max(0,lastCol+1);
  const rows=rawRows.map(r=>{
    const out=r.slice(0,colCount);
    while(out.length<colCount)out.push("");
    return out;
  });

  return {
    sheetName,
    range:rows.length&&colCount?`A1:${pricingExcelColName(colCount-1)}${rows.length}`:"",
    startRow:1,startCol:0,rowCount:rows.length,colCount,rows,merges:[],
    colWidths:Array.from({length:colCount},(_,c)=>pricingAutoWidthFromRows(rows,c)),
    rowHeights:Array.from({length:rows.length},()=>24),styles:{}
  };
}

function pricingSourceColWidth(info,c){
  if(Number(info?.wpx)>0)return Math.max(48,Math.min(430,Math.round(Number(info.wpx))));
  if(Number(info?.wch)>0)return Math.max(48,Math.min(430,Math.round(Number(info.wch)*7+14)));
  const defaults=[74,90,330,82,92,118,190,108,100,118,118];
  return defaults[c]||100;
}
function pricingSourceRowHeight(info){
  if(Number(info?.hpx)>0)return Math.max(20,Math.min(180,Math.round(Number(info.hpx))));
  if(Number(info?.hpt)>0)return Math.max(20,Math.min(180,Math.round(Number(info.hpt)*96/72)));
  return 26;
}
function pricingAutoWidthFromRows(rows,c){
  let max=8;
  for(let r=0;r<Math.min(rows.length,500);r++)max=Math.max(max,Math.min(55,String(rows[r]?.[c]??"").length));
  return Math.max(62,Math.min(330,max*6.8+18));
}
function pricingExtractCellStyle(cell){
  const s=cell?.s;if(!s||typeof s!=="object")return null;
  const o={},a=s.alignment||{},f=s.font||{},fill=s.fill||{};
  const h=String(a.horizontal||"").toLowerCase(),v=String(a.vertical||"").toLowerCase();
  if(["left","center","right","justify"].includes(h))o.h=h;
  if(["top","center","bottom"].includes(v))o.v=v==="center"?"middle":v;
  if(a.wrapText)o.w=1;if(f.bold)o.b=1;if(f.italic)o.i=1;if(f.name)o.ff=String(f.name);
  if(Number(f.sz)>0)o.fs=Number(f.sz);
  const fg=pricingRgb(f.color),bg=pricingRgb(fill.fgColor)||pricingRgb(fill.bgColor);
  if(fg)o.fg=fg;if(bg)o.bg=bg;
  return Object.keys(o).length?o:null;
}
function pricingRgb(c){
  let x=String(c?.rgb||"").replace(/^FF/i,"").toUpperCase();
  return /^[0-9A-F]{6}$/.test(x)?`#${x}`:"";
}
function normalizePricingSourceGrid(g){
  const arrv=v=>Array.isArray(v)?v:(v&&typeof v==="object"?Object.keys(v).filter(k=>/^\d+$/.test(k)).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]):[]);
  return {
    ...g,
    rows:arrv(g?.rows).map(r=>arrv(r)),
    merges:arrv(g?.merges).filter(Boolean),
    colWidths:arrv(g?.colWidths),
    rowHeights:arrv(g?.rowHeights),
    styles:g?.styles||{}
  };
}
function pricingMergeLookup(merges){
  const starts=new Map(),covered=new Set();
  for(const m of merges||[]){
    const r1=Number(m.r1),c1=Number(m.c1),r2=Number(m.r2),c2=Number(m.c2);
    if(![r1,c1,r2,c2].every(Number.isFinite))continue;
    starts.set(`${r1}_${c1}`,{r1,c1,r2,c2});
    for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++)if(r!==r1||c!==c1)covered.add(`${r}_${c}`);
  }
  return {starts,covered};
}
function pricingGridColWidth(v,c){
  const n=Number(v||0);
  if(n>0)return Math.max(36,Math.min(900,n));
  return pricingSourceColWidth(null,c);
}
function pricingExcelColName(index){
  let n=Number(index)+1,s="";
  while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}
  return s;
}
function pricingCellStyle(st){
  if(!st||typeof st!=="object")return "";
  const out=[];
  if(st.h)out.push(`text-align:${["left","center","right","justify"].includes(st.h)?st.h:"left"}!important`);
  if(st.v)out.push(`vertical-align:${["top","middle","bottom"].includes(st.v)?st.v:"middle"}!important`);
  if(st.w)out.push("white-space:pre-wrap!important");
  if(st.b)out.push("font-weight:700!important");
  if(st.i)out.push("font-style:italic!important");
  if(st.ff)out.push(`font-family:${escCssFont(st.ff)}!important`);
  if(st.fs)out.push(`font-size:${Math.max(7,Math.min(36,Number(st.fs)||10))}px!important`);
  if(st.bg&&/^#[0-9A-F]{6}$/i.test(st.bg))out.push(`background:${st.bg}!important`);
  if(st.fg&&/^#[0-9A-F]{6}$/i.test(st.fg))out.push(`color:${st.fg}!important`);
  return out.join(";");
}
function escCssFont(v){
  const x=String(v||"").replace(/[^A-Za-z0-9 _-]/g,"").trim();
  return x?`'${x}',Arial,sans-serif`:"Arial,sans-serif";
}
function pricingBoqRowClass(row,r,grid){
  const text=norm((row||[]).join(" "));
  const excelRow=Number(grid.startRow||1)+r;
  const hs=Number(boqMeta?.headerRow||0),hd=Math.max(1,Number(boqMeta?.headerDepth||1));
  if(text.includes("bang khoi luong cong viec"))return "pricing-boq-title";
  if(hs&&excelRow>=hs&&excelRow<hs+hd)return excelRow===hs?"pricing-boq-header":"pricing-boq-subheader";
  if(text.includes("ghi chu chung"))return "pricing-boq-note-header";
  const first=(row||[]).map(x=>String(x??"").trim()).find(Boolean)||"";
  if(/^\d+\.0$/.test(first))return "pricing-boq-section-1";
  if(/^\d+\.\d$/.test(first))return "pricing-boq-section-2";
  return "";
}

function mapBoqHeadersDataAware(aoa,start,depth){
  const headers=combineHeaders(aoa,start,depth);
  const clean=headers.map(cleanHeader),map={};
  for(const [key,aliases0] of Object.entries(BOQ_ALIASES)){
    const aliases=aliases0.map(cleanHeader);
    let best=-1,bestScore=-1e9;
    clean.forEach((h,c)=>{
      const semantic=pricingHeaderSemanticScore(h,aliases,key);
      if(semantic<0)return;
      let nonEmpty=0,numeric=0,text=0,short=0;
      for(let r=start+depth;r<Math.min(aoa.length,start+depth+300);r++){
        const v=aoa[r]?.[c],t=String(v??"").trim();
        if(!t)continue;nonEmpty++;
        if(isNumericLike(v))numeric++;else{text++;if(t.length<=20)short++}
      }
      let data=nonEmpty*.2;
      if(key==="description")data+=text*3;
      else if(["qty","materialUnit","laborUnit","totalUnit","amount"].includes(key))data+=numeric*4;
      else if(key==="unit")data+=short*2;
      else data+=text*.6+numeric*.3;
      const score=semantic+data;
      if(score>bestScore){bestScore=score;best=c}
    });
    map[key]=best;
  }
  return map;
}
function pricingHeaderSemanticScore(h,aliases,key){
  let best=-1;
  for(const a of aliases){
    if(!a)continue;
    let score=-1;
    if(h===a)score=140+a.length;
    else if(h.startsWith(a+" ")||h.endsWith(" "+a))score=110+a.length;
    else if(a.length>=4&&h.includes(a))score=80+a.length;
    best=Math.max(best,score);
  }
  if(key==="description"&&h.includes("dien giai"))best=Math.max(best,170);
  if(key==="qty"&&h==="khoi luong")best=Math.max(best,175);
  if(key==="materialUnit"&&h.includes("vat tu chinh"))best=Math.max(best,180);
  if(key==="laborUnit"&&h.includes("nhan cong"))best=Math.max(best,175);
  if(key==="code"&&(h==="code gia"||h==="ma gia"||h==="code"))best=Math.max(best,185);
  if(key==="itemNo"&&(h==="tt"||h==="stt"))best=Math.max(best,185);
  if(key==="totalUnit"&&h.includes("tong don gia"))best=Math.max(best,180);
  if(key==="amount"&&h.includes("thanh tien"))best=Math.max(best,180);
  return best;
}

function detectHeader(aoa,mode){
  let best={headerRow:1,headerDepth:1,score:-1,validRows:0};
  const limit=Math.min(mode==="PRICE"?80:50,aoa.length);
  const maxDepth=mode==="PRICE"?4:3;

  for(let r=0;r<limit;r++){
    if(!(aoa[r]||[]).some(x=>String(x??"").trim()))continue;

    for(let depth=1;depth<=maxDepth;depth++){
      if(r+depth>aoa.length)break;

      const map=mode==="BOQ"
        ?mapBoqHeadersDataAware(aoa,r,depth)
        :mapPriceHeadersDataAware(aoa,r,depth);

      let score=Object.values(map).filter(i=>Number.isInteger(i)&&i>=0).length*3;
      if(map.description>=0)score+=18;
      if(mode==="PRICE"&&map.unitPrice>=0)score+=22;
      if(mode==="BOQ"&&map.qty>=0)score+=12;
      if(map.unit>=0)score+=4;
      if(map.specification>=0)score+=3;

      const validRows=mode==="PRICE"
        ?countPriceValidRows(aoa,r+depth,map)
        :0;

      score+=mode==="PRICE"
        ?Math.min(60,validRows*2.5)
        :dataLikelihood(aoa,r+depth,map,mode);

      // Ưu tiên block tiêu đề thực sự tạo ra nhiều dòng giá.
      if(
        score>best.score ||
        (score===best.score&&validRows>best.validRows) ||
        (score===best.score&&validRows===best.validRows&&r+1<best.headerRow)
      ){
        best={headerRow:r+1,headerDepth:depth,score,validRows};
      }
    }
  }
  return best;
}

function mapPriceHeadersDataAware(aoa,start,depth){
  const headers=combineHeaders(aoa,start,depth);
  const clean=headers.map(cleanHeader);
  const dataStart=start+depth;
  const stats=clean.map((_,c)=>priceColumnStats(aoa,c,dataStart));

  const map={};

  // 1) Giá trước: vừa xét tên cột vừa xét hình thái tiền tệ.
  let bestPrice=-1,bestPriceScore=-1e9;
  clean.forEach((h,c)=>{
    const semantic=priceHeaderSemanticScore(h,PRICE_ALIASES.unitPrice.map(cleanHeader),"unitPrice");
    const st=stats[c];
    if(!st.nonEmpty)return;

    let score=(semantic>=0?semantic:0);
    score+=st.positiveNumeric*5;
    score+=Math.min(26,st.moneyMagnitudeScore*4);
    score+=st.numericRatio*16;

    if(priceHeaderLooksLikeTotal(h))score-=85;
    if(priceHeaderLooksLikeQty(h))score-=90;
    if(priceHeaderLooksLikePercent(h))score-=100;

    // Khi không có tên cột rõ ràng, vẫn cho phép suy luận từ dữ liệu.
    if(semantic<0&&st.positiveNumeric<2)score=-1e9;

    if(score>bestPriceScore){bestPriceScore=score;bestPrice=c}
  });
  map.unitPrice=bestPrice;

  // 2) Mô tả: ưu tiên text dài, xuất hiện cùng dòng với giá.
  let bestDesc=-1,bestDescScore=-1e9;
  clean.forEach((h,c)=>{
    if(c===map.unitPrice)return;
    const semantic=priceHeaderSemanticScore(h,PRICE_ALIASES.description.map(cleanHeader),"description");
    const st=stats[c];
    if(!st.nonEmpty)return;

    const coPrice=map.unitPrice>=0?priceCooccurrenceStats(aoa,c,map.unitPrice,dataStart):0;
    let score=(semantic>=0?semantic:0);
    score+=st.text*2.3;
    score+=Math.min(35,st.avgTextLen*.55);
    score+=coPrice*5;
    score-=st.numericRatio*30;

    if(priceHeaderLooksLikeQty(h)||priceHeaderLooksLikeTotal(h))score-=70;
    if(semantic<0&&st.text<2)score=-1e9;

    if(score>bestDescScore){bestDescScore=score;bestDesc=c}
  });
  map.description=bestDesc;

  // 3) Các cột phụ.
  for(const key of ["code","specification","unit","brand","origin","supplier"]){
    let best=-1,bestScore=-1e9;
    const aliases=(PRICE_ALIASES[key]||[]).map(cleanHeader);

    clean.forEach((h,c)=>{
      if(c===map.description||c===map.unitPrice)return;
      const semantic=priceHeaderSemanticScore(h,aliases,key);
      if(semantic<0)return;

      const st=stats[c];
      let score=semantic+st.nonEmpty*.2;
      if(key==="unit")score+=st.shortText*1.8-st.numericRatio*20;
      else if(key==="code")score+=st.shortText*.9;
      else score+=st.text*.35;

      if(score>bestScore){bestScore=score;best=c}
    });
    map[key]=best;
  }

  return map;
}

function priceHeaderSemanticScore(h,aliases,key){
  if(!h)return -1;
  let best=-1;

  for(const a of aliases||[]){
    if(!a)continue;
    let score=-1;
    if(h===a)score=155+a.length;
    else if(h.startsWith(a+" ")||h.endsWith(" "+a))score=125+a.length;
    else if(a.length>=3&&h.includes(a))score=92+a.length;
    best=Math.max(best,score);
  }

  if(key==="description"){
    if(/ten .*hang|ten .*vat tu|ten .*san pham|mo ta|dien giai|description|product/.test(h))best=Math.max(best,170);
  }else if(key==="unitPrice"){
    if(/don gia|unit price|unit rate|unit cost|gia ban|gia chao|gia net|price/.test(h))best=Math.max(best,180);
  }
  return best;
}

function priceColumnStats(aoa,col,start){
  let nonEmpty=0,numeric=0,positiveNumeric=0,text=0,shortText=0,totalTextLen=0;
  const nums=[];
  const end=Math.min(aoa.length,start+500);

  for(let r=start;r<end;r++){
    const v=aoa[r]?.[col];
    const t=String(v??"").trim();
    if(!t)continue;
    nonEmpty++;

    if(isNumericLike(v)){
      numeric++;
      const n=toNumber(v);
      if(n>0){positiveNumeric++;nums.push(Math.abs(n))}
    }else{
      text++;
      totalTextLen+=t.length;
      if(t.length<=24)shortText++;
    }
  }

  nums.sort((a,b)=>a-b);
  const median=nums.length?nums[Math.floor(nums.length/2)]:0;
  return {
    nonEmpty,numeric,positiveNumeric,text,shortText,
    numericRatio:nonEmpty?numeric/nonEmpty:0,
    avgTextLen:text?totalTextLen/text:0,
    moneyMagnitudeScore:median>0?Math.max(0,Math.log10(median+1)):0,
    median
  };
}

function priceCooccurrenceStats(aoa,textCol,priceCol,start){
  let n=0;
  const end=Math.min(aoa.length,start+500);
  for(let r=start;r<end;r++){
    const text=String(aoa[r]?.[textCol]??"").trim();
    const price=toNumber(aoa[r]?.[priceCol]);
    if(text&&price>0&&!isNumericLike(text))n++;
  }
  return n;
}

function priceHeaderLooksLikeTotal(h){
  return /thanh tien|tong tien|tong cong|subtotal|amount|total amount|gia tri/.test(h||"");
}
function priceHeaderLooksLikeQty(h){
  return /so luong|khoi luong|quantity|qty/.test(h||"");
}
function priceHeaderLooksLikePercent(h){
  return /%|phan tram|vat|thue|tax|chiet khau|discount/.test(h||"");
}

function countPriceValidRows(aoa,start,map){
  if(map.description<0||map.unitPrice<0)return 0;
  let n=0;
  for(let r=start;r<Math.min(aoa.length,start+700);r++){
    const desc=String(aoa[r]?.[map.description]??"").trim();
    const price=toNumber(aoa[r]?.[map.unitPrice]);
    if(desc&&price>0&&!isPriceSummaryDescription(desc))n++;
  }
  return n;
}

function isPriceSummaryDescription(desc){
  const t=cleanText(desc);
  return /^(tong|tong cong|subtotal|total|vat|thue|tax|chiet khau|discount)\b/.test(t)
    || t.includes("tong gia tri")
    || t.includes("total amount");
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

function parseBoqSheet(aoa,headerIndex,headerDepth,forcedMap=null){
  const autoMap=mapBoqHeadersDataAware(aoa,headerIndex,headerDepth);
  const map={...autoMap,...Object.fromEntries(Object.entries(forcedMap||{}).filter(([,v])=>Number.isInteger(Number(v))&&Number(v)>=0).map(([k,v])=>[k,Number(v)]))};
  if(map.description<0)throw new Error("Không nhận được cột Diễn giải/Mô tả trong BOQ.");
  const out=[];
  for(let r=headerIndex+headerDepth;r<aoa.length;r++){
    const row=aoa[r]||[];if(!row.some(x=>String(x??"").trim()))continue;
    const get=k=>map[k]>=0?(row[map[k]]??""):"";
    const code=String(get("code")??"").trim();
    const itemNo=String(get("itemNo")??"").trim(),description=String(get("description")??"").trim();
    if(!code&&!itemNo&&!description)continue;
    const unit=String(get("unit")??"").trim(),qtyRaw=get("qty");
    const hasQty=isNumericLike(qtyRaw),materialRaw=get("materialUnit"),laborRaw=get("laborUnit"),totalRaw=get("totalUnit"),amountRaw=get("amount");
    let rowType="ITEM";
    const descNorm=cleanText(description),unitNorm=cleanText(unit);
    if(descNorm==="ghi chu chung"||unitNorm==="note")rowType="NOTE";
    else if(!unit&&!hasQty&&!isNumericLike(materialRaw)&&!isNumericLike(laborRaw)&&looksLikeSection(itemNo,description))rowType="SECTION";
    else if(!unit&&!hasQty&&!itemNo&&!code&&description.length>45)rowType="NOTE";
    out.push({
      sourceRow:r+1,sourceOrder:r-(headerIndex+headerDepth),rowType,code,itemNo,description,
      specification:String(get("specification")??"").trim(),unit,qty:hasQty?toNumber(qtyRaw):0,
      brand:String(get("brand")??"").trim(),origin:String(get("origin")??"").trim(),
      materialUnit:isNumericLike(materialRaw)?toNumber(materialRaw):0,
      laborUnit:isNumericLike(laborRaw)?toNumber(laborRaw):0,
      totalUnit:isNumericLike(totalRaw)?toNumber(totalRaw):0,
      amount:isNumericLike(amountRaw)?toNumber(amountRaw):0,
      subcontractUnit:0,otherUnit:0,wastePct:0,markupPct:0
    });
  }
  return out;
}

function parsePriceSheet(aoa,headerIndex,headerDepth,{fileName,sheetName,defaultSupplier}){
  const map=mapPriceHeadersDataAware(aoa,headerIndex,headerDepth);

  if(map.description<0||map.unitPrice<0){
    throw new Error(`${fileName}: chưa suy luận được cột Tên/Mô tả hàng và cột Giá.`);
  }

  const out=[];
  for(let r=headerIndex+headerDepth;r<aoa.length;r++){
    const row=aoa[r]||[];
    const get=k=>map[k]>=0?(row[map[k]]??""):"";

    let description=String(get("description")??"").trim();
    const specification=String(get("specification")??"").trim();
    const code=String(get("code")??"").trim();
    const price=toNumber(get("unitPrice"));

    if(!description&&specification)description=specification;
    if(!description&&code)description=code;

    if(!description||!(price>0)||isPriceSummaryDescription(description))continue;

    out.push({
      code,
      description,
      specification,
      unit:String(get("unit")??"").trim(),
      brand:String(get("brand")??"").trim(),
      origin:String(get("origin")??"").trim(),
      supplier:String(get("supplier")||defaultSupplier||baseFileName(fileName)).trim(),
      unitPrice:price,
      sourceFileName:fileName,
      sourceSheetName:sheetName,
      sourceRow:r+1,
      detectedDescriptionColumn:map.description,
      detectedPriceColumn:map.unitPrice,
      createdAt:Date.now()
    });
  }

  if(!out.length){
    throw new Error(`${fileName}: đã nhận cột nhưng chưa tìm thấy dòng nào có Tên hàng + Giá > 0.`);
  }
  return out;
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
