import phoneHomeUrl from '../../docs/img/主页面.png?url'

// Spike 资源按需加载，不进入产品首屏的 Resources.load()。
export const ndsSources = {
  core: '/vendor/pilas-melonds/pilas-melonds-core.js',
  wasm: '/vendor/pilas-melonds/pilas-melonds-core.wasm',
  audioWorklet: '/vendor/pilas-melonds/audio-worklet.js',
  testRom: import.meta.env.DEV
    ? '/nds/Pokemon%20-%20Platinum%20Version%20(USA)%20(Rev%201).nds'
    : null,
}

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
    name: 'stagePlasticColor',
    type: 'texture',
    path: '/texture/Plastic010_1K-JPG_Color.jpg',
  },
  {
    name: 'stagePlasticNormal',
    type: 'texture',
    path: '/texture/Plastic010_1K-JPG_NormalGL.jpg',
  },
  {
    name: 'stagePlasticRoughness',
    type: 'texture',
    path: '/texture/Plastic010_1K-JPG_Roughness.jpg',
  },
  {
    name: 'phoneHomeTexture',
    type: 'texture',
    path: phoneHomeUrl,
  },
  {
    name: 'gameHomeReference',
    type: 'texture',
    path: '/12.png',
  },
  ...Array.from({ length: 6 }, (_, index) => ({
    name: `gameCover${index}`,
    type: 'texture',
    path: `/img/game${index}.png`,
  })),
]
