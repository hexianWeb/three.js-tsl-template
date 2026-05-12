import { MeshStandardNodeMaterial } from 'three/webgpu'
import { Fn, color, floor, length, mix, mod, positionWorld, smoothstep, uniform, vec2, vec3 } from 'three/tsl'

export const GROUND_CELL_SIZE = 12
export const GROUND_PATTERN_SIZE = GROUND_CELL_SIZE * 2
export const GROUND_FADE_START = 260
export const GROUND_FADE_END = 500
export const GROUND_DARK_COLOR = '#202324'
export const GROUND_GRAY_COLOR = '#4a4f50'

const GROUND_BACKGROUND_BLEND_COLOR = vec3(0.027, 0.032, 0.037)

export function createFactoryGroundMaterial({ fadeCenterX = 0, fadeCenterZ = 0 } = {}) {
    const material = new MeshStandardNodeMaterial()
    const darkColor = uniform(color(GROUND_DARK_COLOR))
    const grayColor = uniform(color(GROUND_GRAY_COLOR))

    material.colorNode = Fn(() => {
        const worldXZ = vec2(positionWorld.x, positionWorld.z)
        const cell = floor(worldXZ.div(GROUND_CELL_SIZE))
        const checkerMask = mod(cell.x.add(cell.y), 2)
        const checkerColor = mix(darkColor, grayColor, checkerMask)

        const fadeDistance = length(worldXZ.sub(vec2(fadeCenterX, fadeCenterZ)))
        const fadeMask = smoothstep(GROUND_FADE_START, GROUND_FADE_END, fadeDistance)
        return mix(checkerColor, GROUND_BACKGROUND_BLEND_COLOR, fadeMask)
    })()

    material.roughness = 0.92
    material.metalness = 0.06
    material.userData.groundDarkColor = darkColor
    material.userData.groundGrayColor = grayColor
    return material
}
