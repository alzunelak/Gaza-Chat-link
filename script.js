// ===== Racing Game Script.js =====

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

// Spawn enemies
function spawnEnemy() {
  const lane = Math.floor(Math.random() * 3);
  const x = 90 + lane * 90;
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
    } else {
      clearInterval(interval);
      countOverlay.style.display = "none";
      countdownActive = false;
      gameActive = true;
      gameLoop();
    }
  }, 1000);
}

// Controls
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

document.getElementById("btnUp").onmousedown = () => keys["ArrowUp"] = true;
document.getElementById("btnDown").onmousedown = () => keys["ArrowDown"] = true;
document.getElementById("btnLeft").onmousedown = () => keys["ArrowLeft"] = true;
document.getElementById("btnRight").onmousedown = () => keys["ArrowRight"] = true;

document.getElementById("btnUp").onmouseup = () => keys["ArrowUp"] = false;
document.getElementById("btnDown").onmouseup = () => keys["ArrowDown"] = false;
document.getElementById("btnLeft").onmouseup = () => keys["ArrowLeft"] = false;
document.getElementById("btnRight").onmouseup = () => keys["ArrowRight"] = false;

// Start button
overlayStart.onclick = () => {
  startOverlay.style.display = "none";
  resetGame();
  startCountdown();
};

// Smooth fade sound
function setEngineSound(active) {
  if (active && !enginePlaying) {
    enginePlaying = true;
    driveSound.play();
    const fadeIn = setInterval(() => {
      if (driveSound.volume < 0.5) driveSound.volume += 0.05;
      else clearInterval(fadeIn);
    }, 200);
  } else if (!active && enginePlaying) {
    const fadeOut = setInterval(() => {
      if (driveSound.volume > 0.05) driveSound.volume -= 0.05;
      else {
        clearInterval(fadeOut);
        driveSound.pause();
        driveSound.currentTime = 0;
        enginePlaying = false;
      }
    }, 200);
  }
}

// Move player
function movePlayer() {
  let moved = false;
  if (keys["ArrowLeft"] && player.x > 60) {
    player.x -= player.speed;
    moved = true;
  }
  if (keys["ArrowRight"] && player.x < canvas.width - player.width - 60) {
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
  setEngineSound(moved);
}

// Smoke
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

// Fire effect
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

  for (let e of enemies) {
    e.y += e.speed;
    ctx.drawImage(e.img, e.x, e.y, e.width, e.height);
  }

  if (Math.random() < 0.02) spawnEnemy();
  enemies = enemies.filter(e => e.y < canvas.height);

  ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);

  enemies.forEach((e, i) => {
    if (checkCollision(player, e)) {
      crashSound.play();
      lives--;
      hudLives.textContent = "Lives: " + lives;
      smokeParticles.push({ x: player.x + 30, y: player.y, size: 20, alpha: 1 });
      enemies.splice(i, 1);

      if (lives <= 0) {
        driveSound.pause();
        drawExplosion(player.x + 30, player.y + 30);
        setTimeout(() => {
          startOverlay.style.display = "flex";
        }, 5000);
        gameActive = false;
      }
    }
  });

  drawSmoke();

  if (gameActive) requestAnimationFrame(gameLoop);
}
