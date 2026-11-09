import * as THREE from 'three';

// Original low-poly two-seat electric roadster: low nose, wide stance,
// glass roof and thin full-width light bars. No logos or badges.
let shadowTex = null;
export function blobShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

export function makeBlobShadow(w, l) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, l),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.renderOrder = 1;
  return m;
}

function profileGeometry(points, width, bevel = 0.06) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1,
  });
  // shape is in (forward u, up v); extruded along +z. Re-orient: forward -> -Z, width -> X.
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

export function buildRoadster(paintHex = '#d7263d') {
  const car = new THREE.Group();
  const body = new THREE.Group(); // tilts / rolls independently of wheels
  car.add(body);

  const paint = new THREE.MeshPhongMaterial({ color: paintHex, shininess: 90, specular: '#666666', flatShading: true });
  const glass = new THREE.MeshPhongMaterial({ color: '#0e1622', shininess: 140, specular: '#9fb3c8', flatShading: true, transparent: true, opacity: 0.92 });
  const dark = new THREE.MeshLambertMaterial({ color: '#17191d', flatShading: true });
  const trim = new THREE.MeshLambertMaterial({ color: '#2a2e35', flatShading: true });
  const headMat = new THREE.MeshBasicMaterial({ color: '#e8f6ff' });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2a3a' });

  // lower tub (full width) + narrower upper deck gives a sleek tumblehome
  const tub = new THREE.Mesh(profileGeometry([
    [-2.06, 0.24], [1.9, 0.2], [2.1, 0.31], [2.04, 0.44], [1.25, 0.58], [-1.72, 0.64],
    [-2.08, 0.62], [-2.13, 0.44],
  ], 1.92, 0.1), paint);
  body.add(tub);
  const deck = new THREE.Mesh(profileGeometry([
    [-1.98, 0.58], [1.2, 0.56], [0.62, 0.75], [-0.9, 0.83], [-1.62, 0.83], [-2.0, 0.71],
  ], 1.6, 0.09), paint);
  body.add(deck);
  // rounded haunches over the wheels for a wide, planted stance
  const hipGeo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const sx of [-1, 1]) {
    const rear = new THREE.Mesh(hipGeo, paint);
    rear.scale.set(0.3, 0.2, 0.95);
    rear.position.set(sx * 0.76, 0.58, 1.25);
    body.add(rear);
    const front = new THREE.Mesh(hipGeo, paint);
    front.scale.set(0.26, 0.15, 0.82);
    front.position.set(sx * 0.78, 0.5, -1.3);
    body.add(front);
  }

  // glass canopy / roof
  const cabinGeo = profileGeometry([
    [-1.48, 0.8], [0.88, 0.7], [0.2, 1.1], [-0.5, 1.13], [-1.12, 0.98],
  ], 1.34, 0.05);
  body.add(new THREE.Mesh(cabinGeo, glass));
  // thin roof spine (body colour) so the roof reads as glass panels
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.95), paint);
  spine.position.set(0, 1.135, 0.12);
  body.add(spine);

  // rear lip, dark rear panel + diffuser, side intakes, mirrors, sills
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.2), paint);
  lip.position.set(0, 0.86, 1.86);
  lip.rotation.x = -0.15;
  body.add(lip);
  const rearPanel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.05), dark);
  rearPanel.position.set(0, 0.5, 2.15);
  body.add(rearPanel);
  const diff = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.34), dark);
  diff.position.set(0, 0.29, 1.98);
  diff.rotation.x = 0.25;
  body.add(diff);
  for (const sx of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.6), dark);
    intake.position.set(sx * 0.97, 0.47, 0.5);
    body.add(intake);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.15), paint);
    mirror.position.set(sx * 0.86, 0.82, -0.5);
    body.add(mirror);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 2.2), trim);
    sill.position.set(sx * 0.97, 0.28, 0);
    body.add(sill);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.08), dark);
  grille.position.set(0, 0.28, -2.06);
  body.add(grille);

  // light bars
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.05), headMat);
  head.position.set(0, 0.42, -2.05);
  head.rotation.x = 0.5;
  body.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.05, 0.05), tailMat);
  tail.position.set(0, 0.63, 2.14);
  body.add(tail);
  body.userData.tailMat = tailMat;

  // wheels
  const tyreGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.32, 12);
  tyreGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.33, 6);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshLambertMaterial({ color: '#b8bfc7', flatShading: true });
  const wheels = [];
  for (const [x, z] of [[-0.88, -1.33], [0.88, -1.33], [-0.9, 1.3], [0.9, 1.3]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.37, z);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(tyreGeo, dark));
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.x = x > 0 ? 0.01 : -0.01;
    spin.add(rim);
    pivot.add(spin);
    car.add(pivot);
    wheels.push({ pivot, spin, front: z < 0 });
  }

  const shadow = makeBlobShadow(2.8, 5.2);
  car.add(shadow);

  car.userData = { body, wheels, paint, tailMat, headMat, shadow };
  return car;
}
