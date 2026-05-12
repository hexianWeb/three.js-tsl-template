import { MeshStandardNodeMaterial } from 'three/webgpu'
import { Fn, floor, mix, mod, positionWorld, vec2, vec3 } from 'three/tsl'

export const GROUND_CELL_SIZE = 12
export const GROUND_PATTERN_SIZE = GROUND_CELL_SIZE * 2

const GROUND_DARK_COLOR = vec3(0.055, 0.06, 0.062)
const GROUND_GRAY_COLOR = vec3(0.135, 0.145, 0.148)

export function createFactoryGroundMaterial() {
    const material = new MeshStandardNodeMaterial()

    material.colorNode = Fn(() => {
        const worldXZ = vec2(positionWorld.x, positionWorld.z)
        const cell = floor(worldXZ.div(GROUND_CELL_SIZE))
        const checkerMask = mod(cell.x.add(cell.y), 2)
        return mix(GROUND_DARK_COLOR, GROUND_GRAY_COLOR, checkerMask)
    })()

    material.roughness = 0.92
    material.metalness = 0.06
    return material
}
