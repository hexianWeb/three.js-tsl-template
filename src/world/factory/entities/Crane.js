import * as THREE from 'three/webgpu'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import gsap from 'gsap'
import { FLYBAR_CRANE_Y } from '../config.js'
import { createLabelPlane, drawLabel } from '../labels/createLabelPlane.js'

const CRANE_LABEL_WIDTH = 8
const CRANE_LABEL_HEIGHT = 8

export default class Crane {
    /** @type {THREE.Box3 | null} */
    static staticBBox = null

    /**
     * @param {{
     *   id: string,
     *   prototypeScene: THREE.Object3D,
     *   state: any,
     *   initialPosition: THREE.Vector3
     * }} opts
     */
    constructor({ id, prototypeScene, state, initialPosition }) {
        this.id = id
        this.state = state
        this.flybar = null
        this.tl = null

        this.root = new THREE.Group()
        this.root.name = `Crane-${id}`

        this.visual = prototypeScene.clone(true)

        if (!Crane.staticBBox) {
            Crane.staticBBox = new THREE.Box3().setFromObject(this.visual)
        }
        const bbox = Crane.staticBBox
        const center = bbox.getCenter(new THREE.Vector3())

        this.root.position.copy(initialPosition)
        this.root.add(this.visual)

        this.visual.traverse((c) => {
            if (c.isMesh) {
                c.castShadow = true
                c.receiveShadow = true
            }
        })

        this.flybarMount = new THREE.Object3D()
        this.flybarMount.name = 'flybarMount'
        this.flybarMount.position.set(0, FLYBAR_CRANE_Y - this.root.position.y, 0)
        this.root.add(this.flybarMount)

        this.#addSideLabels(bbox, center)
        this.#attachTrackCss2d(bbox, center)

        this.setLabel(state.labelText)
        this.setTrack(state.trackText)
    }

    /**
     * 为行车添加左右侧标牌（画布平面），用于显示行车编号等信息。
     * @description 创建并定位两个标牌平面，分别挂载到行车的左右侧，用于侧面标识。
     * @param {THREE.Box3} bbox - 行车模型的包围盒，用于计算标牌摆放位置。
     * @param {THREE.Vector3} center - 行车模型的几何中心点。
     */
    #addSideLabels(bbox, center) {
        const labelLeft = createLabelPlane({
            width: CRANE_LABEL_WIDTH,
            height: CRANE_LABEL_HEIGHT,
            draw: drawLabel
        })
        const labelRight = createLabelPlane({
            width: CRANE_LABEL_WIDTH,
            height: CRANE_LABEL_HEIGHT,
            draw: drawLabel
        })
        const y = center.y - CRANE_LABEL_HEIGHT / 2
        labelLeft.mesh.position.set(center.x, y, bbox.min.z)
        labelRight.mesh.position.set(center.x, y, bbox.max.z)
        this.root.add(labelLeft.mesh, labelRight.mesh)
        this.labelLeft = labelLeft
        this.labelRight = labelRight
    }

    /**
     * 为行车添加轨迹标牌（画布平面），用于显示行车轨迹等信息。
     * @description 创建并定位轨迹标牌平面，挂载到行车的顶部，用于显示行车轨迹。
     * @param {THREE.Box3} bbox - 行车模型的包围盒，用于计算标牌摆放位置。
     * @param {THREE.Vector3} center - 行车模型的几何中心点。
     */
    #attachTrackCss2d(bbox, center) {
        const trackEl = document.createElement('div')
        trackEl.className = 'crane-track-label'
        const m0 =
            this.state.mode === 'manual' || this.state.mode === 'maintenance'
                ? this.state.mode
                : 'auto'
        trackEl.dataset.trackMode = m0
        const trackTextSpan = document.createElement('span')
        trackTextSpan.className = 'crane-track-label__text'
        trackEl.appendChild(trackTextSpan)
        this.trackTextSpan = trackTextSpan
        const trackObject = new CSS2DObject(trackEl)
        trackObject.position.set(center.x, bbox.max.y + CRANE_LABEL_HEIGHT, center.z)
        this.root.add(trackObject)
        this.trackEl = trackEl
        this.trackObject = trackObject
    }

    moveToX(targetX, { duration, ease = 'power2.inOut' } = {}) {
        const r = this.state.moveRange
        const x =
            r && typeof r.minX === 'number' && typeof r.maxX === 'number'
                ? Math.max(r.minX, Math.min(r.maxX, targetX))
                : targetX
        const dx = Math.abs(x - this.root.position.x)
        const dur = duration ?? Math.max(0.4, dx / 12)
        return new Promise((resolve) => {
            this.tl?.kill()
            this.tl = gsap.timeline({
                onUpdate: () => {
                    this.state.x = this.root.position.x
                },
                onComplete: () => {
                    this.state.x = this.root.position.x
                    resolve()
                }
            })
            this.tl.to(this.root.position, { x, duration: dur, ease })
        })
    }

    pickFlybar(flybar) {
        if (this.flybar) {
            console.warn(`[Crane] ${this.id} already has flybar ${this.flybar.id}, replacing with ${flybar.id}`)
        }
        this.flybarMount.attach(flybar.root)
        flybar.hideLabel() // 飞杆被 crane 拾取时立即隐藏标签
        this.flybar = flybar
        return new Promise((resolve) => {
            gsap.to(flybar.root.position, {
                x: 0,
                y: 0,
                z: 0,
                duration: 0.6,
                ease: 'power2.out',
                onComplete: resolve
            })
        })
    }

    dropFlybar(targetAnchor) {
        if (!this.flybar) return Promise.resolve()
        const flybar = this.flybar
        targetAnchor.attach(flybar.root)
        return new Promise((resolve) => {
            gsap.to(flybar.root.position, {
                x: 0,
                y: 0,
                z: 0,
                duration: 0.6,
                ease: 'power2.in',
                onComplete: () => {
                    this.flybar = null
                    resolve()
                }
            })
        })
    }

    setMode(mode) {
        this.state.mode = mode
        const m = mode === 'manual' || mode === 'maintenance' ? mode : 'auto'
        this.trackEl.dataset.trackMode = m
    }

    setLabel(text) {
        this.labelLeft.setText(text)
        this.labelRight.setText(text)
        this.state.labelText = text
    }

    setTrack(text) {
        const value = text ?? ''
        if (this.trackTextSpan.textContent !== value) {
            this.trackTextSpan.textContent = value
        }
        this.state.trackText = text
    }

    update() {
        this.labelLeft.setText(this.state.labelText)
        this.labelRight.setText(this.state.labelText)
        this.setTrack(this.state.trackText)
    }

    dispose() {
        this.tl?.kill()
        this.labelLeft.dispose()
        this.labelRight.dispose()
        this.trackObject.removeFromParent()
        this.trackEl.remove()
        this.root.parent?.remove(this.root)
    }
}
