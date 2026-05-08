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
    path: 'model/flybar2.glb'
  },
  {
    name: 'tankBoxModel',
    type: 'gltfModel',
    path: 'model/box2.glb'
  },
  {
    name: 'railwayModel',
    type: 'gltfModel',
    path: 'model/railway.glb'
  },
  {
    name: 'wallColumnModel',
    type: 'gltfModel',
    path: 'model/wall.glb'
  },
  {
    name: 'studioEnv',
    type: 'hdrTexture',
    path: 'hdri/studio.hdr'
  }
]