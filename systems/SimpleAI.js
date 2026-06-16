export class SimpleAI {
  update(game, dt) {
    for (const team of game.teams) {
      const attacking = game.ball.carrier?.team === team;
      for (const p of team.players) {
        if (p.selected || p.hasBall) continue;
        const dir = team.side === 'left' ? 1 : -1;
        let tx = p.homeX + (attacking ? 170 * dir : 40 * dir);
        let ty = p.homeY;
        if (!attacking && Math.abs(game.ball.x - p.homeX) < 330) {
          tx = p.homeX + (game.ball.x - p.homeX) * 0.35;
          ty = p.homeY + (game.ball.y - p.homeY) * 0.35;
        }
        if (attacking && p.role === 'field') ty += Math.sin(game.time * 1.7 + p.homeY) * 55;
        p.setDestination(tx, ty);
      }
    }
  }
}
