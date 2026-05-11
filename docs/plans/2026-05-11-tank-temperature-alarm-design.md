# 电镀槽温度超限显示设计

日期：2026-05-11

## 目标与假设

- 目标：当 mockdata 中某个电镀槽 `currentTemperature` 高于 `temperatureLimit` 时，该槽出现可辨识的视觉反馈。
- 假设：温度字段先进入本地 mock/state，未来短轮询接口也合并到同一 `FactoryState.tanks` 结构。
- 约束：槽体主体仍保持单个 `InstancedMesh`；不使用传统 outline；不引入独立全局告警面板。

## 方案：轻量混合告警

- **槽体**：几何增加 `aTempAlarm` instanced attribute（`0..1`）。TSL 将基础颜色与红橙告警色按 `aTempAlarm` 混合；`aTempAlarm` 在 CPU 侧按呼吸曲线更新（避免材质内时间依赖）。
- **槽液**：每槽保留对共享 `calmMaterial` / `boilingMaterial` 的引用；超限时切换为克隆材质（橙红、略提高不透明度），恢复时销毁克隆。
- **标签**：CanvasTexture 小标签显示 `当前/上限°C`；超限时红橙底，正常时低调白底。

## 数据流

`FactoryState.tanks` → `TankField.update(dt)` → `aTempAlarm` 属性 / 槽液材质 / 温度标签。

## 组件职责

- `config.js`：可选告警视觉常量（颜色、呼吸速度）。
- `FactoryState.js`：槽对象增加 `temperatureC`、`temperatureLimitC`（上限可为 `null` 表示未配置）；mock 若干正常/超限/临界槽。
- `TankField.js`：持有 `state.tanks` 引用、液面 mesh 列表、温度标签；`update` 中同步告警。
- `createTankMaterial.js`：`attribute('aTempAlarm')` 参与 `colorNode` 混合。
- `createLabelPlane.js`：`drawTankTemperature` 绘制温度条。

## 更新策略

- 使用 `Factory.update` 已有 `tankField.update(dt)`。
- 超限：`aTempAlarm[i] = 0.45 + 0.55 * sin(t)`；否则 `0`。
- 槽液与标签仅在告警状态或标签文案变化时更新；`aTempAlarm` 每帧写入（最多 49 float）。
- 缺失温度：不告警、标签可省略或显示占位；缺失上限：不判定超限，标签仅显示当前值。

## 验证

- mock：至少 2 个正常槽、2 个超限槽、1 个等于上限（不超限）。
- 远景：超限槽体有呼吸感；正常无。
- 近景：槽液与标签与状态一致；仅 `>` 为超限。
