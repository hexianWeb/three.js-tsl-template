import * as THREE from "three/webgpu";
import { float, length, positionLocal, smoothstep, uniform, uv, vec2 } from "three/tsl";

/**
 * Fibonacci-sampled point cloud on the unit sphere, filtered by a land mask texture.
 * Each instance is a plane; a circular footprint comes from UV radial distance in the node graph.
 */

export default class DotSphere {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;

    this.panelParams = {
      pointsNumber: 24500,
      landThreshold: 0.5,
      dotSize: 0.015,
      color: "#9faeee",
      metalness: 0.82,
      roughness: 0.28,
      waveColor: "#ff2030",
      waveMaxRadius: 0.6,
      waveThickness: 0.05,
      waveSoftness: 0.02,
      waveIntensity: 2.5,
      waveFadeTail: 0.2,
      waveDuration: 1.2,
      waveEase: "power2.out",
    };

    this._dotColorUniform = uniform(new THREE.Color(this.panelParams.color));
    this._metalnessUniform = uniform(this.panelParams.metalness);
    this._roughnessUniform = uniform(this.panelParams.roughness);

    this._wave = {
      clickPos: uniform(new THREE.Vector3(0, 0, 1)),
      progress: uniform(0),
      color: uniform(new THREE.Color(this.panelParams.waveColor)),
      maxRadius: uniform(this.panelParams.waveMaxRadius),
      thickness: uniform(this.panelParams.waveThickness),
      softness: uniform(this.panelParams.waveSoftness),
      intensity: uniform(this.panelParams.waveIntensity),
      fadeTail: uniform(this.panelParams.waveFadeTail),
    };

    this._landMaskPromise = this._loadLandMask("texture/earth.jpg");
    this.createDotSphere();
  }

  async _loadLandMask(url) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { data, width: canvas.width, height: canvas.height };
  }

  _sampleIsLand(mask, u, v) {
    const x = Math.min(mask.width - 1, Math.max(0, Math.floor(u * mask.width)));

    const y = Math.min(
      mask.height - 1,
      Math.max(0, Math.floor(v * mask.height)),
    );

    const idx = (y * mask.width + x) * 4;

    const lum =
      (mask.data[idx] + mask.data[idx + 1] + mask.data[idx + 2]) / (3 * 255);

    return lum < this.panelParams.landThreshold;
  }

  _dispose() {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.mesh = null;
    this.geometry = null;
    this.material = null;
  }

  async createDotSphere() {
    const mask = await this._landMaskPromise;
    this._dispose();
    const n = Math.max(1, Math.round(this.panelParams.pointsNumber));
    this.panelParams.pointsNumber = n;
    const goldenRatio = (Math.sqrt(5) + 1) / 2;
    /** @type {number[][]} */
    const positions = [];

    for (let i = 0; i < n; i++) {
      const prog = i / n;
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - 2 * prog);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      const lon = Math.atan2(z, x);
      const lat = Math.asin(y);
      const u = lon / (2 * Math.PI) + 0.5;
      const v = 0.5 - lat / Math.PI;
      if (this._sampleIsLand(mask, u, v)) {
        positions.push([x, y, z]);
      }
    }

    const count = positions.length;

    if (count === 0) return;

    const uvCentered = uv().sub(vec2(0.5));

    const dist = length(uvCentered);

    const radius = float(0.5);

    const edge = float(0.015);

    const disk = float(1).sub(smoothstep(radius.sub(edge), radius, dist));

    const material = new THREE.MeshPhysicalNodeMaterial();

    material.side = THREE.DoubleSide;

    material.transparent = true;

    const baseTerm = this._dotColorUniform.mul(disk);

    const waveDist = this._wave.clickPos.sub(positionLocal).length();
    const waveRadius = this._wave.maxRadius.mul(this._wave.progress);
    const waveInner = waveRadius.sub(this._wave.thickness);

    const ringOuter = smoothstep(waveRadius, waveRadius.sub(this._wave.softness), waveDist);
    const ringInner = smoothstep(waveInner.sub(this._wave.softness), waveInner, waveDist);
    const ring = ringOuter.mul(ringInner);

    const lifeFade = float(1).sub(
      smoothstep(float(1).sub(this._wave.fadeTail), float(1), this._wave.progress),
    );

    const waveTerm = this._wave.color
      .mul(ring)
      .mul(this._wave.intensity)
      .mul(lifeFade)
      .mul(disk);

    material.colorNode = baseTerm.add(waveTerm);

    material.opacityNode = disk;

    material.roughnessNode = this._roughnessUniform;

    material.metalnessNode = this._metalnessUniform;

    material.emissiveNode = baseTerm.add(waveTerm);
    const size = Math.max(0.001, this.panelParams.dotSize);

    this.panelParams.dotSize = size;

    const geometry = new THREE.PlaneGeometry(size, size);

    const dots = new THREE.InstancedMesh(geometry, material, count);

    const matrix = new THREE.Matrix4();

    const quat = new THREE.Quaternion();

    const scale = new THREE.Vector3(1, 1, 1);

    const pos = new THREE.Vector3();

    const normal = new THREE.Vector3();

    const zAxis = new THREE.Vector3(0, 0, 1);

    for (let i = 0; i < count; i++) {
      const [x, y, z] = positions[i];

      pos.set(x, y, z);

      normal.copy(pos).normalize();

      quat.setFromUnitVectors(zAxis, normal);

      matrix.compose(pos, quat, scale);

      dots.setMatrixAt(i, matrix);
    }

    dots.instanceMatrix.needsUpdate = true;

    this.geometry = geometry;

    this.material = material;

    this.mesh = dots;

    this.scene.add(dots);
  }

  _applyDotColor() {
    this._dotColorUniform.value.set(this.panelParams.color);
  }

  _applyMetalRough() {
    this._metalnessUniform.value = this.panelParams.metalness;
    this._roughnessUniform.value = this.panelParams.roughness;
  }

  /**

     * @param {import('../utils/debug.js').default} debug

     */

  debuggerInit(debug) {
    if (!debug.active) return;

    const folder = debug.addFolder({ title: "Dot sphere" });

    if (!folder) return;

    folder
      .addBinding(this.panelParams, "color", { view: "color" })
      .on("change", () => {
        this._applyDotColor();
      });

    folder
      .addBinding(this.panelParams, "metalness", {
        label: "Metal",
        min: 0,
        max: 1,
        step: 0.01,
      })
      .on("change", () => {
        this._applyMetalRough();
      });

    folder
      .addBinding(this.panelParams, "roughness", {
        min: 0,
        max: 1,
        step: 0.01,
      })
      .on("change", () => {
        this._applyMetalRough();
      });

    folder
      .addBinding(this.panelParams, "pointsNumber", {
        min: 100,

        max: 30000,

        step: 100,
      })
      .on("change", () => {
        this.createDotSphere();
      });

    folder
      .addBinding(this.panelParams, "landThreshold", {
        min: 0,

        max: 1,

        step: 0.01,
      })
      .on("change", () => {
        this.createDotSphere();
      });

    folder
      .addBinding(this.panelParams, "dotSize", {
        min: 0.002,

        max: 0.08,

        step: 0.001,
      })
      .on("change", () => {
        this.createDotSphere();
      });
  }

  dispose() {
    this._dispose();
  }
}
