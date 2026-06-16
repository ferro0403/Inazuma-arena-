export class Player {
  constructor({ id, name, team, role, x, y, homeX, homeY, color, kit, stats }) {
    Object.assign(this, { id, name, team, role, x, y, homeX, homeY, color });
    this.kit = kit || { primary: color, secondary: '#ffffff', keeper: '#ffffff' };
    this.radius = role === 'goalkeeper' ? 19 : 17;
    this.speed = role === 'goalkeeper' ? 105 : 145;
    this.destination = null;
    this.hasBall = false;
    this.selected = false;
    this.stats = { dribble: 45, tackle: 42, shoot: 44, save: 44, technique: 50, ...stats };
    this.techniques = [];
    this.stamina = 100;
    this.tp = 50;
  }

  setDestination(x, y) {
    const next = typeof x === 'object' ? x : { x, y };
    if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) {
      console.warn('Rejected invalid player destination', { player: this.name, destination: next });
      this.destination = null;
      return;
    }
    this.destination = { x: next.x, y: next.y };
  }

  validatePosition(fallback = { x: this.homeX, y: this.homeY }) {
    if (Number.isFinite(this.x) && Number.isFinite(this.y)) return;
    console.warn('Reset invalid player position', { player: this.name, x: this.x, y: this.y });
    this.x = Number.isFinite(fallback.x) ? fallback.x : 0;
    this.y = Number.isFinite(fallback.y) ? fallback.y : 0;
    this.destination = null;
  }

  update(dt) {
    this.validatePosition();
    if (!this.destination) return;
    if (!Number.isFinite(this.destination.x) || !Number.isFinite(this.destination.y)) {
      console.warn('Cleared invalid player destination', { player: this.name, destination: this.destination });
      this.destination = null;
      return;
    }
    const dx = this.destination.x - this.x;
    const dy = this.destination.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0.0001) { this.destination = null; return; }
    if (distance < 3) { this.destination = null; return; }
    const step = Math.min(distance, this.speed * dt);
    this.x += (dx / distance) * step;
    this.y += (dy / distance) * step;
    this.stamina = Math.max(0, this.stamina - dt * 0.8);
    this.validatePosition();
  }
}
