
async function generateTag({github, context}, namespace, major, minor, patch, preRelease) {
    try {
        const allTags = await fetchAllTags(github, context);
        const namespaceTags = filterAndParseNamespaceTags(allTags, namespace);
        const { currentVersion, previousVersion, previousTag } = findCurrentAndPreviousVersions(namespaceTags, major, minor, patch, preRelease);
        const nextVersion = calculateNextVersion(currentVersion, major, minor, patch, preRelease);
        const { newTag, versionString } = formatNewTag(namespace, nextVersion);
        
        return {
            tag: newTag,
            version: versionString,
            current: currentVersion,
            next: nextVersion,
            previous: previousVersion,
            previousTag: previousTag
        };

    } catch (error) {
        throw new Error(`Failed to generate tag: ${error.message}`);
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

function findCurrentAndPreviousVersions(namespaceTags, major, minor, patch, preRelease) {
    let currentVersion = { major: 0, minor: 0, patch: 0, preRelease: null };
    let previousVersion = null;
    let previousTag = null;
    
    if (namespaceTags.length > 0) {
        currentVersion = namespaceTags[namespaceTags.length - 1];
        previousVersion = findPreviousVersion(namespaceTags, currentVersion, major, minor, patch, preRelease);
        
        if (previousVersion) {
            previousTag = previousVersion.name;
        }
    }
    
    return { currentVersion, previousVersion, previousTag };
}

function findPreviousVersion(namespaceTags, currentVersion, major, minor, patch, preRelease) {
    if (major) {
        return findPreviousMajorVersion(namespaceTags, currentVersion);
    } else if (minor) {
        return findPreviousMinorVersion(namespaceTags, currentVersion);
    } else if (patch) {
        return findPreviousPatchVersion(namespaceTags, currentVersion);
    } else if (preRelease) {
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

function calculateNextVersion(currentVersion, major, minor, patch, preRelease) {
    let nextVersion = { ...currentVersion };
    
    if (major) {
        nextVersion.major = currentVersion.major + 1;
        nextVersion.minor = 0;
        nextVersion.patch = 0;
        nextVersion.preRelease = null;
    } else if (minor) {
        nextVersion.minor = currentVersion.minor + 1;
        nextVersion.patch = 0;
        nextVersion.preRelease = null;
    } else if (patch) {
        nextVersion.patch = currentVersion.patch + 1;
        nextVersion.preRelease = null;
    }

    // Handle pre-release
    if (preRelease) {
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

module.exports = { generateTag };