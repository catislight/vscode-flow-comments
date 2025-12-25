# Change Log

All notable changes to the "Flow Comments" VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.3.2] - 2025-12-25

### Changed
- Mark syntax changed from `// mark-desc` to `// mark desc` (space-separated).


## [v0.3.1] - 2025-12-18

### Features
- Support for flow comments without order numbers (e.g., `// flow-login desc`).
  - These are treated as steps and sorted by line number.
  - Useful for simple lists or notes within a flow that don't require strict ordering.


## [v0.3.0] - 2025-12-16

### Features
- Description support for `start` and `end` markers in flow comments.
- Non-numbered heading folding:
  - Adds folding rules that don't require numeric prefixes.
  - Parses keywords from headings (e.g., "variable" from `// flow-login-variable Password Status`) to use as folding identifiers.
  - Backward compatible with existing numbered heading folding.
- Feature-title completions with strict filtering to existing items.
- Single-line quick marks using `// mark-<desc>` for annotating key code sections.
- Empty `// mark` comments auto-generate path-line annotations.

### Changed
- Refactor `provider.ts` into single-responsibility functions.

### Fixed
- Resolve code hinting issues and enhance code completion behavior.

## [v0.2.2] - 2025-12-10

### Changed
- Startup indexing now scans only files present in persistent cache; falls back to glob scan when cache is empty.
- Persistent index updates occur only when comment hash changes; open events skip when unchanged.

### Fixed
- Clear line highlight on text edit to prevent residual after deleting the highlighted line.
- Delete-node cascades to child steps under the same order hierarchy; missing files are skipped gracefully.
- Reveal robust against moved/renamed files: rescans and auto-relocates to matching node; safe line clamping and error guards.

## [v0.2.1] - 2025-12-09

### Features
- Visual Tree navigation for flow comments
- Click-to-jump with line highlight
- Error detection for missing start/end and duplicate steps
- Editor hints that highlight flow comment lines
- Quick delete for nodes and entire flows
- Customizable highlight colors for jumps and hints
- Configurable comment styles and ignore paths/files
- Performance controls: include globs, ignore paths, max file size, concurrency
- Persistent index to avoid re-parsing large repositories

### Compatibility
- Lowered minimum VS Code to ^1.80.0
