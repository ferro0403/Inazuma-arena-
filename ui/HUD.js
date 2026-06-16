export class HUD {
  constructor(game) { this.game = game; this.ctx = document.getElementById('minimap').getContext('2d'); }
  update() {
    const g = this.game, m = Math.floor(g.time / 60), s = Math.floor(g.time % 60);
    document.getElementById('timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    document.getElementById('score').textContent = `${g.teams[0].score} - ${g.teams[1].score}`;
    document.getElementById('selected-name').textContent = g.selected ? g.selected.name : 'None';
    const c = this.ctx; c.clearRect(0,0,190,110); c.fillStyle = '#205b31'; c.fillRect(0,0,190,110); c.strokeStyle = '#fff'; c.strokeRect(4,4,182,102);
    for (const p of g.players) { c.fillStyle = p.color; c.beginPath(); c.arc(p.x/g.field.width*190, p.y/g.field.height*110, 4, 0, Math.PI*2); c.fill(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(g.ball.x/g.field.width*190, g.ball.y/g.field.height*110, 3, 0, Math.PI*2); c.fill();
  }
}
