import * as THREE from 'three';
import { JOURNAL, RELICS } from './content.js';
import { shardModel, scrollModel, relicModel, clamModel, plaqueModel } from './Models.js';
import { SHARD_COLORS, SHARD_NAMES, SHARD_IDS } from '../world/config.js';
import { heightAt } from '../world/Terrain.js';

const PEARL_RADIUS = 0.2;

// Every collectible in the world: pearls, clams, journal pages, carvings, relics and crystal shards.
export class Items {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.pearls = [];
    this.clams = [];
    this.pages = [];
    this.relics = [];
    this.shards = [];
    this.carvings = [];
    this.pearlCount = 0;
    this.clamCount = 0;
    this.time = 0;
  }

  get state() { return this.game.state; }

  // ---- Pearls (instanced) ----
  addPearl(x, y, z) {
    const id = `pearl:${this.pearlCount++}`;
    if (y === undefined || y === null) y = heightAt(x, z) + 0.45;
    this.pearls.push({ id, pos: new THREE.Vector3(x, y, z), taken: false, index: this.pearls.length });
    return id;
  }

  addPearlTrail(points, spacing = 4) {
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, z0] = points[i], [x1, z1] = points[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.floor(len / spacing));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        this.addPearl(x0 + (x1 - x0) * t, null, z0 + (z1 - z0) * t);
      }
    }
  }

  addClam(x, y, z, ry = 0, pearls = 5, scale = 0.9) {
    const id = `clam:${this.clamCount++}`;
    if (y === undefined || y === null) y = heightAt(x, z) + 0.2 * scale;
    const model = clamModel(scale, [0x8a7aa8, 0x7aa8a0, 0xa88a7a][this.clamCount % 3]);
    model.position.set(x, y, z);
    model.rotation.y = ry;
    this.scene.add(model);
    const clam = { id, model, pearls, open: false, t: 0 };
    this.clams.push(clam);
    clam.handle = this.game.interact.add({
      pos: new THREE.Vector3(x, y + 0.4, z),
      radius: 3.2,
      prompt: 'Open clam',
      enabled: () => !clam.open,
      onUse: () => this.openClam(clam),
    });
    return id;
  }

  openClam(clam, silent = false) {
    clam.open = true;
    this.state.collected.add(clam.id);
    if (!silent) {
      this.state.pearls += clam.pearls;
      this.game.ui.toast(`+${clam.pearls} pearls`, 'pearl');
      this.game.audio.play('clam');
      this.game.audio.play('pearl');
    }
  }

  addPage(journalId, x, y, z, ry = 0) {
    const id = `page:${journalId}`;
    if (y === undefined || y === null) y = heightAt(x, z) + 0.6;
    const model = scrollModel();
    model.position.set(x, y, z);
    model.rotation.y = ry;
    this.scene.add(model);
    const page = { id, journalId, model, taken: false, baseY: y };
    this.pages.push(page);
    page.handle = this.game.interact.add({
      pos: model.position,
      radius: 3.2,
      prompt: () => `Read: ${JOURNAL[journalId].title}`,
      enabled: () => !page.taken,
      onUse: () => this.takePage(page),
    });
    return id;
  }

  takePage(page, silent = false) {
    page.taken = true;
    page.model.visible = false;
    this.state.collected.add(page.id);
    this.state.journal.add(page.journalId);
    if (!silent) {
      this.game.audio.play('page');
      this.game.ui.showReader(page.journalId, true);
    }
  }

  // A carving stays in the world; reading it adds it to the journal.
  addCarving(journalId, x, y, z, ry = 0, w = 2.2, h = 1.6, model = true) {
    let mesh = null;
    if (model) {
      mesh = plaqueModel(w, h);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      this.scene.add(mesh);
    }
    const front = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(0.8).add(new THREE.Vector3(x, y, z));
    const c = { journalId, mesh };
    this.carvings.push(c);
    this.game.interact.add({
      pos: front,
      radius: 3.4,
      prompt: () => (this.state.journal.has(journalId) ? 'Read carving again' : 'Read carving'),
      onUse: () => {
        const isNew = !this.state.journal.has(journalId);
        this.state.journal.add(journalId);
        this.game.audio.play('page');
        this.game.ui.showReader(journalId, isNew);
      },
    });
    return c;
  }

  addRelic(relicId, x, y, z) {
    const def = RELICS[relicId];
    const id = `relic:${relicId}`;
    if (y === undefined || y === null) y = heightAt(x, z) + 0.6;
    const model = relicModel(def.shape, def.color);
    model.position.set(x, y, z);
    this.scene.add(model);
    const relic = { id, relicId, model, taken: false, baseY: y };
    this.relics.push(relic);
    this.game.interact.add({
      pos: model.position,
      radius: 3,
      prompt: `Take ${def.name}`,
      enabled: () => !relic.taken,
      onUse: () => this.takeRelic(relic),
    });
    return id;
  }

  takeRelic(relic, silent = false) {
    relic.taken = true;
    relic.model.visible = false;
    this.state.collected.add(relic.id);
    this.state.relics.add(relic.relicId);
    if (!silent) {
      const def = RELICS[relic.relicId];
      this.game.audio.play('relic');
      this.game.ui.toast(`Relic found: ${def.name}`, 'relic', def.desc);
      if (this.game.base) this.game.base.refreshDisplay();
    }
  }

  // Shards may start hidden; a puzzle calls reveal().
  addShard(shardId, x, y, z, { hidden = false } = {}) {
    const color = SHARD_COLORS[shardId];
    const model = shardModel(color);
    model.position.set(x, y, z);
    model.visible = !hidden;
    this.scene.add(model);
    const shard = { id: `shard:${shardId}`, shardId, model, taken: false, revealed: !hidden, baseY: y };
    this.shards.push(shard);
    shard.light = this.game.world.addLight({
      pos: model.position, color, intensity: 30, distance: 18,
      active: () => shard.revealed && !shard.taken,
    });
    this.game.interact.add({
      pos: model.position,
      radius: 3.4,
      prompt: `Take the ${SHARD_NAMES[shardId]}`,
      enabled: () => shard.revealed && !shard.taken,
      onUse: () => this.takeShard(shard),
      priority: 2,
    });
    shard.reveal = () => {
      if (shard.revealed) return;
      shard.revealed = true;
      model.visible = !shard.taken;
      shard.revealT = 0;
    };
    return shard;
  }

  takeShard(shard, silent = false) {
    shard.taken = true;
    shard.model.visible = false;
    this.state.collected.add(shard.id);
    this.state.shards.add(shard.shardId);
    if (!silent) this.game.onShardCollected(shard.shardId);
  }

  shardById(shardId) {
    return this.shards.find((s) => s.shardId === shardId);
  }

  finalize() {
    const geo = new THREE.SphereGeometry(PEARL_RADIUS, 10, 8);
    const mat = new THREE.MeshPhongMaterial({ color: 0xfff6f4, emissive: 0x6a5060, shininess: 100, specular: 0xffffff });
    this.pearlMesh = new THREE.InstancedMesh(geo, mat, Math.max(1, this.pearls.length));
    this.pearlMesh.frustumCulled = false;
    const glowGeo = new THREE.SphereGeometry(0.55, 8, 6);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe6f2, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false });
    this.pearlGlow = new THREE.InstancedMesh(glowGeo, glowMat, Math.max(1, this.pearls.length));
    this.pearlGlow.frustumCulled = false;
    this.scene.add(this.pearlMesh, this.pearlGlow);
    this.refreshPearls();
  }

  refreshPearls() {
    const m = new THREE.Matrix4();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const p of this.pearls) {
      if (p.taken) {
        this.pearlMesh.setMatrixAt(p.index, zero);
        this.pearlGlow.setMatrixAt(p.index, zero);
      } else {
        m.makeTranslation(p.pos.x, p.pos.y + Math.sin(this.time * 2 + p.index) * 0.08, p.pos.z);
        this.pearlMesh.setMatrixAt(p.index, m);
        this.pearlGlow.setMatrixAt(p.index, m);
      }
    }
    this.pearlMesh.instanceMatrix.needsUpdate = true;
    this.pearlGlow.instanceMatrix.needsUpdate = true;
  }

  // Apply a loaded save: hide/open everything already collected.
  applyState() {
    const col = this.state.collected;
    for (const p of this.pearls) p.taken = col.has(p.id);
    for (const c of this.clams) if (col.has(c.id)) { this.openClam(c, true); c.t = 1; }
    for (const p of this.pages) if (col.has(p.id)) this.takePage(p, true);
    for (const r of this.relics) if (col.has(r.id)) this.takeRelic(r, true);
    for (const s of this.shards) if (col.has(s.id) || this.state.shards.has(s.shardId)) this.takeShard(s, true);
    this.refreshPearls();
  }

  update(dt, playerPos) {
    this.time += dt;
    // pearls: magnet + auto collect
    let changed = false;
    for (const p of this.pearls) {
      if (p.taken) continue;
      const d = p.pos.distanceTo(playerPos);
      if (d < 3.2) {
        p.pos.lerp(playerPos, Math.min(1, dt * (5 / Math.max(d, 0.4))));
        changed = true;
        if (d < 1.0) {
          p.taken = true;
          this.state.collected.add(p.id);
          this.state.pearls += 1;
          this.game.audio.play('pearl');
          this.game.ui.pearlPing();
        }
      }
    }
    if (changed || ((this.time * 10) | 0) % 2 === 0) this.refreshPearls();

    for (const c of this.clams) {
      if (c.open && c.t < 1) c.t = Math.min(1, c.t + dt * 1.5);
      c.model.userData.hinge.rotation.x = -c.t * 1.0;
      c.model.userData.pearl.visible = !c.open || c.t < 0.6;
    }
    for (const p of this.pages) {
      if (p.taken) continue;
      p.model.position.y = p.baseY + Math.sin(this.time * 1.5 + p.baseY) * 0.12;
      p.model.rotation.y += dt * 0.5;
    }
    for (const r of this.relics) {
      if (r.taken) continue;
      r.model.position.y = r.baseY + Math.sin(this.time * 1.3 + r.baseY) * 0.1;
      r.model.rotation.y += dt * 0.7;
    }
    for (const s of this.shards) {
      if (!s.revealed || s.taken) continue;
      if (s.revealT !== undefined && s.revealT < 1) {
        s.revealT = Math.min(1, s.revealT + dt * 0.5);
        s.model.scale.setScalar(s.revealT);
      }
      s.model.position.y = s.baseY + Math.sin(this.time * 1.2) * 0.2;
      s.model.rotation.y += dt * 1.2;
    }
  }

  // For sonar and the dolphin companion.
  uncollected() {
    const out = [];
    for (const p of this.pearls) if (!p.taken) out.push({ type: 'pearl', pos: p.pos });
    for (const c of this.clams) if (!c.open) out.push({ type: 'clam', pos: c.model.position });
    for (const p of this.pages) if (!p.taken) out.push({ type: 'page', pos: p.model.position });
    for (const r of this.relics) if (!r.taken) out.push({ type: 'relic', pos: r.model.position });
    for (const s of this.shards) if (!s.taken) out.push({ type: 'shard', pos: s.model.position, revealed: s.revealed });
    return out;
  }

  totals() {
    return {
      shards: SHARD_IDS.length,
      relics: Object.keys(RELICS).length,
      journal: Object.keys(JOURNAL).length,
    };
  }
}
