export class SimpleAI {
  update(game) {
    for (const team of game.teams) {
      const attacking = game.ball.carrier?.team === team;
      for (const p of team.players) {
        if (p.selected || p.hasBall) continue;
        const dir = team.side === 'bottom' ? -1 : 1;
        let tx = p.homeX;
        let ty = p.homeY + (attacking ? 170 * dir : 45 * dir);
        if (!attacking && Math.abs(game.ball.y - p.homeY) < 360) {
          tx = p.homeX + (game.ball.x - p.homeX) * 0.35;
          ty = p.homeY + (game.ball.y - p.homeY) * 0.35;
        }
        if (attacking && p.role === 'field') tx += Math.sin(game.time * 1.7 + p.homeX) * 60;
        p.setDestination(game.clamp({ x: tx, y: ty }));
      }
    }
  }
}
