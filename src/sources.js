/**
 * 定义项目所需的静态资源列表。
 * Resources 类会根据 'type' 属性自动选择合适的加载器。
 */
export default [
  {
    name: 'positionGridTex',
    type: 'texture',
    path: 'texture/object/position_grid.webp'
  },
  {
    name: 'renderedGridTex',
    type: 'texture',
    path: 'texture/object/rendered_grid.webp'
  },
  {
    name: 'motionVectorGridTex',
    type: 'texture',
    path: 'texture/object/motion_vector_grid.webp'
  },
  // Camera set (PNG) for panel switching
  {
    name: 'positionGridTexCamera',
    type: 'texture',
    path: 'texture/camera/position_grid.png'
  },
  {
    name: 'renderedGridTexCamera',
    type: 'texture',
    path: 'texture/camera/rendered_grid.png'
  },
  {
    name: 'motionVectorGridTexCamera',
    type: 'texture',
    path: 'texture/camera/motion_vector_grid.png'
  },
  // Gameboy set (4×4 KTX2)
  {
    name: 'positionGridTexGameboy',
    type: 'ktx2Texture',
    path: 'texture/gameboy/gameboy_position-high.ktx2'
  },
  {
    name: 'renderedGridTexGameboy',
    type: 'ktx2Texture',
    path: 'texture/gameboy/gameboy_diffuse-high.ktx2'
  },
  {
    name: 'alphaGridTexGameboy',
    type: 'ktx2Texture',
    path: 'texture/gameboy/gameboy_alpha-high.ktx2'
  },
  {
    name: 'motionVectorGridTexGameboy',
    type: 'ktx2Texture',
    path: 'texture/gameboy/gameboy_mv-high.ktx2'
  },
  // Phone set (4×4 JPG)
  {
    name: 'renderedGridTexPhone',
    type: 'texture',
    path: 'texture/phone/rendered_grid.jpg'
  },
  {
    name: 'motionVectorGridTexPhone',
    type: 'texture',
    path: 'texture/phone/motion_vector_grid.jpg'
  }
]