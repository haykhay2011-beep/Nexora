import * as THREE from 'three';

// Small standalone models for items (not batched, since they move or disappear).

const lambert = (color, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive, flatShading: true });
const phong = (color, emissive = 0x000000) => new THREE.MeshPhongMaterial({ color, emissive, flatShading: true, shininess: 80, specular: 0x998855 });

export function shardModel(color) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshBasicMaterial({ color }));
  core.scale.set(0.8, 1.9, 0.8);
  g.add(core);
  const shell = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  shell.scale.set(0.9, 1.9, 0.9);
  g.add(shell);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 12, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  g.add(halo);
  g.userData.core = core;
  return g;
}

export function scrollModel() {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8), phong(0xc8963a, 0x2a1a00));
  tube.rotation.z = Math.PI / 2;
  g.add(tube);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 8), phong(0x8a5a2a));
    cap.rotation.z = Math.PI / 2;
    cap.position.x = s * 0.48;
    g.add(cap);
  }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 4, 12), new THREE.MeshBasicMaterial({ color: 0x5ff7e6 }));
  band.rotation.y = Math.PI / 2;
  g.add(band);
  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x5ff7e6, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  g.add(glint);
  return g;
}

export function relicModel(shape, color) {
  const g = new THREE.Group();
  const mat = phong(color, new THREE.Color(color).multiplyScalar(0.12).getHex());
  if (shape === 'mask') {
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    face.rotation.x = Math.PI / 2;
    face.scale.set(1, 0.5, 1.25);
    g.add(face);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x0a1418 }));
      eye.position.set(s * 0.14, 0.1, 0.2);
      g.add(eye);
    }
  } else if (shape === 'coin') {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12), mat);
    coin.rotation.x = Math.PI / 2;
    g.add(coin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 4, 12), mat);
    g.add(rim);
  } else if (shape === 'dolphin') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat);
    body.scale.set(2.2, 0.8, 0.8);
    g.add(body);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 4), mat);
    fin.position.set(0, 0.2, 0);
    g.add(fin);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.35), mat);
    tail.position.set(-0.48, 0.05, 0);
    g.add(tail);
  } else if (shape === 'statue') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), mat);
    base.position.y = -0.3;
    g.add(base);
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.45, 6), mat);
    robe.position.y = -0.03;
    g.add(robe);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat);
    head.position.y = 0.27;
    g.add(head);
  } else if (shape === 'amphora') {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push(new THREE.Vector2(0.05 + Math.sin(t * Math.PI) * 0.22 + (t > 0.85 ? 0.04 : 0), t * 0.8 - 0.4));
    }
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 8), mat));
  } else if (shape === 'crown') {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.15, 8, 1, true), mat);
    ring.material.side = THREE.DoubleSide;
    g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), mat);
      spike.position.set(Math.cos(a) * 0.28, 0.18, Math.sin(a) * 0.28);
      g.add(spike);
    }
  }
  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glint.userData.isGlint = true;
  g.add(glint);
  return g;
}

const shellGeo = (() => {
  const g = new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, 0.38, 0.85);
  return g;
})();

export function clamModel(scale = 1, color = 0x8a7aa8) {
  const g = new THREE.Group();
  const bottom = new THREE.Mesh(shellGeo, lambert(color));
  bottom.rotation.x = Math.PI;
  g.add(bottom);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.08, 4, 14), lambert(0x4fd0e8, 0x0b3540));
  lip.rotation.x = Math.PI / 2;
  lip.scale.set(1, 0.85, 1);
  g.add(lip);
  const hinge = new THREE.Group();
  hinge.position.set(0, 0, -0.8);
  const top = new THREE.Mesh(shellGeo, lambert(color));
  top.position.set(0, 0, 0.8);
  hinge.add(top);
  g.add(hinge);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshLambertMaterial({ color: 0xfff4f0, emissive: 0x664455 }));
  pearl.position.set(0, 0.12, 0);
  g.add(pearl);
  g.scale.setScalar(scale);
  g.userData.hinge = hinge;
  g.userData.pearl = pearl;
  return g;
}

export function plaqueModel(w = 2.2, h = 1.6) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), lambert(0xcfc6b2));
  g.add(slab);
  const c = document.createElement('canvas');
  c.width = 256; c.height = Math.round(256 * (h / w));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#20343c';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#5ff7e6';
  ctx.shadowColor = '#5ff7e6';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  // abstract carved figures
  for (let i = 0; i < 5; i++) {
    const x = 30 + i * 48, y = c.height * 0.55;
    ctx.beginPath();
    ctx.arc(x, y - 30, 8, 0, Math.PI * 2);
    ctx.moveTo(x, y - 22); ctx.lineTo(x, y + 10);
    ctx.moveTo(x - 14, y - 8); ctx.lineTo(x + 14, y - 14);
    ctx.moveTo(x, y + 10); ctx.lineTo(x - 10, y + 30);
    ctx.moveTo(x, y + 10); ctx.lineTo(x + 10, y + 30);
    ctx.stroke();
  }
  ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.85), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.z = 0.16;
  g.add(face);
  return g;
}
