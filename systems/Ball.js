export class Ball {
  constructor(x, y) {
    this.x = Number.isFinite(x) ? x : 450;
    this.y = Number.isFinite(y) ? y : 750;
    this.carrier = null;
    this.target = null;
    this.speed = 520;
    this.passSpeed = 560;
    this.shotSpeed = 860;
    this.state = 'loose';
    this.lastKicker = null;
    this.pickupBlockedUntil = 0;
    this.arrived = false;
  }

  attach(player) {
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y) || player.isStunned?.(performance.now())) {
      console.warn('Cannot attach ball to invalid or stunned player', player);
      this.setLoose();
      return;
    }
    if (this.carrier) this.carrier.hasBall = false;
    this.carrier = player;
    player.hasBall = true;
    this.target = null;
    this.lastKicker = null;
    this.pickupBlockedUntil = 0;
    this.arrived = false;
    this.state = 'possessed';
    this.x = player.x;
    this.y = player.y;
  }

  passTo(target, fromPlayer) {
    this.travelTo(target, fromPlayer, 'pass', this.passSpeed);
  }

  shootTo(target, fromPlayer) {
    this.travelTo(target, fromPlayer, 'shot', this.shotSpeed);
  }

  travelTo(target, fromPlayer, state, speed) {
    const point = target && Number.isFinite(target.x) && Number.isFinite(target.y)
      ? { x: target.x, y: target.y }
      : null;
    if (!point) {
      console.warn('Rejected invalid ball target', target);
      this.state = this.carrier ? 'possessed' : 'loose';
      return;
    }
    if (fromPlayer) fromPlayer.hasBall = false;
    if (this.carrier) this.carrier.hasBall = false;
    this.carrier = null;
    this.target = point;
    this.speed = speed;
    this.lastKicker = fromPlayer || null;
    this.pickupBlockedUntil = performance.now() + 250;
    this.arrived = false;
    this.state = state;
  }

  setLoose() {
    if (this.carrier) this.carrier.hasBall = false;
    this.carrier = null;
    this.target = null;
    this.state = 'loose';
    this.lastKicker = null;
    this.pickupBlockedUntil = 0;
    this.arrived = false;
  }

  markGoal() {
    if (this.carrier) this.carrier.hasBall = false;
    this.carrier = null;
    this.target = null;
    this.state = 'goal';
    this.arrived = true;
  }

  markSaved() {
    this.state = 'saved';
    this.arrived = true;
  }

  validatePosition(fallback = { x: 450, y: 750 }) {
    if (Number.isFinite(this.x) && Number.isFinite(this.y)) return;
    console.warn('Reset invalid ball position', { x: this.x, y: this.y, state: this.state });
    this.x = fallback.x;
    this.y = fallback.y;
    this.setLoose();
  }

  validateState() {
    if (this.state === 'possessed' && this.carrier && !this.carrier.isStunned?.(performance.now())) return;
    if (this.state === 'pass' && this.target) return;
    if (this.state === 'shot' && (this.target || this.arrived)) return;
    if ((this.state === 'loose' || this.state === 'goal' || this.state === 'saved') && !this.carrier) return;
    if (this.state === 'possessed' && this.carrier?.isStunned?.(performance.now())) {
      console.warn('Possessor stunned, releasing ball', this.carrier.name);
      this.setLoose();
      return;
    }
    console.warn('Reset invalid ball state', { state: this.state, carrier: this.carrier, target: this.target });
    this.state = this.carrier ? 'possessed' : (this.target ? 'pass' : 'loose');
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
        this.state = 'loose';
      }
      this.validatePosition();
      return;
    }
    this.validatePosition();
    if (!this.target) { if (this.state === 'pass') this.state = 'loose'; return; }
    if (!Number.isFinite(this.target.x) || !Number.isFinite(this.target.y)) {
      console.warn('Cleared invalid ball target', this.target);
      this.target = null;
      this.state = 'loose';
      return;
    }
    const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
    if (!Number.isFinite(d) || d <= 0.0001) { this.arriveAtTarget(); return; }
    if (d < 8) { this.arriveAtTarget(); return; }
    const step = Math.min(d, this.speed * dt);
    this.x += dx / d * step;
    this.y += dy / d * step;
    this.validatePosition();
  }

  arriveAtTarget() {
    if (this.target) {
      this.x = this.target.x;
      this.y = this.target.y;
    }
    this.target = null;
    this.arrived = true;
    if (this.state === 'pass') this.state = 'loose';
  }
}
