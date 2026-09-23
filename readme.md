# iPhone Duo · WebGPU

基于 Three.js WebGPU 的 iPhone Duo 双屏掌机交互原型。

当前阶段已经建立 `Experience` 单例与 Class 组件架构，并通过统一资源系统加载 `public/iphone.glb`。模型节点、基础变换和线框模式可在 Tweakpane 中检查。

无需构建处理的公共资源请放在 `public/` 目录中。

## 开发

``` bash
npm install
npm run dev
npm run build
```

请使用支持 WebGPU 的最新版浏览器访问开发地址。

## NDS 最小接入验证

运行 `npm run dev`，打开开发地址下的 **`/nds-test.html`**。

1. 点击「载入 public/nds 测试游戏」，读取本地提供的《Pokemon Platinum》ROM；也可使用文件选择器载入 `.nds`。
2. 点击「启用声音」，再点击下屏进行游戏操作。
3. 方向键移动；`X / Z` 对应 A / B；`S / A` 对应 X / Y；`Q / W` 对应 L / R；`Enter` 为 Start；`Shift` 为 Select；`Escape` 暂停 / 继续。
4. 下屏支持点击和拖动；切换窗口自动暂停，点击「继续」恢复。

验证页显示模拟帧率、速度、核心单帧耗时和 WASM 已分配内存。当前是独立双屏 Canvas 验证，尚未绑定 3D 屏幕，也不持久保存游戏存档。

`public/nds/` 仅用于本地验证，已从 Git 和生产构建中排除；`npm run preview` 下可通过文件选择器测试。模拟器文件固定到上游 commit，并从本地 `public/vendor/pilas-melonds/` 加载。

可选的真实 WASM / ROM 核心检查（不替代浏览器实测）：

```bash
node scripts/verify-nds.mjs "public/nds/Pokemon - Platinum Version (USA) (Rev 1).nds"
```

接入边界与验证记录见 [NDS 最小验证记录](docs/NDS_Integration_Spike.md)。
