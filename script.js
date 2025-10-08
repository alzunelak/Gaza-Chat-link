/* --- Final Enhanced Race Game JS with engine sound & synced movement --- */

// ---------- Sound Engine ----------
class SoundEngine {
  constructor(){ this.ctx=null; this.engineGain=null; this.engineOsc=null; }
  ensure(){ if(!this.ctx) this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }
  startEngine(){
    this.ensure();
    if(this.engineOsc) return;
    const o=this.ctx.createOscillator();
    const g=this.ctx.createGain();
    o.type='sawtooth'; o.frequency.value=100; g.gain.value=0.001;
    o.connect(g); g.connect(this.ctx.destination);
    o.start();
    this.engineOsc=o; this.engineGain=g;
  }
  setEngineIntensity(i){
    if(!this.engineGain)return;
    this.engineGain.gain.linearRampToValueAtTime(0.0006+0.002*i,this.ctx.currentTime+0.05);
    if(this.engineOsc) this.engineOsc.frequency.linearRampToValueAtTime(80+i*180,this.ctx.currentTime+0.05);
  }
  stopEngine(){
    if(!this.engineOsc)return;
    try{ this.engineOsc.stop(); }catch(e){}
    this.engineOsc.disconnect(); this.engineOsc=null; this.engineGain=null;
  }
  crash(){
    this.ensure();
    const bufferSize=this.ctx.sampleRate*0.25;
    const buffer=this.ctx.createBuffer(1,bufferSize,this.ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) data[i]=(Math.random()*2-1)*Math.exp(-i/(bufferSize*0.02));
    const src=this.ctx.createBufferSource();
    src.buffer=buffer; const g=this.ctx.createGain(); g.gain.value=0.8;
    src.connect(g); g.connect(this.ctx.destination); src.start();
  }
  victory(){
    this.ensure();
    const times=[0,0.15,0.33,0.65];
    const freqs=[880,1046.5,1318.5,1760];
    times.forEach((t,i)=>{
      const o=this.ctx.createOscillator();
      const g=this.ctx.createGain();
      o.type='square'; o.frequency.value=freqs[i]; g.gain.value=0.2;
      o.connect(g); g.connect(this.ctx.destination);
      const st=this.ctx.currentTime+t;
      o.start(st); o.stop(st+0.12);
    });
  }
}
const sound=new SoundEngine();

// ---------- Game Setup ----------
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const hudScore=document.getElementById('hudScore');
const hudLives=document.getElementById('hudLives');
const hudTimer=document.getElementById('hudTimer');
const startOverlay=document.getElementById('startOverlay');
const startBtn=document.getElementById('overlayStart');
const countOverlay=document.getElementById('countOverlay');
const countText=document.getElementById('countText');

const CANVAS_W=canvas.width, CANVAS_H=canvas.height;
const ROAD_X=30, ROAD_W=CANVAS_W-60;
const LANE_COUNT=3, LANE_W=ROAD_W/LANE_COUNT;
const CAR_W=52, CAR_H=96;

let score=0, lives=3, totalTime=45, timeLeft=totalTime;
let running=false, paused=false, elapsed=0, spawnTimer=0;
let baseSpeed=2.0, speedMultiplier=1;
const enemies=[]; const keys={left:false,right:false,up:false,down:false};
let bgOffset=0; let fireEffect=null;

// ---------- Images ----------
const playerImg=new Image();
playerImg.src="https://thumbs.dreamstime.com/b/yellow-car-top-view-vector-illustration-sedan-284618518.jpg";
const enemyImgs=[
  "https://tse2.mm.bing.net/th/id/OIP.b016nfhhpWQiH8-_zxiq0gHaHa?pid=Api&P=0&h=220",
  "https://tse2.mm.bing.net/th/id/OIP.tswnRHsV3-fUij9C6N1IaQHaHa?pid=Api&P=0&h=220"
].map(src=>{ const img=new Image(); img.src=src; return img; });

const fireImg=new Image();
fireImg.src="https://i.gifer.com/origin/5f/5f01e0f5404b9c1b6b8f2e530ba13262_w200.gif"; // Fire gif

// ---------- Player ----------
const player={x:ROAD_X+ROAD_W/2-CAR_W/2,y:CANVAS_H-CAR_H-16,w:CAR_W,h:CAR_H,speed:6};

// ---------- Input ----------
window.addEventListener('keydown',e=>{
  if(['ArrowLeft','a','A'].includes(e.key))keys.left=true;
  if(['ArrowRight','d','D'].includes(e.key))keys.right=true;
  if(['ArrowUp','w','W'].includes(e.key))keys.up=true;
  if(['ArrowDown','s','S'].includes(e.key))keys.down=true;
});
window.addEventListener('keyup',e=>{
  if(['ArrowLeft','a','A'].includes(e.key))keys.left=false;
  if(['ArrowRight','d','D'].includes(e.key))keys.right=false;
  if(['ArrowUp','w','W'].includes(e.key))keys.up=false;
  if(['ArrowDown','s','S'].includes(e.key))keys.down=false;
});

function laneCenter(i){return ROAD_X+i*LANE_W+(LANE_W-CAR_W)/2;}
function collides(a,b){return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;}

// ---------- Enemies ----------
function spawnEnemy(){
  const lane=Math.floor(Math.random()*LANE_COUNT);
  const x=laneCenter(lane);
  const y=-CAR_H-Math.random()*120;
  const img=enemyImgs[Math.floor(Math.random()*enemyImgs.length)];
  enemies.push({x,y,w:CAR_W,h:CAR_H,img});
}

// ---------- Update ----------
function update(dt){
  if(!running)return;
  // Car speed & controls
  if(keys.up)baseSpeed=Math.min(baseSpeed+0.004*dt,7);
  if(keys.down)baseSpeed=Math.max(baseSpeed-0.006*dt,1);
  elapsed+=dt; speedMultiplier=1+Math.floor(elapsed/8000)*0.12;
  bgOffset+=220*(dt/1000)*speedMultiplier; if(bgOffset>40)bgOffset-=40;
  sound.setEngineIntensity(Math.min(1,(baseSpeed-1)/6));

  // Player movement
  if(keys.left)player.x-=player.speed*(1+(baseSpeed-2)/4);
  if(keys.right)player.x+=player.speed*(1+(baseSpeed-2)/4);
  const leftBound=ROAD_X+6, rightBound=ROAD_X+ROAD_W-player.w-6;
  if(player.x<leftBound)player.x=leftBound;
  if(player.x>rightBound)player.x=rightBound;

  // Enemy spawn
  spawnTimer+=dt;
  const dynInt=Math.max(600,1200-elapsed*0.05-baseSpeed*40);
  if(spawnTimer>=dynInt){spawnTimer=0;spawnEnemy();}

  // Move enemies
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    e.y+=(2+speedMultiplier+baseSpeed*0.3)*(dt/16);
    if(collides(player,e)){
      enemies.splice(i,1);
      lives--; hudLives.textContent='Lives: '+lives;
      sound.crash();
      if(lives<=0){running=false; triggerFireEffect(player,e); return;}
    }else if(e.y>CANVAS_H+50){
      enemies.splice(i,1); score++; hudScore.textContent='Score: '+score;
    }
  }

  timeLeft-=dt/1000;
  hudTimer.textContent='Time: '+Math.ceil(timeLeft);
  if(timeLeft<=0){running=false;endGame(true);}
}

// ---------- Draw ----------
function draw(){
  ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
  ctx.fillStyle='#0d0d0d'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  ctx.fillStyle='#2f2f2f'; ctx.fillRect(ROAD_X,0,ROAD_W,CANVAS_H);
  ctx.fillStyle='#dedede';
  for(let i=0;i<LANE_COUNT;i++){
    const sx=ROAD_X+i*LANE_W+LANE_W/2-4;
    for(let y=-40+(bgOffset%40);y<CANVAS_H+40;y+=80) ctx.fillRect(sx,y,8,40);
  }
  enemies.forEach(e=>ctx.drawImage(e.img,e.x,e.y,e.w,e.h));
  ctx.drawImage(playerImg,player.x,player.y,player.w,player.h);
  if(fireEffect) drawFireEffect();
}

// ---------- Fire Effect ----------
function triggerFireEffect(player,enemy){
  sound.crash();
  fireEffect={time:0,px:player.x,py:player.y,ex:enemy.x,ey:enemy.y};
  sound.stopEngine();
  const fireDuration=5000;
  const startTime=performance.now();
  function fireLoop(ts){
    draw();
    fireEffect.time=ts-startTime;
    if(ts-startTime<fireDuration) requestAnimationFrame(fireLoop);
    else { fireEffect=null; endGame(false); }
  }
  requestAnimationFrame(fireLoop);
}
function drawFireEffect(){
  if(!fireEffect)return;
  ctx.drawImage(fireImg,fireEffect.px,fireEffect.py-40,player.w+10,player.h+50);
  ctx.drawImage(fireImg,fireEffect.ex,fireEffect.ey-40,player.w+10,player.h+50);
}

// ---------- Loop ----------
let last=0;
function loop(ts){
  if(!last)last=ts;
  const dt=ts-last; last=ts;
  update(dt); draw();
  if(running)requestAnimationFrame(loop);
}

// ---------- Start ----------
startBtn.addEventListener('click',()=>{
  sound.ensure();
  if(sound.ctx.state==='suspended') sound.ctx.resume();
  startOverlay.style.display='none';
  startCountdown();
});

function startCountdown(){
  enemies.length=0; score=0; lives=3; timeLeft=totalTime;
  hudScore.textContent='Score: 0'; hudLives.textContent='Lives: 3';
  countOverlay.style.display='flex';
  let n=3; countText.textContent=n;
  const t=setInterval(()=>{
    n--;
    if(n>0){countText.textContent=n; sound.beep(880,0.12,0);}
    else if(n===0){
      countText.textContent='GO'; sound.beep(1320,0.16,0);
      setTimeout(()=>{
        clearInterval(t);
        countOverlay.style.display='none';
        sound.startEngine();
        running=true; last=0; elapsed=0; spawnTimer=0;
        requestAnimationFrame(loop);
      },700);
    }
  },1000);
}

function endGame(win){
  running=false;
  sound.stopEngine();
  if(win){ hudScore.textContent='YOU WIN! Score: '+score; sound.victory(); }
  else { hudScore.textContent='GAME OVER!'; }
  setTimeout(()=>{
    startOverlay.style.display='flex';
    hudLives.textContent='Lives: 3';
    hudScore.textContent='Score: 0';
    hudTimer.textContent='Time: '+Math.ceil(totalTime);
  },1500);
}
