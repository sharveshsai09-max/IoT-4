(function(){
  // ---------- State ----------
  let passcode = "1234";
  let armed = false;
  let motionActive = false;
  let alarmActive = false;
  let entered = "";
  let failedAttempts = 0;
  let entryRemaining = 0;
  let entryTimerId = null;
  let sirenIntervalId = null;
  let audioCtx = null;

  const ENTRY_DELAY = 10; // seconds to enter code after motion before alarm fires
  const MAX_ATTEMPTS = 3;

  // ---------- DOM refs ----------
  const armBtn = document.getElementById('armBtn');
  const motionBtn = document.getElementById('motionBtn');
  const keypadGrid = document.getElementById('keypadGrid');
  const codeDisplay = document.getElementById('codeDisplay');
  const keyHint = document.getElementById('keyHint');
  const keyHintBanner = document.getElementById('keyHintBanner');
  const logList = document.getElementById('logList');
  const resetBtn = document.getElementById('resetBtn');
  const ledSystem = document.getElementById('ledSystem');
  const ledMotion = document.getElementById('ledMotion');
  const ledAlarm = document.getElementById('ledAlarm');
  const handleGroup = document.getElementById('handleGroup');
  const dialState = document.getElementById('dialState');
  const dialSub = document.getElementById('dialSub');
  const countdownText = document.getElementById('countdownText');
  const ringPulse = document.getElementById('ringPulse');
  const alarmFlashRing = document.getElementById('alarmFlashRing');
  const ticksG = document.getElementById('ticks');

  const logToggleBtn = document.getElementById('logToggleBtn');
  const logOverlay = document.getElementById('logOverlay');
  const logCloseBtn = document.getElementById('logCloseBtn');
  const adminToggleBtn = document.getElementById('adminToggleBtn');
  const adminOverlay = document.getElementById('adminOverlay');
  const adminCloseBtn = document.getElementById('adminCloseBtn');
  const curCodeIn = document.getElementById('curCode');
  const newCodeIn = document.getElementById('newCode');
  const confirmCodeIn = document.getElementById('confirmCode');
  const changeCodeBtn = document.getElementById('changeCodeBtn');
  const adminMsg = document.getElementById('adminMsg');

  // ---------- Build dial ticks ----------
  (function buildTicks(){
    const cx = 120, cy = 120, rOuter = 108, rInner = 98;
    let html = "";
    for(let i=0;i<24;i++){
      const a = (i / 24) * Math.PI * 2;
      const x1 = cx + rInner*Math.cos(a), y1 = cy + rInner*Math.sin(a);
      const x2 = cx + rOuter*Math.cos(a), y2 = cy + rOuter*Math.sin(a);
      html += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }
    ticksG.innerHTML = html;
  })();

  // ---------- Build keypad ----------
  const keys = ["1","2","3","4","5","6","7","8","9","⌫","0","✕"];
  keys.forEach(k=>{
    const b = document.createElement('button');
    b.className = "key" + (k==="⌫"||k==="✕" ? " fn" : "");
    b.textContent = k;
    b.dataset.key = k;
    b.disabled = true;
    b.addEventListener('click', ()=>onKey(k));
    keypadGrid.appendChild(b);
  });

  function renderCodeDots(){
    codeDisplay.innerHTML = "";
    for(let i=0;i<4;i++){
      const d = document.createElement('div');
      d.className = "code-dot";
      d.textContent = entered.length > i ? "●" : "";
      codeDisplay.appendChild(d);
    }
  }
  renderCodeDots();

  // ---------- Audio ----------
  function ctx(){
    if(!audioCtx){ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
    return audioCtx;
  }
  function beep(freq, dur, type, vol){
    try{
      const ac = ctx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.value = vol||0.06;
      osc.connect(gain); gain.connect(ac.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.stop(ac.currentTime + dur + 0.02);
    }catch(e){}
  }
  function playKeyTone(){ beep(900, 0.05, 'sine', 0.04); }
  function playError(){ beep(220, 0.18, 'sawtooth', 0.07); setTimeout(()=>beep(180,0.2,'sawtooth',0.07),120); }
  function playSuccess(){ beep(700,0.08,'sine',0.06); setTimeout(()=>beep(1000,0.12,'sine',0.06),90); }
  function startSiren(){
    stopSiren();
    let high = true;
    sirenIntervalId = setInterval(()=>{
      beep(high?1000:650, 0.28, 'square', 0.05);
      high = !high;
    }, 280);
  }
  function stopSiren(){ if(sirenIntervalId){ clearInterval(sirenIntervalId); sirenIntervalId=null; } }

  // ---------- Logging ----------
  function log(msg, type){
    const row = document.createElement('div');
    row.className = "log-row";
    const t = document.createElement('span');
    t.className = "log-time";
    t.textContent = new Date().toLocaleTimeString();
    const m = document.createElement('span');
    m.className = "log-msg " + (type||"info");
    m.textContent = msg;
    row.appendChild(t); row.appendChild(m);
    logList.appendChild(row);
    logList.scrollTop = logList.scrollHeight;
  }

  // ---------- UI sync ----------
  function syncUI(){
    ledSystem.className = "led" + (armed ? " on-green" : "");
    ledMotion.className = "led" + (motionActive ? " on-amber" : "");
    ledAlarm.className = "led" + (alarmActive ? " on-red" : "");

    if(alarmActive){
      armBtn.textContent = "Alarm active — enter code to reset";
      armBtn.className = "arm-btn armed";
      armBtn.disabled = true;
    } else if(armed){
      armBtn.textContent = "Disarm via keypad below";
      armBtn.className = "arm-btn armed";
      armBtn.disabled = true;
    } else {
      armBtn.textContent = "Arm system";
      armBtn.className = "arm-btn disarmed";
      armBtn.disabled = false;
    }

    motionBtn.disabled = !armed || alarmActive || motionActive;

    const enableKeys = armed;
    keypadGrid.classList.toggle('disabled', !enableKeys);
    [...keypadGrid.children].forEach(b => b.disabled = !enableKeys);
    keyHint.textContent = !armed
      ? "Arm the system to enable the keypad"
      : alarmActive
        ? "Enter passcode to silence alarm and disarm"
        : motionActive
          ? "Motion detected — enter passcode before timer runs out"
          : "System armed — enter passcode to disarm";

    keyHintBanner.textContent = (armed && !motionActive && !alarmActive)
      ? "⌨ Press any key, or click the button above, to simulate motion"
      : "";

    if(alarmActive){
      handleGroup.style.transform = "rotate(0deg)";
      dialState.textContent = "ALARM";
      dialState.style.color = "var(--red)";
      dialSub.textContent = "intruder alert";
      alarmFlashRing.classList.add('show');
      ringPulse.classList.remove('show');
    } else if(motionActive){
      handleGroup.style.transform = "rotate(35deg)";
      dialState.textContent = "ARMED";
      dialState.style.color = "var(--amber)";
      dialSub.textContent = "motion detected";
      ringPulse.classList.add('show');
      alarmFlashRing.classList.remove('show');
    } else if(armed){
      handleGroup.style.transform = "rotate(90deg)";
      dialState.textContent = "ARMED";
      dialState.style.color = "var(--green)";
      dialSub.textContent = "vault locked";
      ringPulse.classList.remove('show');
      alarmFlashRing.classList.remove('show');
    } else {
      handleGroup.style.transform = "rotate(0deg)";
      dialState.textContent = "DISARMED";
      dialState.style.color = "var(--cyan)";
      dialSub.textContent = "vault unlocked";
      ringPulse.classList.remove('show');
      alarmFlashRing.classList.remove('show');
    }

    countdownText.textContent = motionActive && !alarmActive ? String(entryRemaining).padStart(2,'0') : "";
    renderCodeDots();
  }

  // ---------- Core actions ----------
  function armSystem(){
    armed = true;
    motionActive = false;
    alarmActive = false;
    entered = "";
    failedAttempts = 0;
    stopSiren();
    log("System armed — vault monitoring active. Press any key or click 'Trigger motion sensor' to simulate motion.", "ok");
    syncUI();
  }

  function fullDisarm(reason){
    armed = false;
    motionActive = false;
    alarmActive = false;
    entered = "";
    failedAttempts = 0;
    clearEntryTimer();
    stopSiren();
    log(reason || "System disarmed", "ok");
    syncUI();
  }

  function clearEntryTimer(){
    if(entryTimerId){ clearInterval(entryTimerId); entryTimerId = null; }
    entryRemaining = 0;
  }

  function triggerMotion(){
    if(!armed){ return; }
    if(alarmActive || motionActive){ return; }
    motionActive = true;
    entryRemaining = ENTRY_DELAY;
    log(`⚠ Motion detected while armed — ${ENTRY_DELAY}s entry delay started`, "warn");
    syncUI();
    entryTimerId = setInterval(()=>{
      entryRemaining--;
      if(entryRemaining <= 0){
        clearEntryTimer();
        triggerAlarm("⏱ Entry delay expired with no valid code — ");
        return;
      }
      syncUI();
    }, 1000);
  }

  function triggerAlarm(prefix){
    clearEntryTimer();
    motionActive = false;
    alarmActive = true;
    startSiren();
    log((prefix||"") + "🚨 ALARM TRIGGERED — intrusion detected!", "bad");
    syncUI();
  }

  function onKey(k){
    if(!armed) return;
    playKeyTone();
    if(k === "✕"){ entered = ""; syncUI(); return; }
    if(k === "⌫"){ entered = entered.slice(0,-1); syncUI(); return; }
    if(entered.length >= 4) return;
    entered += k;
    syncUI();
    if(entered.length === 4){
      setTimeout(()=>checkCode(), 150);
    }
  }

  function checkCode(){
    if(entered === passcode){
      playSuccess();
      fullDisarm(alarmActive ? "✅ Correct code — alarm silenced, system disarmed"
                : motionActive ? "✅ Correct code — access granted, system disarmed"
                : "✅ Correct code — system disarmed");
    } else {
      failedAttempts++;
      playError();
      log(`❌ Incorrect code entered (attempt ${failedAttempts}/${MAX_ATTEMPTS})`, "bad");
      entered = "";
      if(failedAttempts >= MAX_ATTEMPTS){
        failedAttempts = 0;
        triggerAlarm("🔒 Too many incorrect attempts — ");
      } else {
        syncUI();
      }
    }
  }

  // ---------- Keyboard = motion sensor ----------
  window.addEventListener('keydown', (e)=>{
    // Ignore keystrokes while a modal text field is focused (admin passcode inputs)
    const tag = document.activeElement && document.activeElement.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA') return;
    if(armed && !motionActive && !alarmActive){
      triggerMotion();
    }
  });

  // ---------- Modals ----------
  function openModal(overlay){ overlay.classList.add('show'); }
  function closeModal(overlay){ overlay.classList.remove('show'); }

  logToggleBtn.addEventListener('click', ()=>openModal(logOverlay));
  logCloseBtn.addEventListener('click', ()=>closeModal(logOverlay));
  logOverlay.addEventListener('click', (e)=>{ if(e.target === logOverlay) closeModal(logOverlay); });

  adminToggleBtn.addEventListener('click', ()=>{ adminMsg.textContent = ""; openModal(adminOverlay); });
  adminCloseBtn.addEventListener('click', ()=>closeModal(adminOverlay));
  adminOverlay.addEventListener('click', (e)=>{ if(e.target === adminOverlay) closeModal(adminOverlay); });

  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      closeModal(logOverlay);
      closeModal(adminOverlay);
    }
  });

  // ---------- Passcode change ----------
  function setAdminMsg(text, ok){
    adminMsg.textContent = text;
    adminMsg.style.color = ok ? "var(--green)" : "var(--red)";
  }
  changeCodeBtn.addEventListener('click', ()=>{
    const cur = curCodeIn.value.trim();
    const nw = newCodeIn.value.trim();
    const cf = confirmCodeIn.value.trim();
    if(armed){ setAdminMsg("Disarm the system before changing the passcode", false); return; }
    if(cur !== passcode){ setAdminMsg("Current code incorrect", false); return; }
    if(!/^\d{4}$/.test(nw)){ setAdminMsg("New code must be 4 digits", false); return; }
    if(nw !== cf){ setAdminMsg("Confirmation does not match", false); return; }
    passcode = nw;
    curCodeIn.value = ""; newCodeIn.value = ""; confirmCodeIn.value = "";
    setAdminMsg("Passcode updated successfully", true);
    log("Passcode updated successfully", "ok");
  });

  // ---------- Wire buttons ----------
  armBtn.addEventListener('click', armSystem);
  motionBtn.addEventListener('click', triggerMotion);
  resetBtn.addEventListener('click', ()=>{
    fullDisarm("— demo reset —");
    logList.innerHTML = "";
    passcode = "1234";
    log("Console reset. System disarmed, default passcode restored to 1234.", "info");
  });

  // ---------- Init ----------
  log("Console online. Default passcode is 1234. Arm the system, then press any key to simulate motion.", "info");
  syncUI();
})();
