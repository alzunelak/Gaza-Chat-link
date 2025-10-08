/* Full JS: Engine sound + colored smoke + fire-on-game-over */

// ---------- Utility ----------
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// ---------- Sound Engine ----------
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
  }
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  startEngine() {
    this.ensure();
    this.stopEngine();
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineGain = ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 80;
    this.engineGain.gain.value = 0.05;
    this.engineOsc.connect(this.engineGain).connect(ctx.destination);
    this.engineOsc.start();
  }
  updateEngine(speed) {
    if (!this.engineOsc) return;
    this.engineOsc.frequency.setTargetAtTime(60 + speed * 25, this.ctx.currentTime, 0.05);
  }
  stopEngine() {
    if (this.engineOsc) {
      this.engineOsc.stop();
      this.engineOsc.disconnect();
      this.engineGain.disconnect();
      this.engineOsc = null;
    }
  }
  beep(freq = 880, time = 0.12, when = 0) {
    this.ensure();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, ctx.currentTime + when);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + time);
  }
}

const sound = new SoundEngine();

// ---------- Game Variables ----------
let canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');
let startOverlay = document.getElementById('start');
let countOverlay = document.getElementById('count');
let startBtn = document.getElementById('startBtn');
let countText = document.getElementById('countNum');

let running = false, paused = false;
let player = { x: 140, y: 400, w: 40, h: 70, color: '#ff4444' };
let enemies = [];
let smokeParticles = [];
let fireParticles = [];

let score = 0, lives = 3, timeLeft = 60, totalTime = 60;
let elapsed = 0, spawnTimer = 0;
let baseSpeed = 2, speedMultiplier = 0;
let fireEndAt = 0;

// ---------- Smoke & Fire ----------
function spawnSmoke(x, y, strength = 1, color = 'rgba(180,180,180,0.5)') {
  smokeParticles.push({
    x, y,
    vx: rand(-0.3, 0.3),
    vy: rand(-2.4, -0.8),
    size: rand(6, 20) * strength,
    life: rand(1600, 3000),
    age: 0,
    color
  });
}

function spawnFire(x, y) {
  for (let i = 0; i < 45; i++) {
    fireParticles.push({
      x, y,
      vx: rand(-2, 2),
      vy: rand(-2.4, -0.8),
      size: rand(6, 20),
      life: rand(1600, 3000),
      age: 0,
      type: (Math.random() < 0.5 ? 'flame' : 'smoke')
    });
  }
  fireEndAt = performance.now() + 5000;
}

// ---------- Input ----------
let keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ---------- Update ----------
function update(dt) {
  if (!running) return;

  elapsed += dt;
  timeLeft = Math.max(0, totalTime - elapsed / 1000);
  if (timeLeft <= 0) return endGame(true);

  const speed = baseSpeed + speedMultiplier;
  sound.updateEngine(speed);

  // Player movement
  if (keys['ArrowLeft']) player.x -= 0.24 * dt;
  if (keys['ArrowRight']) player.x += 0.24 * dt;
  if (keys['ArrowUp']) player.y -= 0.24 * dt;
  if (keys['ArrowDown']) player.y += 0.24 * dt;

  player.x = Math.max(0, Math.min(280 - player.w, player.x));
  player.y = Math.max(0, Math.min(500 - player.h, player.y));

  // Spawn player smoke
  if (Math.random() < 0.25 * (baseSpeed / 2)) {
    spawnSmoke(player.x + player.w / 2, player.y + player.h - 6, Math.min(1.8, baseSpeed / 2), player.color);
  }

  // Spawn enemies
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    enemies.push({
      x: rand(0, 280 - 40),
      y: -70,
      w: 40, h: 70,
      color: `hsl(${rand(0, 360)},70%,60%)`
    });
    spawnTimer = 800;
  }

  // Move enemies + smoke
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.y += (1.8 + speedMultiplier + baseSpeed * 0.32) * (dt / 16);

    // color-matched smoke
    if (Math.random() < 0.15) {
      spawnSmoke(e.x + e.w / 2, e.y + e.h - 4, 0.8, e.color);
    }

    if (e.y > 520) {
      enemies.splice(i, 1);
      score++;
    }
  }

  // Collisions
  for (const e of enemies) {
    if (
      player.x < e.x + e.w &&
      player.x + player.w > e.x &&
      player.y < e.y + e.h &&
      player.y + player.h > e.y
    ) {
      lives--;
      sound.beep(180, 0.4);
      spawnFire(player.x + player.w / 2, player.y + player.h / 2);
      e.y = 600;
      if (lives <= 0) endGame(false);
    }
  }

  // Smoke updates
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const s = smokeParticles[i];
    s.age += dt;
    s.x += s.vx;
    s.y += s.vy;
    if (s.age > s.life) smokeParticles.splice(i, 1);
  }

  // Fire updates
  for (let i = fireParticles.length - 1; i >= 0; i--) {
    const f = fireParticles[i];
    f.age += dt;
    f.x += f.vx;
    f.y += f.vy;
    if (f.age > f.life) fireParticles.splice(i, 1);
  }
}

// ---------- Draw ----------
function draw() {
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // road
  ctx.fillStyle = '#2f2f2f';
  ctx.fillRect(60, 0, 160, canvas.height);

  // player
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.w, player.h);

  // enemies
  for (const e of enemies) {
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x, e.y, e.w, e.h);
  }

  // smoke
  for (const s of smokeParticles) {
    const alpha = 1 - s.age / s.life;
    ctx.fillStyle = s.color.replace('0.5', alpha.toFixed(2));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * (1 - s.age / s.life), 0, Math.PI * 2);
    ctx.fill();
  }

  // fire
  for (const f of fireParticles) {
    const alpha = 1 - f.age / f.life;
    ctx.fillStyle = f.type === 'flame'
      ? `rgba(255,${Math.floor(100 + 150 * alpha)},0,${alpha})`
      : `rgba(200,200,200,${alpha})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.size * (1 - f.age / f.life), 0, Math.PI * 2);
    ctx.fill();
  }

  // HUD
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText('Score: ' + score, 10, 20);
  ctx.fillText('Lives: ' + lives, 10, 40);
  ctx.fillText('Time: ' + Math.ceil(timeLeft), 10, 60);
}

// ---------- Game Flow ----------
function endGame(won) {
  running = false;
  setTimeout(() => {
    startOverlay.style.display = 'flex';
    startOverlay.querySelector('h1').textContent = won ? 'YOU WIN!' : 'GAME OVER';
    startOverlay.querySelector('p').textContent = 'Score: ' + score;
  }, 1200);
}

function startCountdown() {
  startOverlay.style.display = 'none';
  countOverlay.style.display = 'flex';
  let n = 3;
  countText.textContent = n;
  const interval = setInterval(() => {
    n--;
    if (n > 0) countText.textContent = n;
    else if (n === 0) countText.textContent = 'GO!';
    if (n < 0) {
      clearInterval(interval);
      countOverlay.style.display = 'none';
      startGame();
    }
  }, 800);
}

function startGame() {
  running = true;
  paused = false;
  elapsed = 0;
  spawnTimer = 0;
  score = 0;
  lives = 3;
  timeLeft = totalTime;
  baseSpeed = 2;
  enemies.length = 0;
  smokeParticles.length = 0;
  fireParticles.length = 0;
  sound.startEngine();
}

// ---------- Main Loop ----------
let lastT = 0;
function loop(t) {
  const dt = Math.min(40, t - lastT);
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
startBtn.addEventListener('click', startCountdown);
