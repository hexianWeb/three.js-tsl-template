# Source and reuse status

Source: https://github.com/ektogamat/webgpu-mesh-transmission-material

Author: Anderson Mancini (ektogamat)

Pinned commit: `847a68c2e5ba51d005a3df8b8f4f82f1cad47e4b`

Retrieved: 2026-09-24

`transmissionNodes.js` and `TransmissionPhysicalLightingModel.js` are unchanged upstream files. Their formatting is deliberately preserved for comparison. The adjacent `GlassPhysicalNodeMaterial.js` adapts the material class and uniform wiring from upstream `GlassMaterial.jsx`; `Core/TransmissionBackdrop.js` adapts the clean/backside capture approach from upstream `transmissionBackdrop.js` into this project's explicit lifecycle, with renderer-state restoration and attached-foreground exclusions.

The upstream tree at this commit has no LICENSE file. Its README asks users to contact the author before commercial redistribution when no license is present. This local integration does not establish a redistribution license; obtain terms from the author before redistribution. No React, R3F, demo models, demo textures, global settings store, or demo UI are included.
