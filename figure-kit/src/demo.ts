import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import '@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput';
import '@babylonjs/core/Cameras/Inputs/arcRotateCameraMouseWheelInput';
import { PlayerVisual } from './figure';
import { damp } from './figure/math';

/**
 * Demo: the figure alone on a small meadow.
 * WASD = walk, Space = breathe in, drag = look around, wheel = zoom, P = demo walk on/off.
 */
const WALK_SPEED = 4;
const ACCELERATION = 9;
const DECELERATION = 11;
const TURN_SHARPNESS = 10;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { stencil: false, audioEngine: false });
const scene = new Scene(engine);
scene.clearColor = Color4.FromHexString('#F4EEDFFF');
scene.skipPointerMovePicking = true;

function flat(name: string, hex: string): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString(hex);
  return mat;
}

const ground = MeshBuilder.CreateDisc('ground', { radius: 14, tessellation: 64 }, scene);
ground.rotation.x = Math.PI / 2;
ground.material = flat('groundMat', '#A8B58A');
const stoneMat = flat('stoneMat', '#A39E94');
for (let i = 0; i < 7; i++) {
  const a = (i / 7) * Math.PI * 2;
  const stone = MeshBuilder.CreateCylinder(`stone${i}`, { height: 0.25, diameter: 0.6, tessellation: 6 }, scene);
  stone.position.set(Math.sin(a) * 6, 0.12, Math.cos(a) * 6);
  stone.material = stoneMat;
}

const camera = new ArcRotateCamera('cam', -Math.PI / 2 - 0.5, 1.15, 5, new Vector3(0, 0.8, 0), scene);
camera.lowerRadiusLimit = 1.8;
camera.upperRadiusLimit = 14;
camera.upperBetaLimit = 1.5;
camera.wheelPrecision = 40;
camera.minZ = 0.05;
camera.attachControl(canvas, true);

// --- The figure: build once, then update every frame. ---
const figure = new PlayerVisual(scene);

// --- Tiny input: keys held down. ---
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyP' && !e.repeat) {
    demo = !demo;
    demoTime = 0;
  }
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const pos = new Vector3();
const vel = new Vector3();
let heading = 0;
let breath = 0;
let demo = new URLSearchParams(location.search).has('demo');
let demoTime = 0;

/** Demo walk: a loop with stops, turns and a long rest to show every animation. */
function demoInput(t: number): [number, number, boolean] {
  const c = t % 22;
  if (c < 4) return [Math.sin(c * 0.8), 1, false]; // walk and weave
  if (c < 6.5) return [0, 0, false]; // stop: the cloak swings, the hood nods
  if (c < 9) return [1, 0.2, false]; // sharp turn
  if (c < 10) return [0, 0, false];
  if (c < 13) return [-0.3, -1, false]; // walk back toward the camera
  if (c < 14) return [0, 0, false];
  if (c < 17.5) return [0, 0, true]; // breathe in
  return [0, 0, false]; // rest: after a while, the figure looks around
}

function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

engine.runRenderLoop(() => {
  const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
  let ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let iz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  let inhale = keys.has('Space');
  if (demo) {
    demoTime += dt;
    [ix, iz, inhale] = demoInput(demoTime);
  }

  // Walk relative to the camera: up = away from the camera.
  const yaw = -camera.alpha - Math.PI / 2;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const dx = fx * iz + fz * ix;
  const dz = fz * iz - fx * ix;
  const len = Math.hypot(dx, dz);
  const wants = len > 0.01;
  const k = damp(wants ? ACCELERATION : DECELERATION, dt);
  vel.x += ((wants ? dx / Math.max(1, len) : 0) * WALK_SPEED - vel.x) * k;
  vel.z += ((wants ? dz / Math.max(1, len) : 0) * WALK_SPEED - vel.z) * k;
  if (!wants && Math.hypot(vel.x, vel.z) < 0.02) vel.set(0, 0, 0);
  if (wants && Math.hypot(vel.x, vel.z) > 0.05) {
    heading += angleDelta(heading, Math.atan2(vel.x, vel.z)) * damp(TURN_SHARPNESS, dt);
  }
  breath += ((inhale ? 1 : 0) - breath) * damp(inhale ? 0.6 : 1.2, dt);
  pos.addInPlace(vel.scale(dt));
  const r = Math.hypot(pos.x, pos.z);
  if (r > 12) pos.scaleInPlace(12 / r);

  // Tell the figure where it is and what it does. It animates itself.
  const speed = Math.hypot(vel.x, vel.z);
  figure.root.position.copyFrom(pos);
  figure.update(dt, {
    speed,
    speedRatio: Math.min(1, speed / WALK_SPEED),
    heading,
    breathLevel: breath,
    glow: breath * 0.6,
    awake: 1,
  });

  camera.target.x += (pos.x - camera.target.x) * damp(4, dt);
  camera.target.z += (pos.z - camera.target.z) * damp(4, dt);
  scene.render();
});

window.addEventListener('resize', () => engine.resize());
(window as unknown as { __fig: unknown }).__fig = { ready: true, figure, camera };
