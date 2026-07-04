# CodeAtlas 品牌资源

## 资源文件

| 资源 | 路径 | 用途 |
|---|---|---|
| 字标 | `web/public/brand/codeatlas-wordmark.svg` | README 顶部、系统顶部品牌区、宣传图 |
| Logo | `web/public/brand/codeatlas-logo.svg` | favicon、系统图标、紧凑空间 |
| React 组件 | `web/src/components/BrandMark.tsx` | 系统内复用品牌展示 |

## 视觉规则

- 主背景使用深海军蓝：`#070A33` / `#090D46`。
- 主笔画使用冷白：`#FFFFFF` / `#F4F2FF` / `#D7DDFF`。
- 点线图谱强调色使用青色和紫色：`#5EEAD4` / `#8B5CF6`。
- 字标是纯 SVG 几何笔画，不依赖字体文件。
- 在浅色页面使用时，建议保留字标 SVG 内置深色底，不要直接裁切成透明文字。

## 系统使用

顶部品牌区使用：

```tsx
import { BrandMark } from '@/components/BrandMark';

<BrandMark />
```

紧凑场景只显示 logo：

```tsx
<BrandMark compact />
```

## README 使用

```html
<p align="center">
  <img src="./web/public/brand/codeatlas-wordmark.svg" alt="CODEATLAS" width="520" />
</p>

<p align="center">
  <img src="./web/public/brand/codeatlas-logo.svg" alt="CodeAtlas logo" width="112" />
</p>
```

## 当前命名状态

产品展示名已统一为 `CodeAtlas`。npm 包名和 CLI 仍是 `project-fast-onboarding` / `pfo`，后续如要完全统一，需要迁移 package name、bin name、README 安装命令、CI 发布配置和历史兼容入口。
