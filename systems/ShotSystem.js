export class ShotSystem {
  constructor(ui, goalkeeperSystem) { this.ui = ui; this.goalkeeperSystem = goalkeeperSystem; }
  start(shooter, keeper, done) {
    this.ui.choice('Shot Event', shooter, keeper, 'Shooter vs Goalkeeper. Pick a shot.', [
      { label: 'Normal Shot', power: shooter.stats.shoot }, { label: 'Technique', power: shooter.stats.technique + 10 }
    ], choice => this.goalkeeperSystem.start(shooter, keeper, choice.power + Math.random() * 45, done));
  }
}
