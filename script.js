// --- Web Audio API Sound Synthesizer ---
class SoundManager {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playJump() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    // Frequency sweeps up
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.12);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  playHit() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    // Deep downward frequency crash
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playScoreMilestone() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Double beep chime for 100-pt milestone
    const playBeep = (freq, startTime, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.linearRampToValueAtTime(0.01, startTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    playBeep(659.25, now, 0.08); // E5
    playBeep(880.00, now + 0.1, 0.12); // A5
  }
}

// --- Game Engine ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const hiScoreEl = document.getElementById('hiScore');
const overlay = document.getElementById('gameOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlaySubtitle = document.getElementById('overlaySubtitle');
const startBtn = document.getElementById('startBtn');

const sound = new SoundManager();

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 250;
const GROUND_Y = 200;

// Game State
let isPlaying = false;
let isGameOver = false;
let score = 0;
let highScore = localStorage.getItem('dino_high_score') || 0;
let gameSpeed = 5;
let frameCount = 0;
let nextSpawnTimer = 0;

hiScoreEl.textContent = `HI ${String(highScore).padStart(5, '0')}`;

// Controls
const keys = {
  jump: false,
  duck: false
};

// Dino Player Definition
const dino = {
  x: 45,
  y: GROUND_Y - 44,
  baseWidth: 40,
  baseHeight: 44,
  width: 40,
  height: 44,
  velocityY: 0,
  gravity: 0.65,
  jumpStrength: -11.5,
  isGrounded: true,
  isDucking: false,
  legFrame: 0,
  
  jump() {
    if (this.isGrounded && !this.isDucking) {
      this.velocityY = this.jumpStrength;
      this.isGrounded = false;
      sound.playJump();
    }
  },

  update() {
    // Ducking dimensions
    if (this.isDucking && this.isGrounded) {
      this.height = 26;
      this.width = 54;
      this.y = GROUND_Y - this.height;
    } else {
      this.height = this.baseHeight;
      this.width = this.baseWidth;
    }

    // Apply gravity
    this.velocityY += this.gravity;
    this.y += this.velocityY;

    // Ground collision
    if (this.y >= GROUND_Y - this.height) {
      this.y = GROUND_Y - this.height;
      this.velocityY = 0;
      this.isGrounded = true;
    }

    // Animation leg frames
    if (frameCount % 6 === 0 && this.isGrounded) {
      this.legFrame = (this.legFrame + 1) % 2;
    }
  },

  draw() {
    ctx.fillStyle = '#535353';

    if (this.isDucking && this.isGrounded) {
      // Ducking Dino
      ctx.fillRect(this.x, this.y + 8, 42, 14); // Body
      ctx.fillRect(this.x + 36, this.y + 4, 18, 12); // Low Head
      ctx.fillRect(this.x + 48, this.y + 6, 4, 3); // Eye
      // Feet
      if (this.legFrame === 0) {
        ctx.fillRect(this.x + 10, this.y + 22, 6, 4);
      } else {
        ctx.fillRect(this.x + 28, this.y + 22, 6, 4);
      }
    } else {
      // Standing / Jumping Dino
      // Head & Snout
      ctx.fillRect(this.x + 20, this.y, 20, 16);
      ctx.fillRect(this.x + 30, this.y + 4, 10, 10);
      
      // Eye (cutout)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x + 24, this.y + 2, 4, 4);
      ctx.fillStyle = '#535353';

      // Neck & Body
      ctx.fillRect(this.x + 16, this.y + 12, 12, 14);
      ctx.fillRect(this.x + 8, this.y + 18, 22, 16);
      ctx.fillRect(this.x, this.y + 20, 8, 8); // Tail
      ctx.fillRect(this.x + 28, this.y + 22, 6, 4); // Little arms

      // Legs
      if (!this.isGrounded) {
        // Legs tucked while in air
        ctx.fillRect(this.x + 12, this.y + 34, 4, 7);
        ctx.fillRect(this.x + 22, this.y + 34, 4, 7);
      } else {
        if (this.legFrame === 0) {
          ctx.fillRect(this.x + 12, this.y + 34, 4, 10);
          ctx.fillRect(this.x + 22, this.y + 34, 4, 6);
        } else {
          ctx.fillRect(this.x + 12, this.y + 34, 4, 6);
          ctx.fillRect(this.x + 22, this.y + 34, 4, 10);
        }
      }
    }
  }
};

// Ground and Environment Details
let groundOffset = 0;
const clouds = [
  { x: 150, y: 50, speed: 0.6 },
  { x: 420, y: 35, speed: 0.4 },
  { x: 680, y: 65, speed: 0.5 }
];

function drawClouds() {
  ctx.fillStyle = '#c8c8c8';
  clouds.forEach(cloud => {
    if (isPlaying) {
      cloud.x -= cloud.speed;
      if (cloud.x < -60) cloud.x = CANVAS_WIDTH + Math.random() * 80;
    }
    // Simple pixelated cloud shape
    ctx.fillRect(cloud.x, cloud.y, 40, 10);
    ctx.fillRect(cloud.x + 10, cloud.y - 6, 20, 6);
    ctx.fillRect(cloud.x + 15, cloud.y - 10, 12, 4);
  });
}

function drawGround() {
  ctx.strokeStyle = '#535353';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
  ctx.stroke();

  // Moving ground pebbles / dashes
  if (isPlaying) {
    groundOffset = (groundOffset + gameSpeed) % 40;
  }
  ctx.fillStyle = '#999999';
  for (let x = -groundOffset; x < CANVAS_WIDTH; x += 40) {
    ctx.fillRect(x + 5, GROUND_Y + 6, 12, 2);
    ctx.fillRect(x + 24, GROUND_Y + 12, 6, 2);
    ctx.fillRect(x + 32, GROUND_Y + 8, 4, 2);
  }
}

// Obstacles (Cacti & Pterodactyls)
let obstacles = [];

class Cactus {
  constructor(x, type) {
    this.x = x;
    this.type = type; // 0: single small, 1: double small, 2: large
    if (type === 0) {
      this.width = 16;
      this.height = 34;
    } else if (type === 1) {
      this.width = 30;
      this.height = 34;
    } else {
      this.width = 24;
      this.height = 46;
    }
    this.y = GROUND_Y - this.height;
  }

  update() {
    this.x -= gameSpeed;
  }

  draw() {
    ctx.fillStyle = '#535353';
    if (this.type === 0) {
      // Single cactus
      ctx.fillRect(this.x + 4, this.y, 8, this.height);
      ctx.fillRect(this.x, this.y + 10, 4, 10);
      ctx.fillRect(this.x + 12, this.y + 6, 4, 12);
    } else if (this.type === 1) {
      // Double cactus
      ctx.fillRect(this.x + 2, this.y, 7, this.height);
      ctx.fillRect(this.x, this.y + 8, 3, 8);
      ctx.fillRect(this.x + 16, this.y + 4, 8, this.height - 4);
      ctx.fillRect(this.x + 24, this.y + 10, 4, 9);
    } else {
      // Large cactus
      ctx.fillRect(this.x + 7, this.y, 10, this.height);
      ctx.fillRect(this.x, this.y + 12, 7, 14);
      ctx.fillRect(this.x, this.y + 8, 4, 4);
      ctx.fillRect(this.x + 17, this.y + 10, 7, 14);
      ctx.fillRect(this.x + 20, this.y + 6, 4, 4);
    }
  }
}

class Bird {
  constructor(x, yAltitude) {
    this.x = x;
    this.width = 36;
    this.height = 24;
    // yAltitude: 0 = low (must duck/jump), 1 = mid
    this.y = yAltitude === 0 ? GROUND_Y - 32 : GROUND_Y - 54;
    this.wingFrame = 0;
  }

  update() {
    this.x -= gameSpeed + 1.2;
    if (frameCount % 10 === 0) {
      this.wingFrame = (this.wingFrame + 1) % 2;
    }
  }

  draw() {
    ctx.fillStyle = '#535353';
    // Body & head
    ctx.fillRect(this.x + 6, this.y + 6, 22, 10);
    ctx.fillRect(this.x, this.y + 10, 8, 5); // Beak
    // Wings up / down
    if (this.wingFrame === 0) {
      ctx.fillRect(this.x + 12, this.y - 4, 8, 10); // Wing Up
    } else {
      ctx.fillRect(this.x + 12, this.y + 12, 8, 10); // Wing Down
    }
  }
}

function spawnObstacle() {
  const minGap = 70;
  const maxGap = 130;
  nextSpawnTimer = Math.floor(Math.random() * (maxGap - minGap)) + minGap;

  // Introduce flying pterodactyls once score exceeds 200
  if (score > 200 && Math.random() < 0.35) {
    const altitude = Math.random() < 0.5 ? 0 : 1;
    obstacles.push(new Bird(CANVAS_WIDTH, altitude));
  } else {
    const type = Math.floor(Math.random() * 3);
    obstacles.push(new Cactus(CANVAS_WIDTH, type));
  }
}

// Collision Detection with slight hit-box tolerance
function checkCollision(box1, box2) {
  const pad = 4;
  return (
    box1.x + pad < box2.x + box2.width - pad &&
    box1.x + box1.width - pad > box2.x + pad &&
    box1.y + pad < box2.y + box2.height - pad &&
    box1.y + box1.height - pad > box2.y + pad
  );
}

// Reset / Start Game
function startGame() {
  sound.init();
  score = 0;
  gameSpeed = 5.5;
  obstacles = [];
  frameCount = 0;
  nextSpawnTimer = 45;
  isPlaying = true;
  isGameOver = false;

  dino.y = GROUND_Y - dino.height;
  dino.velocityY = 0;
  dino.isGrounded = true;
  dino.isDucking = false;

  overlay.classList.add('hidden');
}

function triggerGameOver() {
  isPlaying = false;
  isGameOver = true;
  sound.playHit();

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('dino_high_score', highScore);
    hiScoreEl.textContent = `HI ${String(highScore).padStart(5, '0')}`;
  }

  overlayTitle.textContent = 'G A M E  O V E R';
  overlaySubtitle.innerHTML = `Score: <b>${score}</b><br><br>Press <b>SPACE</b> or click to restart`;
  startBtn.textContent = 'RESTART';
  overlay.classList.remove('hidden');
}

// Input Handlers
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    sound.init();
    if (!isPlaying) {
      startGame();
    } else {
      dino.jump();
    }
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    if (isPlaying) {
      dino.isDucking = true;
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown') {
    dino.isDucking = false;
  }
});

// Touch & Click controls
canvas.addEventListener('pointerdown', (e) => {
  sound.init();
  if (!isPlaying) {
    startGame();
  } else {
    dino.jump();
  }
});

startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

// Main Loop
function gameLoop() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawClouds();
  drawGround();

  if (isPlaying) {
    frameCount++;

    // Increment score & play milestone chime every 100 points
    if (frameCount % 5 === 0) {
      score++;
      scoreEl.textContent = String(score).padStart(5, '0');
      if (score > 0 && score % 100 === 0) {
        sound.playScoreMilestone();
      }
    }

    // Gradual difficulty speed scaling
    if (frameCount % 400 === 0 && gameSpeed < 13) {
      gameSpeed += 0.4;
    }

    // Spawning logic
    nextSpawnTimer--;
    if (nextSpawnTimer <= 0) {
      spawnObstacle();
    }

    // Update & draw Dino
    dino.update();

    // Update & draw Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.update();
      obs.draw();

      // Check collision
      if (checkCollision(dino, obs)) {
        dino.draw();
        triggerGameOver();
        break;
      }

      // Remove offscreen
      if (obs.x + obs.width < -10) {
        obstacles.splice(i, 1);
      }
    }
  }

  dino.draw();
  requestAnimationFrame(gameLoop);
}

// Initial draw
dino.draw();
drawClouds();
drawGround();
requestAnimationFrame(gameLoop);

