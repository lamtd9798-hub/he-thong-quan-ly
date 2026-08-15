import {refs,arr,ts,logActivity,getProfile,ROLES,esc,fmtDateTime,setPage,loading,empty,badge,toast} from "../core.js?v=2.9.0";

let users=[];
export async function renderUsers(container){
  setPage("Người dùng & phân quyền","Hệ thống / Phân quyền");
  if(getProfile()?.role!=="ADMIN"){container.innerHTML=empty("Không có quyền","Chỉ Quản trị hệ thống được mở chức năng này.","◉");return}
  container.innerHTML=loading();users=await arr(refs.users());users.sort((a,b)=>(a.displayName||a.email||"").localeCompare(b.displayName||b.email||"","vi"));paint(container);
}
function paint(c){
  c.innerHTML=`<div class="page-head"><div><h2>Người dùng & phân quyền</h2><p>Người dùng đăng nhập lần đầu tự xuất hiện với quyền Nhân viên; Admin đổi quyền tại đây.</p></div></div>
  <div class="card"><div class="card-body" style="font-size:11px;color:#64748b"><b style="color:#172033">Lưu ý:</b> Trang này quản lý quyền V2. Tạo/xóa tài khoản Firebase Authentication thực hiện trong Firebase Console.</div></div>
  <div class="table-wrap mt"><table class="table"><thead><tr><th>NGƯỜI DÙNG</th><th>PHÒNG BAN</th><th>QUYỀN</th><th>TRẠNG THÁI</th><th>NGÀY TẠO</th><th>HIỆN TẠI</th></tr></thead><tbody>${users.length?users.map(row).join(""):`<tr><td colspan="6">${empty("Chưa có người dùng","Người dùng xuất hiện sau lần đăng nhập đầu tiên.","◉")}</td></tr>`}</tbody></table></div>`;
  c.querySelectorAll("[data-role]").forEach(x=>x.addEventListener("change",()=>save(x.dataset.role,{role:x.value},c)));
  c.querySelectorAll("[data-active]").forEach(x=>x.addEventListener("change",()=>save(x.dataset.active,{active:x.value==="true"},c)));
  c.querySelectorAll("[data-dept]").forEach(x=>x.addEventListener("change",()=>save(x.dataset.dept,{department:x.value},c)));
}
function row(u){
  return `<tr><td><div class="primary-text">${esc(u.displayName||u.email||"—")}</div><div class="secondary-text">${esc(u.email||"")}</div></td><td><input data-dept="${u.id}" value="${esc(u.department||"")}" placeholder="Phòng ban" style="width:150px"></td><td><select data-role="${u.id}">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${u.role===k?"selected":""}>${esc(v)}</option>`).join("")}</select></td><td><select data-active="${u.id}"><option value="true" ${u.active!==false?"selected":""}>Đang hoạt động</option><option value="false" ${u.active===false?"selected":""}>Đã khóa</option></select></td><td>${fmtDateTime(u.createdAt)}</td><td>${badge(ROLES[u.role]||u.role||"—","blue")}</td></tr>`;
}
async function save(id,patch,c){await refs.user(id).update({...patch,updatedAt:ts()});await logActivity("USER_UPDATED",`Cập nhật phân quyền người dùng ${id}`);toast("Đã cập nhật người dùng.");await renderUsers(c)}
