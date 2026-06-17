export class HUD {
  constructor(game) {
    this.game = game;
    this.ctx = document.getElementById('minimap').getContext('2d');
    this.debug = document.getElementById('debug-readout');
    document.getElementById('debug-toggle')?.addEventListener('click', event => {
      event.preventDefault();
      this.debug.classList.toggle('collapsed');
    });
  }
  update() {
    const g = this.game, m = Math.floor(g.time / 60), s = Math.floor(g.time % 60);
    document.getElementById('timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    document.getElementById('score').textContent = `${g.teams[0].score} - ${g.teams[1].score}`;
    document.getElementById('selected-name').textContent = g.selected ? g.selected.name : 'None';
    const closest = g.ball.carrier ? 'n/a' : [...g.players]
      .filter(p => !p.isStunned(g.nowMs))
      .sort((a, b) => Math.hypot(a.x - g.ball.x, a.y - g.ball.y) - Math.hypot(b.x - g.ball.x, b.y - g.ball.y))[0]?.name || 'None';
    const outFlags = `L:${g.ball.x < 0} R:${g.ball.x > g.field.width} T:${g.ball.y < 0} B:${g.ball.y > g.field.height}`;
    this.debug.innerHTML = `state: ${g.ball.state}<br>raw: ${g.ball.x.toFixed(1)},${g.ball.y.toFixed(1)}<br>out: ${outFlags}<br>check: ${Math.round(g.lastBoundaryCheck?.x ?? 0)},${Math.round(g.lastBoundaryCheck?.y ?? 0)}<br>carrier: ${g.ball.carrier ? `${g.ball.carrier.name} ${Math.round(g.ball.carrier.x)},${Math.round(g.ball.carrier.y)}` : 'None'}<br>possessor: ${g.ball.carrier ? g.ball.carrier.name : 'None'}<br>ball: ${Math.round(g.ball.x)},${Math.round(g.ball.y)}<br>v: ${Math.round(g.ball.vx)},${Math.round(g.ball.vy)} speed:${Math.round(g.ball.speed)}<br>target: ${g.ball.target ? `${Math.round(g.ball.target.x)},${Math.round(g.ball.target.y)}` : 'None'}<br>pass: ${g.ball.lastPassType}<br>shot src: ${g.lastShotSource}<br>last touch: ${g.ball.lastTouchTeam?.name || 'None'} / ${g.ball.lastTouch?.name || 'None'}<br>boundary: ${g.lastBoundary || 'none'}<br>restart: ${g.pendingRestart?.type || 'none'}<br>match: ${g.matchState}<br>camera: ${Math.round(g.camera.x)},${Math.round(g.camera.y)}<br>selected: ${g.selected ? g.selected.name : 'None'}<br>event: ${g.ui?.activeState || 'none'}<br>AI: ${g.aiDecision || 'idle'}<br>closest: ${closest}`;
    const c = this.ctx, w = c.canvas.width, h = c.canvas.height;
    c.clearRect(0,0,w,h); c.fillStyle = '#205b31'; c.fillRect(0,0,w,h); c.strokeStyle = '#fff'; c.strokeRect(3,3,w-6,h-6);
    c.strokeStyle = '#ffffff88'; c.beginPath(); c.moveTo(0,h/2); c.lineTo(w,h/2); c.stroke();
    for (const p of g.players) { c.fillStyle = p.role === 'goalkeeper' ? p.kit.keeper : p.kit.primary; c.beginPath(); c.arc(p.x/g.field.width*w, p.y/g.field.height*h, p.hasBall ? 4 : 3, 0, Math.PI*2); c.fill(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(g.ball.x/g.field.width*w, g.ball.y/g.field.height*h, 2.5, 0, Math.PI*2); c.fill();
  }
}
