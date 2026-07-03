---
version: alpha
name: Project Fast Onboarding Workbench
description: "项目快速接管工作台的设计系统。用于生成简洁、扁平、克制的本地代码项目理解工作台界面。"
colors:
  primary: "#2563EB"
  primary-foreground: "#FFFFFF"
  primary-soft: "#EFF6FF"
  primary-muted: "#DBEAFE"
  primary-border: "#BFDBFE"
  secondary: "#475569"
  secondary-soft: "#F1F5F9"
  tertiary: "#7C3AED"
  tertiary-soft: "#F5F3FF"
  neutral: "#F8FAFC"
  surface: "#FFFFFF"
  surface-subtle: "#F9FAFB"
  surface-muted: "#F3F4F6"
  border: "#E5E7EB"
  border-strong: "#CBD5E1"
  text-primary: "#0F172A"
  text-secondary: "#475569"
  text-muted: "#64748B"
  text-subtle: "#94A3B8"
  success: "#16A34A"
  success-soft: "#DCFCE7"
  success-border: "#BBF7D0"
  warning: "#F59E0B"
  warning-soft: "#FEF3C7"
  warning-border: "#FDE68A"
  danger: "#EF4444"
  danger-soft: "#FEE2E2"
  danger-border: "#FECACA"
  info: "#0EA5E9"
  info-soft: "#E0F2FE"
  code-bg: "#0F172A"
  code-text: "#E2E8F0"
  code-selection: "#DBEAFE"
typography:
  headline-xl:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.28
    letterSpacing: -0.015em
  headline-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 20px
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: -0.01em
  title-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 16px
    fontWeight: 650
    lineHeight: 1.45
  body-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.35
  label-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.25
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
  mono-sm:
    fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.6
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xxs: 4px
  xs: 6px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 40px
  5xl: 48px
  sidebar-width: 220px
  header-height: 64px
  page-padding: 24px
  card-padding: 20px
  section-gap: 16px
components:
  app-shell:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
  sidebar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    width: "{spacing.sidebar-width}"
    padding: 12px
  sidebar-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  sidebar-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  topbar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    height: "{spacing.header-height}"
    padding: 16px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  card-muted:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 40px
  button-primary-hover:
    backgroundColor: "#1D4ED8"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 40px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 40px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 10px
    height: 36px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 40px
  badge-fact:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px
  badge-guess:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px
  badge-unknown:
    backgroundColor: "{colors.secondary-soft}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px
  badge-risk-high:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px
  badge-risk-medium:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px
  badge-risk-low:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px
  code-panel:
    backgroundColor: "{colors.code-bg}"
    textColor: "{colors.code-text}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.md}"
    padding: 16px
---

# Project Fast Onboarding Workbench DESIGN.md

## Overview

项目快速接管工作台是一个面向开发者和技术负责人的本地项目理解工具。它的界面应当像“项目理解 Wiki + 架构地图 + 代码证据浏览器”，而不是像聊天机器人或代码补全工具。

整体气质应当是：

- **清晰、克制、可信。** 让用户认为这是一个严肃的工程分析工具。
- **简洁、扁平、低噪音。** 不使用炫光、渐变大背景、玻璃拟态、过度拟物或强烈 AI 感。
- **概览优先，代码其次。** 首屏先解释项目全貌、模块、链路、数据和风险；代码只作为证据层和深入层。
- **信息分层。** 页面从项目级、模块级、链路级、数据级、风险级逐层进入代码。
- **留白充足。** 卡片之间保持呼吸感，避免把所有指标、图表和代码挤在同一屏。
- **所有 AI 结论都要有可信度。** 通过“确定事实 / 合理推测 / 待验证”标签表达结论可靠性。

视觉上参考生成图中的白底 SaaS 管理后台风格：左侧导航、顶部项目元信息、主体卡片、图表区、列表区和轻量代码证据区。不要把代码编辑器作为默认首页核心区域。

## Colors

设计系统基于冷静的中性色和单一蓝色主色。蓝色用于当前导航、主按钮、选中态和关键路径，不用于大面积装饰。风险、可信度和状态使用语义色。

- **Primary Blue `#2563EB`**：用于主操作、当前导航、选中模块、链路关键节点和可点击代码引用。
- **Neutral Background `#F8FAFC`**：页面背景，避免纯白整屏造成刺眼。
- **Surface White `#FFFFFF`**：卡片、表格、弹层和主内容容器。
- **Text Primary `#0F172A`**：页面标题、卡片标题、重点数据。
- **Text Secondary `#475569`**：正文说明、模块解释、辅助描述。
- **Muted Text `#64748B` / `#94A3B8`**：元数据、路径、时间、次级提示。
- **Border `#E5E7EB`**：卡片边框、表格分割线、输入框边界。
- **Success `#16A34A`**：确定事实、已验证、健康状态。
- **Warning `#F59E0B`**：合理推测、中风险、需要关注。
- **Danger `#EF4444`**：高风险、严重问题、失败状态。
- **Code Background `#0F172A`**：代码证据卡片和代码浏览器中的深色代码区。

颜色使用规则：

- 一个页面只允许一个视觉主按钮，使用 Primary Blue。
- 风险色只用于风险标签、风险图表和问题提示，不要用于普通装饰。
- Mermaid / 模块图中的节点可使用柔和色块，但必须低饱和、浅背景、细边框。
- 不使用荧光色、霓虹色、炫彩渐变和大面积 AI 紫色。

## Typography

字体默认使用系统无衬线字体栈，优先保证中文、英文、代码和数字在不同系统上的清晰度。

- **页面大标题**：24–32px，700，紧凑但不压迫。用于“项目总览”、“模块地图”、“数据模型”等页面标题。
- **卡片标题**：16–20px，600–650。用于模块名、链路名、风险项标题。
- **正文说明**：14–15px，400，行高 1.55–1.6。用于模块解释、业务解释、风险说明。
- **标签和按钮**：12–13px，600。用于 P0/P1、确定事实、风险等级等小标签。
- **元数据和路径**：12–13px，400。用于项目路径、分析时间、文件路径、行号等。
- **代码**：使用 JetBrains Mono / Menlo / Consolas 等等宽字体，12px，行高 1.6。

排版原则：

- 中文页面不使用过小字号。正文最小不低于 13px。
- 页面标题不要过度巨大，避免宣传页感。
- 数字指标可以比正文大，但不要变成 KPI 看板式夸张视觉。
- 同屏最多使用 3 个字重：400、600/650、700。

## Layout

整体采用桌面优先的三层布局：

1. **左侧导航 Sidebar**
   - 固定宽度约 220px。
   - 导航项保持 44px 高度，图标与文字对齐。
   - 当前页面使用浅蓝背景和蓝色文字。
   - 文件树不放在全局侧边栏，只放在代码浏览器页。

2. **顶部项目栏 Topbar**
   - 高度约 64px。
   - 展示项目名称、项目路径、最近分析时间。
   - 右侧保留“重新分析 / 导出报告 / 分享项目”。
   - 按钮数量保持克制，避免每页顶部出现过多动作。

3. **主内容区 Main**
   - 页面左右内边距 24px。
   - 卡片间距 16px。
   - 首页、模块地图、数据模型、风险雷达使用 Dashboard Grid。
   - 模块详情和链路详情使用“解释 + 图表 + 证据”的分层布局。
   - 代码浏览器页才使用文件树 / Monaco / 上下文面板的三栏工具型布局。

## Elevation & Depth

界面以扁平为主，层级通过边框、留白和浅阴影表达，不使用重阴影。

- 主背景：`neutral`
- 卡片：`surface`
- 卡片边框：`border`
- 卡片阴影：非常轻，类似 `0 1px 3px rgba(15, 23, 42, 0.06)`
- 悬浮态：通过边框变蓝、背景轻微变浅来表达。
- 选中态：使用 `primary-soft` 背景或 `primary` 边框。
- 弹层和抽屉可以使用更明显但仍克制的阴影。

禁止：

- 大面积投影。
- 强烈玻璃拟态。
- 发光边框。
- 3D 卡片。
- 背景渐变光斑。

## Shapes

形状语言应当现代、柔和但不幼稚。

- 卡片圆角：12px。
- 大型容器圆角：12–16px。
- 按钮圆角：8px。
- 输入框圆角：8px。
- Badge / Chip 圆角：9999px。
- 图表节点圆角：8–12px。
- 代码区圆角：8px。

不要混用锐角和大圆角。除头像、圆点状态、图标背景外，不使用大圆形装饰。

## Components

### App Shell

页面整体由左侧导航、顶部项目栏和主内容区组成。所有页面保持一致框架，降低切换成本。

- 左侧导航始终展示一级页面。
- 页面标题区使用图标 + 标题 + 一句解释。
- 页面主要内容使用卡片网格，不使用复杂嵌套容器。
- 操作按钮固定在顶部右侧或内容区右上角，避免到处散落。

### Sidebar

规则：

- 当前项使用浅蓝背景。
- 图标使用 lucide 风格线性图标，16–18px。
- 不使用带动画的 AI 图标。
- 底部用户区保持低调，不抢主内容注意力。

### Cards

卡片样式：

- 白底。
- 1px 浅边框。
- 12px 圆角。
- 16–24px 内边距。
- 轻阴影。
- 标题和内容之间保持 8–12px 间距。

### Badges and Chips

Badge 用于表达状态、可信度、优先级和风险。

- `确定事实`：绿色。
- `合理推测`：琥珀色。
- `待验证`：灰色或淡蓝。
- `P0`：蓝色。
- `P1`：浅蓝或灰蓝。
- `P2`：灰色。
- `高风险`：红色。
- `中风险`：琥珀色。
- `低风险`：绿色。

Badge 文案保持 2–5 个汉字，避免长句。

### Diagrams

图表是这个产品的核心理解层。

图表原则：

- 图比表优先，表比代码优先。
- 图必须解释系统结构或流程，不做装饰。
- 每个图只表达一个主题。
- 节点数量控制在 5–8 个。
- Mermaid 源码可查看，但默认隐藏。
- 图中的节点点击后进入模块、链路或代码证据。

图表类型：

- 系统架构图：项目总览。
- 模块依赖图：模块地图 / 模块详情。
- 链路顺序图：核心链路。
- 实体关系图：数据模型。
- 状态流转图：数据模型。
- 风险维度图：风险雷达。

### Tables

- 表头使用浅灰背景或无背景加粗。
- 行高不低于 48px。
- 行 hover 使用浅蓝背景。
- 选中行使用蓝色边框或左侧圆点。
- 过长文本截断，并在详情面板中展示完整内容。

### Forms

- 标签在上或左，保持一致。
- 输入框高度 40px。
- Helper text 使用 12–13px muted text。
- 敏感字段默认隐藏。
- 主要保存按钮放在页面右下或卡片底部右侧。
- 危险动作不与保存按钮并列。
