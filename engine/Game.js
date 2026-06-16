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

class Game {
  constructor() {
    this.canvas = document.getElementById('game'); this.ctx = this.canvas.getContext('2d');
    this.field = { width: 1600, height: 900 }; this.time = 0; this.paused = false;
    this.teams = [new Team('Raimon', 'left', '#2f7dff'), new Team('Alius', 'right', '#f25245')];
    this.players = this.teams.flatMap(t => t.players); this.humanTeam = this.teams[0];
    this.ball = new Ball(520, 340); this.ball.attach(this.teams[0].players[3]);
    this.camera = new Camera(this.canvas, this.field); this.ui = new EventUI();
    this.gkSystem = new GoalkeeperSystem(this.ui); this.shotSystem = new ShotSystem(this.ui, this.gkSystem); this.duelSystem = new DuelSystem(this.ui);
    this.ai = new SimpleAI(); this.hud = new HUD(this); new Input(this);
    this.select(this.ball.carrier); this.last = performance.now(); requestAnimationFrame(t => this.loop(t));
  }
  select(player) { this.players.forEach(p => p.selected = false); this.selected = player; player.selected = true; }
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
  isInOpponentGoalArea(p) { return p.x > this.field.width - 170 && p.y > 315 && p.y < 585; }
  clamp(p) { return { x: Math.max(25, Math.min(this.field.width - 25, p.x)), y: Math.max(25, Math.min(this.field.height - 25, p.y)) }; }
  loop(now) { const dt = Math.min(0.04, (now - this.last) / 1000); this.last = now; if (!this.paused) this.update(dt); this.draw(); requestAnimationFrame(t => this.loop(t)); }
  update(dt) {
    this.time += dt; this.ai.update(this, dt); this.players.forEach(p => p.update(dt)); this.ball.update(dt); this.resolveLooseBall(); this.checkDuel();
    this.camera.follow(this.ball.carrier || this.ball, dt); this.hud.update();
  }
  resolveLooseBall() {
    if (this.ball.carrier || this.ball.target) return;
    const p = this.players.find(pl => Math.hypot(pl.x - this.ball.x, pl.y - this.ball.y) < pl.radius + 12);
    if (p) { this.players.forEach(x => x.hasBall = false); this.ball.attach(p); if (p.team === this.humanTeam) this.select(p); }
  }
  checkDuel() {
    const carrier = this.ball.carrier; if (!carrier || carrier.role === 'goalkeeper') return;
    const foe = this.players.find(p => p.team !== carrier.team && p.role === 'field' && Math.hypot(p.x - carrier.x, p.y - carrier.y) < p.radius + carrier.radius + 8);
    if (!foe) return; this.paused = true; carrier.destination = null; foe.destination = null;
    this.duelSystem.start(carrier, foe, winner => { this.players.forEach(p => p.hasBall = false); this.ball.attach(winner); if (winner.team === this.humanTeam) this.select(winner); this.paused = false; });
  }
  draw() {
    const c = this.ctx, cam = this.camera; c.clearRect(0,0,this.canvas.width,this.canvas.height); c.save(); c.translate(-cam.x, -cam.y); this.drawField(c); this.drawPreview(c); this.players.forEach(p => this.drawPlayer(c,p)); this.drawBall(c); c.restore();
  }
  drawField(c) {
    c.fillStyle = '#287a3d'; c.fillRect(0,0,this.field.width,this.field.height);
    for (let x=0; x<this.field.width; x+=120) { c.fillStyle = x%240===0?'#2f8544':'#26733a'; c.fillRect(x,0,120,this.field.height); }
    c.strokeStyle = '#eaf6d6'; c.lineWidth = 5; c.strokeRect(40,40,this.field.width-80,this.field.height-80); c.beginPath(); c.moveTo(this.field.width/2,40); c.lineTo(this.field.width/2,this.field.height-40); c.stroke(); c.beginPath(); c.arc(this.field.width/2,this.field.height/2,95,0,Math.PI*2); c.stroke(); c.strokeRect(40,315,145,270); c.strokeRect(this.field.width-185,315,145,270); c.fillStyle = '#f5f5f5'; c.fillRect(0,380,40,140); c.fillRect(this.field.width-40,380,40,140);
  }
  drawPreview(c) { const p = this.preview || (this.selected?.destination && { from: this.selected, to: this.selected.destination }); if (!p) return; c.strokeStyle = '#ffe45c'; c.lineWidth = 6; c.setLineDash([16,10]); c.beginPath(); c.moveTo(p.from.x,p.from.y); c.lineTo(p.to.x,p.to.y); c.stroke(); c.setLineDash([]); }
  drawPlayer(c,p) { c.fillStyle = p.color; c.beginPath(); c.arc(p.x,p.y,p.radius,0,Math.PI*2); c.fill(); c.strokeStyle = p.selected ? '#ffe45c' : '#fff'; c.lineWidth = p.selected ? 5 : 2; c.stroke(); c.fillStyle = '#111'; c.font = '13px Trebuchet MS'; c.textAlign='center'; c.fillText(p.name,p.x,p.y-24); if (p.hasBall) { c.strokeStyle='#fff'; c.beginPath(); c.arc(p.x,p.y,p.radius+8,0,Math.PI*2); c.stroke(); } }
  drawBall(c) { c.fillStyle = '#fff'; c.beginPath(); c.arc(this.ball.x,this.ball.y,7,0,Math.PI*2); c.fill(); c.strokeStyle='#222'; c.stroke(); }
}

new Game();
