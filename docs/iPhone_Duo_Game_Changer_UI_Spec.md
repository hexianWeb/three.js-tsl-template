# iPhone Duo × Game Changer UI 设计总结

> 版本：v1.0
> 目标：将 iPhone Duo 的原生折叠手机体验，与 NDS / Nintendo 式双屏游戏体验统一到同一套产品叙事中。

---

## 1. 产品定位

核心不是“给 iPhone Duo 套一个游戏 UI”，而是：

> **它首先是一台完整的 iPhone Duo；只有在 Controller 插入并完成拼接后，设备才进入 Game Mode。**

产品体验分成两个完全不同但连续的 UI Universe：

- **Phone Mode**：原汁原味的 iPhone Duo / iOS-like 使用体验
- **Game Mode**：Nintendo 双屏信息架构 + Apple 设计语言

因此，Controller 不只是外接手柄，而是整个产品的软件形态切换器，也就是本项目的 **Game Changer**。

---

## 2. 核心体验逻辑

```text
iPhone Duo
    ↓
正常 Fold / Unfold
    ↓
完整 iPhone Home UI
    ↓
Controller 靠近
    ↓
滑轨插入 / 卡扣完成
    ↓
iOS Home Blur / Morph
    ↓
Game Home
    ↓
进入游戏
    ↓
NDS Top Screen + Bottom Screen
```

不需要额外设计一个“DUO READY / Attach Controller”中间操作系统。

在 Controller 未连接之前，设备就应该是一台正常的 iPhone Duo。

---

# 3. 四个核心状态

## 3.1 STATE 01 — iPHONE

### 目标

最大限度保留 iPhone Duo 原本的身份。

### 画面

展开状态下显示完整 iPhone 桌面：

- 时间 / 状态栏
- Widget
- App Grid
- Dock
- Wallpaper
- Photos / Weather / Maps 等 iOS 风格组件
- 保留折叠屏中央折痕和双屏结构

### Fold / Unfold

折叠与展开保持 iPhone Duo 原本的视觉逻辑：

- Progressive Blur
- Parallax
- Fold Shade
- Content Reveal
- 屏幕内容随 Fold Progress 发生位置和模糊变化

### 原则

用户第一眼应该感受到：

> “这是 iPhone Duo。”

而不是：

> “这是一台长得像 iPhone 的掌机。”

---

## 3.2 STATE 02 — ATTACH / GAME CHANGER

这是整个网页最重要的视觉事件。

### Trigger

Controller 沿滑轨进入手机下方，并完成机械连接。

### Transition

不要黑屏。

推荐直接延续 iPhone Duo 原本的 Blur Language：

```text
iOS Home

blur       0px  → 18px
scale      1.00 → 0.97
saturation 1.00 → 0.85
opacity    1.00 → 0.00

         ↓ UI Switch ↓

Game Home

blur       18px → 0px
scale      1.03 → 1.00
opacity    0.00 → 1.00
```

同时配合：

- Controller Slide In
- Magnetic Snap / Mechanical Click
- 轻微 Camera Push-in
- 屏幕 Surface Glow
- Spring Ease
- Controller Display Reveal

在 Controller 靠近和装配期间，`Bottom_Display_Plane` 完全不可见，用户透过中央镂空继续看到手机的 `Bottom_Screen_Plane`。只有 Lock 完成后的 Game Home 转场才激活 Controller 显示层。

### 叙事目的

Controller 不是单纯输入设备，而是在视觉上：

> **把 iPhone 的 UI Mode 改写成 Handheld Console OS。**

---

# 4. STATE 03 — GAME HOME

## 4.1 设计原则

这里采用：

> **Nintendo Information Architecture × Apple Design Language**

### Nintendo 提供

- 双屏分工
- 游戏入口
- 游戏 Library
- Recently Played
- Continue
- 上下屏联动
- 双屏游戏内容结构

### Apple 提供

- Typography
- Spacing
- Blur
- Glass
- Rounded Rectangle
- Spring Motion
- Large Artwork
- 极低 UI 噪声
- SF Symbols-like Iconography

最终目标不是：

> “Nintendo UI 换成白色”

而是：

> **“如果 Apple 设计一套 Nintendo DS System Menu，会是什么样？”**

---

# 5. 上大屏 UI

## 核心角色

上屏负责：

- Game Library
- Continue Playing
- Artwork
- 当前选中的游戏
- 最近游玩
- 主要 Navigation

## 推荐布局

```text
9:41                                  Status

Games

╭──────────────────────────────╮
│                              │
│        Game Artwork          │
│                              │
│      Pokémon Platinum        │
│      Continue                │
╰──────────────────────────────╯

          ○   ●   ○

Recently Played

Home        Library        Media
```

## 视觉原则

保留：

- 大 Artwork
- 大留白
- 大圆角
- 柔和材质
- Soft Shadow
- Background Blur
- 低饱和色
- 明亮背景

避免：

- DUO PLAY
- PLAY NOW
- READY FOR PLAY
- GAME MODE
- NEON
- HUD
- Cyberpunk
- 强 Cyan Glow
- 复杂 Game Dashboard

---

# 6. Controller 镂空与显示层 UI

## 核心认知

Controller 中央是镂空结构，其上方的可激活显示层对应 GLB 节点：

```text
Bottom_Display_Plane
```

装配期间隐藏该 Plane，镂空区域会暴露由 `Bottom_Screen_Plane` 表示的手机原生下屏。Controller Lock 完成后，`Bottom_Display_Plane` 通过 Blur、Scale 与 Crossfade 激活，转场完成后接管游戏模式下屏。

因此逻辑是：

```text
Phone Mode
├─ Top_Screen_Plane       → iPhone 上屏 UI
└─ Bottom_Screen_Plane    → iPhone 原生下屏 UI

Controller Attaching
├─ Top_Screen_Plane       → 延续 Phone UI / 转场内容
├─ Bottom_Screen_Plane    → 透过 Controller 镂空保持可见
└─ Bottom_Display_Plane   → 完全透明 / 不可见

Game Home / Playing
├─ Top_Screen_Plane       → Game Home 主界面 / NDS Top Screen
├─ Bottom_Display_Plane   → Game Home 辅助界面 / NDS Bottom Screen
└─ Bottom_Screen_Plane    → 隐藏、关闭或由结构遮挡
```

三块屏幕的 UV 均已确认覆盖完整 `0–1`。不同内容宽高比由运行时通过 fit、letterbox 或 crop 处理，不通过拉伸或改写 UV 来适配。

---

## GAME HOME 状态

Controller 显示层只承担非常少量的辅助操作。

推荐：

```text
┌──────────────────┐
│ Pokémon Platinum │
│                  │
│        ▶         │
│     Continue     │
│                  │
│ Library      ••• │
└──────────────────┘
```

或：

```text
┌──────────────────┐
│ Current Game     │
│ Pokémon Platinum │
│                  │
│   Continue       │
│                  │
│ ◫ Library    ⚙   │
└──────────────────┘
```

### 不推荐

不要长期使用：

```text
Home
Library
Audio
Settings
```

这种 2×2 控制面板。

它更像 Controller Settings，而不是 Nintendo 双屏系统。

---

# 7. STATE 04 — IN GAME

一旦游戏启动：

> **所有额外 System UI 消失。**

直接回归 NDS 原本的上下屏逻辑。

```text
Top_Screen_Plane
    ↓
NDS / DS Top Screen Content

Bottom_Display_Plane
    ↓
NDS / DS Touch Screen Content
```

此时：

- 上大屏：游戏 Top Screen
- Controller 独立下屏：游戏 Bottom Screen
- 手机原生下屏：隐藏、关闭或由 Controller 结构遮挡
- D-Pad：实体方向输入
- Face Buttons：实体 ABXY 输入

不再显示：

- Settings
- Library
- Home
- Controller Connected
- 游戏启动器

这样 NDS 感才足够纯粹。

---

# 8. Apple 风视觉规范

## Color

建议使用：

```css
--background: #F5F5F7;
--surface: rgba(255, 255, 255, 0.72);
--surface-secondary: rgba(245, 245, 247, 0.72);

--text-primary: #1D1D1F;
--text-secondary: #6E6E73;

--accent: #007AFF;
--separator: rgba(60, 60, 67, 0.18);
```

避免大面积纯黑 + 青色霓虹。

---

## Radius

```text
Large Card    28–36 px
Medium Card   20–24 px
Small Control 14–18 px
```

---

## Typography

优先表现：

- SF Pro Display 风格
- SF Pro Text 风格
- Inter 作为 Web 替代

推荐层级：

```text
Hero Title     32–40px
Section Title  20–24px
Body           15–17px
Caption        12–13px
```

---

## Glass

采用非常轻的 Glass Effect：

```css
backdrop-filter: blur(24px) saturate(140%);
background: rgba(255, 255, 255, 0.64);
border: 1px solid rgba(255, 255, 255, 0.45);
```

不要做 Cyber Glass / Neon Glass。

---

# 9. 动效语言

整个系统统一采用：

- Spring
- Blur
- Scale
- Crossfade
- Parallax
- Morph

尽量避免：

- Flash
- Glitch
- Scanline
- Neon Pulse
- HUD Sweep

---

# 10. iPhone Duo 开源项目结合建议

参考：

`https://github.com/jal-co/iphone-duo`

建议重点复用其已有的：

- Fold / Unfold Progress
- Screen Mapping
- Cover Screen
- Inner Screen
- Progressive Blur
- Fold Shade
- Parallax
- Reveal Layer

概念上可以继续沿用：

```text
screenSrc
coverSrc
screenOverlaySrc
coverOverlaySrc
revealSrc
```

Phone Mode 使用 iPhone Home UI。

Game Mode 则在 Controller Attach 完成后替换 / Crossfade 到 Game Home。

---

# 11. 推荐状态机

```js
const MODE = {
  PHONE: 'phone',
  ATTACHING: 'attaching',
  GAME_HOME: 'game-home',
  PLAYING: 'playing'
}
```

状态关系：

```text
PHONE
  ↓ attach controller

ATTACHING
  ↓ transition complete

GAME_HOME
  ↓ launch game

PLAYING
  ↓ quit game

GAME_HOME
  ↓ detach controller

PHONE
```

---

# 12. 页面演示 Storyboard

## Shot 01

iPhone Duo Folded。

显示 Cover Screen / iPhone UI。

---

## Shot 02

用户拖动或滚动。

iPhone Duo 开始 Unfold。

Blur + Parallax + Fold Shade。

---

## Shot 03

完全展开。

展示完整 iPhone Desktop。

---

## Shot 04

Controller 出现在画面下方。

手机仍然保持正常 iPhone 状态。

---

## Shot 05

Controller 沿滑轨进入。

机械结构完成拼接。

---

## Shot 06 — Game Changer Moment

iPhone Desktop：

```text
Blur
Scale Down
Fade
```

Game Home：

```text
Blur In
Scale Up
Spring
```

---

## Shot 07

进入 Game Home。

上屏：

```text
Games
Current Game
Recently Played
Library
```

Controller 独立下屏：

```text
Current Game
Continue
Library
```

---

## Shot 08

选择游戏。

大卡片进行 Apple 风 Hero Transition。

---

## Shot 09

Game UI Fade Out。

---

## Shot 10

进入 NDS：

```text
Top Screen    → Top_Screen_Plane
Bottom Screen → Bottom_Display_Plane
```

---

# 13. 项目最终体验定义

整个产品体验可以压缩成一句话：

> **It’s an iPhone. Until it isn’t.**

前半段：

> 高度还原 iPhone Duo。

Controller 插入：

> Game Changer。

后半段：

> Nintendo 双屏逻辑 + Apple UI Language。

---

# 14. 最终 UI 架构

```text
                    iPhone Duo
                        │
                ┌───────┴────────┐
                │                │
           PHONE MODE        GAME MODE
                │                │
         iPhone Home         Game Home
                │                │
         Fold / Unfold      Game Library
                │                │
          Blur Effect        Continue
                                 │
                              Launch
                                 │
                        ┌────────┴────────┐
                        │                 │
                   Top Screen       Bottom Screen
                        │                 │
                    NDS TOP           NDS TOUCH
                        │                 │
             Top_Screen_Plane   Bottom_Display_Plane

             Bottom_Screen_Plane：Game Mode 隐藏 / 关闭 / 被结构遮挡
```

---

# 15. 当前设计结论

本项目不应该被设计成：

> 一台具有 Apple 外壳的游戏机。

而应该被设计成：

> **一台真正的 iPhone Duo，在 Controller 插入之后，被重新定义成双屏游戏设备。**

因此 UI 设计优先级应为：

```text
iPhone Authenticity
        ↓
Physical Transformation
        ↓
Apple Motion Language
        ↓
Nintendo Information Architecture
        ↓
NDS Gameplay
```

这就是整个 iPhone Duo × Game Changer 项目的核心设计方向。
