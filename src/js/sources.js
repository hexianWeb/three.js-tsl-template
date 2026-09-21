import phoneHomeUrl from '../../docs/img/主页面.png?url'
import gameHomeUrl from '../../docs/img/游戏模式主页面.png?url'

export default [
  {
    name: 'iphoneModel',
    type: 'gltfModel',
    path: '/iphone.glb',
  },
  {
    name: 'controllerShellLightmap',
    type: 'exrTexture',
    path: '/lightmaps/Controller_Shell_lightmap.exr',
  },
  {
    name: 'phoneHomeTexture',
    type: 'texture',
    path: phoneHomeUrl,
  },
  {
    name: 'gameHomeTexture',
    type: 'texture',
    path: gameHomeUrl,
  },
]
