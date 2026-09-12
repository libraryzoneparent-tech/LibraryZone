const API_BASE = 'https://libraryzone-api.onrender.com';
const firebaseConfig = {
  apiKey: "AIzaSyDlX9t7jG5dm2t3XoPts2EAPZ3VBnxxBjI",
  authDomain: "libraryzoneparent-36d5a.firebaseapp.com",
  projectId: "libraryzoneparent-36d5a",
  storageBucket: "libraryzoneparent-36d5a.firebasestorage.app",
  messagingSenderId: "906159197620",
  appId: "1:906159197620:web:04b70b5f426e462a4936e1",
  measurementId: "G-3S0RCHLZJV"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

const $ = id => document.getElementById(id);
let records = [];
let teacher = null;

function esc(v){
  return String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function asDate(v){
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(v){
  const d = asDate(v);
  return d ? d.toLocaleDateString() : '—';
}

function getAdminDays(){
  // Server already calculates late status using the authoritative admin setting.
  // This fallback is only used if the API includes a dueDate.
  return 14;
}

function recordDueDate(r){
  if(r.dueDate) return asDate(r.dueDate);
  const d=asDate(r.borrowDate);
  if(!d) return null;
  d.setDate(d.getDate()+getAdminDays());
  return d;
}

function isLate(r){
  if(r.returnDate) return Number(r.overdueFee||0)>0 || r.isLate===true;
  if(r.isLate===true) return true;
  const due=recordDueDate(r);
  return !!due && Date.now()>due.getTime();
}

function feeValue(r){
  return Number(r.calculatedFee ?? r.overdueFee ?? 0) || 0;
}

async function api(path, options={}){
  const user=auth.currentUser;
  if(!user) throw new Error('Please sign in again.');
  const token=await user.getIdToken();
  const res=await fetch(API_BASE+path,{
    ...options,
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...(options.headers||{})}
  });
  let data={};
  try{data=await res.json()}catch(_){}
  if(!res.ok) throw new Error(data.error||`Request failed (${res.status})`);
  return data;
}

function fillGrades(){
  const sel=$('gradeFilter');
  const values=[...new Set(records.map(r=>String(r.grade||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  sel.innerHTML='<option value="all">All students</option>'+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
}

function filtered(){
  const status=$('statusFilter').value;
  const grade=$('gradeFilter').value;
  const search=$('studentSearch').value.trim().toLowerCase();

  return records.filter(r=>{
    const late=isLate(r);
    const paid=!!r.feePaid;
    const current=!r.returnDate;

    if(grade!=='all' && String(r.grade||'')!==grade) return false;
    if(search && !(`${r.studentName||''} ${r.studentId||''}`.toLowerCase().includes(search))) return false;

    if(status==='current' && !current) return false;
    if(status==='returned' && current) return false;
    if(status==='late' && !late) return false;
    if(status==='unpaid' && !(late && !paid)) return false;
    if(status==='paid' && !(late && paid)) return false;

    return true;
  });
}

function render(){
  const list=filtered();
  $('resultCount').textContent=`${list.length} record${list.length===1?'':'s'}`;

  const body=$('recordsBody');
  body.innerHTML=list.map(r=>{
    const late=isLate(r);
    const current=!r.returnDate;
    const fee=feeValue(r);
    const status=current
      ? (late ? '<span class="badge late">Late</span>' : '<span class="badge current">Currently out</span>')
      : (late ? '<span class="badge late">Returned late</span>' : '<span class="badge returned">Returned</span>');

    let payment='—';
    if(late || fee>0){
      payment=`<button class="pay-btn ${r.feePaid?'paid':'unpaid'}"
        data-tx="${esc(String(r.txId))}"
        data-paid="${r.feePaid?'true':'false'}">
        ${r.feePaid?'Paid':'Mark paid'}
      </button>`;
    }

    return `<tr>
      <td><div class="student-name">${esc(r.studentName||'Unknown')}</div><div class="sub">${esc(r.studentId||'')}</div></td>
      <td>${esc(r.grade||'—')}</td>
      <td><div class="student-name">${esc(r.bookTitle||r.barcode||'Unknown book')}</div><div class="sub">${esc(r.barcode||'')}</div></td>
      <td>${fmtDate(r.borrowDate)}</td>
      <td>${fmtDate(r.dueDate||recordDueDate(r))}</td>
      <td>${status}</td>
      <td>${fmtDate(r.returnDate)}</td>
      <td class="fee">${fee>0?fee.toFixed(2):'—'}</td>
      <td>${payment}</td>
    </tr>`;
  }).join('');

  body.querySelectorAll('.pay-btn').forEach(btn=>{
    btn.addEventListener('click',()=>togglePaid(btn.dataset.tx,btn.dataset.paid!=='true'));
  });

  $('statCurrent').textContent=records.filter(r=>!r.returnDate).length;
  $('statReturned').textContent=records.filter(r=>!!r.returnDate).length;
  $('statLate').textContent=records.filter(isLate).length;
  $('statUnpaid').textContent=records.filter(r=>isLate(r)&&!r.feePaid).length;
}

async function togglePaid(txId, paid){
  const btn=[...document.querySelectorAll('.pay-btn')].find(b=>b.dataset.tx===String(txId));
  if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{
    const data=await api('/api/teacher/fee',{
      method:'PUT',
      body:JSON.stringify({txId,paid})
    });
    const item=records.find(r=>String(r.txId)===String(txId));
    if(item) item.feePaid=!!data.paid;
    render();
  }catch(e){
    alert(e.message);
    render();
  }
}

async function loadPortal(){
  $('loading').hidden=false;
  $('error').hidden=true;
  try{
    const data=await api('/api/teacher/me');
    teacher=data.teacher;
    records=Array.isArray(data.records)?data.records:[];
    $('teacherName').textContent=teacher.name ? `${teacher.name} • ${teacher.email}` : teacher.email;
    fillGrades();
    render();
  }catch(e){
    $('error').textContent=e.message;
    $('error').hidden=false;
    $('recordsBody').innerHTML='';
  }finally{
    $('loading').hidden=true;
  }
}

$('loginBtn').addEventListener('click',async()=>{
  $('loginMsg').textContent='';
  try{
    await auth.signInWithEmailAndPassword($('email').value.trim(),$('password').value);
  }catch(e){
    $('loginMsg').textContent=e.message.replace('Firebase: ','').replace(/\s*\(auth\/.*\)\.?$/,'');
  }
});

$('password').addEventListener('keydown',e=>{if(e.key==='Enter')$('loginBtn').click()});
$('email').addEventListener('keydown',e=>{if(e.key==='Enter')$('loginBtn').click()});

$('logoutBtn').addEventListener('click',()=>auth.signOut());
$('refreshBtn').addEventListener('click',loadPortal);
$('statusFilter').addEventListener('change',render);
$('gradeFilter').addEventListener('change',render);
$('studentSearch').addEventListener('input',render);

auth.onAuthStateChanged(user=>{
  if(user){
    $('loginView').hidden=true;
    $('portalView').hidden=false;
    loadPortal();
  }else{
    $('loginView').hidden=false;
    $('portalView').hidden=true;
    records=[];
  }
});
