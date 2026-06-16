export class DuelSystem {
  constructor(ui) { this.ui = ui; }
  start(attacker, defender, done) {
    this.ui.choice('Duel', attacker, defender, 'Choose your move. Normal gameplay is paused.', [
      { label: 'Dribble', type: 'dribble' }, { label: 'Technique', type: 'technique' }
    ], choice => {
      const a = attacker.stats[choice.type] + Math.random() * 40;
      const d = defender.stats.tackle + Math.random() * 40;
      const winner = a >= d ? attacker : defender;
      this.ui.result(`${winner.name} wins possession!`, () => done(winner));
    });
  }
}
