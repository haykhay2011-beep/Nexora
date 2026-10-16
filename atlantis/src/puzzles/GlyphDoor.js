import * as THREE from 'three';
import { GLYPHS, GLYPH_LABEL, glyphMaterial, drawGlyph } from '../world/Materials.js';

// A heavy door with four glyph dials. Turn each dial (E) to the right sign to open it.
// The door faces along +X in its local frame rotated by ry; it slides down into the floor.
export class GlyphDoor {
  constructor(ctx, { id, x, y, z, ry, width = 4, height = 6, code, onOpen }) {
    this.id = id;
    this.game = ctx.game;
    this.code = code;
    this.solved = false;
    this.t = 0;
    this.onOpen = onOpen;
    const fwd = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)); // door faces this way (outward)
    const right = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    this.door = new THREE.Group();
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.6),
      new THREE.MeshPhongMaterial({ color: 0xc9a24a, flatShading: true, shininess: 60, specular: 0x665522 })
    );
    this.door.add(slab);
    // engraved panel
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.8, height * 0.85), new THREE.MeshBasicMaterial({ map: doorTexture() }));
    panel.position.z = 0.31;
    this.door.add(panel);
    this.door.position.set(x, y + height / 2, z);
    this.door.rotation.y = ry;
    ctx.scene.add(this.door);
    this.baseY = y + height / 2;
    this.height = height;
    this.collider = ctx.C.box(x, y + height / 2, z, width / 2, height / 2, 0.4, ry, true);

    // four dials on the door face in a row above head height
    this.dials = [];
    const start = [0, 3, 5, 1];
    for (let i = 0; i < 4; i++) {
      const lx = (i - 1.5) * (width * 0.22);
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), glyphMaterial(GLYPHS[start[i]], { bg: '#22323a' }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 4, 16), new THREE.MeshPhongMaterial({ color: 0xe9c25a, flatShading: true }));
      mesh.position.set(lx, height * 0.18, 0.33);
      ring.position.copy(mesh.position);
      this.door.add(mesh, ring);
      const dial = { index: start[i], mesh, spin: 0 };
      this.dials.push(dial);
      const world = new THREE.Vector3(x, y + height / 2 + height * 0.18, z).addScaledVector(right, lx).addScaledVector(fwd, 0.9);
      this.game.interact.add({
        pos: world, radius: 2.4, priority: 1,
        prompt: () => `Turn dial ${i + 1} (${GLYPH_LABEL[GLYPHS[dial.index]]})`,
        enabled: () => !this.solved,
        onUse: () => this.turn(dial),
      });
    }
    this.game.puzzles.register(this);
  }

  turn(dial) {
    dial.index = (dial.index + 1) % GLYPHS.length;
    dial.mesh.material = glyphMaterial(GLYPHS[dial.index], { bg: '#22323a' });
    dial.spin = 1;
    this.game.audio.play('click2');
    if (this.dials.every((d, i) => GLYPHS[d.index] === this.code[i])) {
      setTimeout(() => this.game.puzzles.solve(this, 'The four signs are spoken. The temple door opens!'), 700);
    }
  }

  onSolved(silent) {
    this.solved = true;
    this.dials.forEach((d, i) => {
      d.index = GLYPHS.indexOf(this.code[i]);
      d.mesh.material = glyphMaterial(this.code[i], { bg: '#22323a' });
    });
    this.collider.enabled = false;
    if (silent) this.t = 1;
    if (this.onOpen) this.onOpen(silent);
  }

  update(dt) {
    for (const d of this.dials) {
      if (d.spin > 0) {
        d.spin = Math.max(0, d.spin - dt * 4);
        d.mesh.rotation.z = d.spin * Math.PI * 0.5;
      }
    }
    if (this.solved && this.t < 1) this.t = Math.min(1, this.t + dt * 0.25);
    this.door.position.y = this.baseY - this.t * (this.height + 0.2);
  }
}

function doorTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 384;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b08a3a';
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = '#7a5a20';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 232, 360);
  ctx.strokeRect(30, 150, 196, 200);
  // a big trident in relief
  drawGlyph(ctx, 'trident', 128, 250, 170, '#ffe9a8', 0.05);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Shrine tablet showing one sign in one of four circles.
export function shrineTabletTexture(glyph, position) {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8d0bc';
  ctx.fillRect(0, 0, 384, 160);
  ctx.strokeStyle = '#8a8270';
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, 372, 148);
  for (let i = 0; i < 4; i++) {
    const cx = 60 + i * 88, cy = 80;
    ctx.beginPath();
    ctx.strokeStyle = i === position ? '#2fb8a8' : '#9a927e';
    ctx.lineWidth = 4;
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.stroke();
    if (i === position) {
      ctx.fillStyle = '#1d3a40';
      ctx.fill();
      drawGlyph(ctx, glyph, cx, cy, 58, '#6ff7e8', 0.1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
