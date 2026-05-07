import { MeshStandardNodeMaterial } from 'three/webgpu'
import { texture, attribute } from 'three/tsl'

/**
 * @param {import('three/webgpu').Texture | null} baseMap
 */
export function createTankMaterial(baseMap) {
    const mat = new MeshStandardNodeMaterial()
    if (baseMap) {
        mat.colorNode = texture(baseMap)
    }
    mat.roughnessNode = attribute('aRough', 'float')
    mat.metalnessNode = attribute('aMetal', 'float')
    return mat
}
