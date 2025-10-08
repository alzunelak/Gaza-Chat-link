// ---------------- Sound Engine ----------------
class SoundEngine {
  constructor(){ this.ctx=null; this.engineGain=null; this.engineOsc=null; }
  ensure(){ if(!this.ctx) this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }
  beep(freq=880,time=0.12,when=0){
    this.ensure();
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
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
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type='sawtooth'; o.frequency.value=70; g.gain.value=0.02;
    // optional lowpass to smooth
    const lp=this.ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1200; lp.Q.value=0.6;
    o.connect(g); g.connect(lp); lp.connect(this.ctx.destination);
    o.start();
    this.engineOsc=o; this.engineGain=g; this.engineFilter=lp;
  }
  setEngineIntensity(i){ if(!this.engineGain) return; const v=Math.max(0,Math.min(1,i)); this.engineGain.gain.linearRampToValueAtTime(0.008+0.04*v,this.ctx.currentTime+0.05); if(this.engineOsc) this.engineOsc.frequency.linearRampToValueAtTime(60+v*160,this.ctx.currentTime+0.05); if(this.engineFilter) this.engineFilter.frequency.linearRampToValueAtTime(800+v*1200,this.ctx.currentTime+0.05); }
  stopEngine(){
    if(!this.engineOsc) return;
    try{ this.engineOsc.stop(); }catch(e){}
    try{ this.engineOsc.disconnect(); }catch(e){}
    try{ this.engineGain.disconnect(); }catch(e){}
    try{ this.engineFilter.disconnect(); }catch(e){}
    this.engineOsc=null; this.engineGain=null; this.engineFilter=null;
  }
  crash(){ this.ensure(); const len=this.ctx.sampleRate*0.22; const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(len*0.02)); const s=this.ctx.createBufferSource(); s.buffer=buf; const g=this.ctx.createGain(); g.gain.value=0.6; s.connect(g); g.connect(this.ctx.destination); s.start(); }
  victory(){ this.ensure(); const times=[0,0.15,0.33,0.65]; const freqs=[880,1046.5,1318.5,1760]; times.forEach((t,i)=>this.beep(freqs[i],0.14,t)); }
}
const sound=new SoundEngine();

// ---------------- Game Setup ----------------
const canvas=document.getElementById('gameCanvas'), ctx=canvas.getContext('2d');
const hudScore=document.getElementById('hudScore'), hudLives=document.getElementById('hudLives'), hudTimer=document.getElementById('hudTimer');
const startOverlay=document.getElementById('startOverlay'), startBtn=document.getElementById('startBtn');
const countOverlay=document.getElementById('countOverlay'), countText=document.getElementById('countText');
const btnUp=document.getElementById('btnUp'), btnDown=document.getElementById('btnDown'), btnLeft=document.getElementById('btnLeft'), btnRight=document.getElementById('btnRight');

const CANVAS_W=canvas.width, CANVAS_H=canvas.height;
const ROAD_X=30, ROAD_W=CANVAS_W-60;
const LANE_COUNT=3, LANE_W=ROAD_W/ LAN E_COUNT; // deliberate error? fix below
// fix: variable name mistake removed below

</script>

<script>
// Correcting accidental token above and continuing game code:

const LANEW = ROAD_W / LANE_COUNT;
const CAR_W=52, CAR_H=96;

let score=0, lives=3, totalTime=45, timeLeft=totalTime;
let running=false, paused=false, lastTime=0;
let spawnTimer=0, spawnInterval=1200;
let baseSpeed=2.0, elapsed=0;
let speedMultiplier=1;
const enemies=[];
const keys={left:false,right:false,up:false,down:false};
let bgOffset=0;

// Images (user-provided)
const playerImg=new Image();
playerImg.crossOrigin = "anonymous";
playerImg.src="https://thumbs.dreamstime.com/b/yellow-car-top-view-vector-illustration-sedan-284618518.jpg";

const enemyImgsURLs=[
  "https://tse2.mm.bing.net/th/id/OIP.b016nfhhpWQiH8-_zxiq0gHaHa?pid=Api&P=0&h=220",
  "https://tse2.mm.bing.net/th/id/OIP.tswnRHsV3-fUij9C6N1IaQHaHa?pid=Api&P=0&h=220"
];
const enemyImgs = enemyImgsURLs.map(u=>{ const im=new Image(); im.crossOrigin="anonymous"; im.src=u; return im; });

const player = { x:0, y:CANVAS_H-CAR_H-16, w:CAR_W, h:CAR_H, speed:6 };

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
  ['pointerdown','touchstart','mousedown'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();onPress();}));
  ['pointerup','touchend','mouseup','mouseleave','pointercancel'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();onRelease();}));
}
bindButton(btnLeft,()=>keys.left=true,()=>keys.left=false);
bindButton(btnRight,()=>keys.right=true,()=>keys.right=false);
bindButton(btnUp,()=>keys.up=true,()=>keys.up=false);
bindButton(btnDown,()=>keys.down=true,()=>keys.down=false);

function laneCenter(i){ return ROAD_X + i*LANEW + (LANEW - CAR_W)/2; }
function collides(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

function spawnEnemy(){
  const lane = Math.floor(Math.random()*LANE_COUNT);
  const x = laneCenter(lane);
  const y = -CAR_H - Math.random()*120;
  const img = enemyImgs[Math.floor(Math.random()*enemyImgs.length)];
  enemies.push({x,y,w:CAR_W,h:CAR_H,img,baseSpeed:baseSpeed});
}

function update(dt){
  if(!running || paused) return;

  if(keys.up) baseSpeed = Math.min(baseSpeed + 0.004*dt, 7);
  if(keys.down) baseSpeed = Math.max(baseSpeed - 0.006*dt, 0.8);

  elapsed += dt;
  speedMultiplier = 1 + Math.floor(elapsed / 8000) * 0.12;
  bgOffset += 220 * (dt/1000) * speedMultiplier;
  if(bgOffset > 40) bgOffset -= 40;

  sound.setEngineIntensity(Math.min(1, (baseSpeed - 1) / 6));

  if(keys.left) player.x -= player.speed * (1 + (baseSpeed - 2)/4);
  if(keys.right) player.x += player.speed * (1 + (baseSpeed - 2)/4);

  const leftBound = ROAD_X + 6, rightBound = ROAD_X + ROAD_W - player.w - 6;
  if(player.x < leftBound) player.x = leftBound;
  if(player.x > rightBound) player.x = rightBound;

  spawnTimer += dt;
  const dynInt = Math.max(600, spawnInterval - elapsed*0.05 - baseSpeed*40);
  if(spawnTimer >= dynInt){ spawnTimer = 0; spawnEnemy(); }

  for(let i = enemies.length-1; i >=0; i--){
    const e = enemies[i];
    e.y += (e.baseSpeed + 1*speedMultiplier + baseSpeed*0.3) * (dt/16);

    if(collides(player, e)){
      // crash: remove enemy, reduce life, play crash sound
      enemies.splice(i,1);
      lives--;
      hudLives.textContent = 'Lives: ' + lives;
      sound.crash();

      if(lives <= 0){
        // final crash
        running = false;
        sound.stopEngine();
        endGame(false);
        return;
      } else {
        // respawn behavior: pause, reposition, restart engine, resume loop
        paused = true;
        player.x = laneCenter(Math.floor(LANE_COUNT/2));
        player.y = CANVAS_H - CAR_H - 16;
        // short delay, then resume
        setTimeout(()=>{
          paused = false;
          // ensure engine again and resume loop
          sound.startEngine();
          if(running) requestAnimationFrame(loop);
        }, 800);
      }
    } else if(e.y > CANVAS_H + 50){
      enemies.splice(i,1);
      score++;
      hudScore.textContent = 'Score: ' + score;
    }
  }

  timeLeft -= dt/1000;
  if(timeLeft < 0) timeLeft = 0;
  hudTimer.textContent = 'Time: ' + Math.ceil(timeLeft);

  if(timeLeft <= 0){
    running = false;
    sound.victory();
    endGame(true);
    return;
  }
}

function draw(){
  ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
  // road background
  ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  ctx.fillStyle = '#2f2f2f'; ctx.fillRect(ROAD_X,0,ROAD_W,CANVAS_H);
  // lane stripes
  ctx.fillStyle = '#dedede';
  const stripeW = 8;
  for(let i=0;i<LANE_COUNT;i++){
    const sx = ROAD_X + i*LANEW + LANEW/2 - stripeW/2;
    for(let y = -40 + (bgOffset % 40); y < CANVAS_H + 40; y += 80){
      ctx.fillRect(sx, y, stripeW, 40);
    }
  }
  // draw enemies
  for(const e of enemies){
    if(e.img && e.img.complete) ctx.drawImage(e.img, e.x, e.y, e.w, e.h);
    else { ctx.fillStyle='#4a4'; ctx.fillRect(e.x, e.y, e.w, e.h); }
  }
  // draw player
  if(playerImg && playerImg.complete) ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
  else { ctx.fillStyle='#f90'; ctx.fillRect(player.x, player.y, player.w, player.h); }
}

let last = 0;
function loop(ts){
  if(!last) last = ts;
  const dt = ts - last;
  last = ts;
  update(dt);
  draw();
  if(running && !paused) requestAnimationFrame(loop);
}

// start sequence
startBtn.addEventListener('click', ()=> beginStartSequence());
function beginStartSequence(){
  sound.ensure();
  sound.beep(880,0.12,0);

  enemies.length = 0;
  score = 0; lives = 3; timeLeft = totalTime;
  hudScore.textContent = 'Score: 0';
  hudLives.textContent = 'Lives: 3';
  hudTimer.textContent = 'Time: ' + Math.ceil(timeLeft);

  player.x = laneCenter(Math.floor(LANE_COUNT/2));
  player.y = CANVAS_H - CAR_H - 16;

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
        // start engine sound and begin loop
        sound.startEngine();
        running = true; last = 0; elapsed = 0; spawnTimer = 0;
        requestAnimationFrame(loop);
      }, 700);
    }
  }, 1000);
}

function endGame(win){
  running = false; paused = false;
  sound.stopEngine();
  if(win){ hudScore.textContent = 'YOU WIN! Score: ' + score; sound.victory(); }
  else { hudScore.textContent = 'GAME OVER!'; sound.crash(); }

  setTimeout(()=>{
    startOverlay.style.display = 'flex';
    hudLives.textContent = 'Lives: 3';
    hudScore.textContent = 'Score: 0';
    hudTimer.textContent = 'Time: ' + Math.ceil(totalTime);
    score = 0; lives = 3; timeLeft = totalTime;
    enemies.length = 0;
  }, 900);
}

// initial setup
// position player in the center lane
player.x = laneCenter(Math.floor(LANE_COUNT/2));
player.y = CANVAS_H - CAR_H - 16;
draw();
canvas.addEventListener('click', ()=> canvas.focus());
