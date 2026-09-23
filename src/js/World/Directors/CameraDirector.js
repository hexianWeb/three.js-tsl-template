import { gsap } from 'gsap'
import Experience from '../../Experience.js'

export default class CameraDirector {
  constructor() {
    this.experience = new Experience()
    this.camera = this.experience.camera
    this.events = this.experience.events
    this.debug = this.experience.debug
    this.params = {
      currentShot: 'none',
      orbitEnabled: false,
    }
    // 镜头和 Target 都使用 PresentationRoot 归一化后的世界坐标，避免依赖 GLB 内的相机或原始毫米单位。
    this.shots = {
      folded: {
        positionX: 2.1,
        positionY: 2.6,
        positionZ: 4.5,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        fov: 30,
        duration: 1.2,
      },
      assembly: {
        positionX: 4.75,
        positionY: 9.15,
        positionZ: 1,
        targetX: -0.1,
        targetY: 0.2,
        targetZ: 1,
        fov: 27,
        duration: 2,
      },
      hero: {
        positionX: 0,
        positionY: 3.5,
        positionZ: 5,
        targetX: 0,
        targetY: 0.25,
        targetZ: 0,
        fov: 31,
        duration: 1.35,
      },
      play: {
        positionX: 0,
        positionY: 3.75,
        positionZ: 4.0,
        targetX: 0,
        targetY: 0.2,
        targetZ: 0.05,
        fov: 30,
        duration: 1.1,
      },
    }
    this.stateShots = {
      'intro-folded': 'folded',
      'intro-unfold': 'assembly',
      'screen-wake': 'assembly',
      'controller-assembly': 'assembly',
      'game-changer': 'assembly',
      'hero': 'hero',
      'ready': 'hero',
    }
    this.productShots = {
      'game-home': 'hero',
      'playing': 'play',
    }

    this.camera.controls.enabled = true
    this.unsubscribeState = this.events.on('intro:state', ({ state }) => {
      this.handleState(state)
    })
    this.unsubscribeProductMode = this.events.on('product:mode', ({ mode }) => {
      this.handleProductMode(mode)
    })
    this.debugInit()
  }

  handleState(state) {
    const shotName = this.stateShots[state]
    if (!shotName)
      return

    this.transitionTo(shotName, {
      immediate: state === 'intro-folded',
    })
  }

  handleProductMode(mode) {
    const shotName = this.productShots[mode]
    if (!shotName)
      return

    this.transitionTo(shotName)
  }

  transitionTo(name, { immediate = false, force = false } = {}) {
    const shot = this.shots[name]
    if (!shot || (!force && this.params.currentShot === name))
      return

    this.killTransition()
    this.params.currentShot = name
    this.currentShotBinding?.refresh()
    this.camera.controls.enabled = false

    if (immediate || shot.duration === 0) {
      this.applyShot(shot)
      this.restoreOrbitState()
      return
    }

    this.timeline = gsap.timeline({
      defaults: {
        duration: shot.duration,
        ease: 'power2.inOut',
      },
      onComplete: () => {
        this.timeline = null
        this.restoreOrbitState()
      },
    })
    this.timeline
      .to(this.camera.instance.position, {
        x: shot.positionX,
        y: shot.positionY,
        z: shot.positionZ,
      }, 0)
      .to(this.camera.controls.target, {
        x: shot.targetX,
        y: shot.targetY,
        z: shot.targetZ,
      }, 0)
      .to(this.camera.instance, {
        fov: shot.fov,
        onUpdate: () => this.camera.instance.updateProjectionMatrix(),
      }, 0)
  }

  applyShot(shot) {
    this.camera.instance.position.set(
      shot.positionX,
      shot.positionY,
      shot.positionZ,
    )
    this.camera.controls.target.set(
      shot.targetX,
      shot.targetY,
      shot.targetZ,
    )
    this.camera.instance.fov = shot.fov
    this.camera.instance.updateProjectionMatrix()
    this.camera.controls.update()
  }

  captureShot(name) {
    const shot = this.shots[name]
    const position = this.camera.instance.position
    const target = this.camera.controls.target

    shot.positionX = position.x
    shot.positionY = position.y
    shot.positionZ = position.z
    shot.targetX = target.x
    shot.targetY = target.y
    shot.targetZ = target.z
    shot.fov = this.camera.instance.fov
    this.shotBindings[name].forEach(binding => binding.refresh())
  }

  killTransition() {
    this.timeline?.kill()
    this.timeline = null
  }

  restoreOrbitState() {
    // Playing 时指针属于 NDS 下屏，即使调试 Orbit 开关开启，也不能抢走触控拖动。
    this.camera.controls.enabled = this.params.orbitEnabled
      && !this.timeline
      && this.experience.state.productMode !== 'playing'
  }

  debugInit() {
    const folder = this.debug.ui.addFolder({
      title: 'Camera Director',
      expanded: true,
    })
    this.currentShotBinding = folder.addBinding(this.params, 'currentShot', {
      label: 'Current Shot',
      readonly: true,
    })
    folder.addBinding(this.params, 'orbitEnabled', {
      label: 'Orbit Enabled',
    }).on('change', () => this.restoreOrbitState())

    this.shotBindings = {}
    Object.entries(this.shots).forEach(([name, shot]) => {
      const shotFolder = folder.addFolder({
        title: name[0].toUpperCase() + name.slice(1),
        expanded: false,
      })
      const bindings = []
      const addBinding = (key, options) => {
        const binding = shotFolder.addBinding(shot, key, options)
        binding.on('change', () => {
          if (this.params.currentShot === name && !this.timeline) {
            this.applyShot(shot)
          }
        })
        bindings.push(binding)
      }

      const positionKeys = ['positionX', 'positionY', 'positionZ']
      positionKeys.forEach((key) => {
        addBinding(key, { label: key, min: -12, max: 12, step: 0.05 })
      })
      const targetKeys = ['targetX', 'targetY', 'targetZ']
      targetKeys.forEach((key) => {
        addBinding(key, { label: key, min: -6, max: 6, step: 0.05 })
      })
      addBinding('fov', { label: 'fov', min: 15, max: 70, step: 1 })
      addBinding('duration', {
        label: 'duration',
        min: 0,
        max: 4,
        step: 0.05,
      })
      this.shotBindings[name] = bindings

      shotFolder.addButton({ title: 'Preview Shot' }).on('click', () => {
        this.transitionTo(name, { force: true })
      })
      shotFolder.addButton({ title: 'Capture Current' }).on('click', () => {
        this.captureShot(name)
      })
    })
  }

  destroy() {
    this.killTransition()
    this.unsubscribeState?.()
    this.unsubscribeProductMode?.()
    this.camera.controls.enabled = true
  }
}
