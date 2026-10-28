# GitHub Pages 发布与更新

公开网站：[xuxinxi14.github.io/ATLAS](https://xuxinxi14.github.io/ATLAS/)。源码仓库：[xuxinxi14/ATLAS](https://github.com/xuxinxi14/ATLAS)。

## 日常更新

1. 使用本地 WebUI、Obsidian 或其他编辑器修改 `content/` 中的笔记并保存。
2. 双击项目根目录的 `更新网站.cmd`，等待窗口显示结果；按任意键关闭窗口。
3. 脚本校验笔记、提交相关改动并推送到 GitHub。GitHub Actions 根据当前笔记重新生成索引和静态网站，再部署到 Pages。部署状态可在 [Actions 工作流](https://github.com/xuxinxi14/ATLAS/actions/workflows/deploy.yml) 查看。

运行环境需要 Git、Node.js 22.12 或更新版本，以及有效的 GitHub 认证。本机已经登录 GitHub CLI 时，脚本使用该登录并等待部署结束；否则使用 Git 已配置的认证方式推送，并提供 Actions 状态地址。脚本不保存访问令牌。

脚本同步 `content/`（不包括 `.obsidian/` 的本机配置）、`src/generated/`、`public/archives/`、`public/search-index.json` 和 `public/media/`；不会把其他未暂存的工作文件混入笔记提交。已有暂存内容、当前不在 `main` 分支、远程包含本机没有的提交或内容校验失败时，脚本会停止并提示，避免覆盖或混入其他改动。推送失败时，本地文件和已经创建的提交保留，处理问题后可再次双击脚本。

## 公开版本与内容

GitHub Actions 构建时启用 `ATLAS_PUBLIC=1`，隐藏新建、编辑和 STUDIO 入口，直接访问编辑地址也会返回二维索引。本地开发仍可编辑。网站为静态站点，不提供在线写入服务；更改笔记后需要重新运行更新脚本。

仓库是公开的，提交的源文件、附件、历史记录，以及 `content/inbox/` 里的草稿都能被任何人访问。只读界面不是隐私保护。使用缓存的访客可能需要通过页面中的更新入口加载新版本。
