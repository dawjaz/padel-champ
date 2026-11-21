import * as THREE from 'three';
import { Player3D, STROKES, strokeContact, strokeDuration, type PlayerLook, type Stroke } from './player3d';

/**
 * Character viewer (char.html): one player on a small stage, to judge the model and the animations up close.
 * Buttons play a stroke (looping), IDLE and RUN. URL: ?stroke=smash&t=0.36 freezes a stroke at that time (for screenshots),
 * &yaw=1.2 turns the camera, &look=1 picks another colour set.
 */

const LOOKS: PlayerLook[] = [
  { shirt: 0xd8402e, shorts: 0x20232f, skin: 0xc68642, hair: 0x2b1b12, racket: 0xf2b01e, band: 0xffffff },
  { shirt: 0x19a89a, shorts: 0x20232f, skin: 0xf1c6a0, hair: 0xc9792b, racket: 0xffffff },
  { shirt: 0x2a58d6, shorts: 0xe8e8ee, skin: 0x8a5a3b, hair: 0x101010, racket: 0xf2b01e },
  { shirt: 0xe0559c, shorts: 0xe8e8ee, skin: 0xe3b08a, hair: 0x4a2a14, racket: 0x222222, band: 0xffffff },
];

const stageEl = document.getElementById('stage');
const labelEl = document.getElementById('label');
const barEl = document.getElementById('bar');
if (!stageEl || !labelEl || !barEl) throw new Error('char.html is missing its elements');
const stage: HTMLElement = stageEl;
const label: HTMLElement = labelEl;
const bar: HTMLElement = barEl;
const params = new URLSearchParams(location.search);
if (params.has('nobar')) bar.style.display = 'none';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
stage.appendChild(renderer.domElement);
renderer.domElement.style.display = 'block';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1430);
scene.add(new THREE.HemisphereLight(0xb9d4ff, 0x1a2640, 1.0));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
sun.position.set(-3, 6, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
scene.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshStandardMaterial({ color: 0x1d5fb0, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.4, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.002;
scene.add(ring);

const look = LOOKS[Number(params.get('look') ?? 0) % LOOKS.length];
const player = new Player3D(look);
player.snap(0, 0);
player.group.rotation.y = 0; // faces +Z, towards the camera
scene.add(player.group);

const camera = new THREE.PerspectiveCamera(32, 9 / 16, 0.1, 50);
let yaw = Number(params.get('yaw') ?? 0.5);
let pitch = 0.18;
const dist = 7.4;
function placeCamera(): void {
  camera.position.set(Math.sin(yaw) * dist, 1.0 + pitch * 3, Math.cos(yaw) * dist);
  camera.lookAt(0, 1.0, 0);
}
placeCamera();

function resize(): void {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = `${w}px`;
  renderer.domElement.style.height = `${h}px`;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

let dragging = false;
let lastX = 0;
renderer.domElement.addEventListener('pointerdown', (e) => ((dragging = true), (lastX = e.clientX)));
window.addEventListener('pointerup', () => (dragging = false));
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yaw -= (e.clientX - lastX) * 0.01;
  lastX = e.clientX;
  placeCamera();
});

// ---- modes ----
type Mode = Stroke | 'idle' | 'run';
let mode: Mode = 'idle';
let slow = false;
let sinceStroke = 0;
const buttons = new Map<string, HTMLButtonElement>();
function setMode(m: Mode): void {
  mode = m;
  sinceStroke = 0;
  for (const [id, b] of buttons) b.classList.toggle('on', id === m);
  label.textContent = m === 'idle' || m === 'run' ? m.toUpperCase() : `${m.toUpperCase()} · contact ${strokeContact(m).toFixed(2)} s`;
  if (m === 'run') player.moveTo(0, 0);
}
function addButton(id: string, text: string, onClick: () => void): void {
  const b = document.createElement('button');
  b.textContent = text;
  b.onclick = onClick;
  bar.appendChild(b);
  buttons.set(id, b);
}
for (const s of STROKES) addButton(s, s.toUpperCase(), () => setMode(s));
addButton('idle', 'IDLE', () => setMode('idle'));
addButton('run', 'RUN', () => setMode('run'));
addButton('slow', 'SLOW', () => {
  slow = !slow;
  buttons.get('slow')?.classList.toggle('on', slow);
});

const frozenStroke = params.get('stroke') as Stroke | null;
const frozenT = Number(params.get('t') ?? 0);
if (frozenStroke && STROKES.includes(frozenStroke)) {
  player.showStroke(frozenStroke, frozenT);
  label.textContent = `${frozenStroke.toUpperCase()} t=${frozenT.toFixed(2)}`;
} else if (params.get('run') !== null) {
  player.showRun(Number(params.get('run')));
  label.textContent = 'RUN';
} else setMode('idle');
const frozen = (frozenStroke && STROKES.includes(frozenStroke)) || params.get('run') !== null;

let runAngle = 0;
let last = performance.now();
function loop(now: number): void {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)) * (slow ? 0.3 : 1);
  last = now;
  if (!frozen) {
    if (mode === 'run') {
      // Jog on the spot in a circle so the cycle can be seen.
      runAngle += dt * 1.6;
      player.moveTo(Math.sin(runAngle) * 1.2, Math.cos(runAngle) * 1.2 - 1.2);
      player.group.rotation.y = Math.atan2(Math.cos(runAngle), -Math.sin(runAngle)) + Math.PI / 2;
    } else {
      player.group.position.set(0, 0, 0);
      player.group.rotation.y = 0;
      if (mode !== 'idle') {
        sinceStroke += dt;
        if (sinceStroke >= strokeDuration(mode) + 0.4) {
          sinceStroke = 0;
          player.swing(mode);
        } else if (sinceStroke === dt) player.swing(mode);
      }
    }
    player.update(dt);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
