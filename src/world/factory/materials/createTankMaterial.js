import { MeshStandardNodeMaterial } from 'three/webgpu'
import { texture, attribute, uniform, color, vec3, mix } from 'three/tsl'


/**
 * @param {import('three/webgpu').Texture | null} baseMap
 * @param {{ tint?: string | number, alarmBodyColor?: string | number }} [opts]
 */
export function createTankMaterial(baseMap, opts = {}) {
    const tint = uniform(color(opts.tint ?? '#e8fdff'))
    const alarmRgb = color(opts.alarmBodyColor ?? '#ff5533')
    const aTempAlarm = attribute('aTempAlarm', 'float')
    const mat = new MeshStandardNodeMaterial()

    if (baseMap) {
        const sampled = texture(baseMap)
        const baseCol = sampled.rgb.mul(tint)
        mat.colorNode = mix(baseCol, alarmRgb, aTempAlarm)
    } else {
        const baseCol = vec3(0.75, 0.75, 0.75).mul(tint)
        mat.colorNode = mix(baseCol, alarmRgb, aTempAlarm)
    }

    mat.roughnessNode = attribute('aRough', 'float')
    mat.metalnessNode = attribute('aMetal', 'float')
    mat.userData.tintColor = tint
    return mat
}
