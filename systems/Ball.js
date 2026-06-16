export class Ball {
  constructor(x, y) { this.x = x; this.y = y; this.carrier = null; this.target = null; this.speed = 430; }
  attach(player) { this.carrier = player; player.hasBall = true; this.target = null; this.x = player.x; this.y = player.y; }
  kick(target, fromPlayer) { if (fromPlayer) fromPlayer.hasBall = false; this.carrier = null; this.target = target; }
  update(dt) {
    if (this.carrier) { this.x = this.carrier.x; this.y = this.carrier.y; return; }
    if (!this.target) return;
    const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
    if (d < 8) { this.target = null; return; }
    const step = Math.min(d, this.speed * dt);
    this.x += dx / d * step; this.y += dy / d * step;
  }
}
