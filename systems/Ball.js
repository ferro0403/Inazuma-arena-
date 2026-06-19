export const BALL_TUNING = {
  teammatePassSpeed: 670,
  spacePassSpeed: 575,
  lobPassSpeed: 500,
  lobFriction: 120,
  lobLandingRetain: 0.62,
  shotSpeed: 980,
  passFriction: 260,
  spacePassFriction: 300,
  looseFriction: 340,
  shotFriction: 180,
  maxPassSpeed: 725,
  maxSpacePassSpeed: 630,
  maxShotSpeed: 1040,
  minStopSpeed: 8,
  finalStopSpeed: 0.7,
  shortPassDistance: 180,
  longPassDistance: 520
};

export class Ball {
  constructor(x, y) {
    this.x = Number.isFinite(x) ? x : 450;
    this.y = Number.isFinite(y) ? y : 750;
    this.vx = 0; this.vy = 0; this.speed = 0; this.z = 0;
    this.lobElapsed = 0; this.lobDuration = 0; this.lobLaunchSpeed = 0;
    this.tuning = { ...BALL_TUNING };
    this.carrier = null; this.target = null; this.state = 'loose';
    this.lastKicker = null; this.pickupBlockedUntil = 0; this.arrived = false;
    this.lastPassType = 'none';
    this.lastTouch = null; this.lastTouchTeam = null; this.intendedReceiver = null; this.predictedReceivePoint = null; this.landingPoint = null;
  }
  attach(player) {
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y) || player.isStunned?.(performance.now())) { console.warn('Cannot attach ball', player); this.setLoose(); return; }
    if (this.carrier) this.carrier.hasBall = false;
    this.carrier = player; player.hasBall = true; this.lastTouch = player; this.lastTouchTeam = player.team; this.target = null; this.predictedReceivePoint = null; this.landingPoint = null; this.vx = 0; this.vy = 0; this.speed = 0;
    this.lastKicker = null; this.pickupBlockedUntil = 0; this.arrived = false; this.intendedReceiver = null; this.z = 0; this.lobElapsed = 0; this.lobDuration = 0; this.lobLaunchSpeed = 0; player.receivedAt = performance.now(); this.state = 'possessed'; this.x = player.x; this.y = player.y;
  }
  passTo(target, fromPlayer, passType = 'space', intendedReceiver = null, lob = false) { this.travelTo(target, fromPlayer, lob ? 'lob_pass' : 'pass', this.speedForPass(target, passType, lob), lob ? `${passType}-lob` : passType, intendedReceiver); }
  shootTo(target, fromPlayer) { this.travelTo(target, fromPlayer, 'shot', this.tuning.shotSpeed, 'shot', null); }
  speedForPass(target, passType, lob = false) {
    const dx = target.x - this.x, dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(1, (distance - this.tuning.shortPassDistance) / (this.tuning.longPassDistance - this.tuning.shortPassDistance)));
    const base = lob ? this.tuning.lobPassSpeed : (passType === 'teammate' ? this.tuning.teammatePassSpeed : this.tuning.spacePassSpeed);
    const cap = passType === 'teammate' ? this.tuning.maxPassSpeed : this.tuning.maxSpacePassSpeed;
    return Math.min(cap, base * (0.78 + 0.22 * t));
  }
  travelTo(target, fromPlayer, state, launchSpeed, passType, intendedReceiver = null) {
    const point = target && Number.isFinite(target.x) && Number.isFinite(target.y) ? { x: target.x, y: target.y } : null;
    if (!point) { console.warn('Rejected invalid ball target', target); this.state = this.carrier ? 'possessed' : 'loose'; return; }
    const dx = point.x - this.x, dy = point.y - this.y, d = Math.hypot(dx, dy);
    if (!Number.isFinite(d) || d <= 0.0001) { this.setLoose(); return; }
    const cappedSpeed = state === 'shot' ? Math.min(this.tuning.maxShotSpeed, launchSpeed) : launchSpeed;
    if (fromPlayer) fromPlayer.hasBall = false; if (this.carrier) this.carrier.hasBall = false;
    this.carrier = null; this.target = point; this.intendedReceiver = intendedReceiver; this.predictedReceivePoint = point; this.landingPoint = state === 'lob_pass' ? point : null; this.vx = dx / d * cappedSpeed; this.vy = dy / d * cappedSpeed; this.speed = cappedSpeed;
    this.z = state === 'lob_pass' ? 1 : 0; this.lobElapsed = 0; this.lobDuration = state === 'lob_pass' ? Math.max(0.75, d / Math.max(1, cappedSpeed) * 1.35) : 0; this.lobLaunchSpeed = state === 'lob_pass' ? cappedSpeed : 0;
    this.lastKicker = fromPlayer || null; this.lastTouch = fromPlayer || this.lastTouch; this.lastTouchTeam = fromPlayer?.team || this.lastTouchTeam; this.pickupBlockedUntil = performance.now() + 160; this.arrived = false; this.state = state; this.lastPassType = passType;
  }
  setLoose() { if (this.carrier) this.carrier.hasBall = false; this.carrier = null; this.target = null; this.intendedReceiver = null; this.predictedReceivePoint = null; this.landingPoint = null; this.state = 'loose'; this.lastKicker = null; this.pickupBlockedUntil = 0; this.arrived = false; this.z = 0; this.lobElapsed = 0; this.lobDuration = 0; this.lobLaunchSpeed = 0; }
  markGoal() { if (this.carrier) this.carrier.hasBall = false; this.carrier = null; this.target = null; this.vx = 0; this.vy = 0; this.speed = 0; this.z = 0; this.state = 'goal'; this.arrived = true; }
  markSaved() { this.vx = 0; this.vy = 0; this.speed = 0; this.z = 0; this.state = 'saved'; this.arrived = true; }
  validatePosition(fallback = { x: 450, y: 750 }) { if (Number.isFinite(this.x) && Number.isFinite(this.y)) return; console.warn('Reset invalid ball position', { x:this.x,y:this.y,state:this.state }); this.x = fallback.x; this.y = fallback.y; this.vx=0; this.vy=0; this.speed=0; this.setLoose(); }
  validateState() {
    if (this.state === 'possessed' && this.carrier && !this.carrier.isStunned?.(performance.now())) return;
    if ((this.state === 'pass' || this.state === 'lob_pass' || this.state === 'shot') && (Math.hypot(this.vx, this.vy) > 1 || this.arrived)) return;
    if ((this.state === 'loose' || this.state === 'goal' || this.state === 'saved' || this.state === 'throw_in' || this.state === 'goal_kick' || this.state === 'corner' || this.state === 'kickoff') && !this.carrier) return;
    if (this.state === 'possessed' && this.carrier?.isStunned?.(performance.now())) { this.setLoose(); return; }
    console.warn('Reset invalid ball state', { state:this.state, carrier:this.carrier }); this.state = this.carrier ? 'possessed' : 'loose';
  }
  frictionForState() {
    if (this.state === 'shot') return this.tuning.shotFriction;
    if (this.state === 'lob_pass') return this.tuning.lobFriction;
    if (this.state === 'loose') return this.tuning.looseFriction;
    return this.lastPassType.includes('space') ? this.tuning.spacePassFriction : this.tuning.passFriction;
  }
  update(dt) {
    this.validateState();
    if (this.carrier) { this.state='possessed'; this.x=this.carrier.x; this.y=this.carrier.y; this.vx=0; this.vy=0; this.speed=0; this.z=0; this.validatePosition(); return; }
    this.validatePosition();
    this.speed = Math.hypot(this.vx, this.vy);
    if (this.speed <= this.tuning.finalStopSpeed) { this.vx=0; this.vy=0; this.speed=0; if (this.state === 'pass' || this.state === 'lob_pass') { this.state='loose'; this.z=0; } return; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.state === 'lob_pass') {
      this.lobElapsed += dt;
      const progress = Math.min(1, this.lobElapsed / Math.max(0.001, this.lobDuration));
      this.z = Math.sin(progress * Math.PI) * 58;
      if (progress >= 1) {
        const landingSpeed = Math.max(this.speed, this.lobLaunchSpeed * this.tuning.lobLandingRetain);
        const currentSpeed = Math.max(0.001, Math.hypot(this.vx, this.vy));
        this.vx = this.vx / currentSpeed * landingSpeed; this.vy = this.vy / currentSpeed * landingSpeed; this.speed = landingSpeed;
        this.z = 0; this.lobLaunchSpeed = 0; this.state = 'pass'; this.lastPassType = this.lastPassType.replace('-lob', '');
      }
    }
    let nextSpeed = this.speed - this.frictionForState() * dt;
    if (nextSpeed <= this.tuning.minStopSpeed) {
      nextSpeed = this.speed * Math.pow(0.08, dt);
      if (this.state === 'pass' || this.state === 'lob_pass') { this.state='loose'; this.z=0; }
    }
    if (nextSpeed <= this.tuning.finalStopSpeed) { this.vx=0; this.vy=0; this.speed=0; }
    else { const k = nextSpeed / this.speed; this.vx *= k; this.vy *= k; this.speed = nextSpeed; }
    this.validatePosition();
  }
}
