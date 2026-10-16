# 视频导出与压制常用 H.264 / AAC 参数速查

## 快速复习

日常使用 FFmpeg 或剪辑软件导出课程录像、演示动图与 B 站投稿视频时，直接复制以下经过验证的黄金参数，无需每次重新查文档：

```bash
# 1. 标准 1080p 高画质高兼容压缩（CRF 18-20 视觉无损，适合归档与网页播放）
ffmpeg -i input.mov -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart output.mp4

# 2. 截取指定时间段（无损极速切分，不重新编码）
ffmpeg -ss 00:01:10 -to 00:02:30 -i input.mp4 -c copy clip.mp4
```

## 关键参数备忘

- `-pix_fmt yuv420p`：**必加**，确保导出的 MP4 在 Windows 自带播放器、Safari 和手机浏览器中均能正常硬解，不会黑屏。
- `-movflags +faststart`：将 `moov atom` 元数据移至文件头部，放在网页上时无需等整个视频下载完即可边下边播。
