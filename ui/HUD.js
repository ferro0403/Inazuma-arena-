export class HUD {
  constructor(game) {
    this.game = game;
    this.ctx = document.getElementById('minimap').getContext('2d');
    this.debug = document.getElementById('debug-readout');
  }
  update() {
    const g = this.game, m = Math.floor(g.time / 60), s = Math.floor(g.time % 60);
    document.getElementById('timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    document.getElementById('score').textContent = `${g.teams[0].score} - ${g.teams[1].score}`;
    document.getElementById('selected-name').textContent = g.selected ? g.selected.name : 'None';
    this.debug.innerHTML = `players: ${g.players.length}<br>ball: ${Math.round(g.ball.x)},${Math.round(g.ball.y)}<br>camera: ${Math.round(g.camera.x)},${Math.round(g.camera.y)}<br>selected: ${g.selected ? g.selected.name : 'None'}`;
    const c = this.ctx, w = c.canvas.width, h = c.canvas.height;
    c.clearRect(0,0,w,h); c.fillStyle = '#205b31'; c.fillRect(0,0,w,h); c.strokeStyle = '#fff'; c.strokeRect(3,3,w-6,h-6);
    for (const p of g.players) { c.fillStyle = p.role === 'goalkeeper' ? p.kit.keeper : p.kit.primary; c.beginPath(); c.arc(p.x/g.field.width*w, p.y/g.field.height*h, 3, 0, Math.PI*2); c.fill(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(g.ball.x/g.field.width*w, g.ball.y/g.field.height*h, 2.5, 0, Math.PI*2); c.fill();
  }
}
