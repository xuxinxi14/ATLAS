# 开源许可、上游署名与第三方素材清单（ATTRIBUTION）

本项目 **ATLAS（Personal Knowledge Terminal，个人知识档案终端）** 派生自开源项目 **[LBEILC/RhineLabUI](https://github.com/LBEILC/RhineLabUI)**（基线提交：`12cc5e4`）。

根据上游项目的开源许可与《ATLAS 个人知识库开发规划书》要求，本文档记录上游授权、依赖项许可证以及第三方素材合规与替换清单。

---

## 1. 上游开源授权与署名

- **上游项目**：[LBEILC/RhineLabUI](https://github.com/LBEILC/RhineLabUI)
- **版权所有**：`Copyright (c) 2026 LBEILC`
- **许可证**：[MIT License](../LICENSE)
- **上游授权范围**：
  - 程序代码（TypeScript、三维场景与动画控制、UI 过渡、构建与测试脚本）
  - Blender 建模脚本与源工程（`art/`）
  - 运行时 3D 模型资产（`public/assets/archive-cassette.glb`、`public/assets/archive-assembly.glb`）
  - 程序生成的原创三轨背景配乐（`public/audio/atmosphere.ogg`、`motif.ogg`、`pulse.ogg`）与合成玻璃/电子交互音效

本项目保留完整的原始 [LICENSE](../LICENSE) 文件与 Git 提交历史，并在 README 及设置页「关于/署名说明」中显著标注上游来源 **LBEILC / RhineLabUI**。

---

## 2. NPM 依赖与许可证核查（M0 基线）

| 包名 | 版本 | 许可证 | 用途 |
| --- | --- | --- | --- |
| `three` | `^0.183.0` | MIT | WebGL 三维场景、档案盒渲染与后处理 |
| `@kitlangton/rolling-number` | `0.4.1` | MIT | 编号与标题滚动动效（含 `public/licenses/rolling-number.txt`） |
| `vite` | `^7.3.1` | MIT | 前端开发服务器与静态打包工具 |
| `typescript` | `^5.9.3` | Apache-2.0 | 类型检查与编译 |
| `@types/three` | `^0.183.0` | MIT | Three.js 类型定义 |
| `prettier` | `^3.9.6` | MIT | 代码格式化 |

---

## 3. 第三方素材与商标/版权风险排查清单

上游仓库中包含部分非 MIT 授权或具有特定使用限制的资源，ATLAS 在演进与公开发布（M0 → M4）中按以下策略处理：

| 资源类别 | 路径 / 位置 | 权利与许可状态 | ATLAS 处置策略 |
| --- | --- | --- | --- |
| **游戏原作名称、标志与设定文案** | `src/brand.ts`、`src/main.ts`、`content/archives.json` | 《明日方舟》及「莱茵生命（Rhine Lab）」相关名称、徽标与设定归鹰角网络（Hypergryph）所有，不在上游 MIT 授权范围内 | **必改（M0/M4）**：产品品牌统一为 **ATLAS · Personal Knowledge Terminal**；不将受保护的游戏标志当作原创品牌发布；演示用 40 份游戏设定档案在 M1/M4 替换为个人真实知识条目 |
| **原片打字采样短音（3×38ms）** | `src/typing-samples.ts`、`public/audio/README.md` | 采样自原 PV 片段，不在原创配乐 MIT 授权范围内 | **可替换/可选关闭**：保留来源说明，或在公开版本中提供纯 Web Audio 程序合成键音替代 |
| **MiSans Webfont 分包** | `public/fonts/misans/`、`public/fonts/MiSans-license.pdf` | 小米 MiSans 字体许可（免费商用，需保留版权声明与许可文件） | **保留并合规署名**：保留 `public/fonts/MiSans-license.pdf` 及字体目录许可说明 |
| **Novecento Sans Wide 商业字体** | `scripts/prepare-webfonts.mjs` | 上游作者个人购买的 MyFonts 网页字体许可，未包含在 Git 仓库中 | **不使用**：非原作者官方域名构建时自动跳过下载，回退至内置几何矢量图形（`__RHINE_NOVECENTO__ = false`），无侵权风险 |
| **3D 档案盒模型（GLB）** | `public/assets/archive-cassette.glb`、`archive-assembly.glb` | 上游作者通过 Blender 重建并明确纳入 MIT 授权；但标签纹理会动态绘制 `labelMarkSvg` | **保留模型，替换动态标签纹理**：复用 MIT 授权的 `.glb` 几何模型，将动态贴图标识改为 ATLAS 终端标识 |
