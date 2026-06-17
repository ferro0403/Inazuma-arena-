export class SimpleAI {
  update(game) {
    this.updateOpponentCarrier(game);
    game.primaryPresser = null;
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
      const defensiveOrder = !attacking && game.ball.carrier
        ? [...team.players].filter(p => p.role !== 'goalkeeper' && !p.isStunned(game.nowMs)).sort((a, b) => Math.hypot(a.x - game.ball.carrier.x, a.y - game.ball.carrier.y) - Math.hypot(b.x - game.ball.carrier.x, b.y - game.ball.carrier.y))
        : [];
      if (defensiveOrder[0] && !game.primaryPresser) game.primaryPresser = defensiveOrder[0];

      const supportTargets = attacking && carrier ? this.supportTargets(game, team, carrier) : new Map();
      for (const p of team.players) {
        if (p.selected || p.hasBall || p.isStunned(game.nowMs)) continue;
        if (chasers.has(p)) { p.supportRole = 'loose chase'; p.setDestination(game.clamp({ x: game.ball.x, y: game.ball.y })); continue; }
        if (p.role === 'goalkeeper') {
          const collectible = game.ball.state === 'loose' || game.ball.state === 'pass' || game.ball.state === 'saved' || (game.ball.state === 'shot' && game.ball.speed < 250);
          const homeY = team.side === 'top' ? 88 : 1412;
          const inKeeperZone = collectible && Math.abs(game.ball.y - homeY) < 185 && Math.hypot(p.x - game.ball.x, p.y - game.ball.y) < game.goalkeeperCollectionRadius + 78;
          p.supportRole = inKeeperZone ? 'keeper collect' : 'keeper home';
          p.setDestination(game.clamp(inKeeperZone ? { x: game.ball.x, y: game.ball.y } : { x: 450, y: homeY }));
          continue;
        }
        let target;
        if (supportTargets.has(p)) {
          target = supportTargets.get(p);
        } else if (!attacking && game.ball.carrier) {
          target = this.defensiveTarget(game, team, p, defensiveOrder);
        } else {
          p.supportRole = 'zone';
          const dir = team.side === 'bottom' ? -1 : 1;
          target = { x: p.homeX, y: p.homeY + 35 * dir };
        }
        p.setDestination(game.clamp(target));
      }
    }
  }

  supportTargets(game, team, carrier) {
    const dir = team.side === 'bottom' ? -1 : 1;
    const mates = team.players.filter(p => p !== carrier && p.role !== 'goalkeeper' && !p.isStunned(game.nowMs));
    const roles = ['forward runner', 'side support', 'back support', 'wide option'];
    const targets = new Map();
    mates.forEach((p, index) => {
      const role = roles[index] || 'wide option';
      p.supportRole = role;
      const side = p.homeX < game.field.width / 2 ? -1 : 1;
      let target = { x: carrier.x + side * 150, y: carrier.y + dir * 120 };
      if (role === 'forward runner') target = { x: carrier.x + side * 85, y: carrier.y + dir * 250 };
      if (role === 'back support') target = { x: carrier.x - side * 95, y: carrier.y - dir * 165 };
      if (role === 'wide option') target = { x: side < 0 ? 150 : game.field.width - 150, y: carrier.y + dir * 70 };
      if (Math.hypot(target.x - carrier.x, target.y - carrier.y) < 120) target.y += dir * 80;
      const nearestOpponent = this.closestTo([...game.teams.find(t => t !== team).players], target);
      if (nearestOpponent && Math.hypot(nearestOpponent.x - target.x, nearestOpponent.y - target.y) < 105) target.x += side * 70;
      for (const other of targets.values()) if (Math.hypot(other.x - target.x, other.y - target.y) < 90) target.x += side * 55;
      targets.set(p, game.clamp(target));
    });
    return targets;
  }

  defensiveTarget(game, team, p, order) {
    const carrier = game.ball.carrier;
    const attackDir = carrier.team.side === 'bottom' ? -1 : 1;
    if (p === order[0]) {
      p.supportRole = 'primary presser';
      return { x: carrier.x, y: carrier.y + attackDir * 62 };
    }
    if (p === order[1]) {
      p.supportRole = 'cover';
      const side = p.x < carrier.x ? -1 : 1;
      return { x: carrier.x + side * 105, y: carrier.y + attackDir * 110 };
    }
    p.supportRole = 'defensive zone';
    return { x: p.homeX + (game.ball.x - p.homeX) * 0.18, y: p.homeY + (game.ball.y - p.homeY) * 0.18 };
  }

  updateOpponentCarrier(game) {
    const carrier = game.ball.carrier;
    if (!carrier || carrier.team === game.humanTeam || carrier.role === 'goalkeeper' || carrier.isStunned(game.nowMs)) return;
    if (game.nowMs < carrier.aiNextDecisionAt || game.ball.state !== 'possessed' || game.paused) return;
    carrier.aiNextDecisionAt = game.nowMs + 760;
    const goalY = game.field.height - 20;
    const distanceToGoal = goalY - carrier.y;
    const nearestOpponent = this.closestTo(game.humanTeam.players.filter(p => !p.isStunned(game.nowMs)), carrier);
    const pressure = nearestOpponent ? Math.hypot(nearestOpponent.x - carrier.x, nearestOpponent.y - carrier.y) : Infinity;
    const teammates = carrier.team.players.filter(p => p !== carrier && p.role !== 'goalkeeper' && !p.isStunned(game.nowMs));
    const ranked = teammates
      .map(p => ({ player: p, score: this.passLaneScore(game, carrier, p) }))
      .sort((a, b) => b.score - a.score);
    const openMate = ranked[0]?.player;
    game.lastPassLaneScore = Math.round(ranked[0]?.score ?? 0);

    if (distanceToGoal < 300 && pressure > 105) {
      game.aiDecision = `${carrier.name}: shot`; game.startAIShot(carrier); return;
    }
    if (openMate && (ranked[0].score > 150 || pressure < 150)) {
      game.aiDecision = `${carrier.name}: pass lane ${openMate.name}`; game.passFrom(carrier, openMate); return;
    }
    if (pressure > 175) {
      game.aiDecision = `${carrier.name}: dribble space`; carrier.setDestination(game.clamp({ x: carrier.x + (450 - carrier.x) * 0.2, y: carrier.y + 145 })); return;
    }
    const support = ranked.find(r => r.player.y < carrier.y + 80)?.player || openMate;
    if (support) { game.aiDecision = `${carrier.name}: recycle ${support.name}`; game.passFrom(carrier, support); return; }
    game.aiDecision = `${carrier.name}: hold`; carrier.setDestination(game.clamp({ x: carrier.x + (450 - carrier.x) * 0.12, y: carrier.y + 55 }));
  }

  passLaneScore(game, carrier, teammate) {
    const opponents = game.teams.find(t => t !== carrier.team).players.filter(p => !p.isStunned(game.nowMs));
    const nearestOpponent = this.nearestDistance(opponents, teammate);
    const progress = carrier.team.side === 'top' ? teammate.y - carrier.y : carrier.y - teammate.y;
    const lateral = Math.abs(teammate.x - carrier.x);
    const spacing = Math.hypot(teammate.x - carrier.x, teammate.y - carrier.y);
    const spacingBonus = spacing > 115 ? 40 : -60;
    return nearestOpponent * 0.65 + progress * 0.45 - lateral * 0.12 + spacingBonus;
  }

  closestTo(players, target) { return players.sort((a, b) => Math.hypot(a.x-target.x,a.y-target.y) - Math.hypot(b.x-target.x,b.y-target.y))[0]; }
  nearestDistance(players, target) { const p = this.closestTo([...players], target); return p ? Math.hypot(p.x-target.x, p.y-target.y) : 999; }
}
