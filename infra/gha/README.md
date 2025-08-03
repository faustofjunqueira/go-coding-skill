# Generate Tag Function Tests

This directory contains comprehensive tests forconsole.log(result);
// {
//   tag: 'my-namespace/v2.0.0',
//   version: '2.0.0',
//   current: { major: 1, minor: 5, patch: 3, preRelease: null },
//   next: { major: 2, minor: 0, patch: 0, preRelease: null },
//   previous: { major: 0, minor: 9, patch: 0, preRelease: null },
//   previousTag: 'my-namespace/v0.9.0',
//   hotfixes: "", // String vazia para major/patch bumps
//   tagPRD: true  // true = Produção, false = Release Candidate
// }rate-tag.js` function that handles semantic version tag g### Casos de uso:
- **📝 Release Notes**: Incluir automaticamente todas as correções da versão anterior como string
- **📋 Changelog**: Listar hotfixes que serão "consolidados" na nova minor de forma concisa
- **🔗 Integração**: Fácil parsing da string de hotfixes separados por vírgula
- **📄 Documentação**: Formato simples e legível para documentos e logs

## Production Flag (tagPRD)

O campo `tagPRD` indica se a tag gerada é para **produção** (`true`) ou **Release Candidate** (`false`):

- **`tagPRD: true`** - Versões de produção (ex: `v1.2.0`, `v2.1.5`)
- **`tagPRD: false`** - Release Candidates (ex: `v1.2.0-0`, `v2.1.5-1`)

### Exemplo:
```javascript
// Versão de produção
{ tag: 'api/v1.2.0', tagPRD: true }

// Release Candidate
{ tag: 'api/v1.2.0-0', tagPRD: false }
```

## Input Validation

A função agora valida que **apenas um tipo de bump** seja selecionado por vez:

### ✅ **Válido:**
```javascript
generateTag({github, context}, 'namespace', true, false, false, false)   // ✅ Major
generateTag({github, context}, 'namespace', false, true, false, false)   // ✅ Minor
generateTag({github, context}, 'namespace', false, false, true, false)   // ✅ Patch
generateTag({github, context}, 'namespace', false, false, false, true)   // ✅ Pre-release
```

### ❌ **Inválido:**
```javascript
generateTag({github, context}, 'namespace', false, false, false, false)  // ❌ Nenhum selecionado
generateTag({github, context}, 'namespace', true, true, false, false)    // ❌ Major + Minor
generateTag({github, context}, 'namespace', true, false, true, true)     // ❌ Multiple selecionados
```

### Mensagens de erro:
- `"At least one bump type must be selected (major, minor, patch, or preRelease)"`
- `"Only one bump type can be selected at a time. Selected: major, minor"`tion for GitHub repositories.

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
- ✅ **Hotfix detection for minor bumps** (lists patches between previous and current minor version)
- ✅ **Production flag (tagPRD)** (false for Release Candidates, true for production releases)
- ✅ **Input validation** (ensures only one bump type is selected at a time)

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
//   previousTag: 'my-namespace/v0.9.0',
//   hotfixes: [] // Array vazio para major/patch bumps
// }

// Para minor bumps, hotfixes serão incluídos
const minorResult = await generateTag(
    { github, context },
    'my-namespace',
    false, true, false, false // minor bump
);

console.log(minorResult);
// {
//   tag: 'my-namespace/v1.6.0',
//   version: '1.6.0',
//   current: { major: 1, minor: 5, patch: 3, preRelease: null },
//   next: { major: 1, minor: 6, patch: 0, preRelease: null },
//   previous: { major: 1, minor: 4, patch: 0, preRelease: null },
//   previousTag: 'my-namespace/v1.4.0',
//   hotfixes: [
//     { tag: 'my-namespace/v1.4.1', version: '1.4.1', major: 1, minor: 4, patch: 1 },
//     { tag: 'my-namespace/v1.4.2', version: '1.4.2', major: 1, minor: 4, patch: 2 }
//   ]
// }
```

## Tag Format

The function expects and generates tags in the format: `<namespace>/v<semver>`

Examples:
- `api/v1.0.0`
- `worker/v2.1.5`
- `service/v1.0.0-0` (pre-release)

## Hotfix Detection for Minor Bumps

Quando um **minor bump** é solicitado, a função automaticamente detecta e lista todos os hotfixes (patches) que foram lançados entre a versão minor anterior e a versão atual.

### Como funciona:
- **Versão atual**: `namespace/v1.5.3`
- **Solicitação**: Minor bump (`minor: true`)
- **Próxima versão**: `namespace/v1.6.0`
- **Hotfixes detectados**: Todos os patches da versão `v1.4.x` (entre `v1.4.0` e antes de `v1.5.0`)

### Exemplo prático:
```javascript
// Histórico de tags existentes:
// namespace/v1.3.0
// namespace/v1.4.0  ← versão minor anterior
// namespace/v1.4.1  ← hotfix 1
// namespace/v1.4.2  ← hotfix 2
// namespace/v1.4.3  ← hotfix 3
// namespace/v1.5.0  ← versão minor atual

const result = await generateTag({github, context}, 'namespace', false, true, false, false);

// Resultado:
// {
//   tag: 'namespace/v1.6.0',
//   hotfixes: "1.4.1, 1.4.2, 1.4.3" // String com vírgulas
// }
```

### Casos de uso:
- **Release Notes**: Incluir automaticamente todas as correções da versão anterior
- **Changelog**: Listar hotfixes que serão "consolidados" na nova minor
- **Documentação**: Rastreamento de correções entre versões
- **Auditoria**: Visibilidade completa de patches aplicados

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
