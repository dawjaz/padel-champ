// 3D prototype: the court and the arena, built from the same measurements as the 2D game (walls.ts, court metres).
// Court metres (x across -5..5, z along 0..20, h up) map to three.js as (x, h, z - 10): the net is at the origin.

import * as THREE from 'three';
import { BACK_WALL, OPENING_HEIGHT, SIDE_OPENINGS, sideWallSegments } from '../../art/walls';
import type { CourtTheme } from '../../art/hd/courtThemes';

export const P = (x: number, z: number, h = 0): THREE.Vector3 => new THREE.Vector3(x, h, z - 10);

/** A 3-step gradient for toon shading (flat light, one shadow band). */
export function toonGradient(): THREE.DataTexture {
  const data = new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

const canvasTexture = (w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

export interface Arena {
  group: THREE.Group;
  /** The crowd: call with a 0..1 excitement to make it bounce. */
  cheer: (time: number, level: number) => void;
}

export function buildArena(theme: CourtTheme): Arena {
  const group = new THREE.Group();

  // ground around the court
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 90), new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.groundBottom) }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  group.add(ground);
  // the court surface: a gradient from the far end to the near end, the lines painted on it
  const court = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 20),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(256, 512, (g) => {
        const grd = g.createLinearGradient(0, 0, 0, 512);
        grd.addColorStop(0, theme.top);
        grd.addColorStop(1, theme.bottom);
        g.fillStyle = grd;
        g.fillRect(0, 0, 256, 512);
        g.strokeStyle = '#ffffff';
        g.lineWidth = 3;
        const y = (z: number): number => (z / 20) * 512;
        // service lines 3 m from the back glass, the centre line between them
        g.beginPath();
        g.moveTo(0, y(3));
        g.lineTo(256, y(3));
        g.moveTo(0, y(17));
        g.lineTo(256, y(17));
        g.moveTo(128, y(3));
        g.lineTo(128, y(17));
        g.stroke();
      }),
    }),
  );
  court.rotation.x = -Math.PI / 2;
  group.add(court);
  // a slab under the court (its edge shows)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.12, 21.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.slabTop) }));
  slab.position.y = -0.065;
  group.add(slab);

  // walls: glass (light, see-through) and mesh (a grid), frames as thin dark posts
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });
  const meshTex = canvasTexture(64, 64, (g) => {
    g.strokeStyle = 'rgba(220,230,245,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(64, 64);
    g.moveTo(64, 0);
    g.lineTo(0, 64);
    g.stroke();
  });
  meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping;
  const meshMat = (w: number, h: number): THREE.MeshBasicMaterial => {
    const t = meshTex.clone();
    t.repeat.set(w * 6, h * 6);
    t.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  };
  const frameMat = new THREE.MeshBasicMaterial({ color: 0x18284a });
  const post = (x: number, z: number, h: number): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.08), frameMat);
    m.position.copy(P(x, z, h / 2));
    group.add(m);
  };
  const panel = (mat: THREE.Material, w: number, h: number, pos: THREE.Vector3, rotY: number): void => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.copy(pos);
    m.rotation.y = rotY;
    group.add(m);
  };
  // back walls
  for (const z of [0, 20]) {
    panel(glassMat, 10, BACK_WALL.glass, P(0, z, BACK_WALL.glass / 2), 0);
    panel(meshMat(10, BACK_WALL.mesh), 10, BACK_WALL.mesh, P(0, z, BACK_WALL.glass + BACK_WALL.mesh / 2), 0);
    for (let x = -5; x <= 5; x += 2) post(x, z, BACK_WALL.glass + BACK_WALL.mesh);
  }
  // side walls, segment by segment; the openings near the net are left open below their top
  for (const sx of [-5, 5]) {
    for (const s of sideWallSegments()) {
      const len = s.z1 - s.z0;
      const zc = (s.z0 + s.z1) / 2;
      if (s.glass > 0) panel(glassMat, len, s.glass, P(sx, zc, s.glass / 2), Math.PI / 2);
      if (s.mesh > 0) {
        // the mesh part: split around the openings
        const pieces: Array<[number, number, number, number]> = [];
        let z = s.z0;
        for (const o of SIDE_OPENINGS) {
          if (o.z1 <= s.z0 || o.z0 >= s.z1) continue;
          if (o.z0 > z) pieces.push([z, o.z0, s.glass, s.mesh]);
          pieces.push([Math.max(o.z0, s.z0), Math.min(o.z1, s.z1), OPENING_HEIGHT, s.glass + s.mesh - OPENING_HEIGHT]);
          z = o.z1;
        }
        if (z < s.z1) pieces.push([z, s.z1, s.glass, s.mesh]);
        for (const [a, b, h0, hh] of pieces) panel(meshMat(b - a, hh), b - a, hh, P(sx, (a + b) / 2, h0 + hh / 2), Math.PI / 2);
      }
      post(sx, s.z0, s.glass + s.mesh);
    }
    post(sx, 20, BACK_WALL.glass + BACK_WALL.mesh);
  }
  // the net: a grid between two posts, a white band on top
  const netTex = canvasTexture(64, 32, (g) => {
    g.strokeStyle = 'rgba(240,244,255,0.8)';
    g.lineWidth = 1.5;
    for (let i = 0; i <= 64; i += 8) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 32);
      g.stroke();
    }
    for (let j = 0; j <= 32; j += 8) {
      g.beginPath();
      g.moveTo(0, j);
      g.lineTo(64, j);
      g.stroke();
    }
  });
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
  netTex.repeat.set(12, 1.2);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.88), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  net.position.copy(P(0, 10, 0.44));
  group.add(net);
  const band = new THREE.Mesh(new THREE.BoxGeometry(10, 0.06, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  band.position.copy(P(0, 10, 0.9));
  group.add(band);
  for (const x of [-5.05, 5.05]) post(x, 10, 0.95);

  // stands: three tiers behind each end and along the sides, the crowd as small coloured blocks
  const standMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.groundTop) });
  const crowdColors = theme.crowd.map((c) => new THREE.Color(c));
  const seats: Array<{ x: number; y: number; z: number; phase: number }> = [];
  const tier = (cx: number, cz: number, w: number, d: number, rotY: number): void => {
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7 + i * 0.7, d), standMat);
      const off = i * d;
      const dir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
      g.position.set(cx + dir.x * off, (0.7 + i * 0.7) / 2, cz + dir.z * off);
      g.rotation.y = rotY;
      group.add(g);
      for (let s = -w / 2 + 0.4; s < w / 2; s += 0.62) {
        const side = new THREE.Vector3(Math.cos(rotY), 0, -Math.sin(rotY));
        seats.push({ x: cx + dir.x * off + side.x * s, y: 0.7 + i * 0.7 + 0.25, z: cz + dir.z * off + side.z * s, phase: Math.random() * 6.28 });
      }
    }
  };
  tier(0, -13.2, 16, 1.2, Math.PI);
  tier(0, 13.6, 16, 1.2, 0);
  tier(-8.2, 0, 24, 1.2, -Math.PI / 2);
  tier(8.2, 0, 24, 1.2, Math.PI / 2);
  const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.5, 0.3), new THREE.MeshBasicMaterial(), seats.length);
  const m4 = new THREE.Matrix4();
  seats.forEach((s, i) => {
    m4.makeTranslation(s.x, s.y, s.z);
    crowd.setMatrixAt(i, m4);
    crowd.setColorAt(i, crowdColors[i % crowdColors.length]);
  });
  group.add(crowd);
  // ad boards round the court
  const adMat = new THREE.MeshBasicMaterial({
    map: canvasTexture(512, 32, (g) => {
      g.fillStyle = theme.adMid;
      g.fillRect(0, 0, 512, 32);
      g.fillStyle = '#ffffff';
      g.font = '800 18px Trebuchet MS, sans-serif';
      for (let x = 10; x < 512; x += 170) g.fillText('POR TRES', x, 23);
    }),
  });
  for (const [x, z, r, w] of [[0, -0.9, 0, 12], [0, 20.9, 0, 12], [-6.1, 10, Math.PI / 2, 22], [6.1, 10, Math.PI / 2, 22]] as Array<[number, number, number, number]>) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, 0.05), adMat);
    b.position.copy(P(x, z, 0.3));
    b.rotation.y = r;
    group.add(b);
  }
  // light towers
  for (const [x, z] of [[-7.5, -3], [7.5, -3], [-7.5, 23], [7.5, 23]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 9, 6), frameMat);
    mast.position.copy(P(x, z, 4.5));
    group.add(mast);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
    lamp.position.copy(P(x, z, 9));
    lamp.lookAt(P(0, 10, 0));
    group.add(lamp);
  }

  const cheer = (time: number, level: number): void => {
    if (level <= 0.01) return;
    seats.forEach((s, i) => {
      const jump = Math.max(0, Math.sin(time * 9 + s.phase)) * 0.25 * level;
      m4.makeTranslation(s.x, s.y + jump, s.z);
      crowd.setMatrixAt(i, m4);
    });
    crowd.instanceMatrix.needsUpdate = true;
  };
  return { group, cheer };
}
