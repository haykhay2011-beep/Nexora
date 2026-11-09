import { UPGRADES, upgradeCost, PAINTS, CUSTOM_PAINT_COST } from '../game/config.js';
import { DESTINATIONS } from '../world/destinations.js';

const $ = (id) => document.getElementById(id);

// Garage (upgrades + paint shop) and destination picker.
export class Garage {
  constructor(storage, audio, onChange) {
    this.storage = storage;
    this.audio = audio;
    this.onChange = onChange; // called after anything that affects the car or world
    $('btn-buy-custom').addEventListener('click', () => this.buyCustom());
    $('paint-picker').addEventListener('input', (e) => this.onChange({ previewPaint: e.target.value }));
  }

  spend(cost) {
    const d = this.storage.data;
    if (d.coins < cost) { this.audio.play('deny'); return false; }
    d.coins -= cost;
    this.audio.play('buy');
    return true;
  }

  renderGarage() {
    const d = this.storage.data;
    $('garage-coins').textContent = d.coins;
    const list = $('upgrade-list');
    list.innerHTML = '';
    for (const u of UPGRADES) {
      const lvl = d.upgrades[u.id] || 0;
      const cost = upgradeCost(u.id, lvl);
      const maxed = lvl >= u.max;
      const row = document.createElement('div');
      row.className = 'upg';
      row.innerHTML = `<b>${u.name}</b><p>${u.desc}</p><div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>`;
      const btn = document.createElement('button');
      btn.className = 'btn' + (maxed ? '' : ' primary');
      btn.textContent = maxed ? 'MAX' : `🪙 ${cost}`;
      btn.disabled = maxed || d.coins < cost;
      btn.addEventListener('click', () => {
        if (maxed || !this.spend(cost)) return;
        d.upgrades[u.id] = lvl + 1;
        this.storage.save();
        this.onChange({ upgrades: true });
        this.renderGarage();
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
    const pl = $('paint-list');
    pl.innerHTML = '';
    const all = [...PAINTS];
    for (const hex of d.paints) if (!all.some((p) => p.hex.toLowerCase() === hex.toLowerCase())) all.push({ hex, name: 'Custom', cost: CUSTOM_PAINT_COST });
    for (const p of all) {
      const owned = d.paints.some((h) => h.toLowerCase() === p.hex.toLowerCase());
      const sw = document.createElement('button');
      sw.className = 'swatch' + (owned ? '' : ' locked') + (d.paint.toLowerCase() === p.hex.toLowerCase() ? ' sel' : '');
      sw.style.background = p.hex;
      sw.dataset.cost = `🪙${p.cost}`;
      sw.textContent = p.name;
      sw.title = owned ? `Equip ${p.name}` : `Buy ${p.name} for ${p.cost} coins`;
      sw.addEventListener('mouseenter', () => this.onChange({ previewPaint: p.hex }));
      sw.addEventListener('click', () => {
        if (!owned) {
          if (!this.spend(p.cost)) return;
          d.paints.push(p.hex);
        } else this.audio.play('click');
        d.paint = p.hex;
        this.storage.save();
        this.onChange({ paint: p.hex });
        this.renderGarage();
      });
      pl.appendChild(sw);
    }
    pl.onmouseleave = () => this.onChange({ previewPaint: d.paint });
    const buy = $('btn-buy-custom');
    buy.textContent = `Buy 🪙 ${CUSTOM_PAINT_COST}`;
    buy.disabled = d.coins < CUSTOM_PAINT_COST;
  }

  buyCustom() {
    const d = this.storage.data;
    const hex = $('paint-picker').value;
    if (d.paints.some((h) => h.toLowerCase() === hex.toLowerCase())) {
      d.paint = hex; this.storage.save(); this.onChange({ paint: hex }); this.renderGarage(); return;
    }
    if (!this.spend(CUSTOM_PAINT_COST)) return;
    d.paints.push(hex);
    d.paint = hex;
    this.storage.save();
    this.onChange({ paint: hex });
    this.renderGarage();
  }

  renderDestinations() {
    const d = this.storage.data;
    $('dest-coins').textContent = d.coins;
    const list = $('dest-list');
    list.innerHTML = '';
    for (const dest of DESTINATIONS) {
      const unlocked = d.unlocked.includes(dest.id);
      const card = document.createElement('div');
      card.className = 'dest' + (d.destination === dest.id ? ' sel' : '');
      card.style.background = `linear-gradient(180deg, ${dest.sky.top}, ${dest.sky.horizon} 55%, ${dest.ground.near})`;
      const best = this.storage.bestFor(dest.id);
      card.innerHTML = `<div><b>${dest.name}</b><p>${dest.blurb}</p></div>`;
      const foot = document.createElement('div');
      foot.className = 'dest-foot';
      foot.innerHTML = `<span>${unlocked ? `Best ${best.toLocaleString()}` : '🔒 Locked'}</span>`;
      const btn = document.createElement('button');
      btn.className = 'btn' + (unlocked ? '' : ' primary');
      btn.textContent = unlocked ? (d.destination === dest.id ? 'Selected' : 'Select') : `Unlock 🪙 ${dest.unlockCost}`;
      btn.disabled = unlocked ? d.destination === dest.id : d.coins < dest.unlockCost;
      const act = (e) => {
        e.stopPropagation();
        if (!unlocked) {
          if (!this.spend(dest.unlockCost)) return;
          d.unlocked.push(dest.id);
        } else this.audio.play('click');
        d.destination = dest.id;
        this.storage.save();
        this.onChange({ destination: dest.id });
        this.renderDestinations();
      };
      btn.addEventListener('click', act);
      if (unlocked) card.addEventListener('click', act);
      foot.appendChild(btn);
      card.appendChild(foot);
      list.appendChild(card);
    }
  }
}
