export class EventUI {
  constructor() {
    this.modal = document.getElementById('modal');
    this.title = document.getElementById('modal-title');
    this.versus = document.getElementById('modal-versus');
    this.copy = document.getElementById('modal-copy');
    this.options = document.getElementById('modal-options');
    this.continue = document.getElementById('modal-continue');
    this.activeState = 'none';
  }
  portrait(player) { return `<div class="portrait"><div>${player.name}</div><small>${player.role.toUpperCase()}</small><br><small>STA ${Math.round(player.stamina)} · TP ${player.tp}</small></div>`; }
  choice(title, a, b, copy, options, cb) {
    this.activeState = title;
    this.modal.classList.remove('hidden'); this.continue.classList.add('hidden');
    this.title.textContent = title; this.copy.textContent = copy;
    this.versus.innerHTML = `${this.portrait(a)}<div class="vs">VS</div>${this.portrait(b)}`;
    this.options.innerHTML = '';
    options.forEach(opt => { const btn = document.createElement('button'); btn.textContent = opt.label; btn.onclick = () => cb(opt); this.options.append(btn); });
  }
  result(text, cb) {
    this.copy.textContent = text; this.options.innerHTML = ''; this.continue.classList.remove('hidden');
    this.continue.onclick = () => { this.activeState = 'none'; this.modal.classList.add('hidden'); cb(); };
  }
  closeAll() {
    this.activeState = 'none';
    this.modal.classList.add('hidden');
    this.options.innerHTML = '';
    this.continue.classList.add('hidden');
    this.continue.onclick = null;
  }
}
