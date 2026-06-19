import { Player } from './Player.js';

export class Team {
  constructor(name, side, kit) {
    this.name = name;
    this.side = side;
    this.kit = kit;
    this.color = kit.primary;
    this.score = 0;
    const bottom = side === 'bottom';
    const goalY = bottom ? 1410 : 90;
    const names = bottom ? ['Endo', 'Kazemaru', 'Someoka', 'Gouenji', 'Kidou'] : ['Zell', 'Reize', 'Droll', 'Heat', 'Gocker'];
    const spots = bottom
      ? [[450, goalY], [280, 1110], [620, 1110], [360, 880], [540, 880]]
      : [[450, goalY], [280, 390], [620, 390], [360, 620], [540, 620]];
    this.players = spots.map(([x, y], index) => new Player({
      id: `${side}-${index === 0 ? 'gk' : index}`,
      name: names[index],
      team: this,
      role: index === 0 ? 'goalkeeper' : 'field',
      x,
      y,
      homeX: x,
      homeY: y,
      color: kit.primary,
      kit,
      stats: index === 0 ? { save: 62 } : [
        {},
        { tackle: 55 },
        { shoot: 56 },
        { shoot: 64, dribble: 54 },
        { technique: 62 }
      ][index]
    }));
  }
}
