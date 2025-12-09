<p align="center">
  <img src="media/logo.png" alt="logo" />
</p>

<h1 align="center">Flow Comments</h1>

<p align="center"><a href="./README_CN.md">中文</a> | English</p>

## Overview

Flow Comments helps you navigate code processes using simple comments. It creates a visual tree in the VS Code sidebar, allowing you to jump instantly to code locations by clicking nodes. No code changes needed—just add comments to mark steps.

Benefits: Enhances code reading, reduces switching costs between files, and is ideal for debugging, reviews, and teamwork.

## Quick Start

## Installation

1. Open VS Code.
2. Go to Extensions (Ctrl+Shift+X).
3. Search for `Flow Comments` and install.
4. Requires VS Code ^1.106.1 or later.

## Configuration

Customize settings via VS Code Settings (Ctrl+,), search for `Flow Comments`. Full list of options:

- **flow.prefix**: Comment prefix, e.g., // flow-login start (Default: "flow")
- **flow.includeGlobs**: File matching patterns (glob) for scanning, to speed up large repository scans (Default: ["**/*.{ts,tsx,js,jsx}", "**/*.{java,kt}", "**/*.{go}", "**/*.{py}"])
- **flow.ignorePaths**: Directories to ignore during indexing (relative to workspace root) (Default: ["node_modules", "dist", ".git"])
- **flow.maxFileSizeKB**: Maximum file size (KB) for parsing (Default: 1024)
- **flow.scanConcurrency**: Scan concurrency (number of files processed concurrently), to improve large repository scan speed (Default: 8)
- **flow.highlightBackground**: Background color for line highlighting after click jump (supports rgba/hex) (Default: "rgba(255, 193, 7, 0.16)")
- **flow.highlightColor**: Text color within the highlighted line range (optional) (Default: "#1A1A1A")
- **flow.tokenBackground**: Background color for prefix words in comments in default state (highlights only that word) (Default: "rgba(255, 193, 7, 0.28)")
- **flow.tokenColor**: Text color that applies only to prefix words (to improve contrast) (Default: "#1A1A1A")
- **flow.hintBackground**: Background color for flow comment lines in default state (Default: "rgba(255, 235, 59, 0.10)")
- **flow.strictMode**: Strict mode: Enable error prompts (diagnostics not shown when off) (Default: true)
- **flow.commentStyles**: Supported single-line comment starters (e.g., //, #, --) (Default: ["//", "#"])

## Usage Guide

## Basic Usage

1. Add comments in your code using the prefix (default: "flow").
2. Mark the start with "start", steps with numbers, and end with "end".

Example:

```javascript
// flow-login start
function login() {
  // flow-login 1 Enter username
  const username = getUsername();

  // flow-login 2 Enter password
  const password = getPassword();

  // flow-login 3 Validate
  validate(username, password);

  // flow-login end
}
```

3. Open the Flow Comments panel in VS Code sidebar.
4. Click a node to jump to that code line.

## Advanced: Hierarchies

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

## FAQ

## Prerequisites

- Add comments with the prefix (default: "flow") to your code.
- Supports Java, JavaScript, Python, Go, etc.
- For large projects, adjust scanning settings.

## Common Issues

- **No tree nodes?** Check comments are added correctly, file types are included, and paths not ignored.
- **Slow performance?** Limit file types, increase concurrency, reduce max file size.
- **Index not updating?** Save file to trigger scan, or use "Scan Active File" command.

## Support

Like it? Star on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=catislight.vscode-flow-comments&ssr=false#review-details) or [GitHub](https://github.com/catislight/vscode-flow-comments)!

Found bugs or have ideas? Open an [Issue](https://github.com/catislight/vscode-flow-comments/issues) on GitHub.
