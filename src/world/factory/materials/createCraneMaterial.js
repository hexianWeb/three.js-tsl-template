import { MeshStandardNodeMaterial } from 'three/webgpu'
import { texture, uniform, color, vec3, mix } from 'three/tsl'

/**
 * @param {import('three/webgpu').Texture | null} baseMap
 * @param {{ tintStrength?: number, modeColor?: string,
 *           metalness?: number, roughness?: number }} [opts]
 */
export function createCraneMaterial(baseMap, opts = {}) {
    const mat = new MeshStandardNodeMaterial()
    const modeColor = uniform(color(opts.modeColor ?? '#22c55e'))
    const tintStrength = uniform(opts.tintStrength ?? 0.5)
    const tintMul = mix(vec3(1, 1, 1), modeColor, tintStrength)

    if (baseMap) {
        const sampled = texture(baseMap)
        mat.colorNode = sampled.rgb.mul(tintMul)
    } else {
        mat.colorNode = vec3(0.7, 0.7, 0.7).mul(tintMul)
    }

    mat.metalness = opts.metalness ?? 0.3
    mat.roughness = opts.roughness ?? 0.7
    mat.userData = { modeColor, tintStrength }
    return mat
}
