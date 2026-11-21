import * as THREE from 'three';

/** Colours of one comic big-head player (hex numbers). */
export interface PlayerLook {
  shirt: number;
  shorts: number;
  skin: number;
  hair: number;
  racket: number;
}

/** Speed (m/s) a player runs at when he walks to a new spot. */
const RUN_SPEED = 8;
const SWING_SECONDS = 0.38;

const std = (color: number, roughness = 0.7): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });

/**
 * A low-poly player built from primitives: legs, shorts, shirt, a big comic head, hair and a racket arm.
 * Feet are at y = 0, the front of the body is local +Z. World position is in three.js units
 * (x across, y up, z along the court with the net at 0); `Court3D` converts from court metres.
 */
export class Player3D {
  readonly group = new THREE.Group();
  private readonly armPivot = new THREE.Group();
  private readonly body = new THREE.Group();
  private target = new THREE.Vector3();
  private swingT = 1;
  private runPhase = 0;
  private moving = false;

  constructor(look: PlayerLook) {
    const skin = std(look.skin, 0.55);
    const shirt = std(look.shirt, 0.65);
    const shorts = std(look.shorts, 0.75);
    const shoe = std(0xf2f2f2, 0.5);

    // Legs, shorts and shoes.
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.6, 10), skin);
      leg.position.set(sx * 0.1, 0.33, 0);
      const shoeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.26), shoe);
      shoeMesh.position.set(sx * 0.1, 0.04, 0.05);
      this.body.add(leg, shoeMesh);
    }
    const shortsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.3, 14), shorts);
    shortsMesh.position.y = 0.72;
    this.body.add(shortsMesh);

    // Torso.
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.34, 6, 14), shirt);
    torso.position.y = 1.07;
    this.body.add(torso);

    // Big comic head with hair and eyes.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 24, 18), skin);
    head.position.y = 1.55;
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.305, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
      std(look.hair, 0.9),
    );
    hair.position.y = 1.58;
    hair.rotation.x = -0.25;
    const eyeMat = std(0x141414, 0.3);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), eyeMat);
      eye.position.set(sx * 0.1, 1.58, 0.265);
      this.body.add(eye);
    }
    this.body.add(head, hair);

    // Left arm (static) and the right racket arm on a shoulder pivot.
    const armGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.5, 10);
    const left = new THREE.Mesh(armGeo, skin);
    left.position.set(-0.27, 1.07, 0.05);
    left.rotation.z = 0.2;
    this.body.add(left);

    this.armPivot.position.set(0.25, 1.3, 0);
    const arm = new THREE.Mesh(armGeo, skin);
    arm.position.y = -0.22;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), std(0x222222, 0.6));
    handle.position.set(0, -0.5, 0.05);
    const racketHead = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 24), std(look.racket, 0.35));
    racketHead.scale.set(1, 1, 1.25);
    racketHead.rotation.z = Math.PI / 2;
    racketHead.position.set(0, -0.78, 0.05);
    this.armPivot.add(arm, handle, racketHead);
    this.armPivot.rotation.x = 0.35;
    this.body.add(this.armPivot);

    this.body.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.group.add(this.body);
  }

  /** Teleport to a spot (three.js units). */
  snap(x: number, z: number): void {
    this.group.position.set(x, 0, z);
    this.target.set(x, 0, z);
    this.moving = false;
  }

  /** Walk to a spot. */
  moveTo(x: number, z: number): void {
    this.target.set(x, 0, z);
  }

  /** Look towards +Z (angle 0) or -Z (angle PI), with a small turn towards a ball at x. */
  face(towardsPositiveZ: boolean, ballX: number): void {
    const base = towardsPositiveZ ? 0 : Math.PI;
    const turn = THREE.MathUtils.clamp((ballX - this.group.position.x) * 0.06, -0.5, 0.5);
    this.group.rotation.y = base + (towardsPositiveZ ? -turn : turn);
  }

  swing(): void {
    this.swingT = 0;
  }

  update(dt: number): void {
    const pos = this.group.position;
    const to = this.target.clone().sub(pos);
    to.y = 0;
    const dist = to.length();
    this.moving = dist > 0.05;
    if (this.moving) {
      const step = Math.min(dist, RUN_SPEED * dt);
      pos.addScaledVector(to.normalize(), step);
      this.runPhase += dt * 14;
    }
    // Running bob and lean; standing breathing.
    const bob = this.moving ? Math.abs(Math.sin(this.runPhase)) * 0.06 : Math.sin(performance.now() / 380 + pos.x) * 0.012;
    this.body.position.y = bob;
    this.body.rotation.x = this.moving ? 0.12 : 0;

    // Swing: wind up, whip through, settle.
    if (this.swingT < 1) {
      this.swingT = Math.min(1, this.swingT + dt / SWING_SECONDS);
      const t = this.swingT;
      const wind = Math.sin(Math.min(t / 0.35, 1) * Math.PI * 0.5);
      const hit = t < 0.35 ? -wind * 1.2 : THREE.MathUtils.lerp(-1.2, 0.35, (t - 0.35) / 0.65);
      this.armPivot.rotation.x = hit;
      this.body.rotation.y = t < 0.35 ? -0.35 * wind : -0.35 * (1 - (t - 0.35) / 0.65);
    } else {
      this.armPivot.rotation.x = 0.35 + (this.moving ? Math.sin(this.runPhase) * 0.25 : 0);
      this.body.rotation.y = 0;
    }
  }
}
