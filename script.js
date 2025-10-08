// ---------- Sound Engine (improved) ----------
class SoundEngine {
  constructor() { this.ctx = null; this.engineOsc = null; this.engineGain = null; }
  ensure() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
  beep(freq = 880, time = 0.12, when = 0) {
    this.ensure();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = 0.001;
    o.connect(g); g.connect(this.ctx.destination);
    const t = this.ctx.currentTime + when;
    g.gain.linearRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + time);
    o.start(t); o.stop(t + time + 0.02);
  }
  startEngine() {
    this.ensure();
    if (this.engineOsc) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    // add a little lowpass to soften the sawtooth
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1200;
    o.type = 'sawtooth'; o.frequency.value = 80;
    g.gain.value = 0.004; // base volume
    o.connect(g); g.connect(lp); lp.connect(this.ctx.destination);
    o.start();
    this.engineOsc = o; this.engineGain = g; this.engineFilter = lp;
  }
  setEngineIntensity(i) {
    // i: 0..1 -> change pitch + volume
    if (!this.engineGain || !this.engineOsc) return;
    const clamp = v => Math.max(0, Math.min(1, v));
    i = clamp(i);
    // volume: small base + scaled
    const target = 0.002 + 0.01 * i;
    this.engineGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.05);
    // pitch
    this.engineOsc.frequency.linearRampToValueAtTime(70 + i * 300, this.ctx.currentTime + 0.05);
    // filter opens with intensity
    if (this.engineFilter) this.engineFilter.frequency.linearRampToValueAtTime(700 + i * 2200, this.ctx.currentTime + 0.05);
  }
  stopEngine() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch (e) {}
    try { this.engineOsc.disconnect(); } catch (e) {}
    try { this.engineGain.disconnect(); } catch (e) {}
    try { this.engineFilter.disconnect(); } catch (e) {}
    this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
  }
  crash() {
    this.ensure();
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.02));
    const src = this.ctx.createBufferSource(); src.buffer = buffer;
    const g = this.ctx.createGain(); g.gain.value = 0.8;
    src.connect(g); g.connect(this.ctx.destination); src.start();
  }
  victory() {
    this.beep(880, 0.12, 0);
    setTimeout(()=>this.beep(1046.5, 0.12, 0.15), 0);
    setTimeout(()=>this.beep(1318.5, 0.12, 0.3), 0);
  }
}
const sound = new SoundEngine();

// ---------- DOM / Canvas ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hudScore = document.getElementById('hudScore');
const hudLives = document.getElementById('hudLives');
const hudTimer = document.getElementById('hudTimer');
const startOverlay = document.getElementById('startOverlay');
const startBtn = document.getElementById('overlayStart');
const countOverlay = document.getElementById('countOverlay');
const countText = document.getElementById('countText');

const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

const CANVAS_W = canvas.width, CANVAS_H = canvas.height;
const ROAD_X = 30, ROAD_W = CANVAS_W - 60;
const LANE_COUNT = 3, LANE_W = ROAD_W / LANE_COUNT;
const CAR_W = 52, CAR_H = 96;

// ---------- Game state ----------
let score = 0, lives = 3, totalTime = 45, timeLeft = totalTime;
let running = false, paused = false, elapsed = 0, spawnTimer = 0;
let baseSpeed = 2.0, speedMultiplier = 1;
const enemies = []; const keys = { left:false, right:false, up:false, down:false };
let bgOffset = 0;

// particle systems
const smokeParticles = []; // exhaust while driving
const fireParticles = [];  // fire + heavy smoke at end
let inFireMode = false;
let fireEndAt = 0;

// images
const playerImg = new Image();
playerImg.src = "https://thumbs.dreamstime.com/b/yellow-car-top-view-vector-illustration-sedan-284618518.jpg";
const enemyImgs = [
  "https://tse2.mm.bing.net/th/id/OIP.b016nfhhpWQiH8-_zxiq0gHaHa?pid=Api&P=0&h=220",
  "https://tse2.mm.bing.net/th/id/OIP.tswnRHsV3-fUij9C6N1IaQHaHa?pid=Api&P=0&h=220"
].map(s => { const im = new Image(); im.src = s; return im; });

// player
const player = { x: 0, y: CANVAS_H - CAR_H - 16, w: CAR_W, h: CAR_H, speed: 6 };
player.x = ROAD_X + ROAD_W/2 - CAR_W/2;

// ---------- Input ----------
window.addEventListener('keydown', e => {
  if (['ArrowLeft','a','A'].includes(e.key)) keys.left = true;
  if (['ArrowRight','d','D'].includes(e.key)) keys.right = true;
  if (['ArrowUp','w','W'].includes(e.key)) keys.up = true;
  if (['ArrowDown','s','S'].includes(e.key)) keys.down = true;
});
window.addEventListener('keyup', e => {
  if (['ArrowLeft','a','A'].includes(e.key)) keys.left = false;
  if (['ArrowRight','d','D'].includes(e.key)) keys.right = false;
  if (['ArrowUp','w','W'].includes(e.key)) keys.up = false;
  if (['ArrowDown','s','S'].includes(e.key)) keys.down = false;
});
function bindButton(el, press, release) {
  ['pointerdown','touchstart','mousedown'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); press(); }));
  ['pointerup','touchend','mouseup','mouseleave','pointercancel'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); release(); }));
}
if (btnLeft && btnRight && btnUp && btnDown) {
  bindButton(btnLeft, ()=>keys.left=true, ()=>keys.left=false);
  bindButton(btnRight, ()=>keys.right=true, ()=>keys.right=false);
  bindButton(btnUp, ()=>keys.up=true, ()=>keys.up=false);
  bindButton(btnDown, ()=>keys.down=true, ()=>keys.down=false);
}

// ---------- Helpers ----------
function laneCenter(i){ return ROAD_X + i*LANE_W + (LANE_W - CAR_W)/2; }
function collides(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function rand(min,max){ return min + Math.random() * (max-min); }

// spawn enemy
function spawnEnemy(){
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const x = laneCenter(lane);
  const y = -CAR_H - Math.random() * 120;
  const img = enemyImgs[Math.floor(Math.random() * enemyImgs.length)];
  enemies.push({ x, y, w: CAR_W, h: CAR_H, img, baseSpeed: baseSpeed + Math.random()*0.6 });
}

// ---------- Particles ----------
// smoke particle: {x,y,vx,vy,size,alpha}
function spawnSmoke(x,y,strength=1){
  smokeParticles.push({
    x: x + rand(-8,8),
    y: y + rand(-6,6),
    vx: rand(-0.2,0.2),
    vy: rand(-0.4, -1.0) * strength,
    size: rand(6,12) * strength,
    alpha: rand(0.6,1)
  });
}
function spawnFire(x,y){
  // spawn a cluster of fire + thick smoke
  for (let i=0;i<22;i++){
    fireParticles.push({
      x: x + rand(-12, 12),
      y: y + rand(-6, 6),
      vx: rand(-0.8,0.8),
      vy: rand(-1.0, -3.0),
      size: rand(6,18),
      life: rand(800,1600),
      age: 0,
      type: (Math.random() < 0.4 ? 'flame' : 'smoke') // more smoke than flame can be adjusted
    });
  }
}

// update particles
function updateParticles(dt){
  // smoke (exhaust)
  for (let i = smokeParticles.length-1; i>=0; i--){
    const p = smokeParticles[i];
    p.x += p.vx * dt/16;
    p.y += p.vy * dt/16;
    p.alpha -= 0.004 * dt/16;
    p.size += 0.02 * dt/16;
    if (p.alpha <= 0) smokeParticles.splice(i,1);
  }
  // fireParticles
  for (let i = fireParticles.length-1; i>=0; i--){
    const p = fireParticles[i];
    p.x += p.vx * dt/16;
    p.y += p.vy * dt/16;
    p.age += dt;
    // flames fade faster
    if (p.type === 'flame') p.size *= 1 - 0.0006 * dt;
    else p.size *= 1 + 0.0008 * dt;
    // alpha shrink
    p.alpha = Math.max(0, 1 - p.age / p.life);
    if (p.age >= p.life) fireParticles.splice(i,1);
  }
}

// ---------- Update ----------
let lastSpawn = 0;
function update(dt){
  if (!running && !inFireMode) return;

  // if in fire mode we still want to animate fire particles until the timeout
  if (inFireMode) {
    updateParticles(dt);
    // stop when fire time passed
    if (performance.now() >= fireEndAt) {
      inFireMode = false;
      // reset state and show overlay
      sound.stopEngine();
      setTimeout(()=> {
        startOverlay.style.display = 'flex';
        hudLives.textContent = 'Lives: 3';
        hudScore.textContent = 'Score: 0';
        hudTimer.textContent = 'Time: ' + Math.ceil(totalTime);
        // restore defaults
        score = 0; lives = 3; timeLeft = totalTime; baseSpeed = 2;
        enemies.length = 0; smokeParticles.length = 0; fireParticles.length = 0;
      }, 50);
    }
    return;
  }

  // normal running updates
  // speed up/down with up/down
  if (keys.up) baseSpeed = Math.min(baseSpeed + 0.004 * dt, 8);
  if (keys.down) baseSpeed = Math.max(baseSpeed - 0.006 * dt, 1);

  elapsed += dt;
  speedMultiplier = 1 + Math.floor(elapsed / 8000) * 0.12;
  bgOffset += 220 * (dt / 1000) * speedMultiplier;
  if (bgOffset > 40) bgOffset -= 40;

  // engine intensity (0..1) based on baseSpeed
  const intensity = Math.min(1, (baseSpeed - 1) / 7);
  sound.setEngineIntensity(intensity);

  // spawn some exhaust smoke behind the player when moving
  // spawn rate scales with baseSpeed
  if (Math.random() < 0.2 * (baseSpeed / 3)) {
    spawnSmoke(player.x + player.w/2, player.y + player.h - 6, Math.min(1.6, baseSpeed/3));
  }

  // lateral movement
  if (keys.left) player.x -= player.speed * (1 + (baseSpeed - 2) / 4);
  if (keys.right) player.x += player.speed * (1 + (baseSpeed - 2) / 4);
  const leftBound = ROAD_X + 6, rightBound = ROAD_X + ROAD_W - player.w - 6;
  if (player.x < leftBound) player.x = leftBound;
  if (player.x > rightBound) player.x = rightBound;

  // spawn enemies dynamically
  spawnTimer += dt;
  const dynInt = Math.max(600, 1200 - elapsed * 0.05 - baseSpeed * 40);
  if (spawnTimer >= dynInt) { spawnTimer = 0; spawnEnemy(); }

  // move enemies and collisions
  for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    e.y += (1.8 + speedMultiplier + baseSpeed * 0.32) * (dt / 16);
    if (collides(player, e)){
      // on collision, spawn big smoke + reduce life, remove enemy
      spawnFire(player.x + player.w/2, player.y + player.h/2); // small immediate fire/smoke
      enemies.splice(i, 1);
      lives--; hudLives.textContent = 'Lives: ' + lives;
      sound.crash();
      if (lives <= 0){
        // trigger heavy fire mode: both player & recent enemy on fire for 5s
        triggerFireMode(e);
        return;
      }
    } else if (e.y > CANVAS_H + 60) {
      enemies.splice(i,1);
      score++; hudScore.textContent = 'Score: ' + score;
    }
  }

  // update particles normally
  updateParticles(dt);

  // update time
  timeLeft -= dt/1000;
  if (timeLeft < 0) timeLeft = 0;
  hudTimer.textContent = 'Time: ' + Math.ceil(timeLeft);
  if (timeLeft <= 0){
    running = false;
    sound.stopEngine();
    sound.victory();
    endGame(true);
    return;
  }
}

// ---------- Draw ----------
function draw(){
  // clear
  ctx.clearRect(0,0,CANVAS_W,CANVAS_H);

  // background + road
  ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  ctx.fillStyle = '#2f2f2f'; ctx.fillRect(ROAD_X,0,ROAD_W,CANVAS_H);

  // lane stripes
  ctx.fillStyle = '#dedede';
  const stripeW = 8;
  for (let i=0;i<LANE_COUNT;i++){
    const sx = ROAD_X + i*LANE_W + LANE_W/2 - stripeW/2;
    for (let y = -40 + (bgOffset % 40); y < CANVAS_H + 40; y += 80) {
      ctx.fillRect(sx, y, stripeW, 40);
    }
  }

  // draw particles behind everything (smoke)
  for (const p of smokeParticles) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(120,120,120,${Math.max(0, p.alpha)})`;
    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
    ctx.fill();
  }

  // draw enemies
  for (const e of enemies) {
    // if image isn't loaded, fallback rect
    try {
      ctx.drawImage(e.img, e.x, e.y, e.w, e.h);
    } catch (err) {
      ctx.fillStyle = '#c33'; ctx.fillRect(e.x, e.y, e.w, e.h);
    }
  }

  // draw player
  try {
    ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
  } catch (err) {
    ctx.fillStyle = '#ff0'; ctx.fillRect(player.x, player.y, player.w, player.h);
  }

  // draw fireParticles (draw on top)
  for (const p of fireParticles) {
    if (p.type === 'flame') {
      // bright orange/red
      const a = Math.max(0, 0.9 - p.age / p.life);
      ctx.fillStyle = `rgba(255,${Math.floor(120 + 100*Math.random())},0,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, p.size*0.6), 0, Math.PI*2); ctx.fill();
    } else {
      // smoke
      const a = Math.max(0, 0.8 - p.age / p.life);
      ctx.fillStyle = `rgba(80,80,80,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, p.size*0.9), 0, Math.PI*2); ctx.fill();
    }
  }

  // optionally draw HUD overlays are DOM-based, so not here
}

// ---------- Fire end-mode ----------
function triggerFireMode(lastEnemy){
  // heavy fire + smoke for player & lastEnemy
  inFireMode = true;
  fireParticles.length = 0;
  // spawn bursts around both vehicles for 5 seconds
  const px = player.x + player.w/2;
  const py = player.y + player.h/2;
  const ex = (lastEnemy && lastEnemy.x) ? lastEnemy.x + lastEnemy.w/2 : player.x + 30;
  const ey = (lastEnemy && lastEnemy.y) ? lastEnemy.y + lastEnemy.h/2 : player.y;

  // stop engine immediately
  sound.stopEngine();
  sound.crash();

  // spawn initial cluster
  for (let i=0;i<60;i++){
    fireParticles.push({
      x: px + rand(-20,20),
      y: py + rand(-10,10),
      vx: rand(-1.2,1.2), vy: rand(-2.4,-0.8),
      size: rand(6,20), life: rand(1600,3000), age: 0, type: (Math.random() < 0.5 ? 'flame' : 'smoke')
    });
    fireParticles.push({
      x: ex + rand(-20,20),
      y: ey + rand(-10,10),
      vx: rand(-1.2,1.2), vy: rand(-2.8,-0.9),
      size: rand(6,22), life: rand(1600,3000), age: 0, type: (Math.random() < 0.5 ? 'flame' : 'smoke')
    });
  }

  // keep adding small bursts during duration
  const fireDuration = 5000; // 5 seconds
  fireEndAt = performance.now() + fireDuration;
  // start a small interval to keep adding particles until time up
  const burstInterval = setInterval(()=>{
    if (!inFireMode) { clearInterval(burstInterval); return; }
    for (let i=0;i<12;i++) {
      fireParticles.push({
        x: px + rand(-26,26),
        y: py + rand(-12,12),
        vx: rand(-1.4,1.4), vy: rand(-2.6,-1.0),
        size: rand(6,16), life: rand(1200,2400), age: 0, type: (Math.random()<0.6 ? 'smoke' : 'flame')
      });
      fireParticles.push({
        x: ex + rand(-26,26),
        y: ey + rand(-12,12),
        vx: rand(-1.4,1.4), vy: rand(-2.6,-1.0),
        size: rand(6,16), life: rand(1200,2400), age: 0, type: (Math.random()<0.6 ? 'smoke' : 'flame')
      });
    }
  }, 300);

  // ensure loop still animates fire until end
  requestAnimationFrame(function fireLoop(ts){
    update(16); // small dt to keep particles updating
    draw();
    if (inFireMode) requestAnimationFrame(fireLoop);
  });
}

// ---------- Loop ----------
let last = 0;
function mainLoop(ts){
  if (!last) last = ts;
  const dt = Math.min(48, ts - last); last = ts; // clamp dt
  update(dt);
  draw();
  requestAnimationFrame(mainLoop);
}
requestAnimationFrame(mainLoop);

// ---------- Start / Countdown / End ----------
startBtn.addEventListener('click', () => {
  // ensure audio allowed
  sound.ensure();
  if (sound.ctx && sound.ctx.state === 'suspended') sound.ctx.resume();
  sound.beep(880,0.12,0);
  startOverlay.style.display = 'none';
  startCountdown();
});

function startCountdown(){
  enemies.length = 0; smokeParticles.length = 0; fireParticles.length = 0;
  score = 0; lives = 3; timeLeft = totalTime; baseSpeed = 2;
  hudScore.textContent = 'Score: 0'; hudLives.textContent = 'Lives: 3'; hudTimer.textContent = 'Time: ' + Math.ceil(totalTime);
  countOverlay.style.display = 'flex';
  let n = 3; countText.textContent = n;
  const t = setInterval(()=>{
    n--;
    if (n > 0) {
      countText.textContent = n;
      sound.beep(880,0.12,0);
    } else {
      countText.textContent = 'GO';
      sound.beep(1320, 0.16, 0);
      setTimeout(()=> {
        clearInterval(t);
        countOverlay.style.display = 'none';
        sound.startEngine();
        running = true; elapsed = 0; spawnTimer = 0; last = performance.now();
      }, 700);
    }
  }, 1000);
}

function endGame(win){
  running = false;
  sound.stopEngine();
  if (win) { hudScore.textContent = 'YOU WIN! Score: ' + score; sound.victory(); }
  else { hudScore.textContent = 'GAME OVER!'; }
  setTimeout(()=> {
    startOverlay.style.display = 'flex';
    hudLives.textContent = 'Lives: 3';
    hudScore.textContent = 'Score: 0';
    hudTimer.textContent = 'Time: ' + Math.ceil(totalTime);
    // reset
    score = 0; lives = 3; timeLeft = totalTime; baseSpeed = 2;
    enemies.length = 0; smokeParticles.length = 0; fireParticles.length = 0;
  }, 1200);
}

// small safety: focus canvas so keyboard works
canvas.addEventListener('click', ()=> canvas.focus());
