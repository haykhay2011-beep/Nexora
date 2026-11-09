// Generic object pool: objects are created once and recycled, so memory stays flat.
export class Pool {
  constructor(factory, size) {
    this.items = [];
    this.free = [];
    for (let i = 0; i < size; i++) {
      const o = factory(i);
      o.active = false;
      this.items.push(o);
      this.free.push(o);
    }
  }
  acquire() {
    const o = this.free.pop();
    if (!o) return null; // pool exhausted: caller just skips the spawn
    o.active = true;
    return o;
  }
  release(o) {
    if (!o.active) return;
    o.active = false;
    this.free.push(o);
  }
  releaseAll() {
    for (const o of this.items) if (o.active) this.release(o);
  }
  forEachActive(fn) {
    const items = this.items;
    for (let i = 0; i < items.length; i++) if (items[i].active) fn(items[i]);
  }
}
