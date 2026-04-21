import * as THREE from 'three/webgpu';
import { abs, float, fract, smoothstep, uniform, uv } from 'three/tsl';
import gsap from 'gsap';

const CURVE_SEGMENTS = 64;

/**
 * Build a ribbon BufferGeometry along the great-circle arc from aUnit to bUnit.
 * Points are lifted off the unit sphere by `arcHeight * sin(pi*t)` for a bow over the globe.
 * Each curve point produces two vertices (up/down side of the ribbon).
 * UV: u in [0,1] along arc, v in {-1,+1} across.
 */
function buildRibbonGeometry(aUnit, bUnit, arcHeight, width) {
  const positions = new Float32Array(CURVE_SEGMENTS * 2 * 3);
  const uvs = new Float32Array(CURVE_SEGMENTS * 2 * 2);
  const indices = [];

  const a = aUnit.clone().normalize();
  const b = bUnit.clone().normalize();
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega) || 1;

  const curvePoints = [];
  const tangents = [];

  for (let i = 0; i < CURVE_SEGMENTS; i++) {
    const t = i / (CURVE_SEGMENTS - 1);
    const w1 = Math.sin((1 - t) * omega) / sinOmega;
    const w2 = Math.sin(t * omega) / sinOmega;
    const base = new THREE.Vector3()
      .addScaledVector(a, w1)
      .addScaledVector(b, w2);
    const lift = 1 + arcHeight * Math.sin(Math.PI * t);
    curvePoints.push(base.clone().multiplyScalar(lift));
  }

  for (let i = 0; i < CURVE_SEGMENTS; i++) {
    const prev = curvePoints[Math.max(i - 1, 0)];
    const next = curvePoints[Math.min(i + 1, CURVE_SEGMENTS - 1)];
    tangents.push(next.clone().sub(prev).normalize());
  }

  const tmpSide = new THREE.Vector3();
  for (let i = 0; i < CURVE_SEGMENTS; i++) {
    const p = curvePoints[i];
    const normal = p.clone().normalize();
    tmpSide.crossVectors(normal, tangents[i]).normalize().multiplyScalar(width);
    const up = p.clone().add(tmpSide);
    const dn = p.clone().sub(tmpSide);

    const baseIdx = i * 2;
    positions.set([up.x, up.y, up.z], baseIdx * 3);
    positions.set([dn.x, dn.y, dn.z], (baseIdx + 1) * 3);

    const u = i / (CURVE_SEGMENTS - 1);
    uvs.set([u, 1], baseIdx * 2);
    uvs.set([u, -1], (baseIdx + 1) * 2);

    if (i < CURVE_SEGMENTS - 1) {
      const a0 = baseIdx;
      const a1 = baseIdx + 1;
      const b0 = baseIdx + 2;
      const b1 = baseIdx + 3;
      indices.push(a0, a1, b0, a1, b1, b0);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  return geom;
}

class FlyLine {
  constructor({ scene, shared, aWorld, bWorld, color }) {
    this.scene = scene;
    this.shared = shared;
    this._arrived = false;
    this._tween = null;

    this.uniforms = {
      progress: uniform(0),
      flowTime: uniform(0),
      postFade: uniform(1),
      color: uniform(new THREE.Color(color ?? shared.params.color)),
    };

    this.geometry = buildRibbonGeometry(
      aWorld, bWorld,
      shared.params.arcHeight,
      shared.params.width,
    );

    const material = new THREE.MeshBasicNodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    material.side = THREE.DoubleSide;

    const u = uv().x;
    const v = uv().y;

    const cross = float(1).sub(smoothstep(0.7, 1.0, abs(v)));

    const grown = float(1).sub(
      smoothstep(
        this.uniforms.progress.sub(shared.uniforms.headSoftness),
        this.uniforms.progress,
        u,
      ),
    );

    const flowHead = fract(this.uniforms.flowTime.mul(shared.uniforms.flowSpeed));
    const dFlow = fract(u.sub(flowHead));
    const flowMask = smoothstep(shared.uniforms.flowLength, float(0), dFlow);
    const flowOn = smoothstep(0.98, 1.0, this.uniforms.progress);

    const base = grown.mul(this.uniforms.postFade);
    const a = base.add(flowOn.mul(flowMask)).mul(cross);

    material.colorNode = this.uniforms.color.mul(a).mul(shared.uniforms.intensity);
    material.opacityNode = a;

    this.material = material;
    this.mesh = new THREE.Mesh(this.geometry, material);
    scene.add(this.mesh);
  }

  play({ growth, ease, onArrive } = {}) {
    this._tween?.kill();
    this.uniforms.progress.value = 0;
    this._tween = gsap.to(this.uniforms.progress, {
      value: 1,
      duration: growth ?? this.shared.params.growth,
      ease: ease ?? this.shared.params.growthEase,
      onComplete: () => {
        this._arrived = true;
        gsap.to(this.uniforms.postFade, {
          value: this.shared.params.postArriveFade,
          duration: this.shared.params.postArriveFadeDuration,
          ease: 'power1.out',
        });
        onArrive?.();
      },
    });
  }

  update(dt) {
    if (this._arrived) this.uniforms.flowTime.value += dt;
  }

  dispose() {
    this._tween?.kill();
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}

export default class FlyLines {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    /** @type {FlyLine[]} */
    this.lines = [];

    this.params = {
      color: '#6bc7ff',
      arcHeight: 0.18,
      width: 0.004,
      growth: 0.6,
      growthEase: 'power2.out',
      headSoftness: 0.05,
      flowSpeed: 0.6,
      flowLength: 0.15,
      intensity: 2.0,
      postArriveFade: 0.3,
      postArriveFadeDuration: 0.4,
    };

    this.uniforms = {
      headSoftness: uniform(this.params.headSoftness),
      flowSpeed: uniform(this.params.flowSpeed),
      flowLength: uniform(this.params.flowLength),
      intensity: uniform(this.params.intensity),
    };

    this.shared = { params: this.params, uniforms: this.uniforms };
  }

  /**
   * @param {THREE.Vector3} aWorld unit vector on sphere
   * @param {THREE.Vector3} bWorld unit vector on sphere
   * @param {{ color?: string|number }} [opts]
   */
  add(aWorld, bWorld, opts = {}) {
    const line = new FlyLine({
      scene: this.scene,
      shared: this.shared,
      aWorld, bWorld,
      color: opts.color,
    });
    this.lines.push(line);
    return line;
  }

  clear() {
    for (const l of this.lines) l.dispose();
    this.lines.length = 0;
  }

  update(dt) {
    for (const l of this.lines) l.update(dt);
  }

  dispose() { this.clear(); }

  /**
   * @param {import('../utils/debug.js').default} debug
   */
  debuggerInit(debug) {
    if (!debug.active) return;
    const f = debug.addFolder({ title: 'Fly lines' });
    if (!f) return;

    f.addBinding(this.params, 'color', { view: 'color' });
    f.addBinding(this.params, 'arcHeight', { min: 0, max: 0.5, step: 0.01 });
    f.addBinding(this.params, 'width', { min: 0.001, max: 0.02, step: 0.001 });
    f.addBinding(this.params, 'growth', { min: 0.1, max: 3, step: 0.05 });
    f.addBinding(this.params, 'headSoftness', { min: 0, max: 0.3, step: 0.005 })
      .on('change', () => { this.uniforms.headSoftness.value = this.params.headSoftness; });
    f.addBinding(this.params, 'flowSpeed', { min: 0, max: 2, step: 0.05 })
      .on('change', () => { this.uniforms.flowSpeed.value = this.params.flowSpeed; });
    f.addBinding(this.params, 'flowLength', { min: 0.02, max: 0.5, step: 0.01 })
      .on('change', () => { this.uniforms.flowLength.value = this.params.flowLength; });
    f.addBinding(this.params, 'intensity', { min: 0, max: 6, step: 0.1 })
      .on('change', () => { this.uniforms.intensity.value = this.params.intensity; });
    f.addBinding(this.params, 'postArriveFade', { min: 0, max: 1, step: 0.05 });
    f.addBinding(this.params, 'postArriveFadeDuration', { min: 0, max: 2, step: 0.05 });
    f.addButton({ title: 'Test line (Beijing -> NY)' }).on('click', () => {
      this.clear();
      const A = new THREE.Vector3(0.53, 0.64, -0.56).normalize();
      const B = new THREE.Vector3(-0.21, 0.65, 0.73).normalize();
      const line = this.add(A, B);
      line.play({});
    });
  }
}
