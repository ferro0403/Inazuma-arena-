import { Game } from './engine/Game.js';

function showStartupError(error) {
  console.error('Game startup failed:', error);
  const debug = document.getElementById('debug-readout');
  if (debug) {
    debug.classList.add('debug-error');
    debug.innerHTML = `STARTUP ERROR<br>${error.message}`;
  }
}

function drawFallbackScene(error) {
  showStartupError(error);
  const canvas = document.getElementById('game');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(320, Math.round(rect.width * dpr));
  canvas.height = Math.max(240, Math.round(rect.height * dpr));

  const field = { width: 900, height: 1500 };
  const viewportWidth = 560;
  const viewportHeight = viewportWidth * (canvas.height / canvas.width);
  const camera = {
    x: Math.max(0, Math.min(field.width - viewportWidth, field.width / 2 - viewportWidth / 2)),
    y: Math.max(0, Math.min(field.height - viewportHeight, field.height / 2 - viewportHeight / 2))
  };
  const scale = canvas.width / viewportWidth;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-camera.x, -camera.y);
  ctx.fillStyle = '#2f8b45';
  ctx.fillRect(0, 0, field.width, field.height);
  for (let y = 0; y < field.height; y += 90) {
    ctx.fillStyle = y % 180 === 0 ? '#32934a' : '#2b803f';
    ctx.fillRect(0, y, field.width, 90);
  }
  ctx.strokeStyle = '#eaf6d6';
  ctx.lineWidth = 5;
  ctx.strokeRect(42, 42, field.width - 84, field.height - 84);
  ctx.beginPath(); ctx.moveTo(42, field.height / 2); ctx.lineTo(field.width - 42, field.height / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(field.width / 2, field.height / 2, 82, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(250, 42, 400, 170); ctx.strokeRect(250, field.height - 212, 400, 170);
  ctx.fillStyle = '#f5f5f5'; ctx.fillRect(360, 0, 180, 42); ctx.fillRect(360, field.height - 42, 180, 42);

  const players = [
    [450,1410,'#39d98a'], [280,1110,'#ffd944'], [620,1110,'#ffd944'], [450,788,'#ffd944'], [540,880,'#ffd944'],
    [450,90,'#9f7cff'], [280,390,'#ee3434'], [620,390,'#ee3434'], [360,620,'#ee3434'], [540,620,'#ee3434']
  ];
  players.forEach(([x, y, color], index) => {
    ctx.fillStyle = color;
    ctx.fillRect(x - 13, y - 16, 26, 24);
    ctx.fillStyle = '#111';
    ctx.strokeRect(x - 13, y - 16, 26, 24);
    ctx.font = 'bold 13px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(`P${index + 1}`, x, y - 22);
  });
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(450, 788, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function boot() {
  try {
    const game = new Game();
    window.inazumaArenaGame = game;
    game.start();
  } catch (error) {
    drawFallbackScene(error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
