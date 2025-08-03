const { generateTag } = require('./generate-tag');

// Simple test runner without external dependencies
class SimpleTestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async run() {
        console.log('🧪 Running generate-tag tests...\n');

        for (const { name, testFn } of this.tests) {
            try {
                await testFn();
                console.log(`✅ ${name}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${name}`);
                console.log(`   Error: ${error.message}\n`);
                this.failed++;
            }
        }

        console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
        return this.failed === 0;
    }

    assertEqual(actual, expected, message = '') {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
        }
    }
}

// Mock GitHub API
function createMockGithub(tags) {
    return {
        rest: {
            repos: {
                listTags: async ({ page = 1 }) => {
                    const perPage = 100;
                    const startIndex = (page - 1) * perPage;
                    const endIndex = startIndex + perPage;
                    const paginatedTags = tags.slice(startIndex, endIndex);
                    
                    return { data: paginatedTags };
                }
            }
        }
    };
}

function createMockContext() {
    return {
        repo: {
            owner: 'test-owner',
            repo: 'test-repo'
        }
    };
}

// Tests
const runner = new SimpleTestRunner();

runner.test('Generate first major version with no existing tags', async () => {
    const github = createMockGithub([]);
    const context = createMockContext();

    const result = await generateTag(
        { github, context },
        'test-namespace',
        true, false, false, false
    );

    runner.assertEqual(result.tag, 'test-namespace/v1.0.0');
    runner.assertEqual(result.version, '1.0.0');
    runner.assertEqual(result.current, { major: 0, minor: 0, patch: 0, preRelease: null });
    runner.assertEqual(result.next, { major: 1, minor: 0, patch: 0, preRelease: null });
});

runner.test('Generate next patch version with existing tags', async () => {
    const existingTags = [
        { name: 'test-namespace/v1.0.0' },
        { name: 'test-namespace/v1.1.0' },
        { name: 'test-namespace/v1.2.0' }
    ];

    const github = createMockGithub(existingTags);
    const context = createMockContext();

    const result = await generateTag(
        { github, context },
        'test-namespace',
        false, false, true, false
    );

    runner.assertEqual(result.tag, 'test-namespace/v1.2.1');
    runner.assertEqual(result.version, '1.2.1');
    runner.assertEqual(result.current.major, 1);
    runner.assertEqual(result.current.minor, 2);
    runner.assertEqual(result.current.patch, 0);
    runner.assertEqual(result.next.major, 1);
    runner.assertEqual(result.next.minor, 2);
    runner.assertEqual(result.next.patch, 1);
});

runner.test('Generate pre-release version', async () => {
    const existingTags = [
        { name: 'test-namespace/v1.0.0' },
        { name: 'test-namespace/v2.0.0-0' }
    ];

    const github = createMockGithub(existingTags);
    const context = createMockContext();

    const result = await generateTag(
        { github, context },
        'test-namespace',
        false, false, false, true
    );

    runner.assertEqual(result.tag, 'test-namespace/v2.0.0-1');
    runner.assertEqual(result.version, '2.0.0-1');
    runner.assertEqual(result.current.major, 2);
    runner.assertEqual(result.current.minor, 0);
    runner.assertEqual(result.current.patch, 0);
    runner.assertEqual(result.current.preRelease, 0);
    runner.assertEqual(result.next.preRelease, 1);
});

runner.test('Filter by namespace correctly', async () => {
    const multiNamespaceTags = [
        { name: 'namespace-a/v1.0.0' },
        { name: 'namespace-b/v2.0.0' },
        { name: 'namespace-a/v1.1.0' },
        { name: 'namespace-c/v3.0.0' }
    ];

    const github = createMockGithub(multiNamespaceTags);
    const context = createMockContext();

    const result = await generateTag(
        { github, context },
        'namespace-a',
        false, true, false, false
    );

    runner.assertEqual(result.tag, 'namespace-a/v1.2.0');
    runner.assertEqual(result.current.major, 1);
    runner.assertEqual(result.current.minor, 1);
    runner.assertEqual(result.current.patch, 0);
});

runner.test('Handle pagination with many tags', async () => {
    // Create 150 tags to test pagination
    const manyTags = [];
    for (let i = 0; i < 150; i++) {
        manyTags.push({ name: `test-namespace/v1.0.${i}` });
    }

    const github = createMockGithub(manyTags);
    const context = createMockContext();

    const result = await generateTag(
        { github, context },
        'test-namespace',
        false, false, true, false
    );

    runner.assertEqual(result.tag, 'test-namespace/v1.0.150');
    runner.assertEqual(result.current.major, 1);
    runner.assertEqual(result.current.minor, 0);
    runner.assertEqual(result.current.patch, 149);
});

runner.test('Handle mixed tag formats (with and without v prefix)', async () => {
    const mixedTags = [
        { name: 'test-namespace/1.0.0' },
        { name: 'test-namespace/v1.1.0' },
        { name: 'test-namespace/v1.2.0' }
    ];

    const github = createMockGithub(mixedTags);
    const context = createMockContext();

    const result = await generateTag(
        { github, context },
        'test-namespace',
        false, false, true, false
    );

    runner.assertEqual(result.tag, 'test-namespace/v1.2.1');
    runner.assertEqual(result.current.major, 1);
    runner.assertEqual(result.current.minor, 2);
    runner.assertEqual(result.current.patch, 0);
});

// Run the tests
runner.run().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
});
