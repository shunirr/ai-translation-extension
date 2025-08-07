# Contributing to AI Translation Extension

First off, thank you for considering contributing to AI Translation Extension! It's people like you that make this extension a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please be respectful and professional in all interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible.
* **Provide specific examples to demonstrate the steps**.
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
* **Explain which behavior you expected to see instead and why.**
* **Include screenshots** if possible.
* **Include your environment details** (Chrome version, OS, etc.).

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
* **Provide specific examples to demonstrate the steps** or provide mockups.
* **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
* **Explain why this enhancement would be useful** to most users.

### Pull Requests

Please follow these steps to have your contribution considered:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Development Process

1. Clone the repository
   ```bash
   git clone https://github.com/[username]/chrome-extension-openai-translation.git
   cd chrome-extension-openai-translation
   ```

2. Install dependencies
   ```bash
   mise install  # Install Node.js
   npm install   # Install npm dependencies
   ```

3. Create a new branch
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. Make your changes and test
   ```bash
   npm run dev   # Start development server
   npm test      # Run tests
   ```

5. Check code quality
   ```bash
   npm run lint              # Check ESLint
   npx tsc --noEmit         # Check TypeScript
   npm run build            # Ensure build succeeds
   npm run test:coverage    # Check test coverage (aim for >60%)
   ```

6. Commit your changes
   ```bash
   git add .
   git commit -m "Add your meaningful commit message"
   ```

7. Push to your fork and submit a pull request

## Development Guidelines

### Code Style

* We use TypeScript for type safety
* Follow the existing code style (enforced by ESLint)
* Write meaningful variable and function names
* Add comments for complex logic
* Keep functions small and focused

### Testing

* Write tests for new features
* Maintain test coverage above 60%
* Test files should be named `*.test.ts`
* Use descriptive test names

### Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

Example:
```
Add viewport-based translation for large pages

- Implement Intersection Observer for visible elements
- Add toggle option in popup UI
- Automatically enable for pages > 50,000 characters

Fixes #123
```

### Documentation

* Update README.md if you change functionality
* Document new functions and complex logic
* Update CLAUDE.md if you change development workflows
* Keep documentation concise and clear

## Project Structure

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
```

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing! 🎉