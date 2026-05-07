/**
 * 定义项目所需的静态资源列表。
 * Resources 类会根据 'type' 属性自动选择合适的加载器。
 */
export default [
  {
    name: 'craneModel',
    type: 'gltfModel',
    path: 'model/crane.glb'
  },
  {
    name: 'flybarModel',
    type: 'gltfModel',
    path: 'model/flybar.glb'
  },
  {
    name: 'tankBoxModel',
    type: 'gltfModel',
    path: 'model/box.glb'
  },
  {
    name: 'railwayModel',
    type: 'gltfModel',
    path: 'model/railway.glb'
  },
  {
    name: 'studioEnv',
    type: 'hdrTexture',
    path: 'hdri/studio.hdr'
  }
]