// Disable right-click and dev tools
  document.addEventListener('contextmenu', event => event.preventDefault());
  document.addEventListener('keydown', function (event) {
    if (
      event.ctrlKey && (
        event.key === 'u' || event.key === 's' || event.key === 'c' || 
        event.key === 'v' || event.key === 'x' || event.key === 'i' || event.key === 'j'
      )
    ) {
      event.preventDefault();
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'i') {
      event.preventDefault();
    }
    if (event.key === 'F12') {
      event.preventDefault();
    }
  });

/* ---------- Firebase Configuration ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyDlX9t7jG5dm2t3XoPts2EAPZ3VBnxxBjI",
  authDomain: "libraryzoneparent-36d5a.firebaseapp.com",
  projectId: "libraryzoneparent-36d5a",
  storageBucket: "libraryzoneparent-36d5a.firebasestorage.app",
  messagingSenderId: "906159197620",
  appId: "1:906159197620:web:04b70b5f426e462a4936e1",
  measurementId: "G-3S0RCHLZJV"
};

// Separate Firebase project used only for parent borrowing records.
// Existing students/books/history Local Storage remains unchanged.
let parentDb = null;
let parentAuth = null;
let parentFirebaseReady = false;
let parentFirebaseInitError = null;
try {
  if (typeof firebase === 'undefined' || !firebase.auth) {
    throw new Error('Firebase Authentication SDK did not load.');
  }
  const existingParentApp = firebase.apps && firebase.apps.find(a => a.name === 'libraryzone-parent');
  const parentFirebaseApp = existingParentApp || firebase.initializeApp(firebaseConfig, 'libraryzone-parent');
  parentDb = firebase.firestore(parentFirebaseApp);
  parentAuth = firebase.auth(parentFirebaseApp);
  parentFirebaseReady = true;
} catch (e) {
  parentFirebaseInitError = e;
  console.error('Parent Firestore initialization failed:', e);
}

function parentFirestoreErrorText(e) {
  const code = e && e.code ? ` [${e.code}]` : '';
  return `${e && e.message ? e.message : 'Unknown Firestore error'}${code}`;
}

/* ---------- License logic ---------- */
const LICENSE_LS = 'lib_license_v_firebase';
const APP_SECRET = 'LIB2025SECRET_FIREBASE';
const MSG_SHOW_MS = 5000;

function showLicenseModal(show){
  document.getElementById('licenseModal').style.display = show ? 'flex' : 'none';
  document.getElementById('lockedOverlay').style.display = show ? 'block' : 'none';
}

/* ---------- Generic transient message helper ---------- */
let msgBoxTimeout = null;
function showMsgBox(title, body, level = 'info') {
  const box = document.getElementById('msgBox');
  const t = document.getElementById('msgBoxTitle');
  const b = document.getElementById('msgBoxBody');
  box.classList.remove('info','error');
  box.classList.add(level === 'error' ? 'error' : 'info');
  t.textContent = title || '';
  b.textContent = body || '';
  const sr = document.getElementById('srLive');
  if (sr) sr.textContent = `${title}: ${body}`;
  if (level === 'error') playErrorSound();
  else playSuccessSound();
  box.classList.remove('show');
  void box.offsetWidth;
  box.classList.add('show');
  if (msgBoxTimeout) clearTimeout(msgBoxTimeout);
  msgBoxTimeout = setTimeout(hideMsgBox, MSG_SHOW_MS);
}
function hideMsgBox() {
  const box = document.getElementById('msgBox');
  if(!box) return;
  box.classList.remove('show');
  setTimeout(()=>{ box.style.display = 'none'; }, 200);
  if (msgBoxTimeout) { clearTimeout(msgBoxTimeout); msgBoxTimeout = null; }
}

function transientText(elId, text, opts = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text;
  const sr = document.getElementById('srLive');
  if (sr) sr.textContent = text;
  if (el.__transientTimer) clearTimeout(el.__transientTimer);
  el.__transientTimer = setTimeout(()=>{ el.textContent = ''; el.__transientTimer = null; }, opts.duration || MSG_SHOW_MS);
}

/* ---------- Demo License Validation ---------- */
async function validateLicenseOnline(){
  const school = document.getElementById('schoolCode').value.trim();
  const key = document.getElementById('licenseKey').value.trim().toUpperCase();
  
  if(!school || !key){ 
    transientText('licenseMsg', 'School code and license key required'); 
    playErrorSound();
    return; 
  }
  
  // Show loading state
  const spinner = document.getElementById('activateSpinner');
  const text = document.getElementById('activateText');
  const btn = document.getElementById('activateBtn');
  
  spinner.style.display = 'inline-block';
  text.textContent = 'Verifying...';
  btn.disabled = true;
  
  transientText('licenseMsg', 'Checking license...');
  
  // Demo validation - accept any key for demo purposes
  setTimeout(() => {
    saveValidLicense(school, key);
    transientText('licenseMsg', 'License verified successfully!');
    playSuccessSound();
    setTimeout(() => {
      showLicenseModal(false);
      initAfterLicense();
      refreshPage();
    }, 1000);
    
    // Reset button state
    spinner.style.display = 'none';
    text.textContent = 'Activate';
    btn.disabled = false;
  }, 1500);
}

function saveValidLicense(schoolCode, licenseKey){
  localStorage.setItem(LICENSE_LS, JSON.stringify({ 
    schoolCode: schoolCode.trim().toUpperCase(), 
    licenseKey: licenseKey.trim().toUpperCase(), 
    activatedAt: new Date().toISOString(),
    lastVerified: new Date().toISOString()
  }));
}

function clearLicense(){
  localStorage.removeItem(LICENSE_LS);
  transientText('licenseMsg', 'Saved license cleared.');
  showLicenseModal(true);
}

async function checkStoredLicense() {
  const stored = localStorage.getItem(LICENSE_LS);
  if (!stored) {
    showLicenseModal(true);
    return false;
  }
  
  try {
    const parsed = JSON.parse(stored);
    showLicenseModal(false);
    return true;
  } catch (e) {
    localStorage.removeItem(LICENSE_LS);
    showLicenseModal(true);
    return false;
  }
}

function isLicensed(){
  try { 
    const s = JSON.parse(localStorage.getItem(LICENSE_LS) || 'null'); 
    return !!(s && s.schoolCode && s.licenseKey); 
  } catch(e) { 
    return false; 
  }
}

function guarded(fn){
  if(!isLicensed()){ 
    showMsgBox('License Required', 'This feature requires a valid license. Please activate your license first.', 'error');
    showLicenseModal(true); 
    return; 
  }
  return fn();
}

/* Demo key generation */
async function deriveKeyFromSchool(schoolCode){
  const data = new TextEncoder().encode((schoolCode || '').trim().toUpperCase() + ':' + APP_SECRET);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const short = hex.slice(0,16).toUpperCase();
  return short.match(/.{1,4}/g).join('-');
}

async function demoGenerate(){
  const school = document.getElementById('schoolCode').value.trim() || 'DEMO';
  const k = await deriveKeyFromSchool(school);
  document.getElementById('licenseKey').value = k;
  transientText('licenseMsg', 'Demo key generated (for testing only)');
}

/* ---------- Storage and models ---------- */
const LS_KEYS = {
  STUDENTS: 'lib_students_final',
  BOOKS: 'lib_books_final',
  HISTORY: 'lib_history_final',
  ADMIN: 'lib_admin_final',
  LOGGED_STUDENT: 'lib_logged_student_final',
  LOGGED_ADMIN: 'lib_logged_admin_final'
};

/* ---------- PostgreSQL API storage ----------
   PostgreSQL is now the authoritative database for library data.
   Local Storage is retained only as a fast/offline cache for the UI and session state.
*/
const LZ_API_BASE = 'https://libraryzone-api.onrender.com';
const POSTGRES_KEYS = new Set([LS_KEYS.STUDENTS, LS_KEYS.BOOKS, LS_KEYS.HISTORY, LS_KEYS.ADMIN, 'libraryzone_librarian_card']);
let postgresReady = false;
let postgresLoadPromise = null;

async function postgresRequest(path, options={}) {
  const res = await fetch(`${LZ_API_BASE}/api${path}`, {
    ...options,
    headers: {'Content-Type':'application/json', ...(options.headers||{})}
  });
  let body = null;
  try { body = await res.json(); } catch(_) {}
  if (!res.ok) throw new Error((body && body.error) || `API request failed (${res.status})`);
  return body;
}

async function loadPostgresData() {
  if (postgresLoadPromise) return postgresLoadPromise;
  postgresLoadPromise = (async()=>{
    try {
      const data = await postgresRequest('/data');
      Object.entries(data || {}).forEach(([key,val])=>{
        if (POSTGRES_KEYS.has(key)) localStorage.setItem(key, JSON.stringify(val));
      });
      postgresReady = true;
      const status = document.getElementById('dbStatus'); if(status){ status.textContent='Database: PostgreSQL connected'; status.style.color='var(--ok)'; }
      console.log('Library Zone: PostgreSQL connected.');
      return true;
    } catch(e) {
      postgresReady = false;
      const status = document.getElementById('dbStatus'); if(status){ status.textContent='Database: offline / local cache'; status.style.color='var(--danger)'; }
      console.error('Library Zone PostgreSQL connection failed:', e);
      showMsgBox('Database Connection', `PostgreSQL could not be reached. The app will use its local cache until the server is available. ${e.message}`, 'error');
      return false;
    }
  })();
  return postgresLoadPromise;
}

function persistPostgresData(key, val) {
  if (!POSTGRES_KEYS.has(key)) return Promise.resolve(false);
  return postgresRequest(`/data/${encodeURIComponent(key)}`, {method:'PUT', body:JSON.stringify({value:val})})
    .then(()=>{ postgresReady = true; return true; })
    .catch(e=>{ postgresReady = false; console.error(`PostgreSQL save failed for ${key}:`, e); throw e; });
}

function save(key,val){
  localStorage.setItem(key, JSON.stringify(val));
  return persistPostgresData(key, val);
}
function load(key,fallback){ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }

function getStudents(){ return load(LS_KEYS.STUDENTS, []); }
function getBooks(){ return load(LS_KEYS.BOOKS, []); }
function getHistory(){ return load(LS_KEYS.HISTORY, []); }
function getAdminConfig(){ return load(LS_KEYS.ADMIN, { 
  maxBooks:3, maxDays:14, weeklyFee:5.00, parentWeeklyFee:5.00, adminPassword:'libadmin', adminId: 'ADMINISTRATOR_LOGIN',
  levelColors: { '1':'#efefef','2':'#ffd6a5','3':'#ffd6d6','4':'#d6eaff','5':'#d6ffd9','6':'#f0d6ff','7':'#fff0d6','8':'#d6f0ff','9':'#f8d6d6','10':'#e6ffd6' }
}); }

function setStudents(v){ save(LS_KEYS.STUDENTS, v); renderStudentList(); updateStatistics(); }
function setBooks(v){ save(LS_KEYS.BOOKS, v); renderBookList(); updateStatistics(); }
function setHistory(v){ save(LS_KEYS.HISTORY, v); renderHistory(); updateStatistics(); }
function setAdminConfig(v){ save(LS_KEYS.ADMIN, v); loadAdminPanel(); }

/* ---------- Enhanced Sound Functions ---------- */
function playSuccessSound(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    
    // Beautiful success melody - C major arpeggio with harmonics
    const frequencies = [
      { freq: 523.25, start: 0, duration: 0.15 },     // C5
      { freq: 659.25, start: 0.08, duration: 0.15 },  // E5
      { freq: 783.99, start: 0.16, duration: 0.15 },  // G5
      { freq: 1046.50, start: 0.24, duration: 0.20 }  // C6
    ];
    
    frequencies.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.start);
      
      // Smooth envelope
      gain.gain.setValueAtTime(0, now + note.start);
      gain.gain.linearRampToValueAtTime(0.12, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration);
    });
    
    // Add a subtle bell-like harmonic
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(1568, now); // High C
    bellGain.gain.setValueAtTime(0, now);
    bellGain.gain.linearRampToValueAtTime(0.03, now + 0.01);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    bell.connect(bellGain);
    bellGain.connect(ctx.destination);
    bell.start(now);
    bell.stop(now + 0.45);
    
  } catch(e){ console.warn('Audio not available', e); }
}

function playErrorSound(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // More pleasant error sound - descending minor chord
    const frequencies = [
      { freq: 440, start: 0, duration: 0.2 },      // A4
      { freq: 349.23, start: 0.1, duration: 0.2 }, // F4
      { freq: 293.66, start: 0.2, duration: 0.25 } // D4
    ];
    
    frequencies.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle'; // Softer than sawtooth
      osc.frequency.setValueAtTime(note.freq, now + note.start);
      
      gain.gain.setValueAtTime(0, now + note.start);
      gain.gain.linearRampToValueAtTime(0.08, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration);
    });
    
  } catch(e){ console.warn('Error sound not available', e); }
}

function playNotifySound(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    
    // Pleasant notification chime - perfect fifth
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);   // A5
    osc2.frequency.setValueAtTime(1318.51, now); // E6
    
    [gain1, gain2].forEach(gain => {
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    });
    
    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(ctx.destination);
    gain2.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
    
  } catch(e){ console.warn('Audio not available', e); }
}

/* ---------- Page Refresh Function ---------- */
function refreshPage() {
  setTimeout(() => {
    window.location.reload();
  }, 800); // Slightly shorter delay for better UX
}

/* ---------- Statistics Functions ---------- */
function updateStatistics() {
  if (!isAdminSession()) return;
  
  const books = getBooks();
  const students = getStudents();
  const history = getHistory();
  
  // Calculate borrow counts for each book
  books.forEach(book => {
    book.borrowCount = history.filter(h => h.barcode === book.barcode).length;
  });
  
  // Update statistics display
  document.getElementById('totalBorrows').textContent = history.length;
  document.getElementById('activeBorrows').textContent = history.filter(h => !h.returnDate).length;
  document.getElementById('totalBooks').textContent = books.length;
  document.getElementById('totalStudents').textContent = students.length;
  
  // Save updated books with borrow counts
  save(LS_KEYS.BOOKS, books);
}

function showTopBooks() {
  const books = getBooks();
  const history = getHistory();
  
  // Calculate borrow counts
  const bookStats = books.map(book => ({
    ...book,
    borrowCount: history.filter(h => h.barcode === book.barcode).length
  })).sort((a, b) => b.borrowCount - a.borrowCount).slice(0, 10);
  
  let html = '<h3 style="margin-top:0">📚 Most Borrowed Books</h3>';
  html += '<table><thead><tr><th>Rank</th><th>Title</th><th>Author</th><th class="right">Times Borrowed</th></tr></thead><tbody>';
  
  bookStats.forEach((book, index) => {
    html += `<tr>
      <td class="small">#${index + 1}</td>
      <td>${book.title}</td>
      <td class="small">${book.author || ''}</td>
      <td class="right small"><strong>${book.borrowCount}</strong></td>
    </tr>`;
  });
  
  html += '</tbody></table>';
  document.getElementById('statisticsContent').innerHTML = html;
}

function showTopReaders() {
  const students = getStudents();
  const history = getHistory();
  const books = getBooks();
  
  // Calculate reading stats for each student
  const studentStats = students.map(student => {
    const studentHistory = history.filter(h => h.studentId === student.studentId && h.returnDate);
    const totalBooks = studentHistory.length;
    const totalPages = studentHistory.reduce((sum, h) => {
      const book = books.find(b => b.barcode === h.barcode);
      return sum + (book ? book.pages : 0);
    }, 0);
    
    return {
      ...student,
      totalBooks,
      totalPages
    };
  }).sort((a, b) => b.totalBooks - a.totalBooks).slice(0, 10);
  
  let html = '<h3 style="margin-top:0">🏆 Top Readers</h3>';
  html += '<table><thead><tr><th>Rank</th><th>Student</th><th class="right">Books Read</th><th class="right">Pages Read</th></tr></thead><tbody>';
  
  studentStats.forEach((student, index) => {
    html += `<tr>
      <td class="small">#${index + 1}</td>
      <td>${student.name}<div class="small">${student.studentId}</div></td>
      <td class="right small"><strong>${student.totalBooks}</strong></td>
      <td class="right small">${student.totalPages.toLocaleString()}</td>
    </tr>`;
  });
  
  html += '</tbody></table>';
  document.getElementById('statisticsContent').innerHTML = html;
}

/* ---------- Role & admin session helpers ---------- */
function isAdminSession(){ return !!localStorage.getItem(LS_KEYS.LOGGED_ADMIN); }
function setAdminSession(){ localStorage.setItem(LS_KEYS.LOGGED_ADMIN, '1'); showHeaderRoleButtons(true); loadAdminPanel(); updateStatistics(); }
function clearAdminSession(){ localStorage.removeItem(LS_KEYS.LOGGED_ADMIN); showHeaderRoleButtons(false); loadAdminPanel(); }

function showHeaderRoleButtons(show){
  const el = document.getElementById('roleBtnsHeader');
  if(show) el.style.display = 'flex'; else el.style.display = 'none';
}

function setViewRole(role){
  document.getElementById('btnStudentView').classList.toggle('active', role === 'student');
  document.getElementById('btnAdminView').classList.toggle('active', role === 'admin');
  applyViewRole(role);
}

function applyViewRole(role){
  const isStudent = role === 'student';
  const isAdmin = role === 'admin';
  
  document.getElementById('statisticsCard').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('quickAddCard').style.display = isStudent ? 'none' : 'block';
  document.getElementById('bulkImportCard').style.display = isStudent ? 'none' : 'block';
  const localStorageCard = document.getElementById('localStorageCard');
  if (localStorageCard) localStorageCard.style.display = isAdmin ? 'block' : 'none';
  document.getElementById('historyCard').style.display = isStudent ? 'none' : 'block';
  document.getElementById('studentsCard').style.display = isStudent ? 'none' : 'block';
  document.getElementById('booksCard').style.display = isStudent ? 'none' : 'block';
  document.getElementById('returnBtn').style.display = 'none';
  
  if (isAdmin) {
    updateStatistics();
  }
  
  renderMyBorrows();
  renderStudentHistoryBox();
}

function gotoreturnbook(){
  window.location=("return.html")
}

/* ---------- Welcome banner helpers ---------- */
function setWelcome(name){
  const title = document.getElementById('welcomeTitle');
  const subtitle = document.getElementById('welcomeSubtitle');
  if(title) title.textContent = `Welcome ${name}`;
  if(subtitle) subtitle.textContent = `You are logged in`;
}
function clearWelcome(){
  const title = document.getElementById('welcomeTitle');
  const subtitle = document.getElementById('welcomeSubtitle');
  if(title) title.textContent = '';
  if(subtitle) subtitle.textContent = '';
}

/* ---------- Language switcher ---------- */
const LZ_LANGUAGE_KEY = 'libraryzone_language';
const LZ_I18N = {
  'en-US': {
    'Library Zone':'Library Zone','Student view':'Student view','Administrator':'Administrator','Return Books':'Return Books','Logout':'Logout',
    'Search books by title, author, barcode, keywords or location...':'Search books by title, author, barcode, keywords or location...','Search results':'Search results','Close':'Close',
    'Library Statistics':'Library Statistics','Total Borrows':'Total Borrows','Active Borrows':'Active Borrows','Total Books':'Total Books','Total Students':'Total Students',
    'Most Borrowed Books':'Most Borrowed Books','Top Readers':'Top Readers','Borrow / Return Book':'Borrow / Return Book','Use the Borrow Book button to open a borrow dialog. Returns can be handled from the Return dialog or student history.':'Use the Borrow Book button to open a borrow dialog. Returns can be handled from the Return dialog or student history.',
    'Borrow Book':'Borrow Book','Return Book':'Return Book','View Late Books':'View Late Books','Quick Add Book':'Quick Add Book','Barcode':'Barcode','Title':'Title','Author':'Author','Pages':'Pages','Level':'Level','Location':'Location','Keywords':'Keywords','Add Book':'Add Book','Seed Sample':'Seed Sample',
    'Bulk Import from Excel':'Bulk Import from Excel','Students Import':'Students Import','Books Import':'Books Import','Local Cache Backup (admin only)':'Local Cache Backup (admin only)','Local Cache Data':'Local Cache Data','Export Local Storage':'Export Local Storage','Import Local Storage':'Import Local Storage','Reload Cached Data':'Reload Cached Data',
    'History / Stats (admin only)':'History / Stats (admin only)','Reading Stats & History':'Reading Stats & History','Show All History':'Show All History','Student Stats':'Student Stats','Student panel':'Student panel','My Reading':'My Reading','My history & pages':'My history & pages','Search books':'Search books',
    'Admin login / panel':'Admin login / panel','Admin ID':'Admin ID','Admin Password':'Admin Password','Login':'Login','Max books per student':'Max books per student','Max borrow days':'Max borrow days','Weekly overdue fee for students (currency)':'Weekly overdue fee for students (currency)','Weekly borrowing fee for parents (currency)':'Weekly borrowing fee for parents (currency)','Admin password (change)':'Admin password (change)','Level Colors':'Level Colors','Choose a color for each level (1-10). Colors appear as level badges in lists and search results.':'Choose a color for each level (1-10). Colors appear as level badges in lists and search results.',
    'Quick student login':'Quick student login','Type a student ID here to sign that student in (for testing or manual operations)':'Type a student ID here to sign that student in (for testing or manual operations)','Login student':'Login student','Quick add student':'Quick add student','Add a single student directly without importing an Excel file.':'Add a single student directly without importing an Excel file.','Student':'Student','Parent':'Parent','Add student':'Add student','Clear':'Clear','Maintenance':'Maintenance','Dangerous actions for administrators. Each button requires confirmation.':'Dangerous actions for administrators. Each button requires confirmation.','Clear borrow history':'Clear borrow history','Clear student list':'Clear student list','Clear book list':'Clear book list','Save Settings':'Save Settings','Logout Admin':'Logout Admin','Students':'Students','Books':'Books','Show Available':'Show Available','filter by id or name':'filter by id or name','filter title, author, barcode, keywords or location':'filter title, author, barcode, keywords or location',
    'Borrow Records':'Borrow Records','Borrow Modal':'Borrow Modal','Scan or type the book barcode below and click Borrow':'Scan or type the book barcode below and click Borrow','Book Barcode':'Book Barcode','Borrow':'Borrow','Cancel':'Cancel','Return Modal':'Return Modal','Scan or type the book barcode below and click Return':'Scan or type the book barcode below and click Return','Return':'Return','Student Registration Modal':'Student Registration Modal','Register Student':'Register Student','Student ID':'Student ID','Full Name':'Full Name','Type':'Type','Weekly Borrow Fee':'Weekly Borrow Fee','Register':'Register','Administrator sign-in':'Administrator sign-in','Enter administrator password to unlock admin mode.':'Enter administrator password to unlock admin mode.','OK':'OK','Dismiss':'Dismiss',
    'Book borrowed':'Book borrowed','Student not found':'Student not found','Parent fee/week':'Parent fee/week','Parent email (portal)':'Parent email (portal)','Portal password (new parent)':'Portal password (new parent)','Portal':'Portal','Debts':'Debts','Borrows':'Borrows','Edit':'Edit','Delete':'Delete','Books list':'Books list','Recommended headers: studentId, name, grade':'Recommended headers: studentId, name, grade','Recommended headers: barcode, title, author, pages, level (1-10), available, keywords, location (optional)':'Recommended headers: barcode, title, author, pages, level (1-10), available, keywords, location (optional)',
    'Language':'Language','Scan Librarian Card':'Scan Librarian Card','Librarian Card Access':'Librarian Card Access','Create or register a barcode card that can unlock Administrator mode without entering the administrator password.':'Create or register a barcode card that can unlock Administrator mode without entering the administrator password.','Librarian Card Code':'Librarian Card Code','Generate New Card':'Generate New Card','Scan/Register Existing Card':'Scan/Register Existing Card','Save Card Settings':'Save Card Settings','Print Librarian Card':'Print Librarian Card','Scan Librarian Card':'Scan Librarian Card','Use the librarian barcode scanner to scan the barcode on the librarian card. The scanner will enter the code automatically.':'Use the librarian barcode scanner to scan the barcode on the librarian card. The scanner will enter the code automatically.','Card code (manual fallback)':'Card code (manual fallback)','Use Code':'Use Code','Use Administrator Password':'Use Administrator Password'
  },
  'de-DE': {
    'Library Zone':'Bibliothekszone','Student view':'Schüleransicht','Administrator':'Administrator','Return Books':'Bücher zurückgeben','Logout':'Abmelden','Language':'Sprache',
    'Search books by title, author, barcode, keywords or location...':'Bücher nach Titel, Autor, Barcode, Stichwörtern oder Standort suchen...','Search results':'Suchergebnisse','Close':'Schließen',
    'Library Statistics':'Bibliotheksstatistik','Total Borrows':'Ausleihen insgesamt','Active Borrows':'Aktive Ausleihen','Total Books':'Bücher insgesamt','Total Students':'Schüler insgesamt','Most Borrowed Books':'Am häufigsten ausgeliehene Bücher','Top Readers':'Top-Leser',
    'Borrow / Return Book':'Bücher ausleihen / zurückgeben','Use the Borrow Book button to open a borrow dialog. Returns can be handled from the Return dialog or student history.':'Mit „Buch ausleihen“ das Ausleihfenster öffnen. Rückgaben können über das Rückgabefenster oder den Schülerverlauf bearbeitet werden.','Borrow Book':'Buch ausleihen','Return Book':'Buch zurückgeben','View Late Books':'Verspätete Bücher anzeigen','Quick Add Book':'Buch schnell hinzufügen','Barcode':'Barcode','Title':'Titel','Author':'Autor','Pages':'Seiten','Level':'Stufe','Location':'Standort','Keywords':'Stichwörter','Add Book':'Buch hinzufügen','Seed Sample':'Beispieldaten hinzufügen',
    'Bulk Import from Excel':'Massenimport aus Excel','Students Import':'Schülerimport','Books Import':'Bücherimport','Local Cache Backup (admin only)':'Local-Storage-Daten (nur Administrator)','Local Cache Data':'Local-Storage-Daten','Export Local Storage':'Local Storage exportieren','Import Local Storage':'Local Storage importieren','Reload Cached Data':'Gespeicherte Daten neu laden','History / Stats (admin only)':'Verlauf / Statistik (nur Administrator)','Reading Stats & History':'Lesestatistik & Verlauf','Show All History':'Gesamten Verlauf anzeigen','Student Stats':'Schülerstatistik','Student panel':'Schülerbereich','My Reading':'Meine Lektüre','My history & pages':'Mein Verlauf & Seiten','Search books':'Bücher suchen',
    'Admin login / panel':'Administrator-Anmeldung / Bereich','Admin ID':'Administrator-ID','Admin Password':'Administrator-Passwort','Login':'Anmelden','Max books per student':'Max. Bücher pro Schüler','Max borrow days':'Max. Ausleihtage','Weekly overdue fee for students (currency)':'Wöchentliche Verspätungsgebühr für Schüler (Währung)','Weekly borrowing fee for parents (currency)':'Wöchentliche Ausleihgebühr für Eltern (Währung)','Admin password (change)':'Administrator-Passwort (ändern)','Level Colors':'Stufenfarben','Choose a color for each level (1-10). Colors appear as level badges in lists and search results.':'Wählen Sie eine Farbe für jede Stufe (1–10). Die Farben erscheinen als Stufenmarkierungen in Listen und Suchergebnissen.',
    'Quick student login':'Schnellanmeldung für Schüler','Type a student ID here to sign that student in (for testing or manual operations)':'Geben Sie eine Schüler-ID ein, um diesen Schüler anzumelden (für Tests oder manuelle Vorgänge)','Login student':'Schüler anmelden','Quick add student':'Schüler schnell hinzufügen','Add a single student directly without importing an Excel file.':'Einen einzelnen Schüler hinzufügen, ohne eine Excel-Datei zu importieren.','Student':'Schüler','Parent':'Elternteil','Add student':'Schüler hinzufügen','Clear':'Leeren','Maintenance':'Wartung','Dangerous actions for administrators. Each button requires confirmation.':'Gefährliche Administratoraktionen. Jede Schaltfläche erfordert eine Bestätigung.','Clear borrow history':'Ausleihverlauf löschen','Clear student list':'Schülerliste löschen','Clear book list':'Buchliste löschen','Save Settings':'Einstellungen speichern','Logout Admin':'Administrator abmelden','Students':'Schüler','Books':'Bücher','Show Available':'Verfügbare anzeigen','filter by id or name':'nach ID oder Name filtern','filter title, author, barcode, keywords or location':'nach Titel, Autor, Barcode, Stichwörtern oder Standort filtern',
    'Borrow Records':'Ausleihdatensätze','Scan or type the book barcode below and click Borrow':'Barcode des Buches scannen oder eingeben und auf „Ausleihen“ klicken','Book Barcode':'Buch-Barcode','Borrow':'Ausleihen','Cancel':'Abbrechen','Scan or type the book barcode below and click Return':'Barcode des Buches scannen oder eingeben und auf „Zurückgeben“ klicken','Return':'Zurückgeben','Register Student':'Schüler registrieren','Student ID':'Schüler-ID','Full Name':'Vollständiger Name','Type':'Typ','Weekly Borrow Fee':'Wöchentliche Ausleihgebühr','Register':'Registrieren','Administrator sign-in':'Administrator-Anmeldung','Enter administrator password to unlock admin mode.':'Administrator-Passwort eingeben, um den Administratormodus zu entsperren.','OK':'OK','Dismiss':'Schließen','Book borrowed':'Buch ausgeliehen','Student not found':'Schüler nicht gefunden','Parent fee/week':'Elterngebühr/Woche','Parent email (portal)':'Eltern-E-Mail (Portal)','Portal password (new parent)':'Portal-Passwort (neues Elternkonto)','Portal':'Portal','Debts':'Schulden','Borrows':'Ausleihen','Edit':'Bearbeiten','Delete':'Löschen','Books list':'Bücherliste',
    'Recommended headers: studentId, name, grade':'Empfohlene Spalten: studentId, name, grade','Recommended headers: barcode, title, author, pages, level (1-10), available, keywords, location (optional)':'Empfohlene Spalten: barcode, title, author, pages, level (1–10), available, keywords, location (optional)','Scan Librarian Card':'Bibliotheksausweis scannen','Librarian Card Access':'Zugang mit Bibliotheksausweis','Create or register a barcode card that can unlock Administrator mode without entering the administrator password.':'Erstellen oder registrieren Sie den QR-Ausweis, mit dem der Administratormodus ohne Administrator-Passwort entsperrt werden kann.','Librarian Card Code':'Code des Bibliotheksausweises','Generate New Card':'Neuen Ausweis erstellen','Scan/Register Existing Card':'Vorhandenen Ausweis scannen','Save Card Settings':'Ausweis-Einstellungen speichern','Print Librarian Card':'Bibliotheksausweis drucken','Use the librarian barcode scanner to scan the barcode on the librarian card. The scanner will enter the code automatically.':'Verwenden Sie den USB- oder Bluetooth-Barcodescanner, um den Barcode des Bibliotheksausweises zu scannen.','Card code (manual fallback)':'Ausweiscode (manuelle Eingabe)','Use Code':'Code verwenden','Use Administrator Password':'Administrator-Passwort verwenden'
  },
  'es-MX': {
    'Library Zone':'Zona de Biblioteca','Student view':'Vista de estudiante','Administrator':'Administrador','Return Books':'Devolver libros','Logout':'Cerrar sesión','Language':'Idioma',
    'Search books by title, author, barcode, keywords or location...':'Buscar libros por título, autor, código de barras, palabras clave o ubicación...','Search results':'Resultados de búsqueda','Close':'Cerrar',
    'Library Statistics':'Estadísticas de la biblioteca','Total Borrows':'Total de préstamos','Active Borrows':'Préstamos activos','Total Books':'Total de libros','Total Students':'Total de estudiantes','Most Borrowed Books':'Libros más prestados','Top Readers':'Mejores lectores',
    'Borrow / Return Book':'Prestar / devolver libro','Use the Borrow Book button to open a borrow dialog. Returns can be handled from the Return dialog or student history.':'Usa el botón «Prestar libro» para abrir el diálogo de préstamo. Las devoluciones se pueden realizar desde el diálogo de devolución o el historial del estudiante.','Borrow Book':'Prestar libro','Return Book':'Devolver libro','View Late Books':'Ver libros atrasados','Quick Add Book':'Agregar libro rápido','Barcode':'Código de barras','Title':'Título','Author':'Autor','Pages':'Páginas','Level':'Nivel','Location':'Ubicación','Keywords':'Palabras clave','Add Book':'Agregar libro','Seed Sample':'Agregar ejemplos',
    'Bulk Import from Excel':'Importación masiva desde Excel','Students Import':'Importación de estudiantes','Books Import':'Importación de libros','Local Cache Backup (admin only)':'Herramientas de Local Storage (solo administrador)','Local Cache Data':'Datos de Local Storage','Export Local Storage':'Exportar Local Storage','Import Local Storage':'Importar Local Storage','Reload Cached Data':'Recargar datos guardados','History / Stats (admin only)':'Historial / estadísticas (solo administrador)','Reading Stats & History':'Estadísticas de lectura e historial','Show All History':'Mostrar todo el historial','Student Stats':'Estadísticas de estudiantes','Student panel':'Panel del estudiante','My Reading':'Mi lectura','My history & pages':'Mi historial y páginas','Search books':'Buscar libros',
    'Admin login / panel':'Acceso / panel del administrador','Admin ID':'ID del administrador','Admin Password':'Contraseña del administrador','Login':'Iniciar sesión','Max books per student':'Máximo de libros por estudiante','Max borrow days':'Máximo de días de préstamo','Weekly overdue fee for students (currency)':'Cargo semanal por atraso de estudiantes (moneda)','Weekly borrowing fee for parents (currency)':'Cargo semanal de préstamo para padres (moneda)','Admin password (change)':'Contraseña del administrador (cambiar)','Level Colors':'Colores de nivel','Choose a color for each level (1-10). Colors appear as level badges in lists and search results.':'Elige un color para cada nivel (1–10). Los colores aparecen como indicadores de nivel en las listas y resultados de búsqueda.',
    'Quick student login':'Inicio rápido de estudiante','Type a student ID here to sign that student in (for testing or manual operations)':'Escribe un ID de estudiante para iniciar sesión con ese estudiante (para pruebas u operaciones manuales)','Login student':'Iniciar estudiante','Quick add student':'Agregar estudiante rápido','Add a single student directly without importing an Excel file.':'Agrega un estudiante directamente sin importar un archivo de Excel.','Student':'Estudiante','Parent':'Padre/Madre','Add student':'Agregar estudiante','Clear':'Limpiar','Maintenance':'Mantenimiento','Dangerous actions for administrators. Each button requires confirmation.':'Acciones peligrosas para administradores. Cada botón requiere confirmación.','Clear borrow history':'Borrar historial de préstamos','Clear student list':'Borrar lista de estudiantes','Clear book list':'Borrar lista de libros','Save Settings':'Guardar configuración','Logout Admin':'Cerrar sesión de administrador','Students':'Estudiantes','Books':'Libros','Show Available':'Mostrar disponibles','filter by id or name':'filtrar por ID o nombre','filter title, author, barcode, keywords or location':'filtrar por título, autor, código de barras, palabras clave o ubicación',
    'Borrow Records':'Registros de préstamos','Scan or type the book barcode below and click Borrow':'Escanea o escribe el código de barras del libro y haz clic en «Prestar»','Book Barcode':'Código de barras del libro','Borrow':'Prestar','Cancel':'Cancelar','Scan or type the book barcode below and click Return':'Escanea o escribe el código de barras del libro y haz clic en «Devolver»','Return':'Devolver','Register Student':'Registrar estudiante','Student ID':'ID del estudiante','Full Name':'Nombre completo','Type':'Tipo','Weekly Borrow Fee':'Cargo semanal de préstamo','Register':'Registrar','Administrator sign-in':'Inicio de sesión del administrador','Enter administrator password to unlock admin mode.':'Escribe la contraseña del administrador para desbloquear el modo administrador.','OK':'Aceptar','Dismiss':'Cerrar','Book borrowed':'Libro prestado','Student not found':'Estudiante no encontrado','Parent fee/week':'Cargo de padre/semana','Parent email (portal)':'Correo del padre (portal)','Portal password (new parent)':'Contraseña del portal (nuevo padre/madre)','Portal':'Portal','Debts':'Adeudos','Borrows':'Préstamos','Edit':'Editar','Delete':'Eliminar','Books list':'Lista de libros',
    'Recommended headers: studentId, name, grade':'Encabezados recomendados: studentId, name, grade','Recommended headers: barcode, title, author, pages, level (1-10), available, keywords, location (optional)':'Encabezados recomendados: barcode, title, author, pages, level (1–10), available, keywords, location (opcional)','Scan Librarian Card':'Escanear tarjeta de bibliotecaria','Librarian Card Access':'Acceso con tarjeta de bibliotecaria','Create or register a barcode card that can unlock Administrator mode without entering the administrator password.':'Crea o registra la tarjeta con código de barras que puede desbloquear el modo administrador sin escribir la contraseña del administrador.','Librarian Card Code':'Código de la tarjeta de bibliotecaria','Generate New Card':'Generar nueva tarjeta','Scan/Register Existing Card':'Escanear tarjeta existente','Save Card Settings':'Guardar configuración de tarjeta','Print Librarian Card':'Imprimir tarjeta de bibliotecaria','Use the librarian barcode scanner to scan the barcode on the librarian card. The scanner will enter the code automatically.':'Usa el escáner de código de barras USB o Bluetooth para escanear la tarjeta de bibliotecaria.','Card code (manual fallback)':'Código de tarjeta (opción manual)','Use Code':'Usar código','Use Administrator Password':'Usar contraseña del administrador'
  }
};
const LZ_SOURCE = new WeakMap();
const LZ_ATTR_SOURCE = new WeakMap();
function lzLocale(){return localStorage.getItem(LZ_LANGUAGE_KEY)||'en-US';}
function lzDict(){return LZ_I18N[lzLocale()]||LZ_I18N['en-US'];}
function lzTranslateString(source){
  const dict=lzDict();
  if(Object.prototype.hasOwnProperty.call(dict,source)) return dict[source];
  // Common dynamic messages
  let m=source.match(/^Logged in: (.+) \((.+)\)$/); if(m){const p={ 'en-US':`Logged in: ${m[1]} (${m[2]})`, 'de-DE':`Angemeldet: ${m[1]} (${m[2]})`, 'es-MX':`Sesión iniciada: ${m[1]} (${m[2]})`}; return p[lzLocale()];}
  m=source.match(/^Student ID not found: (.+)$/); if(m){return lzLocale()==='de-DE'?`Schüler-ID nicht gefunden: ${m[1]}`:lzLocale()==='es-MX'?`ID de estudiante no encontrada: ${m[1]}`:source;}
  m=source.match(/^Student ID: (.+)$/); if(m){return lzLocale()==='de-DE'?`Schüler-ID: ${m[1]}`:lzLocale()==='es-MX'?`ID del estudiante: ${m[1]}`:source;}
  return source;
}
function lzTranslateTree(root=document.body){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[]; let n; while(n=walker.nextNode()) nodes.push(n);
  nodes.forEach(node=>{
    const p=node.parentElement; if(!p||['SCRIPT','STYLE','NOSCRIPT'].includes(p.tagName)) return;
    const source=LZ_SOURCE.has(node)?LZ_SOURCE.get(node):node.nodeValue.trim();
    if(!source) return; if(!LZ_SOURCE.has(node)) LZ_SOURCE.set(node,source);
    const leading=node.nodeValue.match(/^\s*/)?.[0]||'', trailing=node.nodeValue.match(/\s*$/)?.[0]||'';
    if(node.nodeValue.trim()===source){node.nodeValue=leading+lzTranslateString(source)+trailing;}
    else { const translated=lzTranslateString(source); node.nodeValue=leading+translated+trailing; }
  });
  document.querySelectorAll('input[placeholder],textarea[placeholder],input[aria-label],select[aria-label]').forEach(el=>{
    ['placeholder','aria-label'].forEach(attr=>{if(!el.hasAttribute(attr))return; const key=el.tagName+'|'+attr; let rec=LZ_ATTR_SOURCE.get(el); if(!rec){rec={};LZ_ATTR_SOURCE.set(el,rec);} if(!rec[attr])rec[attr]=el.getAttribute(attr); el.setAttribute(attr,lzTranslateString(rec[attr]));});
  });
}
function setLzLanguage(lang){if(!LZ_I18N[lang])lang='en-US';localStorage.setItem(LZ_LANGUAGE_KEY,lang);document.documentElement.lang=lang;const sel=document.getElementById('languageSelect');if(sel)sel.value=lang;lzTranslateTree(document.body);}
(function initLzLanguage(){const sel=document.getElementById('languageSelect');if(sel){sel.value=lzLocale();sel.addEventListener('change',e=>setLzLanguage(e.target.value));} document.documentElement.lang=lzLocale(); const mo=new MutationObserver(muts=>muts.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1||n.nodeType===3)lzTranslateTree(n.nodeType===1?n:document.body);})));mo.observe(document.body,{childList:true,subtree:true}); setTimeout(()=>lzTranslateTree(document.body),0);})();

/* ---------- Initialization & demo data ---------- */
function initDefaults(){
  const sampleStudents = [{ studentId:'STU1001', name:'Ana Gomez', grade:'9', role:'student', weeklyBorrowFee:0 }, { studentId:'STU1002', name:'Luis Martinez', grade:'10', role:'student', weeklyBorrowFee:0 }];
  const sampleBooks = [
    { barcode:'BK0001', title:'Fables for Life', author:'A. Writer', pages:120, level:'2', available:true, keywords:'fables,life,stories', location:'Shelf A1', borrowCount:0 },
    { barcode:'BK0002', title:'Chemistry Basics', author:'Dr. Chem', pages:210, level:'4', available:true, keywords:'chemistry,science', location:'Shelf B2', borrowCount:0 },
    { barcode:'BK0003', title:'Short Devotions', author:'M. Quiet', pages:64, level:'1', available:true, keywords:'devotions,prayers', location:'Shelf C1', borrowCount:0 }
  ];
  setStudents(sampleStudents); setBooks(sampleBooks); setHistory([]); setAdminConfig({ maxBooks:3, maxDays:14, weeklyFee:5.00, adminPassword:'libadmin', adminId:'ADMINISTRATOR_LOGIN',
    levelColors: { '1':'#efefef','2':'#ffd6a5','3':'#ffd6d6','4':'#d6eaff','5':'#d6ffd9','6':'#f0d6ff','7':'#fff0d6','8':'#d6f0ff','9':'#f8d6d6','10':'#e6ffd6' }
  });
  localStorage.removeItem(LS_KEYS.LOGGED_STUDENT); localStorage.removeItem(LS_KEYS.LOGGED_ADMIN);
  renderAll();
  showMsgBox('Demo Data Reset', 'Demo data has been reset successfully.', 'info');
  playSuccessSound();
  refreshPage();
}

/* ---------- UI helpers & renderers ---------- */
function renderAll(){ renderStudentList(); renderBookList(); renderHistory(); loadStudentUI(); loadAdminPanel(); renderStudentHistoryBox(); updateStatistics(); }
function formatDateISO(d){ return new Date(d).toLocaleDateString(lzLocale()); }
function nowISO(){ return new Date().toISOString(); }

/* ---------- Student login / register ---------- */
function studentLoginById(id){
  const s = getStudents().find(x=>x.studentId === id);
  if(!s){ showMsgBox('Student not found', `Student ID not found: ${id}`, 'error'); return false; }
  localStorage.setItem(LS_KEYS.LOGGED_STUDENT, JSON.stringify(s));
  transientText('borrowMsg', `Logged in: ${s.name} (${s.studentId})`);
  renderStudentList();
  renderMyBorrows();
  renderStudentHistoryBox();
  scheduleAutoLogout();
  setWelcome(s.name);
  const lb = document.getElementById('studentLogoutBtn');
  if(lb){ lb.style.display = 'inline-block'; }
  playSuccessSound();
  
  return true;
}
function logoutStudent(){
  localStorage.removeItem(LS_KEYS.LOGGED_STUDENT);
  transientText('borrowMsg','');
  renderMyBorrows();
  renderStudentHistoryBox();
  clearAutoLogoutTimer();
  clearWelcome();
  const lb = document.getElementById('studentLogoutBtn');
  if(lb){ lb.style.display = 'none'; }
  playSuccessSound();
  refreshPage();
}

function loadStudentUI(){ const logged = localStorage.getItem(LS_KEYS.LOGGED_STUDENT); const lb = document.getElementById('studentLogoutBtn'); if(logged){ const s = JSON.parse(logged); transientText('borrowMsg', `Logged in: ${s.name} (${s.studentId})`); setWelcome(s.name); if(lb){ lb.style.display = 'inline-block'; } } else { clearWelcome(); if(lb){ lb.style.display = 'none'; } } }

/* Register */
function openRegisterStudent(){ document.getElementById('modal').style.display='flex'; document.getElementById('reg_id').value=''; document.getElementById('reg_name').value=''; document.getElementById('reg_grade').value=''; document.getElementById('reg_role').value='student'; document.getElementById('reg_weekly_fee').value='0'; toggleRegistrationFee(); transientText('regMsg',''); }
function toggleRegistrationFee(){ const parent=document.getElementById('reg_role').value==='parent'; document.getElementById('reg_fee_label').style.display=parent?'block':'none'; document.getElementById('reg_weekly_fee').style.display=parent?'block':'none'; }
function closeModal(){ document.getElementById('modal').style.display='none'; }
function registerStudent(){ const id=document.getElementById('reg_id').value.trim(), name=document.getElementById('reg_name').value.trim(), grade=document.getElementById('reg_grade').value.trim(), role=document.getElementById('reg_role').value, weeklyBorrowFee=Math.max(0,Number(document.getElementById('reg_weekly_fee').value)||0); if(!id||!name){ transientText('regMsg','ID and name required'); playErrorSound(); return; } const students=getStudents(); if(students.some(x=>x.studentId===id)){ transientText('regMsg','Student ID already exists'); playErrorSound(); return; } students.push({ studentId:id, name, grade, role, weeklyBorrowFee: role==='parent'?weeklyBorrowFee:0 }); setStudents(students); transientText('regMsg','Registration saved.'); playSuccessSound(); setTimeout(()=>{closeModal();},700); }

/* ---------- Books ---------- */
function addBookFromUI(){
  const barcode = document.getElementById('book_barcode').value.trim();
  const title = document.getElementById('book_title').value.trim();
  const author = document.getElementById('book_author').value.trim();
  const pages = parseInt(document.getElementById('book_pages').value, 10);
  const level = document.getElementById('book_level').value;
  const keywords = (document.getElementById('book_keywords').value || '').trim();
  const location = (document.getElementById('book_location') && document.getElementById('book_location').value.trim()) || '';

  if(!barcode || !title || !author || !pages || pages <= 0){
    transientText('addBookMsg','Please complete book fields');
    playErrorSound();
    return;
  }
  const books = getBooks();
  if(books.some(b => b.barcode === barcode)){
    transientText('addBookMsg','Barcode already exists');
    playErrorSound();
    return;
  }
  books.push({ barcode, title, author, pages, level, available:true, keywords, location, borrowCount:0 });
  setBooks(books);
  transientText('addBookMsg','Book added.');
  document.getElementById('book_barcode').value = '';
  document.getElementById('book_title').value = '';
  document.getElementById('book_author').value = '';
  document.getElementById('book_pages').value = '';
  document.getElementById('book_keywords').value = '';
  if(document.getElementById('book_location')) document.getElementById('book_location').value = '';
  playSuccessSound();
  
}

function seedSampleBooks(){
  const books=getBooks();
  if(books.length>0 && !confirm('Add sample books alongside existing?')) return;
  const sample=[
    { barcode:'BK1001', title:'Stories of Courage', author:'L. Brave', pages:150, level:'2', available:true, keywords:'courage,stories', location:'Shelf A1', borrowCount:0 },
    { barcode:'BK1002', title:'Algebra Puzzles', author:'P. Numbers', pages:220, level:'4', available:true, keywords:'algebra,math,puzzles', location:'Shelf B2', borrowCount:0 },
    { barcode:'BK1003', title:'Short Prayers', author:'M. Quiet', pages:40, level:'1', available:true, keywords:'prayers,short', location:'Shelf C1', borrowCount:0 }
  ];
  setBooks(books.concat(sample));
  playSuccessSound();
  
}

/* ---------- Parent records ----------
   Parent borrow records are now stored in PostgreSQL through the normal history table.
   Firebase Authentication remains available for parent portal login.
*/
async function saveParentBorrowToFirestore(){ return true; }
async function updateParentBorrowInFirestore(){ return true; }
async function deleteParentBorrowFromFirestore(){ return true; }

/* ---------- Borrow & Return ---------- */
async function borrowSelectedBookFromModal(barcode){
  const logged = localStorage.getItem(LS_KEYS.LOGGED_STUDENT);
  if(!logged){ transientText('modalBorrowMsg','Student must be logged in to borrow.'); playErrorSound(); return; }
  if(!barcode){ transientText('modalBorrowMsg','Enter book barcode.'); playErrorSound(); return; }
  const loggedStudent = JSON.parse(logged);
  const student = getStudents().find(s => String(s.studentId) === String(loggedStudent.studentId)) || loggedStudent;
  const books = getBooks();
  const book = books.find(b => b.barcode === barcode);
  if(!book){ transientText('modalBorrowMsg','Book not found.'); playErrorSound(); return; }
  if(!book.available){
    showMsgBox('Book unavailable', `The book "${book.title || book.barcode}" is currently not available.`, 'error');
    return;
  }
  const history = getHistory();
  const admin = getAdminConfig();
  const activeBorrowCount = history.filter(h => h.studentId === student.studentId && !h.returnDate).length;

  if(activeBorrowCount >= admin.maxBooks){
    showMsgBox('Borrow limit reached', `You have reached the maximum allowed borrows (${admin.maxBooks}). Return a book before borrowing another.`, 'error');
    transientText('modalBorrowMsg', `Borrow limit reached (${admin.maxBooks}).`);
    return;
  }

  const txId = Date.now();
  history.push({ txId, studentId: student.studentId, barcode: book.barcode, borrowDate: new Date().toISOString(), returnDate: null, overdueFee: 0.0, borrowerRole: student.role || 'student', weeklyBorrowFee: Number(student.weeklyBorrowFee||0) });
  book.available = false;
  book.borrowCount = (book.borrowCount || 0) + 1;
  const parentTx = history[history.length - 1];
  setHistory(history);
  setBooks(books);
  if (String(student.role || 'student').toLowerCase() === 'parent') await saveParentBorrowToFirestore(parentTx, student, book);
  transientText('modalBorrowMsg', `Book borrowed: ${book.title} — ${student.name}. Due in ${admin.maxDays} days.`);
  renderAll();
  showNotification({ title: 'Book borrowed', message: `${student.name} borrowed "${book.title}"`, autoClose:true });
  renderMyBorrows(); renderStudentHistoryBox(); scheduleAutoLogout();
  playSuccessSound();
  refreshPage();
}

function returnSelectedBookFromModal(barcode){
  const logged=localStorage.getItem(LS_KEYS.LOGGED_STUDENT);
  if(!logged){ transientText('modalReturnMsg','Student must be logged in to return.'); playErrorSound(); return; }
  if(!barcode){ transientText('modalReturnMsg','Enter book barcode.'); playErrorSound(); return; }
  const student=JSON.parse(logged);
  const history=getHistory();
  const tx=history.find(h=>h.studentId===student.studentId && h.barcode===barcode && !h.returnDate);
  if(!tx){ transientText('modalReturnMsg','No active borrow record found for this student and barcode.'); playErrorSound(); return; }
  const admin=getAdminConfig();
  const borrowDate=new Date(tx.borrowDate);
  const diffDays=Math.floor((Date.now()-borrowDate.getTime())/(1000*60*60*24));
  let overdueFee=0;
  if(String(student.role || 'student').toLowerCase()==='parent'){
    const weeks=Math.max(1,Math.ceil(Math.max(0,diffDays)/7));
    overdueFee=+(weeks*Number(student.weeklyBorrowFee||0)).toFixed(2);
  } else if(diffDays>admin.maxDays){
    const extraDays=diffDays-admin.maxDays;
    const weeksOver=Math.ceil(extraDays/7);
    overdueFee=+(weeksOver*admin.weeklyFee).toFixed(2);
  }
  tx.returnDate=new Date().toISOString();
  tx.overdueFee=overdueFee;
  setHistory(history);
  if (String(student.role || 'student').toLowerCase() === 'parent') updateParentBorrowInFirestore(tx);
  const books=getBooks();
  const bk=books.find(b=>b.barcode===barcode);
  if(bk) bk.available=true;
  setBooks(books);
  transientText('modalReturnMsg',`Returned. Overdue fee: ${overdueFee.toFixed(2)}`);
  renderAll();
  showNotification({ title: 'Book returned', message: `${student.name} returned "${bk ? bk.title : barcode}"`, autoClose:true });
  renderMyBorrows(); renderStudentHistoryBox();
  playSuccessSound();
  refreshPage();
}

function openBorrowDialog(){
  const logged = localStorage.getItem(LS_KEYS.LOGGED_STUDENT);
  if(!logged){ transientText('borrowMsg','No student logged. Use student login to sign in.'); playErrorSound(); return; }
  document.getElementById('modalBorrowBarcode').value = '';
  transientText('modalBorrowMsg','');
  document.getElementById('borrowModal').style.display = 'flex';
  setTimeout(()=>{ document.getElementById('modalBorrowBarcode').focus(); }, 60);
}
function closeBorrowDialog(){ document.getElementById('borrowModal').style.display = 'none'; }

function openReturnDialog(){
  const logged = localStorage.getItem(LS_KEYS.LOGGED_STUDENT);
  if(!logged){ transientText('borrowMsg','No student logged. Use student login to sign in.'); playErrorSound(); return; }
  document.getElementById('modalReturnBarcode').value = '';
  transientText('modalReturnMsg','');
  document.getElementById('returnModal').style.display = 'flex';
  setTimeout(()=>{ document.getElementById('modalReturnBarcode').focus(); }, 60);
}
function closeReturnDialog(){ document.getElementById('returnModal').style.display = 'none'; }

/* ---------- Librarian barcode card access ---------- */
const LIBRARIAN_CARD_LS = 'libraryzone_librarian_card_v1';
function getLibrarianCardConfig(){
  try { return JSON.parse(localStorage.getItem(LIBRARIAN_CARD_LS) || 'null'); } catch(e){ return null; }
}
function saveLibrarianCardSettings(){
  const name=(document.getElementById('cfg_librarian_card_name')?.value || '').trim();
  const code=normalizeLibrarianCode(document.getElementById('cfg_librarian_card_code')?.value || '');
  const enabled=document.getElementById('cfg_librarian_card_enabled')?.checked !== false;
  if(!code){
    transientText('librarianCardSettingsMsg','Enter or scan the librarian card barcode first.');
    playErrorSound();
    return false;
  }
  localStorage.setItem(LIBRARIAN_CARD_LS, JSON.stringify({name,code,enabled,savedAt:new Date().toISOString()}));
  transientText('librarianCardSettingsMsg','Librarian card settings saved.');
  playSuccessSound();
  return true;
}
function normalizeLibrarianCode(v){ return String(v || '').trim().toUpperCase(); }
function unlockAdminWithLibrarianCard(){
  if(!isLicensed()){ showMsgBox('License Required','Activate the Library Zone license before using the librarian card.','error'); showLicenseModal(true); return; }
  setAdminSession();
  const modal=document.getElementById('adminPassModal'); if(modal) modal.style.display='none';
  const loginArea=document.getElementById('adminLoginArea'); if(loginArea) loginArea.style.display='none';
  const panel=document.getElementById('adminPanel'); if(panel) panel.style.display='block';
  const card=document.getElementById('adminCard'); if(card) card.style.display='block';
  showHeaderRoleButtons(true);
  setViewRole('admin');
  showNotification({title:'Administrator',message:'Librarian card accepted. Administrator mode unlocked.',autoClose:true});
  playSuccessSound();
}
function handleLibrarianBarcode(code){
  const cfg=getLibrarianCardConfig() || {};
  const expected=cfg.code || '';
  const scanned=normalizeLibrarianCode(code);
  if(cfg.enabled !== false && expected && scanned===normalizeLibrarianCode(expected)){ unlockAdminWithLibrarianCard(); return true; }
  return false;
}

/* ---------- Admin login & protection ---------- */
function adminLogin(){
  const id = document.getElementById('adminId').value.trim();
  const pass = document.getElementById('adminPass').value || '';
  const conf = getAdminConfig();
  const expectedId = conf.adminId || 'ADMINISTRATOR_LOGIN';
  const expectedPass = conf.adminPassword || 'libadmin';
  if(id === expectedId && pass === expectedPass){
    setAdminSession();
    document.getElementById('adminCard').style.display = 'block';
    document.getElementById('adminLoginArea').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    showNotification({ title: 'Admin', message: 'Administrator logged in', autoClose:true });
    showHeaderRoleButtons(true);
    setViewRole('admin');
    playSuccessSound();
    
  } else {
    showMsgBox('Login Failed', 'Wrong admin ID or password', 'error');
  }
}
function adminLogout(){
  clearAdminSession();
  document.getElementById('adminLoginArea').style.display = 'block';
  document.getElementById('adminPanel').style.display = 'none';
  showHeaderRoleButtons(false);
  setViewRole('student');
  playSuccessSound();
  
}

function loadAdminPanel(){ const authed = isAdminSession(); const panel = document.getElementById('adminPanel'); const loginArea = document.getElementById('adminLoginArea'); const card = document.getElementById('adminCard'); if(authed){ if(card) card.style.display='block'; loginArea.style.display='none'; panel.style.display='block'; const conf = getAdminConfig(); document.getElementById('cfg_max_books').value = conf.maxBooks; document.getElementById('cfg_max_days').value = conf.maxDays; document.getElementById('cfg_weekly_fee').value = conf.weeklyFee; document.getElementById('cfg_parent_weekly_fee').value = conf.parentWeeklyFee !== undefined ? conf.parentWeeklyFee : 5.00; document.getElementById('cfg_admin_password').value = conf.adminPassword; const lc=getLibrarianCardConfig() || {}; const codeInput=document.getElementById('cfg_librarian_card_code'); const nameInput=document.getElementById('cfg_librarian_card_name'); const enabledInput=document.getElementById('cfg_librarian_card_enabled'); if(codeInput) codeInput.value=lc.code||''; if(nameInput) nameInput.value=lc.name||''; if(enabledInput) enabledInput.checked=lc.enabled !== false; renderLevelColorPickers(); } else { if(card) card.style.display='block'; loginArea.style.display='block'; panel.style.display='none'; } }

function saveAdminSettings(){ 
  const maxBooks = parseInt(document.getElementById('cfg_max_books').value,10)||3; 
  const maxDays = parseInt(document.getElementById('cfg_max_days').value,10)||14; 
  const weeklyFee = parseFloat(document.getElementById('cfg_weekly_fee').value)||0; 
  const parentWeeklyFee = parseFloat(document.getElementById('cfg_parent_weekly_fee').value)||0;
  const adminPassword = document.getElementById('cfg_admin_password').value||getAdminConfig().adminPassword; 
  const conf = getAdminConfig(); 
  conf.maxBooks = maxBooks; conf.maxDays = maxDays; conf.weeklyFee = weeklyFee; conf.parentWeeklyFee = parentWeeklyFee; conf.adminPassword = adminPassword; 
  saveLevelColorsFromUI(conf);
  setAdminConfig(conf); 
  showMsgBox('Settings Saved', 'Admin settings have been saved successfully.', 'info');
  playSuccessSound();
  
}

/* ---------- Level color helpers ---------- */
function defaultColorForLevel(i){
  const defaults = { '1':'#efefef','2':'#ffd6a5','3':'#ffd6d6','4':'#d6eaff','5':'#d6ffd9','6':'#f0d6ff','7':'#fff0d6','8':'#d6f0ff','9':'#f8d6d6','10':'#e6ffd6' };
  return defaults[String(i)] || '#efefef';
}

function renderLevelColorPickers(){
  const wrap = document.getElementById('levelColorsWrap');
  if(!wrap) return;
  wrap.innerHTML = '';
  const conf = getAdminConfig();
  const colors = (conf.levelColors) ? conf.levelColors : {};
  for(let i=1;i<=10;i++){
    const val = colors[String(i)] || defaultColorForLevel(i);
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '6px';
    container.innerHTML = `<label style="font-size:12px;width:26px">L${i}</label><input type="color" data-level="${i}" value="${val}" />`;
    wrap.appendChild(container);
  }
}

function saveLevelColorsFromUI(confOverride){
  const conf = confOverride || getAdminConfig();
  conf.levelColors = conf.levelColors || {};
  const wrap = document.getElementById('levelColorsWrap');
  if(!wrap) return;
  wrap.querySelectorAll('input[type="color"]').forEach(inp=>{
    const lvl = inp.getAttribute('data-level');
    conf.levelColors[lvl] = inp.value;
  });
  setAdminConfig(conf);
  transientText('adminQuickStudentMsg','Level colors saved.');
}

/* ---------- Level badge rendering ---------- */
function levelBadge(level){
  const conf = getAdminConfig();
  const color = (conf.levelColors && conf.levelColors[String(level)]) ? conf.levelColors[String(level)] : defaultColorForLevel(level);
  const text = String(level);
  return `<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:${escapeHtml(color)};color:#000;font-size:12px;">${escapeHtml(text)}</span>`;
}

/* ---------- Lists & UI rendering ---------- */
function renderStudentList(){
  const container=document.getElementById('studentsList');
  if(!container) return;
  const searchEl=document.getElementById('searchStudent');
  const filter=searchEl ? String(searchEl.value||'').trim().toLowerCase() : '';
  const students=getStudents().filter(s=>{
    const sid=String(s.studentId||'').toLowerCase();
    const name=String(s.name||'').toLowerCase();
    return !filter || sid.includes(filter) || name.includes(filter);
  });
  if(students.length===0){ container.innerHTML='<div class="small">No students found</div>'; return; }
  let html='<table><thead><tr><th>ID</th><th>Name</th><th class="right">Grade</th><th>Type</th><th class="right">Weekly Fee</th><th>Actions</th></tr></thead><tbody>';
  students.forEach(s=>{
    const id=String(s.studentId||'');
    const role=String(s.role||'student').toLowerCase()==='parent'?'Parent':'Student';
    const fee=role==='Parent'?Number(s.weeklyBorrowFee||0).toFixed(2):'—';
    const safeId=escapeHtml(id);
    html += `<tr><td class="small">${safeId}</td><td>${escapeHtml(s.name)}</td><td class="right small">${escapeHtml(s.grade||'')}</td><td class="small"><span class="person-type ${role==='Parent'?'parent':'student'}">${role}</span></td><td class="right small">${fee}</td><td class="student-actions" data-student-id="${safeId}">
      <button type="button" class="smallbtn" data-action="edit">Edit</button>
      <button type="button" class="smallbtn" data-action="login">Login</button>
      <button type="button" class="smallbtn danger-btn" data-action="delete">Delete</button>
      <button type="button" class="smallbtn" data-action="debts">Debts</button>
      <button type="button" class="smallbtn" data-action="borrows">Borrows</button>
      ${role==='Parent'?'<button type="button" class="smallbtn parent-btn" data-action="portal">Portal</button>':''}
    </td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML=html;
  container.querySelectorAll('.student-actions').forEach(group=>{
    group.addEventListener('click',function(e){
      const btn=e.target.closest('button[data-action]');
      if(!btn || !group.contains(btn)) return;
      e.preventDefault(); e.stopPropagation();
      const id=String(group.getAttribute('data-student-id')||'');
      try{
        guarded(()=>{
          switch(btn.dataset.action){
            case 'edit': return editStudent(id);
            case 'login': return quickLogin(id);
            case 'delete': return deleteStudent(id);
            case 'debts': return showStudentDebts(id);
            case 'borrows': return openStudentBorrowEditor(id);
            case 'portal': return manageParentPortal(id);
          }
        });
      }catch(err){
        console.error('Library Zone student action failed:',err);
        showMsgBox('Action Failed',String(err&&err.message||err),'error');
      }
    });
  });
}
function editStudent(id){
  const students=getStudents(), s=students.find(x=>String(x.studentId)===String(id));
  if(!s)return;
  const name=prompt('Full name:',s.name||''); if(name===null)return;
  const grade=prompt('Grade:',s.grade||''); if(grade===null)return;
  const roleRaw=prompt('Type: student or parent',s.role==='parent'?'parent':'student'); if(roleRaw===null)return;
  const role=roleRaw.trim().toLowerCase()==='parent'?'parent':'student';
  let fee=role==='parent'?Number(prompt('Weekly borrow fee:',s.weeklyBorrowFee||0)):0;
  if(!Number.isFinite(fee)||fee<0) fee=0;
  s.name=name.trim()||s.name; s.grade=grade.trim(); s.role=role; s.weeklyBorrowFee=fee;
  save(LS_KEYS.STUDENTS,students); renderStudentList(); updateStatistics();
  showMsgBox('Student Updated','The student/parent information was saved.','info');
}
async function manageParentPortal(id){
  if(!isAdminSession()){showMsgBox('Administrator Required','Log in as administrator first.','error');return;}
  const students=getStudents(); const s=students.find(x=>String(x.studentId)===String(id));
  if(!s || String(s.role||'student').toLowerCase()!=='parent'){showMsgBox('Not a Parent','Only parent accounts can have a portal login.','error');return;}
  if(s.portalAuthUid){
    const email=s.portalEmail||prompt('Enter the parent portal email address to receive the password reset link:', '');
    if(!email)return;
    try{
      await parentAuth.sendPasswordResetEmail(email.trim().toLowerCase());
      s.portalEmail=email.trim().toLowerCase(); save(LS_KEYS.STUDENTS,students); renderStudentList();
      showMsgBox('Password Reset Sent','A password reset email was sent to the parent.','info');
    }catch(e){showMsgBox('Password Reset Failed',parentFirestoreErrorText(e),'error');}
    return;
  }
  const email=(prompt('Parent portal email address:',s.portalEmail||'')||'').trim().toLowerCase();
  if(!email){showMsgBox('Email Required','A real email address is required to create the parent portal account.','error');return;}
  const pw=prompt('Create a portal password (minimum 6 characters):','');
  if(!pw || pw.length<6){showMsgBox('Password Required','The portal password must contain at least 6 characters.','error');return;}
  try{
    const result=await createParentPortalAccount(s,pw,email);
    s.portalEmail=result.email; s.portalAuthUid=result.uid;
    save(LS_KEYS.STUDENTS,students); renderStudentList();
    // Attach the Firebase Auth UID to existing parent borrow records so the parent can see them securely in the portal.
    if(parentDb){
      const snap=await parentDb.collection(PARENT_BORROW_COLLECTION).where('parentId','==',String(s.studentId)).get();
      const writes=[]; snap.forEach(doc=>writes.push(doc.ref.set({parentUid:result.uid,portalEmail:result.email,updatedAt:new Date().toISOString()},{merge:true}))); if(writes.length) await Promise.all(writes);
    }
    showMsgBox('Portal Account Created',`Parent portal account created for ${s.name}. The parent can now sign in using the email and password you provided.`,'info');
  }catch(e){showMsgBox('Portal Account Failed',parentFirestoreErrorText(e),'error');}
}
function quickLogin(id){ studentLoginById(id); }
function deleteStudent(id){ const targetId=String(id); const students=getStudents(); const target=students.find(s=>String(s.studentId)===targetId); if(!target){showMsgBox('Not Found','The student/parent could not be found.','error');return;} const type=String(target.role||'student').toLowerCase()==='parent'?'parent':'student'; if(!confirm(`Delete ${type} "${target.name||targetId}"? This also removes their local history.`)) return; setStudents(students.filter(s=>String(s.studentId)!==targetId)); setHistory(getHistory().filter(h=>String(h.studentId)!==targetId)); renderAll(); playSuccessSound(); }

function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }); }

function renderBookList(){
  const container=document.getElementById('booksList');
  if(!container) return;
  const filter=document.getElementById('searchBook').value.trim().toLowerCase();
  const books=getBooks().filter(b=>{
    const kw = (b.keywords || '').toString().toLowerCase();
    const loc = (b.location || '').toString().toLowerCase();
    return !filter
      || b.barcode.toLowerCase().includes(filter)
      || b.title.toLowerCase().includes(filter)
      || (b.author && b.author.toLowerCase().includes(filter))
      || (kw && kw.includes(filter))
      || (loc && loc.includes(filter));
  });
  if(books.length===0){ container.innerHTML='<div class="small">No books found</div>'; return; }
  let html='<table><thead><tr><th>Barcode</th><th>Title</th><th>Author</th><th class="right">Pages</th><th class="right">Lvl</th><th>Keywords</th><th>Location</th><th class="right">Borrowed</th><th></th></tr></thead><tbody>';
  books.forEach(b=>{ 
    const keywordsText = b.keywords ? String(b.keywords) : ''; 
    const locText = b.location ? String(b.location) : '';
    const borrowCount = b.borrowCount || 0;
    html += `<tr><td class="small">${b.barcode}</td><td>${b.title}${b.available?'' : ' <span class="small danger">(borrowed)</span>'}</td><td class="small">${b.author||''}</td><td class="right small">${b.pages}</td><td class="right small">${levelBadge(b.level)}</td><td class="small">${escapeHtml(keywordsText)}</td><td class="small">${escapeHtml(locText)}</td><td class="right small"><span class="borrow-count">${borrowCount}x</span></td><td style="width:120px"><button class="smallbtn" onclick="guarded(()=>fillBorrowModal('${b.barcode}'))">Use</button> <button class="smallbtn" onclick="guarded(()=>deleteBook('${b.barcode}'))">Delete</button></td></tr>`; 
  });
  html += '</tbody></table>'; container.innerHTML = html;
}

function renderAvailableBooks(){
  const container=document.getElementById('booksList');
  if(!container) return;
  const books=getBooks().filter(b=>b.available);
  if(books.length===0){ container.innerHTML='<div class="small">No available books</div>'; return; }
  let html='<table><thead><tr><th>Barcode</th><th>Title</th><th>Author</th><th class="right">Pages</th><th class="right">Lvl</th><th>Keywords</th><th>Location</th><th></th></tr></thead><tbody>';
  books.forEach(b=>{ 
    const keywordsText = b.keywords ? String(b.keywords) : ''; 
    const locText = b.location ? String(b.location) : '';
    html += `<tr><td class="small">${b.barcode}</td><td>${b.title}</td><td class="small">${b.author||''}</td><td class="right small">${b.pages}</td><td class="right small">${levelBadge(b.level)}</td><td class="small">${escapeHtml(keywordsText)}</td><td class="small">${escapeHtml(locText)}</td><td style="width:120px"><button class="smallbtn" onclick="guarded(()=>fillBorrowModal('${b.barcode}'))">Use</button></td></tr>`; 
  });
  html += '</tbody></table>'; container.innerHTML = html;
}

function fillBorrowModal(bar){
  const logged = localStorage.getItem(LS_KEYS.LOGGED_STUDENT);
  if(!logged){ transientText('borrowMsg','No student logged. Sign in first.'); playErrorSound(); return; }
  openBorrowDialog();
  document.getElementById('modalBorrowBarcode').value = bar;
}
function deleteBook(bar){ if(!confirm('Delete book? This also removes its history.')) return; let books=getBooks(); books=books.filter(b=>b.barcode!==bar); setBooks(books); let history=getHistory(); history=history.filter(h=>h.barcode!==bar); setHistory(history); playSuccessSound();}


/* ---------- Administrator Student Borrow Editor ---------- */
function editorDateTime(value){
  if(!value) return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return '';
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function editorEscape(value){
  return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
let editingStudentBorrowId=null;

function openStudentBorrowEditor(studentId){
  if(!isAdminSession()){
    showMsgBox('Administrator Required','Log in as administrator to edit borrows.','error'); return;
  }
  const s=getStudents().find(x=>String(x.studentId)===String(studentId));
  if(!s){showMsgBox('Student Not Found','The selected student could not be found.','error');return;}
  editingStudentBorrowId=String(studentId);
  document.getElementById('studentBorrowEditorTitle').textContent=`Borrow Records — ${s.name||s.studentId}`;
  document.getElementById('studentBorrowEditorSubtitle').textContent=`Student ID: ${s.studentId}`;
  renderStudentBorrowEditor(studentId);
  document.getElementById('studentBorrowEditorModal').style.display='flex';
}

function closeStudentBorrowEditor(){
  editingStudentBorrowId=null;
  const m=document.getElementById('studentBorrowEditorModal');
  if(m)m.style.display='none';
}

function renderStudentBorrowEditor(studentId){
  const c=document.getElementById('studentBorrowEditorRows');
  if(!c)return;
  const history=getHistory().map((r,i)=>({r,i}))
    .filter(x=>String(x.r.studentId)===String(studentId))
    .sort((a,b)=>new Date(b.r.borrowDate)-new Date(a.r.borrowDate));
  const books=getBooks();
  if(!history.length){
    c.innerHTML='<div class="small" style="padding:12px">This student has no borrow records.</div>'; return;
  }
  c.innerHTML=history.map(x=>{
    const r=x.r,i=x.i,b=books.find(q=>String(q.barcode)===String(r.barcode));
    const title=b?(b.title||r.barcode):r.barcode,pages=b?Number(b.pages||0):0;
    return `<div class="borrow-edit-row" data-borrow-index="${i}">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <div><strong>${editorEscape(title)}</strong><div class="small">Barcode: ${editorEscape(r.barcode)}${pages?' • '+pages.toLocaleString()+' pages':''}</div></div>
        <span class="${r.returnDate?'ok':'danger'}">${r.returnDate?'Returned':'Currently borrowed'}</span>
      </div>
      <div class="borrow-edit-grid" style="margin-top:10px">
        <div><label>Borrowed date & time</label><input class="edit-borrow-date" type="datetime-local" value="${editorEscape(editorDateTime(r.borrowDate))}"></div>
        <div><label>Returned date & time</label><input class="edit-return-date" type="datetime-local" value="${editorEscape(editorDateTime(r.returnDate))}"></div>
        <div><label>Overdue fee</label><input class="edit-fee" type="number" min="0" step="0.01" value="${Number(r.overdueFee||0).toFixed(2)}"></div>
        <div><label>Fee paid</label><select class="edit-fee-paid"><option value="false" ${r.feePaid?'':'selected'}>Not paid</option><option value="true" ${r.feePaid?'selected':''}>Paid</option></select></div>
      </div>
      <div class="borrow-edit-actions">
        <button onclick="saveStudentBorrowEdit(${i})">Save Changes</button>
        <button class="borrow-edit-cancel" onclick="cancelStudentBorrowRecord(${i})">Cancel Book / Remove Record</button>
      </div>
    </div>`;
  }).join('');
}

function saveStudentBorrowEdit(i){
  if(!isAdminSession()){showMsgBox('Administrator Required','Administrator mode is required.','error');return;}
  const history=getHistory(),r=history[i];
  if(!r||String(r.studentId)!==String(editingStudentBorrowId)){showMsgBox('Record Not Found','The borrow record could not be found.','error');return;}
  const row=document.querySelector(`#studentBorrowEditorRows [data-borrow-index="${i}"]`);
  if(!row)return;
  const bv=row.querySelector('.edit-borrow-date').value,rv=row.querySelector('.edit-return-date').value;
  const fee=Number(row.querySelector('.edit-fee').value||0),paid=row.querySelector('.edit-fee-paid').value==='true';
  if(!bv){showMsgBox('Borrow Date Required','Please enter the borrowed date.','error');return;}
  const bd=new Date(bv),rd=rv?new Date(rv):null;
  if(Number.isNaN(bd.getTime())||(rd&&Number.isNaN(rd.getTime()))){showMsgBox('Invalid Date','Please enter valid dates.','error');return;}
  if(rd&&rd<bd){showMsgBox('Invalid Dates','Return date cannot be before borrow date.','error');return;}
  if(!Number.isFinite(fee)||fee<0){showMsgBox('Invalid Fee','Fee must be zero or greater.','error');return;}
  r.borrowDate=bd.toISOString(); r.returnDate=rd?rd.toISOString():null; r.overdueFee=Number(fee.toFixed(2)); r.feePaid=paid;
  setHistory(history);
  if (r.borrowerRole === 'parent') updateParentBorrowInFirestore(r);
  const books=getBooks(),b=books.find(q=>String(q.barcode)===String(r.barcode));
  if(b){b.available=!history.some(h=>String(h.barcode)===String(r.barcode)&&!h.returnDate);setBooks(books);}
  renderStudentBorrowEditor(editingStudentBorrowId); renderStudentHistoryBox(); renderHistory(); updateStatistics();
  showMsgBox('Borrow Updated','The borrow information was saved.','info');
}

function cancelStudentBorrowRecord(i){
  if(!isAdminSession()){showMsgBox('Administrator Required','Administrator mode is required.','error');return;}
  const history=getHistory(),r=history[i];
  if(!r||String(r.studentId)!==String(editingStudentBorrowId)){showMsgBox('Record Not Found','The borrow record could not be found.','error');return;}
  const books=getBooks(),b=books.find(q=>String(q.barcode)===String(r.barcode));
  const title=b?(b.title||r.barcode):r.barcode,pages=b?Number(b.pages||0):0;
  if(!confirm(`Remove "${title}" completely from this student's history?${r.returnDate&&pages?`\n\n${pages.toLocaleString()} pages will be removed from the pages-read calculation.`:''}\n\nThis cannot be undone.`))return;
  history.splice(i,1); setHistory(history);
  if (r.borrowerRole === 'parent') deleteParentBorrowFromFirestore(r);
  if(b){
    b.available=!history.some(h=>String(h.barcode)===String(r.barcode)&&!h.returnDate);
    b.borrowCount=history.filter(h=>String(h.barcode)===String(r.barcode)).length;
    setBooks(books);
  }
  renderStudentBorrowEditor(editingStudentBorrowId); renderStudentHistoryBox(); renderHistory(); updateStatistics();
  showMsgBox('Borrow Cancelled',`${title} was removed from the student's history${pages?` and ${pages.toLocaleString()} pages were removed from the pages-read calculation.`:'.'}`,'info');
}

/* ---------- History & Stats ---------- */
function renderHistory(){
  const historyArea = document.getElementById('historyArea');
  if(!historyArea) return;
  const history = getHistory().slice().sort((a,b)=> new Date(b.borrowDate)-new Date(a.borrowDate));
  const books = getBooks(); const students = getStudents();
  if(history.length===0){ historyArea.innerHTML='<div class="small">No history</div>'; return; }
  let html = '<table><thead><tr><th>Date</th><th>Student</th><th>Book</th><th>Author</th><th>Return</th><th class="right">Fee</th></tr></thead><tbody>';
  history.forEach(h=>{ const s = students.find(x=>x.studentId===h.studentId)||{name:h.studentId}; const b = books.find(x=>x.barcode===h.barcode)||{title:h.barcode,author:''}; html += `<tr><td class="small">${formatDateISO(h.borrowDate)}</td><td>${s.name}</td><td>${b.title}</td><td class="small">${b.author||''}</td><td class="small">${h.returnDate ? formatDateISO(h.returnDate) : '<em>not yet</em>'}</td><td class="right small">${(h.overdueFee||0).toFixed(2)}${h.feePaid? ' <span class="ok"> (paid)</span>':''}</td></tr>`; });
  html += '</tbody></table>'; historyArea.innerHTML = html;
}

function renderStudentStats(){
  const logged = localStorage.getItem(LS_KEYS.LOGGED_STUDENT);
  if(!logged){ showMsgBox('Login Required', 'Login as a student to view student stats', 'error'); return; }
  const s = JSON.parse(logged);
  const history = getHistory().filter(h=>h.studentId===s.studentId && h.returnDate);
  const books = getBooks();
  const year = new Date().getFullYear();
  const yearPages = history.filter(h => new Date(h.borrowDate).getFullYear() === year).reduce((sum,h)=>{ const b = books.find(x=>x.barcode===h.barcode); return sum + (b ? b.pages : 0); },0);
  const pagesByLevel = {};
  history.forEach(h=>{ const b = books.find(x=>x.barcode===h.barcode); if(!b) return; pagesByLevel[b.level] = (pagesByLevel[b.level]||0) + b.pages; });
  let html = `<div class="license-view">Student: <strong>${s.name}</strong><br>Pages read this year (${year}): <strong>${yearPages}</strong></div>`;
  html += '<div style="margin-top:8px;"><strong>Pages by level</strong><div class="small">';
  for(const lvl in pagesByLevel) html += `Level ${lvl}: ${pagesByLevel[lvl]} pages<br>`;
  html += '</div></div>';
  document.getElementById('historyArea').innerHTML = html;
}

/* ---------- Late books & current fee ---------- */
function daysBetween(startISO, endDate = new Date()){
  const s = new Date(startISO); const diff = endDate.getTime() - s.getTime(); return Math.floor(diff / (1000*60*60*24));
}
function computeCurrentFee(tx){
  const admin = getAdminConfig();
  const student = getStudents().find(s=>String(s.studentId)===String(tx.studentId));
  const borrowerRole = tx.borrowerRole || (student && student.role) || 'student';
  const parentWeeklyFee = tx.weeklyBorrowFee !== undefined ? Number(tx.weeklyBorrowFee||0) : Number(student && student.weeklyBorrowFee||0);
  if(borrowerRole==='parent'){
    const end = tx.returnDate ? new Date(tx.returnDate) : new Date();
    const daysBorrowed = Math.max(0, daysBetween(tx.borrowDate, end));
    const weeks = Math.max(1, Math.ceil(daysBorrowed / 7));
    return +(weeks * parentWeeklyFee).toFixed(2);
  }
  if(tx.returnDate) return +(tx.overdueFee||0);
  const daysBorrowed = daysBetween(tx.borrowDate, new Date());
  if(daysBorrowed <= admin.maxDays) return 0;
  const extraDays = daysBorrowed - admin.maxDays;
  const weeksOver = Math.ceil(extraDays / 7);
  return +(weeksOver * admin.weeklyFee).toFixed(2);
}
function viewLateBooks(){
  const history = getHistory();
  const books = getBooks(); const students = getStudents(); const admin = getAdminConfig(); const now = new Date();
  const late = history.filter(h => !h.returnDate && daysBetween(h.borrowDate, now) > admin.maxDays);
  if(late.length === 0){ document.getElementById('historyArea').innerHTML = '<div class="small">No late books at the moment</div>'; return; }
  let html = '<h3 style="margin-top:0">Late Books (current fees)</h3>';
  html += '<table><thead><tr><th>Student</th><th>Book</th><th>Author</th><th class="right">Borrow Date</th><th class="right">Days Overdue</th><th class="right">Current Fee</th></tr></thead><tbody>';
  let totalOutstanding = 0;
  late.forEach(h=>{ const s = students.find(x=>x.studentId===h.studentId)||{name:h.studentId}; const b = books.find(x=>x.barcode===h.barcode)||{title:h.barcode,author:''}; const daysBorrowed = daysBetween(h.borrowDate, now); const daysOver = daysBorrowed - admin.maxDays; const fee = computeCurrentFee(h); totalOutstanding += fee; html += `<tr><td>${s.name}<div class="small">${s.studentId}</div></td><td>${b.title}<div class="small">${b.barcode}</div></td><td class="small">${b.author||''}</td><td class="right small">${formatDateISO(h.borrowDate)}</td><td class="right small">${daysOver}</td><td class="right small danger">${fee.toFixed(2)}</td></tr>`; });
  html += `</tbody></table><div style="margin-top:8px" class="small"><strong>Total outstanding:</strong> <span class="danger">${totalOutstanding.toFixed(2)}</span></div>`;
  document.getElementById('historyArea').innerHTML = html;
}
function showStudentDebts(studentId){
  const history = getHistory().filter(h=>h.studentId===studentId);
  const books = getBooks(); const admin = getAdminConfig(); const now = new Date();
  if(history.length === 0){ showMsgBox('No History', 'No borrow history for this student', 'info'); return; }
  let html = `<h3 style="margin-top:0">Debts for ${studentId}</h3>`;
  html += '<table><thead><tr><th>Book</th><th>Author</th><th class="right">Borrow</th><th class="right">Return</th><th class="right">Status</th><th class="right">Current Fee</th></tr></thead><tbody>';
  let total = 0;
  history.forEach(h=>{ const b = books.find(x=>x.barcode===h.barcode)||{title:h.barcode,author:''}; const fee = computeCurrentFee(h); total += fee; const status = h.returnDate ? '<span class="ok">Returned</span>' : (daysBetween(h.borrowDate, now) > admin.maxDays ? '<span class="danger">Late</span>' : '<span class="small">Borrowed</span>'); html += `<tr><td>${b.title}<div class="small">${b.barcode}</div></td><td class="small">${b.author||''}</td><td class="right small">${formatDateISO(h.borrowDate)}</td><td class="right small">${h.returnDate?formatDateISO(h.returnDate):'<em>not yet</em>'}</td><td class="right small">${status}</td><td class="right small danger">${fee.toFixed(2)}</td></tr>`; });
  html += `</tbody></table><div class="small" style="margin-top:8px"><strong>Total current debt:</strong> <span class="danger">${total.toFixed(2)}</span></div>`;
  document.getElementById('historyArea').innerHTML = html;
}

/* ---------- Excel Import (SheetJS) ---------- */
function triggerFile(elId){ document.getElementById(elId).click(); }
function handleFileSelect(evt,type){ const files = evt.target.files || (evt.dataTransfer && evt.dataTransfer.files); if(!files||files.length===0) return; const file = files[0]; readExcelFile(file,type); if(evt.target) evt.target.value=''; }
function readExcelFile(file,type){
  const reader = new FileReader();
  reader.onload = function(e){
    let data = e.target.result; let workbook;
    try{ workbook = XLSX.read(data, { type: 'binary' }); } catch(err){ try{ const arr = new Uint8Array(data); workbook = XLSX.read(arr, { type: 'array' }); } catch(e2){ showImportMsg('Failed to parse file: ' + e2.message, true); return; } }
    const sheet = workbook.SheetNames[0]; const worksheet = workbook.Sheets[sheet]; const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    if(json.length === 0){ showImportMsg('No rows found in file', true); return; }
    if(type === 'students') importStudentsFromRows(json); else if(type === 'books') importBooksFromRows(json);
  };
  reader.readAsBinaryString(file);
}

function importStudentsFromRows(rows){
  const students = getStudents();
  let imported=0, skipped=0;
  rows.forEach(r=>{
    const studentId = r.studentId || r.StudentId || r['Student ID'] || r.ID || r.id || '';
    const name = r.name || r.Name || r['Full Name'] || r['full name'] || '';
    const grade = r.grade || r.Grade || r['Grade Level'] || r['grade level'] || '';
    const roleRaw = r.role || r.Role || r.type || r.Type || r['Parent or Student'] || r['Parent/Student'] || '';
    const weeklyFeeRaw = r.weeklyFee || r.WeeklyFee || r['Weekly Fee'] || r.parentWeeklyFee || r['Parent Fee/Week'] || 0;
    const sid = String(studentId).trim();
    const sname = String(name).trim();
    const sgrade = String(grade).trim();
    const roleText = String(roleRaw).trim().toLowerCase();
    const role = (roleText === 'parent' || roleText === 'p') ? 'parent' : 'student';
    const weeklyFee = Math.max(0, Number(weeklyFeeRaw) || 0);
    if(!sid || !sname){ skipped++; return; }
    if(students.some(x=>x.studentId === sid)){ skipped++; return; }
    students.push({ studentId: sid, name: sname, grade: sgrade, role, weeklyBorrowFee: role === 'parent' ? weeklyFee : 0 });
    imported++;
  });
  setStudents(students);
  showImportMsg(`Students import finished. Imported: ${imported}, Skipped: ${skipped}`);
  playSuccessSound();
  
}

function importBooksFromRows(rows){
  const books = getBooks();
  let imported=0, skipped=0;
  rows.forEach(r=>{
    const barcode = r.barcode || r.Barcode || r['Barcode'] || r.ISBN || r.isbn || '';
    const title = r.title || r.Title || r['Book Title'] || r['book title'] || '';
    const author = r.author || r.Author || r['Writer'] || r['Autor'] || '';
    const pages = r.pages || r.Pages || r['#pages'] || r.pagesCount || '';
    const level = r.level || r.Level || r['Level'] || '';
    const keywordsRaw = r.keywords || r.Keywords || r['Keywords'] || '';
    const availableRaw = (r.available !== undefined) ? r.available : (r.Available !== undefined ? r.Available : '');
    const locationRaw = r.location || r.Location || r['Location'] || '';
    const bcode = String(barcode).trim();
    const btitle = String(title).trim();
    const bauthor = String(author).trim() || '';
    const bpages = parseInt(pages,10);
    const blvl = String(level).trim() || '1';
    const bavail = (String(availableRaw).toLowerCase() === 'false' || String(availableRaw) === '0') ? false : true;
    const bkeywords = String(keywordsRaw).trim();
    const blocation = String(locationRaw).trim();
    if(!bcode || !btitle || !bpages || isNaN(bpages)){ skipped++; return; }
    if(books.some(x=>x.barcode === bcode)){ skipped++; return; }
    books.push({ barcode: bcode, title: btitle, author: bauthor, pages: bpages, level: blvl, available: bavail, keywords: bkeywords, location: blocation, borrowCount: 0 });
    imported++;
  });
  setBooks(books);
  showImportMsg(`Books import finished. Imported: ${imported}, Skipped: ${skipped}`);
  playSuccessSound();
  
}

function showImportMsg(msg,isError){ const el = document.getElementById('importMsg'); el.innerText = msg; el.style.color = isError ? 'var(--danger)' : '#274a9b'; if(el.__importTimer) clearTimeout(el.__importTimer); el.__importTimer = setTimeout(()=>{ el.innerText=''; el.__importTimer = null; }, MSG_SHOW_MS); }

/* Drag & drop wiring */
function preventDefaults(e){ e.preventDefault(); e.stopPropagation(); }
const studentDrop = document.getElementById('studentDrop'), bookDrop = document.getElementById('bookDrop');
if(studentDrop && bookDrop) {
  ['dragenter','dragover','dragleave','drop'].forEach(evt=>{ studentDrop.addEventListener(evt, preventDefaults, false); bookDrop.addEventListener(evt, preventDefaults, false); });
  ['dragenter','dragover'].forEach(evt=>{ studentDrop.addEventListener(evt, ()=>studentDrop.classList.add('dragover'), false); bookDrop.addEventListener(evt, ()=>bookDrop.classList.add('dragover'), false); });
  ['dragleave','drop'].forEach(evt=>{ studentDrop.addEventListener(evt, ()=>studentDrop.classList.remove('dragover'), false); bookDrop.addEventListener(evt, ()=>bookDrop.classList.remove('dragover'), false); });
  studentDrop.addEventListener('drop', (e)=>{ const files = e.dataTransfer.files; if(files && files.length) readExcelFile(files[0],'students'); });
  bookDrop.addEventListener('drop', (e)=>{ const files = e.dataTransfer.files; if(files && files.length) readExcelFile(files[0],'books'); });
}

/* Hook file inputs */
const studentFile = document.getElementById('studentFile');
const bookFile = document.getElementById('bookFile');
if(studentFile) studentFile.addEventListener('change', (e)=> handleFileSelect(e,'students'));
if(bookFile) bookFile.addEventListener('change', (e)=> handleFileSelect(e,'books'));

let notifyTimeoutId = null;
function showNotification(options = {}){ 
  const title = options.title || 'Notification';
  const message = options.message || '';
  const autoClose = options.autoClose !== undefined ? options.autoClose : true;
  const duration = options.duration || MSG_SHOW_MS;
  const box = document.getElementById('notifyBox');
  document.getElementById('notifyTitle').textContent = title;
  document.getElementById('notifyMsg').textContent = message;
  const sr = document.getElementById('srLive');
  sr.textContent = `${title}: ${message}`;
  box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
  playNotifySound();
  if(notifyTimeoutId) clearTimeout(notifyTimeoutId);
  if(autoClose){
    notifyTimeoutId = setTimeout(()=>{ dismissNotification(); }, duration);
  }
}
function dismissNotification(){ const box = document.getElementById('notifyBox'); box.classList.remove('show'); setTimeout(()=>{ box.style.display='none'; }, 550); }

/* ---------- Student-right-panel helpers ---------- */
function renderMyBorrows(){
  const container = document.getElementById('myBorrowsTop');
  if(!container) return;
  const logged = localStorage.getItem(LS_KEYS.LOGGED_STUDENT);
  if(!logged){ container.innerHTML = '<div class="small">Not logged in. Sign in to see borrows.</div>'; return; }
  const s = JSON.parse(logged);
  const history = getHistory().filter(h=>h.studentId === s.studentId);
  const books = getBooks();
  if(history.filter(h=>!h.returnDate).length === 0){ container.innerHTML = '<div class="small">No current borrows.</div>'; return; }
  const admin = getAdminConfig();
  const now = new Date();
  let html = '<table><thead><tr><th>Book</th><th class="right">Borrowed</th><th class="right">Due</th><th class="right">Status</th></tr></thead><tbody>';
  history.filter(h=>!h.returnDate).forEach(h=>{
    const b = books.find(x=>x.barcode===h.barcode) || { title: h.barcode, author:'' };
    const borrowDate = new Date(h.borrowDate);
    const dueDate = new Date(borrowDate.getTime() + (admin.maxDays * 24*60*60*1000));
    const daysBorrowed = daysBetween(h.borrowDate, now);
    const daysOver = Math.max(0, daysBorrowed - admin.maxDays);
    const status = h.returnDate ? 'Returned' : (daysOver>0 ? `<span class="danger">${daysOver} days overdue</span>` : `<span class="small">Due in ${Math.max(0, admin.maxDays - daysBorrowed)} days</span>`);
    html += `<tr><td>${b.title}<div class="small">${b.author||''} • ${b.barcode}</div></td><td class="right small">${formatDateISO(h.borrowDate)}</td><td class="right small">${formatDateISO(dueDate.toISOString())}</td><td class="right small">${status}</td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderStudentHistoryBox(){
  const box = document.getElementById('studentHistoryBox');
  const content = document.getElementById('studentHistoryContent');
  if(!box || !content) return;
  const logged = localStorage.getItem(LS_KEYS.LOGGED_STUDENT);
  if(!logged){ box.style.display = 'none'; content.innerHTML = ''; return; }
  const s = JSON.parse(logged);
  const historyAll = getHistory().filter(h=>h.studentId === s.studentId);
  const books = getBooks();

  const returned = historyAll.filter(h=>h.returnDate);
  const totalPages = returned.reduce((sum,h)=>{ const b = books.find(x=>x.barcode===h.barcode); return sum + (b ? b.pages : 0); },0);
  const pagesByLevel = {};
  returned.forEach(h=>{ const b = books.find(x=>x.barcode===h.barcode); if(!b) return; pagesByLevel[b.level] = (pagesByLevel[b.level]||0) + b.pages; });

  let html = `<div><strong>${s.name} (${s.studentId})</strong></div>`;
  html += `<div style="margin-top:8px"><strong>Total pages read (returned books):</strong> <span class="ok">${totalPages}</span></div>`;
  html += '<div style="margin-top:8px"><strong>Pages by level</strong><div class="small">';
  if(Object.keys(pagesByLevel).length===0) html += 'No returned books yet';
  else for(const lvl in pagesByLevel) html += `Level ${lvl}: ${pagesByLevel[lvl]} pages<br>`;
  html += '</div></div>';

  html += '<div style="margin-top:10px"><strong>My borrow history</strong><div class="small" style="margin-top:6px">';
  if(historyAll.length===0) html += 'No history';
  else {
    const recent = historyAll.slice().sort((a,b)=> new Date(b.borrowDate)-new Date(a.borrowDate)).slice(0,12);
    html += '<table><thead><tr><th>Book</th><th>Author</th><th class="right">Borrow</th><th class="right">Return</th></tr></thead><tbody>';
    recent.forEach(h=>{
      const b = books.find(x=>x.barcode===h.barcode) || {title:h.barcode,author:''};
      html += `<tr><td>${b.title}<div class="small">${b.barcode}</div></td><td class="small">${b.author||''}</td><td class="right small">${formatDateISO(h.borrowDate)}</td><td class="right small">${h.returnDate?formatDateISO(h.returnDate):'<em>not yet</em>'}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  html += '</div></div>';

  content.innerHTML = html;
  box.style.display = 'block';
}

/* ---------- Overlay search logic ---------- */
const centerInput = document.getElementById('centerSearch');
const overlayBackdrop = document.getElementById('overlayBackdrop');
const overlayResults = document.getElementById('overlayResults');

function openOverlay(){ overlayBackdrop.style.display = 'flex'; }
function closeOverlay(){ overlayBackdrop.style.display = 'none'; overlayResults.innerHTML = ''; }

function renderOverlayResults(q){
  const trimmed = (q || '').trim().toLowerCase();
  overlayResults.innerHTML = '';
  if(!trimmed) return;
  const books = getBooks().filter(b=> {
    const kw = (b.keywords || '').toString().toLowerCase();
    const loc = (b.location || '').toString().toLowerCase();
    return b.title.toLowerCase().includes(trimmed) || b.barcode.toLowerCase().includes(trimmed) || (b.author && b.author.toLowerCase().includes(trimmed)) || (kw && kw.includes(trimmed)) || (loc && loc.includes(trimmed));
  });
  if(books.length === 0){ overlayResults.innerHTML = '<div class="small">No matches</div>'; return; }
  const history = getHistory();
  const students = getStudents();
  const admin = getAdminConfig();
  const logged = localStorage.getItem(LS_KEYS.LOGGED_STUDENT);
  const currentStudentId = logged ? JSON.parse(logged).studentId : null;

  let html = '<div style="max-height:60vh; overflow:auto;"><table><thead><tr><th>Barcode</th><th>Title</th><th>Author</th><th class="right">Pages</th><th class="right">Lvl</th><th>Keywords</th><th>Location</th><th class="right">Borrowed</th><th>Return</th><th></th></tr></thead><tbody>';
  books.forEach(b=>{
    const status = b.available ? '' : ' <span class="small danger">(borrowed)</span>';
    const activeTx = history.find(h => h.barcode === b.barcode && !h.returnDate);
    const borrowCount = b.borrowCount || 0;
    let returnInfo = '';
    if(!activeTx){
      returnInfo = '<span class="small">Available</span>';
    } else {
      const borrowDate = new Date(activeTx.borrowDate);
      const dueDate = new Date(borrowDate.getTime() + (admin.maxDays * 24*60*60*1000));
      const dueText = formatDateISO(dueDate.toISOString());
      if(currentStudentId && activeTx.studentId === currentStudentId){
        returnInfo = `<span class="small ok">Due ${dueText} (yours)</span>`;
      } else {
        const borrower = students.find(s => s.studentId === activeTx.studentId);
        const name = borrower ? borrower.name : activeTx.studentId;
        returnInfo = `<span class="small danger">Borrowed by ${name} — due ${dueText}</span>`;
      }
    }
    const kw = escapeHtml(b.keywords || '');
    const loc = escapeHtml(b.location || '');
    html += `<tr>
      <td class="small">${b.barcode}</td>
      <td>${b.title}${status}</td>
      <td class="small">${b.author||''}</td>
      <td class="right small">${b.pages}</td>
      <td class="right small">${levelBadge(b.level)}</td>
      <td class="small">${kw}</td>
      <td class="small">${loc}</td>
      <td class="right small"><span class="borrow-count">${borrowCount}x</span></td>
      <td class="small right">${returnInfo}</td>
      <td style="width:120px"><button onclick="overlayUse('${b.barcode}')" class="smallbtn">Use</button></td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  overlayResults.innerHTML = html;
}

function overlayUse(barcode){
  const logged = localStorage.getItem(LS_KEYS.LOGGED_STUDENT);
  if(!logged){ transientText('borrowMsg','No student logged. Sign in first.'); closeOverlay(); playErrorSound(); return; }
  openBorrowDialog();
  document.getElementById('modalBorrowBarcode').value = barcode;
  closeOverlay();
}

centerInput.addEventListener('input', (e)=>{
  const q = e.target.value || '';
  if(!q.trim()){
    closeOverlay();
    return;
  }
  renderOverlayResults(q);
  openOverlay();
});

overlayBackdrop.addEventListener('click', (e)=>{
  if(e.target === overlayBackdrop) closeOverlay();
});
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape') closeOverlay();
});

/* ---------- Auto-logout timer ---------- */
let autoLogoutTimerId = null;
const AUTO_LOGOUT_MS = 20 * 1000; // 20 seconds for demo

function clearAutoLogoutTimer() {
  if (autoLogoutTimerId) {
    clearTimeout(autoLogoutTimerId);
    autoLogoutTimerId = null;
  }
}

function scheduleAutoLogout() {
  clearAutoLogoutTimer();
  autoLogoutTimerId = setTimeout(() => {
    logoutStudent();
    showNotification({ title: 'Session ended', message: 'Student automatically logged out after inactivity', autoClose: true });
  }, AUTO_LOGOUT_MS);
}

/* ---------- ENHANCED GLOBAL SCANNER HANDLER: LOGIN THEN BORROW ---------- */
(function(){
  let scanBuffer = '';
  let scanTimer = null;
  const SCAN_TIMEOUT = 100;
  const MIN_SCAN_LENGTH = 3;

  function isStudentLogged(){ 
    return !!localStorage.getItem(LS_KEYS.LOGGED_STUDENT); 
  }

  function processScanPayload(code){
    const val = (code || '').trim();
    if(!val || val.length < MIN_SCAN_LENGTH) return;

    console.log('Scanned value:', val);

    const active = document.activeElement;
    // When the librarian card is being registered, the barcode scanner fills this field.
    // It must not unlock Administrator mode during setup.
    if(active && active.id === 'cfg_librarian_card_code') return;

    // A registered librarian barcode takes priority over student and book barcodes.
    if(!isAdminSession() && handleLibrarianBarcode(val)) return;
    if(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)){
      const id = active.id || '';
      if(['modalBorrowBarcode','modalReturnBarcode','centerSearch'].includes(id)) {
        return;
      }
    }

    if(!isStudentLogged()){
      const students = getStudents();
      const student = students.find(s => s.studentId === val);
      if(student){
        localStorage.setItem(LS_KEYS.LOGGED_STUDENT, JSON.stringify(student));
        loadStudentUI(); 
        renderMyBorrows(); 
        renderStudentHistoryBox(); 
        scheduleAutoLogout(); 
        setWelcome(student.name);
        
        showNotification({ 
          title: 'Student Login', 
          message: `${student.name} logged in successfully`, 
          autoClose: true 
        });
        
        transientText('borrowMsg', `Logged in: ${student.name} (${student.studentId})`);
        playSuccessSound();
        
        return;
      } else {
        showMsgBox('Student not found', `Student ID not found: ${val}`, 'error');
        return;
      }
    }

    if(isStudentLogged()){
      const books = getBooks();
      const book = books.find(b => b.barcode === val);
      
      if(book){
        const logged = localStorage.getItem(LS_KEYS.LOGGED_STUDENT);
        const student = JSON.parse(logged);
        
        if(!book.available){
          showMsgBox('Book unavailable', `The book "${book.title}" is currently borrowed by another student.`, 'error');
          return;
        }

        const history = getHistory();
        const admin = getAdminConfig();
        const activeBorrowCount = history.filter(h => h.studentId === student.studentId && !h.returnDate).length;

        if(activeBorrowCount >= admin.maxBooks){
          showMsgBox('Borrow limit reached', `${student.name} has reached the maximum allowed borrows (${admin.maxBooks}). Return a book before borrowing another.`, 'error');
          return;
        }

        const txId = Date.now();
        history.push({ 
          txId, 
          studentId: student.studentId, 
          barcode: book.barcode, 
          borrowDate: new Date().toISOString(), 
          returnDate: null, 
          overdueFee: 0.0,
          borrowerRole: student.role || 'student',
          weeklyBorrowFee: Number(student.weeklyBorrowFee || 0)
        });
        
        book.available = false;
        book.borrowCount = (book.borrowCount || 0) + 1;
        const parentTx = history[history.length - 1];
        setHistory(history);
        setBooks(books);
        if (String(student.role || 'student').toLowerCase() === 'parent') saveParentBorrowToFirestore(parentTx, student, book);
        
        showNotification({ 
          title: 'Book borrowed', 
          message: `${student.name} borrowed "${book.title}"`, 
          autoClose: true 
        });
        
        transientText('borrowMsg', `Book borrowed: ${book.title} — ${student.name}. Due in ${admin.maxDays} days.`);
        
        renderAll();
        renderMyBorrows(); 
        renderStudentHistoryBox(); 
        scheduleAutoLogout();
        playSuccessSound();
        refreshPage();
        return;
      } else {
        const students = getStudents();
        const newStudent = students.find(s => s.studentId === val);
        
        if(newStudent){
          localStorage.setItem(LS_KEYS.LOGGED_STUDENT, JSON.stringify(newStudent));
          loadStudentUI(); 
          renderMyBorrows(); 
          renderStudentHistoryBox(); 
          scheduleAutoLogout(); 
          setWelcome(newStudent.name);
          
          showNotification({ 
            title: 'Student Switch', 
            message: `Switched to ${newStudent.name}`, 
            autoClose: true 
          });
          
          transientText('borrowMsg', `Logged in: ${newStudent.name} (${newStudent.studentId})`);
          playSuccessSound();
          refreshPage();
          return;
        } else {
          showMsgBox('Unknown code', `Scanned code "${val}" is not recognized as a student ID or book barcode.`, 'error');
          return;
        }
      }
    }
  }

  window.addEventListener('keydown', function(e){
    if(e.key.length > 1 && e.key !== 'Enter') return;

    if(e.key === 'Enter'){
      if(scanTimer){ 
        clearTimeout(scanTimer); 
        scanTimer = null; 
      }
      if(scanBuffer.length >= MIN_SCAN_LENGTH) {
        e.preventDefault();
        processScanPayload(scanBuffer);
      }
      scanBuffer = '';
      return;
    }

    if(e.key.length === 1){
      const active = document.activeElement;
      const isInInputField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
      
      if(isInInputField && scanBuffer.length === 0) {
        return;
      }

      scanBuffer += e.key;
      
      if(scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(() => {
        if(scanBuffer.length >= MIN_SCAN_LENGTH) {
          processScanPayload(scanBuffer);
        }
        scanBuffer = '';
        scanTimer = null;
      }, SCAN_TIMEOUT);
    }
  }, true);

  window.addEventListener('paste', function(e){
    const pastedData = e.clipboardData?.getData('text');
    if(pastedData && pastedData.length >= MIN_SCAN_LENGTH) {
      const active = document.activeElement;
      if(active && ['modalBorrowBarcode','modalReturnBarcode','centerSearch'].includes(active.id)) {
        return;
      }
      
      e.preventDefault();
      processScanPayload(pastedData);
    }
  });
})();

/* ---------- Local Storage import/export ---------- */
function getLocalStorageSnapshot(){
  const data={};
  Object.values(LS_KEYS).forEach(key=>{ const raw=localStorage.getItem(key); if(raw!==null) data[key]=raw; });
  const librarianCard=localStorage.getItem(LIBRARIAN_CARD_LS);
  if(librarianCard!==null) data[LIBRARIAN_CARD_LS]=librarianCard;
  return { app:'Library Zone', version:3, exportedAt:new Date().toISOString(), data };
}
function exportLocalStorageData(){
  const blob=new Blob([JSON.stringify(getLocalStorageSnapshot(),null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`library-zone-local-storage-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  transientText('localStorageMsg','Local Storage backup exported.');
}
function triggerLocalStorageImport(){ document.getElementById('localStorageImportFile').click(); }
function loadStoredDataIntoApp(){ renderAll(); loadStudentUI(); loadAdminPanel(); showMsgBox('Stored Data Reloaded','The application has reloaded its current Local Storage data.','info'); }
async function importLocalStorageFile(file){
  try{
    const text = await file.text();
    const parsed = JSON.parse(text);
    const data = parsed.data || parsed;
    if(!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid backup structure');

    // Restore every exported Library Zone dataset and persist each one to PostgreSQL.
    const postgresWrites = [];
    let count = 0;
    const importedKeys = [];

    for(const key of Object.values(LS_KEYS)){
      if(!Object.prototype.hasOwnProperty.call(data,key)) continue;
      let value = data[key];
      if(typeof value === 'string'){
        try { value = JSON.parse(value); } catch(_) { /* keep plain string values */ }
      }
      localStorage.setItem(key, JSON.stringify(value));
      importedKeys.push(key);
      count++;
      if(POSTGRES_KEYS.has(key)) postgresWrites.push(persistPostgresData(key, value));
    }

    if(Object.prototype.hasOwnProperty.call(data, LIBRARIAN_CARD_LS)){
      let value = data[LIBRARIAN_CARD_LS];
      if(typeof value === 'string'){
        try { value = JSON.parse(value); } catch(_) {}
      }
      localStorage.setItem(LIBRARIAN_CARD_LS, JSON.stringify(value));
      importedKeys.push(LIBRARIAN_CARD_LS);
      count++;
      if(POSTGRES_KEYS.has(LIBRARIAN_CARD_LS)) postgresWrites.push(persistPostgresData(LIBRARIAN_CARD_LS, value));
    }

    if(count === 0) throw new Error('No Library Zone datasets were found in the backup');

    // Wait for all PostgreSQL writes so the import cannot report success while
    // only the browser cache has been updated.
    const results = await Promise.allSettled(postgresWrites);
    const failed = results.filter(r=>r.status === 'rejected');
    if(failed.length){
      throw new Error(`${failed.length} PostgreSQL dataset${failed.length===1?'':'s'} could not be saved`);
    }

    renderAll();
    loadStudentUI();
    loadAdminPanel();
    transientText('localStorageMsg',`Imported ${count} stored data sets and saved them to PostgreSQL.`);
    showMsgBox('Import Complete',`Imported ${count} stored data sets. All library data was saved to PostgreSQL.`, 'info');
  }catch(err){
    console.error('Library Zone import failed:', err);
    showMsgBox('Import Failed', err && err.message ? err.message : 'The selected file is not a valid Library Zone backup.', 'error');
  }
}

/* ---------- Event Listeners ---------- */
document.getElementById('localStorageImportFile').addEventListener('change',e=>{ if(e.target.files&&e.target.files[0]) importLocalStorageFile(e.target.files[0]); e.target.value=''; });
if(document.getElementById('reg_role')) document.getElementById('reg_role').addEventListener('change',toggleRegistrationFee);
if(document.getElementById('adminAddStudentRole')) document.getElementById('adminAddStudentRole').addEventListener('change',()=>{ const p=document.getElementById('adminAddStudentRole').value==='parent'; document.getElementById('adminAddStudentWeeklyFee').style.display=p?'block':'none'; const e=document.getElementById('adminAddParentEmail'); const pw=document.getElementById('adminAddParentPassword'); if(e)e.style.display=p?'block':'none'; if(pw)pw.style.display=p?'block':'none'; });

document.getElementById('activateBtn').addEventListener('click', validateLicenseOnline);
document.getElementById('demoBtn').addEventListener('click', demoGenerate);

document.getElementById('adminLoginBtn').addEventListener('click', adminLogin);
document.getElementById('adminLogoutBtn').addEventListener('click', adminLogout);

document.getElementById('btnStudentView').addEventListener('click', ()=> { setViewRole('student'); applyViewRole('student'); });

document.getElementById('borrowBtn').addEventListener('click', openBorrowDialog);
document.getElementById('modalBorrowCancel').addEventListener('click', ()=>{ closeBorrowDialog(); });
document.getElementById('modalBorrowOk').addEventListener('click', ()=>{ const code = document.getElementById('modalBorrowBarcode').value.trim(); borrowSelectedBookFromModal(code); });

document.getElementById('returnBtn').addEventListener('click', openReturnDialog);
document.getElementById('modalReturnCancel').addEventListener('click', ()=>{ closeReturnDialog(); });
document.getElementById('modalReturnOk').addEventListener('click', ()=>{ const code = document.getElementById('modalReturnBarcode').value.trim(); returnSelectedBookFromModal(code); });

document.getElementById('btnAdminView').addEventListener('click', ()=> {
  document.getElementById('adminPassModal').style.display = 'flex';
  document.getElementById('adminPassMsg').textContent = '';
  document.getElementById('adminPassPrompt').value = '';
  setTimeout(()=>{ document.getElementById('adminPassPrompt').focus(); }, 60);
});

document.getElementById('adminPassOk').addEventListener('click', () => {
  const entered = document.getElementById('adminPassPrompt').value || '';
  const conf = getAdminConfig();
  const expectedPass = conf.adminPassword || 'libadmin';
  if (entered === expectedPass) {
    setAdminSession();
    document.getElementById('adminPassModal').style.display = 'none';
    document.getElementById('adminLoginArea').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    showNotification({ title: 'Admin', message: 'Administrator unlocked', autoClose: true });
    showHeaderRoleButtons(true);
    setViewRole('admin');
    playSuccessSound();
    
  } else {
    document.getElementById('adminPassMsg').textContent = 'Incorrect password';
    document.getElementById('adminPassPrompt').focus();
    playErrorSound();
  }
});
document.getElementById('adminPassCancel').addEventListener('click', () => {
  document.getElementById('adminPassModal').style.display = 'none';
});

const studentLogoutBtn = document.getElementById('studentLogoutBtn');
if(studentLogoutBtn){
  studentLogoutBtn.addEventListener('click', () => {
    logoutStudent();
    showNotification({ title: 'Logged out', message: 'Student has logged out', autoClose: true });
  });
}

// Admin quick student login
document.getElementById('adminQuickStudentBtn').addEventListener('click', () => {
  const id = (document.getElementById('adminQuickStudentId').value || '').trim();
  const msgEl = document.getElementById('adminQuickStudentMsg');
  msgEl.style.color = '';
  msgEl.textContent = '';
  if (!id) {
    transientText('adminQuickStudentMsg', 'Enter a student ID.');
    playErrorSound();
    return;
  }
  const students = getStudents();
  const student = students.find(s => String(s.studentId) === String(id));
  if (!student) {
    showMsgBox('Student not found', `Student ID not found: ${id}`, 'error');
    transientText('adminQuickStudentMsg', 'Student not found.');
    return;
  }
  localStorage.setItem(LS_KEYS.LOGGED_STUDENT, JSON.stringify(student));
  loadStudentUI();
  renderMyBorrows();
  renderStudentHistoryBox();
  scheduleAutoLogout();
  setWelcome(student.name);
  msgEl.style.color = 'var(--ok)';
  transientText('adminQuickStudentMsg', `Logged in: ${student.name} (${student.studentId})`);
  playSuccessSound();
  setTimeout(()=>{ document.getElementById('adminQuickStudentId').value = ''; transientText('adminQuickStudentMsg',''); }, 1200);
});

// Admin add student
async function createParentPortalAccount(parent, password, emailOverride='') {
  if (!parentAuth) throw new Error('Firebase Authentication is not initialized.');
  const email = (emailOverride || `${String(parent.studentId).trim().toLowerCase().replace(/[^a-z0-9._-]/g,'_')}@parents.libraryzone.app`).trim().toLowerCase();
  if (!password || password.length < 6) throw new Error('Portal password must be at least 6 characters.');
  const secondaryUser = parentAuth.currentUser;
  try {
    const cred = await parentAuth.createUserWithEmailAndPassword(email, password);
    parent.portalEmail = email;
    parent.portalAuthUid = cred.user.uid;
    parent.portalAccountCreatedAt = new Date().toISOString();
    return {email, uid: cred.user.uid, created:true};
  } catch(e) {
    if (e && (e.code === 'auth/email-already-in-use')) {
      throw new Error('A portal account already exists for this parent. Use the reset-password option through the secure administrator backend.');
    }
    throw e;
  } finally {
    // The secondary Firebase app is dedicated to parent auth, so signing out does not affect the main app's admin session.
    try { await parentAuth.signOut(); } catch(_) {}
  }
}

async function adminAddStudent() {
  const idEl = document.getElementById('adminAddStudentId');
  const nameEl = document.getElementById('adminAddStudentName');
  const gradeEl = document.getElementById('adminAddStudentGrade');
  const msgEl = document.getElementById('adminAddStudentMsg');
  const portalMsg = document.getElementById('adminParentPortalMsg');
  const id = (idEl && idEl.value || '').trim();
  const name = (nameEl && nameEl.value || '').trim();
  const grade = (gradeEl && gradeEl.value || '').trim();
  const roleEl = document.getElementById('adminAddStudentRole');
  const feeEl = document.getElementById('adminAddStudentWeeklyFee');
  const emailEl = document.getElementById('adminAddParentEmail');
  const pwEl = document.getElementById('adminAddParentPassword');
  const role = roleEl && roleEl.value === 'parent' ? 'parent' : 'student';
  const weeklyBorrowFee = role === 'parent' ? Math.max(0, Number(feeEl && feeEl.value || 0) || 0) : 0;
  const portalEmail = role === 'parent' ? String(emailEl && emailEl.value || '').trim() : '';
  const portalPassword = role === 'parent' ? String(pwEl && pwEl.value || '') : '';
  msgEl.style.color=''; msgEl.textContent=''; if(portalMsg) portalMsg.textContent='';
  if(!id || !name){ msgEl.style.color='var(--danger)'; msgEl.textContent='Student ID and name are required.'; playErrorSound(); return; }
  if(role==='parent' && portalPassword && portalPassword.length < 6){ msgEl.style.color='var(--danger)'; msgEl.textContent='Portal password must be at least 6 characters.'; playErrorSound(); return; }
  const students=getStudents();
  if(students.some(s=>String(s.studentId).toLowerCase()===String(id).toLowerCase())){ msgEl.style.color='var(--danger)'; msgEl.textContent='Student ID already exists.'; playErrorSound(); return; }
  const newStudent={studentId:id,name,grade,role,weeklyBorrowFee};
  if(role==='parent' && portalEmail) newStudent.portalEmail=portalEmail.toLowerCase();
  if(role==='parent' && portalPassword){
    try {
      if(portalMsg) portalMsg.textContent='Creating secure parent portal account...';
      await createParentPortalAccount(newStudent, portalPassword, portalEmail);
      if(portalMsg){ portalMsg.style.color='var(--ok)'; portalMsg.textContent=`Portal account created: ${newStudent.portalEmail}`; }
    } catch(e) {
      if(portalMsg){ portalMsg.style.color='var(--danger)'; portalMsg.textContent=e.message || 'Could not create portal account.'; }
      msgEl.style.color='var(--danger)'; msgEl.textContent='Parent was not added because the portal account could not be created.'; playErrorSound(); return;
    }
  }
  students.push(newStudent); setStudents(students);
  msgEl.style.color='var(--ok)'; msgEl.textContent=`Added ${name} (${id}).`;
  playSuccessSound();
  setTimeout(()=>{ idEl.value=''; nameEl.value=''; gradeEl.value=''; if(roleEl)roleEl.value='student'; if(feeEl){feeEl.value='';feeEl.style.display='none'} if(emailEl){emailEl.value='';emailEl.style.display='none'} if(pwEl){pwEl.value='';pwEl.style.display='none'} renderStudentList(); },1000);
}
function adminAddStudentClear() {
  document.getElementById('adminAddStudentId').value = '';
  document.getElementById('adminAddStudentName').value = '';
  document.getElementById('adminAddStudentGrade').value = '';
  const roleEl = document.getElementById('adminAddStudentRole');
  const feeEl = document.getElementById('adminAddStudentWeeklyFee');
  if(roleEl) roleEl.value='student';
  if(feeEl){ feeEl.value=''; feeEl.style.display='none'; }
  const emailEl=document.getElementById('adminAddParentEmail'); const pwEl=document.getElementById('adminAddParentPassword');
  if(emailEl){emailEl.value='';emailEl.style.display='none';} if(pwEl){pwEl.value='';pwEl.style.display='none';}
  const msg = document.getElementById('adminAddStudentMsg');
  if (msg) { msg.textContent = ''; msg.style.color = ''; }
}

document.getElementById('adminAddStudentBtn').addEventListener('click', () => {
  if (!isAdminSession()) { showMsgBox('Unauthorized', 'Administrator mode required', 'error'); return; }
  adminAddStudent();
});
document.getElementById('adminAddStudentClear').addEventListener('click', adminAddStudentClear);

// Maintenance functions
function adminClearHistory() {
  if(!isAdminSession()) { showMsgBox('Unauthorized', 'Administrator mode required', 'error'); return; }
  if(!confirm('Delete ALL borrow history? This cannot be undone.')) return;
  setHistory([]);
  showMsgBox('History Cleared', 'Borrow history has been cleared.', 'info');
  renderHistory();
  playSuccessSound();

}

function adminClearStudents() {
  if(!isAdminSession()) { showMsgBox('Unauthorized', 'Administrator mode required', 'error'); return; }
  if(!confirm('Delete ALL students? This removes all student records. History will remain but cannot be associated to removed students.')) return;
  setStudents([]);
  showMsgBox('Students Cleared', 'Student list has been cleared.', 'info');
  renderStudentList();
  renderHistory();
  renderMyBorrows();
  renderStudentHistoryBox();
  playSuccessSound();

}

function adminClearBooks() {
  if(!isAdminSession()) { showMsgBox('Unauthorized', 'Administrator mode required', 'error'); return; }
  if(!confirm('Delete ALL books? This removes all book records. History will remain but show only barcodes.')) return;
  setBooks([]);
  showMsgBox('Books Cleared', 'Book list has been cleared.', 'info');
  renderBookList();
  renderHistory();
  renderMyBorrows();
  renderStudentHistoryBox();
  playSuccessSound();
 
}

function adminClearEverything() {
  if(!isAdminSession()) { showMsgBox('Unauthorized', 'Administrator mode required', 'error'); return; }
  if(!confirm('Delete ALL data (students, books, history)? This cannot be undone.')) return;
  setStudents([]);
  setBooks([]);
  setHistory([]);
  const conf = getAdminConfig() || {};
  conf.maxBooks = 3;
  conf.maxDays = 14;
  conf.weeklyFee = 5.00;
  setAdminConfig(conf);
  showMsgBox('All Data Cleared', 'All data has been cleared and admin settings reset to defaults.', 'info');
  renderAll();
  playSuccessSound();

}

function adminResetDefaults() {
  if(!isAdminSession()) { showMsgBox('Unauthorized', 'Administrator mode required', 'error'); return; }
  if(!confirm('Reset demo data (students, books, history and admin defaults)?')) return;
  initDefaults();
}

// Wire maintenance buttons
document.getElementById('adminClearHistoryBtn').addEventListener('click', adminClearHistory);
document.getElementById('adminClearStudentsBtn').addEventListener('click', adminClearStudents);
document.getElementById('adminClearBooksBtn').addEventListener('click', adminClearBooks);


async function initAfterLicense(){
  await loadPostgresData();
  if(!localStorage.getItem(LS_KEYS.ADMIN)) initDefaults();
  renderAll();
  
  const searchStudent = document.getElementById('searchStudent');
  const searchBook = document.getElementById('searchBook');
  
  if(searchStudent) searchStudent.addEventListener('input', renderStudentList);
  if(searchBook) searchBook.addEventListener('input', renderBookList);

  loadAdminPanel();
  if(isAdminSession()){
    showHeaderRoleButtons(true);
    setViewRole('admin');
  } else {
    showHeaderRoleButtons(false);
    setViewRole('student');
  }
  applyViewRole('student');
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
}

// Initialize on page load
window.addEventListener('load', async () => {
  const isValid = await checkStoredLicense();
  if (isValid) {
    initAfterLicense();
  }
});
