import { MeshStandardNodeMaterial } from 'three/webgpu'
import { texture, attribute, uniform, color, vec3 } from 'three/tsl'


/**
 * @param {import('three/webgpu').Texture | null} baseMap
 * @param {{ tint?: string | number }} [opts]
 */
export function createTankMaterial(baseMap, opts = {}) {
    const tint = uniform(color(opts.tint ?? '#e8fdff'))
    const mat = new MeshStandardNodeMaterial()

    if (baseMap) {
        const sampled = texture(baseMap)
        mat.colorNode = sampled.rgb.mul(tint)
    } else {
        mat.colorNode = vec3(0.75, 0.75, 0.75).mul(tint)
    }

    mat.roughnessNode = attribute('aRough', 'float')
    mat.metalnessNode = attribute('aMetal', 'float')
    mat.userData.tintColor = tint
    return mat
}
