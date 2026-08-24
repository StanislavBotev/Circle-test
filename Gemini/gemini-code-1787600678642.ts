interface Point {
  x: number;
  y: number;
}

class AcceleratingCircle {
  public x: number;
  public y: number;
  public radius: number = 7;
  public baseHue: number;
  public speed: number = 10; // Initial non-zero velocity (px/s)
  public acceleration: number = 220; // Constant acceleration (px/s^2)
  public isFinished: boolean = false;

  public startPoint: Point;
  public targetPoint: Point;
  private totalDistance: number;
  private currentDistance: number = 0;
  private dirX: number;
  private dirY: number;

  constructor(start: Point, target: Point, hue?: number) {
    this.startPoint = { ...start };
    this.targetPoint = { ...target };
    this.x = start.x;
    this.y = start.y;
    this.baseHue = hue !== undefined ? hue : Math.floor(Math.random() * 360);

    const dx = this.targetPoint.x - this.startPoint.x;
    const dy = this.targetPoint.y - this.startPoint.y;
    this.totalDistance = Math.hypot(dx, dy);

    if (this.totalDistance === 0) {
      this.dirX = 0;
      this.dirY = 0;
      this.isFinished = true;
    } else {
      this.dirX = dx / this.totalDistance;
      this.dirY = dy / this.totalDistance;
    }
  }

  public update(dt: number): void {
    if (this.isFinished) return;

    // v = v0 + a * dt
    this.speed += this.acceleration * dt;
    // d = v * dt
    const moveStep = this.speed * dt;
    this.currentDistance += moveStep;

    if (this.currentDistance >= this.totalDistance) {
      this.currentDistance = this.totalDistance;
      this.x = this.targetPoint.x;
      this.y = this.targetPoint.y;
      this.isFinished = true;
    } else {
      this.x = this.startPoint.x + this.dirX * this.currentDistance;
      this.y = this.startPoint.y + this.dirY * this.currentDistance;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    // Dynamic lightness based on speed (shifts from 35% up to 92%)
    const lightness = Math.min(92, 35 + (this.speed / 600) * 57);
    const color = `hsl(${this.baseHue}, 90%, ${lightness}%)`;
    const glowColor = `hsla(${this.baseHue}, 100%, ${lightness}%, 0.45)`;

    ctx.save();

    // Target waypoint indicator
    ctx.beginPath();
    ctx.arc(this.targetPoint.x, this.targetPoint.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.baseHue}, 80%, 60%, 0.25)`;
    ctx.fill();

    // Trajectory path line
    ctx.beginPath();
    ctx.moveTo(this.startPoint.x, this.startPoint.y);
    ctx.lineTo(this.targetPoint.x, this.targetPoint.y);
    ctx.strokeStyle = `hsla(${this.baseHue}, 70%, 50%, 0.12)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Circle glow
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10 + Math.min(20, this.speed / 30);

    // Active circle body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }
}

class Simulation {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private circles: AcceleratingCircle[] = [];
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private activeCountEl: HTMLElement | null;
  private overlayEl: HTMLElement | null;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.activeCountEl = document.getElementById("activeCount");
    this.overlayEl = document.getElementById("overlay");

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    window.addEventListener("keydown", (e) => this.handleKeydown(e));

    this.initFirstCircle();
    requestAnimationFrame((t) => this.loop(t));
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
  }

  private generateTarget(origin: Point): Point {
    const minDistance = 500;
    const maxDistance = 900;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    const angle = Math.random() * Math.PI * 2;

    return {
      x: origin.x + Math.cos(angle) * distance,
      y: origin.y + Math.sin(angle) * distance,
    };
  }

  private initFirstCircle(): void {
    const center: Point = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    const target = this.generateTarget(center);
    this.circles.push(new AcceleratingCircle(center, target));
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.code === "Space") {
      e.preventDefault();
      this.isPaused = !this.isPaused;
      if (this.overlayEl) {
        this.overlayEl.classList.toggle("is-paused", this.isPaused);
      }
    }
  }

  private loop(currentTime: number): void {
    if (!this.lastTime) this.lastTime = currentTime;
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap delta to avoid jumps
    this.lastTime = currentTime;

    if (!this.isPaused) {
      this.update(dt);
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    const newSpawns: AcceleratingCircle[] = [];

    for (let i = this.circles.length - 1; i >= 0; i--) {
      const circle = this.circles[i];
      circle.update(dt);

      if (circle.isFinished) {
        const arrivalPoint = circle.targetPoint;
        const originPoint = circle.startPoint;

        // 1. Primary circle continues from B to new target C
        const nextTargetForPrimary = this.generateTarget(arrivalPoint);
        newSpawns.push(
          new AcceleratingCircle(arrivalPoint, nextTargetForPrimary, circle.baseHue)
        );

        // 2. New spawned circle launches from previous A to a fresh random target
        const nextTargetForSpawn = this.generateTarget(originPoint);
        newSpawns.push(
          new AcceleratingCircle(originPoint, nextTargetForSpawn)
        );

        // Remove the completed segment
        this.circles.splice(i, 1);
      }
    }

    this.circles.push(...newSpawns);

    if (this.activeCountEl) {
      this.activeCountEl.textContent = `Circles: ${this.circles.length}`;
    }
  }

  private render(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Semi-transparent clear for subtle motion blur
    this.ctx.fillStyle = "rgba(11, 13, 19, 0.28)";
    this.ctx.fillRect(0, 0, width, height);

    for (const circle of this.circles) {
      circle.draw(this.ctx);
    }
  }
}

new Simulation("simCanvas");