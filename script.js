// Ensure the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlayStart = document.getElementById("overlayStart");
const startOverlay = document.getElementById("startOverlay");
const countOverlay = document.getElementById("countOverlay");
const countText = document.getElementById("countText");

const btnLeft = document.getElementById("btnLeft");
const btnRight = document.getElementById("btnRight");
const btnUp = document.getElementById("btnUp");
const btnDown = document.getElementById("btnDown");

const hudScore = document.getElementById("hudScore");
const hudLives = document.getElementById("hudLives");
const hudTimer = document.getElementById("hudTimer");

let playerImg = new Image();
playerImg.src = "Images/player.png";

let enemyImgs = [new Image(), new Image()];
enemyImgs[0].src = "Images/enemy1.png";
enemyImgs[1].src = "Images/enemy2.png";

let audioCtx;
let gameRunning = false;
let score = 0;
let lives = 3;
let timer = 45;
let countdown = 3;
let cars = [];
let player = { x: 190, y: 500, w: 40, h: 70, speed: 5 };

function beep(freq, duration = 200) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = freq;
  osc.start();
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration / 1000);
}

// Start button
overlayStart.addEventListener("click", beginStartSequence);

function beginStartSequence() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  startOverlay.style.display = "none";
  countOverlay.style.display = "flex";
  countdown = 3;
  nextCount();
}

function nextCount() {
  countText.textContent = countdown;
  beep(500);
  if (countdown > 0) {
    countdown--;
    setTimeout(nextCount, 1000);
  } else {
    beep(800);
    countOverlay.style.display = "none";
    startGame();
  }
}

function startGame() {
  score = 0;
  lives = 3;
  timer = 45;
  gameRunning = true;
  cars = [];

  for (let i = 0; i < 3; i++) {
    cars.push({
      x: 70 + i * 100,
      y: -150 * (i + 1),
      w: 40,
      h: 70,
      speed: 3 + Math.random() * 2,
      img: enemyImgs[Math.floor(Math.random() * enemyImgs.length)],
    });
  }

  updateHUD();
  gameLoop();
  setInterval(() => {
    if (gameRunning) {
      timer--;
      updateHUD();
      if (timer <= 0) endGame();
    }
  }, 1000);
}

function updateHUD() {
  hudScore.textContent = "Score: " + score;
  hudLives.textContent = "Lives: " + lives;
  hudTimer.textContent = "Time: " + timer;
}

function drawRoad() {
  ctx.fillStyle = "#2f2f2f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPlayer() {
  ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
}

function drawEnemies() {
  cars.forEach((car) => {
    ctx.drawImage(car.img, car.x, car.y, car.w, car.h);
  });
}

function moveEnemies() {
  cars.forEach((car) => {
    car.y += car.speed;
    if (car.y > canvas.height) {
      car.y = -120;
      car.x = 70 + Math.floor(Math.random() * 3) * 100;
      car.speed = 3 + Math.random() * 2;
      score++;
      beep(300);
      updateHUD();
    }
  });
}

function checkCollision() {
  cars.forEach((car) => {
    if (
      player.x < car.x + car.w &&
      player.x + player.w > car.x &&
      player.y < car.y + car.h &&
      player.h + player.y > car.y
    ) {
      lives--;
      beep(100);
      updateHUD();
      car.y = -120;
      if (lives <= 0) endGame();
    }
  });
}

function endGame() {
  gameRunning = false;
  alert("Game Over! Your Score: " + score);
  window.location.reload();
}

function gameLoop() {
  if (!gameRunning) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRoad();
  drawPlayer();
  moveEnemies();
  drawEnemies();
  checkCollision();
  requestAnimationFrame(gameLoop);
}

// Controls
document.addEventListener("keydown", (e) => moveCar(e.key));
btnLeft.addEventListener("click", () => moveCar("ArrowLeft"));
btnRight.addEventListener("click", () => moveCar("ArrowRight"));
btnUp.addEventListener("click", () => moveCar("ArrowUp"));
btnDown.addEventListener("click", () => moveCar("ArrowDown"));

function moveCar(key) {
  if (!gameRunning) return;
  switch (key) {
    case "ArrowLeft":
      if (player.x > 60) player.x -= player.speed * 10;
      break;
    case "ArrowRight":
      if (player.x < 320) player.x += player.speed * 10;
      break;
    case "ArrowUp":
      if (player.y > 20) player.y -= player.speed * 10;
      break;
    case "ArrowDown":
      if (player.y < 540) player.y += player.speed * 10;
      break;
  }
}

});
