export class DuelSystem {
  constructor(ui) { this.ui = ui; this.pending = false; }
  start(attacker, defender, done) {
    if (this.pending) return;
    this.pending = true;
    this.ui.choice('Duel', attacker, defender, 'Choose your move. Normal gameplay is paused.', [
      { label: 'Dribble', type: 'dribble' }, { label: 'Technique', type: 'technique' }
    ], choice => {
      if (!this.pending) return;
      const a = attacker.stats[choice.type] + Math.random() * 40;
      const d = defender.stats.tackle + Math.random() * 40;
      const attackerWins = a >= d;
      const winner = attackerWins ? attacker : defender;
      const loser = attackerWins ? defender : attacker;
      this.ui.result(`${winner.name} wins possession! ${loser.name} is stunned.`, () => {
        if (!this.pending) return;
        this.pending = false;
        done({ winner, loser });
      });
    });
  }
  cancel() { this.pending = false; }
}
