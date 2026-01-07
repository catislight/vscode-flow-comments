<p align="center">
  <img src="media/logo.png" width="128" alt="logo" />
</p>

<h1 align="center">Flow Comments</h1>

<p align="center">中文 | <a href="./README.md">English</a></p>

## 什么是 Flow Comments？

Flow Comments 是一款 VS Code 插件，专为梳理代码执行流程设计。无需复杂配置，只需在代码中添加简单注释标记，插件就会自动在侧边栏生成结构化流程树，帮你快速把握代码逻辑脉络，告别反复翻找文件的繁琐。

**适用场景：** 源码阅读、代码调试、代码评审、团队业务流程共享。

**使用效果演示：**
![alt text](media/example_usage.gif)

## 快速上手（5分钟搞定）

### 步骤1：安装插件

1. 打开 VS Code，按下快捷键 `Ctrl+Shift+X` 打开扩展面板。
2. 在搜索框输入 `Flow Comments`，点击安装。
3. 依赖要求：VS Code 版本 ≥ 1.80.0。

### 步骤2：添加流程注释（核心操作）

使用默认前缀 `flow` 标记流程，支持「开始/步骤/结束」三段式标记，步骤可嵌套层级。

**基础示例（JavaScript）：**

```javascript
// flow-login start 用户登录流程
function login() {
  // flow-login 1 输入用户名
  const username = getUsername();

  // flow-login 2 输入密码
  const password = getPassword();

  // flow-login 3 验证
  // flow-login 3.1 校验格式
  // flow-login 3.2 校验账号密码一致性
  validate(username, password);

  // flow-login end 登录流程完成
}
```

### 步骤3：查看与使用流程树

1. 保存代码后，插件自动扫描并生成流程树。
2. 打开 VS Code 侧边栏，找到「Flow Comments」面板，即可看到结构化流程。
3. 点击任意树节点，直接跳转到对应代码行（自动高亮显示）。

## 进阶用法

### 1. 层级步骤编排

用「数字.数字」表示子步骤，插件会自动按层级展示，清晰区分主流程与分支流程。

```javascript
// flow-login start
function login() {
  // flow-login 1 输入环节
  // flow-login 1.1 输入用户名
  // flow-login 1.2 输入密码

  // flow-login 2 验证环节
  // flow-login 2.1 前端格式校验
  // flow-login 2.2 后端接口校验

  // flow-login end
}
```

### 2. 无编号标题折叠

无需数字前缀，用「非ASCII字符开头的关键字」作为折叠标识，避免与子功能冲突，兼容现有编号逻辑。

```javascript
// flow-login start
// flow-login-变量 密码状态管理
let passwordStatus = 'unverified';
// ... 相关代码
// flow-login end
```

### 3. 子功能树状展示

用连字符「-」表示子功能，子功能内的步骤按层级展示，无序步骤自动合并到底部。

```javascript
// flow-login-request 1 发起登录请求
// flow-login-request 1.1 组装请求参数
// flow-login-request 一段说明文本
```

### 4. 快速标记（Mark）

用 `mark` 前缀快速标记关键代码位置，空标记自动生成路径-行号注解。

```javascript
// mark-date 处理日期格式化的核心函数
function processDate() {}

// mark
function compute() {}
```

## 自定义配置

按下快捷键 `Ctrl+,` 打开 VS Code 设置，搜索 `Flow Comments` 可自定义以下参数，适配不同项目需求。

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `flow.prefix` | string | `"flow"` | 流程注释前缀，如 `// flow-login start` |
| `flow.markPrefix` | string | `"mark"` | 快速标记前缀，如 `// mark-描述` |
| `flow.includeGlobs` | array<string> | `["**/*.{ts,tsx,js,jsx}", "**/*.{java,kt}", "**/*.{go}", "**/*.{py}"]` | 需要扫描的文件类型，缩小扫描范围提升性能 |
| `flow.ignorePaths` | array<string> | `["node_modules", "dist", ".git"]` | 忽略扫描的目录，避免冗余解析 |
| `flow.maxFileSizeKB` | number | `1024` | 参与解析的最大文件大小（KB） |
| `flow.scanConcurrency` | number | `8` | 扫描并发度（一次并发处理的文件数量） |
| `flow.highlightBackground` | string | `rgba(255, 193, 7, 0.16)` | 点击跳转后代码行的高亮背景色 |
| `flow.highlightColor` | string | `#1A1A1A` | 高亮行的文本颜色 |
| `flow.tokenBackground` | string | `rgba(255, 193, 7, 0.28)` | 前缀单词的背景色 |
| `flow.tokenColor` | string | `#1A1A1A` | 前缀单词的文本颜色 |
| `flow.hintBackground` | string | `rgba(255, 235, 59, 0.10)` | 流程注释行的背景色 |
| `flow.strictMode` | boolean | `true` | 开启后提示缺失开始/结束、重复步骤等错误 |
| `flow.commentStyles` | array<string> | `["//", "#"]` | 支持的单行注释起始符（如 `//`、`#`、`--`） |
| `flow.markPathLevels` | number | `3` | Mark 面板路径层级数量 |

*注：完整配置项可在设置面板查看，一般默认配置可满足大部分场景。*

## 核心特性

- **可视化流程树：** 注释自动转为结构化树状图，全局把握逻辑。
- **一键跳转高亮：** 点击树节点直接定位代码行，高亮提示更醒目。
- **错误智能检测：** 严格模式下提示流程标记不规范问题。
- **灵活自定义：** 支持调整注释前缀、颜色、扫描范围等。
- **高性能适配：** 支持大型项目，可配置并发度、文件大小限制。
- **持久化索引：** 保存扫描结果，避免重复解析，提升体验。

## 常见问题（FAQ）

**Q1：侧边栏看不到流程树？**

A：检查三点：
- 注释格式正确（如 `// flow-xxx start`）
- 文件类型在 `includeGlobs` 配置中
- 文件路径未被 `ignorePaths` 忽略

**Q2：大型项目扫描速度慢？**

A：优化配置：
- 缩小 `includeGlobs` 范围，只保留必要文件类型
- 增加 `flow.scanConcurrency` 并发数
- 降低 `flow.maxFileSizeKB`，过滤大文件

**Q3：代码更新后流程树未同步？**

A：保存文件会自动触发扫描，也可使用命令 `Scan Active File` 手动扫描当前文件。

## 支持与反馈

如果觉得插件有用，欢迎在 [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=catislight.vscode-flow-comments&ssr=false#review-details) 或 [GitHub](https://github.com/catislight/vscode-flow-comments) 点亮星星 ⭐️。

发现 Bug 或有功能建议，可在 [GitHub](https://github.com/catislight/vscode-flow-comments/issues) 提交 Issue 反馈。
