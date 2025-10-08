const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
const countOverlay = document.getElementById("countOverlay");
const countText = document.getElementById("countText");

const hudScore = document.getElementById("score");
const hudTimer = document.getElementById("timer");
const hudLives = document.getElementById("lives");

const btnLeft = document.getElementById("btnLeft");
const btnRight = document.getElementById("btnRight");
const btnUp = document.getElementById("btnUp");
const btnDown = document.getElementById("btnDown");

const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;
const LANE_COUNT = 3;
const ROAD_W = CANVAS_W * 0.8;
const ROAD_X = (CANVAS_W - ROAD_W) / 2;
const LANE_W = ROAD_W / LANE_COUNT;
const CAR_W = 50, CAR_H = 100;

let keys = { left: false, right: false, up: false, down: false };
let player = {
  x: ROAD_X + LANE_W + (LANE_W - CAR_W) / 2,
  y: CANVAS_H - CAR_H - 20,
  w: CAR_W,
  h: CAR_H,
  img: new Image(),
  speed: 5,
};
player.img.src = "images/player.png";

let enemyImages = ["images/enemy1.png", "images/enemy2.png"].map(src => {
  const img = new Image();
  img.src = src;
  return img;
});

let enemies = [];
let score = 0;
let timeLeft = 60;
let lives = 3;
let running = false;
let baseSpeed = 2;
let spawnTimer = 0;
let spawnInterval = 1500;

// sounds
const crashSound = new Audio("sounds/crash.mp3");
const engineSound = new Audio("sounds/engine.mp3");
engineSound.loop = true;
const beepSound = new Audio("sounds/beep.mp3");
const winSound = new Audio("sounds/win.mp3");

// spawn enemy
function spawnEnemy() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const x = ROAD_X + lane * LANE_W + (LANE_W - CAR_W) / 2;
  const y = -CAR_H - Math.random() * 100;
  const img = enemyImages[Math.floor(Math.random() * enemyImages.length)];
  enemies.push({ x, y, w: CAR_W, h: CAR_H, img });
}

// collision detection
function collides(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// update game logic
function update(dt) {
  if (!running) return;

  if (keys.left) player.x -= player.speed;
  if (keys.right) player.x += player.speed;
  if (keys.up) player.y -= 4;
  if (keys.down) player.y += 4;

  if (player.x < ROAD_X) player.x = ROAD_X;
  if (player.x + player.w > ROAD_X + ROAD_W) player.x = ROAD_X + ROAD_W - player.w;
  if (player.y < 0) player.y = 0;
  if (player.y + player.h > CANVAS_H - 10) player.y = CANVAS_H - player.h - 10;

  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnEnemy();
    spawnTimer = 0;
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.y += baseSpeed * 3;

    if (collides(player, e)) {
      crashSound.play();
      enemies.splice(i, 1);
      lives--;
      hudLives.textContent = "Lives: " + lives;
      if (lives <= 0) gameOver();
    }

    if (e.y > CANVAS_H + 100) {
      enemies.splice(i, 1);
      score++;
      hudScore.textContent = "Score: " + score;
    }
  }

  timeLeft -= dt / 1000;
  if (timeLeft <= 0) winGame();
  hudTimer.textContent = "Time: " + Math.ceil(timeLeft);
}

// draw everything
function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  enemies.forEach(e => ctx.drawImage(e.img, e.x, e.y, e.w, e.h));
  ctx.drawImage(player.img, player.x, player.y, player.w, player.h);
}

// main loop
let last = 0;
function loop(ts) {
  if (!last) last = ts;
  const dt = ts - last;
  last = ts;
  update(dt);
  draw();
  if (running) requestAnimationFrame(loop);
}

// start sequence
startBtn.addEventListener("click", () => {
  startOverlay.style.display = "none";
  countOverlay.style.display = "flex";
  let n = 3;
  countText.textContent = n;
  const interval = setInterval(() => {
    n--;
    if (n > 0) countText.textContent = n;
    else {
      clearInterval(interval);
      countText.textContent = "GO!";
      beepSound.play();
      setTimeout(() => {
        countOverlay.style.display = "none";
        running = true;
        engineSound.play();
        last = 0;
        requestAnimationFrame(loop);
      }, 800);
    }
  }, 1000);
});

function gameOver() {
  running = false;
  engineSound.pause();
  crashSound.play();
  alert("Game Over! Your score: " + score);
  location.reload();
}

function winGame() {
  running = false;
  engineSound.pause();
  winSound.play();
  alert("You Win! Final Score: " + score);
  location.reload();
}

// keyboard
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

// mobile buttons
btnLeft.onmousedown = () => (keys.left = true);
btnRight.onmousedown = () => (keys.right = true);
btnUp.onmousedown = () => (keys.up = true);
btnDown.onmousedown = () => (keys.down = true);
btnLeft.onmouseup = btnRight.onmouseup = btnUp.onmouseup = btnDown.onmouseup = () => {
  keys.left = keys.right = keys.up = keys.down = false;
};
