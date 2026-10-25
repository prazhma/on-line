/* ============================================================
   ПИН-АВТО — МОДУЛЬ СЕЗОННОГО ХРАНЕНИЯ ШИН (JS/STORAGE.JS)
   ============================================================ */

const mockStorageContract = {
    contractNumber: 'ДХ-2026/09-0142',
    status: 'ACTIVE',
    startDate: '20.05.2026',
    endDate: '20.11.2026',
    daysLeft: 45,
    branchName: 'ТСЦ №2 (ул. Дзержинского, 98/7)',
    tireBrand: 'Nokian Hakkapeliitta 10p',
    tireSize: '205/55 R16 94T',
    type: 'Колеса в сборе (с литыми дисками)',
    seasonSum: '2 400 ₽',
    isPaid: true,
    wheels: [
        {
            position: 'Переднее левое (ПЛ)',
            tag: 'ШТ-00891-1',
            treadDepth: 4,
            maxTread: 10.0,
            statusText: 'Хорошее состояние (равномерный износ)',
            state: 'good'
        },
        {
            position: 'Переднее правое (ПП)',
            tag: 'ШТ-00891-2',
            treadDepth: 4,
            maxTread: 10.0,
            statusText: 'Хорошее состояние (есть латка)',
            state: 'good'
        },
        {
            position: 'Заднее левое (ЗЛ)',
            tag: 'ШТ-00891-3',
            treadDepth: 5,
            maxTread: 10.0,
            statusText: 'Хорошее состояние (равномерный износ)',
            state: 'good'
        },
        {
            position: 'Заднее правое (ЗП)',
            tag: 'ШТ-00891-4',
            treadDepth: 5,
            maxTread: 10.0,
            statusText: 'Хорошее состояние (есть следы ремонта)',
            state: 'good'
        }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    renderStorageModule();
});

function renderStorageModule() {
    const container = document.getElementById('storageContractContainer');
    if (!container) return;

    const data = mockStorageContract;

    let wheelsHtml = '';
    data.wheels.forEach(w => {
        const percent = Math.min(100, Math.round((w.treadDepth / w.maxTread) * 100));
        let colorClass = 'good';
        if (w.treadDepth < 4.0) colorClass = 'crit';
        else if (w.treadDepth < 5.5) colorClass = 'warn';

        wheelsHtml += `
            <div class="wheel-card">
                <div class="wheel-visual-col">
                    <svg viewBox="0 0 100 100" class="wheel-svg-box">
                        <circle cx="50" cy="50" r="46" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
                        <circle cx="50" cy="50" r="41" fill="none" stroke="#475569" stroke-width="2" stroke-dasharray="4 3"/>
                        <circle cx="50" cy="50" r="26" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
                        <circle cx="50" cy="50" r="10" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5"/>
                        <circle cx="50" cy="43" r="2.5" fill="#1e293b"/>
                        <circle cx="57" cy="48" r="2.5" fill="#1e293b"/>
                        <circle cx="54" cy="56" r="2.5" fill="#1e293b"/>
                        <circle cx="46" cy="56" r="2.5" fill="#1e293b"/>
                        <circle cx="43" cy="48" r="2.5" fill="#1e293b"/>
                    </svg>
                    <div class="wheel-pos-tag">${w.position}</div>
                </div>

                <div class="wheel-info-col">
                    <div class="wheel-title">${data.tireBrand}</div>
                    <div class="wheel-barcode-box">Бирка: <b>${w.tag}</b></div>

                    <div class="tread-measure-box">
                        <div class="tread-measure-head">
                            <span style="color: #64748b;">Остаток протектора:</span>
                            <span style="color: #0f172a;"><b>${w.treadDepth} мм</b></span>
                        </div>
                        <div class="tread-track">
                            <div class="tread-fill ${colorClass}" style="width: ${percent}%;"></div>
                        </div>
                    </div>

                    <div class="wheel-sub-status ${colorClass}">
                        <span>●</span> ${w.statusText}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="storage-contract-box">
            <div class="storage-header-card">
                <div class="storage-header-top">
                    <div>
                        <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase;">Договор ответственного хранения</div>
                        <div class="storage-contract-num">${data.contractNumber}</div>
                    </div>
                    <div class="storage-badge-active">
                        <span>●</span> Активный договор
                    </div>
                </div>

                <div class="storage-meta-grid">
                    <div class="storage-meta-item">
                        <span>Период хранения</span>
                        <strong>${data.startDate} — ${data.endDate}</strong>
                    </div>
                    <div class="storage-meta-item">
                        <span>Осталось дней</span>
                        <strong style="color: #38bdf8;">${data.daysLeft} дн.</strong>
                    </div>
                    <div class="storage-meta-item">
                        <span>Тип имущества</span>
                        <strong>${data.type}</strong>
                    </div>
                    <div class="storage-meta-item">
                        <span>Склад / Филиал</span>
                        <strong>${data.branchName}</strong>
                    </div>
                    <div class="storage-meta-item">
                        <span>Оплата</span>
                        <strong style="color: #4ade80;">${data.seasonSum} (Оплачено)</strong>
                    </div>
                </div>
            </div>

            <h3 style="margin: 6px 0 0 0;">Состояние принятого комплекта (4 шт.)</h3>
            <div class="storage-wheels-grid">
                ${wheelsHtml}
            </div>

            <div class="storage-details-card">
                <h3 style="margin-top: 0; margin-bottom: 12px;">Условия хранения и спецификация</h3>
                <table class="data-table" style="margin-bottom: 16px;">
                    <tbody>
                        <tr>
                            <td style="width: 35%; color: #64748b; font-weight: bold;">Размерность шин:</td>
                            <td><b>${data.tireSize}</b></td>
                        </tr>
                        <tr>
                            <td style="color: #64748b; font-weight: bold;">Комплектация:</td>
                            <td>4 диска литых, 4 шины зимние шипованные, 4 вентиля, колпаки ступицы установлены</td>
                        </tr>
                        <tr>
                            <td style="color: #64748b; font-weight: bold;">Условия на складе:</td>
                            <td>Сухой отапливаемый бокс, хранение на вертикальных спецстеллажах без деформации резины</td>
                        </tr>
                    </tbody>
                </table>

                <div class="storage-actions-footer">
                    <button type="button" class="submit-btn" style="width: auto; padding: 10px 22px;" onclick="startNewBooking()">Записаться на замену колес</button>
                    <button type="button" class="week-btn" style="width: auto; padding: 9px 18px;" onclick="alert('Электронная копия акта МХ-3 отправлена на вашу почту')">Скачать акт</button>
                    <button type="button" class="week-btn" style="width: auto; padding: 9px 18px;" onclick="alert('Для продления договора обратитесь к менеджеру филиала')">Продлить хранение</button>
                </div>
            </div>
        </div>
    `;
}