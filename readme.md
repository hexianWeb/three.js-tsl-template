# GI Ablation Study

The demo renders one portal scene through six GI/surface-lighting strategies.
Portal emission, lantern flames, fireflies, camera, tone mapping, exposure, and
the black background belong to the shared presentation layer.

## Case matrix

| Case | Scene representation | Surface strategy | Runtime direct light | Emissive local lights |
| --- | --- | --- | --- | --- |
| A | baked | full-bake EXR | off | off |
| B | baked | indirect EXR | on | on |
| C | baked | indirect EXR | off | off |
| D | unbaked PBR | no lightmap | on | on |
| E | unbaked PBR | realtime LightProbeGrid | on | on |
| F (default) | unbaked PBR | LightProbeGrid + SSGI | on | on |

Case F adds Three.js SSGINode with spatial, depth/normal-aware denoising.
Toggle `Enable SSGI` for an immediate comparison with probe lighting alone.
The SSGI folder exposes bounce intensity, AO strength, world-space radius,
surface thickness, and combined / indirect-only / occlusion views.
The composition is `beauty * AO + SSGI * albedo` in linear space before tone mapping.
This is an artistic hybrid, not an energy-conserving replacement of probe GI:
the screen-space input already contains probe lighting, so high SSGI strengths
can over-brighten it. Offscreen geometry cannot contribute to SSGI; probes retain
their last baked lighting until `Rebake Probes` is pressed. Spatial filtering
avoids temporal ghosting but can retain noise and adds GPU cost in Case F.

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

Case E auto-fits a 9 x 5 x 9 probe grid to the unbaked scene, then performs one
GPU-resident bake at startup. The helper is hidden by default; the GUI exposes
`Show Probes`, `GI Intensity`, a 0-3 `Bounces` control, and `Rebake Probes`.
Changing the bounce count is intentionally deferred until rebaking; the debug
status reports both the configured value and the value used by the last bake.

`Animate Sun` is off by default. Turning it on is a presentation demo rather
than a controlled ablation because the baked A/C cases cannot respond to time.

The baked and unbaked GLBs are separate technical representations of the same
source scene: the baked export contains lightmap UVs but no normals, while the
unbaked PBR export contains normals but no lightmap UVs. The logical `unbaked`
variant currently loads `portal_none_bake.glb`; the `scene/` layer hides that
asset detail from the experiment controller.

## Commands

```bash
npm install
npm test
npm run build
npm run dev
```
