import { Player } from './Player.js';

export class Team {
  constructor(name, side, kit) {
    this.name = name;
    this.side = side;
    this.kit = kit;
    this.color = kit.primary;
    this.score = 0;
    const left = side === 'left';
    const goalX = left ? 62 : 898;
    const names = left ? ['Endo', 'Kazemaru', 'Someoka', 'Gouenji', 'Kidou'] : ['Zell', 'Reize', 'Droll', 'Heat', 'Gocker'];
    const spots = left
      ? [[goalX, 270], [255, 170], [255, 370], [410, 230], [410, 315]]
      : [[goalX, 270], [705, 170], [705, 370], [550, 230], [550, 315]];
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
