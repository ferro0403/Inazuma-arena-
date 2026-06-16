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
  }

  start() {
    if (!this.players || this.players.length !== 10) {
      throw new Error(`Kickoff expected 10 players, received ${this.players?.length ?? 0}`);
    }
    if (!this.ball || this.ball.x === 0 || this.ball.y === 0) {
      throw new Error('Kickoff ball was not initialized away from 0,0');
    }
    this.select(this.ball.carrier || this.players[0]);
    this.camera.centerOn(this.ball.carrier || this.ball);
    this.validateWorldState('start');
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  }

  select(player) { this.players.forEach(p => p.selected = false); this.selected = player; if (player) player.selected = true; }
  commandMove(p) { this.selected?.setDestination(this.clamp(p)); this.preview = { from: this.selected, to: p }; }
  passTo(target) { this.ball.kick(target, this.selected); }
  shoot() {
    const shooter = this.selected, keeper = this.teams[1].players[0]; this.paused = true;
    this.shotSystem.start(shooter, keeper, goal => { if (goal) this.teams[0].score++; this.resetAfterShot(goal); this.paused = false; });
  }
  resetAfterShot(goal) {
    this.players.forEach(p => { p.x = p.homeX; p.y = p.homeY; p.destination = null; p.hasBall = false; });
    const carrier = goal ? this.teams[1].players[3] : this.teams[1].players[0]; this.ball.attach(carrier); this.select(this.teams[0].players[3]);
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
    for (const player of this.players) {
      player.validatePosition({ x: player.homeX, y: player.homeY });
      const clamped = this.clamp(player);
      if (clamped.x !== player.x || clamped.y !== player.y) {
        console.warn('Clamped player inside field', { source, player: player.name, x: player.x, y: player.y });
        player.x = clamped.x;
        player.y = clamped.y;
      }
      if (player.destination) player.setDestination(this.clamp(player.destination));
    }
    this.ball.validatePosition({ x: this.field.width / 2, y: this.field.height / 2 });
    const ballPoint = this.clamp(this.ball);
    this.ball.x = ballPoint.x;
    this.ball.y = ballPoint.y;
    this.camera.clamp();
  }
  loop(now) { const dt = Math.min(0.04, (now - this.last) / 1000); this.last = now; if (!this.paused) this.update(dt); this.draw(); requestAnimationFrame(t => this.loop(t)); }
  update(dt) {
    this.time += dt; this.ai.update(this, dt); this.players.forEach(p => p.update(dt)); this.ball.update(dt); this.validateWorldState('update'); this.resolveLooseBall(); this.checkDuel();
    this.camera.follow(this.ball.carrier || this.ball || this.selected, dt); this.hud.update();
  }
  resolveLooseBall() {
    if (this.ball.carrier || this.ball.target) return;
    const p = this.players.find(pl => Math.hypot(pl.x - this.ball.x, pl.y - this.ball.y) < pl.radius + 14);
    if (p) { this.players.forEach(x => x.hasBall = false); this.ball.attach(p); if (p.team === this.humanTeam) this.select(p); }
  }
  checkDuel() {
    const carrier = this.ball.carrier; if (!carrier || carrier.role === 'goalkeeper') return;
    const foe = this.players.find(p => p.team !== carrier.team && p.role === 'field' && Math.hypot(p.x - carrier.x, p.y - carrier.y) < p.radius + carrier.radius + 8);
    if (!foe) return; this.paused = true; carrier.destination = null; foe.destination = null;
    this.duelSystem.start(carrier, foe, winner => { this.players.forEach(p => p.hasBall = false); this.ball.attach(winner); if (winner.team === this.humanTeam) this.select(winner); this.paused = false; });
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
    this.drawField(c); this.drawPreview(c); this.players.forEach(p => this.drawPlayer(c,p)); this.drawBall(c);
    c.restore();
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
    c.fillStyle = '#c9c9c9'; c.fillRect(375,4,150,12); c.fillRect(375,this.field.height-16,150,12);
  }
  drawPreview(c) { const p = this.preview || (this.selected?.destination && { from: this.selected, to: this.selected.destination }); if (!p) return; c.strokeStyle = '#ffe45c'; c.lineWidth = 5; c.setLineDash([12,7]); c.beginPath(); c.moveTo(p.from.x,p.from.y); c.lineTo(p.to.x,p.to.y); c.stroke(); c.setLineDash([]); }
  drawPlayer(c,p) {
    const primary = p.role === 'goalkeeper' ? p.kit.keeper : p.kit.primary;
    const secondary = p.role === 'goalkeeper' ? '#ffffff' : p.kit.secondary;
    if (p.selected) { c.strokeStyle = '#fff56d'; c.lineWidth = 5; c.beginPath(); c.arc(p.x,p.y,p.radius+9,0,Math.PI*2); c.stroke(); }
    c.fillStyle = '#111'; c.fillRect(p.x-9,p.y+9,18,8);
    c.fillStyle = primary; c.fillRect(p.x-13,p.y-16,26,24);
    c.fillStyle = secondary; c.fillRect(p.x-13,p.y-2,26,10);
    c.fillStyle = '#f2c18d'; c.fillRect(p.x-8,p.y-27,16,13);
    c.strokeStyle = '#101010'; c.lineWidth = 2; c.strokeRect(p.x-13,p.y-16,26,24); c.strokeRect(p.x-8,p.y-27,16,13);
    c.fillStyle = '#ffffff'; c.font = 'bold 13px Trebuchet MS'; c.textAlign='center'; c.strokeStyle = '#102018'; c.lineWidth = 3; c.strokeText(p.name,p.x,p.y-33); c.fillText(p.name,p.x,p.y-33);
    if (p.hasBall) { c.strokeStyle='#ffffff'; c.lineWidth = 3; c.beginPath(); c.arc(p.x,p.y,p.radius+14,0,Math.PI*2); c.stroke(); }
  }
  drawBall(c) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(this.ball.x,this.ball.y,8,0,Math.PI*2); c.fill(); c.strokeStyle='#111'; c.lineWidth = 2; c.stroke(); }
}

