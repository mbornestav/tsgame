const canvas = document.querySelector<HTMLCanvasElement>("#game");
const scoreEl = document.querySelector<HTMLDivElement>("#score");
const bestEl = document.querySelector<HTMLDivElement>("#best");
const messageEl = document.querySelector<HTMLDivElement>("#message");

if (!canvas || !scoreEl || !bestEl || !messageEl) {
  throw new Error("Missing game elements");
}

const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("Canvas not supported");
}

const DPR = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
let width = 0;
let height = 0;

const state = {
  playing: false,
  score: 0,
  best: 0,
  time: 0,
  shake: 0,
};

const player = {
  x: 0,
  y: 0,
  radius: 18,
  vx: 0,
  vy: 0,
};

const pointer = {
  active: false,
  x: 0,
  y: 0,
};

const stars: Array<{ x: number; y: number; r: number; speed: number }> = [];
const bombs: Array<{ x: number; y: number; r: number; speed: number }> = [];
const trails: Array<{ x: number; y: number; r: number; life: number }> = [];

const bestKey = "drift-dodge-best";

function loadBest() {
  const stored = Number.parseInt(localStorage.getItem(bestKey) || "0", 10);
  state.best = Number.isFinite(stored) ? stored : 0;
  bestEl.textContent = `Best ${state.best}`;
}

function saveBest() {
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(bestKey, String(state.best));
    bestEl.textContent = `Best ${state.best}`;
  }
}

function resize() {
  width = Math.floor(canvas.clientWidth * DPR);
  height = Math.floor(canvas.clientHeight * DPR);
  canvas.width = width;
  canvas.height = height;
  player.x = width / 2;
  player.y = height / 2;
  player.radius = Math.max(16, Math.min(width, height) * 0.03);
}

function spawnStar() {
  const size = Math.random() * 6 + 6;
  stars.push({
    x: Math.random() * width,
    y: -size - Math.random() * height * 0.2,
    r: size,
    speed: 0.8 + Math.random() * 1.8 + state.score * 0.01,
  });
}

function spawnBomb() {
  const size = Math.random() * 10 + 10;
  bombs.push({
    x: Math.random() * width,
    y: -size - Math.random() * height * 0.3,
    r: size,
    speed: 1.4 + Math.random() * 2.5 + state.score * 0.015,
  });
}

function reset() {
  state.score = 0;
  state.time = 0;
  state.shake = 0;
  stars.length = 0;
  bombs.length = 0;
  trails.length = 0;
  player.x = width / 2;
  player.y = height / 2;
  player.vx = 0;
  player.vy = 0;
  scoreEl.textContent = "0";
  messageEl.textContent = "Tap to start";
}

function start() {
  state.playing = true;
  state.score = 0;
  state.time = 0;
  stars.length = 0;
  bombs.length = 0;
  trails.length = 0;
  messageEl.textContent = "";
}

function end() {
  state.playing = false;
  messageEl.textContent = "Game over - tap to try again";
  saveBest();
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function update(dt: number) {
  state.time += dt;

  if (state.playing) {
    if (Math.random() < 0.06) spawnStar();
    if (Math.random() < 0.035 + state.score * 0.0003) spawnBomb();
  }

  const targetX = pointer.active ? pointer.x : width / 2 + Math.sin(state.time * 0.7) * width * 0.12;
  const targetY = pointer.active ? pointer.y : height * 0.65 + Math.cos(state.time * 0.6) * height * 0.1;

  const ease = pointer.active ? 0.18 : 0.08;
  player.vx += (targetX - player.x) * ease;
  player.vy += (targetY - player.y) * ease;
  player.vx *= 0.75;
  player.vy *= 0.75;
  player.x += player.vx;
  player.y += player.vy;

  trails.push({ x: player.x, y: player.y, r: player.radius * 0.8, life: 1 });

  for (let i = trails.length - 1; i >= 0; i -= 1) {
    trails[i].life -= dt * 2.2;
    if (trails[i].life <= 0) trails.splice(i, 1);
  }

  for (let i = stars.length - 1; i >= 0; i -= 1) {
    const star = stars[i];
    star.y += star.speed * dt * 60;
    if (star.y - star.r > height) {
      stars.splice(i, 1);
      continue;
    }
    if (state.playing && dist(player, star) < player.radius + star.r) {
      stars.splice(i, 1);
      state.score += 1;
      scoreEl.textContent = String(state.score);
      state.shake = Math.min(8, state.shake + 2);
    }
  }

  for (let i = bombs.length - 1; i >= 0; i -= 1) {
    const bomb = bombs[i];
    bomb.y += bomb.speed * dt * 60;
    if (bomb.y - bomb.r > height) {
      bombs.splice(i, 1);
      continue;
    }
    if (state.playing && dist(player, bomb) < player.radius + bomb.r) {
      end();
      break;
    }
  }

  state.shake *= 0.88;
}

function draw() {
  ctx.save();

  if (state.shake > 0.4) {
    const jitterX = (Math.random() - 0.5) * state.shake;
    const jitterY = (Math.random() - 0.5) * state.shake;
    ctx.translate(jitterX, jitterY);
  }

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createRadialGradient(width * 0.2, height * 0.2, width * 0.1, width * 0.5, height * 0.5, width);
  bg.addColorStop(0, "#1f3c54");
  bg.addColorStop(1, "#070b12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  for (const trail of trails) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(49, 243, 196, ${trail.life * 0.4})`;
    ctx.arc(trail.x, trail.y, trail.r * (0.5 + trail.life * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }

  for (const star of stars) {
    ctx.beginPath();
    ctx.fillStyle = "#f7ff8c";
    ctx.shadowColor = "rgba(255, 255, 200, 0.6)";
    ctx.shadowBlur = 12;
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const bomb of bombs) {
    ctx.beginPath();
    ctx.fillStyle = "#ff5a6c";
    ctx.shadowColor = "rgba(255, 120, 120, 0.7)";
    ctx.shadowBlur = 18;
    ctx.arc(bomb.x, bomb.y, bomb.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.arc(bomb.x, bomb.y, bomb.r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle = "#31f3c4";
  ctx.shadowColor = "rgba(49, 243, 196, 0.8)";
  ctx.shadowBlur = 20;
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 3;
  ctx.arc(player.x, player.y, player.radius * 1.4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function updatePointer(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = (clientX - rect.left) * DPR;
  pointer.y = (clientY - rect.top) * DPR;
}

canvas.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  updatePointer(event.clientX, event.clientY);
  if (!state.playing) {
    start();
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointer.active) return;
  updatePointer(event.clientX, event.clientY);
});

canvas.addEventListener("pointerup", () => {
  pointer.active = false;
});

canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
});

window.addEventListener("resize", () => {
  resize();
});

loadBest();
resize();
reset();
requestAnimationFrame(loop);
