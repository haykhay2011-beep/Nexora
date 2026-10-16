// Keyboard + touch input. Produces a steer axis (-1..1) and one-shot hop / pause
// requests. Touch: hold or tap the left/right half of the screen to steer,
// swipe up to hop.
const STEER_PULSE = 0.14; // a tap steers for at least this long (s)

export class Input {
  constructor(target) {
    this.keys = new Set();
    this.touchLeft = 0; // pointer count currently holding the left half
    this.touchRight = 0;
    this.pulseL = 0;
    this.pulseR = 0;
    this.hopQueued = false;
    this.hopBuffer = 0;
    this.pointers = new Map();
    this.onPause = null;
    this.onAnyKey = null;
    this.onMenuKey = null;
    this.isTouch = false;
    this.enabled = false; // gameplay pointer steering enabled

    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this._releaseAll();
    });

    target.addEventListener('pointerdown', (e) => this._down(e));
    target.addEventListener('pointermove', (e) => this._move(e));
    const up = (e) => this._up(e);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _key(e, down) {
    const k = e.code;
    if (e.target && e.target.tagName === 'INPUT') return;
    const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyP', 'Escape', 'Enter'].includes(k);
    if (handled && e.target && e.target.tagName === 'BUTTON' && (k === 'Space' || k === 'Enter')) return;
    if (handled) e.preventDefault();
    if (down) {
      if (e.repeat) return;
      this.keys.add(k);
      if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') this.hopBuffer = 0.14;
      if (k === 'KeyP' || k === 'Escape') this.onPause && this.onPause();
      this.onMenuKey && this.onMenuKey(k);
    } else {
      this.keys.delete(k);
    }
  }

  _down(e) {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') this.isTouch = true;
    if (!this.enabled) return;
    const left = e.clientX < window.innerWidth / 2;
    this.pointers.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: performance.now(), left, swiped: false, active: true });
    if (left) this.touchLeft++;
    else this.touchRight++;
    if (left) this.pulseL = STEER_PULSE;
    else this.pulseR = STEER_PULSE;
    try { e.target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p || !p.active) return;
    const dy = e.clientY - p.y0;
    const dx = e.clientX - p.x0;
    if (!p.swiped && dy < -44 && Math.abs(dy) > Math.abs(dx) * 1.2 && performance.now() - p.t0 < 500) {
      p.swiped = true;
      this.hopBuffer = 0.14;
      // a swipe should not also steer
      this._stopSteer(p);
    }
  }

  _stopSteer(p) {
    if (!p.active) return;
    p.active = false;
    if (p.left) this.touchLeft = Math.max(0, this.touchLeft - 1);
    else this.touchRight = Math.max(0, this.touchRight - 1);
  }

  _up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this._stopSteer(p);
    this.pointers.delete(e.pointerId);
  }

  _releaseAll() {
    this.pointers.clear();
    this.touchLeft = this.touchRight = 0;
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) this._releaseAll();
  }

  // returns { steer, hop }
  read(dt) {
    this.pulseL = Math.max(0, this.pulseL - dt);
    this.pulseR = Math.max(0, this.pulseR - dt);
    const k = this.keys;
    const l = k.has('ArrowLeft') || k.has('KeyA') || this.touchLeft > 0 || this.pulseL > 0;
    const r = k.has('ArrowRight') || k.has('KeyD') || this.touchRight > 0 || this.pulseR > 0;
    let hop = false;
    if (this.hopBuffer > 0) {
      hop = true;
      this.hopBuffer -= dt;
    }
    return { steer: (r ? 1 : 0) - (l ? 1 : 0), hop };
  }

  consumeHop() {
    this.hopBuffer = 0;
  }
}
