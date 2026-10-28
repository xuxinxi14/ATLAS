# 手机界面布局修订

2026-10-29：针对手机截图检查并调整主页、二维索引、三维档案、详情、阅读器和设置。手机竖屏的导航分两行；目录改为标题优先的双行条目，筛选和更多操作固定在面板内并允许滚动。短横屏改为分类与列表并排，避免列表被底栏压缩。

阅读器在窄屏隐藏不显示的载入标签，给返回、目录和更多操作保留空间；短横屏的更多菜单可滚动。三维详情使用独立可滚动内容区，长标题在放不下一行时换行，其他标题保留原滚动效果。支持 `overflow: clip` 的浏览器避免内部滚动或焦点把整个舞台带偏。

验证使用本地构建和 GitHub Pages 子路径的公开只读构建。`scripts/check-mobile-layout.mjs` 在 Edge / Chromium 与桌面 WebKit 下覆盖 320×568、393×720、430×932、844×390 和 568×320 等尺寸，检查导航、菜单、筛选、阅读器、设置和三维详情的可达性与边界；另检查横竖屏切换、Edge 下的 360° 查看器、本地编辑台、深色设置及完整测试套件。WebKit 为桌面模拟，不能代替真实 iPhone / Safari 的触摸、地址栏和性能验收。

示例：设置 `PLAYWRIGHT_MODULE` 为本机 Playwright 包路径，设置 `REVIEW_URL` 为运行中的页面，然后运行 `node scripts/check-mobile-layout.mjs`；设置 `REVIEW_ENGINE=webkit` 可检查桌面 WebKit，`REVIEW_CASES=small,phone` 可缩小测试范围。
