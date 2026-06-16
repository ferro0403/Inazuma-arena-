import { Player } from './Player.js';

export class Team {
  constructor(name, side, color) {
    this.name = name;
    this.side = side;
    this.color = color;
    this.score = 0;
    const left = side === 'left';
    const baseX = left ? 260 : 1340;
    const goalX = left ? 70 : 1530;
    const names = left ? ['Endo', 'Kazemaru', 'Someoka', 'Gouenji', 'Kidou'] : ['Zell', 'Reize', 'Droll', 'Heat', 'Gocker'];
    this.players = [
      new Player({ id: `${side}-gk`, name: names[0], team: this, role: 'goalkeeper', x: goalX, y: 450, homeX: goalX, homeY: 450, color, stats: { save: 62 } }),
      new Player({ id: `${side}-1`, name: names[1], team: this, role: 'field', x: baseX, y: 220, homeX: baseX, homeY: 220, color, stats: { tackle: 55 } }),
      new Player({ id: `${side}-2`, name: names[2], team: this, role: 'field', x: baseX, y: 680, homeX: baseX, homeY: 680, color, stats: { shoot: 56 } }),
      new Player({ id: `${side}-3`, name: names[3], team: this, role: 'field', x: left ? 520 : 1080, y: 340, homeX: left ? 520 : 1080, homeY: 340, color, stats: { shoot: 64, dribble: 54 } }),
      new Player({ id: `${side}-4`, name: names[4], team: this, role: 'field', x: left ? 520 : 1080, y: 560, homeX: left ? 520 : 1080, homeY: 560, color, stats: { technique: 62 } })
    ];
  }
}
