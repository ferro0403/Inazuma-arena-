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
    this.field = { width: 960, height: 540 };
    this.time = 0;
    this.paused = false;
    this.teams = [
      new Team('Raimon', 'left', { primary: '#ffd944', secondary: '#1d5fd0', keeper: '#39d98a' }),
      new Team('Alius', 'right', { primary: '#ee3434', secondary: '#171717', keeper: '#9f7cff' })
    ];
    this.players = this.teams.flatMap(t => t.players);
    this.humanTeam = this.teams[0];
    this.ball = new Ball(480, 270);
    this.ball.attach(this.teams[0].players[3]);
    this.camera = new Camera(this.canvas, this.field);
    this.camera.x = 0;
    this.camera.y = 0;
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
  }

  start() {
    if (!this.players || this.players.length !== 10) {
      throw new Error(`Kickoff expected 10 players, received ${this.players?.length ?? 0}`);
    }
    if (!this.ball || this.ball.x === 0 || this.ball.y === 0) {
      throw new Error('Kickoff ball was not initialized away from 0,0');
    }
    this.select(this.ball.carrier || this.players[0]);
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
  isInOpponentGoalArea(p) { return p.x > this.field.width - 120 && p.y > 190 && p.y < 350; }
  screenToWorld(sx, sy) {
    const view = this.view || { scale: 1, offsetX: 0, offsetY: 0 };
    return this.clamp({ x: (sx - view.offsetX) / view.scale + this.camera.x, y: (sy - view.offsetY) / view.scale + this.camera.y });
  }
  clamp(p) { return { x: Math.max(18, Math.min(this.field.width - 18, p.x)), y: Math.max(18, Math.min(this.field.height - 18, p.y)) }; }
  loop(now) { const dt = Math.min(0.04, (now - this.last) / 1000); this.last = now; if (!this.paused) this.update(dt); this.draw(); requestAnimationFrame(t => this.loop(t)); }
  update(dt) {
    this.time += dt; this.ai.update(this, dt); this.players.forEach(p => p.update(dt)); this.ball.update(dt); this.resolveLooseBall(); this.checkDuel();
    this.camera.follow(this.ball.carrier || this.ball, dt); this.hud.update();
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
    const scale = Math.min(this.canvas.width / this.field.width, this.canvas.height / this.field.height);
    const offsetX = (this.canvas.width - this.field.width * scale) / 2;
    const offsetY = (this.canvas.height - this.field.height * scale) / 2;
    this.view = { scale, offsetX, offsetY };
    c.translate(offsetX, offsetY);
    c.scale(scale, scale);
    c.translate(-cam.x, -cam.y);
    this.drawField(c); this.drawPreview(c); this.players.forEach(p => this.drawPlayer(c,p)); this.drawBall(c);
    c.restore();
  }
  drawField(c) {
    c.fillStyle = '#2f8b45'; c.fillRect(0,0,this.field.width,this.field.height);
    for (let x=0; x<this.field.width; x+=64) { c.fillStyle = x%128===0?'#32934a':'#2b803f'; c.fillRect(x,0,64,this.field.height); }
    c.strokeStyle = '#eaf6d6'; c.lineWidth = 4;
    c.strokeRect(28,28,this.field.width-56,this.field.height-56);
    c.beginPath(); c.moveTo(this.field.width/2,28); c.lineTo(this.field.width/2,this.field.height-28); c.stroke();
    c.beginPath(); c.arc(this.field.width/2,this.field.height/2,58,0,Math.PI*2); c.stroke();
    c.beginPath(); c.arc(this.field.width/2,this.field.height/2,4,0,Math.PI*2); c.fillStyle = '#eaf6d6'; c.fill();
    c.strokeRect(28,170,115,200); c.strokeRect(28,220,55,100);
    c.strokeRect(this.field.width-143,170,115,200); c.strokeRect(this.field.width-83,220,55,100);
    c.fillStyle = '#f5f5f5'; c.fillRect(0,215,28,110); c.fillRect(this.field.width-28,215,28,110);
    c.fillStyle = '#c9c9c9'; c.fillRect(2,225,10,90); c.fillRect(this.field.width-12,225,10,90);
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

