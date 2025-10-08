// ===== Racing Game Script.js (Final Enhanced) =====

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// HUD elements
const hudScore = document.getElementById("hudScore");
const hudLives = document.getElementById("hudLives");
const hudTimer = document.getElementById("hudTimer");

// Overlays
const startOverlay = document.getElementById("startOverlay");
const countOverlay = document.getElementById("countOverlay");
const countText = document.getElementById("countText");
const overlayStart = document.getElementById("overlayStart");

// Sounds
const driveSound = new Audio("https://cdn.pixabay.com/download/audio/2021/09/13/audio_d7e3c4f2a9.mp3?filename=car-engine-loop-6196.mp3");
driveSound.loop = true;
driveSound.volume = 0;

const crashSound = new Audio("https://cdn.pixabay.com/download/audio/2022/03/15/audio_1ee26b4d8b.mp3?filename=crash-wood-and-glass-11159.mp3");

// Images
const playerImg = new Image();
playerImg.src = "https://thumbs.dreamstime.com/b/yellow-car-top-view-vector-illustration-sedan-284618518.jpg";

const enemy1 = new Image();
enemy1.src = "https://tse2.mm.bing.net/th/id/OIP.b016nfhhpWQiH8-_zxiq0gHaHa?pid=Api&P=0&h=220";

const enemy2 = new Image();
enemy2.src = "https://tse2.mm.bing.net/th/id/OIP.tswnRHsV3-fUij9C6N1IaQHaHa?pid=Api&P=0&h=220";

// Game state
let player = { x: 180, y: 520, width: 60, height: 100, speed: 5 };
let enemies = [];
let score = 0;
let lives = 3;
let timer = 45;
let gameActive = false;
let countdownActive = false;
let keys = {};
let smokeParticles = [];
let enginePlaying = false;
let fireTimer = 0;

// Lanes setup
const lanes = [80, 180, 280];

// Spawn enemy in one lane
function spawnEnemy() {
  const laneIndex = Math.floor(Math.random() * lanes.length);
  const x = lanes[laneIndex];
  const y = -120;
  const img = Math.random() > 0.5 ? enemy1 : enemy2;
  enemies.push({ x, y, width: 60, height: 100, speed: 4, img });
}

// Reset game
function resetGame() {
  enemies = [];
  player.x = 180;
  player.y = 520;
  score = 0;
  lives = 3;
  hudScore.textContent = "Score: " + score;
  hudLives.textContent = "Lives: " + lives;
  hudTimer.textContent = "Time: " + timer;
}

// Countdown before race start
function startCountdown() {
  let count = 3;
  countdownActive = true;
  countOverlay.style.display = "flex";
  countText.textContent = count;
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countText.textContent = count;
    } else if (count === 0) {
      countText.textContent = "GO!";
    } else {
      clearInterval(interval);
      countOverlay.style.display = "none";
      countdownActive = false;
      gameActive = true;
      driveSound.play();
      fadeSoundIn();
      gameLoop();
    }
  }, 1000);
}

// Start button
overlayStart.onclick = () => {
  startOverlay.style.display = "none";
  resetGame();
  startCountdown();
};

// Controls
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

// Smooth fade in/out
function fadeSoundIn() {
  enginePlaying = true;
  let vol = 0;
  const fade = setInterval(() => {
    if (vol < 0.5) {
      vol += 0.05;
      driveSound.volume = vol;
    } else clearInterval(fade);
  }, 200);
}

function fadeSoundOut() {
  let vol = driveSound.volume;
  const fade = setInterval(() => {
    if (vol > 0.05) {
      vol -= 0.05;
      driveSound.volume = vol;
    } else {
      clearInterval(fade);
      driveSound.pause();
      driveSound.currentTime = 0;
      enginePlaying = false;
    }
  }, 200);
}

// Move player
function movePlayer() {
  let moved = false;
  if (keys["ArrowLeft"] && player.x > 50) {
    player.x -= player.speed;
    moved = true;
  }
  if (keys["ArrowRight"] && player.x < canvas.width - player.width - 50) {
    player.x += player.speed;
    moved = true;
  }
  if (keys["ArrowUp"] && player.y > 0) {
    player.y -= player.speed;
    moved = true;
  }
  if (keys["ArrowDown"] && player.y < canvas.height - player.height) {
    player.y += player.speed;
    moved = true;
  }

  if (moved) {
    smokeParticles.push({
      x: player.x + player.width / 2,
      y: player.y + player.height - 10,
      size: Math.random() * 6 + 4,
      alpha: 0.6
    });
  }
}

// Smoke behind moving cars
function drawSmoke() {
  for (let s of smokeParticles) {
    ctx.fillStyle = `rgba(160,160,160,${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
    s.y -= 1;
    s.alpha -= 0.02;
  }
  smokeParticles = smokeParticles.filter(s => s.alpha > 0);
}

// Collision detection
function checkCollision(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}

// Explosion/fire
function drawExplosion(x, y) {
  ctx.fillStyle = "orange";
  ctx.beginPath();
  ctx.arc(x, y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();
}

// Game loop
function gameLoop() {
  if (!gameActive) return;

  ctx.fillStyle = "#2f2f2f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  movePlayer();

  // Enemies move down lanes
  for (let e of enemies) {
    e.y += e.speed;
    ctx.drawImage(e.img, e.x, e.y, e.width, e.height);
  }

  if (Math.random() < 0.02) spawnEnemy();
  enemies = enemies.filter(e => e.y < canvas.height + 50);

  // Player
  ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);

  // Collision check
  enemies.forEach((e, i) => {
    if (checkCollision(player, e)) {
      crashSound.play();
      lives--;
      hudLives.textContent = "Lives: " + lives;
      enemies.splice(i, 1);

      if (lives <= 0) {
        fireTimer = 180;
        fadeSoundOut();
        gameActive = false;
        showFireEffect();
      }
    }
  });

  drawSmoke();

  if (gameActive) requestAnimationFrame(gameLoop);
}

// Fire effect after last crash
function showFireEffect() {
  let frames = 0;
  const fireInterval = setInterval(() => {
    ctx.fillStyle = "#2f2f2f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
    drawExplosion(player.x + 30, player.y + 50);
    frames++;
    if (frames > fireTimer) {
      clearInterval(fireInterval);
      startOverlay.style.display = "flex";
    }
  }, 30);
}
