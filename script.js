// === SmartLight Hub - Core Logic ===

// DOM Elements: Luci
const lightRed = document.getElementById('light-red');
const lightAmber = document.getElementById('light-amber');
const lightGreen = document.getElementById('light-green');

// DOM Elements: Interfaccia e Dati
const phaseDisplay = document.getElementById('phaseDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const logBox = document.getElementById('logBox');
const pedButton = document.getElementById('pedButton');
const pedInfo = document.getElementById('pedInfo');
const manualControls = document.getElementById('manualControls');

// DOM Elements: Statistiche
const statMode = document.getElementById('statMode');
const statRequests = document.getElementById('statRequests');

// Inputs & Controlli
const modeRadios = document.querySelectorAll('input[name="mode"]');
const btnRed = document.getElementById('btnRed');
const btnAmber = document.getElementById('btnAmber');
const btnGreen = document.getElementById('btnGreen');
const durGreenInput = document.getElementById('durGreen');
const durGreenLabel = document.getElementById('durGreenLabel');

// Stato del Sistema
let mode = 'auto'; // 'auto' | 'manual'
let current = 'red';
let timerHandle = null;
let countdownInterval = null;
let pedestrianQueue = [];
let durations = {
  green: parseInt(durGreenInput.value),
  amber: 2,
  red: 6
};

// --- AUDIO UTILITY (Beep) ---
const beep = (() => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        return (freq = 880, dur = 0.1) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.frequency.value = freq;
            o.type = 'sine';
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + dur);
            setTimeout(() => o.stop(), dur * 1000);
        };
    } catch (e) { return () => {}; }
})();

// --- SYSTEM LOGGING ---
function log(msg) {
    const time = new Date().toLocaleTimeString();
    const el = document.createElement('div');
    el.innerText = `[${time}] ${msg}`;
    logBox.prepend(el);
}

// --- LIGHT CONTROLLER ---
// Gestisce l'accensione visiva e l'aggiornamento etichette
function setLight(color, duration = 0) {
    current = color;
    // Reset classi active
    [lightRed, lightAmber, lightGreen].forEach(l => l.classList.remove('active'));
    
    let label = '';
    if (color === 'red') {
        lightRed.classList.add('active');
        label = 'Stop (Rosso)';
        phaseDisplay.className = 'metric-value text-red';
    } else if (color === 'amber') {
        lightAmber.classList.add('active');
        label = 'Attenzione (Giallo)';
        phaseDisplay.className = 'metric-value text-yellow';
    } else {
        lightGreen.classList.add('active');
        label = 'Via Libera (Verde)';
        phaseDisplay.className = 'metric-value text-green'; // Necessita .text-green in CSS o usa default
        phaseDisplay.style.color = 'var(--accent-green)';
    }
    
    phaseDisplay.textContent = label;
    
    // Gestione Timer Countdown
    if (duration > 0 && mode === 'auto') {
        startCountdown(duration);
    } else {
        clearInterval(countdownInterval);
        timerDisplay.textContent = '--';
    }
}

function startCountdown(seconds) {
    clearInterval(countdownInterval);
    let left = seconds;
    timerDisplay.textContent = `${left}s`;
    
    countdownInterval = setInterval(() => {
        left--;
        if (left >= 0) timerDisplay.textContent = `${left}s`;
        else clearInterval(countdownInterval);
    }, 1000);
}

// --- AUTOMATIC CYCLE LOGIC ---
function startAutoCycle() {
    clearTimeout(timerHandle);
    mode = 'auto';
    statMode.textContent = 'Automatic';
    statMode.classList.add('text-yellow');
    statMode.style.color = ''; // Reset override manuale
    manualControls.classList.add('hidden');
    log('Sistema in AUTO. Ciclo avviato.');
    autoStep('green');
}

function autoStep(nextPhase) {
    if (mode !== 'auto') return;

    if (nextPhase === 'green') {
        // Logica Adattiva: Riduci verde se ci sono pedoni
        const hasPed = pedestrianQueue.length > 0;
        let d = durations.green;
        
        if (hasPed) {
             d = Math.max(3, Math.round(d * 0.5)); 
             log(`Verde ridotto a ${d}s per priorità pedonale.`);
        }
        
        setLight('green', d);
        timerHandle = setTimeout(() => autoStep('amber'), d * 1000);
        
    } else if (nextPhase === 'amber') {
        setLight('amber', durations.amber);
        timerHandle = setTimeout(() => autoStep('red'), durations.amber * 1000);
        
    } else if (nextPhase === 'red') {
        setLight('red', durations.red);
        
        // Rilascio Pedonale durante il rosso
        if (pedestrianQueue.length > 0) {
            setTimeout(() => {
                beep(880, 0.2); // Feedback sonoro
                log(`PEDONI: ${pedestrianQueue.length} richieste servite.`);
                pedestrianQueue = [];
                updatePedInfo();
            }, 1000);
        }
        
        timerHandle = setTimeout(() => autoStep('green'), durations.red * 1000);
    }
}

// --- MANUAL MODE LOGIC ---
function setManualMode() {
    clearTimeout(timerHandle);
    clearInterval(countdownInterval);
    mode = 'manual';
    statMode.textContent = 'Manual Override';
    statMode.classList.remove('text-yellow');
    statMode.style.color = 'var(--accent-red)';
    manualControls.classList.remove('hidden');
    timerDisplay.textContent = 'MANUAL';
    log('Sistema in MANUALE. Attendere input.');
}

// --- EVENT HANDLERS ---

// Cambio Modalità
modeRadios.forEach(r => {
    r.addEventListener('change', (e) => {
        if (e.target.value === 'auto') startAutoCycle();
        else setManualMode();
    });
});

// Bottoni Manuali
btnRed.addEventListener('click', () => { setLight('red'); log('Manuale: Rosso impostato'); });
btnAmber.addEventListener('click', () => { setLight('amber'); log('Manuale: Giallo impostato'); });
btnGreen.addEventListener('click', () => { setLight('green'); log('Manuale: Verde impostato'); });

// Slider Durata
durGreenInput.addEventListener('input', (e) => {
    durations.green = parseInt(e.target.value);
    durGreenLabel.textContent = durations.green;
});

// Pedestrian Request Button
function updatePedInfo() {
    statRequests.textContent = pedestrianQueue.length;
    pedInfo.textContent = pedestrianQueue.length > 0 
        ? `${pedestrianQueue.length} richiesta/e in attesa` 
        : 'Nessuna richiesta';
    pedInfo.style.color = pedestrianQueue.length > 0 ? 'var(--accent-red)' : '#666';
}

pedButton.addEventListener('click', () => {
    pedestrianQueue.push(Date.now());
    updatePedInfo();
    log('Nuova richiesta pedonale acquisita.');
    // Semplice feedback visivo sul bottone
    const originalText = pedButton.textContent;
    pedButton.textContent = 'Richiesta Inviata!';
    setTimeout(() => pedButton.textContent = originalText, 1000);
});

// Keyboard Shortcut (Spazio = Emergenza)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        log('EMERGENCY OVERRIDE (Tastiera)');
        setManualMode();
        setLight('red');
        // Aggiorna UI radio button
        document.querySelector('input[value="manual"]').checked = true;
    }
});

// Avvio Iniziale
startAutoCycle();