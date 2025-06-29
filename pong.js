const canvas = document.getElementById("pong");
const ctx = canvas.getContext("2d");
const beep = document.getElementById("beep");
const scoreSound = document.getElementById("score");
const powerupSound = document.getElementById("powerup");
const playerScoreElem = document.getElementById("player-score");
const aiScoreElem = document.getElementById("ai-score");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const resetBtn = document.getElementById("resetBtn");
const modeBtn = document.getElementById("modeBtn");
const soundBtn = document.getElementById("soundBtn");
const themeBtn = document.getElementById("themeBtn");
const gameoverDiv = document.getElementById("gameover");
const winnerElem = document.getElementById("winner");

let powerupIndicator = document.getElementById("powerup-indicator");
if (!powerupIndicator) {
  powerupIndicator = document.createElement("div");
  powerupIndicator.id = "powerup-indicator";
  document.body.appendChild(powerupIndicator);
}

const paddleWidth = 20, paddleHeight = 120;
const ballRadius = 15, trailLen = 12;
const winScore = 12;

let playerY = canvas.height/2 - paddleHeight/2;
let aiY = canvas.height/2 - paddleHeight/2;
let player2Y = canvas.height/2 - paddleHeight/2;

let playerScore = 0, aiScore = 0;
let paddleSpeed = 11, aiBaseSpeed = 6;
let aiDifficulty = 0.128; // Lower = "smarter" AI
let ball, ballTrail = [];
let upPressed = false, downPressed = false;
let wPressed = false, sPressed = false;
let mouseY = playerY + paddleHeight/2;
let gamePaused = false;
let is2P = false;
let soundOn = true;
let lightMode = false;
let gameOver = false;
let touchStartY = null, touchPaddle = null;

// Power-up system
const powerups = [
  { type: 'big-ball', color: '#ffd700', label:'BIG BALL', duration: 6 },
  { type: 'fast-ball', color: '#00eaff', label:'TURBO BALL', duration: 7 },
  { type: 'small-paddle', color: '#f76ee6', label:'SMALL PADDLE', duration: 8 },
  { type: 'wide-paddle', color: '#00ff9c', label:'WIDE PADDLE', duration: 8 }
];
let activePowerup = null;
let powerupObj = null;
let powerupTimer = 0;
let powerupTimeout = 0;

// Ball object
function resetBall(servingLeft = Math.random() > 0.5) {
  let angle = (Math.random() * 0.4 - 0.2) * Math.PI; // -0.2pi ~ 0.2pi
  let speed = 11.5;
  let dir = servingLeft ? 1 : -1;
  return {
    x: canvas.width/2,
    y: canvas.height/2,
    vx: dir * (speed * Math.cos(angle)),
    vy: speed * Math.sin(angle),
    speed: speed,
    spin: 0,
    radius: ballRadius,
    turbo: false
  }
}
ball = resetBall();

function randomPowerup() {
  let p = powerups[Math.floor(Math.random()*powerups.length)];
  // Don't give same powerup twice in a row
  if(activePowerup && p.type === activePowerup.type) return randomPowerup();
  return p;
}

function spawnPowerup() {
  if (activePowerup || powerupObj) return;
  let px = Math.random() * (canvas.width*0.6) + canvas.width*0.2;
  let py = Math.random() * (canvas.height*0.7) + canvas.height*0.15;
  let p = randomPowerup();
  powerupObj = { ...p, x: px, y: py, r: 22, onField: true };
  powerupTimeout = setTimeout(() => { powerupObj = null; }, 9000);
}

function collectPowerup() {
  if(!powerupObj) return;
  if(Math.hypot(ball.x-powerupObj.x, ball.y-powerupObj.y) < ball.radius+powerupObj.r) {
    activatePowerup(powerupObj.type);
    if(soundOn) { powerupSound.currentTime=0; powerupSound.play(); }
    powerupObj = null;
    clearTimeout(powerupTimeout);
  }
}

function activatePowerup(type) {
  activePowerup = powerups.find(p => p.type === type);
  powerupTimer = activePowerup.duration * 60; // seconds -> frames
  powerupIndicator.textContent = activePowerup.label;
  powerupIndicator.style.display = 'block';

  // Apply effect
  switch(type) {
    case 'big-ball':
      ball.radius = ballRadius * 1.7;
      break;
    case 'fast-ball':
      ball.vx *= 1.45; ball.vy *= 1.45; ball.turbo = true;
      break;
    case 'small-paddle':
      paddleHeightMod = 0.55;
      break;
    case 'wide-paddle':
      paddleWidthMod = 1.7;
      break;
  }
}

function deactivatePowerup() {
  if(!activePowerup) return;
  // Reset effects
  ball.radius = ballRadius;
  ball.turbo = false;
  paddleWidthMod = 1;
  paddleHeightMod = 1;
  activePowerup = null;
  powerupIndicator.style.display = 'none';
}

let paddleWidthMod = 1, paddleHeightMod = 1;

function drawRect(x, y, w, h, color, glow=0, gcolor='#fff') {
  ctx.save();
  ctx.shadowColor = gcolor;
  ctx.shadowBlur = glow;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawCircle(x, y, r, color, glow=0, gcolor='#fff') {
  ctx.save();
  ctx.shadowColor = gcolor;
  ctx.shadowBlur = glow;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2, false);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTrail() {
  for(let i=ballTrail.length-1; i>=0; i--) {
    let t = ballTrail[i];
    drawCircle(t.x, t.y, ball.radius*(i+1)/(trailLen+4), `rgba(150,255,255,${(i+1)/(trailLen+7)})`);
  }
}

function drawNet() {
  for(let i = 0; i < canvas.height; i += 34) {
    drawRect(canvas.width/2-2, i, 5, 20, "#fff7", 4, "#0ff");
  }
}

function drawScore() {
  ctx.font = "bold 62px Arial";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(playerScore, canvas.width/2-90, 72);
  ctx.fillText(aiScore, canvas.width/2+90, 72);
}

function drawPowerup() {
  if(!powerupObj) return;
  drawCircle(powerupObj.x, powerupObj.y, powerupObj.r, powerupObj.color, 30, powerupObj.color);
  ctx.font = "bold 1.3em Arial";
  ctx.fillStyle = "#222";
  ctx.textAlign = "center";
  ctx.fillText(powerupObj.label, powerupObj.x, powerupObj.y+5);
}

function drawPaddle(x, y, active=false, color="#0ff", wideMod=1, heightMod=1) {
  let grad = ctx.createLinearGradient(x, y, x+paddleWidth*wideMod, y+paddleHeight*heightMod);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "#111");
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = active ? 20 : 5;
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, paddleWidth*wideMod, paddleHeight*heightMod);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawRect(0, 0, canvas.width, canvas.height, lightMode ? "#e1ecf4" : "#23303b");
  drawNet();
  drawTrail();
  drawPowerup();
  // Paddles
  drawPaddle(18, playerY, !gamePaused, "#0ff", 1*paddleWidthMod, 1*paddleHeightMod);
  if(is2P) drawPaddle(canvas.width-18-paddleWidth, player2Y, !gamePaused, "#ff0", 1*paddleWidthMod, 1*paddleHeightMod);
  else drawPaddle(canvas.width-18-paddleWidth, aiY, !gamePaused, "#ff0", 1*paddleWidthMod, 1*paddleHeightMod);
  drawCircle(ball.x, ball.y, ball.radius, "#fff", ball.turbo?24:8, "#0ff");
  drawScore();

  // Powerup timer
  if(activePowerup) {
    ctx.save();
    ctx.font = "bold 2em Arial";
    ctx.fillStyle = "#ffe761";
    ctx.textAlign = "center";
    ctx.fillText("Power-up: "+activePowerup.label+" ("+Math.ceil(powerupTimer/60)+")", canvas.width/2, 40);
    ctx.restore();
  }
}

function update() {
  if(gamePaused || gameOver) return;

  // Move player 1
  if (upPressed) playerY -= paddleSpeed;
  if (downPressed) playerY += paddleSpeed;
  // Mouse
  playerY += (mouseY - (playerY + paddleHeight*paddleHeightMod/2)) * 0.14;
  // Touch
  if (touchPaddle === 1 && touchStartY !== null) playerY = Math.max(0, Math.min(canvas.height-paddleHeight*paddleHeightMod, touchStartY));
  // Clamp
  if(playerY < 0) playerY = 0;
  if(playerY + paddleHeight*paddleHeightMod > canvas.height) playerY = canvas.height - paddleHeight*paddleHeightMod;

  // 2P
  if(is2P) {
    if (wPressed) player2Y -= paddleSpeed;
    if (sPressed) player2Y += paddleSpeed;
    if (touchPaddle === 2 && touchStartY !== null) player2Y = Math.max(0, Math.min(canvas.height-paddleHeight*paddleHeightMod, touchStartY));
    if(player2Y < 0) player2Y = 0;
    if(player2Y + paddleHeight*paddleHeightMod > canvas.height) player2Y = canvas.height - paddleHeight*paddleHeightMod;
  } else {
    // AI
    let aiCenter = aiY + paddleHeight*paddleHeightMod/2;
    let target = ball.y + (Math.random()-0.5)*44;
    aiY += (target - aiCenter) * aiDifficulty;
    if(aiY < 0) aiY = 0;
    if(aiY + paddleHeight*paddleHeightMod > canvas.height) aiY = canvas.height-paddleHeight*paddleHeightMod;
  }

  // Ball movement & spin
  ball.x += ball.vx;
  ball.y += ball.vy + ball.spin;

  // Trail
  ballTrail.push({x:ball.x, y:ball.y, r: ball.radius});
  if(ballTrail.length > trailLen) ballTrail.shift();

  // Top/bottom
  if(ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
    ball.vy = -ball.vy * 1.0;
    ball.spin = -ball.spin * 0.7;
    if(soundOn) { beep.currentTime=0; beep.play(); }
    if(ball.y-ball.radius < 0) ball.y = ball.radius;
    if(ball.y+ball.radius > canvas.height) ball.y = canvas.height-ball.radius;
  }

  // --- Paddle collision ---
  // Left (player 1)
  if(ball.x - ball.radius < 18 + paddleWidth*paddleWidthMod &&
     ball.y > playerY && ball.y < playerY + paddleHeight*paddleHeightMod) {
    if(soundOn) { beep.currentTime=0; beep.play(); }
    let rel = (ball.y - (playerY + paddleHeight*paddleHeightMod/2)) / (paddleHeight*paddleHeightMod/2);
    let move = (upPressed ? -1 : 0) + (downPressed ? 1 : 0) + (mouseY - (playerY+paddleHeight*paddleHeightMod/2))/24;
    ball.spin = Math.max(-3, Math.min(3, move + rel*2));
    let angle = rel * (Math.PI/2.5);
    let speed = Math.min(20, Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy) * 1.08 + 0.4);
    ball.vx = Math.abs(speed * Math.cos(angle));
    ball.vy = speed * Math.sin(angle);
    ball.x = 18 + paddleWidth*paddleWidthMod + ball.radius;
    // Slight paddle stretching for animation
    paddleWidthMod = 1.05;
    setTimeout(()=>paddleWidthMod=1, 110);
  }
  // Right (AI or 2P)
  let rightPaddleY = is2P ? player2Y : aiY;
  if(ball.x + ball.radius > canvas.width-18-paddleWidth*paddleWidthMod &&
     ball.y > rightPaddleY && ball.y < rightPaddleY + paddleHeight*paddleHeightMod) {
    if(soundOn) { beep.currentTime=0; beep.play(); }
    let rel = (ball.y - (rightPaddleY + paddleHeight*paddleHeightMod/2)) / (paddleHeight*paddleHeightMod/2);
    let move = is2P ? ((wPressed ? -1 : 0) + (sPressed ? 1 : 0)) : ((aiY - rightPaddleY)/8);
    ball.spin = Math.max(-3, Math.min(3, move + rel*2));
    let angle = rel * (Math.PI/2.5);
    let speed = Math.min(20, Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy) * 1.08 + 0.4);
    ball.vx = -Math.abs(speed * Math.cos(angle));
    ball.vy = speed * Math.sin(angle);
    ball.x = canvas.width-18-paddleWidth*paddleWidthMod-ball.radius;
    paddleWidthMod = 1.05;
    setTimeout(()=>paddleWidthMod=1, 110);
  }

  // --- Powerup collect ---
  collectPowerup();

  // --- Score ---
  if(ball.x - ball.radius < 0) {
    aiScore++;
    aiScoreElem.textContent = aiScore;
    if(soundOn) { scoreSound.currentTime=0; scoreSound.play(); }
    ball = resetBall(false);
    ballTrail = [];
    deactivatePowerup();
    if(aiScore === winScore) return endGame('Computer');
  }
  if(ball.x + ball.radius > canvas.width) {
    playerScore++;
    playerScoreElem.textContent = playerScore;
    if(soundOn) { scoreSound.currentTime=0; scoreSound.play(); }
    ball = resetBall(true);
    ballTrail = [];
    deactivatePowerup();
    if(playerScore === winScore) return endGame(is2P ? 'Player 2' : 'You');
  }

  // Power-up logic
  if(!activePowerup && !powerupObj && Math.random() < 0.004) spawnPowerup();
  if (activePowerup) {
    powerupTimer--;
    if (powerupTimer <= 0) {
      deactivatePowerup();
    }
  }
}

function endGame(winner) {
  gameOver = true;
  gamePaused = true;
  winnerElem.innerHTML = `${winner} wins!`;
  gameoverDiv.style.display = 'block';
  powerupIndicator.style.display = 'none';
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Controls
document.addEventListener("keydown", e => {
  if(e.repeat) return;
  if(e.key === "ArrowUp") upPressed = true;
  if(e.key === "ArrowDown") downPressed = true;
  if(e.key === "w" || e.key === "W") wPressed = true;
  if(e.key === "s" || e.key === "S") sPressed = true;
  if(e.key === " ") {
    if(gameOver) return;
    if(gamePaused) resumeGame();
    else pauseGame();
  }
});
document.addEventListener("keyup", e => {
  if(e.key === "ArrowUp") upPressed = false;
  if(e.key === "ArrowDown") downPressed = false;
  if(e.key === "w" || e.key === "W") wPressed = false;
  if(e.key === "s" || e.key === "S") sPressed = false;
});
canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  mouseY = e.clientY - rect.top;
});
// Touch controls
canvas.addEventListener('touchstart', e => {
  if(e.touches.length) {
    let x = e.touches[0].clientX - canvas.getBoundingClientRect().left;
    if(x < canvas.width/3) touchPaddle = 1;
    else if(x > canvas.width*2/3) touchPaddle = 2;
    else touchPaddle = null;
    touchStartY = e.touches[0].clientY - canvas.getBoundingClientRect().top - paddleHeight/2;
  }
});
canvas.addEventListener('touchmove', e => {
  if(e.touches.length) {
    let y = e.touches[0].clientY - canvas.getBoundingClientRect().top - paddleHeight/2;
    touchStartY = y;
  }
});
canvas.addEventListener('touchend', e => {
  touchStartY = null;
  touchPaddle = null;
});

pauseBtn.onclick = pauseGame;
resumeBtn.onclick = resumeGame;
resetBtn.onclick = () => window.location.reload();
modeBtn.onclick = () => {
  is2P = !is2P;
  modeBtn.textContent = `2 Player: ${is2P ? 'On' : 'Off'}`;
};
soundBtn.onclick = () => {
  soundOn = !soundOn;
  soundBtn.textContent = "Sound: " + (soundOn ? "On" : "Off");
};
themeBtn.onclick = () => {
  lightMode = !lightMode;
  document.body.classList.toggle('light', lightMode);
  themeBtn.textContent = "Theme: " + (lightMode ? "Dark" : "Light");
};

function pauseGame() {
  gamePaused = true;
  pauseBtn.style.display = "none";
  resumeBtn.style.display = "";
}
function resumeGame() {
  if(gameOver) return;
  gamePaused = false;
  pauseBtn.style.display = "";
  resumeBtn.style.display = "none";
}

window.addEventListener("resize", () => {});

gameLoop();