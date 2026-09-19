import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import Experience from '../Experience.js'

export default class Resources {
  constructor(sources) {
    this.experience = new Experience()
    this.events = this.experience.events
    this.sources = sources
    this.items = {}
    this.loaders = {
      exrTexture: new EXRLoader(),
      gltfModel: new GLTFLoader(),
    }
  }

  async load() {
    const total = this.sources.length
    let loaded = 0

    this.events.emit('resources:progress', {
      loaded,
      total,
      name: this.sources[0]?.name ?? 'resources',
    })

    await Promise.all(this.sources.map(async (source) => {
      const loader = this.loaders[source.type]

      if (!loader) {
        throw new Error(`资源 ${source.name} 使用了未知类型：${source.type}`)
      }

      try {
        this.items[source.name] = await loader.loadAsync(source.path)
        loaded += 1
        this.events.emit('resources:progress', {
          loaded,
          total,
          name: source.name,
        })
      }
      catch (error) {
        throw new Error(`资源 ${source.name} 加载失败：${error instanceof Error ? error.message : source.path}`)
      }
    }))

    this.events.emit('resources:ready', this.items)
    return this.items
  }
}
