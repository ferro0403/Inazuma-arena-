export class Player {
  constructor({ id, name, team, role, x, y, homeX, homeY, color, kit, stats }) {
    Object.assign(this, { id, name, team, role, x, y, homeX, homeY, color });
    this.kit = kit || { primary: color, secondary: '#ffffff', keeper: '#ffffff' };
    this.radius = role === 'goalkeeper' ? 19 : 17;
    this.speed = role === 'goalkeeper' ? 89 : 122;
    this.destination = null;
    this.clearManualRun();
    this.manualRunTarget = null;
    this.manualRunActive = false;
    this.destinationSource = 'none';
    this.hasBall = false;
    this.selected = false;
    this.stats = { dribble: 45, tackle: 42, shoot: 44, save: 44, technique: 50, ...stats };
    this.techniques = [];
    this.stamina = 100;
    this.tp = 50;
    this.duelCooldownUntil = 0;
    this.stunnedUntil = 0;
    this.aiNextDecisionAt = 0;
    this.idleSince = 0;
  }

  isStunned(now = performance.now()) { return now < this.stunnedUntil; }

  setDestination(x, y, manual = false, source = 'support_ai') {
    const next = typeof x === 'object' ? x : { x, y };
    if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) {
      console.warn('Rejected invalid player destination', { player: this.name, destination: next });
      this.destination = null;
      if (manual) { this.clearManualRun(); }
      return;
    }
    if (this.isStunned()) {
      this.destination = null; this.clearManualRun();
      return;
    }
    if (!manual && this.manualRunActive) return;
    this.destination = { x: next.x, y: next.y };
    if (manual) { this.manualRunTarget = { ...this.destination }; this.manualRunActive = true; this.movementTarget = { ...this.destination }; this.movementCommandActive = true; this.destinationSource = 'manual'; }
    else this.destinationSource = source;
    this.idleSince = 0;
  }

  validatePosition(fallback = { x: this.homeX, y: this.homeY }) {
    if (Number.isFinite(this.x) && Number.isFinite(this.y)) return;
    console.warn('Reset invalid player position', { player: this.name, x: this.x, y: this.y });
    this.x = Number.isFinite(fallback.x) ? fallback.x : 0;
    this.y = Number.isFinite(fallback.y) ? fallback.y : 0;
    this.destination = null;
    this.clearManualRun();
    this.manualRunTarget = null;
    this.manualRunActive = false;
    this.destinationSource = 'none';
  }

  clearManualRun() {
    this.movementTarget = null;
    this.movementCommandActive = false;
    this.manualRunTarget = null;
    this.manualRunActive = false;
    this.destinationSource = 'none';
  }

  update(dt) {
    this.validatePosition();
    if (this.isStunned()) { this.destination = null; this.clearManualRun(); return; }
    if (!this.destination) return;
    if (!Number.isFinite(this.destination.x) || !Number.isFinite(this.destination.y)) {
      console.warn('Cleared invalid player destination', { player: this.name, destination: this.destination });
      this.destination = null; this.clearManualRun();
      return;
    }
    const dx = this.destination.x - this.x;
    const dy = this.destination.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0.0001) { this.destination = null; this.clearManualRun(); return; }
    if (distance < 3) { this.destination = null; this.clearManualRun(); this.idleSince = performance.now(); return; }
    const step = Math.min(distance, this.speed * dt);
    this.x += (dx / distance) * step;
    this.y += (dy / distance) * step;
    this.stamina = Math.max(0, this.stamina - dt * 0.8);
    this.validatePosition();
  }
}
