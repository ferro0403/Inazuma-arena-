export class Ball {
  constructor(x, y) {
    this.x = Number.isFinite(x) ? x : 450;
    this.y = Number.isFinite(y) ? y : 750;
    this.carrier = null;
    this.target = null;
    this.speed = 430;
  }

  attach(player) {
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) {
      console.warn('Cannot attach ball to invalid player', player);
      return;
    }
    if (this.carrier) this.carrier.hasBall = false;
    this.carrier = player;
    player.hasBall = true;
    this.target = null;
    this.x = player.x;
    this.y = player.y;
  }

  kick(target, fromPlayer) {
    const point = target && Number.isFinite(target.x) && Number.isFinite(target.y)
      ? { x: target.x, y: target.y }
      : null;
    if (!point) {
      console.warn('Rejected invalid ball target', target);
      return;
    }
    if (fromPlayer) fromPlayer.hasBall = false;
    if (this.carrier) this.carrier.hasBall = false;
    this.carrier = null;
    this.target = point;
  }

  validatePosition(fallback = { x: 450, y: 750 }) {
    if (Number.isFinite(this.x) && Number.isFinite(this.y)) return;
    console.warn('Reset invalid ball position', { x: this.x, y: this.y });
    this.x = fallback.x;
    this.y = fallback.y;
    this.target = null;
    this.carrier = null;
  }

  update(dt) {
    if (this.carrier) {
      if (Number.isFinite(this.carrier.x) && Number.isFinite(this.carrier.y)) {
        this.x = this.carrier.x;
        this.y = this.carrier.y;
      } else {
        console.warn('Ball carrier had invalid position', this.carrier);
        this.carrier.hasBall = false;
        this.carrier = null;
      }
      this.validatePosition();
      return;
    }
    this.validatePosition();
    if (!this.target) return;
    if (!Number.isFinite(this.target.x) || !Number.isFinite(this.target.y)) {
      console.warn('Cleared invalid ball target', this.target);
      this.target = null;
      return;
    }
    const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
    if (!Number.isFinite(d) || d <= 0.0001) { this.target = null; return; }
    if (d < 8) { this.target = null; return; }
    const step = Math.min(d, this.speed * dt);
    this.x += dx / d * step;
    this.y += dy / d * step;
    this.validatePosition();
  }
}
