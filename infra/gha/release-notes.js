const { execSync } = require("child_process");

const templateMD = `
## Changelog for $$VERSION$$

$$CATEGORIES$$

---
Previous versions: [$$PREVIOUS_VERSIONS$$](github.com/$$REPO_NAME$$/compare/namespace/$$PREVIOUS_SHA$$..$$TAG_SHA$$)
`;

const categoryTemplate = `
### $$CATEGORY_TITLE$$

$$LOGS$$
`;

const logTemplate = `- [$$HASH$$] $$MESSAGE$$ - $$AUTHOR$$`;

const GLOBAL_SCOPE = "stncard-go";
const SHA_SIZE = 7;

const TAG_TYPE = {
  MAJOR: 0b1000,
  MINOR: 0b0100,
  PATCH: 0b0010,
  PRE_RELEASE: 0b0001,
};

const LOG_CATEGORY = {
  "none": { key: "none", terms: [], title: "Others" },
  "fix": { key: "fix", terms: ["fix", "bug", "hotfix"], title: "Fix" },
  "feat": { key: "feat", terms: ["feat", "feature"], title: "Feature" },
  "build": { key: "build", terms: ["build"], title: "Build" },
  "chore": { key: "chore", terms: ["chore"], title: "Chore" },
  "ci": { key: "ci", terms: ["ci"], title: "Continous Integration" },
  "docs": { key: "docs", terms: ["docs"], title: "Documentation" },
  "style": { key: "style", terms: ["style"], title: "Style" },
  "refactor": { key: "refactor", terms: ["refactor"], title: "Refactor" },
  "perf": { key: "perf", terms: ["perf"], title: "Performance" },
  "test": { key: "test", terms: ["test"], title: "Test" },
};

function execCommand(command) {
  try {
    return execSync(command, { encoding: "utf-8" }).trim();
  } catch (error) {
    throw new Error(`Failed to execute command: ${error.message}`);
  }
}

function completeTagName(tag) {
  return `${tag.namespace}/${tag.version}`;
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
      version,
      SHA: getSHA(refName),
      semver: { semver, type, major, minor, patch, preRelease },
    };
  } catch (error) {
    throw new Error(`Failed to parse refName: ${error.message}`);
  }
}

function checkIfTagIsSemver(refName) {
  try {
    const semverRegex =
      /^([a-zA-Z0-9-_]+)\/v(\d+)\.(\d+)\.(\d+)(?:-([0-9]+))?$/;
    return semverRegex.test(refName);
  } catch (error) {
    throw new Error(`Failed to check if tag is semver: ${error.message}`);
  }
}

function getSHA(refName) {
  try {
    return execCommand(
      `git rev-parse --short=${SHA_SIZE} ${refName}`
    );
  } catch (error) {
    throw new Error(`Failed to fetch SHA: ${error.message}`);
  }
}

function loadTagLists(tag) {
  try {
    const tagPrefix = tag.namespace + "/v*";
    const tags = execCommand(`git tag -l "${tagPrefix}"`, {
      encoding: "utf-8",
    }).split("\n");

    if (tags.length === 0 || tags[0] === "") {
      return [];
    }

    return tags
      .map(parseRefName)
      .filter((t) => t.namespace === tag.namespace) // tem que ser do mesmo namespace
      .filter((t) => t.version !== tag.version); // remove a propria tag em questao;
  } catch (error) {
    throw new Error(`Failed to fetch tags: ${error.message}`);
  }
}

function compareTags(tagX, tagY) {
  if (tagX.semver.major !== tagY.semver.major) {
    return tagY.semver.major - tagX.semver.major;
  }
  if (tagX.semver.minor !== tagY.semver.minor) {
    return tagY.semver.minor - tagX.semver.minor;
  }
  if (tagY.semver.patch !== tagX.semver.patch) {
    return tagY.semver.patch - tagX.semver.patch;
  }
  return tagY.semver.preRelease - tagX.semver.preRelease;
}

function filterTagByType(typeCompator) {
  return (tag) => !!(tag.semver.type & typeCompator);
}

function findPreviousTag(listTags, tag) {
  try {
    let filterBy = TAG_TYPE.MAJOR | TAG_TYPE.MINOR;
    if (tag.semver.type === TAG_TYPE.PATCH) {
      filterBy = TAG_TYPE.PATCH;
    }

    const semverTags = listTags
      .filter(filterTagByType(filterBy)) // filtra pelo tipo de tag (major, minor, patch, pre-release)
      .sort(compareTags); // ordena pela versao mais recente

    return semverTags.length > 0 ? semverTags[0] : null;
  } catch (error) {
    throw new Error(`Failed to find previous tag: ${error.message}`);
  }
}

function loadCommitLogs(previousTag, tag) {
  try {
    const commitLogs = execCommand(
      `git log ${completeTagName(previousTag)}..${completeTagName(
        tag
      )} --pretty=format:"%s;%h;%an" | grep -E "\((${GLOBAL_SCOPE}|${
        tag.namespace
      })\)" -i`
    ).split("\n");

    const logs = commitLogs.map((l) => {
      const [message, hash, author] = l.split(";");
      
      for (const [key, cat] of Object.entries(LOG_CATEGORY)) {
        if (cat.terms.some((term) => message.toLowerCase().startsWith(term))) {
          return { message, hash, author, category: cat };
        }
      }

      return { message, hash, author, category: LOG_CATEGORY.NONE };
    });

    return logs;
  } catch (error) {
    console.error(`Failed to fetch commit logs: ${error.message}`);
    return [];
  }
}

function categorizeLogs(logs) {
  try {
    const logsCategorized = {
      [LOG_CATEGORY.NONE.key]: [],
      [LOG_CATEGORY.FIX.key]: [],
      [LOG_CATEGORY.FEAT.key]: [],
      [LOG_CATEGORY.BUILD.key]: [],
      [LOG_CATEGORY.CHORE.key]: [],
      [LOG_CATEGORY.CI.key]: [],
      [LOG_CATEGORY.DOCS.key]: [],
      [LOG_CATEGORY.STYLE.key]: [],
      [LOG_CATEGORY.REFACTOR.key]: [],
      [LOG_CATEGORY.PERF.key]: [],
      [LOG_CATEGORY.TEST.key]: [],
    };

    logs
      .sort((a, b) => a.hash.localeCompare(b.hash))
      .forEach((log) => {
        logsCategorized[log.category.key].push(log);
      });

    return logsCategorized;
  } catch (error) {
    throw new Error(`Failed to categorize logs: ${error.message}`);
  }
}

function writeTemplate(repoName, previousTag, tag, categorizeLogs) {
  try {
    
    Object.entries(categorizeLogs).forEach(([category, logs]) => {console.log(category, logs)});
    const categories = Object.entries(categorizeLogs)
      .map(([categoryKey, logs]) => {
        console.log(categoryKey, LOG_CATEGORY[categoryKey])
        if (logs.length === 0) {
          return "";
        }
        
        const category = LOG_CATEGORY[categoryKey];

        const logsTemplate = logs
          .map((log) => {
            return logTemplate
              .replace("$$HASH$$", log.hash)
              .replace("$$MESSAGE$$", log.message)
              .replace("$$AUTHOR$$", log.author);
          })
          .join("\n");

        return categoryTemplate
          .replace("$$CATEGORY_TITLE$$", category.title)
          .replace("$$LOGS$$", logsTemplate);
      })
      .filter((f) => f !== "");

    return templateMD
      .replace("$$VERSION$$", completeTagName(tag))
      .replace("$$CATEGORIES$$", categories.join("\n"))
      .replace("$$PREVIOUS_VERSIONS$$", completeTagName(previousTag))
      .replace("$$REPO_NAME$$", repoName.split("/")[0])
      .replace("$$PREVIOUS_SHA$$", previousTag.SHA)
      .replace("$$TAG_SHA$$", tag.SHA);
  } catch (error) {
    throw new Error(`Failed to write template: ${error.message}`);
  }
}

function createsReleaseNotes({ github, context, core, glob }) {
  try {
    // const ref = context.ref;
    const repoName = [context.repo.owner, context.repo.repo].join("/");
    const ref = "refs/tags/namespace/v1.5.0";
    const [, type, ...refsName] = ref.split("/");
    const refName = refsName.join("/");

    if (type == "heads") {
      throw new Error("This action only works with tags");
    }

    if (!checkIfTagIsSemver(refName)) {
      throw new Error("ref is not a valid semver tag");
    }

    const tag = parseRefName(refName);
    const listTags = loadTagLists(tag);
    const previousTag = findPreviousTag(listTags, tag);
    const logs = categorizeLogs(loadCommitLogs(previousTag, tag));

    const releaseNotes = writeTemplate(repoName, previousTag, tag, logs);
    core.summary.addRaw(releaseNotes).write();

    // Primeira tag, não tem Previous tag, entao como fica?
    // sempre que criar um novo namespace, criar a tag <namespace>/v0.0.0
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = createsReleaseNotes;
