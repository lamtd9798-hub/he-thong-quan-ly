import {auth,db,listenAuth,getProfile,ROLES,can,initials,initModal,loading} from "./core.js?v=2.17.0";
import {renderDashboard} from "./modules/dashboard.js?v=2.17.0";
import {renderProjects} from "./modules/projects.js?v=2.17.0";
import {renderTasks} from "./modules/tasks.js?v=2.17.0";
import {renderTender} from "./modules/tender.js?v=2.17.0";
import {renderBOQ} from "./modules/boq.js?v=2.17.0";
import {renderExecution} from "./modules/execution.js?v=2.17.0";
import {renderFinance} from "./modules/finance.js?v=2.17.0";
import {renderReports} from "./modules/reports.js?v=2.17.0";
import {renderUsers} from "./modules/users.js?v=2.17.0";

const $=s=>document.querySelector(s);
const routes={dashboard:renderDashboard,projects:renderProjects,tasks:renderTasks,tender:renderTender,boq:renderBOQ,execution:renderExecution,finance:renderFinance,reports:renderReports,users:renderUsers};
let routerStarted=false;

initModal();
initUI();
listenConnection();

listenAuth(async(user,profile,error)=>{
  if(!user){
    $("#loginScreen").classList.remove("hidden");$("#appShell").classList.add("hidden");
    if(error)showLoginError(error.message);
    return;
  }
  $("#loginScreen").classList.add("hidden");$("#appShell").classList.remove("hidden");
  applyProfile(profile);
  if(!routerStarted){window.addEventListener("hashchange",route);routerStarted=true;if(!location.hash)location.hash="#/dashboard";else await route()}
  else await route();
});

function initUI(){
  $("#loginForm").addEventListener("submit",async e=>{
    e.preventDefault();hideLoginError();const b=$("#loginBtn");
    try{b.disabled=true;b.textContent="Đang đăng nhập...";await auth.signInWithEmailAndPassword($("#loginEmail").value.trim(),$("#loginPassword").value)}
    catch(err){showLoginError(errorVi(err))}
    finally{b.disabled=false;b.textContent="Đăng nhập"}
  });
  $("#logoutBtn").addEventListener("click",async()=>{$("#userMenu").classList.add("hidden");await auth.signOut()});
  $("#userBtn").addEventListener("click",()=>$("#userMenu").classList.toggle("hidden"));
  document.addEventListener("click",e=>{if(!e.target.closest(".user-wrap"))$("#userMenu").classList.add("hidden")});
  $("#collapseBtn").addEventListener("click",()=>{
    $("#sidebar").classList.toggle("collapsed");localStorage.setItem("v2-side",$("#sidebar").classList.contains("collapsed")?"1":"0");
  });
  if(localStorage.getItem("v2-side")==="1")$("#sidebar").classList.add("collapsed");
  $("#menuBtn").addEventListener("click",()=>{$("#sidebar").classList.add("mobile-open");$("#mobileOverlay").classList.add("show")});
  $("#mobileOverlay").addEventListener("click",closeMobile);
  document.querySelector("nav").addEventListener("click",e=>{if(e.target.closest(".nav-item"))closeMobile()});
  $("#todayText").textContent=new Intl.DateTimeFormat("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date());
}
async function route(){
  let name=(location.hash||"#/dashboard").replace(/^#\/?/,"").split("/")[0]||"dashboard";
  if(!routes[name])name="dashboard";
  if(name==="users"&&!can("usersManage"))name="dashboard";
  if(name==="boq"&&!can("finance")){ location.hash="#/dashboard"; return; }
  if(name==="finance"&&!can("financeProjectView")){ location.hash="#/dashboard"; return; }
  document.querySelectorAll(".nav-item").forEach(a=>a.classList.toggle("active",a.dataset.route===name));
  const c=$("#content");c.innerHTML=loading();
  try{await routes[name](c)}catch(err){console.error(err);c.innerHTML=`<div class="empty"><b>!</b><h3>Không tải được trang</h3><p>${String(err.message||err)}</p></div>`}
  window.scrollTo({top:0,behavior:"smooth"});
}
function applyProfile(p){
  $("#userName").textContent=p.displayName||p.email||"Người dùng";$("#userRole").textContent=ROLES[p.role]||p.role||"Chưa phân quyền";$("#userEmail").textContent=p.email||"";$("#avatar").textContent=initials(p.displayName,p.email);
  document.querySelectorAll(".admin-only").forEach(x=>x.classList.toggle("hidden",!can("usersManage")));
  document.querySelectorAll(".finance-only").forEach(x=>x.classList.toggle("hidden",!can("finance")));
  document.querySelectorAll(".finance-project-only").forEach(x=>x.classList.toggle("hidden",!can("financeProjectView")));
}
function closeMobile(){$("#sidebar").classList.remove("mobile-open");$("#mobileOverlay").classList.remove("show")}
function listenConnection(){
  db.ref(".info/connected").on("value",s=>{const e=$("#connectionStatus");if(s.val()===true){e.className="connection online";e.querySelector("span").textContent="Đã kết nối Firebase"}else{e.className="connection offline";e.querySelector("span").textContent="Mất kết nối"}});
}
function showLoginError(m){$("#loginError").textContent=m;$("#loginError").classList.remove("hidden")}
function hideLoginError(){$("#loginError").classList.add("hidden")}
function errorVi(e){
  const c=e?.code||"";if(c.includes("invalid-credential")||c.includes("wrong-password")||c.includes("user-not-found"))return"Email hoặc mật khẩu không đúng.";
  if(c.includes("too-many-requests"))return"Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.";
  if(c.includes("network-request-failed"))return"Không kết nối được mạng.";return e?.message||"Không thể đăng nhập.";
}
