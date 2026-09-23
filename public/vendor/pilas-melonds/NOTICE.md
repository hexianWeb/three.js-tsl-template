# pilas-melonds — pinned upstream artifacts

- Upstream: https://github.com/josepilas/pilas-melonds
- Commit: `7adc554ce1dc5318fef3797e8f00a6e9286dac3b`
- Author: José Pilas; emulator core: melonDS contributors.
- `pilas-melonds-core.js`, `pilas-melonds-core.wasm`, `audio-worklet.js`,
  and `LICENSE` are copied unchanged from this commit (worklet from `src/`).
- Upstream declares MPL-2.0; see the accompanying `LICENSE`.
- Our runtime adapts the DS direct-boot, framebuffer, input and audio calling
  conventions from upstream `src/app.js`. It does not embed the upstream UI.
- The upstream snapshot is a web distribution; the README's full C++ build tree
  is not present. Matching C++ source/build provenance remains to be resolved
  before treating this as a reproducible, publicly distributed emulator build.

These assets are loaded locally. No ROM, Nintendo BIOS or firmware is included
in this vendor directory.
