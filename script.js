const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('overlayStart') || document.getElementById('startBtn');
const startOverlay = document.getElementById('startOverlay') || document.getElementById('startScreen');
const countdown = document.getElementById('countdown') || document.getElementById('countOverlay');
const engineSound = document.getElementById('engineSound');
const crashSound = document.getElementById('crashSound');

const playerImg = new Image();
playerImg.src = "https://thumbs.dreamstime.com/b/yellow-car-top-view-vector-illustration-sedan-284618518.jpg";

const enemyImgs = [
  "https://tse2.mm.bing.net/th/id/OIP.b016nfhhpWQiH8-_zxiq0gHaHa?pid=Api&P=0&h=220",
  "https://tse2.mm.bing.net/th/id/OIP.tswnRHsV3-fUij9C6N1IaQHaHa?pid=Api&P=0&h=220",
  "https://tse2.mm.bing.net/th/id/OIP.b016nfhhpWQiH8-_zxiq0gHaHa?pid=Api&P=0&h=220"
].map(src => { const img = new Image(); img.src = src; return img; });

let player = { x: 180, y: 520, width: 60, height: 100, speed: 5 };
let enemies = [];
let keys = {};
let score = 0;
let lives = 3;
let gameRunning = false;
let speedIncrease = 0.01;
let fireTimer = 0;

function resetEnemies() {
  enemies = [];
  for (let i = 0; i < 3; i++) {
    enemies.push({
      x: 70 + i * 120,
      y: -150,
      width: 60,
      height: 100,
      speed: 2 + Math.random() * 2,
      img: enemyImgs[i]
    });
  }
}

function drawCar(car, img) {
  ctx.drawImage(img, car.x, car.y, car.width, car.height);
}

function checkCollision(a, b) {
  return !(a.y + a.height < b.y || a.y > b.y + b.height || a.x + a.width < b.x || a.x > b.x + b.width);
}

function drawFire(x, y) {
  ctx.fillStyle = "orange";
  ctx.beginPath();
  ctx.arc(x, y, 20 + Math.random() * 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(x, y, 10 + Math.random() * 5, 0, Math.PI * 2);
  ctx.fill();
}

function updateGame() {
  if (!gameRunning) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Move enemies
  enemies.forEach(enemy => {
    enemy.y += enemy.speed;
    if (enemy.y > canvas.height) {
      enemy.y = -150;
      enemy.speed += speedIncrease;
      score++;
    }
    if (checkCollision(player, enemy)) {
      lives--;
      crashSound.play();
      enemy.y = -150;

      if (lives <= 0) {
        fireTimer = 180; // show fire for 3 seconds (60fps * 3)
        gameRunning = false;
      }
    }
    drawCar(enemy, enemy.img);
  });

  // Move player
  if (keys.ArrowLeft && player.x > 20) player.x -= player.speed;
  if (keys.ArrowRight && player.x < canvas.width - player.width - 20) player.x += player.speed;
  if (keys.ArrowUp && player.y > 0) player.y -= player.speed;
  if (keys.ArrowDown && player.y < canvas.height - player.height - 10) player.y += player.speed;

  drawCar(player, playerImg);

  document.getElementById('hudScore').textContent = "Score: " + score;
  document.getElementById('hudLives').textContent = "Lives: " + lives;

  if (fireTimer > 0) {
    drawFire(player.x + 30, player.y + 20);
    drawFire(player.x + 20, player.y + 50);
    fireTimer--;
    if (fireTimer === 0) endGame();
  }

  requestAnimationFrame(updateGame);
}

function startCountdown() {
  let count = 3;
  countdown.style.display = 'flex';
  countdown.textContent = count;
  const interval = setInterval(() => {
    count--;
    if (count > 0) countdown.textContent = count;
    else if (count === 0) countdown.textContent = "GO!";
    else {
      clearInterval(interval);
      countdown.style.display = 'none';
      startGame();
    }
  }, 1000);
}

function startGame() {
  score = 0;
  lives = 3;
  player.x = 180;
  player.y = 520;
  resetEnemies();
  gameRunning = true;
  engineSound.currentTime = 0;
  engineSound.play();
  updateGame();
}

function endGame() {
  engineSound.pause();
  ctx.fillStyle = "white";
  ctx.font = "32px Arial";
  ctx.fillText("🔥 CRASHED! 🔥", 100, 300);
  setTimeout(() => {
    startOverlay.style.display = "flex";
  }, 5000);
}

startBtn.onclick = () => {
  startOverlay.style.display = "none";
  startCountdown();
};

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

// Onscreen arrows for mobile
document.getElementById('btnLeft').onclick = () => player.x -= player.speed;
document.getElementById('btnRight').onclick = () => player.x += player.speed;
document.getElementById('btnUp').onclick = () => player.y -= player.speed;
document.getElementById('btnDown').onclick = () => player.y += player.speed;
