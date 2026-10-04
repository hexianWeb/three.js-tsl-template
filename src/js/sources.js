import phoneHomeUrl from '../../docs/img/主页面.png?url'

// Spike 资源按需加载，不进入产品首屏的 Resources.load()。
export const ndsSources = {
  core: '/vendor/pilas-melonds/pilas-melonds-core.js',
  wasm: '/vendor/pilas-melonds/pilas-melonds-core.wasm',
  audioWorklet: '/vendor/pilas-melonds/audio-worklet.js',
  // 临时演示：开发模式默认载入本地马里奥赛车。生产构建仍为 null，不打包 ROM。
  testRom: import.meta.env.DEV
    ? '/nds/Mario%20Kart%20DS%20(USA)%20(En,Fr,De,Es,It).nds'
    : null,
}

export default [
  {
    name: 'iphoneModel',
    type: 'gltfModel',
    path: '/iphone.glb',
  },
  {
    name: 'rhyzomePlant',
    type: 'gltfModel',
    path: '/glb/rhyzome_plant.glb',
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
  {
    name: 'gameCardCover',
    type: 'texture',
    path: '/img/cover.png',
  },
  ...Array.from({ length: 6 }, (_, index) => ({
    name: `gameCover${index}`,
    type: 'texture',
    path: `/img/game${index}.png`,
  })),
]
