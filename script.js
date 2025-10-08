/* Full updated game:
   - Lives decrement on crash; automatic respawn until lives run out.
   - Engine sound loops after GO and varies with speed.
   - All other mechanics preserved: countdown, HUD, on-screen arrows, spawns, SVG fallbacks.
*/

// ---------------- Sound Engine (updated, louder & responsive) ----------------
class SoundEngine {
  constructor(){ this.ctx=null; this.engineGain=null; this.engineOsc=null; this.engineFilter=null; }
  ensure(){ if(!this.ctx){ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); } }
  beep(freq=880,time=0.12,when=0){
    this.ensure();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.001;
    o.connect(g); g.connect(this.ctx.destination);
    const t = this.ctx.currentTime + when;
    g.gain.linearRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + time);
    o.start(t); o.stop(t + time + 0.02);
  }

  startEngine(){
    this.ensure();
    if (this.engineOsc) return;
    // create oscillator + gain + lowpass for a car hum
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 0.6;

    o.type = 'sawtooth';
    o.frequency.value = 70; // base pitch
    g.gain.value = 0.02; // audible but not too loud

    o.connect(g);
    g.connect(lp);
    lp.connect(this.ctx.destination);

    o.start();
    this.engineOsc = o;
    this.engineGain = g;
    this.engineFilter = lp;
  }

  setEngineIntensity(intensity){
    // intensity 0..1 controls pitch & loudness
    if (!this.engineGain) return;
    const i = Math.max(0, Math.min(1, intensity));
    const targetGain = 0.008 + 0.04 * i; // adjust if too loud
    this.engineGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.05);

    if (this.engineOsc) {
      const targetFreq = 60 + i * 160; // 60..220 Hz
      this.engineOsc.frequency.linearRampToValueAtTime(targetFreq, this.ctx.currentTime + 0.05);
    }

    if (this.engineFilter) {
      const targetFc = 800 + i * 1200; // opens filter more with speed
      this.engineFilter.frequency.linearRampToValueAtTime(targetFc, this.ctx.currentTime + 0.05);
    }
  }

  stopEngine(){
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch (e) {}
    try { this.engineOsc.disconnect(); } catch(e){}
    try { this.engineGain.disconnect(); } catch(e){}
    try { this.engineFilter.disconnect(); } catch(e){}
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  crash(){
    this.ensure();
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.02));
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain(); g.gain.value = 0.6;
    src.connect(g); g.connect(this.ctx.destination);
    src.start();
  }

  victory(){
    this.ensure();
    const times = [0, 0.15, 0.33, 0.65];
    const freqs = [880, 1046.5, 1318.5, 1760];
    times.forEach((t,i)=> this.beep(freqs[i], 0.14, t));
  }
}
const sound = new SoundEngine();

// ---------------- Game variables ----------------
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
const enemies = [];
let raceLaunched = false;
const keys = { left:false,right:false,up:false,down:false };
let bgOffset = 0;

// Player
const player = { x:0, y:CANVAS_H-CAR_H-16, w:CAR_W, h:CAR_H, speed:6, img:null, useImage:false};
const playerImg = new Image(); playerImg.src='Images/player.png'; playerImg.onload=()=>{player.img=playerImg; player.useImage=true;}; playerImg.onerror=()=>{player.useImage=false;};
const enemyImages = []; ['Images/enemy1.png','Images/enemy2.png'].forEach((s,i)=>{ const im=new Image(); im.src=s; im.onload=()=>{enemyImages[i]=im}; im.onerror=()=>{}; });

// fallback SVGs
const fbPlayer = new Image(); fbPlayer.src="data:image/svg+xml;utf8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 210'><rect rx='14' x='10' y='20' width='100' height='170' fill='#e74c3c' stroke='#a82b1b' stroke-width='4'/><rect x='26' y='36' width='68' height='36' fill='#fff' opacity='0.9'/><circle cx='32' cy='190' r='8' fill='#222'/><circle cx='88' cy='190' r='8' fill='#222'/></svg>`);
const fbE1 = new Image(); fbE1.src="data:image/svg+xml;utf8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 210'><rect rx='12' x='10' y='20' width='100' height='170' fill='#2ecc71' stroke='#168c4a' stroke-width='4'/><rect x='26' y='36' width='68' height='36' fill='#fff' opacity='0.9'/><circle cx='32' cy='190' r='8' fill='#222'/><circle cx='88' cy='190' r='8' fill='#222'/></svg>`);
const fbE2 = new Image(); fbE2.src="data:image/svg+xml;utf8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 210'><rect rx='12' x='10' y='20' width='100' height='170' fill='#3498db' stroke='#1c5f9a' stroke-width='4'/><rect x='26' y='36' width='68' height='36' fill='#fff' opacity='0.9'/><circle cx='32' cy='190' r='8' fill='#222'/><circle cx='88' cy='190' r='8' fill='#222'/></svg>`);

// input
window.addEventListener('keydown', e=>{ if(['ArrowLeft','a','A'].includes(e.key)) keys.left=true; if(['ArrowRight','d','D'].includes(e.key)) keys.right=true; if(['ArrowUp','w','W'].includes(e.key)) keys.up=true; if(['ArrowDown','s','S'].includes(e.key)) keys.down=true; });
window.addEventListener('keyup', e=>{ if(['ArrowLeft','a','A'].includes(e.key)) keys.left=false; if(['ArrowRight','d','D'].includes(e.key)) keys.right=false; if(['ArrowUp','w','W'].includes(e.key)) keys.up=false; if(['ArrowDown','s','S'].includes(e.key)) keys.down=false; });

// on-screen buttons
function bindButton(el,onPress,onRelease){ ['pointerdown','touchstart','mousedown'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();onPress();})); ['pointerup','pointercancel','touchend','mouseup','mouseleave'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();onRelease();})); }
bindButton(btnLeft,()=>keys.left=true,()=>keys.left=false);
bindButton(btnRight,()=>keys.right=true,()=>keys.right=false);
bindButton(btnUp,()=>keys.up=true,()=>keys.up=false);
bindButton(btnDown,()=>keys.down=true,()=>keys.down=false);

// helpers
function laneCenter(i){ return ROAD_X+i*LANE_W+(LANE_W-CAR_W)/2; }
function collides(a,b){ return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }
function roundRect(ctx,x,y,w,h,r,fill=true,stroke=true){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill)ctx.fill(); if(stroke)ctx.stroke();}

// spawn enemy
function spawnEnemy(){
  const lane = Math.floor(Math.random()*LANE_COUNT);
  const x = laneCenter(lane);
  const y = -CAR_H - (Math.random()*120);
  const img=(enemyImages.some(Boolean)?enemyImages[Math.floor(Math.random()*enemyImages.length)]:((Math.random()<0.5)?fbE1:fbE2));
  enemies.push({x,y,w:CAR_W,h:CAR_H,img,baseSpeed:baseSpeed});
}

// update
function update(dt){
  if(!running||paused)return;

  // up/down adjust base speed
  if(keys.up) baseSpeed=Math.min(baseSpeed+0.004*dt,7);
  if(keys.down) baseSpeed=Math.max(baseSpeed-0.006*dt,0.8);

  elapsed+=dt; speedMultiplier=1+Math.floor(elapsed/8000)*0.12;
  bgOffset+=220*(dt/1000)*speedMultiplier; if(bgOffset>40) bgOffset-=40;

  // engine intensity updates (audible)
  sound.setEngineIntensity(Math.min(1,(baseSpeed-1)/6));

  // player lateral movement
  if(keys.left) player.x-=player.speed*(1+(baseSpeed-2)/4);
  if(keys.right) player.x+=player.speed*(1+(baseSpeed-2)/4);
  const leftBound = ROAD_X+6, rightBound=ROAD_X+ROAD_W-player.w-6;
  if(player.x<leftBound) player.x=leftBound;
  if(player.x>rightBound) player.x=rightBound;

  // spawn enemies
  spawnTimer+=dt;
  const dynInt=Math.max(600,spawnInterval-elapsed*0.05-baseSpeed*40);
  if(spawnTimer>=dynInt){ spawnTimer=0; spawnEnemy(); }

  // move enemies and check collisions; now decrement lives, respawn until lives=0
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    e.y+=(e.baseSpeed+1*speedMultiplier+baseSpeed*0.3)*(dt/16);

    if(collides(player,e)){
      // crash handling: reduce life, remove enemy
      sound.crash();
      enemies.splice(i,1);
      lives--;
      hudLives.textContent = 'Lives: ' + lives;

      if(lives <= 0){
        // final crash -> game over
        running = false;
        sound.stopEngine();
        endGame(false);
        return;
      } else {
        // respawn player in middle lane and brief pause
        paused = true;
        // reposition player to middle lane and slightly back
        player.x = laneCenter(Math.floor(LANE_COUNT/2));
        player.y = CANVAS_H - CAR_H - 16;
        setTimeout(()=> { paused = false; }, 800);
      }
    } else if(e.y > CANVAS_H + 50){
      enemies.splice(i,1);
      score++;
      hudScore.textContent = 'Score: ' + score;
    }
  }

  // timer and win
  timeLeft -= dt/1000; if(timeLeft < 0) timeLeft = 0; hudTimer.textContent = 'Time: ' + Math.ceil(timeLeft);
  if(player.y <= 40){ running = false; sound.victory(); endGame(true); return; }
  if(timeLeft <= 0 && lives > 0){ running = false; sound.victory(); endGame(true); return; }
}

// draw
function draw(){
  ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
  ctx.fillStyle='#0d0d0d'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  ctx.fillStyle='#2f2f2f'; roundRect(ctx,ROAD_X,0,ROAD_W,CANVAS_H,12,true,false);
  ctx.fillStyle='#1f1f1f'; ctx.fillRect(ROAD_X-6,0,6,CANVAS_H); ctx.fillRect(ROAD_X+ROAD_W,0,6,CANVAS_H);
  ctx.fillStyle='#dedede'; const stripeW=8;
  for(let i=0;i<LANE_COUNT;i++){ const sx=ROAD_X+i*LANE_W+LANE_W/2-stripeW/2; for(let y=-40+(bgOffset%40);y<CANVAS_H+40;y+=80) ctx.fillRect(sx,y,stripeW,40); }
  ctx.fillStyle='#fff'; ctx.fillRect(ROAD_X+6,36,ROAD_W-12,6);

  for(const e of enemies){ const img=(e.img&&e.img.complete)?e.img:((Math.floor(e.x)%2===0)?fbE1:fbE2); ctx.drawImage(img,e.x,e.y,e.w,e.h); }
  if(player.useImage&&player.img&&player.img.complete) ctx.drawImage(player.img,player.x,player.y,player.w,player.h);
  else ctx.drawImage(fbPlayer,player.x,player.y,player.w,player.h);
}

// loop
let last=0;
function loop(ts){ if(!last) last=ts; const dt = ts - last; last = ts; update(dt); draw(); if(running && !paused) requestAnimationFrame(loop); }

// overlay & start
overlayStart.addEventListener('click', ()=> beginStartSequence());
function beginStartSequence(){
  // user gesture → allow audio
  sound.ensure();
  sound.beep(880,0.12,0);

  // clear enemies and ensure player starts centered
  enemies.length = 0;
  raceLaunched = false;
  player.x = laneCenter(Math.floor(LANE_COUNT/2));
  player.y = CANVAS_H - CAR_H - 16;

  startOverlay.style.display = 'none';
  countOverlay.style.display = 'flex';

  let n = 3;
  countText.textContent = n;
  sound.beep(880,0.12,0);
  const t = setInterval(()=>{
    n--;
    if(n > 0){
      countText.textContent = n;
      sound.beep(880,0.12,0);
    } else if(n === 0){
      countText.textContent = 'GO';
      sound.beep(1320,0.16,0);
      setTimeout(()=> {
        clearInterval(t);
        countOverlay.style.display = 'none';
        // start engine loop and game
        sound.startEngine();
        running = true;
        last = 0; elapsed = 0; spawnTimer = 0;
        requestAnimationFrame(loop);
      }, 700);
    }
  }, 1000);
}

// end game
function endGame(win){
  running = false; paused = false; raceLaunched = false;
  if(win) hudScore.textContent = 'YOU WIN! Score: ' + score;
  else hudScore.textContent = 'GAME OVER';
  sound.stopEngine();
  setTimeout(()=> {
    // reset values for new game
    score = 0; lives = 3; timeLeft = totalTime; baseSpeed = 2;
    enemies.length = 0;
    player.x = laneCenter(Math.floor(LANE_COUNT/2));
    player.y = CANVAS_H - CAR_H - 16;
    hudScore.textContent = 'Score: 0';
    hudLives.textContent = 'Lives: 3';
    hudTimer.textContent = 'Time: ' + Math.ceil(totalTime);
    startOverlay.style.display = 'flex';
  }, 900);
}

// initialize
function resetAll(){
  running = false; paused = false;
  score = 0; lives = 3; timeLeft = totalTime; baseSpeed = 2; elapsed = 0; spawnTimer = 0;
  enemies.length = 0; raceLaunched = false;
  player.x = laneCenter(Math.floor(LANE_COUNT/2));
  player.y = CANVAS_H - CAR_H - 16;
  hudScore.textContent = 'Score: 0';
  hudLives.textContent = 'Lives: 3';
  hudTimer.textContent = 'Time: ' + Math.ceil(totalTime);
  draw();
}
resetAll();
canvas.addEventListener('click', ()=> canvas.focus());

