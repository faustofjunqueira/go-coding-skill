const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TAG_TYPE = {
    MAJOR: 0b1000,
    MINOR: 0b0100,
    PATCH: 0b0010,
    PRE_RELEASE: 0b0001,
};

const TAG_TYPE_TXT = {
    [TAG_TYPE.MAJOR]: "MAJOR",
    [TAG_TYPE.MINOR]: "MINOR",
    [TAG_TYPE.PATCH]: "PATCH",
    [TAG_TYPE.PRE_RELEASE]: "PRE_RELEASE",
};

function execCommand(command) {
    try {
        return execSync(command, { encoding: "utf-8" }).trim();
    } catch (error) {
        throw new Error(`Failed to execute command: ${error.message}`);
    }
}

function parseRefName(refName) {
    try {
        const [namespace, version] = refName.split("/");
        const [_, semver] = version.split("v");
        const [major, minor, patchWithPreRelease] = semver.split(".");
        const [patch, preRelease] = patchWithPreRelease.split("-");

        let type;
        if (preRelease) {
            type = TAG_TYPE.PRE_RELEASE;
        } else if (minor === "0" && patch === "0") {
            type = TAG_TYPE.MAJOR;
        } else if (patch === "0") {
            type = TAG_TYPE.MINOR;
        } else {
            type = TAG_TYPE.PATCH;
        }

        return {
            namespace,
            semver: {
                semver,
                type,
                major: Number(major),
                minor: Number(minor),
                patch: Number(patch),
                preRelease: Number(preRelease),
            },
            version() {
                return `${this.namespace}/v${this.semver.major}.${
                    this.semver.minor
                }.${this.semver.patch}${
                    Number.isInteger(this.semver.preRelease)
                        ? `-${this.semver.preRelease}`
                        : ""
                }`;
            },
        };
    } catch (error) {
        throw new Error(`Failed to parse refName: ${error.message}`);
    }
}

function validateRef(ref) {
    try {
        if (!ref) {
            throw new Error("Ref is required");
        }

        if (!ref.startsWith("refs/tags/")) {
            throw new Error("Ref must be a tag");
        }

        const [, , namespace, semver] = ref.split("/");

        if (!namespace) {
            throw new Error("Namespace is required");
        }

        if (!semver) {
            throw new Error("Semver is required");
        }

        const semverRegex = /^v\d+\.\d+\.\d+(-\d+)?$/;
        if (!semverRegex.test(semver)) {
            throw new Error("Invalid semver format");
        }

        const internalPath = path.join(
            __dirname,
            "..",
            "..",
            "internal",
            namespace
        );
        if (
            !fs.existsSync(internalPath) ||
            !fs.lstatSync(internalPath).isDirectory()
        ) {
            throw new Error(`Invalid namespace ${namespace}`);
        }

        return `${namespace}/${semver}`;
    } catch (error) {
        throw new Error(`Failed to validate ref: ${error.message}`);
    }
}

function compareTags(order) {
    return (a, b) => {
        if (a.semver.major !== b.semver.major) {
            return order * (a.semver.major - b.semver.major);
        }

        if (a.semver.minor !== b.semver.minor) {
            return order * (a.semver.minor - b.semver.minor);
        }

        if (a.semver.patch !== b.semver.patch) {
            return order * (a.semver.patch - b.semver.patch);
        }

        if (a.semver.preRelease !== b.semver.preRelease) {
            return order * (a.semver.preRelease - b.semver.preRelease);
        }

        return 0;
    };
}

function filterTagByType(typeCompator) {
    return (tag) => !!(tag.semver.type & typeCompator);
}

function loadTagLists(namespace) {
    try {
        const tagPrefix = namespace + "/v*";
        const tags = execCommand(`git tag -l "${tagPrefix}"`, {
            encoding: "utf-8",
        }).split("\n");

        if (tags.length === 0 || tags[0] === "") {
            return [];
        }

        return tags
            .map(parseRefName)
            .filter((t) => t.namespace === namespace)
            .sort(compareTags(-1)); // tem que ser do mesmo namespace
    } catch (error) {
        throw new Error(`Failed to fetch tags: ${error.message}`);
    }
}

function findPreviousTag(core, listTags, parsedTag) {
    try {
        let filterTagBy = 0;
        switch (parsedTag.semver.type) {
            case TAG_TYPE.MAJOR:
                filterTagBy = TAG_TYPE.MAJOR | TAG_TYPE.MINOR;
                break;
            case TAG_TYPE.MINOR:
                filterTagBy = TAG_TYPE.MAJOR | TAG_TYPE.MINOR;
                break;
            case TAG_TYPE.PATCH:
                filterTagBy = TAG_TYPE.MAJOR | TAG_TYPE.MINOR | TAG_TYPE.PATCH;
                break;
            case TAG_TYPE.PRE_RELEASE:
                filterTagBy = TAG_TYPE.MAJOR | TAG_TYPE.MINOR | TAG_TYPE.PRE_RELEASE;
                break;
            default:
                throw new Error("Invalid tag type");
        }

        core.debug(`filterTagBy = 0b${filterTagBy.toString(2).padStart(4, "0")}`);

        const semverTags = listTags
            .filter(filterTagByType(filterTagBy)) // filtra pelo tipo de tag (major, minor, patch, pre-release)
            .sort(compareTags(-1)); // ordena pela versao mais recente

        core.debug(`tags = ${semverTags.map((t) => t.version()).join("\n          ")}`);

        for(let i = 0; i < semverTags.length; i++) {
            if (semverTags[i].version() === parsedTag.version()) {
                // se a tag atual for a tag que estamos procurando o anterior
                return semverTags[i + 1] || null;
            }
        }

        return null;
    } catch (error) {
        throw new Error(`Failed to find previous tag: ${error.message}`);
    }
}

function getHotfixTag(listTags, previousTag) {
    return listTags
        .filter(filterTagByType(TAG_TYPE.PATCH))
        .filter(
            (tag) =>
                tag.semver.major === previousTag.semver.major &&
                tag.semver.minor === previousTag.semver.minor
        )
        .sort(compareTags(1));
}

function buildOutput(tag, previousTag, hotfixes) {
    let tagVersion = null;
    let tagPrdSemver = false;
    let previousTagVersion = null;
    let shortTag = ""

    if (tag) {
        tagVersion = tag.version();
        tagPrdSemver = tag.semver.type != TAG_TYPE.PRE_RELEASE;
        shortTag = tag.version().split("/")[1]
    }

    if (previousTag) {
        previousTagVersion = previousTag.version();
    }

    return JSON.stringify({
        tagPrdSemver,
        tag: tagVersion,
        shortTag: shortTag,
        previousTag: previousTagVersion,
        hotfixes,
    });
}

function calculatePreviousTag({ core, context }) {
    try {
        const { ref } = context;

        if (ref.startsWith("refs/heads/")) {
            return buildOutput(null, null, null);
        }

        const refName = validateRef(ref);
        const parsedTag = parseRefName(refName);

        core.debug(`namespace = ${parsedTag.namespace}`);
        core.debug(`typeTag = 0b${parsedTag.semver.type.toString(2).padStart(4, "0")}(${TAG_TYPE_TXT[parsedTag.semver.type]})`);

        let previousTag = null;
        let hotfixTagListStr = "";

        const listtag = loadTagLists(parsedTag.namespace);
        if (listtag.length > 0) {
            previousTag = findPreviousTag(core, listtag, parsedTag);
            if (previousTag) {
                core.debug(`previousTag = ${previousTag.version()}`);
                if (parsedTag.semver.type === TAG_TYPE.MINOR) {
                    const hotfixTagList = getHotfixTag(listtag, previousTag);
                    hotfixTagListStr = hotfixTagList
                        .map((t) => t.version())
                        .join(",");
                    core.debug(`hotfixTagList = ${hotfixTagListStr}`);
                }
            }

        }

        core.notice(
            `previous tag: ${
                previousTag ? previousTag.version() : "null"
            } and tag: ${parsedTag.version()}.`
        );

        return buildOutput(parsedTag, previousTag, hotfixTagListStr);
    } catch (error) {
        console.error(error)
        core.setFailed(error.message);
    }
}

module.exports = calculatePreviousTag;

// calculatePreviousTag({
//     core: {
//         debug: console.log,
//         notice: console.log,
//         exportVariable: console.log,
//         setFailed: console.error,
//     },
//     context: { ref: "refs/tags/card-webhook/v1.1.0" },
// });
