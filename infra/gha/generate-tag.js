
async function generateTag({github, context}, namespace, bumpType) {
    try {
        // Validar que o tipo de bump seja válido
        validateBumpType(bumpType);
        
        const allTags = await fetchAllTags(github, context);
        const namespaceTags = filterAndParseNamespaceTags(allTags, namespace);
        const { currentVersion, previousVersion, previousTag, hotfixes } = findCurrentAndPreviousVersions(namespaceTags, bumpType);
        const nextVersion = calculateNextVersion(currentVersion, bumpType);
        const { newTag, versionString } = formatNewTag(namespace, nextVersion);
        const tagPRD = !isReleaseCandidate(nextVersion);
        
        return {
            tag: newTag,
            version: versionString,
            current: currentVersion,
            next: nextVersion,
            previous: previousVersion,
            previousTag: previousTag,
            hotfixes: hotfixes,
            tagPRD: tagPRD
        };

    } catch (error) {
        throw new Error(`Failed to generate tag: ${error.message}`);
    }
}

function validateBumpType(bumpType) {
    const validBumpTypes = ['major', 'minor', 'patch', 'rc'];
    
    if (!bumpType) {
        throw new Error('Bump type is required. Valid options: major, minor, patch, rc');
    }
    
    if (!validBumpTypes.includes(bumpType)) {
        throw new Error(`Invalid bump type: ${bumpType}. Valid options: ${validBumpTypes.join(', ')}`);
    }
}

async function fetchAllTags(github, context) {
    let allTags = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const { data: tags } = await github.rest.repos.listTags({
            owner: context.repo.owner,
            repo: context.repo.repo,
            per_page: 100,
            page: page
        });
        
        allTags = allTags.concat(tags);
        hasMore = tags.length === 100; // If we got 100 tags, there might be more
        page++;
    }
    
    return allTags;
}

function filterAndParseNamespaceTags(allTags, namespace) {
    return allTags
        .filter(tag => tag.name.startsWith(`${namespace}/`))
        .map(tag => {
            const tagVersion = tag.name.replace(`${namespace}/`, '');
            // Remove 'v' prefix if present
            const versionString = tagVersion.startsWith('v') ? tagVersion.slice(1) : tagVersion;
            return {
                name: tag.name,
                version: versionString,
                ...parseVersion(versionString)
            };
        })
        .filter(tag => tag.isValid)
        .sort((a, b) => compareVersions(a, b));
}

function findCurrentAndPreviousVersions(namespaceTags, bumpType) {
    let currentVersion = { major: 0, minor: 0, patch: 0, preRelease: null };
    let previousVersion = null;
    let previousTag = null;
    let hotfixes = "";
    
    if (namespaceTags.length > 0) {
        currentVersion = namespaceTags[namespaceTags.length - 1];
        previousVersion = findPreviousVersion(namespaceTags, currentVersion, bumpType);
        
        // Para minor bumps, encontrar hotfixes entre a versão minor anterior e atual
        if (bumpType === 'minor') {
            hotfixes = findHotfixesBetweenMinorVersions(namespaceTags, currentVersion);
        }
        
        if (previousVersion) {
            previousTag = previousVersion.name;
        }
    }
    
    return { currentVersion, previousVersion, previousTag, hotfixes };
}

function findPreviousVersion(namespaceTags, currentVersion, bumpType) {
    if (bumpType === 'major') {
        return findPreviousMajorVersion(namespaceTags, currentVersion);
    } else if (bumpType === 'minor') {
        return findPreviousMinorVersion(namespaceTags, currentVersion);
    } else if (bumpType === 'patch') {
        return findPreviousPatchVersion(namespaceTags, currentVersion);
    } else if (bumpType === 'rc') {
        return findPreviousPreReleaseVersion(namespaceTags, currentVersion);
    }
    return null;
}

function findPreviousMajorVersion(namespaceTags, currentVersion) {
    return namespaceTags
        .filter(tag => tag.major < currentVersion.major)
        .pop(); // Get the latest one with lower major version
}

function findPreviousMinorVersion(namespaceTags, currentVersion) {
    return namespaceTags
        .filter(tag => tag.major === currentVersion.major && tag.minor < currentVersion.minor)
        .pop(); // Get the latest one with same major but lower minor
}

function findPreviousPatchVersion(namespaceTags, currentVersion) {
    return namespaceTags
        .filter(tag => tag.major === currentVersion.major && 
                     tag.minor === currentVersion.minor && 
                     tag.patch < currentVersion.patch)
        .pop(); // Get the latest one with same major.minor but lower patch
}

function findPreviousPreReleaseVersion(namespaceTags, currentVersion) {
    if (currentVersion.preRelease !== null) {
        // Current is prerelease, find previous prerelease or stable
        return namespaceTags
            .filter(tag => {
                if (tag.major === currentVersion.major && 
                    tag.minor === currentVersion.minor && 
                    tag.patch === currentVersion.patch) {
                    return tag.preRelease < currentVersion.preRelease;
                }
                return tag.major < currentVersion.major || 
                       (tag.major === currentVersion.major && tag.minor < currentVersion.minor) ||
                       (tag.major === currentVersion.major && tag.minor === currentVersion.minor && tag.patch < currentVersion.patch);
            })
            .pop();
    } else {
        // Current is stable, find previous stable version
        return namespaceTags
            .filter(tag => tag.preRelease === null)
            .slice(-2, -1)[0]; // Get second to last stable version
    }
}

function findHotfixesBetweenMinorVersions(namespaceTags, currentVersion) {
    // Encontrar a versão minor anterior (mesmo major, minor - 1)
    const previousMinorVersion = namespaceTags
        .filter(tag => tag.major === currentVersion.major && tag.minor === currentVersion.minor - 1)
        .find(tag => tag.patch === 0 && tag.preRelease === null); // Versão base da minor anterior (x.y.0)
    
    if (!previousMinorVersion) {
        return ""; // Não há versão minor anterior
    }
    
    // Encontrar todos os patches (hotfixes) lançados após a versão base da minor anterior
    // até antes da versão minor atual
    const hotfixes = namespaceTags
        .filter(tag => {
            // Mesmo major.minor da versão anterior, mas com patch > 0
            return tag.major === previousMinorVersion.major && 
                   tag.minor === previousMinorVersion.minor && 
                   tag.patch > 0 && 
                   tag.preRelease === null; // Apenas versões estáveis
        })
        .map(tag => tag.version) // Apenas a string da versão
        .join(","); // Juntar com vírgulas
    
    return hotfixes;
}

function calculateNextVersion(currentVersion, bumpType) {
    let nextVersion = { ...currentVersion };
    
    if (bumpType === 'major') {
        nextVersion.major = currentVersion.major + 1;
        nextVersion.minor = 0;
        nextVersion.patch = 0;
        nextVersion.preRelease = null;
    } else if (bumpType === 'minor') {
        nextVersion.minor = currentVersion.minor + 1;
        nextVersion.patch = 0;
        nextVersion.preRelease = null;
    } else if (bumpType === 'patch') {
        nextVersion.patch = currentVersion.patch + 1;
        nextVersion.preRelease = null;
    }

    // Handle pre-release (rc)
    if (bumpType === 'rc') {
        if (currentVersion.preRelease !== null) {
            // Increment existing pre-release
            nextVersion.preRelease = currentVersion.preRelease + 1;
        } else {
            // Start new pre-release
            nextVersion.preRelease = 0;
        }
    }
    
    return nextVersion;
}

function formatNewTag(namespace, nextVersion) {
    let versionString = `${nextVersion.major}.${nextVersion.minor}.${nextVersion.patch}`;
    if (nextVersion.preRelease !== null) {
        versionString += `-${nextVersion.preRelease}`;
    }

    const newTag = `${namespace}/v${versionString}`;
    
    return { newTag, versionString };
}

function parseVersion(versionString) {
    // Parse semantic version string (e.g., "1.2.3" or "1.2.3-0")
    const regex = /^(\d+)\.(\d+)\.(\d+)(?:-(\d+))?$/;
    const match = versionString.match(regex);
    
    if (!match) {
        return { isValid: false };
    }

    return {
        isValid: true,
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        preRelease: match[4] ? parseInt(match[4], 10) : null
    };
}

function compareVersions(a, b) {
    // Compare major version
    if (a.major !== b.major) return a.major - b.major;
    // Compare minor version
    if (a.minor !== b.minor) return a.minor - b.minor;
    // Compare patch version
    if (a.patch !== b.patch) return a.patch - b.patch;
    
    // Handle pre-release versions
    if (a.preRelease === null && b.preRelease === null) return 0;
    if (a.preRelease === null) return 1; // Release version is higher than pre-release
    if (b.preRelease === null) return -1; // Pre-release is lower than release
    
    return a.preRelease - b.preRelease;
}

function isReleaseCandidate(version) {
    // Uma versão é considerada RC (Release Candidate) se tem preRelease (ex: v1.0.0-0, v2.1.0-1)
    return version.preRelease !== null;
}

module.exports = { generateTag };