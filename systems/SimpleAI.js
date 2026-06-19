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
    const targets = new Map();
    const roleAssignments = new Map(mates.map((p, index) => [p, this.supportRoleFor(p, index)]));
    if (mates.length && ![...roleAssignments.values()].includes('forward runner')) roleAssignments.set(mates[mates.length - 1], 'forward runner');
    if (mates.length > 1 && ![...roleAssignments.values()].includes('back support')) roleAssignments.set(mates[0], 'back support');
    let bestScore = -Infinity;
    mates.forEach((p) => {
      const role = roleAssignments.get(p);
      p.supportRole = role;
      const candidates = this.supportCandidates(game, carrier, p, role, dir);
      let best = candidates[0];
      let bestCandidateScore = -Infinity;
      for (const candidate of candidates) {
        const clamped = game.clamp(candidate);
        const score = this.supportScore(game, carrier, p, clamped, role, targets);
        if (score > bestCandidateScore) { bestCandidateScore = score; best = clamped; }
      }
      p.supportScore = Math.round(bestCandidateScore);
      bestScore = Math.max(bestScore, bestCandidateScore);
      targets.set(p, best);
    });
    if (Number.isFinite(bestScore)) game.lastPassLaneScore = Math.round(bestScore);
    return targets;
  }

  supportRoleFor(player, fallbackIndex) {
    if (player.id.endsWith('1')) return 'back support';
    if (player.id.endsWith('2')) return 'side support';
    if (player.id.endsWith('3')) return 'wide option';
    if (player.id.endsWith('4')) return 'forward runner';
    return ['forward runner', 'side support', 'back support', 'wide option'][fallbackIndex] || 'side support';
  }

  supportCandidates(game, carrier, player, role, dir) {
    const side = player.homeX < game.field.width / 2 ? -1 : 1;
    const wave = Math.sin(game.time * 1.8 + player.homeX * 0.01) * 28;
    const wingX = side < 0 ? 135 : game.field.width - 135;
    if (role === 'forward runner') return [
      { x: carrier.x + side * 120, y: carrier.y + dir * 285 },
      { x: carrier.x - side * 80, y: carrier.y + dir * 245 },
      { x: wingX, y: carrier.y + dir * 220 }
    ];
    if (role === 'wide option') return [
      { x: wingX, y: carrier.y + dir * 95 + wave },
      { x: wingX, y: carrier.y + dir * 170 },
      { x: carrier.x + side * 210, y: carrier.y + dir * 80 }
    ];
    if (role === 'back support') return [
      { x: carrier.x - side * 105, y: carrier.y - dir * 165 },
      { x: game.field.width / 2 + side * 125, y: carrier.y - dir * 125 },
      { x: player.homeX, y: carrier.y - dir * 190 }
    ];
    return [
      { x: carrier.x + side * 170, y: carrier.y + dir * 45 + wave },
      { x: carrier.x - side * 155, y: carrier.y + dir * 80 },
      { x: game.field.width / 2 + side * 180, y: carrier.y + dir * 125 }
    ];
  }

  supportScore(game, carrier, player, point, role, existingTargets) {
    const opponents = game.teams.find(t => t !== carrier.team).players.filter(p => !p.isStunned(game.nowMs));
    const nearestOpponent = this.nearestDistance(opponents, point);
    const progress = carrier.team.side === 'top' ? point.y - carrier.y : carrier.y - point.y;
    const carrierDistance = Math.hypot(point.x - carrier.x, point.y - carrier.y);
    const angleWidth = Math.abs(point.x - carrier.x);
    let score = nearestOpponent * 0.75 + progress * 0.42 + Math.min(angleWidth, 230) * 0.2;
    if (carrierDistance < 115) score -= 90;
    if (carrierDistance > 430) score -= 55;
    if (role === 'back support' && progress < 0) score += 75;
    if (role === 'wide option' && (point.x < 190 || point.x > game.field.width - 190)) score += 65;
    if (role === 'forward runner' && progress > 175) score += 80;
    for (const other of existingTargets.values()) {
      const d = Math.hypot(other.x - point.x, other.y - point.y);
      if (d < 105) score -= (105 - d) * 1.3;
    }
    return score;
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
