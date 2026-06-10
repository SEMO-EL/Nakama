import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/loaders/GLTFLoader.js";

const root = document.documentElement;
const body = document.body;
const gate = document.getElementById("gate");
const toggle = document.getElementById("sideToggle");
const progress = document.getElementById("progress");
const cursorAura = document.getElementById("cursorAura");
const canvas = document.getElementById("katanaCanvas");
const fallback = document.getElementById("canvasFallback");

let theme = window.__nakamaTheme || document.documentElement.dataset.theme || "black";
let model, mixer;
let targetRot = { x: 0, y: 0 };
let mouse = { x: 0, y: 0 };
let scrollProgress = 0;

function setTheme(next) {
  theme = next;
  root.dataset.theme = next;
  window.__nakamaTheme = next;
  const word = document.querySelector(".theme-word");
  if (word) word.textContent = next === "black" ? "Black" : "White";
}

function enter(side) {
  setTheme(side);
  if (gate) gate.classList.add("hide");
  body.classList.remove("lock");
  window.__nakamaGateEntered = true;
  window.__nakamaTheme = side;
}

if (!window.__nakamaGateEntered) body.classList.add("lock");
// Gate click/hover has a non-module fallback in index.html.
// This module only adds the same behavior if the fallback did not run.
if (gate && !window.__nakamaGateEntered) {
  gate.querySelectorAll("[data-side]").forEach(btn => {
    btn.addEventListener("click", () => enter(btn.dataset.side));
  });
}

if (toggle) {
  toggle.addEventListener("click", () => setTheme(theme === "black" ? "white" : "black"));
}

if (gate) {
  const blackGate = gate.querySelector(".gate-black");
  const whiteGate = gate.querySelector(".gate-white");
  if (blackGate) blackGate.addEventListener("mouseenter", () => gate.style.setProperty("--black-width", "68%"));
  if (whiteGate) whiteGate.addEventListener("mouseenter", () => gate.style.setProperty("--black-width", "32%"));
  gate.addEventListener("mouseleave", () => gate.style.setProperty("--black-width", "50%"));
}

window.addEventListener("pointermove", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  cursorAura.style.left = `${e.clientX}px`;
  cursorAura.style.top = `${e.clientY}px`;
});

function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = max > 0 ? window.scrollY / max : 0;
  progress.style.width = `${scrollProgress * 100}%`;
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- THREE.JS SCENE ---------- */
let scene, camera, renderer, clock;
let loaded = false;

function init3D() {
  if (!canvas || !window.WebGLRenderingContext) {
    body.classList.add("no-webgl");
    return;
  }

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.025);

  camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0.35, 1.1, 6.0);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x080808, 1.35);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(3.5, 6, 4);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xff1c2d, 2.0);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  const gold = new THREE.PointLight(0xd6a33f, 1.5, 10);
  gold.position.set(2, 1.5, 2);
  scene.add(gold);

  const loader = new GLTFLoader();
  loader.load(
    "assets/models/damascus_steel_katana.glb",
    (gltf) => {
      model = gltf.scene;
      model.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = false;
          obj.receiveShadow = false;
          if (obj.material) {
            obj.material.envMapIntensity = 1.8;
            obj.material.needsUpdate = true;
          }
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      model.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 3.75 / maxDim;
      model.scale.setScalar(scale);

      model.rotation.set(0.25, -0.4, -0.18);
      model.position.set(1.15, -0.05, 0);

      scene.add(model);
      loaded = true;
      fallback.style.display = "none";

      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach(clip => mixer.clipAction(clip).play());
      }
    },
    undefined,
    (err) => {
      console.warn("3D model failed to load. Use a local server, not file://", err);
      body.classList.add("no-webgl");
    }
  );

  clock = new THREE.Clock();
  window.addEventListener("resize", resize);
  resize();
  animate();
}

function resize() {
  if (!renderer || !camera) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);

  if (model) {
    const scrollSpin = scrollProgress * Math.PI * 2.2;
    targetRot.y = -0.35 + scrollSpin + mouse.x * 0.22;
    targetRot.x = 0.18 + mouse.y * 0.10;

    model.rotation.y += (targetRot.y - model.rotation.y) * 0.055;
    model.rotation.x += (targetRot.x - model.rotation.x) * 0.045;
    model.rotation.z = -0.22 + Math.sin(performance.now() * 0.0007) * 0.025;

    const heroPhase = Math.min(1, window.scrollY / window.innerHeight);
    model.position.x = 1.18 - heroPhase * 0.75;
    model.position.y = -0.05 + Math.sin(performance.now() * 0.001) * 0.035;
    model.scale.setScalar(0.95 + heroPhase * 0.15);
  }

  if (renderer && scene && camera) renderer.render(scene, camera);
}

init3D();

/* Subtle card pointer outline only — not the sketchy zoom */
document.querySelectorAll("[data-tilt]").forEach(card => {
  card.addEventListener("pointermove", e => {
    const r = card.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    card.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(196,154,58,.12), rgba(6,6,6,.66) 42%)`;
  });
  card.addEventListener("pointerleave", () => card.style.background = "");
});
