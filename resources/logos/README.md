# Teniulink Node Logo

## 设计方案

**方案6: 翠绿链 (Green Chain)**

- 使用 `TU` 作为 teniulink 的缩写
- 翠绿到青色渐变 (#10B981 → #06B6D4)
- 区块链节点连接线装饰，体现 Web3/科技风格
- 发光效果增强科技感
- 深黑背景 (#000000) 配渐变文字，高对比度

## 文件说明

| 文件 | 用途 |
|------|------|
| `teniulink-icon.svg` | 应用图标 (512x512) 深色背景 |
| `teniulink-icon-light.svg` | 应用图标 (512x512) 浅色背景 |
| `teniulink-logo-dark.svg` | 横排 Logo 深色背景 |
| `teniulink-logo-light.svg` | 横排 Logo 浅色背景 |

## 使用场景

- **应用图标**: 使用 `teniulink-icon.svg` (深色) 或 `teniulink-icon-light.svg` (浅色)
- **网站/文档**: 使用 `teniulink-logo-light.svg` 或 `teniulink-logo-dark.svg`
- **关于页面**: 可根据主题自动切换深/浅色版本

## 颜色规范

| 元素 | 深色模式 | 浅色模式 |
|------|---------|---------|
| 背景 | #18181B | #FFFFFF |
| `teni` | #A1A1AA | #71717A |
| `link` | #FFFFFF | #18181B |

## 字体

使用 Inter 字体，与项目 UI 保持一致。

- Inter Light (font-weight: 300) - "teni"
- Inter Bold (font-weight: 700) - "link"

## 转换为 PNG

SVG 是矢量格式，可直接在网页中使用。如需 PNG 格式，可使用在线工具：
- https://svgtopng.com/
- https://cloudconvert.com/svg-to-png

或使用命令行工具：
```bash
# 安装 rsvg-convert
brew install librsvg

# 转换为 PNG
rsvg-convert -w 512 -h 512 teniulink-icon.svg -o teniulink-icon.png
```
