export class Camera {
  constructor(canvas, field) {
    this.canvas = canvas;
    this.field = field;
    this.x = 0;
    this.y = 0;
    this.viewportWidth = 560;
    this.viewportHeight = 760;
  }

  setViewport(width, height) {
    this.viewportWidth = Number.isFinite(width) && width > 0 ? width : 560;
    this.viewportHeight = Number.isFinite(height) && height > 0 ? height : 760;
    this.clamp();
  }

  follow(target, dt = 1 / 60) {
    const safeTarget = target && Number.isFinite(target.x) && Number.isFinite(target.y)
      ? target
      : { x: this.field.width / 2, y: this.field.height / 2 };
    const maxX = Math.max(0, this.field.width - this.viewportWidth);
    const maxY = Math.max(0, this.field.height - this.viewportHeight);
    const desiredX = Math.max(0, Math.min(maxX, safeTarget.x - this.viewportWidth / 2));
    const desiredY = Math.max(0, Math.min(maxY, safeTarget.y - this.viewportHeight / 2));
    const alpha = Math.min(1, Math.max(0, dt) * 5.5);
    this.x += (desiredX - this.x) * alpha;
    this.y += (desiredY - this.y) * alpha;
    this.clamp();
  }

  centerOn(target) {
    this.x = target.x - this.viewportWidth / 2;
    this.y = target.y - this.viewportHeight / 2;
    this.clamp();
  }

  clamp() {
    const maxX = Math.max(0, this.field.width - this.viewportWidth);
    const maxY = Math.max(0, this.field.height - this.viewportHeight);
    if (!Number.isFinite(this.x)) this.x = 0;
    if (!Number.isFinite(this.y)) this.y = 0;
    this.x = Math.max(0, Math.min(maxX, this.x));
    this.y = Math.max(0, Math.min(maxY, this.y));
  }
}
