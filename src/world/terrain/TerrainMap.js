export default class TerrainMap {
  constructor({
    heightField,
    biomeCells,
    surfaceCells,
    originX = 0,
    originZ = 0,
    sampleOriginX = originX,
    sampleOriginZ = originZ,
    halo = 0,
    visible = null
  }) {
    this.heightField = heightField
    this.biomeCells = biomeCells
    this.surfaceCells = surfaceCells
    this.originX = originX
    this.originZ = originZ
    this.sampleOriginX = sampleOriginX
    this.sampleOriginZ = sampleOriginZ
    this.halo = halo
    this.visible = visible ?? {
      x: halo,
      z: halo,
      width: heightField.width - halo * 2,
      depth: heightField.depth - halo * 2
    }
    this.width = this.visible.width
    this.depth = this.visible.depth
    this.sampleWidth = heightField.width
    this.sampleDepth = heightField.depth
  }

  getHeight(x, z) {
    const sample = this.toSampleCell(x, z)
    return this.heightField.get(sample.x, sample.z)
  }

  getBiomeCell(x, z) {
    const sample = this.toSampleCell(x, z)
    return this.biomeCells[sample.z]?.[sample.x]
  }

  getSurfaceCell(x, z) {
    const sample = this.toSampleCell(x, z)
    return this.surfaceCells[sample.z]?.[sample.x]
  }

  toSampleCell(x, z) {
    return {
      x: this.visible.x + x,
      z: this.visible.z + z
    }
  }

  hasCell(x, z) {
    const sample = this.toSampleCell(x, z)
    return sample.x >= 0 &&
      sample.z >= 0 &&
      sample.x < this.sampleWidth &&
      sample.z < this.sampleDepth
  }

  toWorldBlock(x, z) {
    return {
      x: this.originX + x,
      z: this.originZ + z
    }
  }
}
