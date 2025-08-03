# Generate Tag Function Tests

This directory contains comprehensive tests for the `generate-tag.js` function that handles semantic version tag generation for GitHub repositories.

## Files

- **`generate-tag.js`** - Main function that generates semantic version tags
- **`generate-tag.test.js`** - Jest-based comprehensive test suite
- **`test-runner.js`** - Simple standalone test runner (no external dependencies)
- **`package.json`** - Node.js package configuration for Jest testing

## Running Tests

### Option 1: Simple Test Runner (No Dependencies)
```bash
node test-runner.js
```

### Option 2: Jest Test Suite (Requires npm install)
```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

The test suite covers the following scenarios:

### Basic Functionality
- ✅ Generate first version with no existing tags (major, minor, patch, pre-release)
- ✅ Generate next version with existing tags
- ✅ Pre-release version handling (increment and creation)

### Advanced Features
- ✅ Namespace filtering (only consider tags from specified namespace)
- ✅ Pagination handling (repositories with >100 tags)
- ✅ Mixed tag formats (with and without 'v' prefix)
- ✅ Invalid tag filtering (ignore non-semver tags)
- ✅ Previous version discovery based on semver type

### Error Handling
- ✅ GitHub API error handling
- ✅ Invalid input validation

### Real-world Scenarios
- ✅ Multiple namespaces in same repository
- ✅ Complex version histories with pre-releases
- ✅ Large repositories with many tags

## Function Usage

```javascript
const { generateTag } = require('./generate-tag');

// Generate next major version
const result = await generateTag(
    { github, context },  // GitHub API objects
    'my-namespace',       // Namespace for the tag
    true,                 // major bump
    false,                // minor bump
    false,                // patch bump
    false                 // pre-release
);

console.log(result);
// {
//   tag: 'my-namespace/v2.0.0',
//   version: '2.0.0',
//   current: { major: 1, minor: 5, patch: 3, preRelease: null },
//   next: { major: 2, minor: 0, patch: 0, preRelease: null },
//   previous: { major: 0, minor: 9, patch: 0, preRelease: null },
//   previousTag: 'my-namespace/v0.9.0'
// }
```

## Tag Format

The function expects and generates tags in the format: `<namespace>/v<semver>`

Examples:
- `api/v1.0.0`
- `worker/v2.1.5`
- `service/v1.0.0-0` (pre-release)

## GitHub Actions Integration

This function is designed to be used in GitHub Actions workflows:

```yaml
- name: Generate Tag
  uses: actions/github-script@v7
  with:
    script: |
      const { generateTag } = require('./infra/gha/generate-tag.js');
      
      const result = await generateTag(
        { github, context },
        'api',
        github.event.inputs.major === 'true',
        github.event.inputs.minor === 'true',
        github.event.inputs.patch === 'true',
        github.event.inputs.prerelease === 'true'
      );
      
      core.setOutput('tag', result.tag);
      core.setOutput('version', result.version);
```
