/**
 * 定义项目所需的静态资源列表。
 * Resources 类会根据 'type' 属性自动选择合适的加载器。
 */
export default [
  {
    name: 'positionGridTex',
    type: 'ktx2Texture',
    path: 'texture/position_grid.ktx2'
  },
  {
    name: 'renderedGridTex',
    type: 'ktx2Texture',
    path: 'texture/rendered_grid.ktx2'
  },
  {
    name: 'motionVectorGridTex',
    type: 'ktx2Texture',
    path: 'texture/motion_vector_grid.ktx2'
  },
  // Add more entries (texture, hdrTexture, video, cubeTexture, etc.) as needed
]