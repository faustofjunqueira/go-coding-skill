const { execSync } = require("child_process");

const templateMD = `
## :anchor: Changelog for $$VERSION$$

$$CATEGORIES$$

---
:monocle_face: Comparing: [$$PREVIOUS_VERSIONS$$ .. $$VERSION$$](https://github.com/$$REPO_NAME$$/compare/$$PREVIOUS_VERSIONS$$..$$VERSION$$)
`;

const categoryTemplate = `
### $$CATEGORY_TITLE$$

$$LOGS$$
`;

const GLOBAL_SCOPE = "stncard-go";
const SHA_SIZE = 7;

const TAG_TYPE = {
  MAJOR: 0b1000,
  MINOR: 0b0100,
  PATCH: 0b0010,
  PRE_RELEASE: 0b0001,
};

const LOG_CATEGORY = {
  NONE: { key: "NONE", terms: [], title: "Others", icon: ":stop_sign:" },
  FIX: {
    key: "FIX",
    terms: ["fix", "bug", "hotfix"],
    title: "Fix",
    icon: ":bug:",
  },
  FEAT: {
    key: "FEAT",
    terms: ["feat", "feature"],
    title: "Feature",
    icon: ":rocket:",
  },
  BUILD: {
    key: "BUILD",
    terms: ["build"],
    title: "Build",
    icon: ":building_construction:",
  },
  CHORE: { key: "CHORE", terms: ["chore"], title: "Chore", icon: ":toolbox:" },
  CI: {
    key: "CI",
    terms: ["ci"],
    title: "Continous Integration",
    icon: ":dna:",
  },
  DOCS: {
    key: "DOCS",
    terms: ["docs"],
    title: "Documentation",
    icon: ":page_with_curl:",
  },
  STYLE: {
    key: "STYLE",
    terms: ["style"],
    title: "Style",
    icon: ":paintbrush:",
  },
  REFACTOR: {
    key: "REFACTOR",
    terms: ["refactor"],
    title: "Refactor",
    icon: ":toolbox:",
  },
  PERF: {
    key: "PERF",
    terms: ["perf"],
    title: "Performance",
    icon: ":fast_forward:",
  },
  TEST: { key: "TEST", terms: ["test"], title: "Test", icon: ":test_tube:" },
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
    return execCommand(`git rev-parse --short=${SHA_SIZE} ${refName}`);
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

function loadCommitLogs(repoName, previousTag, tag) {
  try {
    const prCommitRegex = /^([a-zA-Z]+)\(([a-zA-Z-]+)\): (.+)\(#([0-9]+)\)$/;

    const commitLogs = execCommand(
      `git log ${completeTagName(previousTag)}..${completeTagName(
        tag
      )} --pretty=format:"%s;%h;%an" | grep -E "\((${GLOBAL_SCOPE}|${
        tag.namespace
      })\)" -i`
    ).split("\n");

    const logs = commitLogs.map((l) => {
      const [fullMessage, sha, author] = l.split(";");

      let prNumber = 0;
      let convercionalTag = "";
      let message = fullMessage;
      let pr = null;
      let scope = tag.namespace;

      if (prCommitRegex.test(message)) {
        messageParsed = prCommitRegex.exec(message);
        convercionalTag = messageParsed[1];
        scope = messageParsed[2];
        message = messageParsed[3];
        pr = {
          number: messageParsed[4],
          link: `https://github.com/${repoName}/pull/${messageParsed[4]}`,
        };
      }

      let category = LOG_CATEGORY.NONE;

      for (const [key, cat] of Object.entries(LOG_CATEGORY)) {
        if (
          cat.terms.some((term) => fullMessage.toLowerCase().startsWith(term))
        ) {
          category = cat;
          continue;
        }
      }

      return {
        message: {
          raw: fullMessage,
          text: message,
          tag: convercionalTag,
          scope: scope,
          prNumber: prNumber,
        },
        pr: pr,
        sha: sha,
        author: {
          author,
          link: "@" + author,
        },
        category: category,
      };
    });

    return logs;
  } catch (error) {
    console.error(`Failed to fetch commit logs: ${error.message}`);
    return [];
  }
}

function categorizeLogs(logs) {
  try {
    const logsCategorized = {};

    logs
      .sort((a, b) => a.sha.localeCompare(b.sha))
      .forEach((log) => {
        if (!logsCategorized[log.category.key]) {
          logsCategorized[log.category.key] = [];
        }

        logsCategorized[log.category.key].push(log);
      });

    return logsCategorized;
  } catch (error) {
    throw new Error(`Failed to categorize logs: ${error.message}`);
  }
}

function writeTemplate(repoName, previousTag, tag, categorizeLogs) {
  try {
    const categories = Object.entries(categorizeLogs)
      .map(([categoryKey, logs]) => {
        if (logs.length === 0) {
          return "";
        }

        const category = LOG_CATEGORY[categoryKey];

        const logsTemplate = logs
          .map((log) => {
            let message = `- ${log.message.text} by ${log.author.link} \`<no-pull-request>\` :exclamation:`;
            if (log.pr) {
              message = `- \`${log.message.tag}\` ${log.message.text} by ${log.author.link} in [#${log.pr.number}](${log.pr.link})`;
            }

            if (log.message.scope == GLOBAL_SCOPE) {
              message += ` \`[monorepo]\``;
            }

            return message;
          })
          .join("\n");

        return categoryTemplate
          .replaceAll(
            "$$CATEGORY_TITLE$$",
            `${category.icon} ${category.title}`
          )
          .replaceAll("$$LOGS$$", logsTemplate);
      })
      .filter((f) => f !== "");

    return templateMD
      .replaceAll("$$VERSION$$", completeTagName(tag))
      .replaceAll("$$CATEGORIES$$", categories.join("\n"))
      .replaceAll("$$PREVIOUS_VERSIONS$$", completeTagName(previousTag))
      .replaceAll("$$REPO_NAME$$", repoName);
  } catch (error) {
    throw new Error(`Failed to write template: ${error.message}`);
  }
}

async function createsReleaseNotes({ github, context, core, glob }) {
  try {
    // const ref = context.ref;
    const repoName = [context.repo.owner, context.repo.repo].join("/");
    const ref = "refs/tags/namespace/v1.6.0";
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
    const logs = categorizeLogs(loadCommitLogs(repoName, previousTag, tag));

    const releaseNotes = writeTemplate(repoName, previousTag, tag, logs);

    // cria a release no github    
    const response = await github.rest.repos.createRelease({
      owner: context.repo.owner,
      repo: context.repo.repo,
      tag_name: completeTagName(tag),
      name: `${completeTagName(tag)}`,
      body: releaseNotes,
    });

    if (response.status != 201) {
      throw new Error(`Failed to create release: ${JSON.stringify(response)}`);
    }

    core.notice('Release created successfully: ' + response.data.html_url);
    // escreve a release no summary
    core.summary.addRaw(releaseNotes).write();

    // Primeira tag, não tem Previous tag, entao como fica?
    // sempre que criar um novo namespace, criar a tag <namespace>/v0.0.0
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = createsReleaseNotes;
