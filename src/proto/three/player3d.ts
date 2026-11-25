// 3D prototype: a toon character built from simple solids (same Appearance as the 2D game: skin, hair, shirt, shorts, shoes, racket),
// big comic head, dark outline (inverted hull), flat toon light. A small skeleton of groups is posed every frame from `Pose3D`
// (joint angles), so the same timing ideas as the 2D rig (rig.ts) drive it.

import * as THREE from 'three';
import type { Appearance } from '../../game/types';

/** Joint angles in radians (pitch = forward/back swing, roll = sideways), heights in metres. */
export interface Pose3D {
  crouch: number;
  lean: number;
  twist: number;
  headYaw: number;
  /** Right (racket) arm: shoulder pitch (forward +), roll (out +), yaw; elbow bend; racket tilt at the wrist. */
  rShoulder: [number, number, number];
  rElbow: number;
  wrist: number;
  lShoulder: [number, number, number];
  lElbow: number;
  /** Legs: hip pitch (forward +), hip roll (out +), knee bend. */
  rHip: [number, number];
  rKnee: number;
  lHip: [number, number];
  lKnee: number;
}

export const READY: Pose3D = {
  crouch: 0.1, lean: 0.18, twist: 0, headYaw: 0,
  rShoulder: [0.7, 0.15, 0.3], rElbow: 1.2, wrist: 0.3,
  lShoulder: [0.8, 0.1, -0.5], lElbow: 1.3,
  rHip: [0.25, 0.18], rKnee: 0.5, lHip: [0.25, 0.18], lKnee: 0.5,
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const lerp2 = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

export function mix(a: Pose3D, b: Pose3D, t: number): Pose3D {
  return {
    crouch: lerp(a.crouch, b.crouch, t), lean: lerp(a.lean, b.lean, t), twist: lerp(a.twist, b.twist, t), headYaw: lerp(a.headYaw, b.headYaw, t),
    rShoulder: lerp3(a.rShoulder, b.rShoulder, t), rElbow: lerp(a.rElbow, b.rElbow, t), wrist: lerp(a.wrist, b.wrist, t),
    lShoulder: lerp3(a.lShoulder, b.lShoulder, t), lElbow: lerp(a.lElbow, b.lElbow, t),
    rHip: lerp2(a.rHip, b.rHip, t), rKnee: lerp(a.rKnee, b.rKnee, t), lHip: lerp2(a.lHip, b.lHip, t), lKnee: lerp(a.lKnee, b.lKnee, t),
  };
}

export const pose = (p: Partial<Pose3D>): Pose3D => ({ ...READY, ...p });

// ---------- the poses of the clips ----------
export const POSE = {
  fhPrep: pose({ twist: 1.1, crouch: 0.16, rShoulder: [-0.2, 1.1, 0.6], rElbow: 0.5, wrist: -0.4, lShoulder: [1.2, 0.3, 0.2], lElbow: 0.4, rKnee: 0.7, lKnee: 0.6 }),
  fhHit: pose({ twist: 0.1, crouch: 0.18, rShoulder: [1.0, 1.25, -0.2], rElbow: 0.2, wrist: 0.2, lShoulder: [0.5, 0.6, 0], lElbow: 0.5, rKnee: 0.7, lKnee: 0.6 }),
  fhFollow: pose({ twist: -1.0, crouch: 0.12, rShoulder: [2.3, 0.2, -1.1], rElbow: 1.4, wrist: 0.6, lShoulder: [0.2, 0.4, 0], lElbow: 0.9 }),
  bhPrep: pose({ twist: -1.2, crouch: 0.16, rShoulder: [0.9, -0.2, -1.0], rElbow: 0.9, wrist: 0.8, lShoulder: [0.9, -0.3, 1.0], lElbow: 1.1, rKnee: 0.7, lKnee: 0.6 }),
  bhHit: pose({ twist: -0.1, crouch: 0.18, rShoulder: [1.2, -0.1, -0.4], rElbow: 0.3, wrist: 0.2, lShoulder: [1.2, 0.3, 0.5], lElbow: 0.6, rKnee: 0.7, lKnee: 0.6 }),
  bhFollow: pose({ twist: 0.9, crouch: 0.12, rShoulder: [2.4, -0.4, 0.4], rElbow: 1.3, wrist: -0.3, lShoulder: [2.2, 0.2, 0.9], lElbow: 1.4 }),
  smashPrep: pose({ twist: 0.8, crouch: 0.2, lean: 0, rShoulder: [2.7, 0.6, 0.4], rElbow: 1.8, wrist: 0.4, lShoulder: [2.8, 0.1, 0], lElbow: 0.1, rHip: [0.1, 0.12], rKnee: 0.3, lHip: [0.35, 0.12], lKnee: 0.9 }),
  smashAir: pose({ twist: 0.2, crouch: 0, lean: -0.1, rShoulder: [3.0, 0.2, 0], rElbow: 0.1, wrist: 0.6, lShoulder: [0.8, 0.3, 0], lElbow: 1.0, rHip: [1.2, 0.1], rKnee: 1.6, lHip: [-0.1, 0.05], lKnee: 0.15 }),
  smashFollow: pose({ twist: -0.8, crouch: 0.1, lean: 0.3, rShoulder: [1.3, -0.4, -0.6], rElbow: 0.6, wrist: 0.8, lShoulder: [0.3, 0.4, 0], lElbow: 1.0, rHip: [0.9, 0.1], rKnee: 1.2, lHip: [0.2, 0.05], lKnee: 0.5 }),
  land: pose({ crouch: 0.3, lean: 0.35, rHip: [0.5, 0.2], rKnee: 1.1, lHip: [0.6, 0.15], lKnee: 1.3 }),
  splitUp: pose({ crouch: 0.02, rHip: [0.1, 0.05], lHip: [0.1, 0.05], rKnee: 0.2, lKnee: 0.2 }),
  splitLand: pose({ crouch: 0.24, rHip: [0.4, 0.35], lHip: [0.4, 0.35], rKnee: 0.9, lKnee: 0.9 }),
  fist: pose({ crouch: 0.06, lean: -0.05, lShoulder: [2.6, 0.4, 0], lElbow: 1.9, rShoulder: [0.2, 0.2, 0], rElbow: 0.3, wrist: 0.2 }),
  fistDown: pose({ crouch: 0.16, lean: 0.15, lShoulder: [1.2, 0.5, 0], lElbow: 2.2, rShoulder: [0.2, 0.2, 0], rElbow: 0.3 }),
  arms: pose({ crouch: 0.02, lean: -0.15, rShoulder: [3.0, 0.4, 0], rElbow: 0.1, lShoulder: [3.0, 0.4, 0], lElbow: 0.1, wrist: 0 }),
  racketUp: pose({ crouch: 0.04, lean: -0.1, rShoulder: [3.0, 0.25, 0], rElbow: 0.1, wrist: 0, lShoulder: [0.3, 0.3, 0], lElbow: 0.4 }),
  slump: pose({ crouch: 0.04, lean: 0.35, rShoulder: [0.05, 0.1, 0], rElbow: 0.1, wrist: 1.2, lShoulder: [0.05, 0.1, 0], lElbow: 0.1, headYaw: 0 }),
  headHands: pose({ crouch: 0.02, lean: -0.05, rShoulder: [2.4, 1.0, 0.3], rElbow: 2.4, wrist: 1.4, lShoulder: [2.4, 1.0, -0.3], lElbow: 2.4 }),
  wave: pose({ crouch: 0.02, lean: 0, lShoulder: [2.3, 1.0, 0], lElbow: 0.6, rShoulder: [0.3, 0.2, 0], rElbow: 0.4 }),
  standTall: pose({ crouch: 0, lean: 0.02, rShoulder: [0.15, 0.15, 0], rElbow: 0.3, lShoulder: [0.1, 0.12, 0], lElbow: 0.2, rHip: [0, 0.06], lHip: [0, 0.06], rKnee: 0.05, lKnee: 0.05 }),
  trophy: pose({ crouch: 0.02, lean: -0.12, rShoulder: [3.05, 0.25, 0], rElbow: 0.15, lShoulder: [3.05, 0.25, 0], lElbow: 0.15 }),
};

/** The run cycle at `phase` (one cycle = two steps). */
export function runPose(phase: number): Pose3D {
  const a = phase * Math.PI * 2;
  const s = Math.sin(a);
  return pose({
    crouch: 0.08 + 0.04 * Math.abs(Math.cos(a)), lean: 0.32,
    rHip: [0.9 * s + 0.2, 0.06], lHip: [-0.9 * s + 0.2, 0.06],
    rKnee: 0.5 + 0.9 * Math.max(0, -Math.cos(a + 0.6)), lKnee: 0.5 + 0.9 * Math.max(0, Math.cos(a + 0.6)),
    rShoulder: [0.7 - 0.5 * s, 0.15, 0.2], rElbow: 1.3, wrist: 0.4,
    lShoulder: [0.4 + 0.8 * s, 0.15, 0], lElbow: 1.5,
  });
}

// ---------- the model ----------
let gradient: THREE.DataTexture | null = null;
const toon = (color: string | number): THREE.MeshToonMaterial => new THREE.MeshToonMaterial({ color: new THREE.Color(color as THREE.ColorRepresentation), gradientMap: gradient ?? undefined });
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0b1f3a, side: THREE.BackSide });

function withOutline(mesh: THREE.Mesh, k = 1.08): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh);
  const o = new THREE.Mesh(mesh.geometry, OUTLINE);
  o.position.copy(mesh.position);
  o.rotation.copy(mesh.rotation);
  o.scale.copy(mesh.scale).multiplyScalar(k);
  g.add(o);
  return g;
}

/** A limb segment hanging down from its joint (length `len`). */
function limb(radius: number, len: number, color: string, k = 1.12): THREE.Group {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, len - 2 * radius), 4, 8), toon(color));
  m.position.y = -len / 2;
  return withOutline(m, k);
}

export class Player3D {
  readonly root = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private rSh = new THREE.Group();
  private rEl = new THREE.Group();
  private rWr = new THREE.Group();
  private lSh = new THREE.Group();
  private lEl = new THREE.Group();
  private rHipJ = new THREE.Group();
  private rKneeJ = new THREE.Group();
  private lHipJ = new THREE.Group();
  private lKneeJ = new THREE.Group();
  /** A world point on the racket face (for the contact flash). */
  readonly racketFace = new THREE.Object3D();
  private legLen = 0.86;

  constructor(appearance: Appearance, gradientMap: THREE.DataTexture) {
    gradient = gradientMap;
    const skin = appearance.skin;
    const thigh = 0.44;
    const shin = 0.42;
    this.legLen = thigh + shin;
    this.root.add(this.hips);
    this.hips.position.y = this.legLen;
    // shorts
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.22, 12), toon(appearance.bottom));
    shorts.position.y = 0.0;
    this.hips.add(withOutline(shorts, 1.06));
    // torso
    this.hips.add(this.torso);
    this.torso.position.y = 0.08;
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.26, 4, 12), toon(appearance.shirt));
    chest.position.y = 0.24;
    chest.scale.set(1.08, 1, 0.78);
    this.torso.add(withOutline(chest, 1.07));
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.188, 0.188, 0.05, 12), toon('#ffffff'));
    stripe.position.y = 0.26;
    stripe.scale.set(1.08, 1, 0.78);
    this.torso.add(stripe);
    // head: big and round (comic), on a short neck
    this.torso.add(this.head);
    this.head.position.y = 0.56;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), toon(skin));
    skull.position.y = 0.14;
    this.head.add(withOutline(skull, 1.06));
    const hair = new THREE.Mesh(
      appearance.hairStyle === 'afro' ? new THREE.SphereGeometry(0.235, 18, 14) : new THREE.SphereGeometry(0.2, 18, 14, 0, Math.PI * 2, 0, appearance.hairStyle === 'long' ? 2.0 : 1.35),
      toon(appearance.hairColor),
    );
    hair.position.set(0, appearance.hairStyle === 'afro' ? 0.19 : 0.155, -0.012);
    this.head.add(hair);
    if (appearance.hairStyle === 'long' || appearance.hairStyle === 'ponytail') {
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.2, 4, 8), toon(appearance.hairColor));
      tail.position.set(0, 0.02, -0.15);
      this.head.add(tail);
    }
    // eyes and nose on the front (+z)
    for (const ex of [-0.065, 0.065]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eye.position.set(ex, 0.16, 0.17);
      eye.scale.z = 0.5;
      this.head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 6), new THREE.MeshBasicMaterial({ color: 0x101018 }));
      pupil.position.set(ex, 0.16, 0.19);
      this.head.add(pupil);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x5a1e1e }));
    mouth.position.set(0, 0.07, 0.18);
    mouth.rotation.z = Math.PI;
    this.head.add(mouth);
    // arms: the right one holds the racket
    const arm = (sh: THREE.Group, el: THREE.Group, side: number): void => {
      this.torso.add(sh);
      sh.position.set(side * 0.24, 0.44, 0);
      sh.add(limb(0.06, 0.28, appearance.shirt));
      sh.add(el);
      el.position.y = -0.28;
      el.add(limb(0.05, 0.26, skin));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), toon(skin));
      hand.position.y = -0.28;
      el.add(withOutline(hand));
    };
    arm(this.rSh, this.rEl, -1);
    arm(this.lSh, this.lEl, 1);
    // racket in the right hand
    this.rEl.add(this.rWr);
    this.rWr.position.y = -0.28;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.2, 8), toon('#1d2a4a'));
    handle.position.y = -0.1;
    this.rWr.add(handle);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 20), toon(appearance.racket));
    face.rotation.x = Math.PI / 2;
    face.scale.set(0.95, 1, 1.15);
    face.position.y = -0.36;
    this.rWr.add(withOutline(face, 1.1));
    const strings = new THREE.Mesh(new THREE.CircleGeometry(0.12, 18), new THREE.MeshBasicMaterial({ color: 0xfbfbf6, side: THREE.DoubleSide }));
    strings.position.set(0, -0.36, 0.017);
    strings.scale.y = 1.15;
    this.rWr.add(strings);
    this.racketFace.position.y = -0.36;
    this.rWr.add(this.racketFace);
    // legs
    const leg = (hip: THREE.Group, knee: THREE.Group, side: number): void => {
      this.hips.add(hip);
      hip.position.set(side * 0.1, -0.04, 0);
      hip.add(limb(0.075, thigh, skin));
      hip.add(knee);
      knee.position.y = -thigh;
      knee.add(limb(0.062, shin, skin));
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.24), toon(appearance.shoes));
      shoe.position.set(0, -shin - 0.02, 0.05);
      knee.add(withOutline(shoe, 1.1));
    };
    leg(this.rHipJ, this.rKneeJ, -1);
    leg(this.lHipJ, this.lKneeJ, 1);
    this.setPose(READY);
  }

  setPose(p: Pose3D): void {
    // the hips sit as high as the longer leg allows (the stance foot on the ground); `crouch` only adds to the knees through the poses
    const drop = (hip: [number, number], knee: number): number => (0.44 * Math.cos(hip[0]) + 0.42 * Math.cos(hip[0] - knee)) * Math.cos(hip[1]);
    this.hips.position.y = Math.max(drop(p.rHip, p.rKnee), drop(p.lHip, p.lKnee)) + 0.1;
    this.torso.rotation.set(p.lean, p.twist, 0);
    this.head.rotation.set(-p.lean * 0.6, p.headYaw - p.twist * 0.5, 0);
    // arms: pitch forward = rotation about -x (the limb hangs along -y, forward is +z)
    this.rSh.rotation.set(-p.rShoulder[0], p.rShoulder[2], -p.rShoulder[1]);
    this.rEl.rotation.set(-p.rElbow, 0, 0);
    this.rWr.rotation.set(-p.wrist, 0, 0);
    this.lSh.rotation.set(-p.lShoulder[0], p.lShoulder[2], p.lShoulder[1]);
    this.lEl.rotation.set(-p.lElbow, 0, 0);
    this.rHipJ.rotation.set(-p.rHip[0], 0, -p.rHip[1]);
    this.rKneeJ.rotation.set(p.rKnee, 0, 0);
    this.lHipJ.rotation.set(-p.lHip[0], 0, p.lHip[1]);
    this.lKneeJ.rotation.set(p.lKnee, 0, 0);
    // knees bent: the feet stay under the body (the hips sink, a little forward lean of the shins is fine)
  }
}
