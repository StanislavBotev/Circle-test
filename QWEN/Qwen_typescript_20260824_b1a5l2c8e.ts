// src/main.ts
interface Circle {
  id: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  dist: number;
  t: number;
  T: number;
  v0: number;
  a: number;
  hue: number;
  radius: number;
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let width = window.innerWidth;
let height = window.innerHeight;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}
resize();
window.addEventListener('resize', resize);

let paused = false;
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    paused = !paused;
    e.preventDefault();
  }
});

let nextId = 0;
const circles: Circle[] = [];

const V0 = 0.6;          // initial speed (px/frame) — "starts slow"
const T = 140;           // frames per segment (~2.3s at 60fps)
const MIN_DIST = 500;
const MAX_DIST = 900;
const MAX_CIRCLES = 80;  // safety cap

function randomTarget(cx: number, cy: number): { x: number; y: number; dist: number } {
  const dist = MIN_DIST + Math.random() * (MAX_DIST - MIN_DIST);
  const angle = Math.random() * Math.PI * 2;
  return {
    x: cx + Math.cos(angle) * dist,
    y: cy + Math.sin(angle) * dist,
    dist
  };
}

function createCircle(ax: number, ay: number): Circle {
  const target = randomTarget(ax, ay);
  const D = target.dist;
  // Solve D = v0*T + 0.5*a*T^2 for a
  const a = 2 * (D - V0 * T) / (T * T);
  return {
    id: nextId++,
    ax,
    ay,
    bx: target.x,
    by: target.y,
    dist: D,
    t: 0,
    T,
    v0: V0,
    a,
    hue: Math.random() * 360,
    radius: 5
  };
}

// Seed the simulation: one circle starting at screen center
circles.push(createCircle(width / 2, height / 2));

function update() {
  if (paused) return;

  const spawned: Circle[] = [];

  for (const c of circles) {
    c.t++;
    if (c.t >= c.T) {
      // Arrived at B. B becomes the new A for this circle.
      const oldAx = c.ax;
      const oldAy = c.ay;
      c.ax = c.bx;
      c.ay = c.by;

      const target = randomTarget(c.ax, c.ay);
      c.bx = target.x;
      c.by = target.y;
      c.dist = target.dist;
      c.a = 2 * (c.dist - V0 * T) / (T * T);
      c.t = 0;

      // Simultaneously, a new circle spawns from the previous A.
      spawned.push(createCircle(oldAx, oldAy));
    }
  }

  for (const s of spawned) circles.push(s);

  // Cap population to keep things responsive.
  while (circles.length > MAX_CIRCLES) circles.shift();
}

function draw() {
  // Soft trail: overlay a translucent dark rect instead of a hard clear.
  ctx.fillStyle = 'rgba(10, 10, 15, 0.18)';
  ctx.fillRect(0, 0, width, height);

  for (const c of circles) {
    const s = c.v0 * c.t + 0.5 * c.a * c.t * c.t; // distance traveled along segment
    const frac = Math.min(1, s / c.dist);
    const px = c.ax + (c.bx - c.ax) * frac;
    const py = c.ay + (c.by - c.ay) * frac;

    // Current speed drives brightness.
    const v = c.v0 + c.a * c.t;
    const vMax = c.v0 + c.a * c.T;
    const speedRatio = v / vMax; // 0..1
    const lightness = 28 + 44 * speedRatio; // 28% -> 72%
    const saturation = 75 + 20 * speedRatio;

    const color = `hsl(${c.hue}, ${saturation}%, ${lightness}%)`;

    ctx.beginPath();
    ctx.arc(px, py, c.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 + 14 * speedRatio;
    ctx.fill();
  }

  // Reset shadow so it doesn't leak into the trail overlay next frame.
  ctx.shadowBlur = 0;

  if (paused) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', width / 2, height / 2);
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();