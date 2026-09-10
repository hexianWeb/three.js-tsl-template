# GI Ablation Study

The demo renders one portal scene through four GI/surface-lighting strategies.
Portal emission, lantern flames, fireflies, camera, tone mapping, exposure, and
the black background belong to the shared presentation layer.

## Case matrix

| Case | Scene representation | Surface strategy | Runtime direct light | Emissive local lights |
| --- | --- | --- | --- | --- |
| A | baked | full-bake EXR | off | off |
| B | baked | indirect EXR | on | on |
| C | baked | indirect EXR | off | off |
| D | normal PBR | no lightmap | on | on |

The exact executable definitions live in
[`src/experiment/caseDefinitions.js`](src/experiment/caseDefinitions.js).

## Where responsibilities live

```text
src/
  main.js                         startup boundary only
  app/                            composition and global parameters
  experiment/                     case matrix and switching controller
  scene/                          asset loading and scene variants
  lighting/                       light rig, lightmaps and surface materials
  effects/                        effects shared by every case
    emissive/                     portal and lantern appearance/local lights
  debug/                          visual UV diagnostics
  rendering/                      WebGPU renderer and frame loop
  ui/                             Tweakpane controls
```

`Animate Sun` is off by default. Turning it on is a presentation demo rather
than a controlled ablation because the baked A/C cases cannot respond to time.

The baked and normal GLBs are separate technical representations of the same
source scene: the baked export contains lightmap UVs but no normals, while the
normal PBR export contains normals but no lightmap UVs. The `scene/` layer hides
that asset detail from the experiment controller.

## Commands

```bash
npm install
npm test
npm run build
npm run dev
```
