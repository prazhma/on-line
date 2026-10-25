/* ============================================================
   ПИН-АВТО — СКРИПТ ОПЕРАТИВНОГО КАЛЕНДАРЯ (ОПТИМИЗИРОВАННЫЙ)
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
        
        let isSelected = false;
        if (activeDate) {
            isSelected = (activeDate === dateStr);
        } else {
            isSelected = (weekIndex === 0) ? isToday : (i === 0);
        }

        let c4 = document.createElement('div');
        c4.className = 'card-v4' + (isSelected ? ' selected' : '') + (isToday ? ' is-today' : '');
        c4.setAttribute('data-date', dateStr);
        c4.style.position = 'relative'; 
        c4.style.overflow = 'hidden'; 
        
        c4.innerHTML = `
            ${isToday ? `<div class="badge-today">СЕГОДНЯ</div>` : ''}
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
        
        branchSelect.innerHTML = '<option value="">-- Выберите филиал --</option>';
        
        let branchesList = Array.isArray(data.branches) 
            ? data.branches 
            : Object.keys(data.branches).map(k => data.branches[k]);

        branchesList.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.CUSTOMER_ID || b.id;
            opt.textContent = b.CUSTOMER_NAME || b.name || `Филиал #${opt.value}`;
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
    if (savedRefresh) refreshSelect.value = savedRefresh;

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
                nextRefreshTimeMs = Date.now() + ms; 
                left = ms;
            }
            updateTimerDisplay(left);
        }, 1000);
    } else {
        timerContainer.style.display = 'none'; 
    }
}

function updateTimerDisplay(timeLeftMs = nextRefreshTimeMs - Date.now()) {
    if (timeLeftMs < 0) timeLeftMs = 0;
    let totalSecs = Math.floor(timeLeftMs / 1000);
    let display = document.getElementById('lightTimerDisplay');
    if (display) {
        display.innerText = String(Math.floor(totalSecs / 60)).padStart(2, '0') + ':' + String(totalSecs % 60).padStart(2, '0');
    }
}

window.loadTimelineGrid = async function(isAutoRefresh = false) {
    const branchId = document.getElementById('branchSelect').value;
    const dateStr = document.getElementById('dateSelect').value;
    const container = document.getElementById('timelineContainer');

    if (!branchId || !dateStr || !container) return;
    
    if (!isAutoRefresh) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; font-weight: bold; color: #1e5799;">Загрузка расписания...</div>';
        const ms = parseInt(document.getElementById('refreshSelect').value, 10);
        if (ms > 0) {
            nextRefreshTimeMs = Date.now() + ms;
            updateTimerDisplay();
        }
    }

    try {
        const res = await fetch(`api/calendar_data.php?action=events&customer_id=${branchId}&start=${dateStr}&end=${dateStr}`);
        const data = await res.json();
        if (data.status === 'success') renderStocrmTimeline(branchId, dateStr, data.events || []);
    } catch (e) {}
};

function getContrastYIQ(hexcolor){
    if (!hexcolor) return 'black';
    let hex = hexcolor.replace("#", "").padEnd(6, hexcolor.replace("#", ""));
    let r = parseInt(hex.substr(0,2),16), g = parseInt(hex.substr(2,2),16), b = parseInt(hex.substr(4,2),16);
    return (((r*299)+(g*587)+(b*114))/1000 >= 128) ? 'black' : 'white';
}

function renderStocrmTimeline(branchId, dateStr, events) {
    const container = document.getElementById('timelineContainer');
    const branchData = globalConfig.branches[branchId];
    const postsObj = branchData.posts || {};
    
    let postsList = Array.isArray(postsObj) 
        ? postsObj.map(p => ({ id: String(p.POST_ID || p.id), name: p.NAME || p.name }))
        : Object.keys(postsObj).map(k => ({ id: String(postsObj[k].POST_ID || postsObj[k].id || k), name: postsObj[k].NAME || postsObj[k].name }));

    if (postsList.length === 0) {
        container.innerHTML = '<div class="slots-empty-notice">Для данного филиала не настроены посты</div>';
        return;
    }

    let dayOfWeek = new Date(dateStr).getDay();
    dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; 
    let startMin = 540, endMin = 1200;  

    if (branchData.work_time && branchData.work_time[dayOfWeek]) {
        startMin = parseInt(branchData.work_time[dayOfWeek].START);
        endMin = parseInt(branchData.work_time[dayOfWeek].END);
    }

    let timeSlots = [];
    for (let h = Math.floor(startMin / 60); h < Math.ceil(endMin / 60); h++) {
        timeSlots.push({ hour: h, min: 0, label: `${String(h).padStart(2, '0')}:00` });
    }

    let html = `<div class="stocrm-timeline-wrap"><table class="stocrm-table"><thead><tr><th class="post-name-col">Пост / Время</th>`;
    timeSlots.forEach(s => html += `<th>${s.label}</th>`);
    html += `</tr></thead><tbody>`;

    postsList.forEach(post => {
        html += `<tr><td class="post-name-col">${escapeHtml(post.name)}</td>`;
        timeSlots.forEach(slot => {
            let slotStart = slot.hour * 60 + slot.min;
            let slotEnd = slotStart + 60; 

            let cellEvents = events.filter(ev => {
                if (String(ev.resourceId) !== String(post.id)) return false;
                let evStart = new Date(ev.start).getHours() * 60 + new Date(ev.start).getMinutes();
                if (evStart < startMin && slotStart === startMin) return true;
                return evStart >= slotStart && evStart < slotEnd;
            });
            
            html += `<td class="time-cell">`;
            cellEvents.forEach(ev => {
                let p = ev.extendedProps || {};
                let startD = new Date(ev.start), endD = new Date(ev.end);
                let evStart = Math.max(startMin, startD.getHours() * 60 + startD.getMinutes());
                let evEnd = Math.min(endMin, endD.getHours() * 60 + endD.getMinutes());
                let duration = Math.max(15, evEnd - evStart); 

                let leftPct = ((evStart - slotStart) / 60) * 100;
                let widthPct = (duration / 60) * 100;
                
                let isRes = !p.offer_id || p.offer_id === '0';
                let bgColor = p.card_color || (isRes ? '#e2e8f0' : '#84cc16');
                let textColor = getContrastYIQ(bgColor);
                let encodedEv = encodeURIComponent(JSON.stringify(ev));
                
                html += `
                    <div class="timeline-event-card ${textColor === 'white' ? 'text-white' : 'text-black'}" 
                         style="background-color:${bgColor}; color:${textColor}; left:${leftPct}%; width:calc(${widthPct}% - 4px); top:5px; height:140px;"
                         onmouseenter="showGlobalTooltip(this, '${encodedEv}')" 
                         onmouseleave="hideGlobalTooltip()"
                         onclick="openEventModalFromCard('${encodedEv}')">
                        <div class="tec-header">
                            <span>🕒 ${startD.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}-${endD.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            <span>${escapeHtml(p.status_name)}</span>
                        </div>
                        <div class="tec-client">👤 ${escapeHtml(p.client_name)}</div>
                        ${p.client_phone ? `<div class="tec-phone">📞 ${escapeHtml(p.client_phone)}</div>` : ''}
                        <div class="tec-auto">🚗 ${escapeHtml(ev.title)} ${p.car_plate ? `<span class="car-plate-web20">${escapeHtml(p.car_plate)}</span>` : ''}</div>
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
    if (tooltipTimeout) { clearTimeout(tooltipTimeout); tooltipTimeout = null; }
    let ev = JSON.parse(decodeURIComponent(encodedJson));
    let p = ev.extendedProps || {};
    
    let tooltip = document.getElementById('global-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'global-tooltip';
        tooltip.className = 'event-tooltip-global';
        document.body.appendChild(tooltip);
    }
    
    let bgColor = p.card_color || ((!p.offer_id || p.offer_id === '0') ? '#e2e8f0' : '#84cc16');
    let textColor = getContrastYIQ(bgColor) === 'white' ? '#fff' : '#000';
    
    tooltip.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
            <div>
                <div style="font-size: 15px; font-weight: bold; color: #1e293b; margin-bottom: 4px;">${escapeHtml(ev.title)}</div>
                <div style="font-size: 12px; color: #64748b;">⏱ ${new Date(ev.start).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} – ${new Date(ev.end).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            <span class="status-badge" style="background:${bgColor}; color:${textColor};">${escapeHtml(p.status_name)}</span>
        </div>
        <div style="display: grid; gap: 8px; font-size: 13px; color: #334155;">
            <div>👤 <b>${escapeHtml(p.client_name)}</b></div>
            <div>📞 ${escapeHtml(p.client_phone || 'Не указан')}</div>
            <div>🚗 ${escapeHtml(ev.title)} ${p.car_plate ? `<span class="modal-plate" style="font-size:11px;">${escapeHtml(p.car_plate)}</span>` : ''}</div>
        </div>
        ${p.display_comment ? `<div style="margin-top:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px; font-size:12px; color:#475569;"><b>📝 Описание:</b><br>${escapeHtml(p.display_comment)}</div>` : ''}
    `;
    
    tooltip.style.display = 'block';
    let rect = el.getBoundingClientRect();
    let top = rect.top - tooltip.offsetHeight - 12 + window.scrollY; 
    let left = Math.max(10, rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + window.scrollX); 
    
    tooltip.style.top = (top < window.scrollY + 10 ? rect.bottom + 12 + window.scrollY : top) + 'px';
    tooltip.style.left = left + 'px';
    setTimeout(() => { tooltip.style.opacity = '1'; }, 10);
};

window.hideGlobalTooltip = function() {
    let tooltip = document.getElementById('global-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        tooltipTimeout = setTimeout(() => { tooltip.style.display = 'none'; }, 150);
    }
};

window.switchModalTab = function(tabName) {
    document.getElementById('tab-works').style.display = tabName === 'works' ? 'block' : 'none';
    document.getElementById('tab-comments').style.display = tabName === 'comments' ? 'block' : 'none';
    
    document.getElementById('btn-tab-works').className = 'modal-tab-btn' + (tabName === 'works' ? ' active' : '');
    document.getElementById('btn-tab-comments').className = 'modal-tab-btn' + (tabName === 'comments' ? ' active' : '');
};

window.openEventModalFromCard = function(encodedJson) {
    hideGlobalTooltip(); 
    openEventDetailsModal(JSON.parse(decodeURIComponent(encodedJson)));
};

function openEventDetailsModal(ev) {
    const modal = document.getElementById('eventModal');
    const content = document.getElementById('modalContent');
    modal.classList.add('is-open');
    content.style.display = 'block';
    
    const p = ev.extendedProps || {};
    const isRes = !p.offer_id || p.offer_id === '0';
    let bgColor = p.card_color || (isRes ? '#e2e8f0' : '#84cc16');
    let textColor = getContrastYIQ(bgColor) === 'white' ? '#fff' : '#000';

    content.innerHTML = `
        <div class="booking-card" style="margin-bottom:0; box-shadow:none; border:none; padding:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:13px;">
                <div>${p.offer_id ? `<a href="https://pin-avto.stocrm.ru/offer/${p.offer_id}" target="_blank" style="color:#3b82f6; font-weight:bold;">Сделка #${p.offer_id}</a>` : `<span style="color:#64748b; font-weight:bold;">Резерв времени</span>`}</div>
                <span class="status-badge" style="background:${bgColor}; color:${textColor};">${escapeHtml(p.status_name || 'Активна')}</span>
            </div>
            <div style="margin-bottom:12px;">
                <div class="modal-client-name">${escapeHtml(p.client_name || 'Гость')}</div>
                <div class="modal-client-meta">📞 ${escapeHtml(p.client_phone || 'Не указан')} | ⏱ ${new Date(ev.start).toLocaleDateString('ru-RU')}, ${new Date(ev.start).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} – ${new Date(ev.end).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            <div class="modal-car-info">
                <span>🚗 ${escapeHtml(ev.title || 'Автомобиль')}</span>
                ${p.car_plate ? `<span class="modal-plate">${escapeHtml(p.car_plate)}</span>` : ''}
                ${p.car_vin ? `<span class="modal-vin">🔑 ${escapeHtml(p.car_vin)}</span>` : ''}
            </div>
            <div class="modal-tabs-container">
                <div id="btn-tab-works" class="modal-tab-btn" onclick="switchModalTab('works')">Работы</div>
                <div id="btn-tab-comments" class="modal-tab-btn active" onclick="switchModalTab('comments')">Комментарий</div>
            </div>
            <div id="tab-works" style="display:none;">
                ${isRes ? `<div class="modal-info-box">Для резерва времени работы не предусмотрены.</div>` : `<div id="dynamicWorksArea"><div class="modal-info-box" style="color:#3b82f6; font-weight:bold;">Загрузка состава работ... ⏳</div></div>`}
            </div>
            <div id="tab-comments" style="display:block;">
                <div class="modal-comment-box">${p.display_comment ? escapeHtml(p.display_comment) : '<span style="color:#94a3b8; font-style:italic;">Комментарий отсутствует</span>'}</div>
            </div>
        </div>
    `;

    if (!isRes && p.offer_id) {
        fetch(`api/calendar_data.php?action=offer_details&offer_id=${p.offer_id}`)
            .then(res => res.json())
            .then(data => {
                let area = document.getElementById('dynamicWorksArea');
                if (!area) return;
                if (data.status === 'success' && data.works && data.works.length > 0) {
                    let wHtml = data.works.map(w => `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed #e2e8f0; font-size:13px;"><span>${escapeHtml(w.NAME)}</span><span style="font-weight:bold;">${parseFloat(w.PRICE)} ₽</span></div>`).join('');
                    area.innerHTML = wHtml + `<div style="display:flex; justify-content:flex-end; gap:15px; margin-top:15px; font-size:15px; font-weight:bold;"><span style="color:#475569;">Итого:</span><span style="color:#16a34a;">${data.sum} ₽</span></div>`;
                } else {
                    area.innerHTML = `<div class="modal-info-box">Работы не добавлены. Сумма: ${data.sum || 0} ₽</div>`;
                }
            })
            .catch(() => { document.getElementById('dynamicWorksArea').innerHTML = `<div style="color:red; padding:10px;">Ошибка связи со STOCRM.</div>`; });
    }
}

window.closeEventModal = function(e) {
    if (e && e.target !== document.getElementById('eventModal')) return;
    document.getElementById('eventModal')?.classList.remove('is-open');
};

function escapeHtml(str) { return String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }