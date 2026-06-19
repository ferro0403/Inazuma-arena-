export class ShotSystem {
  constructor(ui, goalkeeperSystem) { this.ui = ui; this.goalkeeperSystem = goalkeeperSystem; this.pending = false; }
  start(shooter, keeper, done, canGoalkeeperSave = true) {
    if (this.pending) return;
    this.pending = true;
    this.ui.choice('Shot Event', shooter, keeper, 'Shooter vs Goalkeeper. Pick a shot.', [
      { label: 'Normal Shot', power: shooter.stats.shoot }, { label: 'Technique', power: shooter.stats.technique + 10 }
    ], choice => {
      if (!this.pending) return;
      this.pending = false;
      const shotPower = choice.power + Math.random() * 45;
      if (!canGoalkeeperSave || keeper.isStunned(performance.now())) {
        this.ui.closeAll?.();
        done(true);
        return;
      }
      this.goalkeeperSystem.start(shooter, keeper, shotPower, done);
    });
  }
  cancel() { this.pending = false; }
}
