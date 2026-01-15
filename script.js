// script.js - demo semaforo SmartLight Hub
// Note: semplice implementazione client-side per la demo.
// Funzionalità: ciclo auto/manual, richiesta pedone, timers, log

// Elementi
const lightRed = document.getElementById('light-red');
const lightAmber = document.getElementById('light-amber');
const lightGreen = document.getElementById('light-green');
const statusText = document.getElementById('statusText');
const activeColor = document.getElementById('activeColor');
const logBox = document.getElementById('logBox');
const pedButton = document.getElementById('pedButton');
const pedInfo = document.getElementById('pedInfo');
const modeRadios = document.querySelectorAll('input[name="mode"]');
const manualControls = document.getElementById('manualControls');
const btnRed = document.getElementById('btnRed');
const btnAmber = document.getElementById('btnAmber');
const btnGreen = document.getElementById('btnGreen');
const durGreen = document.getElementById('durGreen');
const durAmber = document.getElementById('durAmber');
const durRed = document.getElementById('durRed');
const durGreenLabel = document.getElementById('durGreenLabel');
const durAmberLabel = document.getElementById('durAmberLabel');
const durRedLabel = document.getElementById('durRedLabel');
const syncAccent = document.getElementById('syncAccent');
const soundToggle = document.getElementById('sound');

let mode = 'auto';
let current = 'red'; // red | amber | green
let timerHandle = null;
let pedestrianQueue = []; // timestamps of requests

// default durations (seconds)
let durations = {
  green: parseInt(durGreen.value),
  amber: parseInt(durAmber.value),
  red: parseInt(durRed.value)
};

// simple audio (beep) for crossing start
const beep = (() => {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    return (freq=880, dur=0.08) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type='sine'; o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      o.start(0);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.02); o.stop(); }, dur*1000);
    };
  } catch(e){ return ()=>{} }
})();

function log(msg){
  const time = new Date().toLocaleTimeString();
  const el = document.createElement('div');
  el.textContent = `[${time}] ${msg}`;
  logBox.prepend(el);
}

// Set active light visuals
function setLight(color){
  current = color;
  [lightRed, lightAmber, lightGreen].forEach(el => el.classList.remove('active'));
  if(color === 'red') lightRed.classList.add('active', 'red');
  if(color === 'amber') lightAmber.classList.add('active', 'amber');
  if(color === 'green') lightGreen.classList.add('active', 'green');

  // status and page accent
  statusText.textContent = mode === 'auto' ? 'Auto' : 'Manual';
  activeColor.style.background = (color === 'red' ? getComputedStyle(document.documentElement).getPropertyValue('--traffic-red') :
                                   color === 'amber' ? getComputedStyle(document.documentElement).getPropertyValue('--traffic-amber') :
                                   getComputedStyle(document.documentElement).getPropertyValue('--traffic-green'));

  if(syncAccent.checked){
    document.body.classList.remove('body-accent-red','body-accent-amber','body-accent-green');
    document.body.classList.add(color==='red'?'body-accent-red':color==='amber'?'body-accent-amber':'body-accent-green');
  }
}

// Auto cycle (recursive)
function startAutoCycle(){
  clearTimeout(timerHandle);
  mode = 'auto';
  setLight('green'); // start with green for demo
  log('Modalità Auto attivata. Avvio ciclo.');
  autoStep('green');
}

function autoStep(state){
  // check pedestrian queue: if people waiting, ensure a red soon to allow crossing
  if(state === 'green'){
    // if queue exists longer than threshold, shorten green
    const hasPed = pedestrianQueue.length > 0;
    const dur = hasPed ? Math.max(3, Math.round(durations.green * 0.6)) : durations.green;
    log(`Green per ${dur}s${hasPed? ' (ridotto per richieste pedoni)':''}`);
    setLight('green');
    timerHandle = setTimeout(()=>autoStep('amber'), dur*1000);
  } else if(state === 'amber'){
    setLight('amber');
    timerHandle = setTimeout(()=>autoStep('red'), durations.amber*1000);
  } else if(state === 'red'){
    setLight('red');
    // allow pedestrians to cross if queued: simulate release
    if(pedestrianQueue.length > 0){
      // simulate cross: give audible feedback and clear queue
      if(soundToggle.checked) beep(880,0.12);
      log(`Permesso pedonale rilasciato a ${pedestrianQueue.length} richiesta/e`);
      pedInfo.textContent = `Rilasciate ${pedestrianQueue.length} richieste`;
      pedestrianQueue = [];
      // keep red for configured duration + small buffer
      timerHandle = setTimeout(()=>autoStep('green'), (durations.red+0.5)*1000);
    } else {
      timerHandle = setTimeout(()=>autoStep('green'), durations.red*1000);
    }
  }
}

// Manual overrides
function setManual(color){
  clearTimeout(timerHandle);
  mode = 'manual';
  setLight(color);
  log(`Modalità Manual: impostato ${color.toUpperCase()}`);
  // in manual we don't auto-change; user can change or re-enable auto
}

// Pedestrian request
pedButton.addEventListener('click', ()=>{
  const ts = Date.now();
  pedestrianQueue.push(ts);
  pedInfo.textContent = `In coda: ${pedestrianQueue.length}`;
  log('Richiesta pedone aggiunta');
});

// Mode switch
modeRadios.forEach(r => r.addEventListener('change', (ev)=>{
  if(ev.target.value === 'auto') startAutoCycle();
  else {
    clearTimeout(timerHandle);
    mode = 'manual';
    statusText.textContent = 'Manual';
    manualControls.hidden = false;
    log('Modalità Manual attivata');
  }
}));

// Manual buttons
btnRed.addEventListener('click', ()=> setManual('red'));
btnAmber.addEventListener('click', ()=> setManual('amber'));
btnGreen.addEventListener('click', ()=> setManual('green'));

// Timers change
[durGreen,durAmber,durRed].forEach(el=>{
  el.addEventListener('input', ()=>{
    durations.green = parseInt(durGreen.value);
    durations.amber = parseInt(durAmber.value);
    durations.red = parseInt(durRed.value);
    durGreenLabel.textContent = durations.green;
    durAmberLabel.textContent = durations.amber;
    durRedLabel.textContent = durations.red;
  });
});

// Keyboard support: space triggers pedestrian button; A toggles auto/manual
document.addEventListener('keydown', (e)=>{
  if(e.key === ' ') { e.preventDefault(); pedButton.classList.add('active'); pedButton.click(); setTimeout(()=>pedButton.classList.remove('active'),160); }
  if(e.key.toLowerCase() === 'a') {
    // toggle
    const autoRadio = document.querySelector('input[name="mode"][value="auto"]');
    const manualRadio = document.querySelector('input[name="mode"][value="manual"]');
    if(mode === 'auto'){ manualRadio.checked = true; manualControls.hidden = false; mode = 'manual'; clearTimeout(timerHandle); log('Modalità Manual (toggle)'); }
    else { autoRadio.checked = true; manualControls.hidden = true; startAutoCycle(); }
  }
});

// Initial setup
function init(){
  // set initial classes based on mode
  manualControls.hidden = true;
  setLight(current);
  durations.green = parseInt(durGreen.value);
  durations.amber = parseInt(durAmber.value);
  durations.red = parseInt(durRed.value);
  durGreenLabel.textContent = durations.green;
  durAmberLabel.textContent = durations.amber;
  durRedLabel.textContent = durations.red;
  startAutoCycle();
}

init();
