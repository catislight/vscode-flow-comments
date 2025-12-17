<p align="center">
  <img src="media/logo.png" alt="logo" />
</p>

<h1 align="center">Flow Comments</h1>

<p align="center"><a href="./README_CN.md">中文</a> | English</p>

## Overview

Flow Comments helps you navigate code processes using simple comments. It creates a visual tree in the VS Code sidebar, allowing you to jump instantly to code locations by clicking nodes. Simply add comment marks to annotate code execution steps, and visualize the logic flow.

Key Benefits: significantly improves code reading efficiency, reduces file switching costs, and is especially suitable for source code reading, debugging, code reviews, and sharing business processes.

Example Usage:
![alt text](media/example_usage.gif)

## Quick Start

### Installation

1. Open VS Code.
2. Go to Extensions (Ctrl+Shift+X).
3. Search for `Flow Comments` and install.
4. Requires VS Code ^1.80.0 or later.

### Configuration

Customize settings via VS Code Settings (Ctrl+,), search for `Flow Comments`. Full list of options:

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `flow.prefix` | string | `"flow"` | Comment prefix, e.g., `// flow-login start` |
| `flow.markPrefix` | string | `"mark"` | Mark prefix for single-line notes, e.g., `// mark-desc` |
| `flow.includeGlobs` | array<string> | `["**/*.{ts,tsx,js,jsx}", "**/*.{java,kt}", "**/*.{go}", "**/*.{py}"]` | File matching patterns (glob) for scanning to speed up large repo scans |
| `flow.ignorePaths` | array<string> | `["node_modules", "dist", ".git"]` | Directories to ignore during indexing (relative to workspace root) |
| `flow.maxFileSizeKB` | number | `1024` | Maximum file size (KB) for parsing |
| `flow.scanConcurrency` | number | `8` | Number of files processed concurrently during scan |
| `flow.highlightBackground` | string | `rgba(255, 193, 7, 0.16)` | Background color for line highlighting after click jump (rgba/hex) |
| `flow.highlightColor` | string | `#1A1A1A` | Text color within the highlighted line range |
| `flow.tokenBackground` | string | `rgba(255, 193, 7, 0.28)` | Background color for prefix words (highlights only that word) |
| `flow.tokenColor` | string | `#1A1A1A` | Text color that applies only to prefix words (improves contrast) |
| `flow.hintBackground` | string | `rgba(255, 235, 59, 0.10)` | Background color for flow comment lines in default state |
| `flow.strictMode` | boolean | `true` | Strict mode: enable error prompts (diagnostics hidden when off) |
| `flow.commentStyles` | array<string> | `["//", "#"]` | Supported single-line comment starters (e.g., `//`, `#`, `--`) |
| `flow.markPathLevels` | number | `3` | Number of path segments to show for mark labels (from end; min 1) |

## Usage Guide

### Basic Usage

1. Add comments in your code using the prefix (default: "flow").
2. Mark the start with "start", steps with numbers, and end with "end". Descriptions are supported on `start` and `end`.

Example:

```javascript
// flow-login start User Login Flow
function login() {
  // flow-login 1 Enter username
  const username = getUsername();

  // flow-login 2 Enter password
  const password = getPassword();

  // flow-login 3 Validate
  validate(username, password);

  // flow-login end Completed
}
```

3. Open the Flow Comments panel in VS Code sidebar.
4. Click a node to jump to that code line.

### Hierarchies

Use dotted numbers to express sub-steps (e.g., "1.1", "1.2", "2.1.3"). Within the same flow, step numbers must be unique and they sort automatically by numeric hierarchy.

Example:

```javascript
// flow-login start
function login() {
  // flow-login 1 Input
  // flow-login 1.1 Enter username
  // flow-login 1.2 Enter password

  // flow-login 2 Validate
  // flow-login 2.1 Check format
  // flow-login 2.2 Verify credentials

  // flow-login end
}
```

### Non-numbered Headings

- Supports folding without numeric prefixes.
- Parsing logic extracts keywords from headings to use as folding identifiers.
- Backward compatible with numbered heading folding.

Example:

```javascript
// flow-login start
// flow-login-variable Password Status
// ... code
// flow-login end
```

In this example, `variable` is parsed as the folding identifier from the heading `// flow-login-variable Password Status`.

### Quick Marks

- Use `// mark-<desc>` to quickly annotate important code sections.
- Empty `// mark` generates an automatic path-line annotation.

Example:

```javascript
// mark-date processing function
function processDate() {}

// mark
function compute() {
  // auto path-line annotation is generated
}
```

## Features

- **Visual Tree Navigation**: Turns comments into a sidebar tree for easy overview.
- **Instant Jump**: Click nodes to go directly to code lines with highlights.
- **Error Detection**: Warns about missing starts/ends or duplicate steps.
- **Code Hints**: Highlights flow comments in the editor.
- **Quick Delete**: Right-click to delete flow nodes or entire flows.
- **Custom Highlight Colors**: Configure colors for jumps and hints.
- **Configurable Comments**: Set comment styles (//, #, etc.) and ignore paths/files.
- **Performance**: Optimizes for large projects with scanning controls.
- **Persistent Index**: Saves scans to avoid re-parsing.
- **Non-numbered Heading Folding**: Fold sections using parsed keywords without numeric prefixes.
- **Enhanced Completions**: Feature-title completions strictly filtered to existing items.
- **Improved Code Hints**: Fixes issues and enhances code hinting behavior.
- **Quick Marks**: Support `// mark-<desc>` single-line marks and empty `// mark` for auto path-line annotation.

## FAQ

### Prerequisites

- Add comments with the prefix (default: "flow") to your code.
- Supports Java, JavaScript, Python, Go, etc.
- For large projects, adjust scanning settings.

### Common Issues

- **No tree nodes?** Check comments are added correctly, file types are included, and paths not ignored.
- **Slow performance?** Limit file types, increase concurrency, reduce max file size.
- **Index not updating?** Save file to trigger scan, or use "Scan Active File" command.

## Support

Like it? Star on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=catislight.vscode-flow-comments&ssr=false#review-details) or [GitHub](https://github.com/catislight/vscode-flow-comments)!

Found bugs or have ideas? Open an [Issue](https://github.com/catislight/vscode-flow-comments/issues) on GitHub.
