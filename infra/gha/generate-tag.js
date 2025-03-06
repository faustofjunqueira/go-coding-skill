const { execSync } = require("child_process");

const TAG_TYPE = {
  MAJOR: 0b1000,
  MINOR: 0b0100,
  PATCH: 0b0010,
  PRE_RELEASE: 0b0001,
};

function execCommand(command) {
  try {
    console.log("command", command);
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
      version,
      semver: { semver, type, major, minor, patch, preRelease },
    };
  } catch (error) {
    throw new Error(`Failed to parse refName: ${error.message}`);
  }
}
function loadTagLists(namespace) {
  try {
    const tagPrefix = namespace + "/v*";
    const tags = execCommand(`git tag -l "${tagPrefix}"`, {
      encoding: "utf-8",
    }).split("\n");

    console.log("output", tags)

    if (tags.length === 0 || tags[0] === "") {
      return [];
    }

    return tags.map(parseRefName).filter((t) => t.namespace === namespace); // tem que ser do mesmo namespace
  } catch (error) {
    throw new Error(`Failed to fetch tags: ${error.message}`);
  }
}

function findPreviousTag(listTags, typeTag) {
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

async function generateTag(
  { github, context, core, glob },
  namespace,
  major,
  minor,
  patch,
  preRelease,
  tag
) {
  try {
    const listtag = loadTagLists(namespace);
    console.log(listtag);
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = generateTag;
