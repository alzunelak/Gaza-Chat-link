/* Full JavaScript: Moving cars, engine sound, smoke, fire after 3 crashes */

class SoundEngine {
  constructor() { this.ctx = null; this.engineOsc = null; this.engineGain = null; }
  ensure() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
  startEngine() {
    this.ensure();
    if (this.engineOsc) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1200;
    o.type = 'sawtooth'; o.frequency.value = 90;
    g.gain.value = 0.008;
    o.connect(g); g.connect(lp); lp.connect(this.ctx.destination);
    o.start();
    this.engineOsc = o; this.engineGain = g; this.engineFilter = lp;
  }
  setIntensity(i) {
    if (!this.engineGain || !this.engineOsc) return;
    i = Math.min(1, Math.max(0, i));
    const t = this.ctx.currentTime + 0.05;
    this.engineGain.gain.linearRampToValueAtTime(0.002 + 0.01 * i, t);
    this.engineOsc.frequency.linearRampToValueAtTime(80 + i * 280, t);
    if (this.engineFilter)
      this.engineFilter.frequency.linearRampToValueAtTime(700 + i * 2000, t);
  }
  stopEngine() {
    if (!this.engineOsc) return;
    this.engineOsc.stop(); this.engineOsc.disconnect();
    this.engineGain.disconnect(); this.engineFilter.disconnect();
    this.engineOsc = this.engineGain = this.engineFilter = null;
  }
  crash() {
    this.ensure();
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++)
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.05));
    const src = this.ctx.createBufferSource(); src.buffer = buffer;
    const g = this.ctx.createGain(); g.gain.value = 0.8;
    src.connect(g); g.connect(this.ctx.destination); src.start();
  }
}
const sound = new SoundEngine();

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const CANVAS_W = canvas.width, CANVAS_H = canvas.height;
const ROAD_X = 40, ROAD_W = CANVAS_W - 80;
const LANE_COUNT = 3, LANE_W = ROAD_W / LANE_COUNT;
const CAR_W = 50, CAR_H = 90;

const playerImg = new Image();
playerImg.src = "https://thumbs.dreamstime.com/b/yellow-car-top-view-vector-illustration-sedan-284618518.jpg";
const enemyImg = new Image();
enemyImg.src = "https://tse2.mm.bing.net/th/id/OIP.tswnRHsV3-fUij9C6N1IaQHaHa?pid=Api&P=0&h=220";

let running = false, countdown = false;
let baseSpeed = 2, score = 0, lives = 3, crashCount = 0, inFire = false, fireTimer = 0;
const keys = { left: false, right: false, up: false, down: false };
const enemies = [];
const smoke = [];
const fire = [];

const player = { lane: 1, x: 0, y: CANVAS_H - CAR_H - 20, w: CAR_W, h: CAR_H, speed: 5 };
player.x = ROAD_X + player.lane * LANE_W + (LANE_W - CAR_W) / 2;

window.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
  if (e.key === "ArrowUp") keys.up = true;
  if (e.key === "ArrowDown") keys.down = true;
});
window.addEventListener("keyup", e => {
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
  if (e.key === "ArrowUp") keys.up = false;
  if (e.key === "ArrowDown") keys.down = false;
});

function laneCenter(i) {
  return ROAD_X + i * LANE_W + (LANE_W - CAR_W) / 2;
}
function collides(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function spawnEnemy() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const x = laneCenter(lane);
  const y = -CAR_H - Math.random() * 120;
  enemies.push({ x, y, w: CAR_W, h: CAR_H, lane, speed: 3 + Math.random() * 1.5 });
}
function spawnSmoke(x, y) {
  smoke.push({ x, y, s: Math.random() * 10 + 6, a: 1 });
}
function spawnFire(x, y) {
  fire.push({ x, y, s: Math.random() * 12 + 10, a: 1 });
}

function startCountdown() {
  countdown = true;
  let n = 3;
  const counter = setInterval(() => {
    console.log(n > 0 ? n : "GO");
    if (n === 0) {
      clearInterval(counter);
      countdown = false;
      running = true;
      sound.startEngine();
    }
    n--;
  }, 1000);
}

function triggerFire() {
  inFire = true;
  fireTimer = 5000;
  sound.crash();
  sound.stopEngine();
  for (let i = 0; i < 60; i++) {
    spawnFire(player.x + CAR_W / 2, player.y + CAR_H / 2);
    if (enemies.length)
      spawnFire(enemies[0].x + CAR_W / 2, enemies[0].y + CAR_H / 2);
  }
}

function update(dt) {
  if (countdown || inFire) {
    if (inFire) {
      fireTimer -= dt;
      if (fireTimer <= 0) {
        inFire = false;
        score = 0; lives = 3; crashCount = 0;
        running = false;
        console.log("Race Restart");
      }
    }
    return;
  }

  if (!running) return;
  if (keys.left && player.lane > 0) { player.lane--; keys.left = false; }
  if (keys.right && player.lane < LANE_COUNT - 1) { player.lane++; keys.right = false; }

  player.x = laneCenter(player.lane);
  if (keys.up) baseSpeed = Math.min(8, baseSpeed + 0.01);
  if (keys.down) baseSpeed = Math.max(2, baseSpeed - 0.01);

  if (Math.random() < 0.02) spawnEnemy();

  for (let e of enemies) e.y += baseSpeed * e.speed;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (collides(player, e)) {
      enemies.splice(i, 1);
      lives--; crashCount++;
      sound.crash();
      if (crashCount >= 3) { triggerFire(); }
    } else if (e.y > CANVAS_H + 50) enemies.splice(i, 1);
  }

  for (let i = smoke.length - 1; i >= 0; i--) {
    const s = smoke[i];
    s.y -= 1; s.a -= 0.01; s.s += 0.1;
    if (s.a <= 0) smoke.splice(i, 1);
  }
  for (let i = fire.length - 1; i >= 0; i--) {
    const f = fire[i];
    f.y -= 0.5; f.a -= 0.01;
    if (f.a <= 0) fire.splice(i, 1);
  }

  if (Math.random() < 0.3) spawnSmoke(player.x + CAR_W / 2, player.y + CAR_H);

  sound.setIntensity(baseSpeed / 8);
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#2f2f2f";
  ctx.fillRect(ROAD_X, 0, ROAD_W, CANVAS_H);
  ctx.fillStyle = "#fff";
  for (let i = 1; i < LANE_COUNT; i++) {
    ctx.fillRect(ROAD_X + i * LANE_W - 2, 0, 4, CANVAS_H);
  }

  for (let s of smoke) {
    ctx.fillStyle = `rgba(120,120,120,${s.a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2); ctx.fill();
  }
  for (let e of enemies) ctx.drawImage(enemyImg, e.x, e.y, e.w, e.h);
  ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
  for (let f of fire) {
    ctx.fillStyle = `rgba(255,100,0,${f.a})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2); ctx.fill();
  }
}

let last = 0;
function loop(ts) {
  const dt = ts - last; last = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

canvas.addEventListener("click", () => {
  if (!running && !countdown && !inFire) {
    sound.ensure();
    startCountdown();
  }
});
