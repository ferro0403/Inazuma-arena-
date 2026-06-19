export class SimpleAI {
  update(game) {
    this.updateOpponentCarrier(game);
    game.primaryPresser = null;
    const chasers = new Set();
    if ((game.ball.state === 'pass' || game.ball.state === 'lob_pass') && game.ball.intendedReceiver) {
      chasers.add(game.ball.intendedReceiver);
      const opponent = game.players
        .filter(p => p.team !== game.ball.intendedReceiver.team && p.role !== 'goalkeeper' && !p.isStunned(game.nowMs))
        .sort((a, b) => Math.hypot(a.x - game.ball.x, a.y - game.ball.y) - Math.hypot(b.x - game.ball.x, b.y - game.ball.y))[0];
      if (opponent) chasers.add(opponent);
    } else if (game.ball.state === 'loose' || game.ball.state === 'pass') {
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
        ? [...team.players].filter(p => (p.role !== 'goalkeeper' || !game.isGoalkeeperInOwnPenalty(p)) && !p.isStunned(game.nowMs)).sort((a, b) => Math.hypot(a.x - game.ball.carrier.x, a.y - game.ball.carrier.y) - Math.hypot(b.x - game.ball.carrier.x, b.y - game.ball.carrier.y))
        : [];
      if (defensiveOrder[0] && !game.primaryPresser) game.primaryPresser = defensiveOrder[0];

      const supportTargets = attacking && carrier ? this.supportTargets(game, team, carrier) : new Map();
      for (const p of team.players) {
        if (p.selected || p.hasBall || p.isStunned(game.nowMs) || p.manualRunActive) continue;
        if (chasers.has(p)) { const chasePoint = p === game.ball.intendedReceiver && game.ball.predictedReceivePoint ? game.ball.predictedReceivePoint : game.ball; p.supportRole = p === game.ball.intendedReceiver ? 'intended receiver' : 'loose chase'; p.setDestination(game.clamp(chasePoint), undefined, false, 'ball_recovery'); continue; }
        if (p.role === 'goalkeeper' && game.isGoalkeeperInOwnPenalty(p)) {
          const homeY = team.side === 'top' ? 88 : 1412;
          const carrierThreat = game.ball.carrier && game.ball.carrier.team !== team && game.ball.carrier.role !== 'goalkeeper';
          const inPenalty = carrierThreat && (team.side === 'top' ? game.ball.carrier.y < 285 : game.ball.carrier.y > game.field.height - 285);
          const inMouth = carrierThreat && game.ball.carrier.x >= 360 && game.ball.carrier.x <= 540;
          const lineThreat = inMouth && (team.side === 'top' ? game.ball.carrier.y < 145 : game.ball.carrier.y > game.field.height - 145);
          const rushCarrier = inPenalty && (lineThreat || Math.hypot(p.x - game.ball.carrier.x, p.y - game.ball.carrier.y) < game.goalkeeperCollectionRadius + 130);
          const collectible = game.ball.state === 'loose' || game.ball.state === 'pass' || game.ball.state === 'saved' || (game.ball.state === 'shot' && game.ball.speed < 250);
          const inKeeperZone = collectible && Math.abs(game.ball.y - homeY) < 185 && Math.hypot(p.x - game.ball.x, p.y - game.ball.y) < game.goalkeeperCollectionRadius + 78;
          p.supportRole = rushCarrier ? 'keeper rush' : (inKeeperZone ? 'keeper collect' : 'keeper home');
          p.setDestination(game.clamp(rushCarrier ? { x: game.ball.carrier.x, y: game.ball.carrier.y } : (inKeeperZone ? { x: game.ball.x, y: game.ball.y } : { x: 450, y: homeY })), undefined, false, 'defensive_ai');
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
        p.setDestination(game.clamp(target), undefined, false, attacking ? 'support_ai' : 'defensive_ai');
      }
    }
  }

  supportTargets(game, team, carrier) {
    const dir = team.side === 'bottom' ? -1 : 1;
    const mates = team.players.filter(p => p !== carrier && p.role !== 'goalkeeper' && !p.isStunned(game.nowMs));
    const targets = new Map();
    const roleAssignments = new Map(mates.map((p, index) => [p, this.supportRoleFor(p, index)]));
    if (mates.length && ![...roleAssignments.values()].includes('forward runner')) roleAssignments.set(mates[mates.length - 1], 'forward runner');
    if (mates.length > 1 && ![...roleAssignments.values()].includes('safe support')) roleAssignments.set(mates[0], 'safe support');
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
    if (player.id.endsWith('1')) return 'safe support';
    if (player.id.endsWith('2')) return 'side support';
    if (player.id.endsWith('3')) return 'wide option';
    if (player.id.endsWith('4')) return 'forward runner';
    return ['forward runner', 'side support', 'safe support', 'wide option'][fallbackIndex] || 'side support';
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
    if (role === 'safe support') return [
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
    const laneBlock = this.passLaneBlockScore(opponents, carrier, point);
    let score = nearestOpponent * 0.95 + Math.min(angleWidth, 230) * 0.28 + progress * 0.34 - laneBlock;
    if (carrierDistance < 130) score -= 110;
    if (carrierDistance > 455) score -= 65;
    if (role === 'safe support' && progress < 0) score += 75;
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
      p.supportRole = 'cover lane';
      const side = p.x < carrier.x ? -1 : 1;
      return { x: carrier.x + side * 115, y: carrier.y + attackDir * 125 };
    }
    const threats = carrier.team.players
      .filter(t => t !== carrier && t.role !== 'goalkeeper' && !t.isStunned(game.nowMs))
      .sort((a, b) => (b.y * (carrier.team.side === 'top' ? 1 : -1)) - (a.y * (carrier.team.side === 'top' ? 1 : -1)));
    const threat = threats.find(t => Math.abs(t.x - p.homeX) < 260) || threats[0];
    p.supportRole = threat ? `mark ${threat.name}` : 'defensive zone';
    const zone = { x: p.homeX + (game.ball.x - p.homeX) * 0.12, y: p.homeY + (game.ball.y - p.homeY) * 0.14 };
    if (!threat) return zone;
    return { x: zone.x * 0.62 + (threat.x + (450 - threat.x) * 0.25) * 0.38, y: zone.y * 0.66 + (threat.y + attackDir * 80) * 0.34 };
  }

  updateOpponentCarrier(game) {
    const carrier = game.ball.carrier;
    if (!carrier || carrier.team === game.humanTeam || carrier.role === 'goalkeeper' || carrier.isStunned(game.nowMs)) return;
    if (game.nowMs < carrier.aiNextDecisionAt || game.ball.state !== 'possessed' || game.paused) return;
    carrier.aiNextDecisionAt = game.nowMs + 850;
    const goalY = game.field.height - 20;
    const distanceToGoal = goalY - carrier.y;
    const nearestOpponent = this.closestTo(game.humanTeam.players.filter(p => !p.isStunned(game.nowMs)), carrier);
    const pressure = nearestOpponent ? Math.hypot(nearestOpponent.x - carrier.x, nearestOpponent.y - carrier.y) : Infinity;
    const heavyPressure = pressure < 95;
    const passCooldown = game.nowMs - (carrier.receivedAt || 0) < 650;
    const teammates = carrier.team.players.filter(p => p !== carrier && p.role !== 'goalkeeper' && !p.isStunned(game.nowMs));
    const ranked = teammates
      .map(p => ({ player: p, score: this.passLaneScore(game, carrier, p), progress: p.y - carrier.y, distance: Math.hypot(p.x - carrier.x, p.y - carrier.y) }))
      .sort((a, b) => b.score - a.score);
    const progressive = ranked.find(r => r.progress > 85 && r.score > 135);
    const diagonal = ranked.find(r => r.progress > 45 && Math.abs(r.player.x - carrier.x) > 80 && r.score > 120);
    const openMate = ranked[0];
    game.lastPassLaneScore = Math.round(openMate?.score ?? 0);

    if (distanceToGoal < 300 && pressure > 105) {
      game.aiDecision = `${carrier.name}: shot`; game.startAIShot(carrier); return;
    }
    if ((!passCooldown || heavyPressure) && progressive) {
      game.aiDecision = `${carrier.name}: forward pass ${progressive.player.name}`; game.passFrom(carrier, progressive.player); return;
    }
    if ((!passCooldown || heavyPressure) && diagonal) {
      game.aiDecision = `${carrier.name}: diagonal pass ${diagonal.player.name}`; game.passFrom(carrier, diagonal.player); return;
    }
    if (pressure > 150) {
      game.aiDecision = `${carrier.name}: vertical dribble`; carrier.setDestination(game.clamp({ x: carrier.x + (450 - carrier.x) * 0.18, y: carrier.y + 155 })); return;
    }
    if ((!passCooldown || heavyPressure) && heavyPressure && openMate) {
      game.aiDecision = `${carrier.name}: pressure release ${openMate.player.name}`; game.passFrom(carrier, openMate.player); return;
    }
    const support = ranked.find(r => r.progress > -95 && r.distance > 120)?.player;
    if (!passCooldown && support) { game.aiDecision = `${carrier.name}: support pass ${support.name}`; game.passFrom(carrier, support); return; }
    game.aiDecision = `${carrier.name}: hold forward`; carrier.setDestination(game.clamp({ x: carrier.x + (450 - carrier.x) * 0.1, y: carrier.y + 75 }));
  }

  passLaneScore(game, carrier, teammate) {
    const opponents = game.teams.find(t => t !== carrier.team).players.filter(p => !p.isStunned(game.nowMs));
    const nearestOpponent = this.nearestDistance(opponents, teammate);
    const progress = carrier.team.side === 'top' ? teammate.y - carrier.y : carrier.y - teammate.y;
    const lateral = Math.abs(teammate.x - carrier.x);
    const spacing = Math.hypot(teammate.x - carrier.x, teammate.y - carrier.y);
    const spacingBonus = spacing > 115 ? 40 : -60;
    return nearestOpponent * 0.62 + progress * 0.85 - lateral * 0.1 + spacingBonus;
  }


  passLaneBlockScore(opponents, from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const lengthSq = Math.max(1, dx * dx + dy * dy);
    return opponents.reduce((penalty, opponent) => {
      const t = Math.max(0, Math.min(1, ((opponent.x - from.x) * dx + (opponent.y - from.y) * dy) / lengthSq));
      const px = from.x + dx * t, py = from.y + dy * t;
      const distance = Math.hypot(opponent.x - px, opponent.y - py);
      return distance < 90 ? penalty + (90 - distance) * 1.4 : penalty;
    }, 0);
  }

  closestTo(players, target) { return players.sort((a, b) => Math.hypot(a.x-target.x,a.y-target.y) - Math.hypot(b.x-target.x,b.y-target.y))[0]; }
  nearestDistance(players, target) { const p = this.closestTo([...players], target); return p ? Math.hypot(p.x-target.x, p.y-target.y) : 999; }
}
