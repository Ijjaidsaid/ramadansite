// Ramadan Tracker - Complete JavaScript Logic
console.log('%c🌙 رمضان مبارك! 🌙', 'font-size: 24px; color: #6B8E23; font-weight: bold;');
console.log('%cبارك الله فيكِ على استخدام هذا التطبيق! 💚', 'font-size: 16px; color: #B894FF;');

// Data Structure (per profile)
const ramadanData = {
    currentDay: 1,
    days: {},
    visibleLimit: 7 // Track how many days are visible on mobile
};

// i18n State
let currentLanguage = localStorage.getItem('ramadanLang') || 'ar';

function switchLanguage(lang) {
    if (!translations[lang]) return;
    currentLanguage = lang;
    localStorage.setItem('ramadanLang', lang);
    applyTranslations();
}

function applyTranslations() {
    const t = translations[currentLanguage];

    // Update direction and lang attribute
    document.documentElement.dir = t.dir;
    document.documentElement.lang = t.lang;

    // Update buttons active state
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`lang-${currentLanguage}-btn`);
    if (activeBtn) activeBtn.classList.add('active');

    // Translate all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            const translationValue = t[key];
            // Check if the translation contains HTML tags (like <br>, <li>, etc.)
            const hasHTML = /<[a-z][\s\S]*>/i.test(translationValue);

            if (hasHTML || el.classList.contains('hadith-quote') || el.classList.contains('description') || el.classList.contains('period-intro-text')) {
                el.innerHTML = translationValue;
            } else {
                el.textContent = translationValue;
            }
        }
    });

    // Translate all elements with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) {
            el.placeholder = t[key];
        }
    });

    // Translate all elements with data-i18n-alt
    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
        const key = el.getAttribute('data-i18n-alt');
        if (t[key]) {
            el.alt = t[key];
        }
    });

    // Re-render components that might have dynamic text
    generateRoadmap();
    renderDashboard();
}

// Arabic Numbers
// Standards numbers are now used instead of Eastern Arabic numerals

function toArabicNumber(num) {
    return num;
}

// Profiles stored in localStorage so multiple girls can use same device
const PROFILE_STORAGE_KEY = 'ramadanProfilesV1';

let profilesState = {
    activeProfileId: null,
    profiles: {}
};

// Days that are Fridays
const FRIDAY_DAYS = [2, 10, 16, 20, 30];

// Dashboard view mode: 0 means overall stats, 1-30 means specific day stats
let dashboardViewMode = 0;

// Initialize from localStorage (profiles + active profile data)
function loadData() {
    const rawProfiles = localStorage.getItem(PROFILE_STORAGE_KEY);
    const legacySingle = localStorage.getItem('ramadanData');

    if (rawProfiles) {
        try {
            profilesState = JSON.parse(rawProfiles);
        } catch (e) {
            profilesState = { activeProfileId: null, profiles: {} };
        }
    }

    // Migration: if there was an old single-user structure, wrap it in a default profile
    if (!rawProfiles && legacySingle) {
        try {
            const legacyData = JSON.parse(legacySingle);
            const id = 'default';
            profilesState.activeProfileId = id;
            profilesState.profiles[id] = {
                id,
                nickname: '',
                createdAt: new Date().toISOString(),
                ramadanData: legacyData
            };
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profilesState));
            localStorage.removeItem('ramadanData');
        } catch {
            // ignore migration errors, fall back to empty state
        }
    }

    // If still no profiles, create an empty state; user will add nickname
    const profileIds = Object.keys(profilesState.profiles || {});
    if (!profilesState.activeProfileId && profileIds.length > 0) {
        profilesState.activeProfileId = profileIds[0];
    }

    // Load active profile data into ramadanData
    const activeId = profilesState.activeProfileId;
    if (activeId && profilesState.profiles[activeId] && profilesState.profiles[activeId].ramadanData) {
        const activeData = profilesState.profiles[activeId].ramadanData;
        Object.assign(ramadanData, { currentDay: 1, days: {}, visibleLimit: 7 }, activeData);
    } else {
        // No active profile yet -> keep default ramadanData (empty) without saving
        Object.assign(ramadanData, { currentDay: 1, days: {}, visibleLimit: 7 });
    }
}

// Save active profile's ramadanData back to localStorage
function saveData() {
    const activeId = profilesState.activeProfileId;
    if (!activeId) return;

    if (!profilesState.profiles[activeId]) {
        // Create a basic profile if somehow missing
        profilesState.profiles[activeId] = {
            id: activeId,
            nickname: '',
            createdAt: new Date().toISOString(),
            ramadanData: {}
        };
    }

    profilesState.profiles[activeId].ramadanData = {
        currentDay: ramadanData.currentDay,
        days: ramadanData.days,
        visibleLimit: ramadanData.visibleLimit
    };

    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profilesState));
}

// --- Profile UI Elements ---
const nicknameInput = document.getElementById('nicknameInput');
const enterProfileBtn = document.getElementById('enterProfileBtn');
const profileListEl = document.getElementById('profileList');
const profileInputState = document.getElementById('profileInputState');
const profileWelcomeState = document.getElementById('profileWelcomeState');
const welcomeNickname = document.getElementById('welcomeNickname');

// Chart instances storage
let chartInstances = [];

// Generate 30 Stations (Roadmap) - Horizontal Snake Layout (5 Rows)
// IMPORTANT: This roadmap ALWAYS shows ONLY the active profile's data
function generateRoadmap() {
    const container = document.getElementById('roadmapContainer');
    if (!container) return;

    container.innerHTML = ''; // Clear existing

    // Ensure we're using the active profile's data
    const activeId = profilesState.activeProfileId;
    if (!activeId || !profilesState.profiles[activeId]) {
        // No active profile -> show empty roadmap
        const emptyMsg = document.createElement('div');
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.padding = '40px';
        emptyMsg.style.color = '#777';
        emptyMsg.textContent = translations[currentLanguage].roadmap_empty_msg;
        container.appendChild(emptyMsg);
        return;
    }

    // Configuration
    const steps = 30;
    const isMobile = window.innerWidth <= 768;

    // Mobile: 2 per row, start with 7 days unless expanded
    const itemsPerRow = isMobile ? 2 : 6;

    // Determine how many steps to show
    let visibleSteps = steps;
    if (isMobile) {
        // Ensure visibleLimit is initialized if missing
        if (!ramadanData.visibleLimit) ramadanData.visibleLimit = 7;
        visibleSteps = Math.min(ramadanData.visibleLimit, steps);
    }

    const paddingX = isMobile ? 70 : 120; // Increased padding for mobile to prevent clip
    const rowGap = 200;
    const startY = 80;

    // Calculate dimensions
    const containerWidth = container.offsetWidth || (isMobile ? 350 : 1200);
    const usableWidth = containerWidth - (2 * paddingX);
    const stepX = usableWidth / (itemsPerRow - 1);

    const rows = Math.ceil(visibleSteps / itemsPerRow);
    const totalHeight = startY + ((rows - 1) * rowGap) + 200;
    container.style.height = `${totalHeight}px`;

    // Create SVG for the path
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "roadmap-svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", totalHeight);
    container.appendChild(svg);

    // Calculate Points for visible stations
    const points = [];
    for (let day = 1; day <= visibleSteps; day++) {
        let x, y;

        // Determine Row (0-indexed)
        const rowIndex = Math.floor((day - 1) / itemsPerRow);
        // Determine position in row (0 to itemsPerRow-1)
        const posInRow = (day - 1) % itemsPerRow;

        y = startY + (rowIndex * rowGap);

        // Even rows (0, 2, 4...) -> Left to Right
        // Odd rows (1, 3...) -> Right to Left
        if (rowIndex % 2 === 0) {
            x = paddingX + posInRow * stepX;
        } else {
            x = paddingX + (itemsPerRow - 1 - posInRow) * stepX;
        }

        points.push({ x, y, day, rowIndex });
    }

    // Generate Path Data
    if (points.length > 0) {
        let d = `M ${points[0].x} ${points[0].y}`;
        // Dynamic curve parameters
        const curveRadius = isMobile ? 40 : 80;
        const curveOffset = isMobile ? 15 : 20;

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const isRowSwitch = p1.rowIndex !== p2.rowIndex;

            if (isRowSwitch) {
                const isRightCurve = (p1.rowIndex % 2 === 0);
                if (isRightCurve) {
                    const cp1x = p1.x + curveRadius + curveOffset;
                    const cp1y = p1.y;
                    const cp2x = p2.x + curveRadius + curveOffset;
                    const cp2y = p2.y;
                    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
                } else {
                    const cp1x = p1.x - curveRadius - curveOffset;
                    const cp1y = p1.y;
                    const cp2x = p2.x - curveRadius - curveOffset;
                    const cp2y = p2.y;
                    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
                }
            } else {
                d += ` L ${p2.x} ${p2.y}`;
            }
        }

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", d);
        path.setAttribute("stroke", "url(#roadGradient)");
        path.setAttribute("stroke-width", "8");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");

        // Add Gradient Definition
        const defs = document.createElementNS(svgNS, "defs");
        const linearGradient = document.createElementNS(svgNS, "linearGradient");
        linearGradient.setAttribute("id", "roadGradient");
        linearGradient.setAttribute("x1", "0%");
        linearGradient.setAttribute("y1", "0%");
        linearGradient.setAttribute("x2", "0%");
        linearGradient.setAttribute("y2", "100%");

        const stops = [
            { offset: "0%", color: "#FFB5B5" },
            { offset: "20%", color: "#B894FF" },
            { offset: "40%", color: "#A8E6CE" },
            { offset: "60%", color: "#FFD3B6" },
            { offset: "80%", color: "#FFD89B" },
            { offset: "100%", color: "#D4AF37" }
        ];

        stops.forEach(s => {
            const stop = document.createElementNS(svgNS, "stop");
            stop.setAttribute("offset", s.offset);
            stop.setAttribute("stop-color", s.color);
            linearGradient.appendChild(stop);
        });

        defs.appendChild(linearGradient);
        svg.appendChild(defs);
        svg.appendChild(path);
    }

    // Create Stations Elements
    points.forEach(p => {
        const station = document.createElement('div');
        station.className = 'station';
        station.style.position = 'absolute';
        station.style.flexDirection = 'column';
        station.style.alignItems = 'center';
        station.style.width = '120px';
        station.style.gap = '8px';
        station.style.left = `${p.x - 60}px`;
        station.style.top = `${p.y - 40}px`;

        if (p.day < ramadanData.currentDay) {
            station.classList.add('completed');
        } else if (p.day === ramadanData.currentDay) {
            station.classList.add('unlocked');
        } else {
            station.classList.add('locked');
        }

        const circle = document.createElement('div');
        circle.className = 'station-circle';
        circle.textContent = toArabicNumber(p.day);
        circle.dataset.day = p.day;

        const label = document.createElement('div');
        label.className = 'station-label';
        label.style.padding = '4px 8px';
        label.style.fontSize = '0.85rem';
        label.style.width = '100%';
        label.style.textAlign = 'center';
        label.style.whiteSpace = 'nowrap';

        label.textContent = `${translations[currentLanguage].roadmap_day_label} ${toArabicNumber(p.day)}`;

        if (p.day <= ramadanData.currentDay) {
            circle.addEventListener('click', () => openDayModal(p.day));
        }

        station.appendChild(circle);
        station.appendChild(label);
        container.appendChild(station);
    });

    // Roadmap Controls (Show More/Less + Reset)
    let btnContainer = document.querySelector('.roadmap-controls');
    if (!btnContainer) {
        btnContainer = document.createElement('div');
        btnContainer.className = 'roadmap-controls';
        // Add styles dynamically or assume they are in CSS (we will add to CSS)
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'center';
        btnContainer.style.gap = '15px';
        btnContainer.style.marginTop = '20px';
        btnContainer.style.flexWrap = 'wrap';

        container.parentNode.insertBefore(btnContainer, container.nextSibling);
    }
    btnContainer.innerHTML = ''; // Clear existing buttons

    // 1. Show More/Less Button (Mobile Only)
    if (isMobile) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'show-more-btn'; // Reusing existing class for style

        if (visibleSteps < steps) {
            toggleBtn.innerHTML = translations[currentLanguage].roadmap_show_more;
            toggleBtn.onclick = () => {
                ramadanData.visibleLimit = steps; // Show ALL days
                generateRoadmap();
            };
        } else {
            toggleBtn.innerHTML = translations[currentLanguage].roadmap_show_less;
            toggleBtn.style.background = 'linear-gradient(135deg, #A9A9A9 0%, #808080 100%)';
            toggleBtn.onclick = () => {
                ramadanData.visibleLimit = 7;
                generateRoadmap();
            };
        }
        btnContainer.appendChild(toggleBtn);
    }

    // 2. Reset Progress Button (Always Visible)
    const resetBtn = document.createElement('button');
    resetBtn.className = 'reset-btn';
    resetBtn.innerHTML = translations[currentLanguage].roadmap_reset_btn;
    resetBtn.onclick = resetProgress;
    btnContainer.appendChild(resetBtn);

    // Remove old container if it exists (cleanup from previous version)
    const oldContainer = document.querySelector('.roadmap-show-more-container');
    if (oldContainer) oldContainer.remove();
}

// Reset Progress Function
function resetProgress() {
    const t = translations[currentLanguage];
    showCustomConfirm(t.alert_reset_confirm, () => {
        ramadanData.currentDay = 1;
        ramadanData.days = {};
        ramadanData.visibleLimit = 7; // Reset visibility preference too
        saveData();
        generateRoadmap();
        showCustomAlert(t.alert_reset_success, '✅');
    });
}

// Modal Elements
const dayModal = document.getElementById('dayModal');
const modalTitle = document.getElementById('modalTitle');
const closeModalBtn = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');

// Video Modal Elements
const videoModal = document.getElementById('videoModal');
const closeVideoModalBtn = document.getElementById('closeVideoModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoFallback = document.getElementById('videoFallback');

// New View Elements
const viewSelection = document.getElementById('modal-selection-view');
const viewStandard = document.getElementById('modal-standard-view');
const viewPeriod = document.getElementById('modal-period-view');
const btnPeriodYes = document.getElementById('btnPeriodYes');
const btnPeriodNo = document.getElementById('btnPeriodNo');

let currentEditingDay = null;
let isPeriodMode = false; // Track current mode for saving

// Switch Modal View
function switchView(viewName) {
    viewSelection.style.display = 'none';
    viewStandard.style.display = 'none';
    viewPeriod.style.display = 'none';

    if (viewName === 'selection') {
        viewSelection.style.display = 'block';
        saveBtn.style.display = 'none'; // Hide save button in selection
    } else if (viewName === 'standard') {
        viewStandard.style.display = 'block';
        saveBtn.style.display = 'block';
        saveBtn.textContent = translations[currentLanguage].btn_save_close;
        isPeriodMode = false;
    } else if (viewName === 'period') {
        viewPeriod.style.display = 'block';
        saveBtn.style.display = 'block';
        saveBtn.textContent = translations[currentLanguage].btn_complete_day; // Different text
        isPeriodMode = true;
    }
}

// Selection Button Listeners
btnPeriodYes.addEventListener('click', () => switchView('period'));
btnPeriodNo.addEventListener('click', () => switchView('standard'));

// Open Day Modal
function openDayModal(day) {
    currentEditingDay = day;

    // Set title
    const t = translations[currentLanguage];
    if (day === 1) {
        modalTitle.textContent = t.modal_day_1;
    } else if (day === 2) {
        modalTitle.textContent = t.modal_day_2;
    } else if (day === 3) {
        modalTitle.textContent = t.modal_day_3;
    } else if (day === 10) {
        modalTitle.textContent = t.modal_day_10;
    } else if (day === 30) {
        modalTitle.textContent = t.modal_day_30;
    } else {
        modalTitle.textContent = `${t.modal_day_default} ${toArabicNumber(day)}`;
    }

    // Load saved data if exists
    const savedDay = ramadanData.days[day];
    if (savedDay) {
        if (savedDay.isPeriod) {
            loadPeriodFormData(savedDay);
            switchView('period');
        } else {
            loadFormData(savedDay);
            switchView('standard');
        }
    } else {
        resetForm();
        switchView('selection'); // Default start for new days
    }

    // Friday stuff
    const isFriday = FRIDAY_DAYS.includes(day);
    document.querySelectorAll('.friday-only').forEach(el => {
        el.style.display = isFriday ? 'flex' : 'none';
    });

    dayModal.classList.add('active');
}

// Close Modal
function closeDayModal() {
    dayModal.classList.remove('active');
    currentEditingDay = null;
    resetForm();
}

closeModalBtn.addEventListener('click', closeDayModal);
cancelBtn.addEventListener('click', closeDayModal);

// Close modal on outside click
dayModal.addEventListener('click', (e) => {
    if (e.target === dayModal) {
        closeDayModal();
    }
});

// Save Day Data
saveBtn.addEventListener('click', () => {
    if (isPeriodMode) {
        // Collect Period Data
        const periodData = {
            isPeriod: true,
            completed: true,
            dhikr: {
                subhan: document.querySelector('input[name="period-dhikr-subhan"]').checked,
                hamd: document.querySelector('input[name="period-dhikr-hamd"]').checked,
                lailaha: document.querySelector('input[name="period-dhikr-lailaha"]').checked,
                akbar: document.querySelector('input[name="period-dhikr-akbar"]').checked,
                istighfar: document.querySelector('input[name="period-dhikr-istighfar"]').checked
            },
            iftar: {
                dates: document.querySelector('input[name="period-iftar-dates"]').checked,
                cooking: document.querySelector('input[name="period-iftar-cooking"]').checked
            },
            dua: {
                self: document.querySelector('input[name="period-dua-self"]').checked,
                parents: document.querySelector('input[name="period-dua-parents"]').checked,
                ummah: document.querySelector('input[name="period-dua-ummah"]').checked
            },
            quran: {
                fajr: document.querySelector('input[name="period-quran-fajr"]').checked,
                dhuhr: document.querySelector('input[name="period-quran-dhuhr"]').checked,
                asr: document.querySelector('input[name="period-quran-asr"]').checked,
                maghrib: document.querySelector('input[name="period-quran-maghrib"]').checked,
                isha: document.querySelector('input[name="period-quran-isha"]').checked
            },
            sadaqah: {
                given: document.querySelector('input[name="period-sadaqah"]').checked,
                goodDeeds: document.querySelector('textarea[name="period-good-deeds"]').value
            },
            quranKahf: FRIDAY_DAYS.includes(currentEditingDay) ? document.querySelector('input[name="period-quran-kahf"]').checked : false,
            kinship: {
                parents: document.querySelector('input[name="period-kinship-parents"]').checked,
                relatives: document.querySelector('input[name="period-kinship-relatives"]').checked
            },
            reflections: document.querySelector('textarea[name="period-reflections"]').value
        };

        // Validation for Period Mode
        // Obligatory: at least one from Dhikr, Dua, Quran, Kinship
        const hasDhikr = Object.values(periodData.dhikr).some(v => v);
        const hasDua = Object.values(periodData.dua).some(v => v);
        const hasQuran = Object.values(periodData.quran).some(v => v);
        const hasKinship = Object.values(periodData.kinship).some(v => v);

        const t = translations[currentLanguage];
        if (!hasDhikr) { showCustomAlert(t.alert_need_dhikr, '⚠️'); return; }
        if (!hasDua) { showCustomAlert(t.alert_need_dua, '⚠️'); return; }
        if (!hasQuran) { showCustomAlert(t.alert_need_quran, '⚠️'); return; }
        if (!hasKinship) { showCustomAlert(t.alert_need_kinship, '⚠️'); return; }

        // Save
        ramadanData.days[currentEditingDay] = periodData;
        showCustomAlert(t.alert_accept_deeds, '🎉');
    } else {
        // Standard Mode Saving
        const t = translations[currentLanguage];
        // User asked for "Dhikr (Obligatory)" so let's check it.
        const hasDhikr = Object.values(formData.dhikr).some(v => v);
        if (!hasDhikr) { showCustomAlert(t.alert_need_dhikr, '⚠️'); return; }

        // Validation: Must have 5 obligatory prayers + at least 1 Quran session
        const obligatoryPrayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        const allPrayersChecked = obligatoryPrayers.every(prayer => formData.prayers[prayer]);
        const hasQuranReading = Object.values(formData.quran).some(v => v);

        if (!allPrayersChecked) {
            showCustomAlert(t.alert_need_prayers, '⚠️');
            return;
        }

        if (!hasQuranReading) {
            showCustomAlert(t.alert_need_quran_session, '⚠️');
            return;
        }

        // Add specific flags
        formData.isPeriod = false;
        formData.completed = true;
        ramadanData.days[currentEditingDay] = formData;
    }

    // If current day is completed, unlock next day
    if (currentEditingDay === ramadanData.currentDay && ramadanData.currentDay < 30) {
        ramadanData.currentDay++;

        // Show celebration
        showCelebration();
    }

    saveData();
    closeDayModal();

    // Refresh roadmap and dashboard
    document.getElementById('roadmapContainer').innerHTML = '';
    generateRoadmap();
    renderDashboard();
});

// Collect Form Data
function collectFormData() {
    return {
        prayers: {
            fajr: document.querySelector('input[name="fajr"]').checked,
            dhuhr: document.querySelector('input[name="dhuhr"]').checked,
            asr: document.querySelector('input[name="asr"]').checked,
            maghrib: document.querySelector('input[name="maghrib"]').checked,
            isha: document.querySelector('input[name="isha"]').checked,
            tarawih: document.querySelector('input[name="tarawih"]').checked,
            duha: document.querySelector('input[name="duha"]').checked,
            qiyam: document.querySelector('input[name="qiyam"]').checked,
            shurouq: document.querySelector('input[name="shurouq"]').checked,
            rawatib: document.querySelector('input[name="rawatib"]').checked
        },
        quran: {
            fajr: document.querySelector('input[name="quran-fajr"]').checked,
            dhuhr: document.querySelector('input[name="quran-dhuhr"]').checked,
            asr: document.querySelector('input[name="quran-asr"]').checked,
            maghrib: document.querySelector('input[name="quran-maghrib"]').checked,
            isha: document.querySelector('input[name="quran-isha"]').checked
        },
        dhikr: {
            subhan: document.querySelector('input[name="dhikr-subhan"]').checked,
            hamd: document.querySelector('input[name="dhikr-hamd"]').checked,
            lailaha: document.querySelector('input[name="dhikr-lailaha"]').checked,
            akbar: document.querySelector('input[name="dhikr-akbar"]').checked,
            istighfar: document.querySelector('input[name="dhikr-istighfar"]').checked,
            kahf: FRIDAY_DAYS.includes(currentEditingDay) ? document.querySelector('input[name="quran-kahf"]').checked : false,
            morning: document.querySelector('input[name="dhikr-morning"]').checked,
            evening: document.querySelector('input[name="dhikr-evening"]').checked,
            sleep: document.querySelector('input[name="dhikr-sleep"]').checked,
            istighfar100: document.querySelector('input[name="dhikr-istighfar100"]').checked,
            hawqala100: document.querySelector('input[name="dhikr-hawqala100"]').checked,
            salat100: document.querySelector('input[name="dhikr-salat100"]').checked
        },
        iftar: {
            dates: document.querySelector('input[name="iftar-dates"]').checked,
            cooking: document.querySelector('input[name="iftar-cooking"]').checked
        },
        dua: {
            self: document.querySelector('input[name="dua-self"]').checked,
            parents: document.querySelector('input[name="dua-parents"]').checked,
            ummah: document.querySelector('input[name="dua-ummah"]').checked
        },
        kinship: {
            parents: document.querySelector('input[name="kinship-parents"]').checked,
            relatives: document.querySelector('input[name="kinship-relatives"]').checked
        },
        sadaqah: {
            given: document.querySelector('input[name="sadaqah"]').checked,
            goodDeeds: document.querySelector('textarea[name="good-deeds"]').value
        },
        reflections: document.querySelector('textarea[name="reflections"]').value
    };
}

// Load Form Data
function loadFormData(data) {
    // Prayers
    Object.keys(data.prayers).forEach(prayer => {
        const checkbox = document.querySelector(`input[name="${prayer}"]`);
        if (checkbox) checkbox.checked = data.prayers[prayer];
    });

    // Quran
    // Quran
    if (data.quran) {
        // Handle backward compatibility or new structure
        if (data.quran.pages !== undefined) {
            // Old data format - do nothing or maybe set a generic check?
            // For now, let's just clear for safety or leave as is.
            // Best to just support the new format moving forward.
        } else {
            document.querySelector('input[name="quran-fajr"]').checked = data.quran.fajr || false;
            document.querySelector('input[name="quran-dhuhr"]').checked = data.quran.dhuhr || false;
            document.querySelector('input[name="quran-asr"]').checked = data.quran.asr || false;
            document.querySelector('input[name="quran-maghrib"]').checked = data.quran.maghrib || false;
            document.querySelector('input[name="quran-isha"]').checked = data.quran.isha || false;
        }
    }

    // Dhikr
    if (data.dhikr) {
        document.querySelector('input[name="dhikr-subhan"]').checked = data.dhikr.subhan || false;
        document.querySelector('input[name="dhikr-hamd"]').checked = data.dhikr.hamd || false;
        document.querySelector('input[name="dhikr-lailaha"]').checked = data.dhikr.lailaha || false;
        document.querySelector('input[name="dhikr-akbar"]').checked = data.dhikr.akbar || false;
        document.querySelector('input[name="dhikr-istighfar"]').checked = data.dhikr.istighfar || false;

        // New Adhkar
        document.querySelector('input[name="dhikr-morning"]').checked = data.dhikr.morning || false;
        document.querySelector('input[name="dhikr-evening"]').checked = data.dhikr.evening || false;
        document.querySelector('input[name="dhikr-sleep"]').checked = data.dhikr.sleep || false;
        document.querySelector('input[name="dhikr-istighfar100"]').checked = data.dhikr.istighfar100 || false;
        document.querySelector('input[name="dhikr-hawqala100"]').checked = data.dhikr.hawqala100 || false;
        document.querySelector('input[name="dhikr-salat100"]').checked = data.dhikr.salat100 || false;
    }

    // Friday
    if (FRIDAY_DAYS.includes(currentEditingDay)) {
        const kahfCheck = document.querySelector('input[name="quran-kahf"]');
        if (kahfCheck) kahfCheck.checked = data.dhikr ? data.dhikr.kahf || false : false;
    }

    // Iftar
    if (data.iftar) {
        document.querySelector('input[name="iftar-dates"]').checked = data.iftar.dates || false;
        document.querySelector('input[name="iftar-cooking"]').checked = data.iftar.cooking || false;
    }

    // Dua
    if (data.dua) {
        document.querySelector('input[name="dua-self"]').checked = data.dua.self || false;
        document.querySelector('input[name="dua-parents"]').checked = data.dua.parents || false;
        document.querySelector('input[name="dua-ummah"]').checked = data.dua.ummah || false;
    }

    // Kinship
    if (data.kinship) {
        document.querySelector('input[name="kinship-parents"]').checked = data.kinship.parents || false;
        document.querySelector('input[name="kinship-relatives"]').checked = data.kinship.relatives || false;
    }

    // Sadaqah
    document.querySelector('input[name="sadaqah"]').checked = data.sadaqah.given;
    document.querySelector('textarea[name="good-deeds"]').value = data.sadaqah.goodDeeds || '';

    // Reflections
    document.querySelector('textarea[name="reflections"]').value = data.reflections || '';
}

// Load Period Form Data
function loadPeriodFormData(data) {
    // Dhikr
    if (data.dhikr) {
        document.querySelector('input[name="period-dhikr-subhan"]').checked = data.dhikr.subhan;
        document.querySelector('input[name="period-dhikr-hamd"]').checked = data.dhikr.hamd;
        document.querySelector('input[name="period-dhikr-lailaha"]').checked = data.dhikr.lailaha;
        document.querySelector('input[name="period-dhikr-akbar"]').checked = data.dhikr.akbar;
        document.querySelector('input[name="period-dhikr-istighfar"]').checked = data.dhikr.istighfar;

        // New Adhkar
        document.querySelector('input[name="period-dhikr-morning"]').checked = data.dhikr.morning || false;
        document.querySelector('input[name="period-dhikr-evening"]').checked = data.dhikr.evening || false;
        document.querySelector('input[name="period-dhikr-sleep"]').checked = data.dhikr.sleep || false;
        document.querySelector('input[name="period-dhikr-istighfar100"]').checked = data.dhikr.istighfar100 || false;
        document.querySelector('input[name="period-dhikr-hawqala100"]').checked = data.dhikr.hawqala100 || false;
        document.querySelector('input[name="period-dhikr-salat100"]').checked = data.dhikr.salat100 || false;
    }
    // Iftar
    if (data.iftar) {
        document.querySelector('input[name="period-iftar-dates"]').checked = data.iftar.dates;
        document.querySelector('input[name="period-iftar-cooking"]').checked = data.iftar.cooking;
    }
    // Dua
    if (data.dua) {
        document.querySelector('input[name="period-dua-self"]').checked = data.dua.self;
        document.querySelector('input[name="period-dua-parents"]').checked = data.dua.parents;
        document.querySelector('input[name="period-dua-ummah"]').checked = data.dua.ummah;
    }
    // Quran
    if (data.quran) {
        document.querySelector('input[name="period-quran-fajr"]').checked = data.quran.fajr || false;
        document.querySelector('input[name="period-quran-dhuhr"]').checked = data.quran.dhuhr || false;
        document.querySelector('input[name="period-quran-asr"]').checked = data.quran.asr || false;
        document.querySelector('input[name="period-quran-maghrib"]').checked = data.quran.maghrib || false;
        document.querySelector('input[name="period-quran-isha"]').checked = data.quran.isha || false;
    }
    // Sadaqah
    if (data.sadaqah) {
        // Check if it's the old boolean format or new object format
        if (typeof data.sadaqah === 'boolean') {
            document.querySelector('input[name="period-sadaqah"]').checked = data.sadaqah;
        } else {
            document.querySelector('input[name="period-sadaqah"]').checked = data.sadaqah.given || false;
            document.querySelector('textarea[name="period-good-deeds"]').value = data.sadaqah.goodDeeds || '';
        }
    }
    // Kinship
    if (data.kinship) {
        document.querySelector('input[name="period-kinship-parents"]').checked = data.kinship.parents;
        document.querySelector('input[name="period-kinship-relatives"]').checked = data.kinship.relatives;
    }
    // Reflections
    document.querySelector('textarea[name="period-reflections"]').value = data.reflections || '';

    // Friday
    if (FRIDAY_DAYS.includes(currentEditingDay)) {
        const kahfCheck = document.querySelector('input[name="period-quran-kahf"]');
        if (kahfCheck) kahfCheck.checked = data.quranKahf || false;
    }
}

// Reset Form
function resetForm() {
    document.querySelectorAll('input[type="checkbox"]').forEach(input => input.checked = false);
    document.querySelectorAll('input[type="number"]').forEach(input => input.value = 0);
    document.querySelectorAll('textarea').forEach(textarea => textarea.value = '');
}

// Custom Alert Function
function showCustomAlert(message, icon = '🔔', duration = 3000) {
    const alertBox = document.createElement('div');
    alertBox.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #6B8E23 0%, #556B2F 100%);
        color: white;
        padding: 30px 40px;
        border-radius: 20px;
        font-size: 1.5rem;
        font-weight: bold;
        text-align: center;
        z-index: 10001;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: celebrationPop 0.5s ease;
        max-width: 90%;
        width: 400px;
    `;

    // Add specific style for the message part
    const messageContent = message.includes('<br>') ? message : `<div>${message}</div>`;

    alertBox.innerHTML = `
        <div style="font-size: 2.5rem; margin-bottom: 10px;">${icon}</div>
        <div style="line-height: 1.4;">${messageContent}</div>
    `;

    document.body.appendChild(alertBox);

    setTimeout(() => {
        alertBox.style.animation = 'celebrationPop 0.5s ease reverse';
        setTimeout(() => alertBox.remove(), 500);
    }, duration);
}

// Custom Confirm Function
function showCustomConfirm(message, onConfirm, onCancel) {
    const t = translations[currentLanguage];
    const confirmBox = document.createElement('div');
    confirmBox.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #6B8E23 0%, #556B2F 100%);
        color: white;
        padding: 40px;
        border-radius: 20px;
        font-size: 1.3rem;
        font-weight: bold;
        text-align: center;
        z-index: 10002;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        animation: celebrationPop 0.5s ease;
        max-width: 90%;
        width: 450px;
    `;

    confirmBox.innerHTML = `
        <div style="font-size: 2.5rem; margin-bottom: 15px;">❓</div>
        <div style="line-height: 1.4; margin-bottom: 25px;">${message}</div>
        <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="customConfirmYes" style="background: white; color: #556B2F; border: none; padding: 10px 30px; border-radius: 12px; font-weight: bold; cursor: pointer; transition: transform 0.2s;">${t.btn_yes}</button>
            <button id="customConfirmNo" style="background: rgba(255,255,255,0.2); color: white; border: 2px solid white; padding: 10px 30px; border-radius: 12px; font-weight: bold; cursor: pointer; transition: transform 0.2s;">${t.btn_no}</button>
        </div>
    `;

    document.body.appendChild(confirmBox);

    const yesBtn = confirmBox.querySelector('#customConfirmYes');
    const noBtn = confirmBox.querySelector('#customConfirmNo');

    const close = () => {
        confirmBox.style.animation = 'celebrationPop 0.5s ease reverse';
        setTimeout(() => confirmBox.remove(), 500);
    };

    yesBtn.onclick = () => {
        close();
        if (onConfirm) onConfirm();
    };

    noBtn.onclick = () => {
        close();
        if (onCancel) onCancel();
    };

    // Simple hover effects
    [yesBtn, noBtn].forEach(btn => {
        btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
        btn.onmouseout = () => btn.style.transform = 'scale(1)';
    });
}

// Show Celebration
function showCelebration() {
    const t = translations[currentLanguage];
    showCustomAlert(`${t.celebration_wow}<br><span style="font-size: 1.1rem; font-weight: normal; opacity: 0.9;">${t.celebration_next_day}</span>`, '🎉', 4000);
}

// Video Cards - Embedded Player
function setupVideoCards() {
    document.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => {
            const url = card.dataset.url;
            if (url) {
                let videoId = '';
                let listId = '';
                let startTime = null;

                // Extract Video ID, List ID, and Timestamp
                try {
                    const urlObj = new URL(url);

                    // Handle Playlist
                    listId = urlObj.searchParams.get('list');

                    if (url.includes('youtu.be/')) {
                        videoId = urlObj.pathname.substring(1);
                    } else if (url.includes('youtube.com/watch')) {
                        videoId = urlObj.searchParams.get('v');
                    }

                    // Get 't' parameter for start time
                    const t = urlObj.searchParams.get('t');
                    if (t) {
                        startTime = parseInt(t);
                    }
                } catch (e) {
                    console.error("Error parsing video URL:", e);
                }

                let embedUrl = '';

                if (listId) {
                    // Playlist Embed
                    embedUrl = `https://www.youtube.com/embed?listType=playlist&list=${listId}&autoplay=1&origin=${window.location.origin}`;
                } else if (videoId) {
                    // Single Video Embed
                    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&origin=${window.location.origin}`;
                    if (startTime) {
                        embedUrl += `&start=${startTime}`;
                    }
                }

                if (embedUrl) {
                    videoPlayer.src = embedUrl;
                    if (videoFallback) {
                        videoFallback.href = url; // Set fallback link to original URL
                    }
                    videoModal.classList.add('active');
                }
            }
        });
    });
}

// Close Video Modal
if (closeVideoModalBtn) {
    closeVideoModalBtn.addEventListener('click', () => {
        videoModal.classList.remove('active');
        videoPlayer.src = ''; // Stop video
    });
}

// Close Video Modal on Outside Click
window.addEventListener('click', (e) => {
    if (e.target === videoModal) {
        videoModal.classList.remove('active');
        videoPlayer.src = '';
    }
    // Existing modal close logic
    if (e.target === dayModal) {
        dayModal.classList.remove('active');
    }
    if (e.target === programModal) {
        programModal.classList.remove('active');
    }
});

// Program Cards - Show Details
const programModal = document.getElementById('programModal');
const programModalTitle = document.getElementById('programModalTitle');
const programModalBody = document.getElementById('programModalBody');
const closeProgramModalBtn = document.getElementById('closeProgramModal');

// Finalized program details are now in translations.js


function setupProgramCards() {
    document.querySelectorAll('.program-card').forEach(card => {
        card.addEventListener('click', () => {
            const programKey = card.dataset.program;
            const t = translations[currentLanguage];
            const program = t.program_details ? t.program_details[programKey] : null;

            if (program) {
                programModalTitle.textContent = program.title;
                programModalBody.innerHTML = program.content;
                programModal.classList.add('active');
            }
        });
    });
}

closeProgramModalBtn.addEventListener('click', () => {
    programModal.classList.remove('active');
});

programModal.addEventListener('click', (e) => {
    if (e.target === programModal) {
        programModal.classList.remove('active');
    }
});

// Add CSS for celebration animation
const style = document.createElement('style');
style.textContent = `
    @keyframes celebrationPop {
        0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
        }
        50% {
            transform: translate(-50%, -50%) scale(1.1);
        }
        100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Initialize App
function init() {
    applyTranslations();
    loadData();
    // Initialize data if empty
    if (!ramadanData.currentDay) ramadanData.currentDay = 1;
    if (!ramadanData.days) ramadanData.days = {};

    generateRoadmap();
    setupVideoCards();
    setupProgramCards();
    renderProfileUI();
    renderDashboard();

    // Profile nickname handlers
    if (enterProfileBtn) {
        enterProfileBtn.addEventListener('click', handleProfileSubmit);
    }
    if (nicknameInput) {
        nicknameInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                handleProfileSubmit();
            }
        });
    }

    console.log('📊 للحصول على إحصائيات: ramadanData.getStats()');
    console.log('💾 لتصدير البيانات: ramadanData.exportData()');
    console.log('📥 لاستيراد البيانات: ramadanData.importData(jsonString)');
}

// Utility functions for console
ramadanData.getStats = function () {
    const completed = Object.keys(this.days).length;
    const remaining = 30 - this.currentDay + 1;

    console.log(`
📊 إحصائياتك:
✅ الأيام المكتملة: ${completed}
📍 اليوم الحالي: ${this.currentDay}
⏳ الأيام المتبقية: ${remaining}
    `);

    return { completed, current: this.currentDay, remaining };
};

ramadanData.exportData = function () {
    const json = JSON.stringify(this, null, 2);
    console.log('📤 بياناتك (انسخيها):');
    console.log(json);
    return json;
};

ramadanData.importData = function (jsonString) {
    try {
        const data = JSON.parse(jsonString);
        Object.assign(this, data);
        saveData();
        location.reload();
        console.log('✅ تم استيراد البيانات بنجاح');
    } catch (e) {
        console.error('❌ خطأ في استيراد البيانات:', e);
    }
};

// ---- Profiles helpers & dashboard ----

function switchToProfile(profileId) {
    if (!profileId || profileId === profilesState.activeProfileId) return;

    // Persist current active data first
    saveData();

    profilesState.activeProfileId = profileId;
    const profile = profilesState.profiles[profileId];
    if (profile && profile.ramadanData) {
        Object.assign(ramadanData, { currentDay: 1, days: {}, visibleLimit: 7 }, profile.ramadanData);
    } else {
        Object.assign(ramadanData, { currentDay: 1, days: {}, visibleLimit: 7 });
    }
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profilesState));

    generateRoadmap();
    renderProfileUI();
    renderDashboard();
}

function handleProfileSubmit() {
    if (!nicknameInput) return;
    const rawName = nicknameInput.value.trim();
    const t = translations[currentLanguage];
    if (!rawName) {
        showCustomAlert(t.alert_nickname_required, '💕');
        return;
    }

    const activeId = profilesState.activeProfileId;

    // Check if this nickname already exists
    const existingEntry = Object.entries(profilesState.profiles || {}).find(
        ([, p]) => p.nickname && p.nickname.toLowerCase() === rawName.toLowerCase()
    );

    if (existingEntry) {
        const [id] = existingEntry;

        // If it's already the active profile, do nothing
        if (id === activeId) {
            showCustomAlert(t.alert_nickname_exists, '💚');
            if (nicknameInput) nicknameInput.value = '';
            return;
        }

        // If it's a different profile, allow reactivation (same person returning)
        showCustomConfirm(t.alert_nickname_switch_confirm, () => {
            // Save current active data first
            saveData();

            // Switch to this existing profile
            profilesState.activeProfileId = id;
            const profile = profilesState.profiles[id];
            if (profile && profile.ramadanData) {
                Object.assign(ramadanData, { currentDay: 1, days: {}, visibleLimit: 7 }, profile.ramadanData);
            } else {
                Object.assign(ramadanData, { currentDay: 1, days: {}, visibleLimit: 7 });
            }
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profilesState));

            generateRoadmap();
            renderProfileUI();
            renderDashboard();

            showCustomAlert(`${t.welcome_title} ${profile.nickname} 🌙`, '💚');
        });
    } else {
        // New nickname - create new profile
        saveData();

        const id = 'p-' + Date.now();
        profilesState.profiles[id] = {
            id,
            nickname: rawName,
            createdAt: new Date().toISOString(),
            ramadanData: {
                currentDay: 1,
                days: {},
                visibleLimit: 7
            }
        };
        profilesState.activeProfileId = id;
        Object.assign(ramadanData, { currentDay: 1, days: {}, visibleLimit: 7 });
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profilesState));

        generateRoadmap();
        renderProfileUI();
        renderDashboard();
    }

    if (nicknameInput) nicknameInput.value = '';
}

function renderProfileUI() {
    const activeId = profilesState.activeProfileId;
    const profileIds = Object.keys(profilesState.profiles || {});

    // Show/hide input vs welcome state
    if (activeId && profilesState.profiles[activeId] && profilesState.profiles[activeId].nickname) {
        // Profile is active -> show welcome message
        if (profileInputState) profileInputState.style.display = 'none';
        if (profileWelcomeState) profileWelcomeState.style.display = 'block';
        if (welcomeNickname) {
            const nick = profilesState.profiles[activeId].nickname;
            welcomeNickname.textContent = nick ? ` ${nick}` : '';
        }
    } else {
        // No active profile -> show input form
        if (profileInputState) profileInputState.style.display = 'block';
        if (profileWelcomeState) profileWelcomeState.style.display = 'none';
    }

    // Don't show profile switcher - each user only sees their own roadmap
    // Other users appear only in dashboard
    if (profileListEl) {
        profileListEl.innerHTML = '';
    }
}

function computeProfileStats(profile) {
    const data = profile.ramadanData || {};
    const currentDay = data.currentDay || 1;
    const days = data.days || {};

    let completedDays = 0;
    for (let day = 1; day <= 30; day++) {
        const d = days[day];
        if (d && (d.completed || d.isPeriod)) {
            completedDays++;
        } else if (!d && day < currentDay) {
            // Legacy data without explicit "completed" flag
            completedDays++;
        }
    }

    const percentage = Math.round((completedDays / 30) * 100);
    return {
        completedDays,
        currentDay,
        percentage
    };
}

function renderDashboard() {
    // Destroy existing charts
    chartInstances.forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    chartInstances = [];

    const chartsContainer = document.getElementById('dashboardCharts');
    const rankingContainer = document.getElementById('dashboardTable');
    const welcomeCardEl = document.getElementById('dashboardWelcomeCard');
    const infoEmptyEl = document.getElementById('dashboardInfoEmpty');

    if (!chartsContainer || !rankingContainer) return;

    chartsContainer.innerHTML = '';
    rankingContainer.innerHTML = '';

    // Only show current user (active profile) - no other users
    const activeId = profilesState.activeProfileId;
    const activeProfile = activeId && profilesState.profiles[activeId]
        ? { ...profilesState.profiles[activeId], stats: computeProfileStats(profilesState.profiles[activeId]) }
        : null;

    // Show/hide welcome card and empty message
    const t = translations[currentLanguage];
    if (welcomeCardEl) {
        if (activeProfile && activeProfile.nickname) {
            welcomeCardEl.style.display = 'block';
            const displayName = activeProfile.nickname ? ` ${escapeHtml(activeProfile.nickname)}` : '';
            welcomeCardEl.innerHTML = `
                <div class="dashboard-welcome-inner">
                    <div class="dashboard-welcome-image">
                        <img src="images/glowing-lantern.png" alt="${t.title}" class="dashboard-welcome-img">
                    </div>
                    <div class="dashboard-welcome-text">
                        <h3 class="dashboard-welcome-title">${t.dashboard_welcome_title}${displayName}</h3>
                        <p class="dashboard-welcome-sub">${t.dashboard_welcome_sub}</p>
                    </div>
                </div>
            `;
        } else {
            welcomeCardEl.style.display = 'none';
        }
    }
    if (infoEmptyEl) {
        infoEmptyEl.style.display = activeProfile ? 'none' : 'block';
    }

    if (!activeProfile || !activeProfile.nickname || !activeProfile.nickname.trim()) {
        const msg = document.createElement('p');
        msg.className = 'dashboard-empty';
        msg.innerHTML = t.dashboard_empty;
        rankingContainer.appendChild(msg);
        return;
    }

    const ranked = [activeProfile];

    // Render interactive charts (only for current user)
    renderDashboardCharts(chartsContainer, ranked);

    // Single user progress card (no ranking)
    const p = activeProfile;
    const card = document.createElement('div');
    card.className = 'dashboard-card dashboard-card-single active';

    const name = document.createElement('div');
    name.className = 'dashboard-name';
    name.innerHTML = `<i class="fas fa-user-circle dashboard-card-icon"></i> ${escapeHtml(p.nickname)}`;

    const statsLine = document.createElement('div');
    statsLine.className = 'dashboard-stats-line';
    statsLine.innerHTML = `<i class="fas fa-calendar-check"></i> ${t.dashboard_stat_completed_days}: ${toArabicNumber(p.stats.completedDays)} / 30 &nbsp;•&nbsp; <i class="fas fa-map-marker-alt"></i> ${t.roadmap_day_label}: ${toArabicNumber(p.stats.currentDay)}`;

    const progressBar = document.createElement('div');
    progressBar.className = 'dashboard-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'dashboard-progress-fill';
    fill.style.width = `${p.stats.percentage}%`;
    progressBar.appendChild(fill);

    const percentText = document.createElement('div');
    percentText.className = 'dashboard-percent';
    percentText.innerHTML = `<i class="fas fa-chart-line"></i> ${toArabicNumber(p.stats.percentage)}% ${t.dashboard_percent_of_journey}`;

    card.appendChild(name);
    card.appendChild(statsLine);
    card.appendChild(progressBar);
    card.appendChild(percentText);
    rankingContainer.appendChild(card);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderDashboardCharts(container, rankedProfiles) {
    if (!window.Chart) {
        console.warn('Chart.js not loaded, skipping charts');
        return;
    }

    // Chart 1: Progress over days (line chart for active profile)
    const activeProfile = rankedProfiles.find(p => p.id === profilesState.activeProfileId);
    if (activeProfile) {
        const progressData = computeDailyProgress(activeProfile);
        const progressCard = document.createElement('div');
        progressCard.className = 'chart-card';
        progressCard.innerHTML = `
            <div class="chart-title"><i class="fas fa-chart-line chart-title-icon"></i> ${translations[currentLanguage].dashboard_daily_progress}</div>
            <div class="chart-wrapper large">
                <canvas id="progressChart"></canvas>
            </div>
        `;
        container.appendChild(progressCard);

        const ctx1 = document.getElementById('progressChart');
        if (ctx1) {
            const chart1 = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: progressData.labels,
                    datasets: [{
                        label: translations[currentLanguage].dashboard_completed,
                        data: progressData.values,
                        borderColor: '#6B8E23',
                        backgroundColor: 'rgba(107, 142, 35, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#6B8E23',
                        pointBorderColor: '#FFFFFF',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            rtl: true,
                            titleFont: { family: 'Tajawal' },
                            bodyFont: { family: 'Tajawal' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 30,
                            ticks: {
                                stepSize: 5,
                                callback: function (value) {
                                    return toArabicNumber(value);
                                }
                            }
                        },
                        x: {
                            ticks: {
                                callback: function (value, index) {
                                    return toArabicNumber(index + 1);
                                }
                            }
                        }
                    }
                }
            });
            chartInstances.push(chart1);
        }
    }

    // Chart 2: Pie chart for completion percentage
    if (activeProfile) {
        const pieCard = document.createElement('div');
        pieCard.className = 'chart-card';
        pieCard.innerHTML = `
            <div class="chart-title"><i class="fas fa-bullseye chart-title-icon"></i> ${translations[currentLanguage].dashboard_completion_rate}</div>
            <div class="chart-wrapper">
                <canvas id="pieChart"></canvas>
            </div>
        `;
        container.appendChild(pieCard);

        const ctx3 = document.getElementById('pieChart');
        if (ctx3) {
            const completed = activeProfile.stats.completedDays;
            const remaining = 30 - completed;
            const chart3 = new Chart(ctx3, {
                type: 'doughnut',
                data: {
                    labels: [translations[currentLanguage].dashboard_completed, translations[currentLanguage].dashboard_remaining],
                    datasets: [{
                        data: [completed, remaining],
                        backgroundColor: ['#6B8E23', '#E0E0E0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                font: { family: 'Tajawal' },
                                padding: 15,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            rtl: true,
                            titleFont: { family: 'Tajawal' },
                            bodyFont: { family: 'Tajawal' },
                            callbacks: {
                                label: function (context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    return label + ': ' + toArabicNumber(value) + ' ' + translations[currentLanguage].dashboard_day_unit;
                                }
                            }
                        }
                    }
                }
            });
            chartInstances.push(chart3);
        }
    }

    // Default to current day on first load
    if (dashboardViewMode === 0 && activeProfile && activeProfile.stats.currentDay > 0) {
        dashboardViewMode = activeProfile.stats.currentDay;
    }

    // Stats cards (quick overview)
    const statsCard = document.createElement('div');
    statsCard.className = 'chart-card';
    statsCard.style.gridColumn = '1 / -1';

    // Daily Navigation / Switcher
    const navContainer = document.createElement('div');
    navContainer.className = 'dashboard-nav-wrapper';

    const displayDay = dashboardViewMode === 0 ? translations[currentLanguage].dashboard_overall_summary : `${translations[currentLanguage].roadmap_day_label} ${toArabicNumber(dashboardViewMode)}`;

    navContainer.innerHTML = `
        <div class="dashboard-nav">
            <button class="nav-arrow" id="prevDayDashboard" title="${translations[currentLanguage].dashboard_prev_day}">
                <i class="fas ${currentLanguage === 'ar' ? 'fa-chevron-right' : 'fa-chevron-left'}"></i>
            </button>
            <div class="nav-title">${displayDay}</div>
            <button class="nav-arrow" id="nextDayDashboard" title="${translations[currentLanguage].dashboard_next_day}">
                <i class="fas ${currentLanguage === 'ar' ? 'fa-chevron-left' : 'fa-chevron-right'}"></i>
            </button>
        </div>
        <button class="summary-btn ${dashboardViewMode === 0 ? 'active' : ''}" id="showOverallSummary">
            <i class="fas fa-chart-pie"></i> ${translations[currentLanguage].dashboard_show_summary}
        </button>
    `;

    statsCard.appendChild(navContainer);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    if (activeProfile) {
        const stats = activeProfile.stats;
        // Pass dashboardViewMode to filter stats
        const ibadatStats = computeIbadatStats(activeProfile, dashboardViewMode);

        statsGrid.innerHTML = `
            <div class="stat-card stat-card-prayer">
                <div class="stat-card-icon"><i class="fas fa-mosque"></i></div>
                <div class="stat-value">${toArabicNumber(ibadatStats.totalPrayers)}</div>
                <div class="stat-label">${translations[currentLanguage].dashboard_stat_prayers}</div>
            </div>
            <div class="stat-card stat-card-nawafil">
                <div class="stat-card-icon"><i class="fas fa-star-and-crescent"></i></div>
                <div class="stat-value">${toArabicNumber(ibadatStats.totalNawafil)}</div>
                <div class="stat-label">${translations[currentLanguage].dashboard_stat_nawafil}</div>
            </div>
            <div class="stat-card stat-card-dhikr">
                <div class="stat-card-icon"><i class="fas fa-hands-praying"></i></div>
                <div class="stat-value">${toArabicNumber(ibadatStats.totalDhikr)}</div>
                <div class="stat-label">${translations[currentLanguage].dashboard_stat_dhikr}</div>
            </div>
            <div class="stat-card stat-card-quran">
                <div class="stat-card-icon"><i class="fas fa-book-quran"></i></div>
                <div class="stat-value">${toArabicNumber(ibadatStats.totalQuran)}</div>
                <div class="stat-label">${translations[currentLanguage].dashboard_stat_quran}</div>
            </div>
            <div class="stat-card stat-card-achievement">
                <div class="stat-card-icon"><i class="fas fa-percentage"></i></div>
                <div class="stat-value">${toArabicNumber(stats.percentage)}%</div>
                <div class="stat-label">${translations[currentLanguage].dashboard_stat_achievement}</div>
            </div>
            <div class="stat-card stat-card-remaining">
                <div class="stat-card-icon"><i class="fas fa-clock"></i></div>
                <div class="stat-value">${toArabicNumber(30 - stats.completedDays)}</div>
                <div class="stat-label">${translations[currentLanguage].dashboard_stat_remaining}</div>
            </div>
            <div class="stat-card stat-card-completed">
                <div class="stat-card-icon"><i class="fas fa-check-circle"></i></div>
                <div class="stat-value">${toArabicNumber(stats.completedDays)}</div>
                <div class="stat-label">${translations[currentLanguage].dashboard_stat_completed_days}</div>
            </div>
        `;
    }

    statsCard.appendChild(statsGrid);
    container.appendChild(statsCard);

    // Event Listeners for Nav
    setTimeout(() => {
        const prevBtn = document.getElementById('prevDayDashboard');
        const nextBtn = document.getElementById('nextDayDashboard');
        const summaryBtn = document.getElementById('showOverallSummary');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                dashboardViewMode = dashboardViewMode <= 1 ? 30 : dashboardViewMode - 1;
                renderDashboard();
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                dashboardViewMode = dashboardViewMode >= 30 ? 1 : dashboardViewMode + 1;
                renderDashboard();
            });
        }
        if (summaryBtn) {
            summaryBtn.addEventListener('click', () => {
                dashboardViewMode = 0;
                renderDashboard();
            });
        }
    }, 0);
}




function computeDailyProgress(profile) {
    const data = profile.ramadanData || {};
    const days = data.days || {};
    const currentDay = data.currentDay || 1;

    const labels = [];
    const values = [];
    let cumulative = 0;

    for (let day = 1; day <= Math.min(currentDay, 30); day++) {
        labels.push(`${translations[currentLanguage].roadmap_day_label} ${toArabicNumber(day)}`);
        if (days[day] && (days[day].completed || days[day].isPeriod)) {
            cumulative++;
        }
        values.push(cumulative);
    }

    return { labels, values };
}

function computeIbadatStats(profile, specificDay = 0) {
    const data = profile.ramadanData || {};
    const days = data.days || {};

    let totalPrayers = 0;
    let totalQuran = 0;
    let totalDhikr = 0;
    let totalNawafil = 0;

    // Filter days if specificDay is provided and valid (1-30)
    const daysToProcess = (specificDay >= 1 && specificDay <= 30)
        ? (days[specificDay] ? [days[specificDay]] : [])
        : Object.values(days);

    daysToProcess.forEach(day => {
        if (!day || (!day.completed && !day.isPeriod)) return;

        // Count prayers (standard mode only)
        if (!day.isPeriod && day.prayers) {
            const prayers = day.prayers;
            if (prayers.fajr) totalPrayers++;
            if (prayers.dhuhr) totalPrayers++;
            if (prayers.asr) totalPrayers++;
            if (prayers.maghrib) totalPrayers++;
            if (prayers.isha) totalPrayers++;
        }

        // Count Quran sessions
        if (day.quran) {
            const quran = day.quran;
            if (quran.fajr) totalQuran++;
            if (quran.dhuhr) totalQuran++;
            if (quran.asr) totalQuran++;
            if (quran.maghrib) totalQuran++;
            if (quran.isha) totalQuran++;
        }

        // Count Dhikr sessions
        if (day.dhikr) {
            const dhikr = day.dhikr;
            const dhikrCount = Object.values(dhikr).filter(v => v).length;
            totalDhikr += dhikrCount;
        }
        // Count Sunan & Nawafil
        if (!day.isPeriod && day.prayers) {
            const prayers = day.prayers;
            if (prayers.tarawih) totalNawafil++;
            if (prayers.duha) totalNawafil++;
            if (prayers.qiyam) totalNawafil++;
            if (prayers.shurouq) totalNawafil++;
            if (prayers.rawatib) totalNawafil++;
        }
    });

    return { totalPrayers, totalQuran, totalDhikr, totalNawafil };
}

// Handle Window Resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        generateRoadmap();
    }, 200);
});

// Start the app
document.addEventListener('DOMContentLoaded', init);
