// Small promise-based worker pool for generation jobs.
import type { WorldPlan } from '../gen/planTypes';
import type { PlanRequest } from '../gen/plan';
import type { ChunkResult } from '../gen/chunk';
import type { StructureResult } from '../gen/structures';

interface Pending { resolve: (v: unknown) => void; reject: (e: unknown) => void }

export class WorkerPool {
  private workers: Worker[] = [];
  private busy: number[] = [];
  private pending = new Map<number, Pending>();
  private nextId = 1;
  readonly size: number;

  constructor(size = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 1))) {
    this.size = size;
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('../workers/gen.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (ev) => this.onMessage(i, ev.data);
      w.onerror = (ev) => console.error('worker error', ev.message);
      this.workers.push(w);
      this.busy.push(0);
    }
  }

  private onMessage(i: number, m: { id: number; ok: boolean; result?: unknown; error?: string }) {
    this.busy[i] = Math.max(0, this.busy[i] - 1);
    const p = this.pending.get(m.id);
    if (!p) return;
    this.pending.delete(m.id);
    if (m.ok) p.resolve(m.result);
    else p.reject(new Error(m.error));
  }

  private send<T>(worker: number, msg: Record<string, unknown>): Promise<T> {
    const id = this.nextId++;
    this.busy[worker]++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.workers[worker].postMessage({ ...msg, id });
    });
  }

  private leastBusy(): number {
    let best = 0;
    for (let i = 1; i < this.size; i++) if (this.busy[i] < this.busy[best]) best = i;
    return best;
  }

  get load(): number { return this.busy.reduce((a, b) => a + b, 0); }

  init(earthUrl: string) { return Promise.all(this.workers.map((_, i) => this.send<null>(i, { type: 'init', earthUrl }))); }
  plan(req: PlanRequest) { return this.send<WorldPlan>(0, { type: 'plan', req }); }
  setPlan(plan: WorldPlan) { return Promise.all(this.workers.map((_, i) => this.send<null>(i, { type: 'setPlan', plan }))); }
  chunk(key: string, cx: number, cz: number, lod: number) { return this.send<ChunkResult>(this.leastBusy(), { type: 'chunk', key, cx, cz, lod }); }
  structures(key: string) { return this.send<StructureResult>(this.size > 1 ? this.size - 1 : 0, { type: 'structures', key }); }
}
