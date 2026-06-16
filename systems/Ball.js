export class Ball {
  constructor(x, y) {
    this.x = Number.isFinite(x) ? x : 450;
    this.y = Number.isFinite(y) ? y : 750;
    this.carrier = null;
    this.target = null;
    this.speed = 430;
    this.state = 'free';
    this.lastKicker = null;
    this.pickupBlockedUntil = 0;
  }

  attach(player) {
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y) || player.isStunned?.(performance.now())) {
      console.warn('Cannot attach ball to invalid or stunned player', player);
      this.state = 'free';
      return;
    }
    if (this.carrier) this.carrier.hasBall = false;
    this.carrier = player;
    player.hasBall = true;
    this.target = null;
    this.lastKicker = null;
    this.pickupBlockedUntil = 0;
    this.state = 'possessed';
    this.x = player.x;
    this.y = player.y;
  }

  kick(target, fromPlayer) {
    const point = target && Number.isFinite(target.x) && Number.isFinite(target.y)
      ? { x: target.x, y: target.y }
      : null;
    if (!point) {
      console.warn('Rejected invalid ball target', target);
      this.state = this.carrier ? 'possessed' : 'free';
      return;
    }
    if (fromPlayer) fromPlayer.hasBall = false;
    if (this.carrier) this.carrier.hasBall = false;
    this.carrier = null;
    this.target = point;
    this.lastKicker = fromPlayer || null;
    this.pickupBlockedUntil = performance.now() + 250;
    this.state = 'moving';
  }

  setFree() {
    if (this.carrier) this.carrier.hasBall = false;
    this.carrier = null;
    this.target = null;
    this.state = 'free';
    this.lastKicker = null;
    this.pickupBlockedUntil = 0;
  }

  validatePosition(fallback = { x: 450, y: 750 }) {
    if (Number.isFinite(this.x) && Number.isFinite(this.y)) return;
    console.warn('Reset invalid ball position', { x: this.x, y: this.y, state: this.state });
    this.x = fallback.x;
    this.y = fallback.y;
    this.setFree();
  }

  validateState() {
    if (this.state === 'possessed' && this.carrier) return;
    if (this.state === 'moving' && this.target) return;
    if (this.state === 'free' && !this.carrier) return;
    console.warn('Reset invalid ball state', { state: this.state, carrier: this.carrier, target: this.target });
    this.state = this.carrier ? 'possessed' : (this.target ? 'moving' : 'free');
  }

  update(dt) {
    this.validateState();
    if (this.carrier) {
      if (Number.isFinite(this.carrier.x) && Number.isFinite(this.carrier.y)) {
        this.state = 'possessed';
        this.x = this.carrier.x;
        this.y = this.carrier.y;
      } else {
        console.warn('Ball carrier had invalid position', this.carrier);
        this.carrier.hasBall = false;
        this.carrier = null;
        this.state = 'free';
      }
      this.validatePosition();
      return;
    }
    this.validatePosition();
    if (!this.target) { this.state = 'free'; return; }
    if (!Number.isFinite(this.target.x) || !Number.isFinite(this.target.y)) {
      console.warn('Cleared invalid ball target', this.target);
      this.target = null;
      this.state = 'free';
      return;
    }
    this.state = 'moving';
    const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
    if (!Number.isFinite(d) || d <= 0.0001) { this.target = null; this.state = 'free'; return; }
    if (d < 8) { this.x = this.target.x; this.y = this.target.y; this.target = null; this.state = 'free'; return; }
    const step = Math.min(d, this.speed * dt);
    this.x += dx / d * step;
    this.y += dy / d * step;
    this.validatePosition();
  }
}
