# AI Translation Extension

A browser extension that translates web pages powered by LLMs via APIs compatible with the OpenAI GPT protocol.

## Features

- Translate entire web pages while preserving HTML structure and formatting
- Support for any language (configurable via text input)
- Cache translations to avoid redundant API calls
- Viewport-based translation for better performance on large pages
- Restore original content with one click
- Compatible with any LLM API that implements the OpenAI GPT protocol

## Getting Started

### Prerequisites

- [mise](https://mise.jdx.dev/) - Runtime version manager
- Node.js 24.5.0 (automatically installed via mise)

### Installation

1. Clone the repository:
```bash
git@github.com:shunirr/ai-translation-extension.git
cd ai-translation-extension
```

2. Install Node.js via mise:
```bash
mise install
```

3. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

### Build

Build the extension for production:
```bash
npm run build
```

The built extension will be in the `dist` directory.

### Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

### Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `dist` directory from this project

## Configuration

After installing the extension, click on the extension icon to configure:

- **API Endpoint**: The LLM API endpoint (default: `https://api.openai.com/v1/chat/completions`)
- **API Key**: Your API key for authentication
- **Model**: The model to use (default: `gpt-4.1-nano`)
- **Target Language**: The language to translate to (default: `Japanese`)

## Usage

1. Navigate to any web page you want to translate
2. Click the extension icon
3. Configure your settings if needed
4. Click "Translate Page"
5. To restore the original content, click "Restore Original"

You can also right-click on any page and select "Translate this page" from the context menu.

## Technical Details

### Architecture

The extension consists of several key components:

- **Background Script** (`background.ts`): Handles extension lifecycle and message routing
- **Content Script** (`content.ts`): Manages DOM manipulation and translation application
- **Popup UI** (`popup.html`/`popup.ts`): Provides user interface for configuration
- **API Wrapper** (`api.ts`): Handles communication with LLM APIs
- **Element Translator** (`element-translator.ts`): Core translation logic for HTML elements
- **Cache** (`cache.ts`): LRU cache implementation for translation results
- **Utils** (`utils.ts`): Placeholder processing and utility functions

### Translation Process

1. **Text Extraction**: Extracts translatable elements from the page while excluding UI components
2. **HTML Abstraction**: Converts HTML tags to placeholders (e.g., `<strong>` → `<strong_0>`)
3. **Translation**: Sends abstracted text to LLM API
4. **Restoration**: Converts placeholders back to original HTML tags
5. **Application**: Applies translated content to the DOM while preserving structure

### Cache Strategy

- Uses LRU (Least Recently Used) cache with maximum 1000 entries
- Cache key is generated from placeholder-abstracted text
- Stored in memory during session

### Supported Features

- **Viewport-based Translation**: Automatically enabled for large pages (>50,000 characters)
- **Progress Indication**: Shows translation progress with badge and notifications
- **Error Handling**: Displays clear error messages when translation fails
- **State Preservation**: Original content stored in `data-*` attributes

## Development Guidelines

### Code Quality

Before committing, always run:
```bash
npm test          # Run tests
npm run lint      # Check ESLint issues
npx tsc --noEmit  # Check TypeScript compilation
npm run build     # Ensure build succeeds
```

### Project Structure

```
/src
├── manifest.config.ts       # Extension manifest configuration
├── background.ts            # Service worker for message handling
├── content.ts              # Content script for page manipulation
├── popup.html              # Popup UI HTML
├── popup.ts                # Popup UI logic
├── api.ts                  # LLM API wrapper
├── cache.ts                # LRU cache implementation
├── utils.ts                # Utility functions
└── element-translator.ts   # Element-based translation logic

/test
├── *.test.ts               # Test files for each module

/icons
├── icon-32.png             # Extension icons
├── icon-64.png
└── icon-128.png
```

## Requirements

### Functional Requirements

- User-initiated translation only (no automatic translation)
- Configurable LLM API endpoints and authentication
- Preserve HTML structure and formatting during translation
- Cache translations to minimize API usage
- Restore original content capability
- Progress and error indication

### Technical Requirements

- Manifest V3 compliant
- TypeScript for type safety
- No framework dependencies (vanilla JS + DOM APIs)
- Compatible with Chrome, Edge, and Firefox (planned)
- Maximum 1000 cached translations (LRU eviction)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Acknowledgments

This project was developed with the assistance of AI tools:
- [Claude Code](https://claude.ai/code) by Anthropic
- [ChatGPT](https://chat.openai.com) by OpenAI

These AI assistants helped with code generation, architecture decisions, testing strategies, and documentation.
