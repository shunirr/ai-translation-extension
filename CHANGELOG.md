# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Dynamic context menu title showing "AI Translation: [Language]" based on configured target language
- ESLint v9 with Flat Config format support
- Improved Renovate configuration for better dependency management
- Comprehensive documentation updates

### Changed
- Default model changed from `gpt-4.1-mini` to `gpt-4.1-nano` for better performance
- Default batch size reduced from 2000 to 1000 characters for smaller API requests
- Smart Translation (viewport-based) is now always enabled (removed toggle option)
- Context menu now displays the actual configured language instead of generic "Translate this page"

### Fixed
- Reverted incorrect GPT-5 compatibility attempts that were causing API errors

### Removed
- Smart Translation toggle from popup UI (now always enabled)

## [0.1.1] - 2024-12-XX

### Added
- Batch translation support for improved performance
- Configurable batch size (characters per request)
- Smart element detection to exclude UI components
- Improved placeholder handling for better translation accuracy

### Fixed
- GPT-5 model compatibility issues with max_completion_tokens parameter
- Temperature parameter compatibility for GPT-5 models
- Translation accuracy for complex HTML structures

## [0.1.0] - 2024-12-XX

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