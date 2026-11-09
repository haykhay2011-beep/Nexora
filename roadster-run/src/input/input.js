// Keyboard + touch input. Edge-triggered actions are consumed with take*().
export class Input {
  constructor(touchRoot) {
    this.keys = new Set();
    this.steerTarget = 0;
    this.steer = 0;
    this.brakeKey = false;
    this.brakeTouch = false;
    this.brakeTaps = 0;       // presses that arrived since the brake was last released
    this._lastBrakeUp = -10;
    this._hop = false; this._boost = false; this._pause = false; this._any = false;
    this.launchHeld = false;
    this.touchSteer = 0;
    this.isTouch = false;
    this.enabled = true;
    this._touches = new Map();

    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.brakeKey = false; this.launchHeld = false; this._recalcSteer(); });

    // touch steering area covers the whole game view (buttons stop propagation)
    const el = touchRoot;
    el.addEventListener('touchstart', (e) => this._onTouch(e, 'start'), { passive: false });
    el.addEventListener('touchmove', (e) => this._onTouch(e, 'move'), { passive: false });
    el.addEventListener('touchend', (e) => this._onTouch(e, 'end'), { passive: false });
    el.addEventListener('touchcancel', (e) => this._onTouch(e, 'end'), { passive: false });
  }

  _onKey(e, down) {
    const k = e.code;
    const gameKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyB', 'KeyW', 'KeyS'];
    if (e.target && e.target.tagName === 'INPUT') return;
    if (gameKeys.includes(k)) e.preventDefault();
    if (down) {
      if (e.repeat) return;
      this.keys.add(k);
      this._any = true;
      if (k === 'Space') { this._hop = true; this.launchHeld = true; }
      if (k === 'ArrowUp' || k === 'KeyW' || k === 'ShiftLeft' || k === 'ShiftRight') this._boost = true;
      if (k === 'Escape' || k === 'KeyP') this._pause = true;
      if (k === 'ArrowDown' || k === 'KeyB' || k === 'KeyS') this._brakeDown(true);
    } else {
      this.keys.delete(k);
      if (k === 'Space') this.launchHeld = false;
      if (k === 'ArrowDown' || k === 'KeyB' || k === 'KeyS') this._brakeDown(false);
    }
    this._recalcSteer();
  }

  _brakeDown(down, touch = false) {
    const now = performance.now() / 1000;
    if (touch) this.brakeTouch = down; else this.brakeKey = down || this.keys.has('ArrowDown') || this.keys.has('KeyB') || this.keys.has('KeyS');
    if (down) {
      // tapping again quickly after releasing stacks brake power
      if (now - this._lastBrakeUp < 0.55) this.brakeTaps = Math.min(3, this.brakeTaps + 1);
      else this.brakeTaps = 1;
    } else if (!this.brake) this._lastBrakeUp = now;
  }

  get brake() { return this.brakeKey || this.brakeTouch; }

  setBrakeTouch(down) { this._brakeDown(down, true); }

  _recalcSteer() {
    const l = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const r = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    this.keySteer = (r ? 1 : 0) - (l ? 1 : 0);
  }

  _onTouch(e, type) {
    this.isTouch = true;
    if (!this.enabled) return;
    if (e.cancelable) e.preventDefault();
    const w = window.innerWidth;
    for (const t of e.changedTouches) {
      if (type === 'start') {
        this._touches.set(t.identifier, { x0: t.clientX, y0: t.clientY, t0: performance.now(), side: t.clientX < w / 2 ? -1 : 1, swiped: false });
        this.launchHeld = true;
        this._any = true;
      } else if (type === 'move') {
        const s = this._touches.get(t.identifier);
        if (s && !s.swiped && s.y0 - t.clientY > 45 && Math.abs(t.clientX - s.x0) < 80) {
          s.swiped = true;
          this._hop = true;
        }
      } else {
        this._touches.delete(t.identifier);
      }
    }
    if (this._touches.size === 0) this.launchHeld = false;
    let steer = 0;
    for (const s of this._touches.values()) if (!s.swiped) steer += s.side;
    this.touchSteer = Math.max(-1, Math.min(1, steer));
  }

  update(dt) {
    const target = (this.keySteer || 0) + this.touchSteer;
    const t = Math.max(-1, Math.min(1, target));
    const rate = t === 0 ? 10 : 7;
    this.steer += (t - this.steer) * Math.min(1, rate * dt);
    if (Math.abs(this.steer) < 0.001) this.steer = 0;
  }

  pressHop() { this._hop = true; }
  pressBoost() { this._boost = true; }
  takeHop() { const v = this._hop; this._hop = false; return v; }
  takeBoost() { const v = this._boost; this._boost = false; return v; }
  takePause() { const v = this._pause; this._pause = false; return v; }
  takeAny() { const v = this._any; this._any = false; return v; }
  clearEdges() { this._hop = this._boost = this._pause = this._any = false; }
}
