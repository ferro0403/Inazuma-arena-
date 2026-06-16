export class Input {
  constructor(game) {
    this.game = game; this.dragging = false;
    game.canvas.addEventListener('pointerdown', e => this.down(e));
    game.canvas.addEventListener('pointermove', e => this.move(e));
    game.canvas.addEventListener('pointerup', e => this.up(e));
  }
  pos(e) { const r = this.game.canvas.getBoundingClientRect(); return this.game.screenToWorld((e.clientX - r.left) * this.game.canvas.width / r.width, (e.clientY - r.top) * this.game.canvas.height / r.height); }
  down(e) { if (this.game.paused) return; this.dragging = true; this.start = this.pos(e); this.handleTap(this.start, false); }
  move(e) { if (!this.dragging || this.game.paused || !this.game.selected) return; this.game.preview = { from: this.game.selected, to: this.pos(e) }; }
  up(e) { if (this.game.paused) return; const p = this.pos(e); if (this.dragging && this.game.selected && Math.hypot(p.x - this.start.x, p.y - this.start.y) > 20) this.game.commandMove(p); this.dragging = false; this.game.preview = null; }
  handleTap(p) {
    const hit = this.game.players.find(pl => Math.hypot(pl.x - p.x, pl.y - p.y) < pl.radius + 10);
    if (hit && hit.team === this.game.humanTeam) {
      if (this.game.selected?.hasBall && hit !== this.game.selected) this.game.passTo(hit);
      else this.game.select(hit);
      return;
    }
    if (!this.game.selected) return;
    if (this.game.selected.hasBall && this.game.isInOpponentGoalArea(p)) this.game.shoot();
    else if (this.game.selected.hasBall) this.game.passTo(p);
    else this.game.commandMove(p);
  }
}
