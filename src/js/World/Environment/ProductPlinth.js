import * as THREE from 'three/webgpu'
import { createPlinthGeometry } from './exhibitionGeometry.js'

export default class ProductPlinth {
  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'ProductPlinth'
    this.material = new THREE.MeshStandardNodeMaterial({ color: '#e8e3da', roughness: 0.42, metalness: 0 })
    this.trimMaterial = new THREE.MeshStandardNodeMaterial({
      color: '#f9e2bc', emissive: '#ffe2ac', emissiveIntensity: 0.8, roughness: 0.5,
    })
    this.body = new THREE.Mesh(new THREE.BufferGeometry(), this.material)
    this.body.name = 'PlinthBody'
    this.body.castShadow = true
    this.body.receiveShadow = true
    this.trim = new THREE.Mesh(new THREE.BufferGeometry(), this.trimMaterial)
    this.trim.name = 'PlinthEdgeLight'
    this.group.add(this.body, this.trim)
  }

  setLayout({ width, depth, height, radius, bevel, centerX, centerZ, supportY }) {
    const trimHeight = height * 0.07
    this.body.geometry.dispose()
    this.trim.geometry.dispose()
    this.body.geometry = createPlinthGeometry(width, depth, height - trimHeight, radius, bevel)
    this.trim.geometry = createPlinthGeometry(width - bevel, depth - bevel, trimHeight, radius, trimHeight * 0.2)
    this.group.position.set(centerX, supportY, centerZ)
    // 顶面固定为局部 Y=0；厚度变化只向下扩张，细灯带落在底部的独立高度区间。
    this.body.position.y = -(height - trimHeight) / 2
    this.trim.position.y = -height + trimHeight / 2
  }

  setAppearance({ color, roughness, edgeGlow }) {
    this.material.color.set(color)
    this.material.roughness = roughness
    this.trimMaterial.emissiveIntensity = edgeGlow
  }

  destroy() {
    this.group.removeFromParent()
    this.body.geometry.dispose()
    this.trim.geometry.dispose()
    this.material.dispose()
    this.trimMaterial.dispose()
  }
}
