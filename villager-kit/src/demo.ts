import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import '@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput';
import '@babylonjs/core/Cameras/Inputs/arcRotateCameraMouseWheelInput';
import { Engine } from '@babylonjs/core/Engines/engine';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Scene } from '@babylonjs/core/scene';
import { PALETTE } from '../../src/config/palette';
import type { CitizenDef, CitizenGender } from '../../src/outer/townLayout';
import { citizenAppearance, CITIZEN_PALETTES, type CitizenAppearance, CitizenVisual, SteamPool, Torch } from './index';

type PaletteName = keyof typeof CITIZEN_PALETTES;
type FigureState = 'Peaceful' | 'Angry';
interface FigureSnapshot {
  bodyMeshId: number;
  bodyVertexCount: number;
  bodyTriangleCount: number;
  vertexColorChecksum: number;
  torchPosition: { x: number; y: number; z: number };
}
interface VillagerSnapshot {
  gender: CitizenGender;
  states: { left: FigureState; right: FigureState };
  colors: CitizenAppearance;
  meshCount: number;
  vertexCount: number;
  drawCallCount: number;
  sceneTriangleCount: number;
  finiteVertices: boolean;
  steamInstanceCount: number;
  torchesAttached: number;
  renderedFrames: number;
  figures: FigureSnapshot[];
}
interface VillagerTestHook {
  snapshot(): VillagerSnapshot;
  setGender(gender: CitizenGender): void;
  setPalette(name: PaletteName): void;
  setStateSwapped(swapped: boolean): void;
  setAppearance(overrides: Partial<CitizenAppearance>): void;
  dispose(): void;
}
declare global { interface Window { __villagers: VillagerTestHook } }

const canvas = document.getElementById('villagers') as HTMLCanvasElement;
const paletteSelect = document.getElementById('palette') as HTMLSelectElement;
const genderSelect = document.getElementById('gender') as HTMLSelectElement;
const swapButton = document.getElementById('swap') as HTMLButtonElement;
const labels = [document.getElementById('left-label')!, document.getElementById('right-label')!];
const colorInputs = ['tunic', 'scarf', 'hair', 'skin'].map((id) => document.getElementById(id) as HTMLInputElement);
const engine = new Engine(canvas, true, { stencil: false, audioEngine: false, preserveDrawingBuffer: false });
const scene = new Scene(engine);
const sky = Color3.Lerp(Color3.FromHexString(PALETTE.ivory), Color3.FromHexString(PALETTE.powder), 0.65);
scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
scene.skipPointerMovePicking = true;

const ground = MeshBuilder.CreateGround('villager.preview.ground', { width: 9, height: 6 }, scene);
const groundMat = new StandardMaterial('villager.preview.groundMat', scene);
groundMat.disableLighting = true;
groundMat.diffuseColor = Color3.FromHexString(PALETTE.sage);
groundMat.emissiveColor = Color3.FromHexString(PALETTE.sage);
ground.material = groundMat;
const instrumentation = new SceneInstrumentation(scene);
const camera = new ArcRotateCamera('villager.preview.camera', Math.PI / 2, 1.12, 3.7, new Vector3(0, 1.1, 0), scene);
camera.lowerRadiusLimit = 2.5;
camera.upperRadiusLimit = 8;
camera.lowerBetaLimit = 0.65;
camera.upperBetaLimit = 1.45;
camera.wheelPrecision = 45;
camera.minZ = 0.05;
camera.attachControl(canvas, true);

const baseDef: Omit<CitizenDef, 'gender'> = {
  colors: 'earthy', head: 'hair', beard: true, torch: false,
  personalBase: 0, loop: 0, start: 0, scale: 1, seed: 17,
};
const initial = citizenAppearance(baseDef.colors, baseDef.seed, CITIZEN_PALETTES.earthy);
const requestedGender = new URLSearchParams(location.search).get('gender');
let gender: CitizenGender = requestedGender === 'male' ? 'male' : 'female';
genderSelect.value = gender;
let figures: CitizenVisual[] = [];
let torches: Torch[] = [];
const steam = new SteamPool(scene, 12);
const steamAt = new Vector3();
let appearance: CitizenAppearance = { ...initial };
let swapped = false;
let puffTimer = 0;
let renderedFrames = 0;
let disposed = false;

function createFigures(): void {
  const def: CitizenDef = { ...baseDef, gender, seed: gender === 'female' ? 18 : baseDef.seed, beard: gender === 'male' };
  figures = [new CitizenVisual(scene, def, appearance), new CitizenVisual(scene, def, appearance)];
  figures[0]!.root.position.x = 0.78;
  figures[1]!.root.position.x = -0.78;
  torches = figures.map((figure) => new Torch(scene, figure.torchMount));
}

function setGender(next: CitizenGender): void {
  genderSelect.value = next;
  if (gender === next) return;
  for (const torch of torches) torch.dispose();
  for (const figure of figures) figure.dispose();
  gender = next;
  createFigures();
}

createFigures();

function applyAppearance(next: Partial<CitizenAppearance>): void {
  appearance = { ...appearance, ...next };
  for (const figure of figures) figure.setAppearance(appearance);
  for (const input of colorInputs) input.value = appearance[input.id as 'tunic' | 'scarf' | 'hair' | 'skin'];
}
function setPalette(name: PaletteName): void {
  paletteSelect.value = name;
  applyAppearance(citizenAppearance(baseDef.colors, baseDef.seed, CITIZEN_PALETTES[name]));
}
function setSwapped(value: boolean): void {
  swapped = value;
  swapButton.setAttribute('aria-pressed', String(swapped));
  swapButton.textContent = swapped ? 'Put peaceful on the left' : 'Swap peaceful and angry';
}

paletteSelect.addEventListener('change', () => setPalette(paletteSelect.value as PaletteName));
genderSelect.addEventListener('change', () => setGender(genderSelect.value as CitizenGender));
for (const input of colorInputs) input.addEventListener('input', () => applyAppearance({ [input.id]: input.value }));
swapButton.addEventListener('click', () => setSwapped(!swapped));

function snapshot(): VillagerSnapshot {
  const meshes = scene.meshes.filter((mesh) => mesh.isEnabled());
  const figureData = figures.map((figure): FigureSnapshot => {
    const body = figure.root.getChildMeshes().find((mesh) => mesh.name.endsWith('.mesh'))!;
    const colors = body.getVerticesData(VertexBuffer.ColorKind) ?? [];
    const vertexColorChecksum = Array.from(colors).reduce((hash, value) => (hash * 31 + Math.round(value * 255)) >>> 0, 7);
    figure.root.computeWorldMatrix(true);
    figure.torchMount.computeWorldMatrix(true);
    const torchPosition = figure.torchMount.getAbsolutePosition();
    return {
      bodyMeshId: body.uniqueId,
      bodyVertexCount: body.getTotalVertices(),
      bodyTriangleCount: (body.getIndices()?.length ?? 0) / 3,
      vertexColorChecksum,
      torchPosition: { x: torchPosition.x, y: torchPosition.y, z: torchPosition.z },
    };
  });
  const sceneTriangleCount = meshes.reduce((sum, mesh) => sum + (mesh.getIndices()?.length ?? 0) / 3, 0);
  const finiteVertices = meshes.every((mesh) => {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    return positions === null || Array.from(positions).every((value) => Number.isFinite(value));
  });
  const steamCloud = scene.meshes.find((mesh): mesh is Mesh => mesh.name === 'steamCloudTemplate');
  const torchesAttached = scene.meshes.filter((mesh) =>
    (mesh.name === 'torchStick' || mesh.name === 'torchFlame') && mesh.parent?.name === 'citizen.torchMount',
  ).length;
  return {
    gender,
    states: swapped ? { left: 'Angry', right: 'Peaceful' } : { left: 'Peaceful', right: 'Angry' },
    colors: { ...appearance },
    meshCount: meshes.length,
    vertexCount: meshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0),
    drawCallCount: instrumentation.drawCallsCounter.current,
    sceneTriangleCount,
    finiteVertices,
    steamInstanceCount: steamCloud?.thinInstanceCount ?? 0,
    torchesAttached,
    renderedFrames,
    figures: figureData,
  };
}
function dispose(): void {
  if (disposed) return;
  disposed = true;
  engine.stopRenderLoop(render);
  for (const torch of torches) torch.dispose();
  for (const figure of figures) figure.dispose();
  steam.dispose();
  instrumentation.dispose();
  scene.dispose();
  engine.dispose();
}
window.__villagers = { snapshot, setGender, setPalette, setStateSwapped: setSwapped, setAppearance: applyAppearance, dispose };

let previous = performance.now();
function render(): void {
  if (disposed) return;
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
  previous = now;
  const angryIndex = swapped ? 0 : 1;
  labels[0]!.textContent = swapped ? 'Angry' : 'Peaceful';
  labels[1]!.textContent = swapped ? 'Peaceful' : 'Angry';
  figures.forEach((figure, index) => {
    const angry = index === angryIndex;
    const state = { speed: 0, heading: 0, agitation: angry ? 0.92 : 0, far: false, torchRaised: angry };
    figure.update(dt, state);
    torches[index]!.setVisible(angry);
    torches[index]!.setIntensity(angry ? state.agitation : 0);
    torches[index]!.update(dt);
  });
  puffTimer -= dt;
  if (puffTimer <= 0) {
    const angry = figures[angryIndex]!;
    steamAt.set(angry.root.position.x, angry.root.position.y + 1.45, angry.root.position.z + 0.08);
    steam.puff(steamAt, 0.85);
    puffTimer = 0.48;
  }
  steam.update(dt);
  scene.render();
  renderedFrames++;
}
engine.runRenderLoop(render);
window.addEventListener('resize', () => engine.resize());
window.addEventListener('pagehide', dispose, { once: true });

