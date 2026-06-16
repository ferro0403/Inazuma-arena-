export class Camera {
  constructor(canvas, field) { this.canvas = canvas; this.field = field; this.x = 0; this.y = 0; }
  follow(target, dt) {
    const vw = this.canvas.width, vh = this.canvas.height;
    const tx = Math.max(0, Math.min(this.field.width - vw, target.x - vw / 2));
    const ty = Math.max(0, Math.min(this.field.height - vh, target.y - vh / 2));
    this.x += (tx - this.x) * Math.min(1, dt * 4.5);
    this.y += (ty - this.y) * Math.min(1, dt * 4.5);
  }
  screenToWorld(sx, sy) { return { x: sx + this.x, y: sy + this.y }; }
}
