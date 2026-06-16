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

  const field = { width: 960, height: 540 };
  const scale = Math.min(canvas.width / field.width, canvas.height / field.height);
  const offsetX = (canvas.width - field.width * scale) / 2;
  const offsetY = (canvas.height - field.height * scale) / 2;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#2f8b45';
  ctx.fillRect(0, 0, field.width, field.height);
  for (let x = 0; x < field.width; x += 64) {
    ctx.fillStyle = x % 128 === 0 ? '#32934a' : '#2b803f';
    ctx.fillRect(x, 0, 64, field.height);
  }
  ctx.strokeStyle = '#eaf6d6';
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, field.width - 56, field.height - 56);
  ctx.beginPath(); ctx.moveTo(field.width / 2, 28); ctx.lineTo(field.width / 2, field.height - 28); ctx.stroke();
  ctx.beginPath(); ctx.arc(field.width / 2, field.height / 2, 58, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(28, 170, 115, 200); ctx.strokeRect(field.width - 143, 170, 115, 200);
  ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, 215, 28, 110); ctx.fillRect(field.width - 28, 215, 28, 110);

  const players = [
    [62,270,'#39d98a'], [255,170,'#ffd944'], [255,370,'#ffd944'], [410,230,'#ffd944'], [410,315,'#ffd944'],
    [898,270,'#9f7cff'], [705,170,'#ee3434'], [705,370,'#ee3434'], [550,230,'#ee3434'], [550,315,'#ee3434']
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
  ctx.beginPath(); ctx.arc(480, 270, 8, 0, Math.PI * 2); ctx.fill();
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
