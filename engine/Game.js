import { Team } from '../entities/Team.js';
import { Ball } from '../systems/Ball.js';
import { Camera } from '../systems/Camera.js';
import { Input } from '../systems/Input.js';
import { SimpleAI } from '../systems/SimpleAI.js';
import { DuelSystem } from '../systems/DuelSystem.js';
import { ShotSystem } from '../systems/ShotSystem.js';
import { GoalkeeperSystem } from '../systems/GoalkeeperSystem.js';
import { HUD } from '../ui/HUD.js';
import { EventUI } from '../ui/EventUI.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.field = { width: 900, height: 1500 };
    this.time = 0;
    this.paused = false;
    this.nowMs = performance.now();
    this.duelLockedUntil = 0;
    this.overlay = null;
    this.pendingShotOutcome = null;
    this.goalResetAt = 0;
    this.pendingDistributionAt = 0;
    this.aiDecision = 'idle';
    this.lastShotSource = 'none';
    this.tapMarker = null;
    this.pendingRestart = null;
    this.restartAt = 0;
    this.matchState = 'play';
    this.lastBoundary = 'none';
    this.lastBoundaryCheck = { x: this.field.width / 2, y: this.field.height / 2 };
    this.goalkeeperCollectionRadius = 72;
    this.carrierInsideGoalMouth = false;
    this.carrierCrossedGoalLine = false;
    this.goalTriggeredByCarrier = false;
    this.teams = [
      new Team('Raimon', 'bottom', { primary: '#ffd944', secondary: '#1d5fd0', keeper: '#39d98a' }),
      new Team('Alius', 'top', { primary: '#ee3434', secondary: '#171717', keeper: '#9f7cff' })
    ];
    this.players = this.teams.flatMap(t => t.players);
    this.humanTeam = this.teams[0];
    this.ball = new Ball(this.field.width / 2, this.field.height / 2);
    const kickoffPlayer = this.teams[0].players[3];
    kickoffPlayer.x = this.field.width / 2;
    kickoffPlayer.y = this.field.height / 2 + 38;
    kickoffPlayer.homeX = kickoffPlayer.x;
    kickoffPlayer.homeY = kickoffPlayer.y;
    this.ball.attach(kickoffPlayer);
    this.camera = new Camera(this.canvas, this.field);
    this.camera.centerOn({ x: this.field.width / 2, y: this.field.height / 2 });
    this.ui = new EventUI();
    this.gkSystem = new GoalkeeperSystem(this.ui);
    this.shotSystem = new ShotSystem(this.ui, this.gkSystem);
    this.duelSystem = new DuelSystem(this.ui);
    this.ai = new SimpleAI();
    this.hud = new HUD(this);
    new Input(this);
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.bindDebugRestartButtons();
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(320, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(240, Math.round(rect.height * dpr));
    this.ctx.imageSmoothingEnabled = false;
    const viewWidth = Math.min(620, Math.max(420, this.field.width * 0.62));
    const viewHeight = viewWidth * (this.canvas.height / this.canvas.width);
    this.camera.setViewport(viewWidth, Math.min(this.field.height, Math.max(560, viewHeight)));
    this.view = { scale: this.canvas.width / this.camera.viewportWidth, offsetX: 0, offsetY: 0 };
  }

  bindDebugRestartButtons() {
    document.getElementById('force-throw-left')?.addEventListener('click', () => this.forceBoundary('left'));
    document.getElementById('force-throw-right')?.addEventListener('click', () => this.forceBoundary('right'));
    document.getElementById('force-goal-kick')?.addEventListener('click', () => this.forceBoundary('goal_kick'));
    document.getElementById('force-corner')?.addEventListener('click', () => this.forceBoundary('corner'));
  }

  forceBoundary(type) {
    this.ball.setLoose();
    this.ball.lastTouch = this.selected || this.players[3];
    this.ball.lastTouchTeam = this.ball.lastTouch.team;
    if (type === 'left') { this.ball.x = -8; this.ball.y = this.camera.y + this.camera.viewportHeight / 2; }
    if (type === 'right') { this.ball.x = this.field.width + 8; this.ball.y = this.camera.y + this.camera.viewportHeight / 2; }
    if (type === 'goal_kick') { this.ball.x = 120; this.ball.y = -8; this.ball.lastTouchTeam = this.teams.find(t => t.side === 'bottom'); }
    if (type === 'corner') { this.ball.x = 120; this.ball.y = -8; this.ball.lastTouchTeam = this.teams.find(t => t.side === 'top'); }
    this.handleOutOfBounds();
  }

  start() {
    if (!this.players || this.players.length !== 10) throw new Error(`Kickoff expected 10 players, received ${this.players?.length ?? 0}`);
    if (!this.ball || this.ball.x === 0 || this.ball.y === 0) throw new Error('Kickoff ball was not initialized away from 0,0');
    this.select(this.ball.carrier || this.players[0]);
    this.camera.centerOn(this.ball.carrier || this.ball);
    this.validateWorldState('start');
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  }

  humanBallCarrier() {
    return this.ball.carrier?.team === this.humanTeam && !this.ball.carrier.isStunned(this.nowMs) ? this.ball.carrier : null;
  }

  select(player) {
    if (player?.isStunned(this.nowMs)) return;
    this.players.forEach(p => p.selected = false);
    this.selected = player;
    if (player) player.selected = true;
  }

  commandMove(p) {
    if (!this.selected || this.selected.isStunned(this.nowMs)) return;
    this.commandMoveTo(this.selected, p);
  }

  commandMoveTo(player, p) {
    if (!player || player.isStunned(this.nowMs)) return;
    player.idleSince = 0;
    const point = this.clampPlayerInsideField(p);
    player.setDestination(point);
    this.tapMarker = { x: point.x, y: point.y, until: this.nowMs + 500 };
    this.preview = { from: player, to: point };
  }

  dragDirectionTarget(player, start, current) {
    const dx = current.x - start.x, dy = current.y - start.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance < 0.0001) return { x: player.x, y: player.y };
    const runLength = Math.min(320, Math.max(120, distance * 1.4));
    return this.clampPlayerInsideField({ x: player.x + dx / distance * runLength, y: player.y + dy / distance * runLength });
  }

  commandMoveFromDrag(player, start, current) {
    this.commandMoveTo(player, this.dragDirectionTarget(player, start, current));
  }

  passTo(target) {
    if (!this.selected || !this.selected.hasBall || this.selected.isStunned(this.nowMs)) return;
    this.passFrom(this.selected, target);
  }

  passFrom(player, target) {
    if (!player || !player.hasBall || player.isStunned(this.nowMs)) return;
    const point = this.clamp(target);
    const type = target?.team === player.team ? 'teammate' : 'space';
    const intendedReceiver = type === 'teammate' ? target : null;
    this.ball.passTo(point, player, type, intendedReceiver);
    this.tapMarker = { x: point.x, y: point.y, until: this.nowMs + 450 };
    if (target?.team === player.team && !target.isStunned(this.nowMs)) {
      const lead = target.team.side === 'top' ? 35 : -35;
      target.setDestination(this.clamp({ x: point.x, y: point.y + lead }));
    }
  }

  shoot() {
    if (!this.selected || this.selected.isStunned(this.nowMs)) return;
    const shooter = this.selected, keeper = this.teams[1].players[0];
    this.paused = true;
    this.lastShotSource = 'user';
    this.shotSystem.start(shooter, keeper, goal => {
      this.paused = false;
      this.startShotTravel(shooter, keeper, goal);
    });
  }

  startAIShot(shooter) {
    if (!shooter || !shooter.hasBall || this.paused) return;
    const keeper = this.humanTeam.players[0];
    this.lastShotSource = 'ai';
    this.paused = true;
    this.shotSystem.start(shooter, keeper, goal => {
      this.paused = false;
      this.startShotTravel(shooter, keeper, goal);
    });
  }

  startShotTravel(shooter, keeper, goal) {
    this.pendingShotOutcome = { goal, keeper, shooterTeam: shooter.team };
    const attackingTop = shooter.team.side === 'bottom';
    const target = goal
      ? { x: this.field.width / 2, y: attackingTop ? 12 : this.field.height - 12 }
      : { x: keeper.x, y: keeper.y + (attackingTop ? 16 : -16) };
    this.ball.shootTo(this.clamp(target), shooter);
  }

  resetAfterShot(goal, scoringTeam = this.teams[0]) {
    this.matchState = 'play';
    this.players.forEach(p => { p.x = p.homeX; p.y = p.homeY; p.destination = null; p.hasBall = false; p.stunnedUntil = 0; });
    const restartTeam = goal ? this.teams.find(t => t !== scoringTeam) : this.teams[0];
    const carrier = restartTeam.players[3];
    carrier.x = this.field.width / 2;
    carrier.y = restartTeam.side === 'bottom' ? this.field.height / 2 + 38 : this.field.height / 2 - 38;
    this.ball.attach(carrier);
    this.clampBallForSafeReset('kickoff-reset');
    this.select(this.teams[0].players[3]);
    this.camera.centerOn(carrier);
  }

  isInOpponentGoalArea(p) { return p.y < 150 && p.x > 280 && p.x < 620; }
  screenToWorld(sx, sy) {
    const view = this.view || { scale: 1, offsetX: 0, offsetY: 0 };
    return this.clamp({ x: (sx - view.offsetX) / view.scale + this.camera.x, y: (sy - view.offsetY) / view.scale + this.camera.y });
  }
  clamp(p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      console.warn('Clamp received invalid point', p);
      return { x: this.field.width / 2, y: this.field.height / 2 };
    }
    return { x: Math.max(18, Math.min(this.field.width - 18, p.x)), y: Math.max(18, Math.min(this.field.height - 18, p.y)) };
  }

  validateWorldState(source = 'world') {
    this.ball.validateState();
    for (const player of this.players) {
      player.validatePosition({ x: player.homeX, y: player.homeY });
      const clamped = this.clampPlayerInsideField(player);
      if (clamped.x !== player.x || clamped.y !== player.y) {
        console.warn('Clamped player inside field', { source, player: player.name, x: player.x, y: player.y });
        player.x = clamped.x;
        player.y = clamped.y;
      }
      if (player.destination) player.setDestination(this.clampPlayerInsideField(player.destination));
    }
    this.ball.validatePosition({ x: this.field.width / 2, y: this.field.height / 2 });
    if (this.shouldClampBallForState()) this.clampBallForSafeReset('validateWorldState');
    this.camera.clamp();
  }

  clampPlayerInsideField(player) {
    return this.clamp(player);
  }

  shouldClampBallForState() {
    return this.ball.state === 'possessed' || !!this.ball.carrier || this.matchState === 'restart';
  }

  clampBallForSafeReset(source = 'safe-reset') {
    if (!Number.isFinite(this.ball.x) || !Number.isFinite(this.ball.y)) {
      console.warn('Reset invalid ball before clamp', { source, x: this.ball.x, y: this.ball.y });
      this.ball.x = this.field.width / 2;
      this.ball.y = this.field.height / 2;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.speed = 0;
      this.ball.setLoose();
      return;
    }
    const ballPoint = this.clamp(this.ball);
    this.ball.x = ballPoint.x;
    this.ball.y = ballPoint.y;
  }

  loop(now) {
    const dt = Math.min(0.04, (now - this.last) / 1000);
    this.nowMs = now;
    this.last = now;
    this.updateTimers();
    if (!this.paused) this.update(dt);
    this.draw();
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    this.time += dt;
    this.updateCarrierIdle();
    this.ai.update(this, dt);
    this.players.forEach(p => p.update(dt));
    this.ball.update(dt);
    this.handleOutOfBounds();
    this.validateWorldState('update');
    this.resolveShotTravel();
    this.resolveGoalkeeperCollection();
    this.resolveLooseBall();
    this.checkDuel();
    this.camera.follow(this.ball.carrier || this.ball || this.selected, dt);
    this.hud.update();
  }

  updateCarrierIdle() {
    const carrier = this.ball.carrier;
    if (!carrier || carrier.destination || carrier.isStunned(this.nowMs) || this.paused) return;
    if (carrier.role === 'goalkeeper') {
      if (!this.pendingDistributionAt) this.pendingDistributionAt = this.nowMs + 500;
      return;
    }
    if (!carrier.idleSince) carrier.idleSince = this.nowMs;
    if (carrier.team === this.humanTeam && this.nowMs - carrier.idleSince < 500) return;
    const dir = carrier.team.side === 'bottom' ? -1 : 1;
    carrier.setDestination(this.clamp({ x: carrier.x + (this.field.width / 2 - carrier.x) * 0.18, y: carrier.y + dir * 120 }));
  }

  updateTimers() {
    if (this.overlay?.until && this.nowMs >= this.overlay.until) this.overlay = null;
    if (this.tapMarker?.until && this.nowMs >= this.tapMarker.until) this.tapMarker = null;
    if (this.pendingDistributionAt && this.nowMs >= this.pendingDistributionAt) {
      this.pendingDistributionAt = 0;
      this.distributeFromGoalkeeper();
    }
    if (this.restartAt && this.nowMs >= this.restartAt) {
      this.restartAt = 0;
      this.executeRestart();
    }
    if (this.goalResetAt && this.nowMs >= this.goalResetAt) {
      this.goalResetAt = 0;
      this.paused = false;
      this.resetAfterShot(true, this.lastScoringTeam || this.teams[0]);
    }
  }

  handleOutOfBounds() {
    if (this.matchState === 'restart' || this.pendingRestart || this.ball.state === 'goal') return;
    const carrier = this.ball.carrier;
    const checkX = carrier ? carrier.x : this.ball.x;
    const checkY = carrier ? carrier.y : this.ball.y;
    this.lastBoundaryCheck = { x: checkX, y: checkY };
    const insideGoalMouth = checkX >= 360 && checkX <= 540;
    this.carrierInsideGoalMouth = !!carrier && insideGoalMouth;
    this.carrierCrossedGoalLine = !!carrier && insideGoalMouth && ((carrier.team.side === 'bottom' && checkY <= 20) || (carrier.team.side === 'top' && checkY >= this.field.height - 20));
    if (this.carrierCrossedGoalLine) { this.triggerGoal(carrier.team, true); return; }
    const crossedSide = checkX < 0 || checkX > this.field.width;
    const crossedTop = checkY < 0;
    const crossedBottom = checkY > this.field.height;
    if (!crossedSide && !crossedTop && !crossedBottom) return;
    if (carrier) {
      this.ball.x = checkX; this.ball.y = checkY; this.ball.lastTouch = carrier; this.ball.lastTouchTeam = carrier.team; carrier.hasBall = false; carrier.destination = null; this.ball.setLoose();
    }
    this.lastBoundary = crossedSide ? (checkX < 0 ? 'left' : 'right') : (crossedTop ? 'top' : 'bottom');
    const lastTeam = this.ball.lastTouchTeam || this.ball.lastTouch?.team || this.ball.lastKicker?.team || this.humanTeam;
    if (crossedSide) {
      const awardTeam = this.teams.find(t => t !== lastTeam);
      this.prepareRestart('throw_in', awardTeam, { x: checkX < 0 ? 18 : this.field.width - 18, y: Math.max(80, Math.min(this.field.height - 80, checkY)) });
      return;
    }
    const goalLineTeam = crossedTop ? this.teams.find(t => t.side === 'top') : this.teams.find(t => t.side === 'bottom');
    const attackingTeam = this.teams.find(t => t !== goalLineTeam);
    if (insideGoalMouth) { this.triggerGoal(attackingTeam, false); return; }
    if (lastTeam === attackingTeam) {
      this.prepareRestart('goal_kick', goalLineTeam, { x: this.field.width / 2, y: crossedTop ? 95 : this.field.height - 95 });
    } else {
      this.prepareRestart('corner', attackingTeam, { x: checkX < this.field.width / 2 ? 55 : this.field.width - 55, y: crossedTop ? 55 : this.field.height - 55 });
    }
  }

  triggerGoal(scoringTeam, byCarrier = false) {
    this.goalTriggeredByCarrier = byCarrier;
    this.matchState = 'goal';
    this.paused = true;
    this.ball.markGoal();
    scoringTeam.score++;
    this.lastScoringTeam = scoringTeam;
    this.overlay = { text: 'GOAL!', until: this.nowMs + 1000 };
    this.goalResetAt = this.nowMs + 1000;
  }

  prepareRestart(type, team, point) {
    this.matchState = 'restart';
    this.paused = true;
    this.pendingRestart = { type, team, point: this.clamp(point) };
    this.ball.setLoose();
    this.ball.vx = 0; this.ball.vy = 0; this.ball.speed = 0;
    this.ball.state = type;
    this.ball.x = this.pendingRestart.point.x;
    this.ball.y = this.pendingRestart.point.y;
    this.clampBallForSafeReset('restart-placement');
    const taker = type === 'goal_kick' ? team.players[0] : (this.nearestPlayer(team.players.filter(p => !p.isStunned(this.nowMs)), this.ball) || team.players[0]);
    taker.x = this.ball.x; taker.y = this.ball.y; taker.destination = null;
    this.ball.lastTouch = taker;
    this.overlay = { text: type === 'throw_in' ? 'THROW-IN' : type === 'goal_kick' ? 'GOAL KICK' : 'CORNER KICK', until: this.nowMs + 650 };
    this.restartAt = this.nowMs + 700;
  }

  executeRestart() {
    if (!this.pendingRestart) return;
    const { type, team } = this.pendingRestart;
    const taker = this.ball.lastTouch || team.players[0];
    this.paused = false;
    this.matchState = 'play';
    this.ball.attach(taker);
    if (type === 'goal_kick') { this.pendingDistributionAt = this.nowMs + 80; }
    else {
      const mate = team.players.find(p => p !== taker && p.role !== 'goalkeeper' && !p.isStunned(this.nowMs));
      const target = mate || { x: this.field.width / 2, y: this.field.height / 2 };
      this.ball.passTo(this.clamp(target), taker, mate ? 'teammate' : 'space');
    }
    this.pendingRestart = null;
  }

  nearestPlayer(players, target) {
    return [...players].sort((a,b) => Math.hypot(a.x-target.x,a.y-target.y) - Math.hypot(b.x-target.x,b.y-target.y))[0];
  }

  resolveShotTravel() {
    if (this.ball.state !== 'shot' || !this.pendingShotOutcome) return;
    const { goal, keeper, shooterTeam } = this.pendingShotOutcome;
    const crossedGoal = goal && (shooterTeam.side === 'bottom' ? this.ball.y <= 18 : this.ball.y >= this.field.height - 18);
    const reachedKeeper = !goal && Math.hypot(this.ball.x - keeper.x, this.ball.y - keeper.y) < 24;
    if (!crossedGoal && !reachedKeeper) return;
    this.pendingShotOutcome = null;
    if (goal) {
      this.triggerGoal(shooterTeam);
      return;
    }
    this.ball.markSaved();
    this.overlay = { text: 'SAVE!', until: this.nowMs + 700 };
    this.ball.attach(keeper);
    this.pendingDistributionAt = this.nowMs + 700;
  }

  distributeFromGoalkeeper() {
    const keeper = this.ball.carrier;
    if (!keeper || keeper.role !== 'goalkeeper') return;
    const teammates = keeper.team.players
      .filter(p => p !== keeper && !p.isStunned(this.nowMs) && (keeper.team.side === 'top' ? p.y > 210 : p.y < this.field.height - 210))
      .sort((a, b) => Math.hypot(a.x - keeper.x, a.y - keeper.y) - Math.hypot(b.x - keeper.x, b.y - keeper.y));
    const target = teammates[0] || { x: this.field.width / 2, y: this.field.height / 2 };
    this.aiDecision = `${keeper.name}: distribute`;
    this.ball.passTo(this.clamp(target), keeper, target.team ? 'teammate' : 'space');
    if (target.setDestination) target.setDestination(this.clamp({ x: target.x, y: target.y + (keeper.team.side === 'top' ? 45 : -45) }));
  }

  resolveGoalkeeperCollection() {
    const carrier = this.ball.carrier;
    if (!carrier || carrier.role === 'goalkeeper' || carrier.isStunned(this.nowMs) || this.ball.state !== 'possessed') return;
    const keeper = this.teams.find(team => team !== carrier.team)?.players[0];
    if (!keeper || keeper.isStunned(this.nowMs)) return;
    const inGoalArea = keeper.team.side === 'top' ? carrier.y < 245 : carrier.y > this.field.height - 245;
    const closeEnough = Math.hypot(this.ball.x - keeper.x, this.ball.y - keeper.y) <= this.goalkeeperCollectionRadius;
    if (!inGoalArea || !closeEnough) return;
    carrier.hasBall = false;
    carrier.destination = null;
    this.players.forEach(p => p.hasBall = false);
    this.ball.attach(keeper);
    this.pendingDistributionAt = this.nowMs + 650;
    this.aiDecision = `${keeper.name}: collected dribble`;
  }

  resolveLooseBall() {
    if (this.ball.carrier || this.ball.state === 'goal' || (this.ball.state === 'shot' && this.ball.speed > 250)) return;
    const eligible = pl => !pl.isStunned(this.nowMs) && !(pl === this.ball.lastKicker && this.nowMs < this.ball.pickupBlockedUntil);
    const pickupRadius = pl => pl.role === 'goalkeeper' ? this.goalkeeperCollectionRadius : pl.radius + 14;
    const keeper = this.players.find(pl => pl.role === 'goalkeeper' && eligible(pl) && Math.hypot(pl.x - this.ball.x, pl.y - this.ball.y) < pickupRadius(pl));
    const receiver = this.ball.intendedReceiver;
    let p = keeper || null;
    if (!p && receiver && eligible(receiver) && Math.hypot(receiver.x - this.ball.x, receiver.y - this.ball.y) < receiver.radius + 26) p = receiver;
    if (!p) p = this.players.find(pl => eligible(pl) && Math.hypot(pl.x - this.ball.x, pl.y - this.ball.y) < pickupRadius(pl));
    if (p) { this.players.forEach(x => x.hasBall = false); this.ball.attach(p); if (p.team === this.humanTeam) this.select(p); }
  }

  checkDuel() {
    const carrier = this.ball.carrier;
    if (!carrier || carrier.role === 'goalkeeper' || carrier.isStunned(this.nowMs) || this.nowMs < this.duelLockedUntil || this.nowMs < carrier.duelCooldownUntil) return;
    const foe = this.players.find(p => p.team !== carrier.team && p.role === 'field' && !p.isStunned(this.nowMs) && this.nowMs >= p.duelCooldownUntil && Math.hypot(p.x - carrier.x, p.y - carrier.y) < p.radius + carrier.radius + 8);
    if (!foe) return;
    this.paused = true;
    carrier.destination = null;
    foe.destination = null;
    this.duelSystem.start(carrier, foe, ({ winner, loser }) => this.resolveDuel(carrier, foe, winner, loser));
  }

  resolveDuel(attacker, defender, winner, loser) {
    const now = this.nowMs || performance.now();
    attacker.duelCooldownUntil = now + 1000;
    defender.duelCooldownUntil = now + 1000;
    loser.stunnedUntil = now + 1500;
    loser.destination = null;
    this.knockBackLoser(loser, winner);
    this.players.forEach(p => p.hasBall = false);
    this.ball.attach(winner);
    if (winner.team === this.humanTeam) this.select(winner);
    else if (this.selected === loser) this.select(this.players.find(p => p.team === this.humanTeam && !p.isStunned(now)) || null);
    this.duelLockedUntil = now + 300;
    this.paused = false;
  }

  knockBackLoser(loser, winner) {
    const dx = loser.x - winner.x;
    const dy = loser.y - winner.y;
    const distance = Math.hypot(dx, dy);
    const dir = Number.isFinite(distance) && distance > 0.0001 ? { x: dx / distance, y: dy / distance } : { x: 0, y: loser.team.side === 'bottom' ? 1 : -1 };
    const point = this.clamp({ x: loser.x + dir.x * 42, y: loser.y + dir.y * 42 });
    loser.x = point.x;
    loser.y = point.y;
  }

  draw() {
    const c = this.ctx, cam = this.camera;
    c.clearRect(0,0,this.canvas.width,this.canvas.height);
    c.save();
    const scale = this.canvas.width / this.camera.viewportWidth;
    const offsetX = 0;
    const offsetY = 0;
    this.view = { scale, offsetX, offsetY };
    c.translate(offsetX, offsetY);
    c.scale(scale, scale);
    c.translate(-cam.x, -cam.y);
    this.drawField(c); this.drawPreview(c); this.drawTapMarker(c); this.players.forEach(p => this.drawPlayer(c,p)); this.drawBall(c);
    c.restore();
    this.drawOverlay(c);
  }

  drawField(c) {
    c.fillStyle = '#2f8b45'; c.fillRect(0,0,this.field.width,this.field.height);
    for (let y=0; y<this.field.height; y+=90) { c.fillStyle = y%180===0?'#32934a':'#2b803f'; c.fillRect(0,y,this.field.width,90); }
    c.strokeStyle = '#eaf6d6'; c.lineWidth = 5;
    c.strokeRect(42,42,this.field.width-84,this.field.height-84);
    c.beginPath(); c.moveTo(42,this.field.height/2); c.lineTo(this.field.width-42,this.field.height/2); c.stroke();
    c.beginPath(); c.arc(this.field.width/2,this.field.height/2,82,0,Math.PI*2); c.stroke();
    c.beginPath(); c.arc(this.field.width/2,this.field.height/2,5,0,Math.PI*2); c.fillStyle = '#eaf6d6'; c.fill();
    c.strokeRect(250,42,400,170); c.strokeRect(335,42,230,82);
    c.strokeRect(250,this.field.height-212,400,170); c.strokeRect(335,this.field.height-124,230,82);
    c.fillStyle = '#f5f5f5'; c.fillRect(360,0,180,42); c.fillRect(360,this.field.height-42,180,42);
    c.fillStyle = '#d8d8d8'; c.fillRect(372,4,156,12); c.fillRect(372,this.field.height-16,156,12);
    c.strokeStyle = '#ffffff88'; c.lineWidth = 1;
    for (let x=382; x<=518; x+=18) { c.beginPath(); c.moveTo(x,4); c.lineTo(x,16); c.moveTo(x,this.field.height-16); c.lineTo(x,this.field.height-4); c.stroke(); }
  }

  drawPreview(c) {
    const p = this.preview || (this.selected?.destination && { from: this.selected, to: this.selected.destination });
    if (!p) return;
    c.strokeStyle = '#fff7a8'; c.lineWidth = 8; c.setLineDash([14,8]);
    c.beginPath(); c.moveTo(p.from.x,p.from.y); c.lineTo(p.to.x,p.to.y); c.stroke();
    c.strokeStyle = '#e0a900'; c.lineWidth = 3; c.stroke(); c.setLineDash([]);
    const angle = Math.atan2(p.to.y - p.from.y, p.to.x - p.from.x);
    c.fillStyle = '#fff7a8'; c.beginPath(); c.moveTo(p.to.x, p.to.y); c.lineTo(p.to.x - 18*Math.cos(angle-.45), p.to.y - 18*Math.sin(angle-.45)); c.lineTo(p.to.x - 18*Math.cos(angle+.45), p.to.y - 18*Math.sin(angle+.45)); c.closePath(); c.fill();
  }

  drawTapMarker(c) {
    if (!this.tapMarker) return;
    const pulse = 1 + Math.sin(this.time * 18) * 0.2;
    c.strokeStyle = '#fff06a'; c.lineWidth = 3;
    c.beginPath(); c.arc(this.tapMarker.x, this.tapMarker.y, 14 * pulse, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(this.tapMarker.x - 18, this.tapMarker.y); c.lineTo(this.tapMarker.x + 18, this.tapMarker.y); c.moveTo(this.tapMarker.x, this.tapMarker.y - 18); c.lineTo(this.tapMarker.x, this.tapMarker.y + 18); c.stroke();
  }

  drawPlayer(c,p) {
    const primary = p.role === 'goalkeeper' ? p.kit.keeper : p.kit.primary;
    const secondary = p.role === 'goalkeeper' ? '#ffffff' : p.kit.secondary;
    const stunned = p.isStunned(this.nowMs);
    const runFrame = p.destination ? Math.floor(this.time * 10) % 2 : 0;
    if (p.selected) { c.strokeStyle = '#fff56d'; c.lineWidth = 5; c.beginPath(); c.arc(p.x,p.y,p.radius+10,0,Math.PI*2); c.stroke(); }
    if (stunned) { c.strokeStyle = '#7bdcff'; c.lineWidth = 4; c.beginPath(); c.arc(p.x,p.y-38,10,0,Math.PI*2); c.stroke(); }
    c.globalAlpha = stunned ? 0.55 : 1;
    c.fillStyle = '#0b0b0b'; c.fillRect(p.x-15,p.y-29,30,42);
    c.fillStyle = '#f2c18d'; c.fillRect(p.x-8,p.y-31,16,13);
    c.fillStyle = primary; c.fillRect(p.x-13,p.y-17,26,20);
    c.fillStyle = secondary; c.fillRect(p.x-13,p.y-1,26,8);
    c.fillStyle = secondary; c.fillRect(p.x-12,p.y+6,10,10); c.fillRect(p.x+2,p.y+6,10,10);
    c.fillStyle = '#ffffff'; c.fillRect(p.x-12,p.y+16+runFrame*2,8,9); c.fillRect(p.x+4,p.y+18-runFrame*2,8,9);
    c.strokeStyle = '#101010'; c.lineWidth = 2; c.strokeRect(p.x-13,p.y-17,26,20); c.strokeRect(p.x-8,p.y-31,16,13);
    c.globalAlpha = 1;
    c.fillStyle = '#ffffff'; c.font = 'bold 13px Trebuchet MS'; c.textAlign='center'; c.strokeStyle = '#102018'; c.lineWidth = 3; c.strokeText(p.name,p.x,p.y-37); c.fillText(p.name,p.x,p.y-37);
    if (p.hasBall) { c.strokeStyle='#ffffff'; c.lineWidth = 3; c.beginPath(); c.arc(p.x,p.y,p.radius+15,0,Math.PI*2); c.stroke(); }
  }

  drawBall(c) {
    if (this.ball.state === 'shot' && this.ball.target) {
      c.strokeStyle = '#ffffff88'; c.lineWidth = 4; c.beginPath(); c.moveTo(this.ball.x, this.ball.y); c.lineTo(this.ball.x + (this.ball.x - this.ball.target.x) * 0.08, this.ball.y + (this.ball.y - this.ball.target.y) * 0.08); c.stroke();
    }
    c.fillStyle = '#0008'; c.beginPath(); c.ellipse(this.ball.x+3,this.ball.y+5,8,4,0,0,Math.PI*2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(this.ball.x,this.ball.y,8,0,Math.PI*2); c.fill();
    c.strokeStyle='#111'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = '#222'; c.lineWidth = 1; c.beginPath(); c.moveTo(this.ball.x-5,this.ball.y); c.lineTo(this.ball.x+5,this.ball.y); c.moveTo(this.ball.x,this.ball.y-5); c.lineTo(this.ball.x,this.ball.y+5); c.stroke();
  }

  drawOverlay(c) {
    if (!this.overlay) return;
    c.save();
    c.fillStyle = '#0009';
    c.fillRect(this.canvas.width / 2 - 150, this.canvas.height * 0.18 - 38, 300, 76);
    c.strokeStyle = '#fff06a';
    c.lineWidth = 4;
    c.strokeRect(this.canvas.width / 2 - 150, this.canvas.height * 0.18 - 38, 300, 76);
    c.fillStyle = '#fff06a';
    c.font = 'bold 44px Trebuchet MS';
    c.textAlign = 'center';
    c.fillText(this.overlay.text, this.canvas.width / 2, this.canvas.height * 0.18 + 16);
    c.restore();
  }
}
