import * as THREE from 'three/webgpu'
import { float, modelWorldMatrix, positionLocal, uniform } from 'three/tsl'
import { filteredPlasticNoise, plasticSurfaceNormal } from '../../../shaders/controllerPlastic.js'

export default class ControllerShellMaterial {
  constructor({ shell, debug }) {
    this.shell = shell
    this.originalMaterial = shell.material
    this.params = {
      color: '#3e5f7c',
      colorVariation: 0.025,
      colorFrequency: 1500,
      roughness: 0.45,
      roughnessVariation: 0.035,
      grainFrequency: 320,
      bumpStrength: 0.16,
      printLayers: false,
      printAxis: 'y',
      printFrequency: 160,
      printStrength: 0.015,
    }
    this.uniforms = {
      color: uniform(new THREE.Color(this.params.color)),
      printAxis: uniform(new THREE.Vector3(0, 1, 0)),
      printStrength: uniform(0),
    }
    for (const key of ['colorVariation', 'colorFrequency', 'roughness', 'roughnessVariation', 'grainFrequency', 'bumpStrength', 'printFrequency']) {
      this.uniforms[key] = uniform(this.params[key])
    }

    shell.geometry.computeBoundingBox()
    const bounds = shell.geometry.boundingBox
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    shell.updateWorldMatrix(true, false)
    const scale = shell.getWorldScale(new THREE.Vector3())
    scale.set(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z))
    const width = Math.max(size.x * scale.x, size.y * scale.y, size.z * scale.z)
    if (!Number.isFinite(width) || width <= 0 || Math.min(scale.x, scale.y, scale.z) <= 0) {
      throw new Error('Controller_Shell 无有效尺寸，无法建立程序化材质坐标。')
    }

    // 保留局部轴方向，只按最长边统一归一化；补偿导出缩放，避免逐轴归一化拉伸颗粒。
    // 纹理随装配移动，后续 PresentationRoot 的统一缩放不改变颗粒数量。
    const coordinate = positionLocal.sub(center).mul(scale.clone().divideScalar(width))
    const u = this.uniforms
    const colorNoise = filteredPlasticNoise(coordinate.mul(u.colorFrequency)).toVar()
    const grain = filteredPlasticNoise(coordinate.mul(u.grainFrequency)).toVar()
    const layerPhase = coordinate.dot(u.printAxis).mul(u.printFrequency)
    const layerFootprint = layerPhase.fwidth()
    const layerVisibility = float(1).sub(layerFootprint.smoothstep(0.25, 0.75))
    const layers = layerPhase.mul(Math.PI * 2).sin().mul(layerVisibility)

    // 强度表示微表面坡度，除以频率后再换算为视空间高度，避免提高频率同时放大凹凸。
    const worldWidth = modelWorldMatrix.element(0).xyz.length().mul(width / scale.x)
    const height = grain.mul(u.bumpStrength).div(u.grainFrequency)
      .add(layers.mul(u.printStrength).div(u.printFrequency.mul(Math.PI * 2)))
      .mul(worldWidth)
    const original = Array.isArray(this.originalMaterial) ? this.originalMaterial[0] : this.originalMaterial
    this.material = new THREE.MeshStandardNodeMaterial({
      metalness: 0,
      roughness: this.params.roughness,
      side: original.side,
      name: 'Controller_Shell_Procedural_Plastic',
    })
    this.material.colorNode = u.color.mul(float(1).add(colorNoise.mul(u.colorVariation)))
    this.material.roughnessNode = u.roughness.add(grain.mul(u.roughnessVariation)).clamp(0.08, 1)
    this.material.normalNode = plasticSurfaceNormal(height)
    shell.material = this.material
    this.debugInit(debug)
  }

  debugInit(debug) {
    this.folder = debug.ui.addFolder({ title: 'Controller Shell Plastic', expanded: false })
    this.folder.addBinding(this.params, 'color', { label: 'Base color' })
      .on('change', ({ value }) => this.uniforms.color.value.set(value))
    const ranges = {
      colorVariation: [0, 0.1, 0.001],
      colorFrequency: [1, 10000, 1],
      roughness: [0.15, 0.9, 0.01],
      roughnessVariation: [0, 0.12, 0.001],
      grainFrequency: [20, 1200, 1],
      bumpStrength: [0, 0.4, 0.005],
      printFrequency: [10, 800, 1],
    }
    Object.entries(ranges).forEach(([key, [min, max, step]]) => {
      this.folder.addBinding(this.params, key, { min, max, step })
        .on('change', ({ value }) => { this.uniforms[key].value = value })
    })
    this.folder.addBinding(this.params, 'printLayers', { label: 'Print layers' })
      .on('change', () => this.updatePrintStrength())
    this.folder.addBinding(this.params, 'printStrength', { min: 0, max: 0.1, step: 0.001 })
      .on('change', () => this.updatePrintStrength())
    this.folder.addBinding(this.params, 'printAxis', { options: { X: 'x', Y: 'y', Z: 'z' } })
      .on('change', ({ value }) => {
        this.uniforms.printAxis.value.set(0, 0, 0)
        this.uniforms.printAxis.value[value] = 1
      })
  }

  updatePrintStrength() {
    this.uniforms.printStrength.value = this.params.printLayers ? this.params.printStrength : 0
  }

  destroy() {
    this.folder.dispose()
    this.shell.material = this.originalMaterial
    this.material.dispose()
  }
}
