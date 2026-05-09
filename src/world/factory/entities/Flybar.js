import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

export class Flybar {
    /**
     * @param {number} id
     * @param {import('three/webgpu').Object3D} prototypeScene
     * @param {boolean} isEmpty 初始是否为空杆
     */
    constructor(id, prototypeScene, isEmpty = true) {
        this.id = id
        this.root = prototypeScene.clone(true)
        this.root.name = `Flybar-${id}`
        this.isEmpty = isEmpty

        // 创建 CSS2D 标签
        const labelEl = document.createElement('div')
        labelEl.className = 'flybar-status-label'
        labelEl.dataset.status = isEmpty ? 'idle' : 'immersing'

        const textSpan = document.createElement('span')
        textSpan.className = 'flybar-status-label__text'
        labelEl.appendChild(textSpan)

        this.labelEl = labelEl
        this.textSpan = textSpan

        const labelObject = new CSS2DObject(labelEl)
        // 标签位置在飞杆上方
        labelObject.position.set(0, 10, 25)
        labelObject.visible = false // 初始隐藏
        this.root.add(labelObject)
        this.labelObject = labelObject

        this.updateLabel()
    }

    /**
     * 更新标签文本和颜色
     */
    updateLabel() {
        const statusText = this.isEmpty ? '闲置中' : '浸泡中'
        this.textSpan.textContent = `[${statusText}] ${this.id}`
        this.labelEl.dataset.status = this.isEmpty ? 'idle' : 'immersing'
    }

    /**
     * 设置飞杆是否为空杆
     * @param {boolean} isEmpty
     */
    setIsEmpty(isEmpty) {
        this.isEmpty = isEmpty
        this.updateLabel()
    }

    /**
     * 显示标签（飞杆在tank上时调用）
     */
    showLabel() {
        this.labelObject.visible = true
    }

    /**
     * 隐藏标签（飞杆被crane拾取时调用）
     */
    hideLabel() {
        this.labelObject.visible = false
    }

    dispose() {
        this.labelObject.removeFromParent()
        this.labelEl.remove()
        this.root.parent?.remove(this.root)
    }
}

export class FlybarPool {
    /**
     * @param {import('three/webgpu').Object3D} prototypeScene
     * @param {Array<{ id: number, isEmpty: boolean }>} flybarStates
     */
    constructor(prototypeScene, flybarStates) {
        this.flybars = []
        for (const state of flybarStates) {
            this.flybars.push(new Flybar(state.id, prototypeScene, state.isEmpty))
        }
    }

    /**
     * @param {number} id
     * @returns {Flybar}
     */
    get(id) {
        return this.flybars[id]
    }

    dispose() {
        this.flybars.forEach((f) => f.dispose())
    }
}
