# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Dynamic context menu title showing "AI Translation: [Language]" based on configured target language (#30)
- ESLint v9 with Flat Config format support (#28)
- Improved Renovate configuration for better dependency management (#29)
- Comprehensive documentation updates (CHANGELOG.md, improved README.md, CLAUDE.md, CONTRIBUTING.md)

### Changed
- Default model changed from `gpt-4.1-mini` to `gpt-4.1-nano` for better performance (#31)
- Default batch size reduced from 2000 to 1000 characters for smaller API requests (#31)
- Smart Translation (viewport-based) is now always enabled (removed toggle option) (#31)
- Context menu now displays the actual configured language instead of generic "Translate this page" (#30)
- Development workflow now requires feature branches (no direct commits to main) (#32)

### Fixed
- Reverted incorrect GPT-5 compatibility attempts that were causing API errors (#27)

### Removed
- Smart Translation toggle from popup UI (now always enabled) (#31)

## [0.1.1] - 2025-08-09

### Added
- Batch translation support for improved performance (#17)
- Configurable batch size (characters per request) (#17)
- Smart element detection to exclude UI components (#22)
- Improved placeholder handling for better translation accuracy (#22)

### Changed
- Default model updated to `gpt-4.1-mini` (#18)
- Default RPS increased to 0.9 (#18)

### Fixed
- Translation accuracy for complex HTML structures (#22)

## [0.1.0] - 2025-08-09

### Added
- Initial release of AI Translation Extension
- Support for any LLM API compatible with OpenAI GPT protocol
- HTML structure preservation during translation
- LRU cache for translation results (max 1000 entries)
- Viewport-based translation for large pages
- Configurable API rate limiting (RPS)
- Right-click context menu integration
- Progress indication with badge notifications
- One-click restore to original content
- Support for any target language via text input

### Technical Features
- TypeScript implementation for type safety
- Manifest V3 compliance
- No framework dependencies (pure DOM APIs)
- Vite build system for optimal bundling
- Comprehensive test suite with Vitest
- ESLint and TypeScript strict mode