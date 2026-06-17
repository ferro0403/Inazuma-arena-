export class Input {
  constructor(game) {
    this.game = game;
    this.dragging = false;
    this.didDrag = false;
    this.dragThreshold = 18;
    game.canvas.addEventListener('pointerdown', e => this.down(e));
    game.canvas.addEventListener('pointermove', e => this.move(e));
    game.canvas.addEventListener('pointerup', e => this.up(e));
    game.canvas.addEventListener('pointercancel', () => this.cancel());
  }
  pos(e) { const r = this.game.canvas.getBoundingClientRect(); return this.game.screenToWorld((e.clientX - r.left) * this.game.canvas.width / r.width, (e.clientY - r.top) * this.game.canvas.height / r.height); }
  playerAt(p) { return this.game.players.find(pl => !pl.isStunned(this.game.nowMs) && Math.hypot(pl.x - p.x, pl.y - p.y) < pl.radius + 12); }
  down(e) {
    if (this.game.paused) return;
    this.dragging = true; this.didDrag = false; this.start = this.pos(e); this.current = this.start;
    const hit = this.playerAt(this.start);
    this.dragPlayer = hit?.team === this.game.humanTeam ? hit : null;
    if (this.dragPlayer) this.game.select(this.dragPlayer);
  }
  move(e) {
    if (!this.dragging || this.game.paused) return;
    this.current = this.pos(e);
    const dist = Math.hypot(this.current.x - this.start.x, this.current.y - this.start.y);
    if (this.dragPlayer && dist > this.dragThreshold) {
      this.didDrag = true;
      this.game.preview = { from: this.dragPlayer, to: this.game.dragDirectionTarget(this.dragPlayer, this.start, this.current) };
    }
  }
  up(e) {
    if (this.game.paused || !this.dragging) return this.cancel();
    const p = this.pos(e);
    if (this.didDrag && this.dragPlayer) this.game.commandMoveFromDrag(this.dragPlayer, this.start, p);
    else this.handleTap(p);
    this.cancel();
  }
  cancel() { this.dragging = false; this.didDrag = false; this.dragPlayer = null; this.start = null; this.current = null; this.game.preview = null; }
  handleTap(p) {
    const carrier = this.game.selected?.hasBall ? this.game.selected : null;
    const hit = this.playerAt(p);
    if (carrier) {
      if (this.game.isInOpponentGoalArea(p)) { this.game.shoot(); return; }
      if (hit && hit.team === carrier.team && hit !== carrier) { this.game.passTo(hit); return; }
      this.game.passTo(p);
      return;
    }
    if (hit && hit.team === this.game.humanTeam) this.game.select(hit);
  }
}
