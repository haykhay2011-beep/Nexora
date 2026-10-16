// Keyboard + mouse input with pointer lock.
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  clicked = false;
  locked = false;
  enabled = true;
  sensitivity = 1;
  invertY = false;
  onUnlock: (() => void) | null = null;

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (e.code === 'Tab') e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.clicked = true;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.el;
      if (was && !this.locked) this.onUnlock?.();
    });
  }

  lock() {
    if (this.locked) return;
    try {
      const p = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* pointer lock unavailable (e.g. headless) */ }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  isDown(code: string) { return this.enabled && this.down.has(code); }
  held(code: string) { return this.down.has(code); }
  wasPressed(code: string) { return this.pressed.has(code); }
  consume(code: string) { const p = this.pressed.has(code); this.pressed.delete(code); return p; }
  endFrame() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0; this.clicked = false; }
  clear() { this.down.clear(); this.pressed.clear(); }
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
