export class Ball {
  constructor(x, y) {
    this.x = Number.isFinite(x) ? x : 450;
    this.y = Number.isFinite(y) ? y : 750;
    this.vx = 0; this.vy = 0; this.speed = 0;
    this.passSpeed = 620; this.shotSpeed = 980; this.friction = 260;
    this.carrier = null; this.target = null; this.state = 'loose';
    this.lastKicker = null; this.pickupBlockedUntil = 0; this.arrived = false;
    this.lastPassType = 'none';
    this.lastTouch = null; this.lastTouchTeam = null;
  }
  attach(player) {
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y) || player.isStunned?.(performance.now())) { console.warn('Cannot attach ball', player); this.setLoose(); return; }
    if (this.carrier) this.carrier.hasBall = false;
    this.carrier = player; player.hasBall = true; this.lastTouch = player; this.lastTouchTeam = player.team; this.target = null; this.vx = 0; this.vy = 0; this.speed = 0;
    this.lastKicker = null; this.pickupBlockedUntil = 0; this.arrived = false; this.state = 'possessed'; this.x = player.x; this.y = player.y;
  }
  passTo(target, fromPlayer, passType = 'space') { this.travelTo(target, fromPlayer, 'pass', this.passSpeed, passType); }
  shootTo(target, fromPlayer) { this.travelTo(target, fromPlayer, 'shot', this.shotSpeed, 'shot'); }
  travelTo(target, fromPlayer, state, launchSpeed, passType) {
    const point = target && Number.isFinite(target.x) && Number.isFinite(target.y) ? { x: target.x, y: target.y } : null;
    if (!point) { console.warn('Rejected invalid ball target', target); this.state = this.carrier ? 'possessed' : 'loose'; return; }
    const dx = point.x - this.x, dy = point.y - this.y, d = Math.hypot(dx, dy);
    if (!Number.isFinite(d) || d <= 0.0001) { this.setLoose(); return; }
    if (fromPlayer) fromPlayer.hasBall = false; if (this.carrier) this.carrier.hasBall = false;
    this.carrier = null; this.target = point; this.vx = dx / d * launchSpeed; this.vy = dy / d * launchSpeed; this.speed = launchSpeed;
    this.lastKicker = fromPlayer || null; this.lastTouch = fromPlayer || this.lastTouch; this.lastTouchTeam = fromPlayer?.team || this.lastTouchTeam; this.pickupBlockedUntil = performance.now() + 250; this.arrived = false; this.state = state; this.lastPassType = passType;
  }
  setLoose() { if (this.carrier) this.carrier.hasBall = false; this.carrier = null; this.target = null; this.state = 'loose'; this.lastKicker = null; this.pickupBlockedUntil = 0; this.arrived = false; }
  markGoal() { if (this.carrier) this.carrier.hasBall = false; this.carrier = null; this.target = null; this.vx = 0; this.vy = 0; this.speed = 0; this.state = 'goal'; this.arrived = true; }
  markSaved() { this.vx = 0; this.vy = 0; this.speed = 0; this.state = 'saved'; this.arrived = true; }
  validatePosition(fallback = { x: 450, y: 750 }) { if (Number.isFinite(this.x) && Number.isFinite(this.y)) return; console.warn('Reset invalid ball position', { x:this.x,y:this.y,state:this.state }); this.x = fallback.x; this.y = fallback.y; this.vx=0; this.vy=0; this.speed=0; this.setLoose(); }
  validateState() {
    if (this.state === 'possessed' && this.carrier && !this.carrier.isStunned?.(performance.now())) return;
    if ((this.state === 'pass' || this.state === 'shot') && (Math.hypot(this.vx, this.vy) > 1 || this.arrived)) return;
    if ((this.state === 'loose' || this.state === 'goal' || this.state === 'saved' || this.state === 'throw_in' || this.state === 'goal_kick' || this.state === 'corner' || this.state === 'kickoff') && !this.carrier) return;
    if (this.state === 'possessed' && this.carrier?.isStunned?.(performance.now())) { this.setLoose(); return; }
    console.warn('Reset invalid ball state', { state:this.state, carrier:this.carrier }); this.state = this.carrier ? 'possessed' : 'loose';
  }
  update(dt) {
    this.validateState();
    if (this.carrier) { this.state='possessed'; this.x=this.carrier.x; this.y=this.carrier.y; this.vx=0; this.vy=0; this.speed=0; this.validatePosition(); return; }
    this.validatePosition();
    this.speed = Math.hypot(this.vx, this.vy);
    if (this.speed <= 1) { this.vx=0; this.vy=0; this.speed=0; if (this.state === 'pass') this.state='loose'; return; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    const nextSpeed = Math.max(0, this.speed - this.friction * dt);
    if (nextSpeed <= 8) { this.vx=0; this.vy=0; this.speed=0; if (this.state === 'pass') this.state='loose'; }
    else { const k = nextSpeed / this.speed; this.vx *= k; this.vy *= k; this.speed = nextSpeed; }
    this.validatePosition();
  }
}
