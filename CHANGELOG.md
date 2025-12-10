# Change Log

All notable changes to the "Flow Comments" VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
