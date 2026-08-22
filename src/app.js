import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import "./styles.css";

const ui = {
  app: document.getElementById("app"),
  canvas: document.getElementById("scene"),
  projectCode: document.getElementById("project-code"),
  viewerTitle: document.getElementById("viewer-title"),
  modelState: document.getElementById("model-state"),
  fps: document.getElementById("fps-readout"),
  gestureLatency: document.getElementById("gesture-latency"),
  overallSize: document.getElementById("overall-size"),
  productSourceToggle: document.getElementById("product-source-toggle"),
  productSourcePanel: document.getElementById("product-source-panel"),
  productSourceClose: document.getElementById("product-source-close"),
  productSourceStatus: document.getElementById("product-source-status"),
  activeProductName: document.getElementById("active-product-name"),
  productCompatibility: document.getElementById("product-compatibility"),
  productModelFile: document.getElementById("product-model-file"),
  productManifestFile: document.getElementById("product-manifest-file"),
  productSourceUnits: document.getElementById("product-source-units"),
  productUpAxis: document.getElementById("product-up-axis"),
  productLoadLocal: document.getElementById("product-load-local"),
  productModelUrl: document.getElementById("product-model-url"),
  productManifestUrl: document.getElementById("product-manifest-url"),
  productLoadUrl: document.getElementById("product-load-url"),
  productClear: document.getElementById("product-clear"),
  productRecent: document.getElementById("product-recent"),
  productLoadRecent: document.getElementById("product-load-recent"),
  productDropOverlay: document.getElementById("product-drop-overlay"),
  cameraToggle: document.getElementById("camera-toggle"),
  cameraSettingsToggle: document.getElementById("camera-settings-toggle"),
  cameraSettingsPanel: document.getElementById("camera-settings-panel"),
  cameraSettingsClose: document.getElementById("camera-settings-close"),
  cameraState: document.getElementById("camera-state"),
  cameraPlaceholder: document.getElementById("camera-placeholder"),
  cameraDevice: document.getElementById("camera-device"),
  cameraScan: document.getElementById("camera-scan"),
  cameraCapabilitySummary: document.getElementById("camera-capability-summary"),
  cameraPreset: document.getElementById("camera-preset"),
  cameraResolution: document.getElementById("camera-resolution"),
  cameraFps: document.getElementById("camera-fps"),
  cameraColorProfile: document.getElementById("camera-color-profile"),
  cameraActiveMode: document.getElementById("camera-active-mode"),
  cameraModeNote: document.getElementById("camera-mode-note"),
  cameraHardwareCount: document.getElementById("camera-hardware-count"),
  cameraHardwareControls: document.getElementById("camera-hardware-controls"),
  cameraResetRecommended: document.getElementById("camera-reset-recommended"),
  cameraApply: document.getElementById("camera-apply"),
  video: document.getElementById("webcam"),
  handOverlay: document.getElementById("hand-overlay"),
  gestureReticle: document.getElementById("gesture-reticle"),
  sceneReticle: document.getElementById("scene-reticle"),
  gestureName: document.getElementById("gesture-name"),
  gestureConfidence: document.getElementById("gesture-confidence"),
  confidenceFill: document.getElementById("confidence-fill"),
  assemble: document.getElementById("assemble-button"),
  explode: document.getElementById("explode-button"),
  focus: document.getElementById("focus-button"),
  dimensions: document.getElementById("dimensions-button"),
  home: document.getElementById("home-button"),
  slider: document.getElementById("explosion-slider"),
  sliderOutput: document.getElementById("explosion-output"),
  selectedPart: document.getElementById("selected-part"),
  selectedDimensions: document.getElementById("selected-dimensions"),
  selectedEngineeringStatus: document.getElementById("selected-engineering-status"),
  dimensionLayer: document.getElementById("dimension-layer"),
  toast: document.getElementById("toast"),
};

const scene = new THREE.Scene();
const assembledFogDensity = 0.00052;
const explodedFogDensity = 0.00008;
scene.fog = new THREE.FogExp2(0x03080d, assembledFogDensity);

const renderer = new THREE.WebGLRenderer({
  canvas: ui.canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 10000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.screenSpacePanning = true;
controls.minDistance = 90;
controls.maxDistance = 1800;
controls.maxPolarAngle = Math.PI * 0.95;

const ambient = new THREE.HemisphereLight(0xb5f2ff, 0x071018, 1.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xe9fbff, 2.8);
keyLight.position.set(420, 620, 540);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x21d8ff, 2.5);
rimLight.position.set(-520, 280, -420);
scene.add(rimLight);

const warmLight = new THREE.PointLight(0xffaa55, 3.5, 780, 1.5);
warmLight.position.set(210, 210, -260);
scene.add(warmLight);

// Inspection lights follow the viewer and fade in with the exploded view. This
// keeps the inner mechanisms legible even when their normals face away from the
// fixed studio lights.
const inspectionTarget = new THREE.Object3D();
scene.add(inspectionTarget);

const inspectionFrontLight = new THREE.DirectionalLight(0xe7faff, 0);
inspectionFrontLight.target = inspectionTarget;
scene.add(inspectionFrontLight);

const inspectionTopLight = new THREE.DirectionalLight(0x85ddff, 0);
inspectionTopLight.target = inspectionTarget;
scene.add(inspectionTopLight);

const grid = new THREE.GridHelper(1100, 22, 0x19708a, 0x0b2c39);
grid.material.transparent = true;
grid.material.opacity = 0.28;
grid.position.y = -12;
scene.add(grid);

const platform = new THREE.Mesh(
  new THREE.CylinderGeometry(184, 205, 4, 64, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x27d9ff, transparent: true, opacity: 0.12, wireframe: true }),
);
platform.position.y = -10;
scene.add(platform);

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const parts = [];
const dimensionTags = new Map();
const dimensionProjection = new THREE.Vector3();
const dimensionWorldPoint = new THREE.Vector3();
const dimensionBox = new THREE.Box3();
const dimensionBoxHelper = new THREE.Box3Helper(dimensionBox, 0x5ee9ff);
dimensionBoxHelper.visible = false;
dimensionBoxHelper.material.transparent = true;
dimensionBoxHelper.material.opacity = 0.78;
scene.add(dimensionBoxHelper);

const dimensionAxisLabels = new Map(
  ["width", "depth", "height"].map((axis) => {
    const label = document.createElement("div");
    label.className = `dimension-axis-label dimension-axis-${axis}`;
    label.hidden = true;
    ui.dimensionLayer.append(label);
    return [axis, label];
  }),
);

let model = null;
let engineeringManifest = null;
let dimensionLabelsVisible = false;
let lastDimensionOverlayAt = 0;
let modelCenter = new THREE.Vector3();
let modelRadius = 300;
let selectedPart = null;
let hoveredPart = null;
let explosionCurrent = 0;
let explosionTarget = 0;
let homeCamera = null;
let homeTarget = null;
let cameraTween = null;
let inspectionReveal = 0;
let activeSourceUnits = "mm";
let activeUpAxis = "Y";
let activeObjectUrls = [];
let modelLoadGeneration = 0;
const inspectionDirection = new THREE.Vector3();

function hashDirection(name) {
  let hash = 2166136261;
  for (const char of name) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const a = ((hash >>> 0) % 6283) / 1000;
  const y = (((hash >>> 8) % 1600) / 1000) - 0.8;
  return new THREE.Vector3(Math.cos(a), y, Math.sin(a)).normalize();
}

function readablePartName(name) {
  const segments = name.split("__");
  const group = segments.length > 1 ? segments[0] : "part";
  const raw = segments.length > 1 ? segments.slice(1).join("__") : name;
  const pretty = raw.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `${pretty}  ·  ${group.replaceAll("_", " ").toUpperCase()}`;
}

const UNIT_TO_MM = { mm: 1, cm: 10, m: 1000, in: 25.4 };

function activeUnitToMillimetres() {
  return UNIT_TO_MM[activeSourceUnits] ?? 1;
}

const dimensionNumber = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatMillimetres(value) {
  return `${dimensionNumber.format(value)} mm`;
}

function formatDimensions(dimensions) {
  if (!dimensions?.length) return "W — · D — · H —";
  const [width, depth, height] = dimensions;
  return `W ${formatMillimetres(width)} · D ${formatMillimetres(depth)} · H ${formatMillimetres(height)}`;
}

function engineeringStatusLabel(record) {
  const engineering = record?.engineering;
  if (!engineering) return "Measured geometry · source status unavailable";
  const status = engineering.geometry_status?.replaceAll("_", " ") ?? "unclassified";
  const type = engineering.part_type?.replaceAll("_", " ") ?? "part";
  const material = engineering.material ? ` · ${engineering.material}` : "";
  return `${status.toUpperCase()} · ${type}${material}`;
}

function recordForPart(part) {
  return part?.userData.engineeringRecord ?? null;
}

function createDimensionTag(part) {
  const record = recordForPart(part);
  const tag = document.createElement("div");
  tag.className = "dimension-tag";
  tag.innerHTML = `<strong>${record?.label ?? part.userData.label}</strong><span>${formatDimensions(record?.dimensionsMm)}</span>`;
  ui.dimensionLayer.append(tag);
  dimensionTags.set(part, tag);
}

function updateSelectedEngineeringUi() {
  const record = recordForPart(selectedPart);
  ui.selectedDimensions.textContent = formatDimensions(record?.dimensionsMm);
  ui.selectedEngineeringStatus.textContent = selectedPart
    ? engineeringStatusLabel(record)
    : "Select a component to inspect its manufacturing status";
  ui.selectedEngineeringStatus.dataset.status = record?.engineering?.geometry_status ?? "none";
}

function prepareMaterial(mesh) {
  const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const material = source.clone();
  material.side = THREE.DoubleSide;
  material.roughness = 0.68;
  material.metalness = mesh.name.startsWith("structure__") ? 0.42 : 0.09;
  if (!(material.emissive instanceof THREE.Color)) material.emissive = new THREE.Color(0x000000);
  mesh.material = material;
  mesh.userData.baseEmissive = material.emissive.clone();
  mesh.userData.baseEmissiveIntensity = material.emissiveIntensity ?? 1;
}

function prepareParts() {
  const overall = new THREE.Box3().setFromObject(model);
  const sphere = overall.getBoundingSphere(new THREE.Sphere());
  modelCenter.copy(sphere.center);
  modelRadius = Math.max(sphere.radius, 1);

  const usedNames = new Set();
  let unnamedPartIndex = 0;

  model.traverse((object) => {
    if (!object.isMesh) return;
    const sourceName = object.name.trim();
    let stableName = sourceName || `part__mesh_${String(++unnamedPartIndex).padStart(3, "0")}`;
    if (usedNames.has(stableName)) {
      const baseName = stableName;
      let duplicate = 2;
      while (usedNames.has(`${baseName}__${duplicate}`)) duplicate += 1;
      stableName = `${baseName}__${duplicate}`;
    }
    object.name = stableName;
    usedNames.add(stableName);
    prepareMaterial(object);
    object.userData.basePosition = object.position.clone();

    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const manifestRecord = engineeringManifest?.parts?.[object.name]
      ?? (sourceName ? engineeringManifest?.parts?.[sourceName] : null);
    const unitFactor = activeUnitToMillimetres();
    object.userData.engineeringRecord = manifestRecord ?? {
      id: object.name,
      label: readablePartName(object.name),
      units: "mm",
      group: object.name.includes("__") ? object.name.split("__")[0] : "part",
      dimensionsMm: [size.x * unitFactor, size.z * unitFactor, size.y * unitFactor],
      engineering: {
        part_type: "unclassified",
        geometry_status: "measured_geometry",
      },
    };
    object.geometry.computeBoundingBox();
    object.userData.dimensionCenter = object.geometry.boundingBox.getCenter(new THREE.Vector3());
    let direction = center.clone().sub(modelCenter);
    if (direction.length() < modelRadius * 0.07) direction = hashDirection(object.name);
    direction.normalize();
    const inverseParentRotation = object.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    direction.applyQuaternion(inverseParentRotation).normalize();

    const group = object.name.split("__")[0];
    const shellBoost = group === "exterior" ? 1.18 : 0.78;
    const partScale = Math.min(Math.max(size.length() / modelRadius, 0.15), 0.7);
    const distance = modelRadius * shellBoost * (0.65 + partScale * 0.4);
    object.userData.explosionOffset = direction.multiplyScalar(distance);
    object.userData.label = readablePartName(object.name);
    parts.push(object);
    createDimensionTag(object);
  });
}

function fitModel() {
  if (!model) return;
  const box = new THREE.Box3().setFromObject(model);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 1);
  const target = sphere.center.clone();
  const position = target.clone().add(new THREE.Vector3(radius * 2.05, radius * 1.34, radius * 2.34));
  camera.position.copy(position);
  controls.target.copy(target);
  camera.near = Math.max(radius / 500, 0.05);
  camera.far = radius * 24;
  camera.updateProjectionMatrix();
  controls.update();
  controls.saveState();
  homeCamera = position.clone();
  homeTarget = target.clone();
  grid.position.y = box.min.y - 10;
  platform.position.set(target.x, box.min.y - 7, target.z);
}

const RECENT_PRODUCTS_KEY = "spatial-inspector-recent-products-v1";
const viewerParams = new URLSearchParams(window.location.search);

function applyUpAxis(root, upAxis) {
  root.rotation.set(0, 0, 0);
  if (upAxis === "Z") root.rotation.x = -Math.PI / 2;
  else if (upAxis === "X") root.rotation.z = Math.PI / 2;
  root.updateMatrixWorld(true);
}

function disposeObject(root) {
  root?.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material?.dispose();
  });
}

function clearCurrentProduct() {
  cameraTween = null;
  selectedPart = null;
  hoveredPart = null;
  ui.focus.disabled = true;
  ui.selectedPart.textContent = "None — aim with two grips and spread, or click a part";
  updateSelectedEngineeringUi();
  dimensionBoxHelper.visible = false;
  for (const label of dimensionAxisLabels.values()) label.hidden = true;
  for (const tag of dimensionTags.values()) tag.remove();
  dimensionTags.clear();
  parts.splice(0, parts.length);
  if (model) {
    scene.remove(model);
    disposeObject(model);
    model = null;
  }
  for (const url of activeObjectUrls) URL.revokeObjectURL(url);
  activeObjectUrls = [];
  engineeringManifest = null;
  homeCamera = null;
  homeTarget = null;
  explosionCurrent = 0;
  setExplosionTarget(0);
  ui.overallSize.hidden = true;
  ui.productSourceStatus.dataset.status = "ready";
}

async function resolveManifest(source) {
  if (!source) return null;
  if (typeof source === "object") return source;
  const response = await fetch(source, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Manifest request failed with ${response.status}`);
  return response.json();
}

function loadGltf(source, generation) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      source,
      (gltf) => resolve(gltf),
      (event) => {
        if (generation !== modelLoadGeneration || !event.total) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        ui.modelState.innerHTML = `<i class="status-dot is-loading"></i>Loading ${percent}%`;
      },
      reject,
    );
  });
}

function updateProductIdentity(sourceLabel) {
  const project = engineeringManifest?.project ?? {};
  const productName = project.name ?? sourceLabel ?? "3D Hardware Product";
  ui.projectCode.textContent = `${productName} // ${project.code ?? "UNIVERSAL VIEW"}`.toUpperCase();
  ui.viewerTitle.textContent = project.viewerTitle ?? "Spatial Engineering Inspector";
  ui.activeProductName.textContent = productName;
  document.title = `${productName} Spatial Engineering Inspector`;
}

function updateOverallSize() {
  const manifestSize = engineeringManifest?.model?.dimensionsMm;
  if (manifestSize?.length === 3) {
    ui.overallSize.textContent = `W ${dimensionNumber.format(manifestSize[0])} × D ${dimensionNumber.format(manifestSize[1])} × H ${dimensionNumber.format(manifestSize[2])} mm`;
  } else if (model) {
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const factor = activeUnitToMillimetres();
    ui.overallSize.textContent = `W ${dimensionNumber.format(size.x * factor)} × D ${dimensionNumber.format(size.z * factor)} × H ${dimensionNumber.format(size.y * factor)} mm`;
  } else {
    ui.overallSize.hidden = true;
    return;
  }
  ui.overallSize.hidden = false;
}

function updateManifestCompatibility() {
  if (!engineeringManifest?.parts) {
    ui.productSourceStatus.dataset.status = "preview";
    ui.productCompatibility.textContent = `Measured preview · ${activeSourceUnits} source units · ${activeUpAxis}-up · no engineering manifest`;
    return;
  }
  const meshNames = new Set(parts.map((part) => part.name));
  const manifestNames = new Set(Object.keys(engineeringManifest.parts));
  const missingRecords = [...meshNames].filter((name) => !manifestNames.has(name));
  const missingMeshes = [...manifestNames].filter((name) => !meshNames.has(name));
  if (missingRecords.length || missingMeshes.length) {
    ui.productSourceStatus.dataset.status = "error";
    ui.productCompatibility.textContent = `Manifest mismatch · ${missingRecords.length} meshes unclassified · ${missingMeshes.length} manifest records missing meshes`;
  } else {
    ui.productSourceStatus.dataset.status = "verified";
    ui.productCompatibility.textContent = `Engineering manifest linked · ${parts.length} named parts · millimetre dimensions`;
  }
}

function saveRecentProduct(config) {
  if (!config.remember || !config.modelSource.startsWith("http")) return;
  const recent = loadRecentProducts().filter((item) => item.model !== config.modelSource);
  recent.unshift({
    name: ui.activeProductName.textContent,
    model: config.modelSource,
    manifest: typeof config.manifestSource === "string" ? config.manifestSource : "",
    units: activeSourceUnits,
    upAxis: activeUpAxis,
  });
  localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(recent.slice(0, 6)));
  renderRecentProducts();
}

function loadRecentProducts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_PRODUCTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderRecentProducts() {
  const recent = loadRecentProducts();
  ui.productRecent.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = recent.length ? "Choose a recent project" : "No recent URL projects";
  ui.productRecent.append(placeholder);
  recent.forEach((item, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = item.name || item.model;
    ui.productRecent.append(option);
  });
  ui.productLoadRecent.disabled = true;
}

function updateAddressBar(config) {
  if (!config.updateAddress || !config.modelSource || config.modelSource.startsWith("blob:")) return;
  const url = new URL(window.location.href);
  url.searchParams.set("model", config.modelSource);
  if (typeof config.manifestSource === "string" && config.manifestSource) {
    url.searchParams.set("manifest", config.manifestSource);
  } else {
    url.searchParams.delete("manifest");
  }
  url.searchParams.set("units", activeSourceUnits);
  url.searchParams.set("up", activeUpAxis);
  history.replaceState(null, "", url);
}

async function loadProduct(config) {
  const generation = ++modelLoadGeneration;
  ui.modelState.innerHTML = `<i class="status-dot is-loading"></i>Loading product`;
  ui.productSourceStatus.dataset.status = "ready";
  ui.productCompatibility.textContent = "Inspecting model and engineering manifest…";
  try {
    let manifest = null;
    if (config.manifestSource) {
      try {
        manifest = await resolveManifest(config.manifestSource);
      } catch (error) {
        if (config.manifestRequired) throw error;
        console.warn("Engineering manifest unavailable; using measured mesh bounds", error);
      }
    }
    const gltf = await loadGltf(config.modelSource, generation);
    if (generation !== modelLoadGeneration) {
      disposeObject(gltf.scene);
      return;
    }
    clearCurrentProduct();
    engineeringManifest = manifest;
    activeSourceUnits = engineeringManifest?.model?.units ?? config.units ?? "mm";
    activeUpAxis = (engineeringManifest?.model?.upAxis ?? config.upAxis ?? "Y").toUpperCase();
    activeObjectUrls = config.objectUrls ?? [];
    ui.productSourceUnits.value = UNIT_TO_MM[activeSourceUnits] ? activeSourceUnits : "mm";
    ui.productUpAxis.value = ["X", "Y", "Z"].includes(activeUpAxis) ? activeUpAxis : "Y";
    model = gltf.scene;
    applyUpAxis(model, activeUpAxis);
    scene.add(model);
    prepareParts();
    if (!parts.length) throw new Error("The loaded file contains no mesh parts");
    fitModel();
    updateProductIdentity(config.sourceLabel);
    updateOverallSize();
    updateManifestCompatibility();
    if (config.startExploded) {
      explosionCurrent = 1;
      setExplosionTarget(1);
      const pose = explosionCameraPose();
      camera.position.copy(pose.position);
      controls.target.copy(pose.target);
    }
    const qualification = engineeringManifest ? "dimensioned" : "measured";
    ui.modelState.innerHTML = `<i class="status-dot"></i>${parts.length} ${qualification} parts ready`;
    showToast(`${ui.activeProductName.textContent} online — gestures and inspection ready`);
    updateAddressBar(config);
    saveRecentProduct(config);
  } catch (error) {
    console.error(error);
    for (const url of config.objectUrls ?? []) URL.revokeObjectURL(url);
    ui.modelState.innerHTML = `<i class="status-dot is-error"></i>Model failed`;
    ui.productSourceStatus.dataset.status = "error";
    ui.productCompatibility.textContent = error.message;
    showToast(`Could not load product: ${error.message}`, true);
  }
}

function setProductSourceOpen(open) {
  ui.productSourcePanel.hidden = !open;
  ui.productSourceToggle.setAttribute("aria-expanded", String(open));
  if (open && !ui.cameraSettingsPanel.hidden) setCameraSettingsOpen(false);
}

function showEmptyViewer({ openPanel = true, clearAddress = true } = {}) {
  modelLoadGeneration += 1;
  clearCurrentProduct();
  activeSourceUnits = "mm";
  activeUpAxis = "Y";
  ui.projectCode.textContent = "HARDWARE PRODUCT // UNIVERSAL";
  ui.viewerTitle.textContent = "Spatial Engineering Inspector";
  ui.activeProductName.textContent = "No product loaded";
  ui.productSourceStatus.dataset.status = "ready";
  ui.productCompatibility.textContent = "Select a local GLB and optional engineering manifest, or enter hosted addresses.";
  ui.modelState.innerHTML = `<i class="status-dot"></i>Choose a product`;
  document.title = "Universal Hardware Spatial Inspector";
  if (clearAddress) {
    ui.productModelUrl.value = "";
    ui.productManifestUrl.value = "";
    const url = new URL(window.location.href);
    for (const key of ["model", "manifest", "units", "up", "view"]) url.searchParams.delete(key);
    history.replaceState(null, "", url);
  }
  setProductSourceOpen(openPanel);
}

async function loadLocalFiles(modelFile, manifestFile = null) {
  if (!modelFile || !modelFile.name.toLowerCase().endsWith(".glb")) {
    showToast("Choose a self-contained .glb model", true);
    return;
  }
  let manifest = null;
  if (manifestFile) {
    try {
      manifest = JSON.parse(await manifestFile.text());
    } catch {
      showToast("The selected engineering manifest is not valid JSON", true);
      return;
    }
  }
  const objectUrl = URL.createObjectURL(modelFile);
  await loadProduct({
    modelSource: objectUrl,
    manifestSource: manifest,
    sourceLabel: manifest?.project?.name ?? modelFile.name.replace(/\.glb$/i, ""),
    units: ui.productSourceUnits.value,
    upAxis: ui.productUpAxis.value,
    objectUrls: [objectUrl],
  });
  setProductSourceOpen(false);
}

function loadUrlFields() {
  const modelSource = ui.productModelUrl.value.trim();
  const manifestSource = ui.productManifestUrl.value.trim();
  if (!modelSource) {
    showToast("Enter a GLB or GLTF model address", true);
    return;
  }
  loadProduct({
    modelSource,
    manifestSource: manifestSource || null,
    sourceLabel: modelSource.split("/").pop()?.replace(/\.(glb|gltf)(?:\?.*)?$/i, "") || "URL product",
    units: ui.productSourceUnits.value,
    upAxis: ui.productUpAxis.value,
    updateAddress: true,
    remember: true,
  });
}

ui.productSourceToggle.addEventListener("click", () => setProductSourceOpen(ui.productSourcePanel.hidden));
ui.productSourceClose.addEventListener("click", () => setProductSourceOpen(false));
ui.productLoadLocal.addEventListener("click", () => loadLocalFiles(ui.productModelFile.files[0], ui.productManifestFile.files[0]));
ui.productLoadUrl.addEventListener("click", loadUrlFields);
ui.productClear.addEventListener("click", () => showEmptyViewer());
ui.productRecent.addEventListener("change", () => {
  ui.productLoadRecent.disabled = ui.productRecent.value === "";
});
ui.productLoadRecent.addEventListener("click", () => {
  const item = loadRecentProducts()[Number(ui.productRecent.value)];
  if (!item) return;
  ui.productModelUrl.value = item.model;
  ui.productManifestUrl.value = item.manifest ?? "";
  ui.productSourceUnits.value = item.units ?? "mm";
  ui.productUpAxis.value = item.upAxis ?? "Y";
  loadUrlFields();
});

let dragDepth = 0;
window.addEventListener("dragenter", (event) => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  dragDepth += 1;
  ui.productDropOverlay.classList.add("is-visible");
});
window.addEventListener("dragover", (event) => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});
window.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) ui.productDropOverlay.classList.remove("is-visible");
});
window.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  ui.productDropOverlay.classList.remove("is-visible");
  const files = [...event.dataTransfer.files];
  loadLocalFiles(
    files.find((file) => file.name.toLowerCase().endsWith(".glb")),
    files.find((file) => file.name.toLowerCase().endsWith(".json")),
  );
});

renderRecentProducts();
if (viewerParams.has("model")) {
  const initialModel = viewerParams.get("model");
  const initialManifest = viewerParams.get("manifest")
    ?? initialModel.replace(/\.glb(?:\?.*)?$/i, "_manifest.json");
  ui.productModelUrl.value = initialModel;
  ui.productManifestUrl.value = initialManifest;
  loadProduct({
    modelSource: initialModel,
    manifestSource: initialManifest,
    sourceLabel: "URL product",
    units: viewerParams.get("units") ?? "mm",
    upAxis: viewerParams.get("up") ?? "Y",
    startExploded: viewerParams.get("view") === "exploded",
  });
} else {
  showEmptyViewer({ openPanel: true, clearAddress: false });
}

function setExplosionTarget(value, announce = false) {
  explosionTarget = THREE.MathUtils.clamp(value, 0, 1);
  const percent = Math.round(explosionTarget * 100);
  ui.slider.value = String(percent);
  ui.slider.style.setProperty("--value", `${percent}%`);
  ui.sliderOutput.value = `${percent}%`;
  ui.assemble.classList.toggle("is-primary", percent === 0);
  ui.explode.classList.toggle("is-primary", percent === 100);
  if (announce) {
    if (percent === 0 && homeCamera && homeTarget) animateCamera(homeCamera, homeTarget, 300);
    if (percent === 100) moveToExplosionView();
    showToast(percent === 0 ? "Assembly sequence engaged" : "Exploded inspection view engaged");
  }
}

function explosionCameraPose() {
  if (!homeCamera || !homeTarget) return { position: camera.position.clone(), target: controls.target.clone() };
  const direction = homeCamera.clone().sub(homeTarget);
  return {
    position: homeTarget.clone().add(direction.multiplyScalar(2.16)),
    target: homeTarget.clone(),
  };
}

function moveToExplosionView() {
  const pose = explosionCameraPose();
  animateCamera(pose.position, pose.target, 320);
}

function easeExplosion(value) {
  return value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;
}

function updateExplosion(delta) {
  const response = 1 - Math.exp(-delta * 15);
  explosionCurrent = THREE.MathUtils.lerp(explosionCurrent, explosionTarget, response);
  if (Math.abs(explosionCurrent - explosionTarget) < 0.0003) explosionCurrent = explosionTarget;
  const amount = easeExplosion(explosionCurrent);
  inspectionReveal = THREE.MathUtils.smoothstep(amount, 0.08, 0.82);
  for (const part of parts) {
    part.position.copy(part.userData.basePosition).addScaledVector(part.userData.explosionOffset, amount);
  }
}

function updateInspectionLighting() {
  const reveal = inspectionReveal;
  const target = model ? modelCenter : controls.target;
  inspectionTarget.position.copy(target);

  inspectionDirection.copy(camera.position).sub(controls.target);
  if (inspectionDirection.lengthSq() < 0.0001) inspectionDirection.set(1, 1, 1);
  inspectionDirection.normalize();

  inspectionFrontLight.position
    .copy(target)
    .addScaledVector(inspectionDirection, modelRadius * 3)
    .addScaledVector(camera.up, modelRadius * 0.35);
  inspectionTopLight.position.set(
    target.x,
    target.y + modelRadius * 3,
    target.z + modelRadius * 0.35,
  );

  inspectionFrontLight.intensity = THREE.MathUtils.lerp(0, 1.45, reveal);
  inspectionTopLight.intensity = THREE.MathUtils.lerp(0, 0.85, reveal);
  ambient.intensity = THREE.MathUtils.lerp(1.55, 1.8, reveal);
  rimLight.intensity = THREE.MathUtils.lerp(2.5, 2.8, reveal);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(0.92, 0.98, reveal);
  scene.fog.density = THREE.MathUtils.lerp(assembledFogDensity, explodedFogDensity, reveal);
}

function projectDimensionElement(element, worldPoint) {
  dimensionProjection.copy(worldPoint).project(camera);
  const visible = dimensionProjection.z > -1
    && dimensionProjection.z < 1
    && Math.abs(dimensionProjection.x) < 1.08
    && Math.abs(dimensionProjection.y) < 1.08;
  element.hidden = !visible;
  if (!visible) return null;
  const x = (dimensionProjection.x * 0.5 + 0.5) * ui.app.clientWidth;
  const y = (-dimensionProjection.y * 0.5 + 0.5) * ui.app.clientHeight;
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  return { x, y };
}

function updateSelectedDimensionGuide() {
  if (!selectedPart) {
    dimensionBoxHelper.visible = false;
    for (const label of dimensionAxisLabels.values()) label.hidden = true;
    return;
  }

  dimensionBox.setFromObject(selectedPart);
  dimensionBoxHelper.box.copy(dimensionBox);
  dimensionBoxHelper.visible = true;
  dimensionBoxHelper.updateMatrixWorld(true);

  const record = recordForPart(selectedPart);
  const dimensions = record?.dimensionsMm ?? [
    dimensionBox.max.x - dimensionBox.min.x,
    dimensionBox.max.z - dimensionBox.min.z,
    dimensionBox.max.y - dimensionBox.min.y,
  ];
  const center = dimensionBox.getCenter(new THREE.Vector3());
  const size = dimensionBox.getSize(new THREE.Vector3());
  const offset = Math.max(size.length() * 0.055, 4);
  const anchors = {
    width: new THREE.Vector3(center.x, dimensionBox.min.y - offset, dimensionBox.min.z - offset),
    depth: new THREE.Vector3(dimensionBox.max.x + offset, dimensionBox.min.y - offset, center.z),
    height: new THREE.Vector3(dimensionBox.max.x + offset, center.y, dimensionBox.min.z - offset),
  };
  const values = {
    width: `W ${formatMillimetres(dimensions[0])}`,
    depth: `D ${formatMillimetres(dimensions[1])}`,
    height: `H ${formatMillimetres(dimensions[2])}`,
  };
  for (const [axis, label] of dimensionAxisLabels) {
    label.textContent = values[axis];
    projectDimensionElement(label, anchors[axis]);
  }
}

function updateDimensionOverlays(now, force = false) {
  if (!force && now - lastDimensionOverlayAt < 32) return;
  lastDimensionOverlayAt = now;
  const assembledExteriorOnly = explosionCurrent < 0.12;

  const occupied = [];
  const orderedTags = [...dimensionTags].sort(([first], [second]) => {
    const firstPriority = first === selectedPart ? 0 : first === hoveredPart ? 1 : 2;
    const secondPriority = second === selectedPart ? 0 : second === hoveredPart ? 1 : 2;
    return firstPriority - secondPriority;
  });

  for (const [part, tag] of orderedTags) {
    const record = recordForPart(part);
    const isPriority = part === selectedPart || part === hoveredPart;
    const allowedByMode = dimensionLabelsVisible
      && (!assembledExteriorOnly || record?.group === "exterior");
    if (!isPriority && !allowedByMode) {
      tag.hidden = true;
      continue;
    }
    dimensionWorldPoint.copy(part.userData.dimensionCenter);
    part.localToWorld(dimensionWorldPoint);
    tag.classList.toggle("is-selected", part === selectedPart);
    tag.classList.toggle("is-candidate", record?.engineering?.geometry_status === "candidate_envelope");
    const screen = projectDimensionElement(tag, dimensionWorldPoint);
    if (!screen) continue;
    const bounds = {
      left: screen.x - 92,
      right: screen.x + 92,
      top: screen.y - 18,
      bottom: screen.y + 18,
    };
    const overlaps = occupied.some((other) => !(
      bounds.right < other.left
      || bounds.left > other.right
      || bounds.bottom < other.top
      || bounds.top > other.bottom
    ));
    if (overlaps && !isPriority) {
      tag.hidden = true;
      continue;
    }
    occupied.push(bounds);
  }

  updateSelectedDimensionGuide();
}

function setDimensionLabelsVisible(visible, announce = false) {
  dimensionLabelsVisible = visible;
  ui.dimensions.classList.toggle("is-primary", visible);
  ui.dimensions.setAttribute("aria-pressed", String(visible));
  updateDimensionOverlays(performance.now(), true);
  if (announce) {
    showToast(visible ? "Assembly dimensions visible" : "Assembly dimensions hidden");
  }
}

function updateHighlight() {
  for (const part of parts) {
    part.material.emissive.copy(part.userData.baseEmissive);
    part.material.emissiveIntensity = part.userData.baseEmissiveIntensity;
  }
  if (hoveredPart && hoveredPart !== selectedPart) {
    hoveredPart.material.emissive.setHex(0x0a7f9e);
    hoveredPart.material.emissiveIntensity = 0.85;
  }
  if (selectedPart) {
    selectedPart.material.emissive.setHex(0xb25a11);
    selectedPart.material.emissiveIntensity = 1.05;
  }
}

function partAtNdc(x, y) {
  if (!model) return null;
  pointerNdc.set(x, y);
  raycaster.setFromCamera(pointerNdc, camera);
  return raycaster.intersectObjects(parts, false)[0]?.object ?? null;
}

function selectPart(part, focus = false) {
  selectedPart = part;
  ui.focus.disabled = !part;
  ui.selectedPart.textContent = part ? part.userData.label : "None — aim with two grips and spread, or click a part";
  updateSelectedEngineeringUi();
  updateHighlight();
  if (part) {
    showToast(`Selected: ${part.userData.label}`);
    if (focus) focusSelectedPart();
  }
}

function animateCamera(position, target, duration = 320) {
  cameraTween = {
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPosition: position.clone(),
    toTarget: target.clone(),
    startedAt: performance.now(),
    duration,
  };
}

function cameraPoseForPart(part, viewPosition = camera.position, viewTarget = controls.target) {
  if (!part) return null;
  const box = new THREE.Box3().setFromObject(part);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 10);
  const direction = viewPosition.clone().sub(viewTarget).normalize();
  const position = sphere.center.clone().addScaledVector(direction, Math.max(radius * 3.4, 74));
  return { position, target: sphere.center.clone() };
}

function focusSelectedPart() {
  if (!selectedPart) return;
  const pose = cameraPoseForPart(selectedPart);
  animateCamera(pose.position, pose.target, 260);
  showToast(`Focusing ${selectedPart.userData.label}`);
}

function returnHome() {
  if (!homeCamera || !homeTarget) return;
  animateCamera(homeCamera, homeTarget, 300);
  showToast("Full product view restored");
}

function updateCameraTween(now) {
  if (!cameraTween) return;
  const raw = THREE.MathUtils.clamp((now - cameraTween.startedAt) / cameraTween.duration, 0, 1);
  const eased = 1 - (1 - raw) ** 3;
  camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, eased);
  controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased);
  if (raw >= 1) cameraTween = null;
}

let toastTimer = 0;
function showToast(message, error = false) {
  window.clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.toggle("is-error", error);
  ui.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => ui.toast.classList.remove("is-visible"), 2100);
}

ui.assemble.addEventListener("click", () => setExplosionTarget(0, true));
ui.explode.addEventListener("click", () => setExplosionTarget(1, true));
ui.focus.addEventListener("click", focusSelectedPart);
ui.dimensions.addEventListener("click", () => setDimensionLabelsVisible(!dimensionLabelsVisible, true));
ui.home.addEventListener("click", returnHome);
ui.slider.addEventListener("input", () => setExplosionTarget(Number(ui.slider.value) / 100));
setExplosionTarget(0);

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
  if (event.key.toLowerCase() === "a") setExplosionTarget(0, true);
  if (event.key.toLowerCase() === "e") setExplosionTarget(1, true);
  if (event.key.toLowerCase() === "f") focusSelectedPart();
  if (event.key.toLowerCase() === "d") setDimensionLabelsVisible(!dimensionLabelsVisible, true);
  if (event.key.toLowerCase() === "h") returnHome();
  if (event.key.toLowerCase() === "c") toggleCamera();
  if (event.key.toLowerCase() === "l") setProductSourceOpen(ui.productSourcePanel.hidden);
  if (event.key === "Escape" && !ui.productSourcePanel.hidden) setProductSourceOpen(false);
  else if (event.key === "Escape" && !ui.cameraSettingsPanel.hidden) setCameraSettingsOpen(false);
  else if (event.key === "Escape") selectPart(null);
});

let pointerStart = null;
renderer.domElement.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
});

renderer.domElement.addEventListener("pointermove", (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  const nextHover = partAtNdc(x, y);
  if (nextHover !== hoveredPart) {
    hoveredPart = nextHover;
    updateHighlight();
    renderer.domElement.style.cursor = hoveredPart ? "crosshair" : "grab";
  }
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (!pointerStart || pointerStart.button !== 0) return;
  const movement = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  pointerStart = null;
  if (movement > 5) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  selectPart(partAtNdc(x, y));
});

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const gestureLabels = {
  None: "Tracking",
  Closed_Fist: "Closed fist",
  Open_Palm: "Open palm",
  Pointing_Up: "Pointing",
  Thumb_Down: "Thumb down",
  Thumb_Up: "Thumb up",
  Victory: "Victory / pan",
  ILoveYou: "Aim cursor",
};

const CAMERA_PREFERENCE_KEY = "spatial-inspector-camera-v1";
const CAMERA_CAPABILITY_CACHE_KEY = "spatial-inspector-camera-capabilities-v1";
const CAMERA_RESOLUTIONS = [
  { width: 320, height: 240, label: "QVGA" },
  { width: 640, height: 360, label: "nHD", recommendation: "BEST SPEED" },
  { width: 640, height: 480, label: "VGA" },
  { width: 960, height: 540, label: "qHD" },
  { width: 1280, height: 720, label: "HD", recommendation: "BEST RANGE" },
  { width: 1920, height: 1080, label: "FULL HD" },
  { width: 2560, height: 1440, label: "QHD" },
  { width: 3840, height: 2160, label: "4K" },
];
const CAMERA_FRAME_RATES = [15, 24, 30, 50, 60, 90, 120];
const CAMERA_PREVIEW_FILTERS = {
  tracking: "saturate(0.82) contrast(1.14) brightness(0.88)",
  natural: "none",
  "low-light": "saturate(0.92) contrast(0.96) brightness(1.24)",
  contrast: "saturate(0.68) contrast(1.42) brightness(0.82)",
  mono: "grayscale(1) contrast(1.2) brightness(0.88)",
};
const CAMERA_HARDWARE_CONTROLS = [
  { key: "focusMode", label: "Focus mode", preferred: ["continuous", "single-shot", "manual"] },
  { key: "exposureMode", label: "Exposure mode", preferred: ["continuous", "single-shot", "manual"] },
  { key: "whiteBalanceMode", label: "White balance", preferred: ["continuous", "single-shot", "manual"] },
  { key: "torch", label: "Torch", preferred: [false, true] },
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" },
  { key: "sharpness", label: "Sharpness" },
  { key: "colorTemperature", label: "Color temperature" },
  { key: "exposureCompensation", label: "Exposure compensation", recommendedValue: 0 },
  { key: "focusDistance", label: "Focus distance" },
  { key: "zoom", label: "Optical zoom", recommendedValue: "min" },
  { key: "pan", label: "Hardware pan" },
  { key: "tilt", label: "Hardware tilt" },
];

let cameraCapabilities = {};
let cameraCapabilitiesById = new Map();
let availableCameras = [];
let bestCameraId = "";
let cameraConfigurationBusy = false;

function serializableCameraCapabilities(capabilities = {}) {
  const snapshot = {};
  for (const key of [
    "width", "height", "frameRate", "aspectRatio", "resizeMode", "focusMode",
    "exposureMode", "whiteBalanceMode", "brightness", "contrast", "saturation",
    "sharpness", "colorTemperature", "exposureCompensation", "focusDistance", "zoom",
  ]) {
    const value = capabilities[key];
    if (Array.isArray(value)) snapshot[key] = [...value];
    else if (value && typeof value === "object") snapshot[key] = { ...value };
    else if (value !== undefined) snapshot[key] = value;
  }
  return snapshot;
}

function loadCameraCapabilityCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CAMERA_CAPABILITY_CACHE_KEY) || "{}");
    cameraCapabilitiesById = new Map(Object.entries(cached));
  } catch {
    cameraCapabilitiesById = new Map();
  }
}

function saveCameraCapabilityCache() {
  try {
    localStorage.setItem(CAMERA_CAPABILITY_CACHE_KEY, JSON.stringify(Object.fromEntries(
      [...cameraCapabilitiesById].map(([deviceId, capabilities]) => [deviceId, serializableCameraCapabilities(capabilities)]),
    )));
  } catch {
    // Capability caching is an optimization; camera discovery still works without it.
  }
}

function megapixels(width, height) {
  return (width * height / 1_000_000).toFixed(2);
}

function resolutionValue(resolution) {
  return `${resolution.width}x${resolution.height}`;
}

function parseResolution(value) {
  const [width, height] = value.split("x").map(Number);
  return { width, height };
}

function rangeContains(range, value) {
  if (!range || typeof range !== "object") return true;
  return value >= (range.min ?? value) && value <= (range.max ?? value);
}

function resolutionFitsCapabilities(resolution, capabilities) {
  return rangeContains(capabilities?.width, resolution.width)
    && rangeContains(capabilities?.height, resolution.height);
}

function availableResolutionModes(capabilities = cameraCapabilities) {
  const matches = CAMERA_RESOLUTIONS.filter((resolution) => resolutionFitsCapabilities(resolution, capabilities));
  const maximumWidth = Math.round(capabilities?.width?.max ?? 0);
  const maximumHeight = Math.round(capabilities?.height?.max ?? 0);
  if (maximumWidth && maximumHeight && !matches.some(({ width, height }) => width === maximumWidth && height === maximumHeight)) {
    matches.push({ width: maximumWidth, height: maximumHeight, label: "CAMERA MAX", recommendation: "MAX DETAIL" });
  }
  if (matches.length) return matches.sort((a, b) => a.width * a.height - b.width * b.height);
  return [{ width: maximumWidth || 640, height: maximumHeight || 360, label: "CAMERA MODE" }];
}

function availableFrameRates(capabilities = cameraCapabilities) {
  const rates = CAMERA_FRAME_RATES.filter((rate) => rangeContains(capabilities?.frameRate, rate));
  const maximum = capabilities?.frameRate?.max;
  if (Number.isFinite(maximum) && !rates.some((rate) => Math.abs(rate - maximum) < 0.5)) rates.push(maximum);
  return [...new Set(rates.map((rate) => Math.round(rate * 100) / 100))].sort((a, b) => a - b);
}

function recommendedFrameRate(capabilities = cameraCapabilities) {
  const rates = availableFrameRates(capabilities);
  if (!rates.length) return 30;
  const atOrBelowSixty = rates.filter((rate) => rate <= 60.5);
  return atOrBelowSixty.at(-1) ?? rates[0];
}

function closestResolution(targetWidth, targetHeight, capabilities = cameraCapabilities) {
  const modes = availableResolutionModes(capabilities);
  const targetArea = targetWidth * targetHeight;
  return modes.reduce((best, mode) => (
    Math.abs(mode.width * mode.height - targetArea) < Math.abs(best.width * best.height - targetArea) ? mode : best
  ), modes[0]);
}

function closestFrameRate(target, capabilities = cameraCapabilities) {
  const rates = availableFrameRates(capabilities);
  return rates.reduce((best, rate) => Math.abs(rate - target) < Math.abs(best - target) ? rate : best, rates[0] ?? 30);
}

function populateResolutionOptions(preferred = ui.cameraResolution.value) {
  const modes = availableResolutionModes();
  const recommended = closestResolution(640, 360);
  ui.cameraResolution.replaceChildren(...modes.map((mode) => {
    const option = document.createElement("option");
    option.value = resolutionValue(mode);
    const suffix = mode.width === recommended.width && mode.height === recommended.height
      ? " · ★ BEST SPEED"
      : mode.recommendation ? ` · ${mode.recommendation}` : "";
    option.textContent = `${mode.width}×${mode.height} · ${megapixels(mode.width, mode.height)} MP · ${mode.label}${suffix}`;
    return option;
  }));
  ui.cameraResolution.value = modes.some((mode) => resolutionValue(mode) === preferred)
    ? preferred
    : resolutionValue(recommended);
}

function populateFrameRateOptions(preferred = Number(ui.cameraFps.value)) {
  const rates = availableFrameRates();
  const recommended = recommendedFrameRate();
  ui.cameraFps.replaceChildren(...rates.map((rate) => {
    const option = document.createElement("option");
    option.value = String(rate);
    option.textContent = `${rate} FPS${Math.abs(rate - recommended) < 0.1 ? " · ★ BEST LATENCY" : ""}`;
    return option;
  }));
  const selected = rates.some((rate) => Math.abs(rate - preferred) < 0.1) ? preferred : recommended;
  ui.cameraFps.value = String(selected);
}

function applyCameraPreset(preset, { persist = true } = {}) {
  if (preset === "custom") return;
  const target = preset === "speed"
    ? closestResolution(640, 360)
    : preset === "balanced"
      ? closestResolution(1280, 720)
      : availableResolutionModes().at(-1);
  const targetFps = preset === "detail" ? closestFrameRate(30) : recommendedFrameRate();
  ui.cameraResolution.value = resolutionValue(target);
  ui.cameraFps.value = String(targetFps);
  if (preset === "speed") {
    ui.cameraColorProfile.value = "tracking";
    applyPreviewColorProfile("tracking");
  }
  if (persist) saveCameraPreferences();
}

function applyPreviewColorProfile(profile) {
  const selected = CAMERA_PREVIEW_FILTERS[profile] ? profile : "tracking";
  ui.cameraColorProfile.value = selected;
  ui.video.style.setProperty("--camera-filter", CAMERA_PREVIEW_FILTERS[selected]);
}

function requestedCameraMode() {
  const resolution = parseResolution(ui.cameraResolution.value || "640x360");
  return {
    deviceId: ui.cameraDevice.value,
    width: resolution.width,
    height: resolution.height,
    frameRate: Number(ui.cameraFps.value) || 30,
  };
}

function captureConstraints({ includeDevice = true } = {}) {
  const requested = requestedCameraMode();
  const constraints = {
    width: { ideal: requested.width, max: requested.width },
    height: { ideal: requested.height, max: requested.height },
    frameRate: { ideal: requested.frameRate, max: requested.frameRate },
  };
  if (includeDevice && requested.deviceId) constraints.deviceId = { exact: requested.deviceId };
  if (!requested.deviceId && includeDevice) constraints.facingMode = "user";
  const supported = navigator.mediaDevices?.getSupportedConstraints?.() ?? {};
  if (supported.resizeMode) constraints.resizeMode = "crop-and-scale";
  return constraints;
}

function saveCameraPreferences() {
  try {
    localStorage.setItem(CAMERA_PREFERENCE_KEY, JSON.stringify({
      deviceId: ui.cameraDevice.value,
      preset: ui.cameraPreset.value,
      resolution: ui.cameraResolution.value,
      frameRate: ui.cameraFps.value,
      colorProfile: ui.cameraColorProfile.value,
    }));
  } catch {
    // Persistence is optional (for example, it may be disabled in private mode).
  }
}

function loadCameraPreferences() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(CAMERA_PREFERENCE_KEY) || "{}");
  } catch {
    saved = {};
  }
  populateResolutionOptions(saved.resolution);
  populateFrameRateOptions(Number(saved.frameRate));
  ui.cameraPreset.value = ["speed", "balanced", "detail", "custom"].includes(saved.preset) ? saved.preset : "speed";
  ui.cameraDevice.dataset.preferredDeviceId = saved.deviceId ?? "";
  applyPreviewColorProfile(saved.colorProfile ?? "tracking");
  if (ui.cameraPreset.value !== "custom" && !saved.resolution) applyCameraPreset(ui.cameraPreset.value, { persist: false });
}

function cameraCapabilityScore(capabilities) {
  const maxFps = capabilities?.frameRate?.max ?? 0;
  const maxArea = (capabilities?.width?.max ?? 0) * (capabilities?.height?.max ?? 0);
  return Math.min(maxFps, 60) * 10_000_000 + maxArea;
}

function cameraLabel(device, index) {
  return device.label?.trim() || `Camera ${index + 1}`;
}

function updateCameraDeviceOptions(preferredDeviceId = ui.cameraDevice.value || ui.cameraDevice.dataset.preferredDeviceId) {
  const scored = availableCameras.map((device) => ({
    device,
    score: cameraCapabilityScore(cameraCapabilitiesById.get(device.deviceId)),
  }));
  const highestScore = Math.max(0, ...scored.map(({ score }) => score));
  const rankingIsComplete = scored.length > 0 && scored.every(({ score }) => score > 0);
  bestCameraId = rankingIsComplete && highestScore > 0
    ? scored.find(({ score }) => score === highestScore)?.device.deviceId ?? ""
    : "";
  const options = [new Option("System default", "")];
  availableCameras.forEach((device, index) => {
    const recommended = device.deviceId === bestCameraId ? " · ★ BEST CAMERA" : "";
    options.push(new Option(`${cameraLabel(device, index)}${recommended}`, device.deviceId));
  });
  ui.cameraDevice.replaceChildren(...options);
  if (preferredDeviceId && availableCameras.some((device) => device.deviceId === preferredDeviceId)) {
    ui.cameraDevice.value = preferredDeviceId;
  }
}

function updateCameraCapabilitySummary() {
  const capabilities = cameraCapabilities;
  const width = capabilities?.width?.max;
  const height = capabilities?.height?.max;
  const fps = capabilities?.frameRate?.max;
  const fragments = [];
  if (width && height) fragments.push(`up to ${Math.round(width)}×${Math.round(height)} (${megapixels(width, height)} MP)`);
  if (fps) fragments.push(`up to ${Math.round(fps * 10) / 10} FPS`);
  if (Array.isArray(capabilities?.focusMode)) fragments.push(`${capabilities.focusMode.join("/")} focus`);
  ui.cameraCapabilitySummary.textContent = fragments.length
    ? fragments.join(" · ")
    : availableCameras.length
      ? `${availableCameras.length} camera${availableCameras.length === 1 ? "" : "s"} found · start one to inspect its full capabilities`
      : "Scan after granting permission to reveal every connected camera.";
}

function choosePreferredValue(values, preferredValues, current) {
  for (const preferred of preferredValues ?? []) {
    if (values.some((value) => value === preferred)) return preferred;
  }
  if (values.some((value) => value === current)) return current;
  return values[0];
}

function renderCameraHardwareControls(capabilities = {}, settings = {}) {
  const controls = [];
  for (const definition of CAMERA_HARDWARE_CONTROLS) {
    const capability = capabilities[definition.key];
    if (capability === undefined || capability === null) continue;
    const container = document.createElement("div");
    container.className = "camera-hardware-control";
    const label = document.createElement("label");
    label.htmlFor = `camera-hardware-${definition.key}`;
    label.textContent = definition.label;

    if (Array.isArray(capability) || typeof capability === "boolean") {
      const values = Array.isArray(capability) ? capability : capability ? [false, true] : [false];
      const input = document.createElement("select");
      input.id = `camera-hardware-${definition.key}`;
      input.dataset.cameraConstraint = definition.key;
      input.dataset.constraintType = "choice";
      const recommended = choosePreferredValue(values, definition.preferred, settings[definition.key]);
      for (const value of values) {
        const option = new Option(`${String(value).replaceAll("-", " ")}${value === recommended ? " · ★ BEST" : ""}`, String(value));
        input.add(option);
      }
      input.value = String(settings[definition.key] ?? recommended);
      container.append(label, input);
    } else if (typeof capability === "object" && Number.isFinite(capability.min) && Number.isFinite(capability.max)) {
      const output = document.createElement("output");
      label.append(output);
      const input = document.createElement("input");
      input.type = "range";
      input.id = `camera-hardware-${definition.key}`;
      input.dataset.cameraConstraint = definition.key;
      input.dataset.constraintType = "number";
      input.min = String(capability.min);
      input.max = String(capability.max);
      input.step = String(capability.step > 0 ? capability.step : Math.max((capability.max - capability.min) / 100, 0.01));
      const recommended = definition.recommendedValue === "min"
        ? capability.min
        : Number.isFinite(definition.recommendedValue)
          ? THREE.MathUtils.clamp(definition.recommendedValue, capability.min, capability.max)
          : settings[definition.key] ?? (capability.min + capability.max) / 2;
      input.value = String(settings[definition.key] ?? recommended);
      output.value = Number(input.value).toFixed(2).replace(/\.00$/, "");
      input.addEventListener("input", () => {
        output.value = Number(input.value).toFixed(2).replace(/\.00$/, "");
      });
      const hint = document.createElement("small");
      hint.textContent = Number(input.value) === recommended ? "★ CAMERA DEFAULT / SAFE" : "Adjust and apply";
      container.append(label, input, hint);
    } else {
      continue;
    }
    controls.push(container);
  }

  ui.cameraHardwareControls.replaceChildren(...(controls.length ? controls : [Object.assign(document.createElement("p"), {
    className: "camera-empty-state",
    textContent: "This browser/driver exposes no additional image controls for the active camera.",
  })]));
  ui.cameraHardwareCount.textContent = controls.length
    ? `${controls.length} available on this camera`
    : "No extra controls reported";
}

function collectHardwareConstraints() {
  const controls = ui.cameraHardwareControls.querySelectorAll("[data-camera-constraint]");
  const values = {};
  for (const control of controls) {
    let value = control.value;
    if (control.dataset.constraintType === "number") value = Number(value);
    else if (value === "true" || value === "false") value = value === "true";
    values[control.dataset.cameraConstraint] = value;
  }
  return values;
}

function setCameraConfigurationBusy(busy) {
  cameraConfigurationBusy = busy;
  for (const control of [ui.cameraToggle, ui.cameraScan, ui.cameraApply, ui.cameraResetRecommended]) control.disabled = busy;
}

async function acquireCameraTabLock() {
  if (!navigator.locks?.request || cameraLockRelease) return true;
  let settleAcquisition;
  const acquisition = new Promise((resolve) => {
    settleAcquisition = resolve;
  });
  cameraLockTask = navigator.locks.request(
    "spatial-inspector-gesture-camera",
    { ifAvailable: true },
    async (lock) => {
      if (!lock) {
        settleAcquisition(false);
        return;
      }
      settleAcquisition(true);
      await new Promise((resolve) => {
        cameraLockRelease = resolve;
      });
    },
  ).catch((error) => {
    settleAcquisition(false);
    console.warn("Could not acquire the gesture camera tab lock", error);
  });
  return acquisition;
}

function releaseCameraTabLock() {
  cameraLockRelease?.();
  cameraLockRelease = null;
  cameraLockTask = null;
}

let gestureWorker = null;
let gestureWorkerReadyPromise = null;
let gestureWorkerReady = false;
let gestureWorkerBusy = false;
let gestureFrameRequestId = null;
let gestureFrameTimerId = null;
let gestureFrameSequence = 0;
let gestureFrameStartedAt = 0;
let lastGestureTimestamp = 0;
let gestureLatencyAverage = 0;
let gestureResultRateAverage = 0;
let lastGestureResultAt = 0;
let gestureDelegate = "CPU";
let mediaStream = null;
let cameraEnabled = false;
let cameraLockRelease = null;
let cameraLockTask = null;
let stableGesture = "None";
let stableGestureStartedAt = 0;
let stableGestureFired = false;
let previousGesturePoint = null;
let lastMotionGesture = "None";
let lastMotionGestureAt = 0;
let lastSingleHandSeenAt = 0;
const MOTION_GESTURE_GRACE_MS = 190;
const HAND_LANDMARK_GRACE_MS = 150;
const MAX_CONTINUOUS_HAND_STEP = 0.18;
const TRACKING_JUMP_LIMIT = 0.34;
const gestureCursor = new THREE.Vector2(0.5, 0.5);
const twoHandLockCursor = new THREE.Vector2(0.5, 0.5);
const TWO_HAND_GRIP_RATIO = 0.66;
const TWO_HAND_GRIP_RELEASE_RATIO = 0.9;
const TWO_HAND_SPREAD_ARM_DELTA = 0.055;
const TWO_HAND_SPREAD_COMMIT_DELTA = 0.16;
const TWO_HAND_AIM_SETTLE_MS = 100;
const TWO_HAND_LOSS_GRACE_MS = 420;
const TWO_HAND_FOCUSED_RESUME_MS = 1200;
let twoHandTargetState = "idle";
let twoHandMinimumSeparation = null;
let twoHandLockPart = null;
let twoHandAimStartedAt = 0;
let twoHandLastSeenAt = 0;
let twoHandLastGripAt = 0;
let twoHandPreviousSeparation = null;
let twoHandViewStartCamera = null;
let twoHandViewStartTarget = null;
let twoHandViewFocusCamera = null;
let twoHandViewFocusTarget = null;
let twoHandFocusCommitted = false;

function handleGestureWorkerMessage(event) {
  const message = event.data;
  if (message.type === "delegate-selected") {
    gestureDelegate = message.delegate;
    ui.gestureLatency.dataset.delegate = message.delegate;
    ui.gestureLatency.dataset.benchmarkMs = message.benchmarkMs.toFixed(1);
    ui.gestureLatency.dataset.delegateBenchmarks = JSON.stringify(message.delegateBenchmarks ?? {});
    ui.gestureLatency.dataset.delegateSource = message.source ?? "startup";
    return;
  }
  if (message.type === "result") {
    gestureWorkerBusy = false;
    if (!cameraEnabled || message.sequence !== gestureFrameSequence) return;
    const receivedAt = performance.now();
    const roundTripMs = receivedAt - gestureFrameStartedAt;
    gestureLatencyAverage = gestureLatencyAverage
      ? THREE.MathUtils.lerp(gestureLatencyAverage, roundTripMs, 0.24)
      : roundTripMs;
    if (lastGestureResultAt) {
      const instantaneousRate = 1000 / Math.max(receivedAt - lastGestureResultAt, 1);
      gestureResultRateAverage = gestureResultRateAverage
        ? THREE.MathUtils.lerp(gestureResultRateAverage, instantaneousRate, 0.2)
        : instantaneousRate;
    }
    lastGestureResultAt = receivedAt;
    ui.gestureLatency.textContent = `${Math.round(gestureLatencyAverage)} ms AI · ${Math.round(gestureResultRateAverage || 0)} Hz`;
    ui.gestureLatency.dataset.inferenceMs = message.inferenceMs.toFixed(1);
    if (message.delegate) {
      gestureDelegate = message.delegate;
      ui.gestureLatency.dataset.delegate = message.delegate;
    }
    ui.gestureLatency.dataset.resultFps = gestureResultRateAverage.toFixed(1);
    ui.gestureLatency.dataset.inputKind = message.inputKind;
    processGestureResults(message.results, receivedAt);
    return;
  }

  if (message.type === "frame-error") {
    gestureWorkerBusy = false;
    console.warn("Gesture frame skipped", message.message);
  }
}

function ensureGestureWorker() {
  if (gestureWorkerReadyPromise) return gestureWorkerReadyPromise;
  gestureWorker = new Worker(new URL("./gesture-worker.js", import.meta.url), { type: "module" });
  gestureWorker.addEventListener("message", handleGestureWorkerMessage);

  gestureWorkerReadyPromise = new Promise((resolve, reject) => {
    const onInitializationMessage = (event) => {
      const message = event.data;
      if (message.type === "ready") {
        gestureWorkerReady = true;
        gestureWorker.removeEventListener("message", onInitializationMessage);
        resolve(message);
      } else if (message.type === "fatal") {
        gestureWorker.removeEventListener("message", onInitializationMessage);
        reject(new Error(message.message || "Gesture worker could not start"));
      }
    };
    gestureWorker.addEventListener("message", onInitializationMessage);
    gestureWorker.addEventListener("error", (event) => reject(event.error || new Error(event.message)), { once: true });
  }).catch((error) => {
    gestureWorker?.terminate();
    gestureWorker = null;
    gestureWorkerReady = false;
    gestureWorkerReadyPromise = null;
    throw error;
  });

  gestureWorker.postMessage({ type: "init" });
  return gestureWorkerReadyPromise;
}

function scheduleGestureFrame() {
  if (!cameraEnabled) return;
  if (typeof ui.video.requestVideoFrameCallback === "function") {
    gestureFrameRequestId = ui.video.requestVideoFrameCallback(captureGestureFrame);
  } else {
    gestureFrameTimerId = window.setTimeout(
      () => captureGestureFrame(performance.now(), { mediaTime: ui.video.currentTime }),
      16,
    );
  }
}

async function captureGestureFrame(now, metadata) {
  gestureFrameRequestId = null;
  gestureFrameTimerId = null;
  scheduleGestureFrame();
  if (!cameraEnabled || !gestureWorkerReady || gestureWorkerBusy || ui.video.readyState < 2) return;

  gestureWorkerBusy = true;
  const sequence = ++gestureFrameSequence;
  gestureFrameStartedAt = performance.now();
  lastGestureTimestamp = Math.max(Math.round(now), lastGestureTimestamp + 1);

  try {
    const frame = await createImageBitmap(ui.video, {
      resizeWidth: 384,
      resizeHeight: 216,
      resizeQuality: "low",
    });
    const inputKind = "image-bitmap-384x216";

    if (!cameraEnabled || !gestureWorker) {
      frame.close?.();
      gestureWorkerBusy = false;
      return;
    }
    gestureWorker.postMessage({
      type: "frame",
      frame,
      inputKind,
      sequence,
      timestamp: lastGestureTimestamp,
      mediaTime: metadata?.mediaTime,
    }, [frame]);
  } catch (error) {
    gestureWorkerBusy = false;
    console.warn("Could not capture gesture frame", error);
  }
}

async function probeCameraCapabilities(device, activeTrack) {
  const activeSettings = activeTrack?.getSettings?.() ?? {};
  if (activeSettings.deviceId === device.deviceId) return activeTrack.getCapabilities?.() ?? {};
  let probeStream = null;
  try {
    probeStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        deviceId: { exact: device.deviceId },
        width: { ideal: 640, max: 640 },
        height: { ideal: 360, max: 360 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
    return probeStream.getVideoTracks()[0]?.getCapabilities?.() ?? {};
  } catch (error) {
    console.warn(`Could not probe ${device.label || device.deviceId}`, error);
    return cameraCapabilitiesById.get(device.deviceId) ?? {};
  } finally {
    probeStream?.getTracks().forEach((track) => track.stop());
  }
}

async function refreshCameraDevices({
  requestPermission = false,
  announce = requestPermission,
  probeCapabilities = false,
} = {}) {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  let permissionStream = null;
  try {
    if (requestPermission && !cameraEnabled) {
      permissionStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableCameras = devices.filter((device) => device.kind === "videoinput");
    const discoveredCapabilities = new Map(cameraCapabilitiesById);
    await Promise.all(availableCameras.map(async (device) => {
      if (typeof device.getCapabilities !== "function") return;
      try {
        discoveredCapabilities.set(device.deviceId, device.getCapabilities());
      } catch {
        // Some browsers reveal capabilities only on the active track.
      }
    }));
    if (permissionStream) {
      const permissionTrack = permissionStream.getVideoTracks()[0];
      const settings = permissionTrack?.getSettings?.() ?? {};
      if (settings.deviceId && typeof permissionTrack?.getCapabilities === "function") {
        discoveredCapabilities.set(settings.deviceId, permissionTrack.getCapabilities());
      }
      permissionStream.getTracks().forEach((track) => track.stop());
      permissionStream = null;
    }
    const activeTrack = mediaStream?.getVideoTracks()[0];
    if (probeCapabilities) {
      for (const device of availableCameras) {
        const capabilities = await probeCameraCapabilities(device, activeTrack);
        if (cameraCapabilityScore(capabilities) > 0) discoveredCapabilities.set(device.deviceId, capabilities);
      }
    }
    cameraCapabilitiesById = discoveredCapabilities;
    saveCameraCapabilityCache();
    const activeDeviceId = activeTrack?.getSettings?.().deviceId;
    const preferred = activeDeviceId || ui.cameraDevice.value || ui.cameraDevice.dataset.preferredDeviceId;
    updateCameraDeviceOptions(preferred);
    if (!cameraEnabled) {
      cameraCapabilities = cameraCapabilitiesById.get(ui.cameraDevice.value) ?? {};
      populateResolutionOptions();
      populateFrameRateOptions();
    }
    updateCameraCapabilitySummary();
    if (announce) showToast(`${availableCameras.length} camera${availableCameras.length === 1 ? "" : "s"} available`);
  } finally {
    permissionStream?.getTracks().forEach((track) => track.stop());
  }
}

function activeCameraName(track) {
  const settings = track?.getSettings?.() ?? {};
  const device = availableCameras.find((candidate) => candidate.deviceId === settings.deviceId);
  return track?.label || device?.label || "Camera";
}

function updateActiveCameraMode(track, requested = requestedCameraMode()) {
  if (!track) {
    ui.cameraActiveMode.textContent = "Camera offline";
    ui.cameraModeNote.textContent = "Requested settings will be verified after the camera starts.";
    ui.cameraActiveMode.parentElement.classList.remove("is-negotiated", "is-adjusted");
    return;
  }
  const settings = track.getSettings?.() ?? {};
  const width = Math.round(settings.width ?? ui.video.videoWidth ?? requested.width);
  const height = Math.round(settings.height ?? ui.video.videoHeight ?? requested.height);
  const frameRate = Math.round((settings.frameRate ?? requested.frameRate) * 10) / 10;
  ui.cameraActiveMode.textContent = `${activeCameraName(track)} · ${width}×${height} · ${megapixels(width, height)} MP · ${frameRate} FPS`;
  const exactResolution = width === requested.width && height === requested.height;
  const exactFps = Math.abs(frameRate - requested.frameRate) <= 1;
  ui.cameraActiveMode.parentElement.classList.toggle("is-negotiated", exactResolution && exactFps);
  ui.cameraActiveMode.parentElement.classList.toggle("is-adjusted", !exactResolution || !exactFps);
  ui.cameraModeNote.textContent = exactResolution && exactFps
    ? "Requested mode delivered. This is the stream feeding gesture tracking."
    : `Driver adjusted the request from ${requested.width}×${requested.height} at ${requested.frameRate} FPS.`;
  ui.cameraActiveMode.dataset.width = String(width);
  ui.cameraActiveMode.dataset.height = String(height);
  ui.cameraActiveMode.dataset.frameRate = String(frameRate);
  ui.cameraActiveMode.dataset.deviceId = settings.deviceId ?? "";
}

async function synchronizeActiveCamera(track, requested = requestedCameraMode()) {
  const settings = track.getSettings?.() ?? {};
  cameraCapabilities = track.getCapabilities?.() ?? {};
  if (settings.deviceId) {
    cameraCapabilitiesById.set(settings.deviceId, cameraCapabilities);
    saveCameraCapabilityCache();
  }
  updateActiveCameraMode(track, requested);
  populateResolutionOptions(`${settings.width ?? requestedCameraMode().width}x${settings.height ?? requestedCameraMode().height}`);
  populateFrameRateOptions(settings.frameRate ?? requestedCameraMode().frameRate);
  renderCameraHardwareControls(cameraCapabilities, settings);
  updateCameraCapabilitySummary();
  await refreshCameraDevices();
  if (settings.deviceId) ui.cameraDevice.value = settings.deviceId;
  saveCameraPreferences();
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires localhost or HTTPS");
  if (!(await acquireCameraTabLock())) {
    throw new Error("Gesture control is already active in another viewer tab. Disable it there first.");
  }
  ui.cameraState.textContent = "STARTING";
  ui.cameraState.classList.remove("is-error");
  setCameraConfigurationBusy(true);
  const requested = requestedCameraMode();
  const [workerResult, streamResult] = await Promise.allSettled([
    ensureGestureWorker(),
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: captureConstraints(),
    }),
  ]);
  if (workerResult.status === "rejected" || streamResult.status === "rejected") {
    if (streamResult.status === "fulfilled") {
      streamResult.value.getTracks().forEach((track) => track.stop());
    }
    setCameraConfigurationBusy(false);
    releaseCameraTabLock();
    throw workerResult.status === "rejected" ? workerResult.reason : streamResult.reason;
  }

  mediaStream = streamResult.value;
  ui.video.srcObject = mediaStream;
  await ui.video.play();
  cameraEnabled = true;
  gestureDelegate = workerResult.value.delegate;
  gestureLatencyAverage = 0;
  gestureResultRateAverage = 0;
  lastGestureResultAt = 0;
  lastGestureTimestamp = 0;
  ui.cameraToggle.classList.add("is-active");
  ui.cameraToggle.lastChild.textContent = " Disable gesture control";
  ui.cameraState.textContent = "LIVE";
  ui.cameraState.classList.add("is-live");
  ui.gestureLatency.textContent = `-- ms ${workerResult.value.delegate}`;
  ui.gestureLatency.dataset.delegate = workerResult.value.delegate;
  ui.gestureLatency.dataset.benchmarkMs = workerResult.value.benchmarkMs.toFixed(1);
  ui.gestureLatency.dataset.delegateBenchmarks = JSON.stringify(workerResult.value.delegateBenchmarks ?? {});
  ui.gestureLatency.dataset.analysisSize = `${workerResult.value.analysisWidth ?? 384}x${workerResult.value.analysisHeight ?? 216}`;
  ui.gestureLatency.hidden = false;
  ui.cameraPlaceholder.hidden = true;
  const track = mediaStream.getVideoTracks()[0];
  track?.addEventListener("ended", () => {
    if (mediaStream?.getVideoTracks()[0] === track) stopCamera({ announce: false });
  }, { once: true });
  await synchronizeActiveCamera(track, requested);
  setCameraConfigurationBusy(false);
  scheduleGestureFrame();
  const settings = track?.getSettings?.() ?? {};
  showToast(`Gesture camera online · ${settings.width ?? "?"}×${settings.height ?? "?"} · ${Math.round(settings.frameRate ?? 0)} FPS`);
}

function stopCamera({ announce = true } = {}) {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  ui.video.srcObject = null;
  cameraEnabled = false;
  if (gestureFrameRequestId !== null) ui.video.cancelVideoFrameCallback?.(gestureFrameRequestId);
  if (gestureFrameTimerId !== null) window.clearTimeout(gestureFrameTimerId);
  gestureFrameRequestId = null;
  gestureFrameTimerId = null;
  gestureFrameSequence += 1;
  ui.cameraToggle.classList.remove("is-active");
  ui.cameraToggle.lastChild.textContent = " Enable gesture control";
  ui.cameraState.textContent = "OFFLINE";
  ui.cameraState.classList.remove("is-live", "is-error");
  ui.gestureLatency.hidden = true;
  ui.cameraPlaceholder.hidden = false;
  updateActiveCameraMode(null);
  renderCameraHardwareControls({}, {});
  hideGesturePointer();
  clearHandOverlay();
  updateGestureReadout("No hand", 0);
  releaseCameraTabLock();
  if (announce) showToast("Gesture control offline — mouse controls remain active");
}

async function toggleCamera() {
  if (cameraConfigurationBusy) return;
  if (cameraEnabled) {
    stopCamera();
    return;
  }
  try {
    await startCamera();
  } catch (error) {
    console.error(error);
    if (mediaStream || cameraEnabled) stopCamera({ announce: false });
    else releaseCameraTabLock();
    setCameraConfigurationBusy(false);
    ui.cameraState.textContent = "BLOCKED";
    ui.cameraState.classList.add("is-error");
    showToast(error.message || "Camera permission was not granted", true);
  }
}

async function applyCameraConfiguration() {
  if (cameraConfigurationBusy) return;
  saveCameraPreferences();
  applyPreviewColorProfile(ui.cameraColorProfile.value);
  setCameraConfigurationBusy(true);
  try {
    if (!cameraEnabled) {
      setCameraConfigurationBusy(false);
      await startCamera();
      return;
    }
    const track = mediaStream?.getVideoTracks()[0];
    const activeSettings = track?.getSettings?.() ?? {};
    const activeDeviceId = activeSettings.deviceId ?? "";
    const requestedDeviceId = ui.cameraDevice.value;
    const requested = requestedCameraMode();
    const sourceChanged = requestedDeviceId && requestedDeviceId !== activeDeviceId;
    const captureModeChanged = activeSettings.width !== requested.width
      || activeSettings.height !== requested.height
      || Math.abs((activeSettings.frameRate ?? 0) - requested.frameRate) > 1;
    if (sourceChanged || captureModeChanged) {
      stopCamera({ announce: false });
      setCameraConfigurationBusy(false);
      await startCamera();
      return;
    }
    const constraints = captureConstraints({ includeDevice: false });
    const hardware = collectHardwareConstraints();
    if (Object.keys(hardware).length) constraints.advanced = [hardware];
    await track.applyConstraints(constraints);
    await ui.video.play();
    await synchronizeActiveCamera(track, requested);
    showToast(`Camera mode applied · ${ui.cameraActiveMode.textContent}`);
  } catch (error) {
    console.error(error);
    showToast(error?.name === "OverconstrainedError"
      ? `Camera cannot combine those settings (${error.constraint || "unsupported mode"})`
      : error.message || "Could not apply camera settings", true);
  } finally {
    setCameraConfigurationBusy(false);
  }
}

function setCameraSettingsOpen(open) {
  ui.cameraSettingsPanel.hidden = !open;
  ui.cameraSettingsToggle.setAttribute("aria-expanded", String(open));
  if (open && !ui.productSourcePanel.hidden) setProductSourceOpen(false);
}

ui.cameraToggle.addEventListener("click", toggleCamera);
ui.cameraSettingsToggle.addEventListener("click", () => setCameraSettingsOpen(ui.cameraSettingsPanel.hidden));
ui.cameraSettingsClose.addEventListener("click", () => setCameraSettingsOpen(false));
ui.cameraScan.addEventListener("click", async () => {
  if (cameraConfigurationBusy) return;
  setCameraConfigurationBusy(true);
  try {
    await refreshCameraDevices({ requestPermission: true, probeCapabilities: true });
  } catch (error) {
    console.error(error);
    showToast(error.message || "Camera permission was not granted", true);
  } finally {
    setCameraConfigurationBusy(false);
  }
});
ui.cameraPreset.addEventListener("change", () => applyCameraPreset(ui.cameraPreset.value));
ui.cameraResolution.addEventListener("change", () => {
  ui.cameraPreset.value = "custom";
  saveCameraPreferences();
});
ui.cameraFps.addEventListener("change", () => {
  ui.cameraPreset.value = "custom";
  saveCameraPreferences();
});
ui.cameraColorProfile.addEventListener("change", () => {
  applyPreviewColorProfile(ui.cameraColorProfile.value);
  saveCameraPreferences();
});
ui.cameraDevice.addEventListener("change", () => {
  cameraCapabilities = cameraCapabilitiesById.get(ui.cameraDevice.value) ?? {};
  populateResolutionOptions();
  populateFrameRateOptions();
  if (ui.cameraPreset.value !== "custom") applyCameraPreset(ui.cameraPreset.value, { persist: false });
  updateCameraCapabilitySummary();
  saveCameraPreferences();
});
ui.cameraResetRecommended.addEventListener("click", async () => {
  if (!bestCameraId) await refreshCameraDevices({ requestPermission: true, probeCapabilities: true });
  if (bestCameraId) ui.cameraDevice.value = bestCameraId;
  cameraCapabilities = cameraCapabilitiesById.get(ui.cameraDevice.value) ?? cameraCapabilities;
  populateResolutionOptions();
  populateFrameRateOptions();
  ui.cameraPreset.value = "speed";
  applyCameraPreset("speed");
  await applyCameraConfiguration();
});
ui.cameraApply.addEventListener("click", applyCameraConfiguration);
navigator.mediaDevices?.addEventListener?.("devicechange", () => {
  refreshCameraDevices().catch((error) => console.warn("Could not refresh camera list", error));
});
loadCameraCapabilityCache();
loadCameraPreferences();
refreshCameraDevices().catch((error) => console.warn("Camera enumeration unavailable until permission is granted", error));

function clearHandOverlay() {
  const context = ui.handOverlay.getContext("2d");
  context.clearRect(0, 0, ui.handOverlay.width, ui.handOverlay.height);
}

function drawHands(landmarkSets) {
  const width = Math.max(ui.video.videoWidth, 640);
  const height = Math.max(ui.video.videoHeight, 360);
  if (ui.handOverlay.width !== width || ui.handOverlay.height !== height) {
    ui.handOverlay.width = width;
    ui.handOverlay.height = height;
  }
  const context = ui.handOverlay.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.lineWidth = 2;
  context.strokeStyle = "rgba(94, 233, 255, 0.78)";
  context.fillStyle = "rgba(255, 184, 77, 0.9)";
  context.shadowColor = "rgba(94, 233, 255, 0.8)";
  context.shadowBlur = 8;

  for (const landmarks of landmarkSets) {
    context.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      context.moveTo((1 - landmarks[a].x) * width, landmarks[a].y * height);
      context.lineTo((1 - landmarks[b].x) * width, landmarks[b].y * height);
    }
    context.stroke();
    for (const landmark of landmarks) {
      context.beginPath();
      context.arc((1 - landmark.x) * width, landmark.y * height, 2.4, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.shadowBlur = 0;
}

function updateGestureReadout(name, confidence) {
  ui.gestureName.textContent = name;
  const percent = Math.round(confidence * 100);
  ui.gestureConfidence.textContent = `${percent}%`;
  ui.confidenceFill.style.width = `${percent}%`;
}

function distance2d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function gripRatio(landmarks) {
  const palmScale = Math.max(distance2d(landmarks[0], landmarks[9]), 0.04);
  return distance2d(landmarks[4], landmarks[8]) / palmScale;
}

function gripPoint(landmarks) {
  return {
    x: 1 - (landmarks[4].x + landmarks[8].x) * 0.5,
    y: (landmarks[4].y + landmarks[8].y) * 0.5,
  };
}

function updateGesturePointer(target, {
  aiming = false,
  locked = false,
  spreading = false,
  spreadProgress = 0,
  freeze = false,
  smoothing = 0.82,
} = {}) {
  if (!freeze) {
    gestureCursor.x = THREE.MathUtils.lerp(gestureCursor.x, target.x, smoothing);
    gestureCursor.y = THREE.MathUtils.lerp(gestureCursor.y, target.y, smoothing);
  }

  const spreadScale = 1 + THREE.MathUtils.clamp(spreadProgress, 0, 1) * 0.65;
  for (const reticle of [ui.gestureReticle, ui.sceneReticle]) {
    reticle.style.setProperty("--x", `${gestureCursor.x * 100}%`);
    reticle.style.setProperty("--y", `${gestureCursor.y * 100}%`);
    reticle.style.setProperty("--spread-scale", spreadScale.toFixed(3));
    reticle.classList.add("is-visible");
    reticle.classList.toggle("is-aiming", aiming);
    reticle.classList.toggle("is-locked", locked);
    reticle.classList.toggle("is-spreading", spreading);
  }
  ui.gestureReticle.style.left = `${gestureCursor.x * 100}%`;
  ui.gestureReticle.style.top = `${gestureCursor.y * 100}%`;
  ui.sceneReticle.style.left = `${gestureCursor.x * 100}%`;
  ui.sceneReticle.style.top = `${gestureCursor.y * 100}%`;

  const hover = locked
    ? twoHandLockPart
    : partAtNdc(gestureCursor.x * 2 - 1, -(gestureCursor.y * 2 - 1));
  ui.sceneReticle.classList.toggle("is-hovering", Boolean(hover));
  if (hover !== hoveredPart) {
    hoveredPart = hover;
    updateHighlight();
  }
}

function resetTwoHandTarget() {
  twoHandTargetState = "idle";
  twoHandMinimumSeparation = null;
  twoHandLockPart = null;
  twoHandAimStartedAt = 0;
  twoHandLastSeenAt = 0;
  twoHandLastGripAt = 0;
  twoHandPreviousSeparation = null;
  twoHandViewStartCamera = null;
  twoHandViewStartTarget = null;
  twoHandViewFocusCamera = null;
  twoHandViewFocusTarget = null;
  twoHandFocusCommitted = false;
  for (const reticle of [ui.gestureReticle, ui.sceneReticle]) {
    reticle.classList.remove("is-locked", "is-spreading");
    reticle.style.setProperty("--spread-scale", "1");
  }
}

function hideGestureReticles() {
  ui.gestureReticle.classList.remove("is-visible", "is-aiming", "is-locked", "is-spreading");
  ui.sceneReticle.classList.remove("is-visible", "is-aiming", "is-locked", "is-spreading", "is-hovering");
}

function hideGesturePointer() {
  resetTwoHandTarget();
  hideGestureReticles();
  previousGesturePoint = null;
  lastMotionGesture = "None";
}

function fingerIsExtended(landmarks, tipIndex, pipIndex) {
  const wrist = landmarks[0];
  return distance2d(landmarks[tipIndex], wrist) > distance2d(landmarks[pipIndex], wrist) * 1.13;
}

function resemblesMotionGesture(gesture, landmarks) {
  const indexExtended = fingerIsExtended(landmarks, 8, 6);
  const middleExtended = fingerIsExtended(landmarks, 12, 10);
  const ringExtended = fingerIsExtended(landmarks, 16, 14);
  const pinkyExtended = fingerIsExtended(landmarks, 20, 18);
  if (gesture === "Victory") {
    const palmScale = Math.max(distance2d(landmarks[0], landmarks[9]), 0.04);
    return indexExtended && middleExtended && !ringExtended && !pinkyExtended
      && distance2d(landmarks[8], landmarks[12]) > palmScale * 0.28;
  }
  if (gesture === "Pointing_Up") return indexExtended && !middleExtended && !ringExtended && !pinkyExtended;
  return false;
}

function resolveMotionGesture(rawGesture, confidence, landmarks, now) {
  const isDirectMotion = rawGesture === "Victory" || rawGesture === "Pointing_Up";
  if (isDirectMotion && confidence >= 0.42) {
    lastMotionGesture = rawGesture;
    lastMotionGestureAt = now;
    return rawGesture;
  }
  if (
    lastMotionGesture !== "None"
    && now - lastMotionGestureAt <= MOTION_GESTURE_GRACE_MS
    && resemblesMotionGesture(lastMotionGesture, landmarks)
  ) {
    return lastMotionGesture;
  }
  if (isDirectMotion && confidence >= 0.28) {
    lastMotionGesture = rawGesture;
    lastMotionGestureAt = now;
    return rawGesture;
  }
  if (now - lastMotionGestureAt > MOTION_GESTURE_GRACE_MS) lastMotionGesture = "None";
  return "None";
}

function processTwoHandTarget(hands, now) {
  twoHandLastSeenAt = now;
  previousGesturePoint = null;

  const ratios = hands.slice(0, 2).map(gripRatio);
  const gripConfidence = THREE.MathUtils.clamp(
    (0.92 - Math.max(...ratios)) / (0.92 - TWO_HAND_GRIP_RATIO),
    0,
    1,
  );
  const activeGripThreshold = twoHandTargetState === "idle"
    ? TWO_HAND_GRIP_RATIO
    : TWO_HAND_GRIP_RELEASE_RATIO;
  const hasTwoGrips = ratios.every((ratio) => ratio < activeGripThreshold);

  if (!hasTwoGrips) {
    const resumeWindow = twoHandFocusCommitted
      ? TWO_HAND_FOCUSED_RESUME_MS
      : TWO_HAND_LOSS_GRACE_MS;
    if (twoHandTargetState !== "idle" && now - twoHandLastGripAt <= resumeWindow) {
      updateGestureReadout(
        twoHandFocusCommitted ? "Re-form grips to return" : "Hold both grips",
        gripConfidence,
      );
      return;
    }
    resetTwoHandTarget();
    hideGestureReticles();
    updateGestureReadout("Pinch both fingertips", gripConfidence);
    return;
  }

  twoHandLastGripAt = now;
  const a = gripPoint(hands[0]);
  const b = gripPoint(hands[1]);
  const midpoint = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  const separation = Math.hypot(a.x - b.x, a.y - b.y);
  const separationDelta = twoHandPreviousSeparation === null
    ? 0
    : separation - twoHandPreviousSeparation;
  twoHandPreviousSeparation = separation;

  if (twoHandTargetState === "idle") {
    twoHandTargetState = "aiming";
    twoHandMinimumSeparation = separation;
    twoHandAimStartedAt = now;
  }

  if (twoHandTargetState === "aiming") {
    twoHandMinimumSeparation = Math.min(twoHandMinimumSeparation, separation);
    const spreadDelta = separation - twoHandMinimumSeparation;
    if (
      now - twoHandAimStartedAt >= TWO_HAND_AIM_SETTLE_MS
      && spreadDelta >= TWO_HAND_SPREAD_ARM_DELTA
    ) {
      // Capture the last aimed point before an asymmetric outward movement can
      // drag the midpoint away from the component.
      twoHandTargetState = "locked";
      twoHandLockCursor.copy(gestureCursor);
      twoHandLockPart = hoveredPart ?? partAtNdc(
        twoHandLockCursor.x * 2 - 1,
        -(twoHandLockCursor.y * 2 - 1),
      );
      twoHandViewStartCamera = camera.position.clone();
      twoHandViewStartTarget = controls.target.clone();
      const focusPose = cameraPoseForPart(
        twoHandLockPart,
        twoHandViewStartCamera,
        twoHandViewStartTarget,
      );
      twoHandViewFocusCamera = focusPose?.position ?? null;
      twoHandViewFocusTarget = focusPose?.target ?? null;
      twoHandFocusCommitted = false;
      cameraTween = null;
    }
  }

  const spreadDelta = separation - twoHandMinimumSeparation;
  const spreadProgress = THREE.MathUtils.clamp(
    (spreadDelta - TWO_HAND_SPREAD_ARM_DELTA)
      / (TWO_HAND_SPREAD_COMMIT_DELTA - TWO_HAND_SPREAD_ARM_DELTA),
    0,
    1,
  );

  if (
    twoHandTargetState === "locked"
    && twoHandViewStartCamera
    && twoHandViewStartTarget
    && twoHandViewFocusCamera
    && twoHandViewFocusTarget
  ) {
    const easedProgress = spreadProgress * spreadProgress * (3 - 2 * spreadProgress);
    camera.position.lerpVectors(twoHandViewStartCamera, twoHandViewFocusCamera, easedProgress);
    controls.target.lerpVectors(twoHandViewStartTarget, twoHandViewFocusTarget, easedProgress);
  }

  if (
    twoHandTargetState === "locked"
    && spreadDelta >= TWO_HAND_SPREAD_COMMIT_DELTA
    && !twoHandFocusCommitted
  ) {
    twoHandFocusCommitted = true;
    if (twoHandLockPart) {
      selectPart(twoHandLockPart, false);
      showToast(`Focused ${twoHandLockPart.userData.label}`);
    } else {
      showToast("No component at the locked target");
    }
  }

  if (twoHandTargetState === "locked" && spreadDelta < TWO_HAND_SPREAD_ARM_DELTA * 0.35) {
    const restoredFocusedView = twoHandFocusCommitted;
    twoHandTargetState = "aiming";
    twoHandLockPart = null;
    twoHandViewStartCamera = null;
    twoHandViewStartTarget = null;
    twoHandViewFocusCamera = null;
    twoHandViewFocusTarget = null;
    twoHandFocusCommitted = false;
    twoHandMinimumSeparation = separation;
    twoHandAimStartedAt = now;
    if (restoredFocusedView) showToast("Previous camera view restored");
  }

  const locked = twoHandTargetState === "locked";
  updateGesturePointer(midpoint, {
    aiming: twoHandTargetState === "aiming",
    locked,
    spreading: locked,
    spreadProgress,
    freeze: locked,
    smoothing: 0.76,
  });

  if (twoHandFocusCommitted && separationDelta < -0.0015) {
    updateGestureReadout("Zooming out · close grips", 1 - spreadProgress);
  } else if (twoHandFocusCommitted) {
    updateGestureReadout("Focused · close grips", 1);
  } else if (twoHandTargetState === "locked") {
    updateGestureReadout(
      separationDelta < -0.0015 ? "Zooming out" : "Target locked · spread",
      separationDelta < -0.0015 ? 1 - spreadProgress : spreadProgress,
    );
  } else {
    updateGestureReadout("Aim with both grips", gripConfidence);
  }
}

function continuousGestureDelta(point) {
  if (!previousGesturePoint) {
    previousGesturePoint = point;
    return null;
  }
  let dx = point.x - previousGesturePoint.x;
  let dy = point.y - previousGesturePoint.y;
  previousGesturePoint = point;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude < 0.0012 || magnitude > TRACKING_JUMP_LIMIT) return null;
  if (magnitude > MAX_CONTINUOUS_HAND_STEP) {
    const scale = MAX_CONTINUOUS_HAND_STEP / magnitude;
    dx *= scale;
    dy *= scale;
  }
  return { dx, dy };
}

function orbitByGesture(point) {
  const delta = continuousGestureDelta(point);
  if (!delta) return;
  controls.rotateLeft(delta.dx * 3.8);
  controls.rotateUp(delta.dy * 3.2);
}

function panByGesture(point) {
  const delta = continuousGestureDelta(point);
  if (!delta) return;
  const distance = camera.position.distanceTo(controls.target);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
  const offset = right.multiplyScalar(-delta.dx * distance * 1.25).add(up.multiplyScalar(delta.dy * distance * 1.25));
  camera.position.add(offset);
  controls.target.add(offset);
}

function runHeldCommand(gesture, now) {
  if (gesture !== stableGesture) {
    stableGesture = gesture;
    stableGestureStartedAt = now;
    stableGestureFired = false;
  }
  if (stableGestureFired || now - stableGestureStartedAt < 140) return;
  if (gesture === "Open_Palm") {
    setExplosionTarget(1, true);
    stableGestureFired = true;
  } else if (gesture === "Closed_Fist") {
    setExplosionTarget(0, true);
    stableGestureFired = true;
  } else if (gesture === "Thumb_Up") {
    returnHome();
    stableGestureFired = true;
  }
}

function processGestureResults(results, now) {
  const hands = results.landmarks ?? [];
  drawHands(hands);
  if (
    hands.length < 2
    && twoHandTargetState !== "idle"
    && now - twoHandLastSeenAt <= (
      twoHandFocusCommitted ? TWO_HAND_FOCUSED_RESUME_MS : TWO_HAND_LOSS_GRACE_MS
    )
  ) {
    previousGesturePoint = null;
    updateGestureReadout("Tracking both hands…", 0.5);
    return;
  }

  if (hands.length === 0) {
    if (lastMotionGesture !== "None" && now - lastSingleHandSeenAt <= HAND_LANDMARK_GRACE_MS) {
      updateGestureReadout("Maintaining motion tracking…", 0.4);
      return;
    }
    updateGestureReadout("No hand", 0);
    stableGesture = "None";
    hideGesturePointer();
    return;
  }

  if (hands.length >= 2) {
    lastMotionGesture = "None";
    processTwoHandTarget(hands, now);
    return;
  }

  resetTwoHandTarget();
  const landmarks = hands[0];
  lastSingleHandSeenAt = now;
  const category = results.gestures?.[0]?.[0] ?? { categoryName: "None", score: 0 };
  const gesture = category.categoryName || "None";
  const confidence = category.score || 0;
  const motionGesture = resolveMotionGesture(gesture, confidence, landmarks, now);
  const isAiming = gesture === "ILoveYou";
  const handPoint = { x: 1 - landmarks[8].x, y: landmarks[8].y };
  updateGesturePointer(handPoint, { aiming: isAiming });
  updateGestureReadout(
    motionGesture !== "None" && motionGesture !== gesture
      ? `${gestureLabels[motionGesture]} · tracking`
      : gestureLabels[gesture] ?? gesture,
    motionGesture !== "None" && motionGesture !== gesture ? Math.max(confidence, 0.5) : confidence,
  );

  if (motionGesture === "Pointing_Up") {
    orbitByGesture(handPoint);
  } else if (motionGesture === "Victory") {
    panByGesture(handPoint);
  } else if (isAiming) {
    // Dedicated one-hand cursor mode. Selection and focus are committed by
    // forming two thumb-index grips and spreading them apart.
    previousGesturePoint = null;
  } else {
    previousGesturePoint = null;
  }

  runHeldCommand(gesture, now);
}

function resize() {
  const width = Math.max(ui.app.clientWidth, 1);
  const height = Math.max(ui.app.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(ui.app);
resize();

let lastFrameAt = performance.now();
let fpsAverage = 0;
let fpsUpdatedAt = 0;
function render(now) {
  const delta = Math.min((now - lastFrameAt) / 1000, 0.1);
  lastFrameAt = now;
  const instantaneousFps = delta > 0 ? 1 / delta : 60;
  fpsAverage = fpsAverage ? THREE.MathUtils.lerp(fpsAverage, instantaneousFps, 0.08) : instantaneousFps;
  if (now - fpsUpdatedAt > 600) {
    ui.fps.textContent = `${Math.round(fpsAverage)} FPS`;
    fpsUpdatedAt = now;
  }

  updateExplosion(delta);
  updateCameraTween(now);
  controls.update(delta);
  updateInspectionLighting();
  updateDimensionOverlays(now);
  platform.rotation.y += delta * 0.08;
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(render);

window.addEventListener("beforeunload", () => {
  mediaStream?.getTracks().forEach((track) => track.stop());
  releaseCameraTabLock();
  gestureWorker?.postMessage({ type: "close" });
  gestureWorker?.terminate();
});
