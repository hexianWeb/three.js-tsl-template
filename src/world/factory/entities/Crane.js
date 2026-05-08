import * as THREE from 'three/webgpu'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import gsap from 'gsap'
import { FLYBAR_CRANE_Y } from '../config.js'
import { createLabelPlane, drawLabel } from '../labels/createLabelPlane.js'

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

        const labelLeft = createLabelPlane({ width: 8, height: 8, draw: drawLabel })
        const labelRight = createLabelPlane({ width: 8, height: 8, draw: drawLabel })
        labelLeft.mesh.position.set(center.x, center.y-4.0, bbox.min.z)
        labelRight.mesh.position.set(center.x, center.y-4.0, bbox.max.z)
        this.root.add(labelLeft.mesh, labelRight.mesh)
        this.labelLeft = labelLeft
        this.labelRight = labelRight

        const trackEl = document.createElement('div')
        trackEl.className = 'crane-track-label'
        const trackObject = new CSS2DObject(trackEl)
        trackObject.position.set(center.x, bbox.max.y + 6, center.z)
        this.root.add(trackObject)
        this.trackEl = trackEl
        this.trackObject = trackObject

        this.setLabel(state.labelText)
        this.setTrack(state.trackText)
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
    }

    setLabel(text) {
        this.labelLeft.setText(text)
        this.labelRight.setText(text)
        this.state.labelText = text
    }

    setTrack(text) {
        const value = text ?? ''
        if (this.trackEl.textContent !== value) {
            this.trackEl.textContent = value
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
