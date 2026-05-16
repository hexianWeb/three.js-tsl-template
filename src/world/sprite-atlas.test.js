import assert from 'node:assert/strict'
import test from 'node:test'

import { getAtlasCellFromFrame, getAtlasFrameFromNormalizedX } from './sprite-atlas.js'

test('maps normalized mouse x in [-0.9, 0.9] to atlas frames 0 through 34', () => {
    assert.equal(getAtlasFrameFromNormalizedX(-1), 0)
    assert.equal(getAtlasFrameFromNormalizedX(-0.9), 0)
    assert.equal(getAtlasFrameFromNormalizedX(0), 17)
    assert.equal(getAtlasFrameFromNormalizedX(0.9), 34)
    assert.equal(getAtlasFrameFromNormalizedX(1), 34)
})

test('maps frame order from top-left to bottom-right atlas cells', () => {
    assert.deepEqual(getAtlasCellFromFrame(0), {
        column: 0,
        rowFromTop: 0
    })

    assert.deepEqual(getAtlasCellFromFrame(34), {
        column: 4,
        rowFromTop: 6
    })
})
