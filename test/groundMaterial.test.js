import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { MeshStandardNodeMaterial } from 'three/webgpu'

const __dirname = dirname(fileURLToPath(import.meta.url))
const materialModulePath = resolve(__dirname, '../src/world/groundMaterial.js')

test('factory ground material exposes only the checker settings', async () => {
    assert.equal(existsSync(materialModulePath), true, 'groundMaterial.js should exist')

    const module = await import('../src/world/groundMaterial.js')
    const { GROUND_CELL_SIZE, GROUND_PATTERN_SIZE, createFactoryGroundMaterial } = module

    assert.equal(GROUND_CELL_SIZE, 8)
    assert.equal(GROUND_PATTERN_SIZE, 16)
    assert.equal(Object.hasOwn(module, 'GROUND_DOT_RADIUS'), false)
    assert.equal(Object.hasOwn(module, 'GROUND_DOT_EDGE_SOFTNESS'), false)

    const material = createFactoryGroundMaterial()
    assert.equal(material instanceof MeshStandardNodeMaterial, true)
    assert.equal(material.colorNode !== undefined, true)
    assert.equal(material.roughness, 0.92)
    assert.equal(material.metalness, 0.06)
})
