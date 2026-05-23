const CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwgKFHvVz6ZrPN4gkFGP4DMJ6Gwi8DFpLZ5JlMlC-TgL0NnSClqLZvHgtgvlKr1FljcoA/exec",
  LIFF_ID: "2009598216-MmBS77sp"
};

let userId = "";
let userName = "";
const weekDays = ['日','一','二','三','四','五','六'];
const PAGE_SIZE = 6;
const DATE_PAGE_SIZE = 5;
let currentDatePage = 0;
let totalDatePages = 0;
let allDateList = [];

let currentPage=1, totalPage=1, currentServiceList=[], searchKeyword="";
let currentCategory = "面部";
const GLOBAL_DATA = {dateList:[], allServices:[], staffData:{}, staffServices:{} };

const CATEGORIES = {
  "面部":["液態飛梭","無痛清粉刺","無痛清粉刺+修護敏感項目","無痛清粉刺+靚白水光肌項目","進化黑矽晶重返年輕課程","黑臉娃娃","除疣","除斑","臉部深層保濕課程","臉部皮秒課程","臉部白藻針課程","臉部清粉刺","高階保養"],
  "美甲":["光療美甲","卸甲","光療美甲加卸甲","剪手腳指甲","手部保養","足部保養"],
  "眉眼":["霧眉","霧唇","洗眉"],
  "除毛":["除私密毛","腋下私毛","接睫毛","角蛋白"],
  "頭皮":["外泌體育髮"],
  "乳暈":["無痛粉嫩乳暈術"]
};

// 美容師頭像
function getStaffAvatar(staffName) {
  const avatarMap = {
    "小惠": "https://yb131419.github.io/MoFan/IMG_6059.jpg",
    "Tina": "https://yb131419.github.io/MoFan/IMG_6058.jpg",
    "Nini": "https://picsum.photos/seed/xiaoting/200/200",
    "彥彬": "https://picsum.photos/seed/xiaoting/200/200",
    "auto": "https://picsum.photos/seed/default/200/200"
  };
  return avatarMap[staffName] || "https://picsum.photos/seed/default/200/200";
}

document.querySelectorAll('.step').forEach(step => {
  step.addEventListener('click', () => {
    const targetStep = step.dataset.step;
    goStep(targetStep);
  });
});

function initBirthdaySelect() {
  const yearSel = document.getElementById('birthYear');
  const monthSel = document.getElementById('birthMonth');
  const daySel = document.getElementById('birthDay');
  
  const now = new Date();
  const currentYear = now.getFullYear();
  for(let y=1940; y<=currentYear; y++){
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y + '年';
    yearSel.appendChild(opt);
  }
  for(let m=1; m<=12; m++){
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m + '月';
    monthSel.appendChild(opt);
  }
  const updateDays = () => {
    daySel.innerHTML = '<option value="">請選擇日</option>';
    const y = yearSel.value;
    const m = monthSel.value;
    if(!y || !m) return;
    const days = new Date(y, m, 0).getDate();
    for(let d=1; d<=days; d++){
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d + '日';
      daySel.appendChild(opt);
    }
  };
  yearSel.addEventListener('change', updateDays);
  monthSel.addEventListener('change', updateDays);
}

function formatPhoneNumber(phone) {
  let numbers = phone.replace(/\D/g, '');
  if(numbers.startsWith('09')){
    if(numbers.length <=4) return numbers;
    if(numbers.length <=7) return numbers.slice(0,4) + '-' + numbers.slice(4);
    return numbers.slice(0,4) + '-' + numbers.slice(4,7) + '-' + numbers.slice(7,10);
  }
  return numbers;
}

// 台北時區計算
function getTaipeiDateString(date) {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date(date));
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}
function getTodayTaipei() {
  return getTaipeiDateString(new Date());
}
function getCurrentTaipeiTime() {
  const now = new Date();
  const taipeiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  return taipeiTime;
}

// 2小時預約緩衝
function isTimeSlotValid(slotTime, workStart, workEnd, serviceDuration, selectedDate) {
  try {
    if (!slotTime || !workStart || !workEnd || !serviceDuration) return false;

    const nowTaipei = getCurrentTaipeiTime();
    const minAvailableTime = new Date(nowTaipei.getTime() + 2 * 60 * 60 * 1000);
    
    const slotDateTime = new Date(`${selectedDate}T${slotTime}:00+08:00`);
    const startWork = new Date(`${selectedDate}T${workStart}:00+08:00`);
    const endWork = new Date(`${selectedDate}T${workEnd}:00+08:00`);
    const serviceEndTime = new Date(slotDateTime.getTime() + serviceDuration * 60000);

    const inBusinessHours = slotDateTime >= startWork && serviceEndTime <= endWork;
    const enoughBuffer = slotDateTime >= minAvailableTime;

    return inBusinessHours && enoughBuffer;
  } catch (e) {
    console.error("時段驗證錯誤:", e);
    return false;
  }
}

// 日期過濾
function getValidDatesByService(serviceName) {
  const today = getTodayTaipei();
  let validDates = (GLOBAL_DATA.dateList || []).filter(d => d && d >= today);

  if (!serviceName) return validDates;

  validDates = validDates.filter(date => {
    const staffList = GLOBAL_DATA.staffData[date] || [];
    if (staffList.length === 0) return false;

    return staffList.some(staff => {
      const staffServices = GLOBAL_DATA.staffServices[staff.name] || [];
      return staffServices.some(item => item.name === serviceName);
    });
  });

  return validDates;
}

function gasRequest(action, params, callback) {
  const safeParams = params || {};
  let url = CONFIG.SCRIPT_URL + "?action=" + encodeURIComponent(action);
  for(let k in safeParams) {
    const val = safeParams[k] || "";
    url += "&"+encodeURIComponent(k)+"="+encodeURIComponent(val);
  }
  
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.timeout = 15000;
  xhr.ontimeout = function() {
    callback({status:"error",message:"請求超時，請稍後再試"});
  };
  xhr.onload = function(){
    try{ 
      const resData = JSON.parse(xhr.responseText || "{}");
      callback(resData || {status:"error",message:"數據格式異常"}); 
    }
    catch(e){ 
      callback({status:"error",message:"系統異常："+e.message}); 
    }
  };
  xhr.onerror = function(){ 
    callback({status:"error",message:"網路異常，請檢查網路連接"}) 
  };
  xhr.send();
}

function showModal(type,title,desc){
  const m = document.getElementById('modal');
  const iconEl = m.querySelector('.modal-icon');
  const titleEl = m.querySelector('.modal-title');
  const descEl = m.querySelector('.modal-desc');
  
  iconEl.textContent = type==='success'?'✅':'❌';
  iconEl.style.color = type==='success'?'#ff4d88':'#e74c3c';
  titleEl.textContent = title;
  descEl.textContent = desc;
  m.classList.add('active');
}
function closeModal(){
  document.getElementById('modal').classList.remove('active');
}

function goStep(s){
  document.querySelectorAll('.section').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.step').forEach(e=>e.classList.remove('active'));
  document.getElementById('step'+s).classList.add('active');
  document.querySelector(`.step[data-step="${s}"]`).classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
}

function renderPagination(){
  const p = document.getElementById('pagination');
  if(totalPage<=1){ p.innerHTML=''; return; }
  p.innerHTML = `
    <button class="page-btn" ${currentPage===1?'disabled':''} onclick="currentPage=1;renderCurrentPage()">首頁</button>
    <button class="page-btn" ${currentPage===1?'disabled':''} onclick="currentPage--;renderCurrentPage()">上一頁</button>
    <span class="page-text">${currentPage}/${totalPage}</span>
    <button class="page-btn" ${currentPage===totalPage?'disabled':''} onclick="currentPage++;renderCurrentPage()">下一頁</button>
    <button class="page-btn" ${currentPage===totalPage?'disabled':''} onclick="currentPage=totalPage;renderCurrentPage()">末頁</button>
  `;
}

function renderCurrentPage(){
  const g = document.getElementById('serviceGrid');
  g.innerHTML = '';
  if(!currentServiceList.length){ g.innerHTML='<div class="loading"><div class="loading-icon"></div>暫無符合條件的服務</div>'; renderPagination(); return; }
  
  const startIdx = (currentPage-1)*PAGE_SIZE;
  const list = currentServiceList.slice(startIdx, startIdx+PAGE_SIZE);
  
  list.forEach(item=>{
    if(!item?.name) return;

    let descText = item.desc || '';
    if(item.name === "外泌體育髮"){
      descText = "（三個月份 無效全額退款)<br>另送整套外泌體組合<br>總額 $35000";
    }
    if(item.name === "無痛粉嫩乳暈術"){
      descText = "不需做2~3次<br>做一次就能還回<br>嬰兒時期的『粉嫩色澤』";
    }

    const c = document.createElement('div');
    c.className='service-card';
    c.innerHTML = `
      ${item.name}
      <span class="service-duration">${item.duration || 0}分</span>
      <span class="service-desc">${descText}</span>
    `;
    c.onclick = function handleServiceClick() {
      document.querySelectorAll('.service-card').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
      document.getElementById('selectedService').value = item.name;
      document.getElementById('nextToDate').disabled = false;
      
      renderFilteredDates();
    };
    g.appendChild(c);
  });
  renderPagination();
}

function renderFilteredDates() {
  const selectedService = document.getElementById('selectedService').value.trim();
  allDateList = getValidDatesByService(selectedService);
  totalDatePages = Math.ceil(allDateList.length / DATE_PAGE_SIZE);
  currentDatePage = 0;
  
  const w = document.getElementById('weekSlider');
  if (!allDateList.length) {
    w.innerHTML = '<div class="loading"><div class="loading-icon"></div>暫無可預約的日期</div>';
    document.getElementById('datePagination').innerHTML = '';
    return;
  }
  
  renderCurrentDatePage();
  renderDatePagination();
}

function renderServices(){
  currentPage=1;
  const allServices = GLOBAL_DATA.allServices || [];
  const selectedStaff = document.getElementById('selectedStaff').value.trim();
  
  let filtered = [];
  if(selectedStaff && GLOBAL_DATA.staffServices[selectedStaff]){
    filtered = GLOBAL_DATA.staffServices[selectedStaff].filter(item => 
      CATEGORIES[currentCategory].includes(item.name)
    );
  } else {
    filtered = allServices.filter(item => CATEGORIES[currentCategory].includes(item.name));
  }

  filtered = filtered.filter(s=> s?.name && (searchKeyword==='' || s.name.includes(searchKeyword)));
  
  currentServiceList = filtered;
  totalPage = Math.ceil(currentServiceList.length/PAGE_SIZE);
  renderCurrentPage();
}

function renderDatePagination(){
  const p = document.getElementById('datePagination');
  if(totalDatePages <= 1){ p.innerHTML = ''; return; }
  p.innerHTML = `
    <button class="page-btn" ${currentDatePage === 0 ? 'disabled' : ''} onclick="goDatePage(0)">首頁</button>
    <button class="page-btn" ${currentDatePage === 0 ? 'disabled' : ''} onclick="goDatePage(currentDatePage - 1)">上一頁</button>
    <span class="page-text">${currentDatePage + 1}/${totalDatePages}</span>
    <button class="page-btn" ${currentDatePage === totalDatePages - 1 ? 'disabled' : ''} onclick="goDatePage(currentDatePage + 1)">下一頁</button>
    <button class="page-btn" ${currentDatePage === totalDatePages - 1 ? 'disabled' : ''} onclick="goDatePage(totalDatePages - 1)">末頁</button>
  `;
}
function goDatePage(page){
  if(page < 0 || page >= totalDatePages) return;
  currentDatePage = page;
  renderCurrentDatePage();
  renderDatePagination();
}
function renderCurrentDatePage(){
  const w = document.getElementById('weekSlider');
  w.innerHTML = '';
  
  const start = currentDatePage * DATE_PAGE_SIZE;
  const end = start + DATE_PAGE_SIZE;
  const currentDates = allDateList.slice(start, end);

  currentDates.forEach(d=>{
    const el = document.createElement('div');
    el.className = 'week-day';
    const [,month,day] = d.split('-');
    const week = weekDays[new Date(d).getDay()];
    el.innerHTML = `<div class="week-day-date">${month}/${day}</div><div class="week-day-week">週${week}</div>`;
    el.onclick = function handleDateClick() {
      document.querySelectorAll('.week-day').forEach(x=>x.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('selectedDate').value = d;
      renderStaff(d);
    };
    w.appendChild(el);
  });
}

function renderDates(){
  allDateList = getValidDatesByService('');
  totalDatePages = Math.ceil(allDateList.length / DATE_PAGE_SIZE);
  currentDatePage = 0;
  
  const w = document.getElementById('weekSlider');
  if(!allDateList.length){ 
    w.innerHTML='<div class="loading"><div class="loading-icon"></div>暫無可預約的日期</div>'; 
    document.getElementById('datePagination').innerHTML = '';
    return; 
  }
  renderCurrentDatePage();
  renderDatePagination();
}

function renderStaff(date){
  const s = document.getElementById('staffList');
  const selectedService = document.getElementById('selectedService').value.trim();
  
  s.innerHTML = '<div class="loading"><div class="loading-icon"></div>載入美容師中...</div>';
  document.getElementById('selectedStaff').value = '';
  document.getElementById('timeGrid').innerHTML = '<div class="loading"><div class="loading-icon"></div>請先選擇美容師</div>';
  document.getElementById('nextToInfo').disabled = true;
  
  if(!date || !GLOBAL_DATA.staffData){ s.innerHTML='<div class="loading"><div class="loading-icon"></div>請選擇有效日期</div>'; return; }
  
  let staffList = GLOBAL_DATA.staffData[date] || [];
  if(!staffList.length){ s.innerHTML='<div class="loading"><div class="loading-icon"></div>當日無美容師值班</div>'; return; }

  if(selectedService){
    staffList = staffList.filter(staff => {
      const staffServices = GLOBAL_DATA.staffServices[staff.name] || [];
      return staffServices.some(item => item.name === selectedService);
    });
  }

  if(!staffList.length){ 
    s.innerHTML='<div class="loading"><div class="loading-icon"></div>當日無美容師可提供此服務</div>'; 
    return; 
  }
  
  s.innerHTML = '';

  // 不指定美容師
  const autoEl = document.createElement('div');
  autoEl.className = 'staff-item';
  autoEl.innerHTML = `
    <div class="staff-avatar" style="background-image: url('${getStaffAvatar('auto')}')"></div>
    <div class="staff-info">
      <div class="staff-name">不指定美容師</div>
      <div class="staff-time">系統自動分配</div>
    </div>
  `;
  autoEl.onclick = function () {
    document.querySelectorAll('.staff-item').forEach(x=>x.classList.remove('active'));
    autoEl.classList.add('active');
    document.getElementById('selectedStaff').value = 'auto';
    renderServices();
    renderSlots();
  };
  s.appendChild(autoEl);

  staffList.forEach(st=>{
    if(!st) return;
    const el = document.createElement('div');
    el.className='staff-item';
    el.innerHTML = `
      <div class="staff-avatar" style="background-image: url('${getStaffAvatar(st.name)}')"></div>
      <div class="staff-info">
        <div class="staff-name">${st.name} 老師</div>
        <div class="staff-time">營業時間：${st.start}~${st.end}</div>
      </div>
    `;
    el.onclick = function handleStaffClick() {
      document.querySelectorAll('.staff-item').forEach(x=>x.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('selectedStaff').value = st.name;
      renderServices();
      renderSlots();
    };
    s.appendChild(el);
  });
}

function renderSlots(){
  const date = document.getElementById('selectedDate').value.trim();
  const staffName = document.getElementById('selectedStaff').value.trim();
  const serviceName = document.getElementById('selectedService').value.trim();
  const g = document.getElementById('timeGrid');

  if(!serviceName){ g.innerHTML='<div class="loading"><div class="loading-icon"></div>請先選擇服務項目</div>'; return; }
  if(!date || !staffName){ g.innerHTML='<div class="loading"><div class="loading-icon"></div>請先選擇日期和美容師</div>'; return; }

  const staffList = GLOBAL_DATA.staffData[date] || [];
  const staffInfo = staffList.find(s => s.name === staffName) || {};
  const serviceInfo = GLOBAL_DATA.allServices.find(s => s.name === serviceName) || {};
  const serviceDuration = serviceInfo?.duration || 60;

  let workStart = staffInfo.start || "09:00";
  let workEnd = staffInfo.end || "21:00";

  g.innerHTML = '<div class="loading"><div class="loading-icon"></div>載入可用時段中...</div>';
  document.getElementById('selectedTime').value = '';
  document.getElementById('nextToInfo').disabled = true;

  gasRequest("getSlots", { 
    date: date, 
    staff: staffName, 
    service: serviceName 
  }, function handleSlotResponse(res){
    if(!res || res?.status !== "success"){
      const msg = res?.message || '網路異常，無法載入時段';
      showModal('error','載入失敗', msg);
      g.innerHTML = '<div class="loading"><div class="loading-icon"></div>載入時段失敗，請重新選擇</div>';
      return;
    }

    let slots = res.slots || [];
    g.innerHTML = '';

    slots = slots.filter(item => {
      return item?.time && isTimeSlotValid(item.time, workStart, workEnd, serviceDuration, date);
    });

    if(slots.length === 0){
      g.innerHTML = '<div class="loading"><div class="loading-icon"></div>當前無可用預約時段</div>';
      return;
    }

    slots.forEach((item)=>{
      if(!item?.time) return;
      const timeText = item.time.trim();
      const b = document.createElement('div');
      b.className = 'time-btn';
      b.textContent = timeText;
      
      b.onclick = function handleTimeClick() {
        document.querySelectorAll('.time-btn').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        document.getElementById('selectedTime').value = timeText;
        document.getElementById('nextToInfo').disabled = false;
      };
      g.appendChild(b);
    });
  });
}

function loadAllData(){
  gasRequest("getAllData",{},function handleAllDataResponse(res){
    document.getElementById('loadingOverlay').style.display='none';
    if(res?.status==="success"){
      GLOBAL_DATA.dateList = res.dateList || [];
      GLOBAL_DATA.allServices = res.services || [];
      GLOBAL_DATA.staffData = res.staffData || {};
      GLOBAL_DATA.staffServices = res.staffServices || {};
      renderServices();
      renderDates();
    }else{
      showModal('error','初始化失敗',res?.message||'系統初始化失敗，請刷新頁面重試');
    }
  });
}

function submit(){
  const submitBtn = document.getElementById('submitBtn');
  
  if(submitBtn.disabled) return;

  if(!userId){
    showModal('error','登錄異常','請使用LINE登錄後再提交預約');
    return;
  }

  const selectedService = document.getElementById('selectedService').value.trim();
  const selectedDate = document.getElementById('selectedDate').value.trim();
  const selectedStaff = document.getElementById('selectedStaff').value.trim();
  const selectedTime = document.getElementById('selectedTime').value.trim();

  if(!selectedService){
    showModal('error','資料 incomplete','請先選擇服務項目！');
    goStep(1);
    return;
  }
  if(!selectedDate){
    showModal('error','資料 incomplete','請先選擇預約日期！');
    goStep(2);
    return;
  }
  if(!selectedStaff){
    showModal('error','資料 incomplete','請先選擇美容師！');
    goStep(2);
    return;
  }
  if(!selectedTime){
    showModal('error','資料 incomplete','請先選擇預約時段！');
    goStep(2);
    return;
  }

  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  if(!name){
    showModal('error','填寫錯誤','請輸入您的姓名');
    return;
  }
  if(!/^09\d{2}-\d{3}-\d{3}$/.test(phone)){
    showModal('error','填寫錯誤','請輸入正確電話格式：0912-345-678');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.classList.add('loading');
  submitBtn.textContent = '提交中...';

  const y = document.getElementById('birthYear').value;
  const m = document.getElementById('birthMonth').value;
  const d = document.getElementById('birthDay').value;
  const birthday = (y && m && d) ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : '';

  const data = {
    lineId: userId,
    lineName: userName,
    date: selectedDate,
    service: selectedService,
    staff: selectedStaff,
    appointTime: selectedTime,
    name: name,
    phone: phone,
    birthday: birthday,
    extraInfo: document.getElementById('extraInfo').value.trim()
  };
  
  gasRequest("submit",data,function handleSubmitResponse(res){
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    submitBtn.textContent = '確認提交預約';

    if(res?.status==="success"){
      showModal('success','預約成功','您的預約已提交，我們會盡快與您確認！');
      setTimeout(()=>window.location.reload(),2000);
    }else{
      showModal('error','預約失敗',res?.message||'提交失敗，請稍後重試');
    }
  });
}

// LIFF初始化
async function initLiff() {
  try {
    const liffReady = await new Promise(resolve => {
      let time = 0;
      const check = () => {
        if (window.liff) resolve(true);
        else if (time++ > 50) resolve(false);
        else setTimeout(check, 100);
      };
      check();
    });

    if (liffReady && liff.isInClient()) {
      await liff.init({ liffId: CONFIG.LIFF_ID });
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      const profile = await liff.getProfile();
      userId = profile.userId;
      userName = profile.displayName;
      document.getElementById('lineId').value = userId;
      document.getElementById('lineName').value = userName;
    }
  } catch (e) {
    console.log("非LINE環境，使用游客模式");
  } finally {
    checkAdmin();
    loadAllData();
  }
}

// 管理員功能
function checkAdmin() {
  if (!userId) return;
  gasRequest("checkAdmin", { uid: userId }, res => {
    if (res.status === "success" && res.isAdmin) {
      document.getElementById("adminFloat").style.display = "block";
      loadAdminStaff();
    }
  });
}

function loadAdminStaff() {
  gasRequest("getAdminStaff", {}, res => {
    if (res.status === "success") {
      const sel = document.getElementById("adminStaff");
      sel.innerHTML = '<option value="">選擇美容師</option>';
      res.staffList.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        sel.appendChild(opt);
      });
    }
  });
}

document.getElementById("adminFloat").onclick = () => {
  document.getElementById("adminPanel").style.display = "flex";
  loadScheduleList();
};
document.getElementById("adminClose").onclick = () => {
  document.getElementById("adminPanel").style.display = "none";
};

document.querySelectorAll(".admin-tab-btn").forEach(t => {
  t.onclick = () => {
    document.querySelectorAll(".admin-tab-btn").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".admin-section").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById("admin" + t.dataset.admin.charAt(0).toUpperCase() + t.dataset.admin.slice(1)).classList.add("active");
  };
});

document.getElementById("saveSchedule").onclick = () => {
  const staff = document.getElementById("adminStaff").value;
  const date = document.getElementById("adminDate").value;
  const start = document.getElementById("adminStart").value;
  const end = document.getElementById("adminEnd").value;
  if (!staff || !date || !start || !end) {
    showModal("error", "錯誤", "請填寫完整");
    return;
  }
  gasRequest("saveSchedule", { staff, date, start, end }, res => {
    if (res.status === "success") {
      showModal("success", "成功", "班表儲存完成");
      loadScheduleList();
      loadAllData();
    } else {
      showModal("error", "失敗", res.message);
    }
  });
};

function loadScheduleList() {
  const staff = document.getElementById("adminStaff").value;
  if (!staff) return;
  gasRequest("getScheduleList", { staff }, res => {
    const list = document.getElementById("scheduleList");
    list.innerHTML = "";
    if (res.status === "success" && res.list.length > 0) {
      res.list.forEach(item => {
        const div = document.createElement("div");
        div.className = "admin-item";
        div.innerHTML = `${item.date} ${item.start}~${item.end} <span class="admin-del" onclick="delSchedule('${staff}','${item.date}','${item.start}','${item.end}')">刪除</span>`;
        list.appendChild(div);
      });
    } else {
      list.innerHTML = "<div class='loading'>無班表</div>";
    }
  });
}

function delSchedule(staff, date, start, end) {
  if (!confirm("確定刪除？")) return;
  gasRequest("delSchedule", { staff, date, start, end }, res => {
    if (res.status === "success") {
      showModal("success", "成功", "已刪除");
      loadScheduleList();
      loadAllData();
    } else {
      showModal("error", "失敗", res.message);
    }
  });
}

document.getElementById("queryRecord").onclick = () => {
  const date = document.getElementById("recordDate").value;
  if (!date) {
    showModal("error", "錯誤", "請選擇日期");
    return;
  }
  gasRequest("getRecordByDate", { date }, res => {
    const list = document.getElementById("recordList");
    list.innerHTML = "";
    if (res.status === "success" && res.list.length > 0) {
      res.list.forEach(r => {
        const div = document.createElement("div");
        div.className = "admin-item";
        div.innerHTML = `
          ${r.staff} | ${r.service}<br>
          ${r.time} | ${r.name} ${r.phone}<br>
          備註：${r.note || '無'}
        `;
        list.appendChild(div);
      });
    } else {
      list.innerHTML = "<div class='loading'>當日無預約</div>";
    }
  });
}

// 頁面加載完成
document.addEventListener('DOMContentLoaded',async function handleDOMContentLoaded(){
  initBirthdaySelect();
  
  const phoneInput = document.getElementById('phone');
  phoneInput.addEventListener('input', (e) => {
    e.target.value = formatPhoneNumber(e.target.value);
  });

  document.getElementById('modalBtn').onclick = closeModal;
  
  const searchInput = document.getElementById('serviceSearch');
  const searchClear = document.getElementById('searchClear');
  searchInput.addEventListener('input', function handleSearchInput(e){
    searchKeyword = e.target.value.trim();
    searchClear.classList.toggle('show', searchKeyword!=='');
    renderServices();
  });
  searchClear.addEventListener('click', function handleSearchClear(){
    searchInput.value = '';
    searchKeyword = '';
    searchClear.classList.remove('show');
    renderServices();
  });
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click',function(){
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.cate;
      renderServices();
    });
  });
  
  document.getElementById('nextToDate').addEventListener('click',()=>{
    renderStaff(document.getElementById('selectedDate').value);
    goStep(2);
  });
  document.getElementById('nextToInfo').addEventListener('click',()=>goStep(3));
  document.getElementById('submitBtn').addEventListener('click',submit);
  
  await initLiff();
});
