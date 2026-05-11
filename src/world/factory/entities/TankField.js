import * as THREE from 'three/webgpu'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { FACTORY_CONFIG, FLYBAR_TANK_Y } from '../config.js'
import { createTankMaterial } from '../materials/createTankMaterial.js'
import {
    createLiquidMaterial,
    createFoamMaterial,
    createFoamTexture
} from '../materials/createLiquidMaterials.js'
import {
    createLabelPlane,
    drawTankNumber,
    drawVerticalTankName
} from '../labels/createLabelPlane.js'

export default class TankField {
    /**
     * @param {THREE.Object3D} boxScene  box.glb 的 scene
     * @param {Array<{ id: number, x: number, z: number, liquidState?: string, numberText?: string, processName?: string,
     *   temperatureC?: number|null, temperatureLimitC?: number|null }>} tankStates
     */
    constructor(boxScene, tankStates) {
        this.root = new THREE.Group()
        this.root.name = 'TankField'
        this.anchors = []
        this.decorations = []
        /** @type {typeof tankStates} */
        this.#tankStates = tankStates
        /** @type {Array<{ liquid: THREE.Mesh, sharedLiquidMat: THREE.MeshBasicMaterial, alarmLiquidMat: THREE.MeshBasicMaterial|null, tempAlert: { object: import('three/addons/renderers/CSS2DRenderer.js').CSS2DObject, tankIdEl: HTMLSpanElement, currentEl: HTMLSpanElement, thresholdEl: HTMLSpanElement, barFill: HTMLDivElement, statusEl: HTMLSpanElement }, lastLabelKey: string|null }>} */
        this.#tankVisuals = []
        this.#pulseT = 0

        const count = tankStates.length
        const tankRes = this.#prepareTankResources(boxScene, count)
        const liquidRes = this.#createLiquidResources(tankRes.size, tankRes.bbox)

        this.#populateInstances(tankStates, tankRes, liquidRes)

        this.root.add(tankRes.mesh)

        this.#tankResources = tankRes
        this.#liquidResources = liquidRes
        // 兼容外部访问
        this.mesh = tankRes.mesh
        this.material = tankRes.material
        this.geometry = tankRes.geometry
    }

    #tankStates
    #tankVisuals
    #tankResources
    #liquidResources
    #pulseT

    /** @param {number} tankId */
    getAnchor(tankId) {
        return this.anchors[tankId]
    }

    /**
     * 温度告警：槽体 aTempAlarm 呼吸、槽液克隆材质、温度标签刷新
     * @param {number} dt
     */
    update(dt) {
        if (!this.#tankStates?.length || !this.#tankVisuals.length) return

        this.#pulseT += dt
        const { breathRadPerSec, liquidColor, liquidOpacity } = FACTORY_CONFIG.tanks.temperatureAlarm
        const pulse = 0.45 + 0.55 * Math.sin(this.#pulseT * breathRadPerSec)
        const attr = this.mesh.geometry.attributes.aTempAlarm
        if (!attr) return

        for (let i = 0; i < this.#tankStates.length; i++) {
            const t = this.#tankStates[i]
            const over =
                t.temperatureLimitC != null &&
                t.temperatureC != null &&
                t.temperatureC > t.temperatureLimitC

            attr.array[i] = over ? pulse : 0

            const v = this.#tankVisuals[i]
            if (over && !v.alarmLiquidMat) {
                v.alarmLiquidMat = /** @type {THREE.MeshBasicMaterial} */ (v.sharedLiquidMat.clone())
                v.alarmLiquidMat.color.setStyle(liquidColor)
                v.alarmLiquidMat.opacity = liquidOpacity
                v.alarmLiquidMat.transparent = true
                v.liquid.material = v.alarmLiquidMat
            } else if (!over && v.alarmLiquidMat) {
                v.liquid.material = v.sharedLiquidMat
                v.alarmLiquidMat.dispose()
                v.alarmLiquidMat = null
            }

            const curNum = t.temperatureC
            const limNum = t.temperatureLimitC
            const labelKey = `${curNum ?? 'x'}|${limNum ?? 'x'}|${over ? '1' : '0'}`
            if (labelKey !== v.lastLabelKey) {
                v.lastLabelKey = labelKey
                const ta = v.tempAlert
                ta.tankIdEl.textContent = (t.numberText && String(t.numberText).trim()) || '--'
                ta.currentEl.textContent = formatTempC(curNum)
                if (limNum != null && !Number.isNaN(Number(limNum))) {
                    ta.thresholdEl.textContent = `${Number(limNum).toFixed(1)}°C ⚠️`
                } else {
                    ta.thresholdEl.textContent = '--'
                }
                if (over && curNum != null && limNum != null) {
                    const delta = Number(curNum) - Number(limNum)
                    ta.statusEl.textContent = `超限 +${delta.toFixed(1)}°C`
                } else {
                    ta.statusEl.textContent = ''
                }
                if (curNum != null && limNum != null && Number(limNum) > 0) {
                    const pct = Math.min(100, (Number(curNum) / Number(limNum)) * 100)
                    ta.barFill.style.width = `${pct}%`
                } else {
                    ta.barFill.style.width = '0%'
                }
            }
            v.tempAlert.object.visible = over
        }
        attr.needsUpdate = true
    }

    dispose() {
        const t = this.#tankResources
        const l = this.#liquidResources
        t?.geometry.dispose()
        t?.material.dispose()
        l?.liquidGeometry.dispose()
        l?.calmMaterial.dispose()
        l?.boilingMaterial.dispose()
        l?.foamMaterial.dispose()
        l?.foamTexture.dispose()
        for (const v of this.#tankVisuals) {
            if (v.alarmLiquidMat) {
                v.alarmLiquidMat.dispose()
                v.alarmLiquidMat = null
            }
            v.tempAlert.object.element.remove()
        }
        this.#tankVisuals = []
        this.decorations.forEach((d) => d.dispose())
        this.root.parent?.remove(this.root)
    }

    // ---- 阶段 1：储罐几何 / 实例属性 / 实例化网格 ----
    #prepareTankResources(boxScene, count) {
        const sourceMesh = findFirstMesh(boxScene)
        if (!sourceMesh) {
            throw new Error('[TankField] box.glb contains no mesh')
        }

        const geometry = sourceMesh.geometry.clone()
        geometry.computeBoundingBox()
        const bbox = geometry.boundingBox.clone()
        const size = bbox.getSize(new THREE.Vector3())
        const center = bbox.getCenter(new THREE.Vector3())

        const sourceMaterial = Array.isArray(sourceMesh.material) ? sourceMesh.material[0] : sourceMesh.material
        const baseMap = sourceMaterial?.map ?? null

        const { baseRoughness, baseMetalness, jitter, tint, temperatureAlarm } = FACTORY_CONFIG.tanks
        const aRough = new Float32Array(count)
        const aMetal = new Float32Array(count)
        const aTempAlarm = new Float32Array(count)
        for (let i = 0; i < count; i++) {
            aRough[i] = clamp01(baseRoughness + (Math.random() * 2 - 1) * jitter)
            aMetal[i] = clamp01(baseMetalness + (Math.random() * 2 - 1) * jitter)
            aTempAlarm[i] = 0
        }
        geometry.setAttribute('aRough', new THREE.InstancedBufferAttribute(aRough, 1))
        geometry.setAttribute('aMetal', new THREE.InstancedBufferAttribute(aMetal, 1))
        geometry.setAttribute('aTempAlarm', new THREE.InstancedBufferAttribute(aTempAlarm, 1))

        const material = createTankMaterial(baseMap, {
            tint,
            alarmBodyColor: temperatureAlarm.bodyMixColor
        })
        const mesh = new THREE.InstancedMesh(geometry, material, count)
        mesh.castShadow = true
        mesh.receiveShadow = true

        return { geometry, material, mesh, bbox, size, center }
    }

    // ---- 阶段 2：液面 / 泡沫共享资源 ----
    #createLiquidResources(size, bbox) {
        const liquidWidth = Math.max(size.x, FACTORY_CONFIG.tanks.widthX)
        // 4.2: 模型本身 z 向偏窄，给液面留出可见的最小尺寸
        const liquidDepth = Math.max(size.z, 4.2)
        // 0.12: 液面距罐顶约 12% 罐高，避免穿出顶盖
        const liquidY = bbox.max.y - size.y * 0.12

        const liquidGeometry = new THREE.PlaneGeometry(liquidWidth, liquidDepth)
        liquidGeometry.rotateX(-Math.PI / 2)

        const foamTexture = createFoamTexture()
        return {
            liquidGeometry,
            liquidY,
            calmMaterial: createLiquidMaterial(0.42),
            boilingMaterial: createLiquidMaterial(0.5),
            foamMaterial: createFoamMaterial(foamTexture),
            foamTexture
        }
    }

    // ---- 阶段 3：逐实例填充 matrix / anchor / 液面 / 泡沫 / 侧面标签 ----
    #populateInstances(tankStates, tankRes, liquidRes) {
        const { mesh, bbox, center } = tankRes
        const { liquidGeometry, liquidY, calmMaterial, boilingMaterial, foamMaterial } = liquidRes
        const dummy = new THREE.Object3D()

        this.#tankVisuals = []

        for (let i = 0; i < tankStates.length; i++) {
            const t = tankStates[i]

            dummy.position.set(t.x, 0, t.z)
            dummy.rotation.set(0, 0, 0)
            dummy.scale.set(1, 1, 1)
            dummy.updateMatrix()
            mesh.setMatrixAt(i, dummy.matrix)

            const anchor = new THREE.Object3D()
            anchor.position.set(t.x, FLYBAR_TANK_Y, t.z)
            this.root.add(anchor)
            this.anchors.push(anchor)

            const liquidMat = t.liquidState === 'boiling' ? boilingMaterial : calmMaterial
            const liquid = new THREE.Mesh(liquidGeometry, liquidMat)
            liquid.name = `Tank-${t.id + 1}-Liquid`
            liquid.position.set(t.x + center.x, liquidY, t.z + center.z)
            liquid.renderOrder = 1
            this.root.add(liquid)

            /** @type {{ liquid: THREE.Mesh, sharedLiquidMat: THREE.MeshBasicMaterial, alarmLiquidMat: THREE.MeshBasicMaterial|null, tempAlert: { object: import('three/addons/renderers/CSS2DRenderer.js').CSS2DObject, tankIdEl: HTMLSpanElement, currentEl: HTMLSpanElement, thresholdEl: HTMLSpanElement, barFill: HTMLDivElement, statusEl: HTMLSpanElement }, lastLabelKey: string|null }} */
            const visual = {
                liquid,
                sharedLiquidMat: liquidMat,
                alarmLiquidMat: null,
                tempAlert: this.#createTemperatureAlert(t),
                lastLabelKey: null
            }
            this.#tankVisuals.push(visual)
            this.root.add(visual.tempAlert.object)

            if (t.liquidState === 'boiling') {
                const foam = new THREE.Mesh(liquidGeometry, foamMaterial)
                foam.name = `Tank-${t.id + 1}-Foam`
                foam.position.set(t.x + center.x, liquidY + 0.03, t.z + center.z)
                foam.renderOrder = 2
                this.root.add(foam)
            }

            this.#addSideLabels(t, bbox, center)
        }
        mesh.instanceMatrix.needsUpdate = true
    }

    // ---- 阶段 4：单个储罐两侧的编号/名称标签 ----
    /**
     * @param {{ id: number, numberText?: string, processName?: string }} tank
     */
    #addSideLabels(tank, bbox, center) {
        // 标签平面尺寸（世界单位）与离地高度
        const numberWidth = 6
        const numberHeight = 3
        const gapNumberName = 0.35
        const nameWidth = 5
        const nameHeight = 20
        const yBase = bbox.min.y + 0.45
        // 0.04: 让标签略微外移，避免与罐体表面 z-fight
        const sides = [bbox.min.z - 0.04, bbox.max.z + 0.04]

        for (const sideZ of sides) {
            const facesNegativeZ = sideZ < center.z

            const number = createLabelPlane({
                width: numberWidth,
                height: numberHeight,
                canvasW: 256,
                canvasH: 128,
                draw: drawTankNumber
            })
            number.mesh.position.set(tank.x + center.x, yBase + numberHeight / 2, tank.z + sideZ)
            number.mesh.rotation.y = facesNegativeZ ? Math.PI : 0
            number.mesh.renderOrder = 3

            const name = createLabelPlane({
                width: nameWidth,
                height: nameHeight,
                canvasW: 128,
                canvasH: 512,
                draw: drawVerticalTankName
            })
            const yName = yBase + numberHeight + gapNumberName + nameHeight / 2
            name.mesh.position.set(tank.x + center.x, yName, tank.z + sideZ)
            name.mesh.rotation.y = facesNegativeZ ? Math.PI : 0
            name.mesh.renderOrder = 3

            number.setText(tank.numberText)
            name.setText(tank.processName)

            this.root.add(number.mesh, name.mesh)
            this.decorations.push(number, name)
        }
    }

    /**
     * 背景：`/img/error_dialog.png`；正文排版同 `temperature_warning_compact.html`。
     * 外层 `tank-temp-css2d` 供 CSS2D 挂接；内层 `tank-temperature-alert` 做底部锚点偏移。
     * @param {{ id: number, x: number, z: number }} tank
     */
    #createTemperatureAlert(tank) {
        const root = document.createElement('div')
        root.className = 'tank-temp-css2d'

        const wrap = document.createElement('div')
        wrap.className = 'tank-temperature-alert'

        const card = document.createElement('div')
        card.className = 'alert-card'
        card.setAttribute('role', 'alert')
        card.setAttribute('aria-label', '温度预警')

        const header = document.createElement('div')
        header.className = 'alert-header'

        const title = document.createElement('span')
        title.className = 'alert-title'
        title.textContent = '温度预警'
        header.appendChild(title)

        const body = document.createElement('div')
        body.className = 'alert-body'

        const rowTank = document.createElement('div')
        rowTank.className = 'tank-temp-row'
        const labTank = document.createElement('span')
        labTank.className = 'row-label'
        labTank.textContent = '槽体'
        const tankIdEl = document.createElement('span')
        tankIdEl.className = 'row-value'
        rowTank.append(labTank, tankIdEl)

        const divider1 = document.createElement('div')
        divider1.className = 'divider'

        const rowCur = document.createElement('div')
        rowCur.className = 'tank-temp-row tank-temp-row--current'
        const labCur = document.createElement('span')
        labCur.className = 'row-label'
        labCur.textContent = '当前温度'
        const currentEl = document.createElement('span')
        currentEl.className = 'row-value hot'
        rowCur.append(labCur, currentEl)

        const barTrack = document.createElement('div')
        barTrack.className = 'bar-track'
        const barFill = document.createElement('div')
        barFill.className = 'bar-fill'
        barTrack.appendChild(barFill)

        const thRow = document.createElement('div')
        thRow.className = 'threshold-row'
        const labTh = document.createElement('span')
        labTh.className = 'row-label'
        labTh.textContent = '阈值'
        const thresholdEl = document.createElement('span')
        thresholdEl.className = 'threshold-value'
        thRow.append(labTh, thresholdEl)

        const divider2 = document.createElement('div')
        divider2.className = 'divider divider--loose'

        const statusLine = document.createElement('div')
        statusLine.className = 'status-line'
        const dot = document.createElement('div')
        dot.className = 'dot'
        const statusEl = document.createElement('span')
        statusEl.className = 'status-text'
        statusLine.append(dot, statusEl)

        body.append(rowTank, divider1, rowCur, barTrack, thRow, divider2, statusLine)
        card.append(header, body)
        wrap.appendChild(card)
        root.appendChild(wrap)

        const object = new CSS2DObject(root)
        object.position.set(tank.x, 10, tank.z-25)
        object.visible = false

        return { object, tankIdEl, currentEl, thresholdEl, barFill, statusEl }
    }
}

function findFirstMesh(root) {
    let found = null
    root.traverse((c) => {
        if (!found && c.isMesh) found = c
    })
    return found
}

function clamp01(v) {
    return Math.max(0, Math.min(1, v))
}

/**
 * @param {number|null|undefined} v
 */
function formatTempC(v) {
    if (v == null || Number.isNaN(Number(v))) {
        return '--'
    }
    return `${Number(v).toFixed(1)}°C`
}
