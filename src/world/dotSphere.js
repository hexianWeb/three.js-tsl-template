import * as THREE from "three/webgpu";
import { float, length, positionLocal, smoothstep, uniform, uv, vec2 } from "three/tsl";
import gsap from "gsap";

const MAX_WAVES = 8;

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
      waveColor: "#ff2030",
      waveMaxRadius: 0.6,
      waveThickness: 0.08,
      waveSoftness: 0.02,
      waveIntensity: 8,
      waveFadeTail: 0.2,
      waveDuration: 1.2,
      waveEase: "power2.out",
    };

    this._dotColorUniform = uniform(new THREE.Color(this.panelParams.color));

    this._waves = {
      clickPos: Array.from({ length: MAX_WAVES }, () => uniform(new THREE.Vector3(0, 0, 1))),
      progress: Array.from({ length: MAX_WAVES }, () => uniform(0)),
      color: uniform(new THREE.Color(this.panelParams.waveColor)),
      maxRadius: uniform(this.panelParams.waveMaxRadius),
      thickness: uniform(this.panelParams.waveThickness),
      softness: uniform(this.panelParams.waveSoftness),
      intensity: uniform(this.panelParams.waveIntensity),
      fadeTail: uniform(this.panelParams.waveFadeTail),
    };

    this._slotTweens = new Array(MAX_WAVES).fill(null);
    this._nextSlot = 0;
    this._tmpLocal = new THREE.Vector3();

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
    this._slotTweens.forEach(t => t?.kill());
    this._slotTweens.fill(null);
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.mesh = null;
    this.geometry = null;
    this.material = null;
  }

  /**
   * @param {{ data: Uint8ClampedArray, width: number, height: number }} mask
   * @param {number} n
   * @returns {number[][]}
   */
  _getFibonacciLandPositions(mask, n) {
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

    return positions;
  }

  /**
   * @returns {THREE.MeshLambertNodeMaterial}
   */
  _createDotSphereMaterial() {
    const uvCentered = uv().sub(vec2(0.5));
    const dist = length(uvCentered);
    const radius = float(0.5);
    const edge = float(0.015);
    const disk = float(1).sub(smoothstep(radius.sub(edge), radius, dist));

    const material = new THREE.MeshLambertNodeMaterial();
    material.side = THREE.DoubleSide;
    material.transparent = true;

    const baseTerm = this._dotColorUniform.mul(disk);

    const ringAccum = float(0).toVar();
    for (let i = 0; i < MAX_WAVES; i++) {
      const prog = this._waves.progress[i];
      const clickPos = this._waves.clickPos[i];
      const waveDist = clickPos.sub(positionLocal).length();
      const waveRadius = this._waves.maxRadius.mul(prog);
      const waveInner = waveRadius.sub(this._waves.thickness);
      const ringOuter = smoothstep(waveRadius, waveRadius.sub(this._waves.softness), waveDist);
      const ringInner = smoothstep(waveInner.sub(this._waves.softness), waveInner, waveDist);
      const ring = ringOuter.mul(ringInner);
      const lifeFade = float(1).sub(
        smoothstep(float(1).sub(this._waves.fadeTail), float(1), prog),
      );
      const alive = prog.greaterThan(0).select(float(1), float(0));
      ringAccum.addAssign(ring.mul(lifeFade).mul(alive));
    }

    const waveTerm = this._waves.color
      .mul(ringAccum)
      .mul(this._waves.intensity)
      .mul(disk);

    // Wave reads mainly as additive emissive so it stays visible on unlit dot faces (Lambert dims colorNode by N·L).
    const waveAlbedo = waveTerm.mul(float(0.35));

    material.colorNode = baseTerm.add(waveAlbedo);
    material.opacityNode = disk;
    material.emissiveNode = baseTerm.add(waveTerm);

    return material;
  }

  /**
   * @param {THREE.InstancedMesh} instancedMesh
   * @param {number[][]} positions
   */
  _setInstanceMatricesOnSphere(instancedMesh, positions) {
    const count = positions.length;
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
      instancedMesh.setMatrixAt(i, matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
  }

  async createDotSphere() {
    const mask = await this._landMaskPromise;
    this._dispose();
    const n = Math.max(1, Math.round(this.panelParams.pointsNumber));
    this.panelParams.pointsNumber = n;

    const positions = this._getFibonacciLandPositions(mask, n);
    if (positions.length === 0) return;

    const material = this._createDotSphereMaterial();
    const size = Math.max(0.001, this.panelParams.dotSize);
    this.panelParams.dotSize = size;

    const geometry = new THREE.PlaneGeometry(size, size);
    const dots = new THREE.InstancedMesh(geometry, material, positions.length);

    this._setInstanceMatricesOnSphere(dots, positions);

    this.geometry = geometry;
    this.material = material;
    this.mesh = dots;
    this.scene.add(dots);
  }

  /**
   * @param {THREE.Vector3} worldPoint
   * @param {number|object} [durationOrOpts]
   * @param {string} [ease]
   */
  triggerWave(worldPoint, durationOrOpts, ease) {
    if (!this.mesh) return;

    let duration, easeVal, onComplete;
    if (typeof durationOrOpts === "object" && durationOrOpts !== null) {
      ({ duration, ease: easeVal, onComplete } = durationOrOpts);
    } else {
      duration = durationOrOpts;
      easeVal = ease;
    }

    this._tmpLocal.copy(worldPoint);
    this.mesh.worldToLocal(this._tmpLocal);

    const slot = this._nextSlot;
    this._nextSlot = (this._nextSlot + 1) % MAX_WAVES;

    this._slotTweens[slot]?.kill();

    this._waves.clickPos[slot].value.copy(this._tmpLocal);
    this._waves.progress[slot].value = 0;

    this._slotTweens[slot] = gsap.to(this._waves.progress[slot], {
      value: 1,
      duration: duration ?? this.panelParams.waveDuration,
      ease: easeVal ?? this.panelParams.waveEase,
      onComplete: () => {
        this._waves.progress[slot].value = 0;
        this._slotTweens[slot] = null;
        onComplete?.();
      },
    });
  }

  _applyDotColor() {
    this._dotColorUniform.value.set(this.panelParams.color);
  }

  _applyWave() {
    this._waves.color.value.set(this.panelParams.waveColor);
    this._waves.maxRadius.value = this.panelParams.waveMaxRadius;
    this._waves.thickness.value = this.panelParams.waveThickness;
    this._waves.softness.value = this.panelParams.waveSoftness;
    this._waves.intensity.value = this.panelParams.waveIntensity;
    this._waves.fadeTail.value = this.panelParams.waveFadeTail;
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

    const waveFolder = debug.addFolder({ title: "Click wave" });
    if (!waveFolder) return;

    waveFolder
      .addBinding(this.panelParams, "waveColor", { label: "color", view: "color" })
      .on("change", () => this._applyWave());

    waveFolder
      .addBinding(this.panelParams, "waveMaxRadius", {
        label: "maxRadius",
        min: 0.05,
        max: 1.5,
        step: 0.01,
      })
      .on("change", () => this._applyWave());

    waveFolder
      .addBinding(this.panelParams, "waveThickness", {
        label: "thickness",
        min: 0.005,
        max: 0.5,
        step: 0.005,
      })
      .on("change", () => this._applyWave());

    waveFolder
      .addBinding(this.panelParams, "waveSoftness", {
        label: "softness",
        min: 0,
        max: 0.1,
        step: 0.001,
      })
      .on("change", () => this._applyWave());

    waveFolder
      .addBinding(this.panelParams, "waveIntensity", {
        label: "intensity",
        min: 0,
        max: 20,
        step: 0.1,
      })
      .on("change", () => this._applyWave());

    waveFolder
      .addBinding(this.panelParams, "waveFadeTail", {
        label: "fadeTail",
        min: 0,
        max: 0.8,
        step: 0.01,
      })
      .on("change", () => this._applyWave());

    waveFolder.addBinding(this.panelParams, "waveDuration", {
      label: "duration",
      min: 0.1,
      max: 4,
      step: 0.05,
    });

    waveFolder.addBinding(this.panelParams, "waveEase", {
      label: "ease",
      options: {
        "power1.out": "power1.out",
        "power2.out": "power2.out",
        "power3.out": "power3.out",
        "expo.out": "expo.out",
        "sine.out": "sine.out",
        none: "none",
      },
    });

    waveFolder.addButton({ title: "Trigger now" }).on("click", () => {
      this.triggerWave(new THREE.Vector3(0, 0, 1));
    });
  }

  dispose() {
    this._dispose();
  }
}
