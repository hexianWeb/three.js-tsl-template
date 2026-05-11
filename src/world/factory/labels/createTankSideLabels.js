import {
    createLabelPlane,
    drawTankNumber,
    drawVerticalTankName
} from './createLabelPlane.js'

/**
 * @param {{ id: number, x: number, z: number, numberText?: string, processName?: string }} tank
 * @param {import('three/webgpu').Box3} bbox
 * @param {import('three/webgpu').Vector3} center
 */
export function createTankSideLabels(tank, bbox, center) {
    const decorations = []

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

        decorations.push(number, name)
    }

    return decorations
}
