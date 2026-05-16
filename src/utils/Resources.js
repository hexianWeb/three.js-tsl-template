import sources from '../sources.js'
import { eventBus } from './event-bus.js'

import * as THREE from 'three/webgpu'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

export default class Resources {
  constructor() {
    this.items = {}
    this.sources = sources
    this.toLoad = sources.length
    this.loaded = 0

    this.ready = new Promise(resolve => {
      this._resolveReady = resolve
    })

    /** @type {boolean} */
    this._beginLoadCalled = false
    /** @type {Record<string, unknown> | null} */
    this.loaders = null
  }

  /**
   * 必须在 WebGPURenderer `init()` 完成后调用（KTX2 需要 detectSupport）。
   *
   * @param {THREE.WebGPURenderer} renderer
   */
  beginLoad(renderer) {
    if (this._beginLoadCalled) {
      return
    }
    this._beginLoadCalled = true

    if (this.toLoad === 0) {
      this._resolveReady()
      eventBus.emit('source ready')
      return
    }

    this.loaders = {
      gltfModel: new GLTFLoader(),
      texture: new THREE.TextureLoader(),
      cubeTexture: new THREE.CubeTextureLoader(),
      font: new FontLoader(),
      fbxModel: new FBXLoader(),
      audio: new THREE.AudioLoader(),
      objModel: new OBJLoader(),
      hdrTexture: new HDRLoader(),
      svg: new SVGLoader(),
      exrTexture: new EXRLoader(),
      video: null,
      ktx2Texture: new KTX2Loader()
    }

    const usesKtx2 = this.sources.some(s => s.type === 'ktx2Texture')
    if (usesKtx2) {
      const ktx2 = /** @type {KTX2Loader} */ (this.loaders.ktx2Texture)
      ktx2.setTranscoderPath('/basis/')
      ktx2.detectSupport(renderer)
    }

    // TODO: user may need to set decoder paths for GLTF/Draco
    // this.loaders.gltfModel.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'))

    for (const source of this.sources) {
      this.loadResource(source)
    }
  }

  loadResource(source) {
    const { name, type, path } = source
    const loader = /** @type {import('three').Loader & { load: Function }} */ (this.loaders[type])

    if (!loader && type !== 'video') {
      console.error(`[Resources] Unknown type "${type}" for "${name}"`)
      this.itemLoaded(name, null)
      return
    }

    const onLoad = file => {
      this.items[name] = file
      this.itemLoaded(name, file)
    }
    const onError = err => {
      console.error(`[Resources] Failed to load ${type} "${name}":`, err)
      this.itemLoaded(name, null)
    }

    if (type === 'video') {
      const video = document.createElement('video')
      video.src = path
      video.muted = true
      video.playsInline = true
      video.autoplay = true
      video.loop = true
      video.oncanplay = () => {
        const texture = new THREE.VideoTexture(video)
        this.items[name] = texture
        this.itemLoaded(name, texture)
      }
      video.onerror = onError
      return
    }

    loader.load(path, onLoad, undefined, onError)
  }

  itemLoaded(name, file) {
    this.loaded++
    if (this.loaded === this.toLoad) {
      this._resolveReady()
      eventBus.emit('source ready')
    }
  }
}
