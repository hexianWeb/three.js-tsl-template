import * as THREE from 'three/webgpu'
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
     * @param {Array<{ id: number, x: number, z: number, liquidState?: string, numberText?: string, processName?: string }>} tankStates
     */
    constructor(boxScene, tankStates) {
        this.root = new THREE.Group()
        this.root.name = 'TankField'
        this.anchors = []
        this.decorations = []

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

    #tankResources
    #liquidResources

    /** @param {number} tankId */
    getAnchor(tankId) {
        return this.anchors[tankId]
    }

    // 当前是静态实体，保留接口以便后续做液面/泡沫动画
    update() {}

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

        const { baseRoughness, baseMetalness, jitter, tint } = FACTORY_CONFIG.tanks
        const aRough = new Float32Array(count)
        const aMetal = new Float32Array(count)
        for (let i = 0; i < count; i++) {
            aRough[i] = clamp01(baseRoughness + (Math.random() * 2 - 1) * jitter)
            aMetal[i] = clamp01(baseMetalness + (Math.random() * 2 - 1) * jitter)
        }
        geometry.setAttribute('aRough', new THREE.InstancedBufferAttribute(aRough, 1))
        geometry.setAttribute('aMetal', new THREE.InstancedBufferAttribute(aMetal, 1))

        const material = createTankMaterial(baseMap, { tint })
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
    #addSideLabels(tank, bbox, center) {
        // 标签平面尺寸（世界单位）与离地高度
        const numberWidth = 6
        const numberHeight = 3
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
            name.mesh.position.set(
                tank.x + center.x,
                yBase + numberHeight + 0.35 + nameHeight / 2,
                tank.z + sideZ
            )
            name.mesh.rotation.y = facesNegativeZ ? Math.PI : 0
            name.mesh.renderOrder = 3

            number.setText(tank.numberText)
            name.setText(tank.processName)

            this.root.add(number.mesh, name.mesh)
            this.decorations.push(number, name)
        }
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
