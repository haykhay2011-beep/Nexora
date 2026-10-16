// Generation worker: plans worlds, meshes chunks, builds structures.
import { loadEarth, type EarthData } from '../geo/earth';
import { planWorld, type PlanRequest } from '../gen/plan';
import { TerrainSampler } from '../gen/terrain';
import { buildChunk } from '../gen/chunk';
import { buildStructures } from '../gen/structures';
import type { WorldPlan } from '../gen/planTypes';

let earth: EarthData | null = null;
let plan: WorldPlan | null = null;
let ts: TerrainSampler | null = null;

type Msg =
  | { id: number; type: 'init'; earthUrl: string }
  | { id: number; type: 'plan'; req: PlanRequest }
  | { id: number; type: 'setPlan'; plan: WorldPlan }
  | { id: number; type: 'chunk'; cx: number; cz: number; lod: number; key: string }
  | { id: number; type: 'structures'; key: string };

const post = (msg: unknown, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(msg, transfer);

self.onmessage = async (ev: MessageEvent<Msg>) => {
  const m = ev.data;
  try {
    switch (m.type) {
      case 'init':
        earth = await loadEarth(m.earthUrl);
        post({ id: m.id, ok: true, result: null });
        break;
      case 'plan': {
        if (!earth) throw new Error('earth not loaded');
        const p = planWorld(earth, m.req);
        post({ id: m.id, ok: true, result: p });
        break;
      }
      case 'setPlan':
        plan = m.plan;
        ts = new TerrainSampler(plan.terrain);
        post({ id: m.id, ok: true, result: null });
        break;
      case 'chunk': {
        if (!plan || !ts || plan.key !== m.key) { post({ id: m.id, ok: false, error: 'stale' }); break; }
        const c = buildChunk(plan, ts, m.cx, m.cz, m.lod);
        const transfer: Transferable[] = [c.pos.buffer, c.nor.buffer, c.col.buffer, ...c.flora.map((f) => f.data.buffer)];
        post({ id: m.id, ok: true, result: c }, dedupe(transfer));
        break;
      }
      case 'structures': {
        if (!plan || !ts || plan.key !== m.key) { post({ id: m.id, ok: false, error: 'stale' }); break; }
        const s = buildStructures(plan, ts);
        const transfer: Transferable[] = [];
        for (const g of s.groups) transfer.push(g.inst.buffer, ...arraysBuffers(g.arrays));
        for (const st of s.statics) transfer.push(...arraysBuffers(st.arrays));
        post({ id: m.id, ok: true, result: s }, dedupe(transfer));
        break;
      }
    }
  } catch (e) {
    post({ id: m.id, ok: false, error: String((e as Error)?.stack ?? e) });
  }
};

function arraysBuffers(a: { pos: Float32Array; nor: Float32Array; col: Float32Array; glow: Float32Array | null }): ArrayBuffer[] {
  const out = [a.pos.buffer, a.nor.buffer, a.col.buffer] as ArrayBuffer[];
  if (a.glow) out.push(a.glow.buffer as ArrayBuffer);
  return out;
}
function dedupe(t: Transferable[]): Transferable[] { return [...new Set(t)]; }
