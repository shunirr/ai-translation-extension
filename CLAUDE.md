# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Please talk in Japanese, But write code-comments in English.

## Project Overview

This is a Chrome extension for translating web pages using LLM APIs compatible with the OpenAI GPT protocol. The extension focuses on:
- Preserving HTML structure during translation
- Smart Translation: viewport-based translation that translates content as it becomes visible
- Efficient batch processing with configurable rate limiting
- LRU caching to minimize API calls

## Development policy

- Do not use mock, do not use demo mode. WE WANT TO WRITE THE REAL WORKING CODE.

- First, write test code according to the request.
  - Minimal is fine.
  - It may be better to discuss while writing the actual code first. Be
    flexible.
- Next, write the actual code while running the test code.
  - Make sure the method is not too long.
  - Make sure the file is not too long.
- If there is information you do not understand and you think you can check it
  on github, use the gh command.

- Do not use an easy foolish workaround.

  - PROHIBIT BEHAVIOR) We can't access API! Use mock! This is the demo mode!
    - Do not use mock, do not use demo mode. WE WANT TO WRITE THE REAL WORKING
      CODE.
  - PROHIBIT BEHAVIOR) We can't fix this error! Ignore this test!
    - Do not ignore the given test. WE WANT TO PASS ALL GIVEN TESTS.

- The daemon should be started in the background, and should always be designed
  to cause a hot reload. Also, make sure that the daemon outputs a log file.
  During development, be sure to check that it is working by reading the log
  file.
- Do not change the daemon's port number just because it does not start.
- Do not try to run code by doing meaningless actions, such as always enabling
  demo mode.
- Do not use mock except the test codes. At first, check the real connection of
  APIs/Devices. Do not use mock.
- Do not use mock, do not use demo mode, do not ignore the given tests.
- Do not use mock, do not use demo mode, do not ignore the given tests.
- Do not use mock, do not use demo mode, do not ignore the given tests.
- Do not use mock, do not use demo mode, do not ignore the given tests.
- Do not use mock, do not use demo mode, do not ignore the given tests.
- Please stick to your original orders and don't just decide to downgrade.

## Development Workflow

IMPORTANT: Always work on a feature branch and create pull requests. Never commit directly to the main branch.

### Development process

1. ALWAYS create a feature branch with `git checkout -b feature/[descriptive-name]` from the HEAD of
   the main branch. This branch name should be a concise English version of the work you are about to do. 
   If you have changes before committing and cannot `checkout -b`, ask whether you should `commit`, `stash`, or discard.
2. Develop test code first. Once the test code works, the production level code
   should be complete. The test code should also work in CI.
3. After implementing any code changes, always run these checks:
   - Run `npm test` to ensure all tests pass
   - Run `npm run lint` to check for ESLint issues and fix them
   - Run `npx tsc --noEmit` to check for TypeScript compilation errors
   - Run `npm run build` to ensure the project builds successfully
4. Once the development work has progressed to a certain extent, record the
   current situation in `notes/`, commit, and push. When you push for the first
   time, create a pull request.
5. If you delete or rename a file, `git add` the file before the change or
   deletion.

### Task Completion Process

When a significant task or milestone is completed:

1. Update progress notes in `notes/` directory with implementation details
2. Update the development schedule in `development-schedule.md`
3. Commit changes with descriptive message
4. Push to GitHub repository

This ensures proper documentation of progress and maintains project history.

## Policy

Do not use mock, do not use demo mode. WE WANT TO WRITE THE REAL WORKING CODE.

## Development Commands

### Initial Setup
```bash
mise install         # Install Node.js version specified in .mise.toml
npm install          # Install dependencies
```

### Build
```bash
npm run build        # Production build (TypeScript + Vite)
npm run dev          # Development build with watch mode and hot reload
```

### Test
```bash
npm test             # Run all tests with Vitest
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Code Quality
```bash
npm run lint         # Run ESLint v9 with flat config
npm run typecheck    # Run TypeScript type checking (tsc --noEmit)
```

### Chrome Extension Development
```bash
npm run build        # Build extension to dist/
# Then load dist/ as unpacked extension in Chrome
```

## Architecture Overview

### Core Components

1. **Background Script** (`src/background.ts`)
   - Handles extension lifecycle and message routing
   - Manages translation triggers from popup or context menu
   - Coordinates communication between popup and content scripts

2. **Content Script** (`src/content.ts`)
   - Extracts translatable text from DOM while preserving structure
   - Applies translations back to the page
   - Manages original content restoration
   - Handles text clustering and placeholder processing

3. **Popup UI** (`src/popup.html`, `src/popup.ts`)
   - Language selection interface
   - LLM API configuration
   - Translation trigger controls

4. **API Module** (`src/api.ts`)
   - API wrapper for LLMs compatible with OpenAI GPT protocol
   - Handles authentication and request formatting
   - Error handling and retry logic

5. **Cache Module** (`src/cache.ts`)
   - LRU cache implementation (max 1000 entries)
   - Hash-based key generation from placeholder text
   - In-memory storage with optional persistence

6. **Utilities** (`src/utils.ts`)
   - Placeholder processing for HTML structure preservation
   - Text clustering algorithms
   - DOM traversal helpers

### Key Design Decisions

- **No frameworks**: Pure TypeScript with DOM APIs for minimal bundle size
- **Manifest V3**: Future-proof extension architecture  
- **Structure preservation**: Translates content while maintaining HTML structure using placeholder abstraction
- **Smart Translation**: Always uses viewport-based translation for better performance
- **State management**: Uses data-* attributes to store original content for restoration
- **Rate limiting**: Configurable RPS (default: 0.9) to respect API limits
- **Batch processing**: Groups translations up to 1000 characters per request

### Development Notes

- The extension targets Chrome primarily but maintains compatibility with Edge
- All translations are performed via LLM APIs with configurable endpoints compatible with OpenAI GPT protocol
- Default model: gpt-4.1-nano, Default batch size: 1000 characters
- The extension never auto-translates; all actions are user-initiated
- Error states are communicated via icon badges and visual indicators
- Context menu dynamically shows "AI Translation: [Language]" based on settings
