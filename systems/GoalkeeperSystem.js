export class GoalkeeperSystem {
  constructor(ui) { this.ui = ui; this.pending = false; }
  start(shooter, keeper, shotPower, done) {
    if (this.pending) return;
    if (!keeper || keeper.isStunned?.(performance.now())) {
      done(true);
      return;
    }
    this.pending = true;
    this.ui.choice('Goalkeeper Event', shooter, keeper, `${keeper.name} chooses a save.`, [
      { label: 'Save', power: keeper.stats.save }, { label: 'Technique Save', power: keeper.stats.technique + 12 }
    ], choice => {
      if (!this.pending) return;
      this.pending = false;
      const savePower = choice.power + Math.random() * 45;
      const goal = shotPower > savePower;
      this.ui.result(goal ? 'GOAL!' : `${keeper.name} saves it!`, () => done(goal));
    });
  }
  cancel() { this.pending = false; }
}
