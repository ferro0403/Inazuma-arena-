export class Camera {
  constructor(canvas, field) { this.canvas = canvas; this.field = field; this.x = 0; this.y = 0; }
  follow() {
    // The mobile-first prototype scales the whole pitch into the gameplay canvas
    // so kickoff always shows players, ball and both goals clearly.
    this.x = 0;
    this.y = 0;
  }
  screenToWorld(sx, sy) { return { x: sx + this.x, y: sy + this.y }; }
}
