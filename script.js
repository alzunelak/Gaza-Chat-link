
/* Full game:
 - start grid: all cars (player + opponents) line up across a line at same Y
 - countdown with beep sounds
 - on GO: all cars start moving (line launches) and reinforcements spawn
 - crash = immediate game over
 - finish line at top: player wins if crosses without crash
 - on-screen arrows inside road bottom; keyboard supported
 - sounds via WebAudio: countdown beep, engine loop, crash noise, win melody
*/

// ---------- Simple WebAudio helper ----------
class SoundEngine {
  constructor(){
    this.ctx = null;
    this.engineGain = null;
    this.engineOsc = null;
  }
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  beep(freq=880, time=0.12, when=0) {
    this.ensure();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.value = 0.001;
    o.connect(g); g.connect(this.ctx.destination);
    const t = this.ctx.currentTime + when;
    g.gain.linearRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + time);
    o.start(t); o.stop(t + time + 0.02);
  }
  // loop engine sound (simple low oscillator)
  startEngine() {
    this.ensure();
    if (this.engineOsc) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 80;
    g.gain.value = 0.0008;
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start();
    this.engineOsc = o; this.engineGain = g;
  }
  setEngineIntensity(intensity) { // intensity 0..1
    if (!this.engineGain) return;
    this.engineGain.gain.linearRampToValueAtTime(0.0004 + 0.0016*intensity, this.ctx.currentTime + 0.05);
    if (this.engineOsc) this.engineOsc.frequency.linearRampToValueAtTime(70 + intensity*120, this.ctx.currentTime + 0.05);
  }
  stopEngine() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch(e){ }
    this.engineOsc.disconnect();
    this.engineOsc = null; this.engineGain = null;
  }
  crash() {
    this.ensure();
    // burst noise
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * Math.exp(-i/(bufferSize*0.02));
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain(); g.gain.value = 0.8;
    src.connect(g); g.connect(this.ctx.destination);
    src.start();
  }
  victory() {
    this.ensure();
    // simple sequence of beeps
    const times = [0,0.15,0.33,0.65];
    const freqs = [880, 1046.5, 1318.5, 1760];
    times.forEach((t,i)=> this.beep(freqs[i], 0.14, t));
  }
}

const sound = new SoundEngine();

// ---------- Game variables ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hudScore = document.getElementById('hudScore');
const hudLives = document.getElementById('hudLives');
const hudTimer = document.getElementById('hudTimer');
const startOverlay = document.getElementById('startOverlay');
const overlayStart = document.getElementById('overlayStart');
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

let score = 0, lives = 3, totalTime = 45, timeLeft = totalTime;
let running = false, paused = false, lastTime = 0;
let spawnTimer = 0, spawnInterval = 1200;
let baseSpeed = 2.0, elapsed = 0;
let speedMultiplier = 1;
const enemies = [];     // active moving enemies
const lineup = [];      // cars at start line (waiting)
let raceLaunched = false;

const keys = { left:false,right:false,up:false,down:false };
let bgOffset = 0;

// Player object
const player = {
  x: ROAD_X + (ROAD_W - CAR_W)/2,
  y: CANVAS_H - CAR_H - 16,
  w: CAR_W, h: CAR_H, speed: 6,
  img: null, useImage: false
};

// load optional real images
const playerImg = new Image(); playerImg.src = 'Images/player.png';
playerImg.onload = ()=>{ player.img = playerImg; player.useImage = true; };
playerImg.onerror = ()=> { player.useImage = false; };

const enemyImages = [];
['Images/enemy1.png','Images/enemy2.png'].forEach((s,i)=>{
  const im = new Image(); im.src = s; im.onload = ()=>{ enemyImages[i]=im; };
  im.onerror = ()=>{};
});

// fallback SVGs
const fbPlayer = new Image(); fbPlayer.src = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 210'><rect rx='14' x='10' y='20' width='100' height='170' fill='#e74c3c' stroke='#a82b1b' stroke-width='4'/><rect x='26' y='36' width='68' height='36' fill='#fff' opacity='0.9'/><circle cx='32' cy='190' r='8' fill='#222'/><circle cx='88' cy='190' r='8' fill='#222'/></svg>`);
const fbE1 = new Image(); fbE1.src = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 210'><rect rx='12' x='10' y='20' width='100' height='170' fill='#2ecc71' stroke='#168c4a' stroke-width='4'/><rect x='26' y='36' width='68' height='36' fill='#fff' opacity='0.9'/><circle cx='32' cy='190' r='8' fill='#222'/><circle cx='88' cy='190' r='8' fill='#222'/></svg>`);
const fbE2 = new Image(); fbE2.src = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 210'><rect rx='12' x='10' y='20' width='100' height='170' fill='#3498db' stroke='#1c5f9a' stroke-width='4'/><rect x='26' y='36' width='68' height='36' fill='#fff' opacity='0.9'/><circle cx='32' cy='190' r='8' fill='#222'/><circle cx='88' cy='190' r='8' fill='#222'/></svg>`);

// input handling
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

// bind on-screen buttons
function bindButton(el,onPress,onRelease){
  ['pointerdown','touchstart','mousedown'].forEach(ev => el.addEventListener(ev, e=>{ e.preventDefault(); onPress(); }));
  ['pointerup','pointercancel','touchend','mouseup','mouseleave'].forEach(ev => el.addEventListener(ev, e=>{ e.preventDefault(); onRelease(); }));
}
bindButton(btnLeft, ()=> keys.left = true, ()=> keys.left = false);
bindButton(btnRight, ()=> keys.right = true, ()=> keys.right = false);
bindButton(btnUp, ()=> keys.up = true, ()=> keys.up = false);
bindButton(btnDown, ()=> keys.down = true, ()=> keys.down = false);

// helpers
function laneCenter(i){ return ROAD_X + i*LANE_W + (LANE_W - CAR_W)/2; }
function collides(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function roundRect(ctx,x,y,w,h,r,fill=true,stroke=true){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if (fill) ctx.fill(); if (stroke) ctx.stroke(); }

// start grid: all cars (player included) appear aligned on same Y (single line) across lanes
function setupStartGrid(carsPerLane=1){
  lineup.length = 0;
  const startY = 80; // fixed y for start line visuals
  // place player in middle lane center of grid on bottom row of that lineup
  for (let lane=0; lane<LANE_COUNT; lane++){
    for (let i=0;i<carsPerLane;i++){
      const x = laneCenter(lane);
      const y = startY - i * (CAR_H + 8); // stacked upward if multiple per lane
      // pick different enemy images if available
      const img = (enemyImages.some(Boolean)) ? (enemyImages[(lane + i) % enemyImages.length] || fbE1) : ( (lane+i)%2 ? fbE2 : fbE1 );
      lineup.push({ x, y, w:CAR_W, h:CAR_H, img, lane, id:`L-${lane}-${i}` });
    }
  }
  // place the player's car in lane 1 (center) at same startY
  player.x = laneCenter(Math.floor(LANE_COUNT/2));
  player.y = startY + 30; // slightly behind the lineup so visually lined up but not overlapping
}

// launch lineup to active enemies
function launchLineup(){
  for (const c of lineup){
    enemies.push(Object.assign({}, c, { baseSpeed: baseSpeed + 0.6 }));
  }
  lineup.length = 0;
  raceLaunched = true;
}

// spawn reinforcement after launch
function spawnEnemy(){
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const x = laneCenter(lane);
  const y = -CAR_H - (Math.random()*120);
  const img = (enemyImages.some(Boolean)) ? (enemyImages[Math.floor(Math.random()*enemyImages.length)] || fbE1) : (Math.random()<0.5?fbE1:fbE2);
  enemies.push({ x, y, w:CAR_W, h:CAR_H, img, baseSpeed: baseSpeed });
}

// update
function update(dt){
  if (!running || paused) return;

  // up/down keys increase/decrease base speed gradually
  if (keys.up) baseSpeed = Math.min(baseSpeed + 0.004 * dt, 7);
  if (keys.down) baseSpeed = Math.max(baseSpeed - 0.006 * dt, 0.8);

  elapsed += dt;
  speedMultiplier = 1 + Math.floor(elapsed / 8000) * 0.12;
  bgOffset += 220 * (dt/1000) * speedMultiplier;
  if (bgOffset > 40) bgOffset -= 40;

  // update engine sound intensity (0..1)
  const engineIntensity = Math.min(1, (baseSpeed-1)/6);
  sound.setEngineIntensity(engineIntensity);

  // lateral move (scale by speed)
  if (keys.left) player.x -= player.speed * (1 + (baseSpeed-2)/4);
  if (keys.right) player.x += player.speed * (1 + (baseSpeed-2)/4);
  const leftBound = ROAD_X + 6, rightBound = ROAD_X + ROAD_W - player.w - 6;
  if (player.x < leftBound) player.x = leftBound;
  if (player.x > rightBound) player.x = rightBound;

  // spawn reinforcement only after launch
  if (raceLaunched) {
    spawnTimer += dt;
    const dynamicInterval = Math.max(600, spawnInterval - elapsed*0.05 - baseSpeed*40);
    if (spawnTimer >= dynamicInterval) { spawnTimer = 0; spawnEnemy(); }
  }

  // move existing enemies; collision => GAME OVER
  for (let i=enemies.length-1;i>=0;i--){
    const e = enemies[i];
    e.y += (e.baseSpeed + 1 * speedMultiplier + baseSpeed*0.3) * (dt/16);
    if (collides(player, e)){
      // immediate game over with crash sound
      running = false;
      sound.crash();
      endGame(false);
      return;
    } else if (e.y > CANVAS_H + 50) {
      enemies.splice(i,1);
      score++; hudScore.textContent = 'Score: ' + score;
    }
  }

  // timer
  timeLeft -= dt/1000;
  if (timeLeft < 0) timeLeft = 0;
  hudTimer.textContent = 'Time: ' + Math.ceil(timeLeft);

  // finish line (player crosses top region before others => win)
  const finishY = 40;
  if (player.y <= finishY && raceLaunched){
    running = false;
    sound.victory();
    endGame(true);
    return;
  }

  // win by surviving timer
  if (timeLeft <= 0 && lives > 0){ running = false; sound.victory(); endGame(true); return; }
}

// draw
function draw(){
  ctx.clearRect(0,0,CANVAS_W,CANVAS_H);

  // sky / margins
  ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

  // road
  ctx.fillStyle = '#2f2f2f'; roundRect(ctx, ROAD_X, 0, ROAD_W, CANVAS_H, 12, true, false);
  ctx.fillStyle = '#1f1f1f'; ctx.fillRect(ROAD_X-6,0,6,CANVAS_H); ctx.fillRect(ROAD_X+ROAD_W,0,6,CANVAS_H);

  // moving stripes
  ctx.fillStyle = '#dedede';
  const stripeW = 8;
  for (let i=0;i<LANE_COUNT;i++){
    const sx = ROAD_X + i*LANE_W + LANE_W/2 - stripeW/2;
    for (let y = -40 + (bgOffset % 40); y < CANVAS_H + 40; y += 80){
      ctx.fillRect(sx, y, stripeW, 40);
    }
  }

  // finish line (top)
  ctx.fillStyle = '#fff'; ctx.fillRect(ROAD_X+6, 36, ROAD_W-12, 6);

  // scoreboard panel on road top
  const panelW = ROAD_W * 0.88, panelH=46;
  const panelX = ROAD_X + (ROAD_W - panelW)/2, panelY = 10;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(ctx,panelX,panelY,panelW,panelH,10,true,false);
  ctx.fillStyle = '#fff'; ctx.font = '16px system-ui'; ctx.textAlign='left';
  ctx.fillText('Score: ' + score, panelX + 12, panelY + 28);
  ctx.textAlign='center'; ctx.fillText('Lives: ' + lives, panelX + panelW/2, panelPuszY = panelY + 28);
  ctx.textAlign='right'; ctx.fillText('Time: ' + Math.ceil(timeLeft), panelX + panelW - 12, panelY + 28);

  // draw lineup waiting cars (if any)
  if (lineup.length) {
    for (const c of lineup){
      const img = c.img && c.img.complete ? c.img : fbE1;
      ctx.drawImage(img, c.x, c.y, c.w, c.h);
    }
  }

  // draw active enemies
  for (const e of enemies){
    const img = (e.img && e.img.complete) ? e.img : ((Math.floor(e.x) % 2 === 0) ? fbE1 : fbE2);
    ctx.drawImage(img, e.x, e.y, e.w, e.h);
  }

  // draw player on top (ensure z-order)
  if (player.useImage && player.img && player.img.complete) ctx.drawImage(player.img, player.x, player.y, player.w, player.h);
  else ctx.drawImage(fbPlayer, player.x, player.y, player.w, player.h);
}

// game loop
let last = 0;
function loop(ts){
  if (!last) last = ts;
  const dt = ts - last; last = ts;
  update(dt); draw();
  if (running && !paused) requestAnimationFrame(loop);
}

// HUD helpers
function refreshHUD(){ hudScore.textContent = 'Score: ' + score; hudLives.textContent = 'Lives: ' + lives; hudTimer.textContent = 'Time: ' + Math.ceil(timeLeft); }

// Start / countdown flow (plays beeps)
overlayStart.addEventListener('click', ()=> beginStartSequence());
startOverlay.querySelector('button').addEventListener('click', ()=> beginStartSequence());

function beginStartSequence(){
  // user gesture: enable audio context engine
  sound.ensure();
  sound.beep(880,0.12,0);
  setupStartGrid(1); // 1 per lane (= one line across lanes)
  enemies.length = 0;
  lineup.forEach(c => { /* stays */ });
  // show countdown overlay
  startOverlay.style.display = 'none';
  countOverlay.style.display = 'flex';
  let n = 3;
  countText.textContent = n;
  sound.beep(880,0.12,0);
  const t = setInterval(()=>{
    n--;
    if (n > 0){
      countText.textContent = n;
      sound.beep(880,0.12,0);
    } else if (n === 0){
      countText.textContent = 'GO';
      sound.beep(1320,0.16,0);
      setTimeout(()=> {
        clearInterval(t);
        countOverlay.style.display = 'none';
        // start engine sound loop + launch
        sound.startEngine();
        launchLineup();
        running = true; raceLaunched = true; last = 0; elapsed=0; spawnTimer=0;
        requestAnimationFrame(loop);
      }, 700);
    }
  }, 1000);
}

// End game
function endGame(win){
  running = false; paused = false; raceLaunched = false;
  if (win) { hudScore.textContent = 'YOU WIN! Score: ' + score; } else { hudScore.textContent = 'GAME OVER'; }
  sound.stopEngine();
  // show start overlay to allow restart
  setTimeout(()=> {
    // reset some vars for restart
    lineup.length = 0; enemies.length = 0; score = 0; lives = 3; timeLeft = totalTime; refreshHUD();
    startOverlay.style.display = 'flex';
  }, 900);
}

// reset initial
function resetAll(){
  running = false; paused = false; lineup.length = 0; enemies.length = 0;
  score = 0; lives = 3; timeLeft = totalTime; elapsed = 0; spawnTimer = 0; baseSpeed = 2.0; raceLaunched = false;
  player.x = laneCenter(Math.floor(LANE_COUNT/2)); player.y = CANVAS_H - CAR_H - 16;
  refreshHUD(); draw();
  startOverlay.style.display = 'flex';
}

// initialize
resetAll();
draw();
canvas.addEventListener('click', ()=> canvas.focus());


