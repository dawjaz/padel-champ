import * as THREE from 'three';
import { COURT_LENGTH_M, COURT_WIDTH_M, NET_HEIGHT_M, NET_Z } from '../camera';
import { BACK_WALL, sideWallSegments } from '../walls';
import { Player3D, type PlayerLook } from './player3d';

/**
 * three.js court for the 3D prototype. Court metres map to three.js units as
 * x -> x (across), h -> y (up), z -> z - NET_Z (so the net is at z = 0, the near baseline at +10).
 * Pure rendering: it knows nothing about the rules; a caller moves the ball and the players.
 */
export type CameraMode = 'tv' | 'low' | 'orbit';

const HALF_W = COURT_WIDTH_M / 2;
const HALF_L = COURT_LENGTH_M / 2;
/** The real ball is 6.7 cm; drawn bigger so that it can be followed on a phone. */
const BALL_RADIUS = 0.085;
const TRAIL_POINTS = 36;

interface CamState {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

/** The old fake-3D broadcast camera (src/art/camera.ts) as a real pinhole camera: 20.4 m high, 27.2 m behind the near baseline, pitched 34 degrees down. */
function tvCamera(): CamState {
  const pos = new THREE.Vector3(0, 20.4, HALF_L + 27.2);
  const pitch = (34 * Math.PI) / 180;
  const dir = new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch));
  return { pos, look: pos.clone().addScaledVector(dir, 60), fov: 39 };
}

function lowCamera(): CamState {
  return { pos: new THREE.Vector3(0, 6.2, HALF_L + 17), look: new THREE.Vector3(0, 1.1, -3), fov: 46 };
}

function meshTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas is not available');
  g.fillStyle = 'rgba(24,26,32,0.95)';
  g.fillRect(0, 0, 32, 3);
  g.fillRect(0, 0, 3, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas is not available');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

interface Pulse {
  obj: THREE.Object3D;
  age: number;
  life: number;
  grow: number;
  mat: THREE.Material & { opacity: number };
}

export class Court3D {
  readonly canvas: HTMLCanvasElement;
  readonly players: Player3D[] = [];
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(39, 9 / 16, 0.5, 400);
  private readonly cam: CamState = tvCamera();
  private camTarget: CamState = tvCamera();
  private mode: CameraMode = 'tv';
  private orbit = { theta: 0.35, phi: 1.0, radius: 30 };
  private readonly ball: THREE.Mesh;
  private readonly ballBlob: THREE.Mesh;
  private readonly trail: THREE.Line;
  private readonly trailPts: THREE.Vector3[] = [];
  private readonly pulses: Pulse[] = [];
  private readonly glow = glowTexture();
  private shake = 0;
  private lastX = 0;
  private lastY = 0;
  private dragging = false;
  private readonly resizeObs: ResizeObserver;

  constructor(private readonly container: HTMLElement, looks: PlayerLook[]) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.touchAction = 'none';
    container.appendChild(this.canvas);

    this.scene.background = new THREE.Color(0x070b1c);
    this.scene.fog = new THREE.Fog(0x070b1c, 55, 120);

    this.buildLights();
    this.buildCourt();
    this.buildWalls();
    this.buildNet();

    // Ball, its blob shadow and a trail.
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 20, 14),
      new THREE.MeshStandardMaterial({ color: 0xe6e03a, emissive: 0x3a3600, roughness: 0.55 }),
    );
    this.ball.castShadow = true;
    this.scene.add(this.ball);
    this.ballBlob = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.ballBlob.rotation.x = -Math.PI / 2;
    this.ballBlob.position.y = 0.006;
    this.scene.add(this.ballBlob);
    // Preallocated positions, rewritten every frame (no new GPU buffer per frame).
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
    this.trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.55 }));
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);

    for (const look of looks) {
      const p = new Player3D(look);
      this.players.push(p);
      this.scene.add(p.group);
    }

    this.bindOrbit();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
  }

  // ---- scene building ----

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xb9d4ff, 0x1a2640, 0.95));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.1);
    sun.position.set(-9, 18, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -13;
    sc.right = 13;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 1;
    sc.far = 60;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    // Warm spot pools from above, like arena floodlights.
    for (const z of [-6, 6]) {
      const spot = new THREE.SpotLight(0xffe2b0, 700, 0, 0.7, 0.8, 1.6);
      spot.position.set(0, 14, z);
      spot.target.position.set(0, 0, z);
      this.scene.add(spot, spot.target);
    }
  }

  private buildCourt(): void {
    const surround = new THREE.Mesh(
      new THREE.BoxGeometry(COURT_WIDTH_M + 5, 0.3, COURT_LENGTH_M + 5),
      new THREE.MeshStandardMaterial({ color: 0x143f66, roughness: 0.8 }),
    );
    surround.position.y = -0.17;
    surround.receiveShadow = true;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(COURT_WIDTH_M, 0.3, COURT_LENGTH_M),
      new THREE.MeshStandardMaterial({ color: 0x2276bd, roughness: 0.55 }),
    );
    slab.position.y = -0.15;
    slab.receiveShadow = true;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 48), new THREE.MeshStandardMaterial({ color: 0x0a1226, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.34;
    this.scene.add(surround, slab, ground);

    // Court lines (service lines 6.95 m from the net, centre service line between them and the net-side lines).
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf4f7ff });
    const line = (x0: number, z0: number, x1: number, z1: number, w = 0.06): void => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(x0 - x1, z0 - z1);
      m.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2 - NET_Z);
      this.scene.add(m);
    };
    line(-HALF_W, 0, HALF_W, 0);
    line(-HALF_W, COURT_LENGTH_M, HALF_W, COURT_LENGTH_M);
    line(-HALF_W, 0, -HALF_W, COURT_LENGTH_M);
    line(HALF_W, 0, HALF_W, COURT_LENGTH_M);
    line(-HALF_W, NET_Z - 6.95, HALF_W, NET_Z - 6.95);
    line(-HALF_W, NET_Z + 6.95, HALF_W, NET_Z + 6.95);
    line(0, NET_Z - 6.95, 0, NET_Z + 6.95);
  }

  /** A vertical rectangle between two court points, from height y0 to y1. */
  private wallRect(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, mat: THREE.Material): THREE.Mesh {
    const ax = x0;
    const az = z0 - NET_Z;
    const bx = x1;
    const bz = z1 - NET_Z;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(bx - ax, bz - az), y1 - y0), mat);
    m.position.set((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2);
    m.rotation.y = Math.atan2(-(bz - az), bx - ax);
    this.scene.add(m);
    return m;
  }

  private meshMaterial(w: number, h: number, opacity = 1): THREE.MeshBasicMaterial {
    const t = this.meshTex.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 0.25, h / 0.25);
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  }

  private readonly meshTex = meshTexture();
  private readonly glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbfe6ff,
    transparent: true,
    opacity: 0.17,
    roughness: 0.06,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  private readonly faintGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbfe6ff,
    transparent: true,
    opacity: 0.05,
    roughness: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  private readonly frameMat = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, roughness: 0.4, metalness: 0.6 });

  /** One stretch of wall: glass (with panel joints) up to `glass`, mesh from there to `glass + mesh`. */
  private wallBand(x0: number, z0: number, x1: number, z1: number, glass: number, mesh: number, faint = false): void {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (glass > 0) {
      this.wallRect(x0, z0, x1, z1, 0, glass, faint ? this.faintGlassMat : this.glassMat);
      // Panel joints about every 2 m and a rail on top.
      const panels = Math.max(1, Math.round(len / 2));
      for (let i = 0; i <= panels; i++) {
        const k = i / panels;
        this.addPost(x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, glass, 0.025);
      }
      this.addRail(x0, z0, x1, z1, glass);
    }
    if (mesh > 0) {
      this.wallRect(x0, z0, x1, z1, glass, glass + mesh, this.meshMaterial(len, mesh, faint ? 0.22 : 1));
      this.addRail(x0, z0, x1, z1, glass + mesh);
    }
  }

  private addPost(x: number, z: number, h: number, r: number): void {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), this.frameMat);
    p.position.set(x, h / 2, z - NET_Z);
    p.castShadow = true;
    this.scene.add(p);
  }

  private addRail(x0: number, z0: number, x1: number, z1: number, h: number): void {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.04), this.frameMat);
    r.position.set((x0 + x1) / 2, h, (z0 + z1) / 2 - NET_Z);
    r.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    this.scene.add(r);
  }

  private buildWalls(): void {
    for (const z of [0, COURT_LENGTH_M]) {
      // The near back wall stands between the camera and the court: drawn faint, as in the 2D version.
      this.wallBand(-HALF_W, z, HALF_W, z, BACK_WALL.glass, BACK_WALL.mesh, z === COURT_LENGTH_M);
      for (const x of [-HALF_W, 0, HALF_W]) this.addPost(x, z, BACK_WALL.glass + BACK_WALL.mesh, 0.05);
    }
    for (const seg of sideWallSegments()) {
      for (const x of [-HALF_W, HALF_W]) {
        this.wallBand(x, seg.z0, x, seg.z1, seg.glass, seg.mesh);
        this.addPost(x, seg.z0, seg.glass + seg.mesh, 0.05);
        this.addPost(x, seg.z1, seg.glass + seg.mesh, 0.05);
      }
    }
  }

  private buildNet(): void {
    const net = new THREE.Mesh(new THREE.PlaneGeometry(COURT_WIDTH_M, NET_HEIGHT_M), this.meshMaterial(COURT_WIDTH_M, NET_HEIGHT_M));
    net.position.set(0, NET_HEIGHT_M / 2, 0);
    this.scene.add(net);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(COURT_WIDTH_M, 0.07, 0.025), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
    tape.position.set(0, NET_HEIGHT_M, 0);
    tape.castShadow = true;
    this.scene.add(tape);
    for (const x of [-HALF_W, HALF_W]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.07, 10), this.frameMat);
      post.position.set(x, 0.535, 0);
      post.castShadow = true;
      this.scene.add(post);
    }
  }

  // ---- state and effects ----

  /** Court metres (x across, z along, h above the floor). */
  setBall(x: number, z: number, h: number): void {
    this.ball.position.set(x, h + BALL_RADIUS * 0.5, z - NET_Z);
    this.ballBlob.position.set(x, 0.006, z - NET_Z);
    const s = Math.max(0.35, 1 - h * 0.12);
    this.ballBlob.scale.setScalar(s);
    (this.ballBlob.material as THREE.MeshBasicMaterial).opacity = 0.45 * s;
    this.trailPts.push(this.ball.position.clone());
    if (this.trailPts.length > TRAIL_POINTS) this.trailPts.shift();
    const attr = this.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
    const n = this.trailPts.length;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      // The oldest point is repeated at the start until the trail is full.
      const q = this.trailPts[Math.max(0, i - (TRAIL_POINTS - n))];
      attr.setXYZ(i, q.x, q.y, q.z);
    }
    attr.needsUpdate = true;
  }

  clearTrail(): void {
    this.trailPts.length = 0;
  }

  /** Court metres. */
  placePlayer(i: number, x: number, z: number, snap = false): void {
    const p = this.players[i];
    if (!p) return;
    if (snap) p.snap(x, z - NET_Z);
    else p.moveTo(x, z - NET_Z);
  }

  /** Short effect at a ball contact: a flash, plus a ring on the floor for a bounce. */
  pulse(kind: 'bounce' | 'glass' | 'mesh' | 'net' | 'out', x: number, z: number, h: number, strength = 1): void {
    const pos = new THREE.Vector3(x, h, z - NET_Z);
    const flashMat = new THREE.SpriteMaterial({
      map: this.glow,
      color: kind === 'glass' ? 0xcfeaff : 0xfff0a0,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flash = new THREE.Sprite(flashMat);
    flash.position.copy(pos);
    flash.scale.setScalar(0.5);
    this.scene.add(flash);
    this.pulses.push({ obj: flash, age: 0, life: 0.28, grow: 2.4 * strength, mat: flashMat });
    if (kind === 'bounce') {
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.17, 28), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.01, z - NET_Z);
      this.scene.add(ring);
      this.pulses.push({ obj: ring, age: 0, life: 0.5, grow: 4 * strength, mat: ringMat });
    }
    if (kind === 'glass' && strength > 1.2) this.shake = 0.18;
  }

  setCamera(mode: CameraMode): void {
    this.mode = mode;
    if (mode === 'tv') this.camTarget = tvCamera();
    else if (mode === 'low') this.camTarget = lowCamera();
    else this.updateOrbitTarget();
  }

  getCameraMode(): CameraMode {
    return this.mode;
  }

  private updateOrbitTarget(): void {
    const { theta, phi, radius } = this.orbit;
    const look = new THREE.Vector3(0, 1.2, 0);
    const pos = new THREE.Vector3(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta),
    ).add(look);
    this.camTarget = { pos, look, fov: 40 };
  }

  private bindOrbit(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointerup', () => (this.dragging = false));
    c.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      if (this.mode !== 'orbit') {
        // Dragging switches to the free camera, starting from where it is now.
        const off = this.cam.pos.clone().sub(new THREE.Vector3(0, 1.2, 0));
        this.orbit.radius = Math.min(60, off.length());
        this.orbit.theta = Math.atan2(off.x, off.z);
        this.orbit.phi = Math.acos(THREE.MathUtils.clamp(off.y / off.length(), -1, 1));
        this.mode = 'orbit';
        this.onModeChange?.('orbit');
      }
      this.orbit.theta -= (e.clientX - this.lastX) * 0.008;
      this.orbit.phi = THREE.MathUtils.clamp(this.orbit.phi - (e.clientY - this.lastY) * 0.006, 0.25, 1.5);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.updateOrbitTarget();
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.orbit.radius = THREE.MathUtils.clamp(this.orbit.radius * (1 + e.deltaY * 0.001), 8, 60);
        if (this.mode === 'orbit') this.updateOrbitTarget();
      },
      { passive: false },
    );
  }

  /** Called when a drag switches the camera to the free mode. */
  onModeChange?: (mode: CameraMode) => void;

  resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Advance animations by dt seconds and draw one frame. */
  frame(dtIn: number): void {
    const dt = Math.max(0, dtIn);
    for (const p of this.players) p.update(dt);

    // Pulses grow and fade.
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        this.scene.remove(p.obj);
        p.mat.dispose();
        this.pulses.splice(i, 1);
        continue;
      }
      p.obj.scale.setScalar(0.5 + p.grow * k);
      p.mat.opacity = 0.9 * (1 - k);
    }

    // Camera glides to its target; a hard glass hit shakes it briefly.
    const f = 1 - Math.exp(-dt * 4.5);
    this.cam.pos.lerp(this.camTarget.pos, f);
    this.cam.look.lerp(this.camTarget.look, f);
    this.cam.fov += (this.camTarget.fov - this.cam.fov) * f;
    this.camera.position.copy(this.cam.pos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const a = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    }
    this.camera.lookAt(this.cam.look);
    if (Math.abs(this.camera.fov - this.cam.fov) > 0.01) {
      this.camera.fov = this.cam.fov;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObs.disconnect();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
