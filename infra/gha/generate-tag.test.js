const { generateTag } = require('./generate-tag');

// Mock GitHub API responses
const createMockGithub = (tags) => ({
    rest: {
        repos: {
            listTags: jest.fn().mockImplementation(({ page = 1 }) => {
                const perPage = 100;
                const startIndex = (page - 1) * perPage;
                const endIndex = startIndex + perPage;
                const paginatedTags = tags.slice(startIndex, endIndex);
                
                return Promise.resolve({
                    data: paginatedTags
                });
            })
        }
    }
});

const createMockContext = () => ({
    repo: {
        owner: 'test-owner',
        repo: 'test-repo'
    }
});

describe('generateTag', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('with no existing tags', () => {
        it('should generate first major version', async () => {
            const github = createMockGithub([]);
            const context = createMockContext();

            const result = await generateTag(
                { github, context },
                'test-namespace',
                true, false, false, false
            );

            expect(result).toEqual({
                tag: 'test-namespace/v1.0.0',
                version: '1.0.0',
                current: { major: 0, minor: 0, patch: 0, preRelease: null },
                next: { major: 1, minor: 0, patch: 0, preRelease: null },
                previous: null,
                previousTag: null
            });
        });

        it('should generate first minor version', async () => {
            const github = createMockGithub([]);
            const context = createMockContext();

            const result = await generateTag(
                { github, context },
                'test-namespace',
                false, true, false, false
            );

            expect(result).toEqual({
                tag: 'test-namespace/v0.1.0',
                version: '0.1.0',
                current: { major: 0, minor: 0, patch: 0, preRelease: null },
                next: { major: 0, minor: 1, patch: 0, preRelease: null },
                previous: null,
                previousTag: null
            });
        });

        it('should generate first patch version', async () => {
            const github = createMockGithub([]);
            const context = createMockContext();

            const result = await generateTag(
                { github, context },
                'test-namespace',
                false, false, true, false
            );

            expect(result).toEqual({
                tag: 'test-namespace/v0.0.1',
                version: '0.0.1',
                current: { major: 0, minor: 0, patch: 0, preRelease: null },
                next: { major: 0, minor: 0, patch: 1, preRelease: null },
                previous: null,
                previousTag: null
            });
        });

        it('should generate first pre-release version', async () => {
            const github = createMockGithub([]);
            const context = createMockContext();

            const result = await generateTag(
                { github, context },
                'test-namespace',
                false, false, false, true
            );

            expect(result).toEqual({
                tag: 'test-namespace/v0.0.0-0',
                version: '0.0.0-0',
                current: { major: 0, minor: 0, patch: 0, preRelease: null },
                next: { major: 0, minor: 0, patch: 0, preRelease: 0 },
                previous: null,
                previousTag: null
            });
        });
    });

    describe('with existing tags', () => {
        const existingTags = [
            { name: 'test-namespace/v1.0.0' },
            { name: 'test-namespace/v1.1.0' },
            { name: 'test-namespace/v1.1.1' },
            { name: 'test-namespace/v1.2.0' },
            { name: 'test-namespace/v2.0.0-0' },
            { name: 'test-namespace/v2.0.0-1' },
            { name: 'test-namespace/v2.0.0' },
            { name: 'other-namespace/v1.0.0' } // Should be filtered out
        ];

        it('should generate next major version', async () => {
            const github = createMockGithub(existingTags);
            const context = createMockContext();

            const result = await generateTag(
                { github, context },
                'test-namespace',
                true, false, false, false
            );

            expect(result.tag).toBe('test-namespace/v3.0.0');
            expect(result.version).toBe('3.0.0');
            expect(result.current).toEqual({ major: 2, minor: 0, patch: 0, preRelease: null });
            expect(result.next).toEqual({ major: 3, minor: 0, patch: 0, preRelease: null });
            expect(result.previous).toEqual(expect.objectContaining({ major: 1 }));
            expect(result.previousTag).toMatch(/test-namespace\/v1\./);
        });

        it('should generate next minor version', async () => {
            const github = createMockGithub(existingTags);
            const context = createMockContext();

            const result = await generateTag(
                { github, context },
                'test-namespace',
                false, true, false, false
            );

            expect(result.tag).toBe('test-namespace/v2.1.0');
            expect(result.version).toBe('2.1.0');
            expect(result.current).toEqual({ major: 2, minor: 0, patch: 0, preRelease: null });
            expect(result.next).toEqual({ major: 2, minor: 1, patch: 0, preRelease: null });
        });

        it('should generate next patch version', async () => {
            const github = createMockGithub(existingTags);
            const context = createMockContext();

            const result = await generateTag(
                { github, context },
                'test-namespace',
                false, false, true, false
            );

            expect(result.tag).toBe('test-namespace/v2.0.1');
            expect(result.version).toBe('2.0.1');
            expect(result.current).toEqual({ major: 2, minor: 0, patch: 0, preRelease: null });
            expect(result.next).toEqual({ major: 2, minor: 0, patch: 1, preRelease: null });
        });

        it('should generate next pre-release version from stable', async () => {
            const github = createMockGithub(existingTags);
            const context = createMockContext();

            const result = await generateTag(
                { github, context },
                'test-namespace',
                false, false, false, true
            );

            expect(result.tag).toBe('test-namespace/v2.0.0-0');
            expect(result.version).toBe('2.0.0-0');
            expect(result.current).toEqual({ major: 2, minor: 0, patch: 0, preRelease: null });
            expect(result.next).toEqual({ major: 2, minor: 0, patch: 0, preRelease: 0 });
        });

        it('should increment pre-release version', async () => {
            const preReleaseTags = [
                { name: 'test-namespace/v1.0.0' },
                { name: 'test-namespace/v2.0.0-0' },
                { name: 'test-namespace/v2.0.0-1' }
            ];
            
            const github = createMockGithub(preReleaseTags);
            const context = createMockContext();

            const result = await generateTag(
                { github, context },
                'test-namespace',
                false, false, false, true
            );

            expect(result.tag).toBe('test-namespace/v2.0.0-2');
            expect(result.version).toBe('2.0.0-2');
            expect(result.current).toEqual({ major: 2, minor: 0, patch: 0, preRelease: 1 });
            expect(result.next).toEqual({ major: 2, minor: 0, patch: 0, preRelease: 2 });
        });
    });

    describe('with mixed tag formats', () => {
        it('should handle tags with and without v prefix', async () => {
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

            expect(result.tag).toBe('test-namespace/v1.2.1');
            expect(result.current).toEqual({ major: 1, minor: 2, patch: 0, preRelease: null });
        });

        it('should filter out invalid version tags', async () => {
            const invalidTags = [
                { name: 'test-namespace/v1.0.0' },
                { name: 'test-namespace/invalid-version' },
                { name: 'test-namespace/v1.1.0' },
                { name: 'test-namespace/not-semver' }
            ];

            const github = createMockGithub(invalidTags);
            const context = createMockContext();

            const result = await generateTag(
                { github, context },
                'test-namespace',
                false, false, true, false
            );

            expect(result.tag).toBe('test-namespace/v1.1.1');
            expect(result.current).toEqual({ major: 1, minor: 1, patch: 0, preRelease: null });
        });
    });

    describe('pagination handling', () => {
        it('should handle repositories with more than 100 tags', async () => {
            // Create 250 tags to test pagination
            const manyTags = [];
            for (let i = 0; i < 250; i++) {
                manyTags.push({ name: `test-namespace/v1.0.${i}` });
            }

            const github = createMockGithub(manyTags);
            const context = createMockContext();

            const result = await generateTag(
                { github, context },
                'test-namespace',
                false, false, true, false
            );

            // Should find the latest tag (v1.0.249) and increment patch
            expect(result.tag).toBe('test-namespace/v1.0.250');
            expect(result.current).toEqual({ major: 1, minor: 0, patch: 249, preRelease: null });
            
            // Verify that listTags was called multiple times for pagination
            expect(github.rest.repos.listTags).toHaveBeenCalledTimes(3); // 3 pages: 100 + 100 + 50
        });
    });

    describe('error handling', () => {
        it('should handle GitHub API errors', async () => {
            const github = {
                rest: {
                    repos: {
                        listTags: jest.fn().mockRejectedValue(new Error('API Error'))
                    }
                }
            };
            const context = createMockContext();

            await expect(generateTag(
                { github, context },
                'test-namespace',
                true, false, false, false
            )).rejects.toThrow('Failed to generate tag: API Error');
        });
    });

    describe('namespace filtering', () => {
        it('should only consider tags from the specified namespace', async () => {
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
                false, false, true, false
            );

            expect(result.tag).toBe('namespace-a/v1.1.1');
            expect(result.current).toEqual({ major: 1, minor: 1, patch: 0, preRelease: null });
        });
    });
});

// Integration test helper
describe('generateTag integration tests', () => {
    it('should work with real-world tag scenarios', async () => {
        const realWorldTags = [
            { name: 'api/v1.0.0' },
            { name: 'api/v1.0.1' },
            { name: 'api/v1.1.0' },
            { name: 'api/v2.0.0-0' },
            { name: 'api/v2.0.0-1' },
            { name: 'api/v2.0.0' },
            { name: 'worker/v1.0.0' },
            { name: 'worker/v1.1.0' }
        ];

        const github = createMockGithub(realWorldTags);
        const context = createMockContext();

        // Test API major bump
        const apiMajor = await generateTag(
            { github, context },
            'api',
            true, false, false, false
        );
        expect(apiMajor.tag).toBe('api/v3.0.0');

        // Test Worker minor bump
        const workerMinor = await generateTag(
            { github, context },
            'worker',
            false, true, false, false
        );
        expect(workerMinor.tag).toBe('worker/v1.2.0');
    });
});
