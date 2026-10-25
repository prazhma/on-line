/* ============================================================
   ПИН-АВТО — СКРИПТ ОПЕРАТИВНОГО КАЛЕНДАРЯ (JS/CALENDAR.JS)
   ============================================================ */

/* ============================================================
   МУЛЬТЯШНАЯ МАШИНКА — АНИМАЦИЯ ПРИ АВТООБНОВЛЕНИИ
   (проезд ~5 секунд)
   ============================================================ */
(function () {
  if (document.getElementById('cartoon-car-styles')) return;

  const style = document.createElement('style');
  style.id = 'cartoon-car-styles';
  style.textContent = `
    .ccar-wrap {
      position: fixed; left: 0; right: 0; bottom: 0;
      height: 90px; pointer-events: none; z-index: 99999; overflow: hidden;
    }
    .ccar-runner {
      position: absolute; bottom: 8px; left: -260px;
      width: 220px; height: 90px; will-change: transform;
    }
    .ccar-body {
      position: absolute; bottom: 18px; left: 0;
      width: 220px; height: 70px; transform-origin: 50% 100%;
    }
    .ccar-svg { display: block; width: 100%; height: 100%; }
    .ccar-wheel {
      transform-box: fill-box; transform-origin: center;
      animation: ccar-spin 0.7s linear infinite;
    }
    @keyframes ccar-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
    .ccar-bounce { animation: ccar-bounce 0.4s ease-in-out infinite alternate; }
    @keyframes ccar-bounce { from { transform: translateY(0); } to { transform: translateY(-2px); } }
    .ccar-dust {
      position: absolute; bottom: 14px; left: 20px; width: 16px; height: 16px;
      border-radius: 50%; background: rgba(180,180,180,0.85); opacity: 0;
      animation: ccar-puff 1.2s ease-out forwards;
    }
    @keyframes ccar-puff {
      0%   { opacity: 0.9; transform: translate(0,0) scale(0.4); }
      60%  { opacity: 0.5; transform: translate(-30px,-18px) scale(1.6); }
      100% { opacity: 0;   transform: translate(-55px,-30px) scale(2.2); }
    }
    .ccar-skid {
      position: absolute; bottom: 10px; left: -10px; width: 40px; height: 6px;
      border-radius: 4px; background: rgba(90,90,90,0.7); opacity: 0;
      animation: ccar-skid 0.8s ease-out forwards;
    }
    @keyframes ccar-skid {
      0%   { opacity: 0.9; transform: translateX(0) scaleX(0.3); }
      70%  { opacity: 0.4; transform: translateX(-60px) scaleX(1); }
      100% { opacity: 0;   transform: translateX(-90px) scaleX(0.4); }
    }
    .ccar-runner.ccar-go {
      animation: ccar-drive 5s cubic-bezier(0.4, 0.05, 0.7, 0.6) forwards;
    }
    @keyframes ccar-drive {
      0%   { transform: translateX(0) rotate(0deg); }
      6%   { transform: translateX(10px) rotate(-4deg); }
      15%  { transform: translateX(60px) rotate(-2deg); }
      88%  { transform: translateX(calc(100vw + 260px)) rotate(0deg); }
      100% { transform: translateX(calc(100vw + 300px)) rotate(0deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ccar-runner.ccar-go { animation-duration: 0.01s; }
      .ccar-wheel, .ccar-bounce, .ccar-dust, .ccar-skid { animation: none; }
    }
  `;
  document.head.appendChild(style);

  const COLORS = ['#e63946','#ff6b35','#f9c74f','#43aa8b','#4d96ff','#b388ff','#ff5d8f','#00c2a8'];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function buildCarSVG(bodyColor) {
    const dark = '#2b2d42';
    return `
      <svg class="ccar-svg" viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
        <g class="ccar-bounce">
          <ellipse cx="110" cy="84" rx="95" ry="6" fill="rgba(0,0,0,0.15)"/>
          <path d="M15,60 Q10,40 30,38 L60,38 Q70,18 100,18 L135,18 Q160,20 175,38 L200,42 Q210,44 208,60 L204,66 Q200,70 190,70 L30,70 Q18,70 15,60 Z"
                fill="${bodyColor}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>
          <path d="M72,36 Q80,24 98,24 L108,24 L108,36 Z" fill="#cfe8ff" stroke="${dark}" stroke-width="2"/>
          <path d="M114,24 L130,24 Q148,26 156,36 L114,36 Z" fill="#cfe8ff" stroke="${dark}" stroke-width="2"/>
          <path d="M40,44 Q60,42 80,44" stroke="rgba(255,255,255,0.55)" stroke-width="4" fill="none" stroke-linecap="round"/>
          <circle cx="196" cy="52" r="5" fill="#fff8b0" stroke="${dark}" stroke-width="2"/>
          <g>
            <circle cx="60" cy="70" r="14" fill="#1b1b1f" stroke="${dark}" stroke-width="3"/>
            <g class="ccar-wheel" style="transform-origin:60px 70px;">
              <line x1="60" y1="58" x2="60" y2="82" stroke="#bbb" stroke-width="3" stroke-linecap="round"/>
              <line x1="48" y1="70" x2="72" y2="70" stroke="#bbb" stroke-width="3" stroke-linecap="round"/>
            </g>
            <circle cx="60" cy="70" r="4" fill="#888"/>
          </g>
          <g>
            <circle cx="165" cy="70" r="14" fill="#1b1b1f" stroke="${dark}" stroke-width="3"/>
            <g class="ccar-wheel" style="transform-origin:165px 70px;">
              <line x1="165" y1="58" x2="165" y2="82" stroke="#bbb" stroke-width="3" stroke-linecap="round"/>
              <line x1="153" y1="70" x2="177" y2="70" stroke="#bbb" stroke-width="3" stroke-linecap="round"/>
            </g>
            <circle cx="165" cy="70" r="4" fill="#888"/>
          </g>
        </g>
      </svg>`;
  }

  let running = false;
  window.showCarAnimation = function () {
    if (running) return;
    running = true;

    const wrap = document.createElement('div');
    wrap.className = 'ccar-wrap';
    const runner = document.createElement('div');
    runner.className = 'ccar-runner';
    const body = document.createElement('div');
    body.className = 'ccar-body';
    body.innerHTML = buildCarSVG(pick(COLORS));

    runner.appendChild(body);
    wrap.appendChild(runner);
    document.body.appendChild(wrap);

    requestAnimationFrame(() => runner.classList.add('ccar-go'));

    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const d = document.createElement('div');
        d.className = 'ccar-dust';
        d.style.left = (20 + Math.random() * 30) + 'px';
        d.style.bottom = (10 + Math.random() * 14) + 'px';
        const size = 10 + Math.random() * 12;
        d.style.width = size + 'px';
        d.style.height = size + 'px';
        d.style.animationDelay = (Math.random() * 0.2) + 's';
        runner.appendChild(d);
        setTimeout(() => d.remove(), 1600);
      }, i * 80);
    }
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const s = document.createElement('div');
        s.className = 'ccar-skid';
        s.style.bottom = (8 + Math.random() * 10) + 'px';
        s.style.animationDelay = (Math.random() * 0.15) + 's';
        runner.appendChild(s);
        setTimeout(() => s.remove(), 1400);
      }, i * 100);
    }

    // Очистка: длительность анимации (5000) + запас 600 мс
    setTimeout(() => { wrap.remove(); running = false; }, 5600);
  };
})();

/* ============================================================
   ОСНОВНАЯ ЛОГИКА КАЛЕНДАРЯ
   ============================================================ */

let globalConfig = null;
let autoRefreshInterval = null;
let timerCountdownInterval = null;
let nextRefreshTimeMs = 0;
let tooltipTimeout = null; 

const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

document.addEventListener('DOMContentLoaded', () => {
    buildWeekTab(0);
    initDashboardBranches();
    initAutoRefresh();
});

window.switchWeekTab = function(idx) {
    let btnPrev = document.getElementById('btnWeekPrev');
    if (btnPrev) btnPrev.classList.toggle('active', idx === -1);
    document.getElementById('btnWeekCurrent').classList.toggle('active', idx === 0);
    document.getElementById('btnWeekNext').classList.toggle('active', idx === 1);
    
    // Сбрасываем выбранную дату при ручном переключении вкладок недель, 
    // чтобы скрипт автоматически выбрал "Сегодня" или "Понедельник"
    document.getElementById('dateSelect').value = ''; 
    
    buildWeekTab(idx);
};

function buildWeekTab(weekIndex) {
    let g4 = document.getElementById('grid_v4');
    if (!g4) return;
    g4.innerHTML = '';
    
    let realToday = new Date();
    let realTodayStr = `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}-${String(realToday.getDate()).padStart(2, '0')}`;

    let d = new Date();
    let day = d.getDay();
    let diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    let monday = new Date(d.setDate(diff));
    
    monday.setDate(monday.getDate() + (weekIndex * 7));

    let activeDate = document.getElementById('dateSelect').value;

    for (let i = 0; i < 7; i++) {
        let currentDay = new Date(monday);
        currentDay.setDate(monday.getDate() + i);
        
        let dateStr = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
        let label = daysOfWeek[currentDay.getDay()];

        let isToday = (dateStr === realTodayStr);
        
        // УМНЫЙ ФОКУС: 
        // Если дата уже выбрана пользователем - сохраняем её (при автообновлении)
        // Если нет - ставим "Сегодня" для текущей недели или "Понедельник" (i===0) для остальных
        let isSelected = false;
        if (activeDate) {
            isSelected = (activeDate === dateStr);
        } else {
            if (weekIndex === 0) {
                isSelected = isToday;
            } else {
                isSelected = (i === 0); 
            }
        }

        let c4 = document.createElement('div');
        c4.className = 'card-v4' + (isSelected ? ' selected' : '');
        c4.setAttribute('data-date', dateStr);
        c4.style.position = 'relative'; 
        c4.style.overflow = 'hidden'; 
        
        let todayBadge = '';
        if (isToday) {
            todayBadge = `<div style="background:#ef4444; color:#fff; font-size:9px; border-radius:0 0 0 4px; padding:2px 5px; position:absolute; top:0; right:0; font-weight:bold; z-index:5;">СЕГОДНЯ</div>`;
            if (!isSelected) {
                c4.style.border = '2px solid #ef4444';
                c4.style.background = 'linear-gradient(to bottom, #fff5f5 0%, #fee2e2 100%)';
            } else {
                c4.style.border = '2px solid #ef4444'; 
            }
        }

        c4.innerHTML = `
            ${todayBadge}
            <div class="name">${label}</div>
            <div class="date">${currentDay.getDate()} ${months[currentDay.getMonth()]}</div>
        `;
        c4.onclick = () => selectDate(dateStr, c4);
        g4.appendChild(c4);

        if (isSelected) {
            document.getElementById('dateSelect').value = dateStr;
            activeDate = dateStr; 
        }
    }

    // Резервный механизм на случай, если ни один день не выделился
    if (!g4.querySelector('.selected')) {
        let firstCard = g4.querySelector('.card-v4');
        if (firstCard) {
            firstCard.classList.add('selected');
            document.getElementById('dateSelect').value = firstCard.getAttribute('data-date');
        }
    }

    if (document.getElementById('branchSelect').value) loadTimelineGrid(false);
}

function selectDate(dateStr, element) {
    document.querySelectorAll('#grid_v4 .card-v4').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('dateSelect').value = dateStr;
    loadTimelineGrid(false);
}

async function initDashboardBranches() {
    const branchSelect = document.getElementById('branchSelect');
    if (!branchSelect) return;

    try {
        const res = await fetch('api/calendar_data.php?action=get_branches');
        const data = await res.json();

        if (data.status !== 'success' || !data.branches) return;

        globalConfig = data.config || { branches: data.branches };
        const branches = data.branches;
        branchSelect.innerHTML = '<option value="">-- Выберите филиал --</option>';

        let optionsMap = [];
        if (Array.isArray(branches)) {
            optionsMap = branches.map(b => ({ val: String(b.CUSTOMER_ID || b.id), txt: b.CUSTOMER_NAME || b.name || `Филиал #${b.CUSTOMER_ID || b.id}` }));
        } else {
            Object.keys(branches).forEach(bId => {
                optionsMap.push({ val: String(bId), txt: branches[bId].CUSTOMER_NAME || branches[bId].name || `Филиал #${bId}` });
            });
        }

        optionsMap.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.val;
            opt.textContent = o.txt;
            branchSelect.appendChild(opt);
        });

        let savedBranch = localStorage.getItem('stocrm_branch_id');
        if (savedBranch && branchSelect.querySelector(`option[value="${savedBranch}"]`)) {
            branchSelect.value = savedBranch;
        } else if (branchSelect.options.length > 1) {
            branchSelect.selectedIndex = 1;
            localStorage.setItem('stocrm_branch_id', branchSelect.value);
        }

        branchSelect.addEventListener('change', (e) => {
            localStorage.setItem('stocrm_branch_id', e.target.value);
            loadTimelineGrid(false);
        });

        loadTimelineGrid(false);
    } catch (e) {
        branchSelect.innerHTML = '<option value="">Ошибка связи с сервером</option>';
    }
}

function initAutoRefresh() {
    const refreshSelect = document.getElementById('refreshSelect');
    if (!refreshSelect) return;

    let savedRefresh = localStorage.getItem('stocrm_refresh_interval');
    if (savedRefresh) {
        refreshSelect.value = savedRefresh;
    }

    refreshSelect.addEventListener('change', (e) => {
        localStorage.setItem('stocrm_refresh_interval', e.target.value);
        applyAutoRefreshTimer();
    });

    applyAutoRefreshTimer();
}

function applyAutoRefreshTimer() {
    if (timerCountdownInterval) {
        clearInterval(timerCountdownInterval);
        timerCountdownInterval = null;
    }

    const refreshSelect = document.getElementById('refreshSelect');
    const timerContainer = document.getElementById('lightTimerContainer');
    
    if (!refreshSelect || !timerContainer) return;

    const ms = parseInt(refreshSelect.value, 10);
    if (ms > 0) {
        timerContainer.style.display = 'inline-block';
        nextRefreshTimeMs = Date.now() + ms;
        updateTimerDisplay(); 
        
        timerCountdownInterval = setInterval(() => {
            let left = nextRefreshTimeMs - Date.now();
            if (left <= 0) {
                loadTimelineGrid(true); 
                // 🚗💨 Запуск мультяшной машинки при автообновлении
                if (typeof window.showCarAnimation === 'function') window.showCarAnimation();
                nextRefreshTimeMs = Date.now() + ms; 
                left = ms;
            }
            updateTimerDisplay(left);
        }, 1000);
    } else {
        timerContainer.style.display = 'none'; 
    }
}

function updateTimerDisplay(timeLeftMs) {
    if (timeLeftMs === undefined) timeLeftMs = nextRefreshTimeMs - Date.now();
    if (timeLeftMs < 0) timeLeftMs = 0;
    
    let totalSeconds = Math.floor(timeLeftMs / 1000);
    let m = Math.floor(totalSeconds / 60);
    let s = totalSeconds % 60;
    
    let display = document.getElementById('lightTimerDisplay');
    if (display) {
        display.innerText = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
}

window.loadTimelineGrid = async function(isAutoRefresh = false) {
    const branchId = document.getElementById('branchSelect').value;
    const dateStr = document.getElementById('dateSelect').value;
    const container = document.getElementById('timelineContainer');

    if (!branchId || !dateStr || !container) return;
    
    if (!isAutoRefresh) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; font-weight: bold; color: #1e5799;">Загрузка расписания и базовых данных сделок...</div>';
        
        const ms = parseInt(document.getElementById('refreshSelect').value, 10);
        if (ms > 0) {
            nextRefreshTimeMs = Date.now() + ms;
            updateTimerDisplay();
        }
    }

    try {
        const res = await fetch(`api/calendar_data.php?action=events&customer_id=${branchId}&start=${dateStr}&end=${dateStr}`);
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch (jsonErr) { return; }

        if (data.status === 'success') {
            renderStocrmTimeline(branchId, dateStr, data.events || []);
        }
    } catch (e) {}
};

function getContrastYIQ(hexcolor){
    if (!hexcolor) return 'black';
    let hex = hexcolor.replace("#", "");
    if (hex.length === 3) hex = hex[0]+hex[0] + hex[1]+hex[1] + hex[2]+hex[2]; 
    var r = parseInt(hex.substr(0,2),16);
    var g = parseInt(hex.substr(2,2),16);
    var b = parseInt(hex.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}

function renderStocrmTimeline(branchId, dateStr, events) {
    const container = document.getElementById('timelineContainer');
    const branchData = globalConfig.branches[branchId];
    const postsObj = branchData.posts || {};
    
    let postsList = [];
    if (Array.isArray(postsObj)) {
        postsList = postsObj.map(p => ({ id: String(p.POST_ID || p.id), name: p.NAME || p.name }));
    } else {
        Object.keys(postsObj).forEach(k => {
            if (typeof postsObj[k] === 'object') postsList.push({ id: String(postsObj[k].POST_ID || postsObj[k].id || k), name: postsObj[k].NAME || postsObj[k].name });
        });
    }

    if (postsList.length === 0) {
        container.innerHTML = '<div class="slots-empty-notice">Для данного филиала не настроены посты обслуживания</div>';
        return;
    }

    let selectedDate = new Date(dateStr);
    let dayOfWeek = selectedDate.getDay();
    dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; 

    let startMin = 540; 
    let endMin = 1200;  

    if (branchData.work_time && branchData.work_time[dayOfWeek]) {
        startMin = parseInt(branchData.work_time[dayOfWeek].START);
        endMin = parseInt(branchData.work_time[dayOfWeek].END);
    }

    let startHour = Math.floor(startMin / 60);
    let endHour = Math.ceil(endMin / 60);

    let timeSlots = [];
    for (let h = startHour; h < endHour; h++) {
        timeSlots.push({ hour: h, min: 0, label: `${String(h).padStart(2, '0')}:00` });
    }

    let html = `<div class="stocrm-timeline-wrap"><table class="stocrm-table"><thead><tr><th class="post-name-col">Пост / Время</th>`;
    timeSlots.forEach(slot => html += `<th>${slot.label}</th>`);
    html += `</tr></thead><tbody>`;

    postsList.forEach(post => {
        html += `<tr><td class="post-name-col">${escapeHtml(post.name)}</td>`;
        
        timeSlots.forEach(slot => {
            let slotStartMin = slot.hour * 60 + slot.min;
            let slotEndMin = slotStartMin + 60; 

            let cellEvents = events.filter(ev => {
                if (String(ev.resourceId) !== String(post.id)) return false;
                let d = new Date(ev.start);
                let evStartMin = d.getHours() * 60 + d.getMinutes();
                if (evStartMin < startMin && slotStartMin === startMin) return true;
                return evStartMin >= slotStartMin && evStartMin < slotEndMin;
            });
            
            html += `<td class="time-cell">`;
            
            cellEvents.forEach(ev => {
                let p = ev.extendedProps || {};
                
                let startD = new Date(ev.start);
                let endD = new Date(ev.end);
                let evStartMin = startD.getHours() * 60 + startD.getMinutes();
                let evEndMin = endD.getHours() * 60 + endD.getMinutes();
                
                if (evStartMin < startMin) evStartMin = startMin; 
                if (evEndMin > endMin) evEndMin = endMin; 

                let durationMin = evEndMin - evStartMin;
                if (durationMin < 15) durationMin = 15; 

                let leftOffsetMin = evStartMin - slotStartMin;
                let leftPct = (leftOffsetMin / 60) * 100;
                let widthPct = (durationMin / 60) * 100;

                let startTimeStr = startD.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                let endTimeStr = endD.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                let isReservation = !p.offer_id || p.offer_id === 0 || p.offer_id === '0';
                
                let baseColor = p.card_color || (isReservation ? '#e2e8f0' : '#84cc16');
                if (baseColor.length === 4 && baseColor.startsWith('#')) {
                    baseColor = '#' + baseColor[1]+baseColor[1] + baseColor[2]+baseColor[2] + baseColor[3]+baseColor[3];
                }
                
                let textColor = getContrastYIQ(baseColor);
                let textClass = textColor === 'white' ? 'text-white' : 'text-black';
                let bgStyle = `background-color: ${baseColor}; border-color: rgba(0,0,0,0.3);`;

                let plateHtml = p.car_plate ? `<span class="car-plate-web20">${escapeHtml(p.car_plate)}</span>` : '';
                let encodedEv = encodeURIComponent(JSON.stringify(ev));
                
                html += `
                    <div class="timeline-event-card ${textClass}" 
                         style="${bgStyle} color: ${textColor}; left: ${leftPct}%; width: calc(${widthPct}% - 4px); top: 5px; height: 140px;"
                         onmouseenter="showGlobalTooltip(this, '${encodedEv}')" 
                         onmouseleave="hideGlobalTooltip()"
                         onclick="openEventModalFromCard('${encodedEv}')">
                        <div class="tec-header">
                            <span>🕒 ${startTimeStr}-${endTimeStr}</span>
                            <span>${escapeHtml(p.status_name)}</span>
                        </div>
                        <div class="tec-client">👤 ${escapeHtml(p.client_name)}</div>
                        ${p.client_phone ? `<div class="tec-phone">📞 ${escapeHtml(p.client_phone)}</div>` : ''}
                        <div class="tec-auto">🚗 ${escapeHtml(ev.title)} ${plateHtml}</div>
                        ${p.display_comment ? `<div class="tec-comment">${escapeHtml(p.display_comment)}</div>` : ''}
                    </div>`;
            });
            html += `</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

window.showGlobalTooltip = function(el, encodedJson) {
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }

    let ev = JSON.parse(decodeURIComponent(encodedJson));
    let p = ev.extendedProps || {};
    
    let tooltip = document.getElementById('global-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'global-tooltip';
        tooltip.className = 'event-tooltip-global';
        document.body.appendChild(tooltip);
    }
    
    let startTime = new Date(ev.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    let endTime = new Date(ev.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    let isReservation = !p.offer_id || p.offer_id === 0 || p.offer_id === '0';
    
    let bgColor = p.card_color || (isReservation ? '#e2e8f0' : '#84cc16');
    if (bgColor.length === 4 && bgColor.startsWith('#')) {
        bgColor = '#' + bgColor[1]+bgColor[1] + bgColor[2]+bgColor[2] + bgColor[3]+bgColor[3];
    }
    let textColor = getContrastYIQ(bgColor) === 'white' ? '#fff' : '#000';
    
    tooltip.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
            <div>
                <div style="font-size: 15px; font-weight: bold; color: #1e293b; margin-bottom: 4px;">${escapeHtml(ev.title)}</div>
                <div style="font-size: 12px; color: #64748b;">⏱ ${startTime} – ${endTime}</div>
            </div>
            <span style="background:${bgColor}; color:${textColor}; padding: 4px 8px; font-size: 11px; font-weight:bold; border-radius: 6px; border: 1px solid rgba(0,0,0,0.1);">${escapeHtml(p.status_name)}</span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr; gap: 8px; font-size: 13px; color: #334155;">
            <div><span style="color:#94a3b8; width: 20px; display:inline-block;">👤</span> <b>${escapeHtml(p.client_name)}</b></div>
            <div><span style="color:#94a3b8; width: 20px; display:inline-block;">📞</span> ${escapeHtml(p.client_phone || 'Не указан')}</div>
            <div><span style="color:#94a3b8; width: 20px; display:inline-block;">🚗</span> ${escapeHtml(ev.title)} ${p.car_plate ? `<span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; border:1px solid #cbd5e1; font-family:monospace; font-size:11px; margin-left:4px;">${escapeHtml(p.car_plate)}</span>` : ''}</div>
            ${p.car_vin ? `<div><span style="color:#94a3b8; width: 20px; display:inline-block;">🔑</span> <span style="font-family:monospace; font-size:12px;">${escapeHtml(p.car_vin)}</span></div>` : ''}
        </div>

        ${p.display_comment ? `
            <div style="margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-size: 12px; color: #475569; line-height: 1.4;">
                <div style="font-weight:bold; margin-bottom:4px; color:#1e293b;">📝 Описание:</div>
                ${escapeHtml(p.display_comment)}
            </div>
        ` : ''}
    `;
    
    tooltip.style.display = 'block';
    
    let rect = el.getBoundingClientRect();
    let tWidth = tooltip.offsetWidth;
    let tHeight = tooltip.offsetHeight;
    
    let top = rect.top - tHeight - 12 + window.scrollY; 
    let left = rect.left + (rect.width / 2) - (tWidth / 2) + window.scrollX; 
    
    if (top < window.scrollY + 10) {
        top = rect.bottom + 12 + window.scrollY;
    }
    
    if (left < 10) left = 10;
    
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
    
    setTimeout(() => { tooltip.style.opacity = '1'; }, 10);
};

window.hideGlobalTooltip = function() {
    let tooltip = document.getElementById('global-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        if (tooltipTimeout) clearTimeout(tooltipTimeout);
        tooltipTimeout = setTimeout(() => { 
            tooltip.style.display = 'none'; 
        }, 150);
    }
};

window.switchModalTab = function(tabName) {
    document.getElementById('tab-works').style.display = tabName === 'works' ? 'block' : 'none';
    document.getElementById('tab-comments').style.display = tabName === 'comments' ? 'block' : 'none';
    
    const btnWorks = document.getElementById('btn-tab-works');
    const btnComments = document.getElementById('btn-tab-comments');
    
    if (tabName === 'works') {
        btnWorks.style.color = '#0f172a';
        btnWorks.style.borderBottom = '2px solid #3b82f6';
        btnComments.style.color = '#64748b';
        btnComments.style.borderBottom = 'none';
    } else {
        btnComments.style.color = '#0f172a';
        btnComments.style.borderBottom = '2px solid #3b82f6';
        btnWorks.style.color = '#64748b';
        btnWorks.style.borderBottom = 'none';
    }
};

window.openEventModalFromCard = function(encodedJson) {
    hideGlobalTooltip(); 
    let ev = JSON.parse(decodeURIComponent(encodedJson));
    openEventDetailsModal(ev);
};

function openEventDetailsModal(event) {
    const modal = document.getElementById('eventModal');
    const content = document.getElementById('modalContent');
    
    modal.classList.add('is-open');
    content.style.display = 'block';
    
    const props = event.extendedProps || {};
    const isReservation = !props.offer_id || props.offer_id === 0 || props.offer_id === '0';
    
    const clientName = props.client_name || 'Гость';
    const clientPhone = props.client_phone || 'Не указан';
    const carFull = event.title || 'Автомобиль';
    const carVin = props.car_vin || 'Не указан';
    const offerStatus = props.status_name || 'Активна';
    const commentText = props.display_comment || '';

    let startDate = new Date(event.start);
    let endDate = new Date(event.end);
    let dateFormatted = startDate.toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'});
    let timeStr = `${startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} – ${endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

    let bgColor = props.card_color || (isReservation ? '#e2e8f0' : '#84cc16');
    if (bgColor.length === 4 && bgColor.startsWith('#')) {
        bgColor = '#' + bgColor[1]+bgColor[1] + bgColor[2]+bgColor[2] + bgColor[3]+bgColor[3];
    }
    let textColor = getContrastYIQ(bgColor) === 'white' ? '#fff' : '#000';

    content.innerHTML = `
        <div class="booking-card" style="margin-bottom: 0; box-shadow: none; border: none; padding: 0;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 13px;">
                <div>
                    ${props.offer_id 
                        ? `<a href="https://pin-avto.stocrm.ru/offer/${props.offer_id}" target="_blank" style="color: #3b82f6; text-decoration: none; font-weight: bold; border-bottom: 1px dashed #3b82f6;">Сделка #${props.offer_id}</a>` 
                        : `<span style="color: #64748b; font-weight: bold;">Резерв времени (Без сделки)</span>`
                    }
                </div>
                <span id="modal-status-badge" style="background:${bgColor}; color:${textColor}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid rgba(0,0,0,0.1);">${escapeHtml(offerStatus)}</span>
            </div>

            <div style="margin-bottom: 12px;">
                <div style="font-size: 20px; font-weight: bold; color: #0f172a; margin-bottom: 6px;">${escapeHtml(clientName)}</div>
                <div style="font-size: 14px; color: #475569;">
                    📞 ${escapeHtml(clientPhone)} <span style="margin: 0 10px; color: #cbd5e1;">|</span> ⏱ ${dateFormatted}, ${timeStr}
                </div>
            </div>

            <div style="background: #f8fafc; padding: 10px 14px; border-radius: 6px; font-size: 13px; color: #334155; margin-bottom: 20px; border: 1px solid #e2e8f0; display: flex; align-items: center; flex-wrap: wrap; gap: 10px;">
                <span>🚗 ${escapeHtml(carFull)}</span>
                ${props.car_plate ? `<span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;">${escapeHtml(props.car_plate)}</span>` : ''}
                ${carVin !== 'Не указан' ? `<span style="color: #64748b; font-family: monospace;">🔑 ${escapeHtml(carVin)}</span>` : ''}
            </div>

            <div style="display: flex; gap: 24px; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px;">
                <div id="btn-tab-works" onclick="switchModalTab('works')" style="padding-bottom: 8px; cursor: pointer; font-size: 14px; font-weight: bold; color: #64748b; border-bottom: none; margin-bottom: -1px; transition: all 0.2s;">Работы</div>
                <div id="btn-tab-comments" onclick="switchModalTab('comments')" style="padding-bottom: 8px; cursor: pointer; font-size: 14px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #3b82f6; margin-bottom: -1px; transition: all 0.2s;">Комментарий</div>
            </div>

            <div id="tab-works" style="display: none;">
                ${isReservation 
                    ? `<div style="color: #64748b; padding: 15px; text-align: center; background: #f8fafc; border-radius: 6px;">Для резерва времени работы не предусмотрены.</div>` 
                    : `<div id="dynamicWorksArea"><div style="text-align: center; padding: 25px; font-weight: bold; color: #3b82f6;">Загрузка состава работ и стоимости... ⏳</div></div>`
                }
            </div>

            <div id="tab-comments" style="display: block;">
                <div style="color: #334155; font-size: 13px; padding: 15px; background: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1; line-height: 1.6; white-space: pre-wrap; min-height: 80px;">${commentText ? escapeHtml(commentText) : '<span style="color: #94a3b8; font-style: italic;">Комментарий отсутствует</span>'}</div>
            </div>
            
        </div>
    `;

    if (!isReservation && props.offer_id) {
        fetch(`api/calendar_data.php?action=offer_details&offer_id=${props.offer_id}`)
            .then(res => res.json())
            .then(data => {
                let area = document.getElementById('dynamicWorksArea');
                
                if (!area) return;
                
                if (data.status === 'success') {
                    let wHtml = '';
                    if (data.works && data.works.length > 0) {
                        data.works.forEach(w => {
                            wHtml += `<div class="booking-service-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px;">
                                <span class="booking-service-name">${escapeHtml(w.NAME)}</span>
                                <span class="booking-service-price" style="font-weight: bold; white-space: nowrap; margin-left: 15px;">${parseFloat(w.PRICE)} ₽</span>
                            </div>`;
                        });
                        wHtml += `<div class="booking-services-total" style="display: flex; justify-content: flex-end; align-items: center; gap: 15px; margin-top: 15px; padding-top: 15px; font-size: 15px; font-weight: bold;">
                            <span style="color: #475569;">Итого:</span>
                            <span class="booking-services-total-val" style="color: #16a34a;">${data.sum} ₽</span>
                        </div>`;
                    } else {
                        wHtml = `<div style="color: #64748b; padding: 15px; text-align: center; background: #f8fafc; border-radius: 6px; margin-bottom: 15px;">Работы не добавлены.</div>`;
                        wHtml += `<div class="booking-services-total" style="display: flex; justify-content: flex-end; align-items: center; gap: 15px; font-size: 15px; font-weight: bold;">
                            <span style="color: #475569;">Сумма сделки:</span>
                            <span class="booking-services-total-val" style="color: #16a34a;">${data.sum} ₽</span>
                        </div>`;
                    }
                    area.innerHTML = wHtml;
                } else {
                    area.innerHTML = `<div style="color: red; padding: 10px;">Ошибка загрузки работ: ${data.message}</div>`;
                }
            })
            .catch(() => {
                let area = document.getElementById('dynamicWorksArea');
                if (area) area.innerHTML = `<div style="color: red; padding: 10px;">Ошибка связи со STOCRM.</div>`;
            });
    }
}

window.closeEventModal = function(e) {
    if (e && e.target !== document.getElementById('eventModal')) return;
    const modal = document.getElementById('eventModal');
    if (modal) modal.classList.remove('is-open');
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}