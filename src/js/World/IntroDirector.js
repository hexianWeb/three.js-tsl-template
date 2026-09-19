import { gsap } from 'gsap'
import Experience from '../Experience.js'

export default class IntroDirector {
  constructor({ productRig }) {
    this.experience = new Experience()
    this.events = this.experience.events
    this.state = this.experience.state
    this.debug = this.experience.debug
    this.productRig = productRig
    this.controllerAssembly = productRig.controllerAssembly
    this.angleState = { value: productRig.params.foldedAngle }
    this.params = {
      state: 'idle',
      foldedHold: 1.2,
      unfoldCrackAngle: 24,
      unfoldCrackDuration: 0.45,
      unfoldDuration: 1.55,
      assemblyDelay: 0.35,
      heroHold: 1,
    }

    this.debugInit()
  }

  play() {
    this.killFlow()
    this.setInitialPose()

    this.timeline = gsap.timeline({
      onComplete: () => {
        this.timeline = null
      },
    })
    this.timeline
      .to({}, { duration: this.params.foldedHold })
      .call(() => this.setState('intro-unfold'))
      // 先用 in 曲线撕开近闭合态，再用 out 曲线落到展示角。
      // ease-in 终点速度高、ease-out 起点速度高，两拍衔接不会在开缝角停住。
      .to(this.angleState, {
        value: this.getUnfoldCrackAngle(),
        duration: this.params.unfoldCrackDuration,
        ease: 'power3.in',
        onUpdate: () => this.applyUnfoldAngle(),
      })
      .to(this.angleState, {
        value: this.productRig.params.playAngle,
        duration: this.params.unfoldDuration,
        ease: 'power3.out',
        onUpdate: () => this.applyUnfoldAngle(),
      })
      .call(() => {
        this.productRig.productAngleBinding?.refresh()
        this.setState('screen-wake')
      })
      .to({}, { duration: this.params.assemblyDelay })
      .call(() => this.startAssembly())
  }

  setInitialPose() {
    this.angleState.value = this.productRig.params.foldedAngle
    this.productRig.setDebugAngle(this.angleState.value)
    this.controllerAssembly.setEntryPose({ prepare: false })
    this.controllerAssembly.setVisible(false)
    this.setState('intro-folded')
  }

  getUnfoldCrackAngle() {
    return Math.min(this.params.unfoldCrackAngle, this.productRig.params.playAngle)
  }

  applyUnfoldAngle() {
    this.productRig.setProductAngle(this.angleState.value)
  }

  startAssembly() {
    this.setState('controller-assembly')
    this.controllerAssembly.play({
      prepare: false,
      onComplete: () => this.enterHero(),
    })
  }

  enterHero() {
    this.setState('hero')
    this.heroDelay = gsap.delayedCall(this.params.heroHold, () => {
      this.heroDelay = null
      this.setState('ready')
    })
  }

  skip() {
    this.killFlow()
    this.productRig.setDebugAngle(this.productRig.params.playAngle)
    this.controllerAssembly.setInstalledPose()
    this.setState('ready')
  }

  enterPlay() {
    this.killFlow()
    this.productRig.setDebugAngle(this.productRig.params.playAngle)
    this.controllerAssembly.setInstalledPose()
    this.setState('play')
  }

  setState(state) {
    this.params.state = state
    this.state.setMode(state)
    this.stateBinding?.refresh()
    this.events.emit('intro:state', { state })
  }

  killFlow() {
    this.timeline?.kill()
    this.timeline = null
    this.heroDelay?.kill()
    this.heroDelay = null
    this.controllerAssembly.killTimeline()
  }

  debugInit() {
    const folder = this.debug.ui.addFolder({ title: 'Intro Director' })
    this.stateBinding = folder.addBinding(this.params, 'state', {
      label: 'State',
      readonly: true,
    })

    folder.addBinding(this.params, 'unfoldCrackAngle', {
      label: 'unfoldCrackAngle',
      min: 8,
      max: 90,
      step: 1,
    })

    const timingKeys = [
      'foldedHold',
      'unfoldCrackDuration',
      'unfoldDuration',
      'assemblyDelay',
      'heroHold',
    ]
    timingKeys.forEach((key) => {
      folder.addBinding(this.params, key, {
        label: key,
        min: 0,
        max: 4,
        step: 0.05,
      })
    })

    const actions = folder.addFolder({ title: 'Actions' })
    actions.addButton({ title: 'Replay Intro' }).on('click', () => this.play())
    actions.addButton({ title: 'Skip Intro' }).on('click', () => this.skip())
    actions.addButton({ title: 'Enter Play' }).on('click', () => this.enterPlay())
  }

  destroy() {
    this.killFlow()
  }
}
