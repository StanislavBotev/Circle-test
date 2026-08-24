import "./style.css";

type Vec2 = { x: number; y: number };

type Circle = {
  position: Vec2;
  start: Vec2;
  target: Vec2;
  velocity: Vec2;
  acceleration: number;
  radius: number;
  hue: number;
  age: number;
  distanceTravelled: number;
  totalDistance: number;
};

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
const stats = document.querySelector<HTMLDivElement>("#stats");

if (!canvas || !stats) {
  throw new Error("Required DOM elements are missing.");
}

const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("Canvas 2D context is unavailable.");
}

const CONFIG = {
  minDistance: 500,
  maxDistance: 900,
  minAcceleration: 170,
  maxAcceleration: 300,
  circleRadius: 5,
  maxTrailLength: 18,
  backgroundFade: 0.14,
};

let width = 0;
let height = 0;
let dpr = 1;
let paused = false;
let lastTime = performance.now();
let spawnCount = 0;

const circles: Circle[] = [];
const trailHistory = new WeakMap<Circle, Vec2[]>();

function center(): Vec2 {
  return { x: width * 0.5, y: height * 0.5 };
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function randomTarget(origin: Vec2): Vec2 {
  const angle = Math.random() * Math.PI * 2;
  const radius = randomRange(CONFIG.minDistance, CONFIG.maxDistance);
  return {
    x: origin.x + Math.cos(angle) * radius,
    y: origin.y + Math.sin(angle) * radius,
  };
}

function randomHue(): number {
  return Math.floor(Math.random() * 360);
}

function createCircle(start: Vec2): Circle {
  const target = randomTarget(start);
  const totalDistance = distance(start, target);

  const circle: Circle = {
    position: { ...start },
    start: { ...start },
    target,
    velocity: { x: 0, y: 0 },
    acceleration: randomRange(CONFIG.minAcceleration, CONFIG.maxAcceleration),
    radius: CONFIG.circleRadius,
    hue: randomHue(),
    age: 0,
    distanceTravelled: 0,
    totalDistance,
  };

  trailHistory.set(circle, []);
  spawnCount += 1;
  return circle;
}

function resetCircleForNextLeg(circle: Circle): Circle {
  const previousStart = circle.start;
  const arrivalPoint = circle.target;

  circle.start = { ...arrivalPoint };
  circle.position = { ...arrivalPoint };
  circle.target = randomTarget(arrivalPoint);
  circle.velocity = { x: 0, y: 0 };
  circle.age = 0;
  circle.distanceTravelled = 0;
  circle.totalDistance = distance(circle.start, circle.target);
  trailHistory.set(circle, []);

  // The new circle appears exactly where this journey began.
  circles.push(createCircle(previousStart));
  return circle;
}

function resizeCanvas(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function accelerateTowards(circle: Circle, dt: number): void {
  const dx = circle.target.x - circle.position.x;
  const dy = circle.target.y - circle.position.y;
  const remaining = Math.hypot(dx, dy);

  if (remaining <= 0.001) {
    circle.position = { ...circle.target };
    circle.velocity = { x: 0, y: 0 };
    return;
  }

  const nx = dx / remaining;
  const ny = dy / remaining;

  circle.velocity.x += nx * circle.acceleration * dt;
  circle.velocity.y += ny * circle.acceleration * dt;

  const speed = Math.hypot(circle.velocity.x, circle.velocity.y);
  const travel = speed * dt;

  if (travel >= remaining) {
    circle.position = { ...circle.target };
    circle.distanceTravelled = circle.totalDistance;
    return;
  }

  circle.position.x += circle.velocity.x * dt;
  circle.position.y += circle.velocity.y * dt;
  circle.distanceTravelled = Math.min(
    circle.totalDistance,
    circle.distanceTravelled + travel,
  );
}

function updateCircle(circle: Circle, dt: number): void {
  circle.age += dt;
  accelerateTowards(circle, dt);

  const trail = trailHistory.get(circle)!;
  trail.push({ ...circle.position });
  if (trail.length > CONFIG.maxTrailLength) {
    trail.shift();
  }

  if (distance(circle.position, circle.target) <= 0.5) {
    resetCircleForNextLeg(circle);
  }
}

function speedOf(circle: Circle): number {
  return Math.hypot(circle.velocity.x, circle.velocity.y);
}

function drawBackground(): void {
  ctx.fillStyle = `rgba(8, 10, 15, ${CONFIG.backgroundFade})`;
  ctx.fillRect(0, 0, width, height);
}

function drawTarget(target: Vec2): void {
  ctx.beginPath();
  ctx.arc(target.x, target.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fill();
}

function drawTrail(circle: Circle): void {
  const trail = trailHistory.get(circle);
  if (!trail || trail.length < 2) return;

  const speed = speedOf(circle);
  const brightness = Math.min(100, 45 + speed * 0.16);

  ctx.beginPath();
  ctx.moveTo(trail[0].x, trail[0].y);
  for (let i = 1; i < trail.length; i += 1) {
    ctx.lineTo(trail[i].x, trail[i].y);
  }

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `hsla(${circle.hue}, 90%, ${brightness}%, 0.2)`;
  ctx.stroke();
}

function drawCircle(circle: Circle): void {
  const speed = speedOf(circle);
  const brightness = Math.min(100, 48 + speed * 0.18);
  const glow = Math.min(28, 5 + speed * 0.035);

  ctx.shadowBlur = glow;
  ctx.shadowColor = `hsl(${circle.hue}, 90%, ${brightness}%)`;
  ctx.fillStyle = `hsl(${circle.hue}, 90%, ${brightness}%)`;
  ctx.beginPath();
  ctx.arc(circle.position.x, circle.position.y, circle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawCenter(): void {
  const c = center();
  ctx.beginPath();
  ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
}

function render(): void {
  if (!paused) {
    drawBackground();
  }

  drawCenter();

  for (const circle of circles) {
    drawTarget(circle.target);
    drawTrail(circle);
    drawCircle(circle);
  }

  const averageSpeed = circles.length
    ? circles.reduce((sum, circle) => sum + speedOf(circle), 0) / circles.length
    : 0;

  stats.textContent = `${circles.length} circles · avg speed ${Math.round(averageSpeed)} px/s${paused ? " · PAUSED" : ""}`;
}

function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (!paused) {
    // Copy the current length so circles spawned during this frame wait until next frame.
    const countAtFrameStart = circles.length;
    for (let i = 0; i < countAtFrameStart; i += 1) {
      updateCircle(circles[i], dt);
    }
  }

  render();
  requestAnimationFrame(frame);
}

function togglePause(): void {
  paused = !paused;
  lastTime = performance.now();
  if (!paused) {
    // Repaint immediately so the visual state changes without waiting for another frame.
    drawBackground();
  }
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
  }
});

resizeCanvas();

// First journey starts at the screen center. Each arrival creates a new circle
// at the previous journey's starting point.
circles.push(createCircle(center()));

// A tiny initial fade prevents a blank frame and establishes the background.
ctx.fillStyle = "#080a0f";
ctx.fillRect(0, 0, width, height);

requestAnimationFrame(frame);
