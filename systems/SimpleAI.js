export class SimpleAI {
  update(game) {
    const chasers = new Set();
    if (game.ball.state === 'loose' || game.ball.state === 'pass') {
      for (const team of game.teams) {
        team.players
          .filter(p => p.role !== 'goalkeeper' && !p.isStunned(game.nowMs))
          .sort((a, b) => Math.hypot(a.x - game.ball.x, a.y - game.ball.y) - Math.hypot(b.x - game.ball.x, b.y - game.ball.y))
          .slice(0, 2)
          .forEach(p => chasers.add(p));
      }
    }

    for (const team of game.teams) {
      const attacking = game.ball.carrier?.team === team;
      for (const p of team.players) {
        if (p.selected || p.hasBall || p.isStunned(game.nowMs)) continue;
        if (chasers.has(p)) {
          p.setDestination(game.clamp({ x: game.ball.x, y: game.ball.y }));
          continue;
        }
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
