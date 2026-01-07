<p align="center">
  <img src="media/logo.png" width="128" alt="logo" />
</p>

<h1 align="center">Flow Comments</h1>

<p align="center"><a href="./README_CN.md">中文</a> | English</p>


## What is Flow Comments?

Flow Comments is a VS Code extension designed to clarify code execution flow. No complex configuration needed—just add simple comment markers to your code, and the extension automatically generates a structured flow tree in the sidebar, helping you quickly grasp code logic and eliminate tedious file searching.

**Use Cases:** Source code reading, debugging, code reviews, team business process sharing.

**Demo:**
![alt text](media/example_usage.gif)

## Quick Start (5 Minutes)

### Step 1: Install

1. Open VS Code and press `Ctrl+Shift+X` to open Extensions.
2. Search for `Flow Comments` and click Install.
3. Requires VS Code ≥ 1.80.0.

### Step 2: Add Flow Comments (Core)

Use the default prefix `flow` to mark flows. Support "start/step/end" three-part marking with nestable step levels.

**Basic Example (JavaScript):**

```javascript
// flow-login start User Login Flow
function login() {
  // flow-login 1 Enter username
  const username = getUsername();

  // flow-login 2 Enter password
  const password = getPassword();

  // flow-login 3 Validate
  // flow-login 3.1 Check format
  // flow-login 3.2 Verify credentials
  validate(username, password);

  // flow-login end Login Complete
}
```

### Step 3: View & Use Flow Tree

1. Save your code—the extension automatically scans and generates the flow tree.
2. Open the Flow Comments panel in the VS Code sidebar.
3. Click any tree node to jump directly to that code line (auto-highlighted).

## Advanced Usage

### 1. Hierarchical Steps

Use "number.number" to express sub-steps. The extension automatically displays them hierarchically, clearly distinguishing main flow from branches.

```javascript
// flow-login start
function login() {
  // flow-login 1 Input
  // flow-login 1.1 Enter username
  // flow-login 1.2 Enter password

  // flow-login 2 Validate
  // flow-login 2.1 Frontend format check
  // flow-login 2.2 Backend API check

  // flow-login end
}
```

### 2. Non-numbered Titles

No numeric prefix needed. Use "non-ASCII character prefix keywords" as fold identifiers to avoid conflicts with sub-features, while maintaining compatibility with numbered logic.

```javascript
// flow-login start
// flow-login-变量 Password State Management
let passwordStatus = 'unverified';
// ... related code
// flow-login end
```

### 3. Sub-feature Tree Display

Use hyphens "-" to express sub-features. Steps within sub-features display hierarchically. Unordered steps auto-merge to the bottom.

```javascript
// flow-login-request 1 Send Login Request
// flow-login-request 1.1 Assemble request params
// flow-login-request Some description text
```

### 4. Quick Mark

Use `mark` prefix to quickly annotate key code locations. Empty marks auto-generate path-line annotations.

```javascript
// mark-date Core date formatting function
function processDate() {}

// mark
function compute() {}
```

## Configuration

Press `Ctrl+,` to open VS Code Settings, search for `Flow Comments` to customize:

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `flow.prefix` | string | `"flow"` | Flow comment prefix, e.g., `// flow-login start` |
| `flow.markPrefix` | string | `"mark"` | Quick mark prefix, e.g., `// mark-description` |
| `flow.includeGlobs` | array<string> | `["**/*.{ts,tsx,js,jsx}", "**/*.{java,kt}", "**/*.{go}", "**/*.{py}"]` | File types to scan; narrow scope to improve performance |
| `flow.ignorePaths` | array<string> | `["node_modules", "dist", ".git"]` | Directories to ignore; avoid redundant parsing |
| `flow.maxFileSizeKB` | number | `1024` | Maximum file size (KB) for parsing |
| `flow.scanConcurrency` | number | `8` | Concurrent file processing during scan |
| `flow.highlightBackground` | string | `rgba(255, 193, 7, 0.16)` | Highlight background color after jump |
| `flow.highlightColor` | string | `#1A1A1A` | Highlight text color |
| `flow.tokenBackground` | string | `rgba(255, 193, 7, 0.28)` | Prefix word background color |
| `flow.tokenColor` | string | `#1A1A1A` | Prefix word text color |
| `flow.hintBackground` | string | `rgba(255, 235, 59, 0.10)` | Flow comment line background color |
| `flow.strictMode` | boolean | `true` | Enable error prompts for malformed markers |
| `flow.commentStyles` | array<string> | `["//", "#"]` | Supported comment starters (e.g., `//`, `#`, `--`) |
| `flow.markPathLevels` | number | `3` | Path segments to show in mark labels |

*Note: Default settings work for most scenarios.*

## Core Features

- **Visual Flow Tree**: Comments auto-convert to structured tree in sidebar for quick overview.
- **One-Click Jump**: Click tree nodes to jump directly to code with highlight.
- **Smart Error Detection**: Strict mode alerts on malformed markers, missing start/end, duplicate steps.
- **Flexible Customization**: Adjust comment prefix, colors, scan range, and more.
- **High Performance**: Supports large projects with configurable concurrency and file size limits.
- **Persistent Index**: Saves scan results to avoid re-parsing, improving experience.

## FAQ

**Q1: No flow tree in sidebar?**

A: Check three things:
- Comment format is correct (e.g., `// flow-xxx start`)
- File type is in `includeGlobs` config
- File path is not in `ignorePaths`

**Q2: Slow scanning on large projects?**

A: Optimize config:
- Narrow `includeGlobs` to only needed file types
- Increase `flow.scanConcurrency`
- Lower `flow.maxFileSizeKB` to filter large files

**Q3: Flow tree not syncing after code changes?**

A: Save the file to trigger auto-scan, or use "Scan Active File" command manually.

## Support & Feedback

Like it? Star on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=catislight.vscode-flow-comments&ssr=false#review-details) or [GitHub](https://github.com/catislight/vscode-flow-comments) ⭐️

Found bugs or have suggestions? Open an [Issue](https://github.com/catislight/vscode-flow-comments/issues) on GitHub.
