import assert from 'node:assert/strict'
import test from 'node:test'

import { getAtlasFrameFromNormalizedX, getAtlasUvTransform } from './sprite-atlas.js'

test('maps normalized mouse x in [-0.9, 0.9] to atlas frames 0 through 34', () => {
    assert.equal(getAtlasFrameFromNormalizedX(-1), 0)
    assert.equal(getAtlasFrameFromNormalizedX(-0.9), 0)
    assert.equal(getAtlasFrameFromNormalizedX(0), 17)
    assert.equal(getAtlasFrameFromNormalizedX(0.9), 34)
    assert.equal(getAtlasFrameFromNormalizedX(1), 34)
})

test('maps top-left to bottom-right frame order into bottom-left UV coordinates', () => {
    assert.deepEqual(getAtlasUvTransform(0), {
        repeatX: 1 / 5,
        repeatY: 1 / 7,
        offsetX: 0,
        offsetY: 6 / 7
    })

    assert.deepEqual(getAtlasUvTransform(34), {
        repeatX: 1 / 5,
        repeatY: 1 / 7,
        offsetX: 4 / 5,
        offsetY: 0
    })
})
