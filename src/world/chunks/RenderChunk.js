import * as THREE from 'three/webgpu'

export default class RenderChunk {
  constructor({ key, origin, cellSize, renderers }) {
    this.key = key
    this.origin = origin
    this.cellSize = cellSize
    this.renderers = renderers
    this.group = new THREE.Group()
    this.group.name = `RenderChunk:${key}`
    this.group.position.set(origin.x * cellSize, 0, origin.z * cellSize)
  }

  get legoMaterial() {
    return this.renderers.terrain?.material ?? null
  }

  get waterMaterial() {
    return this.renderers.water?.material ?? null
  }

  build({ terrainMap, placements, colorResolver, heightfieldAO, profileMs = null }) {
    const timed = (label, fn) => {
      if (!profileMs) {
        return fn()
      }
      const start = performance.now()
      const result = fn()
      profileMs[label] = performance.now() - start
      return result
    }

    this.addRendererGroup(timed('render.terrain', () =>
      this.renderers.terrain?.build(placements, colorResolver, heightfieldAO)))
    this.addRendererGroup(timed('render.water', () =>
      this.renderers.water?.build(terrainMap)))
    this.addRendererGroup(timed('render.lava', () =>
      this.renderers.lava?.build(terrainMap)))
    this.addRendererGroup(timed('render.prefabs', () =>
      this.renderers.prefabs?.build(terrainMap)))
    return this.group
  }

  updateInstanceColors() {
    this.renderers.terrain?.updateInstanceColors?.()
  }

  setPreviewVisible(preview) {
    if (this.renderers.terrain?.group) {
      this.renderers.terrain.group.visible = true
    }
    for (const name of ['water', 'lava', 'prefabs']) {
      if (this.renderers[name]?.group) {
        this.renderers[name].group.visible = !preview
      }
    }
  }

  dispose() {
    for (const renderer of Object.values(this.renderers)) {
      renderer?.dispose?.()
    }
    this.group.parent?.remove(this.group)
    this.group.clear()
  }

  addRendererGroup(group) {
    if (group) {
      this.group.add(group)
    }
  }
}
