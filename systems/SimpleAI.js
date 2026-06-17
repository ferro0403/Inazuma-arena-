export class SimpleAI {
  update(game) {
    this.updateOpponentCarrier(game);
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
      const carrier = game.ball.carrier?.team === team ? game.ball.carrier : null;
      for (const p of team.players) {
        if (p.selected || p.hasBall || p.isStunned(game.nowMs)) continue;
        if (chasers.has(p)) { p.setDestination(game.clamp({ x: game.ball.x, y: game.ball.y })); continue; }
        if (p.role === 'goalkeeper') {
          const collectible = game.ball.state === 'loose' || game.ball.state === 'pass' || game.ball.state === 'saved' || (game.ball.state === 'shot' && game.ball.speed < 250);
          const homeY = team.side === 'top' ? 88 : 1412;
          const inKeeperZone = collectible && Math.abs(game.ball.y - homeY) < 185 && Math.hypot(p.x - game.ball.x, p.y - game.ball.y) < game.goalkeeperCollectionRadius + 78;
          p.setDestination(game.clamp(inKeeperZone ? { x: game.ball.x, y: game.ball.y } : { x: 450, y: homeY }));
          continue;
        }
        const dir = team.side === 'bottom' ? -1 : 1;
        let tx = p.homeX;
        let ty = p.homeY + (attacking ? 150 * dir : 35 * dir);
        if (attacking && carrier) {
          const lane = p.homeX < 450 ? -120 : 120;
          tx = carrier.x + lane;
          ty = carrier.y + (p.homeY < carrier.homeY ? -120 : 120) * (team.side === 'bottom' ? 1 : -1);
          if (p === team.players[1]) ty = carrier.y - 170 * dir; // support behind
          if (p === team.players[2]) ty = carrier.y + 230 * dir; // forward run
        } else if (!attacking && game.ball.carrier) {
          const closest = this.closestTo(team.players.filter(x => x.role !== 'goalkeeper'), game.ball.carrier);
          if (p === closest) {
            tx = game.ball.carrier.x;
            ty = game.ball.carrier.y + (team.side === 'bottom' ? 18 : -18);
          } else if (Math.abs(game.ball.y - p.homeY) < 520) {
            tx = p.homeX + (game.ball.x - p.homeX) * 0.42;
            ty = p.homeY + (game.ball.y - p.homeY) * 0.42;
          }
        }
        if (attacking) tx += Math.sin(game.time * 1.7 + p.homeX) * 45;
        p.setDestination(game.clamp({ x: tx, y: ty }));
      }
    }
  }

  updateOpponentCarrier(game) {
    const carrier = game.ball.carrier;
    if (!carrier || carrier.team === game.humanTeam || carrier.role === 'goalkeeper' || carrier.isStunned(game.nowMs)) return;
    if (game.nowMs < carrier.aiNextDecisionAt || game.ball.state !== 'possessed' || game.paused) return;
    carrier.aiNextDecisionAt = game.nowMs + 650;
    const goalY = game.field.height - 20;
    const distanceToGoal = goalY - carrier.y;
    const nearestOpponent = this.closestTo(game.humanTeam.players.filter(p => !p.isStunned(game.nowMs)), carrier);
    const pressure = nearestOpponent ? Math.hypot(nearestOpponent.x - carrier.x, nearestOpponent.y - carrier.y) : Infinity;
    const teammates = carrier.team.players.filter(p => p !== carrier && p.role !== 'goalkeeper' && !p.isStunned(game.nowMs));
    const openMate = teammates
      .map(p => ({ player: p, score: p.y - this.nearestDistance(game.humanTeam.players, p) * 0.45 - Math.abs(p.x - carrier.x) * 0.15 }))
      .sort((a, b) => b.score - a.score)[0]?.player;

    if (distanceToGoal < 310 && pressure > 85) {
      game.aiDecision = `${carrier.name}: shot`; game.startAIShot(carrier); return;
    }
    if (pressure < 105 && openMate) {
      game.aiDecision = `${carrier.name}: pass to ${openMate.name}`; game.passFrom(carrier, openMate); return;
    }
    if (openMate && openMate.y > carrier.y + 130 && Math.random() < 0.45) {
      game.aiDecision = `${carrier.name}: through pass ${openMate.name}`; game.passFrom(carrier, openMate); return;
    }
    game.aiDecision = `${carrier.name}: dribble`; carrier.setDestination(game.clamp({ x: carrier.x + (450 - carrier.x) * 0.25, y: carrier.y + 180 }));
  }

  closestTo(players, target) { return players.sort((a, b) => Math.hypot(a.x-target.x,a.y-target.y) - Math.hypot(b.x-target.x,b.y-target.y))[0]; }
  nearestDistance(players, target) { const p = this.closestTo([...players], target); return p ? Math.hypot(p.x-target.x, p.y-target.y) : 999; }
}
