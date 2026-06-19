export class GoalkeeperSystem {
  constructor(ui) { this.ui = ui; }
  start(shooter, keeper, shotPower, done) {
    if (!keeper || keeper.isStunned?.(performance.now())) {
      done(true);
      return;
    }
    this.ui.choice('Goalkeeper Event', shooter, keeper, `${keeper.name} chooses a save.`, [
      { label: 'Save', power: keeper.stats.save }, { label: 'Technique Save', power: keeper.stats.technique + 12 }
    ], choice => {
      const savePower = choice.power + Math.random() * 45;
      const goal = shotPower > savePower;
      this.ui.result(goal ? 'GOAL!' : `${keeper.name} saves it!`, () => done(goal));
    });
  }
}
