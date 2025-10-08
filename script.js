/* Full updated racing game:
   - Lives decrement on crash; respawns until lives run out
   - Engine sound loops during race and varies with speed
   - Crash and victory sounds
   - Countdown start and working "Start Race" button
   - Smoke particle trail while accelerating
*/

// ---------- Sound Engine (improved) ----------
class SoundEngine {
  constructor(){ this.ctx=null; this.engineGain=null; this.engineOsc=null; this.engineFilter=null; }
  ensure(){ if(!this.ctx){ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); } }
  beep(freq=880,time=0.12,when=0){
    this.ensure();
    const o=this.ctx.createOscillator();
    const g=this.ctx.createGain();
    o.type='sine'; o.frequency.value=freq; g.gain.value=0.001;
    o.connect(g); g.connect(this.ctx.destination);
    const t=this.ctx.currentTime+when;
    g.gain.linearRampToValueAtTime(0.18,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.001,t+time);
    o.start(t); o.stop(t+time+0.02);
  }
  startEngine(){
    this.ensure();
    if(this.engineOsc) return;
    // build a slightly richer engine timbre
    const o=this.ctx.createOscillator();
    const o2=this.ctx.createOscillator();
    const g=this.ctx.createGain();
    const lp=this.ctx.createBiquadFilter();
    lp.type='lowpass'; lp.frequency.value=900; lp.Q.value=0.7;

    o.type='sawtooth'; o.frequency.value=60;
    o2.type='square';  o2.frequency.value=120;
    g.gain.value=0.008;

    o.connect(g); o2.connect(g);
    g.connect(lp); lp.connect(this.ctx.destination);

    o.start(); o2.start();
    // keep both on the instance
    this.engineOsc = [o,o2];
    this.engineGain = g;
    this.engineFilter = lp;
  }
  setEngineIntensity(i){
    if(!this.engineGain) return;
    const ii = Math.max(0,Math.min(1,i));
    const targetGain = 0.004 + 0.02 * ii;
    this.engineGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime+0.05);
    if(this.engineOsc && this.engineOsc.length===2){
      this.engineOsc[0].frequency.linearRampToValueAtTime(55 + ii*180, this.ctx.currentTime+0.05);
      this.engineOsc[1].frequency.linearRampToValueAtTime(110 + ii*360, this.ctx.currentTime+0.05);
    }
    if(this.engineFilter){
      this.engineFilter.frequency.linearRampToValueAtTime(600 + ii*2200, this.ctx.currentTime+0.05);
    }
  }
  stopEngine(){
    if(!this.engineOsc) return;
    try{ this.engineOsc.forEach(o=>o.stop()); }catch(e){}
    try{ this.engineOsc.forEach(o=>o.disconnect()); }catch(e){}
    try{ this.engineGain.disconnect(); this.engineFilter.disconnect(); }catch(e){}
    this.engineOsc=null; this.engineGain=null; this.engineFilter=null;
  }
  crash(){
    this.ensure();
    const bufferSize=this.ctx.sampleRate*0.25;
    const buffer=this.ctx.createBuffer(1,bufferSize,this.ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) data[i]=(Math.random()*2-1)*Math.exp(-i/(bufferSize*0.02));
    const src=this.ctx.createBufferSource(); src.buffer=buffer;
    const g=this.ctx.createGain(); g.gain.value=0.8;
    src.connect(g); g.connect(this.ctx.destination); src.start();
  }
  victory(){
    this.ensure();
    const times=[0,0.15,0.33,0.65];
    const freqs=[880,1046.5,1318.5,1760];
    times.forEach((t,i)=>this.beep(freqs[i],0.14,t));
  }
}
const sound = new SoundEngine();

// ---------- Setup ----------
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

let score = 0, lives = 3, totalTime = 45, timeLeft = totalTime;
let running = false, paused = false, elapsed = 0;
let spawnTimer = 0, spawnInterval = 1200;
let baseSpeed = 2.0, speedMultiplier = 1;
const enemies = [];
const keys = { left:false, right:false, up:false, down:false };
let bgOffset = 0;

// images (using your chosen images)
const playerImg = new Image();
playerImg.crossOrigin = "anonymous";
playerImg.src = "https://i.pinimg.com/736x/4c/03/7f/4c037f9eebcc9e5b66863023999b11ae.jpg";

const enemyImgs = [
  "https://tse2.mm.bing.net/th/id/OIP.b016nfhhpWQiH8-_zxiq0gHaHa?pid=Api&P=0&h=220",
  "https://tse2.mm.bing.net/th/id/OIP.tswnRHsV3-fUij9C6N1IaQHaHa?pid=Api&P=0&h=220"
].map(src => { const i = new Image(); i.crossOrigin="anonymous"; i.src = src; return i; });

// smoke particle system
const particles = [];
function emitSmoke(x,y,intensity){
  // intensity 0..1 controls amount
  const count = Math.max(1, Math.floor(1 + intensity*4));
  for(let i=0;i<count;i++){
    particles.push({
      x: x + (Math.random()-0.5)*12,
      y: y + (Math.random()*6),
      vx: (Math.random()-0.5)*0.3,
      vy: -0.3 - Math.random()*0.6 - intensity*1.2,
      size: 6 + Math.random()*6,
      life: 600 + Math.random()*300,
      age: 0,
      alpha: 0.5 + Math.random()*0.3
    });
  }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.age += dt;
    p.x += p.vx * (dt/16);
    p.y += p.vy * (dt/16);
    p.size *= 1 - 0.0006*dt;
    p.alpha *= 1 - 0.0008*dt;
    if(p.age >= p.life || p.alpha < 0.02) particles.splice(i,1);
  }
}
function drawParticles(){
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(const p of particles){
    ctx.globalAlpha = p.alpha;
    const g = ctx.createRadialGradient(p.x,p.y,p.size*0.1,p.x,p.y,p.size);
    g.addColorStop(0,'rgba(200,200,200,0.35)');
    g.addColorStop(1,'rgba(80,80,80,0.02)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(p.x,p.y,p.size,p.size*0.7,0,0,Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

// Player object
const player = { x: 0, y: CANVAS_H - CAR_H - 16, w: CAR_W, h: CAR_H, speed: 6 };

// Input handlers
window.addEventListener('keydown', e=>{
  if(['ArrowLeft','a','A'].includes(e.key)) keys.left=true;
  if(['ArrowRight','d','D'].includes(e.key)) keys.right=true;
  if(['ArrowUp','w','W'].includes(e.key)) keys.up=true;
  if(['ArrowDown','s','S'].includes(e.key)) keys.down=true;
});
window.addEventListener('keyup', e=>{
  if(['ArrowLeft','a','A'].includes(e.key)) keys.left=false;
  if(['ArrowRight','d','D'].includes(e.key)) keys.right=false;
  if(['ArrowUp','w','W'].includes(e.key)) keys.up=false;
  if(['ArrowDown','s','S'].includes(e.key)) keys.down=false;
});

function bindButton(el,onPress,onRelease){
  ['pointerdown','touchstart','mousedown'].forEach(ev=>el.addEventListener(ev, e=>{ e.preventDefault(); onPress(); }));
  ['pointerup','touchend','mouseup','mouseleave','pointercancel'].forEach(ev=>el.addEventListener(ev, e=>{ e.preventDefault(); onRelease(); }));
}
bindButton(btnLeft, ()=> keys.left=true, ()=> keys.left=false);
bindButton(btnRight, ()=> keys.right=true, ()=> keys.right=false);
bindButton(btnUp, ()=> keys.up=true, ()=> keys.up=false);
bindButton(btnDown, ()=> keys.down=true, ()=> keys.down=false);

// helpers
function laneCenter(i){ return ROAD_X + i*LANE_W + (LANE_W - CAR_W)/2; }
function collides(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// spawn enemy
function spawnEnemy(){
  const lane = Math.floor(Math.random()*LANE_COUNT);
  const x = laneCenter(lane);
  const y = -CAR_H - Math.random()*120;
  const img = enemyImgs[Math.floor(Math.random()*enemyImgs.length)];
  enemies.push({ x, y, w: CAR_W, h: CAR_H, img, baseSpeed: baseSpeed });
}

// update
function update(dt){
  if(!running || paused) return;

  // up/down change baseSpeed
  if(keys.up) baseSpeed = Math.min(baseSpeed + 0.006 * dt, 9);
  if(keys.down) baseSpeed = Math.max(baseSpeed - 0.008 * dt, 0.8);

  elapsed += dt;
  speedMultiplier = 1 + Math.floor(elapsed/8000)*0.12;
  bgOffset += 220*(dt/1000)*speedMultiplier;
  if(bgOffset > 40) bgOffset -= 40;

  // set engine intensity (0..1)
  sound.setEngineIntensity(Math.min(1, (baseSpeed - 1) / 8));

  // lateral movement
  if(keys.left) player.x -= player.speed * (1 + (baseSpeed - 2)/4);
  if(keys.right) player.x += player.speed * (1 + (baseSpeed - 2)/4);

  const leftBound = ROAD_X + 6, rightBound = ROAD_X + ROAD_W - player.w - 6;
  if(player.x < leftBound) player.x = leftBound;
  if(player.x > rightBound) player.x = rightBound;

  // smoke when accelerating (emit at higher speed)
  const intensity = Math.max(0, (baseSpeed - 2) / 6);
  if(intensity > 0.12) emitSmoke(player.x + player.w/2 - 6, player.y + player.h - 6, intensity);

  // spawn
  spawnTimer += dt;
  const dynInt = Math.max(420, spawnInterval - elapsed*0.05 - baseSpeed*40);
  if(spawnTimer >= dynInt){ spawnTimer = 0; spawnEnemy(); }

  // enemies move & collisions
  for(let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    e.y += (e.baseSpeed + 1 * speedMultiplier + baseSpeed*0.35) * (dt/16);
    if(collides(player,e)){
      // crash
      enemies.splice(i,1);
      lives--; hudLives.textContent = 'Lives: ' + lives;
      sound.crash();
      // brief flash/pause
      paused = true;
      setTimeout(()=>{ paused = false; player.x = laneCenter(Math.floor(LANE_COUNT/2)); }, 700);
      if(lives <= 0){ running = false; endGame(false); return; }
    } else if(e.y > CANVAS_H + 50){
      enemies.splice(i,1);
      score++;
      hudScore.textContent = 'Score: ' + score;
    }
  }

  // particles
  updateParticles(dt);

  // timer
  timeLeft -= dt/1000;
  if(timeLeft < 0) timeLeft = 0;
  hudTimer.textContent = 'Time: ' + Math.ceil(timeLeft);
  if(timeLeft <= 0) { running = false; endGame(true); return; }
}

// draw
function draw(){
  ctx.clearRect(0,0,CANVAS_W,CANVAS_H);

  // background
  ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  // road
  ctx.fillStyle = '#2f2f2f'; roundRect(ctx, ROAD_X, 0, ROAD_W, CANVAS_H, 12, true, false);

  // lane stripes
  ctx.fillStyle = '#dedede';
  const stripeW = 8;
  for(let i=0;i<LANE_COUNT;i++){
    const sx = ROAD_X + i*LANE_W + LANE_W/2 - stripeW/2;
    for(let y = -40 + (bgOffset%40); y < CANVAS_H + 40; y += 80){
      ctx.fillRect(sx, y, stripeW, 40);
    }
  }

  // draw enemies
  for(const e of enemies){
    const img = (e.img && e.img.complete) ? e.img : placeholderEnemy(e.x,e.y,e.w,e.h);
    ctx.drawImage(img, e.x, e.y, e.w, e.h);
  }

  // draw smoke under player
  drawParticles();

  // draw player
  const pimg = (playerImg && playerImg.complete) ? playerImg : placeholderPlayer(player.x, player.y, player.w, player.h);
  ctx.drawImage(pimg, player.x, player.y, player.w, player.h);
}

// helper placeholder draws (in case images not loaded)
function placeholderPlayer(x,y,w,h){
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const g = c.getContext('2d');
  g.fillStyle = '#ffcc00'; g.fillRect(0,0,w,h);
  g.fillStyle = '#222'; g.fillRect(6,8,w-12,20);
  return c;
}
function placeholderEnemy(x,y,w,h){
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const g = c.getContext('2d');
  g.fillStyle = '#2ecc71'; g.fillRect(0,0,w,h);
  g.fillStyle = '#fff'; g.fillRect(6,8,w-12,20);
  return c;
}

// rounded rectangle
function roundRect(ctx,x,y,w,h,r,fill=true,stroke=true){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

// loop
let last = 0;
function loop(ts){
  if(!last) last = ts;
  const dt = ts - last;
  last = ts;
  update(dt);
  draw();
  if(running && !paused) requestAnimationFrame(loop);
}

// ---------- Start / End ----------
startBtn.addEventListener('click', ()=>{
  // must resume audio context on gesture
  sound.ensure();
  if(sound.ctx.state === 'suspended') sound.ctx.resume();
  sound.beep(880, 0.12, 0);
  beginStartSequence();
});

function beginStartSequence(){
  enemies.length = 0; score = 0; lives = 3; timeLeft = totalTime;
  hudScore.textContent = 'Score: 0'; hudLives.textContent = 'Lives: 3'; hudTimer.textContent = 'Time: ' + Math.ceil(totalTime);
  player.x = laneCenter(Math.floor(LANE_COUNT/2));
  startOverlay.style.display = 'none';
  countOverlay.style.display = 'flex';
  let n = 3; countText.textContent = n;
  const t = setInterval(()=>{
    n--;
    if(n > 0){ countText.textContent = n; sound.beep(880,0.12,0); }
    else if(n === 0){
      countText.textContent = 'GO'; sound.beep(1320,0.16,0);
      setTimeout(()=>{
        clearInterval(t);
        countOverlay.style.display = 'none';
        sound.startEngine();
        running = true; last = 0; elapsed = 0; spawnTimer = 0;
        requestAnimationFrame(loop);
      },700);
    }
  },1000);
}

function endGame(win){
  running = false; paused = false;
  sound.stopEngine();
  if(win){ hudScore.textContent = 'YOU WIN! Score: ' + score; sound.victory(); }
  else { hudScore.textContent = 'GAME OVER!'; sound.crash(); }
  setTimeout(()=>{
    startOverlay.style.display = 'flex';
    hudLives.textContent = 'Lives: 3'; hudScore.textContent = 'Score: 0'; hudTimer.textContent = 'Time: ' + Math.ceil(totalTime);
    score = 0; lives = 3; timeLeft = totalTime;
  }, 1200);
}

// initialize UI & draw initial frame
function resetAll(){
  running = false; paused = false;
  score = 0; lives = 3; timeLeft = totalTime; baseSpeed = 2; elapsed = 0; spawnTimer = 0;
  enemies.length = 0;
  player.x = laneCenter(Math.floor(LANE_COUNT/2));
  hudScore.textContent = 'Score: 0'; hudLives.textContent = 'Lives: 3'; hudTimer.textContent = 'Time: ' + Math.ceil(totalTime);
  draw();
}
resetAll();

// focus for keyboard
canvas.addEventListener('click', ()=> canvas.focus());
