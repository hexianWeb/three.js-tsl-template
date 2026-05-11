import * as THREE from 'three/webgpu'
import { FACTORY_CONFIG, FLYBAR_TANK_Y } from '../config.js'
import { createTankMaterial } from '../materials/createTankMaterial.js'
import {
    createLiquidMaterial,
    createFoamMaterial,
    createFoamTexture
} from '../materials/createLiquidMaterials.js'
import {
    createTemperatureAlert,
    updateTemperatureAlert
} from '../labels/createTemperatureAlert.js'
import { createTankSideLabels } from '../labels/createTankSideLabels.js'

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
        /** 温度弹窗轮播计时（秒），多槽同时超限时仅显示其一 */
        this.#alertCarouselT = 0
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
    #alertCarouselT

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
        this.#alertCarouselT += dt
        const { breathRadPerSec, liquidColor, liquidOpacity, alertRotateSec } = FACTORY_CONFIG.tanks.temperatureAlarm
        const pulse = 0.45 + 0.55 * Math.sin(this.#pulseT * breathRadPerSec)
        const attr = this.mesh.geometry.attributes.aTempAlarm
        if (!attr) return

        const n = this.#tankStates.length
        /** @type {boolean[]} */
        const overFlags = new Array(n)
        for (let i = 0; i < n; i++) {
            const t = this.#tankStates[i]
            overFlags[i] =
                t.temperatureLimitC != null &&
                t.temperatureC != null &&
                t.temperatureC > t.temperatureLimitC
        }

        const overIndices = []
        for (let i = 0; i < n; i++) {
            if (overFlags[i]) overIndices.push(i)
        }
        const dwell = Math.max(0.5, Number(alertRotateSec) || 4)
        const activeCarouselIndex =
            overIndices.length === 0
                ? -1
                : overIndices[Math.floor(this.#alertCarouselT / dwell) % overIndices.length]

        for (let i = 0; i < n; i++) {
            const t = this.#tankStates[i]
            const over = overFlags[i]

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
                updateTemperatureAlert(v.tempAlert, t, over)
            }
            v.tempAlert.object.visible = over && i === activeCarouselIndex
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
                tempAlert: createTemperatureAlert(t),
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

            const sideLabels = createTankSideLabels(t, bbox, center)
            this.root.add(...sideLabels.map((label) => label.mesh))
            this.decorations.push(...sideLabels)
        }
        mesh.instanceMatrix.needsUpdate = true
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
