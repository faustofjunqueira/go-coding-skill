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
      semver: {
        semver,
        type,
        major: Number(major),
        minor: Number(minor),
        patch: Number(patch),
        preRelease: Number(preRelease),
      },
      version() {
        return `${this.namespace}/v${this.semver.major}.${this.semver.minor}.${
          this.semver.patch
        }${Number.isInteger(this.semver.preRelease) ? `-${this.semver.preRelease}` : ""}`;
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse refName: ${error.message}`);
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

function loadTagLists(namespace) {
  try {
    const tagPrefix = namespace + "/v*";
    const tags = execCommand(`git tag -l "${tagPrefix}"`, {
      encoding: "utf-8",
    }).split("\n");

    if (tags.length === 0 || tags[0] === "") {
      return [];
    }

    return tags.map(parseRefName).filter((t) => t.namespace === namespace); // tem que ser do mesmo namespace
  } catch (error) {
    throw new Error(`Failed to fetch tags: ${error.message}`);
  }
}

function findPreviousTag(namespace, listTags, filterTagBy) {
  try {
    if (listTags.length === 0) {
      return parseRefName(`refs/tags/${namespace}/v0.0.0`);
    }

    const semverTags = listTags
      .filter(filterTagByType(filterTagBy)) // filtra pelo tipo de tag (major, minor, patch, pre-release)
      .sort(compareTags); // ordena pela versao mais recente

    return semverTags.length > 0 ? semverTags[0] : null;
  } catch (error) {
    throw new Error(`Failed to find previous tag: ${error.message}`);
  }
}

function incrementsTag(previousTag, typeTag) {
  const newTag = { ...previousTag, type: typeTag };

  if (typeTag === TAG_TYPE.MAJOR) {
    console.log("MAJOR")
    newTag.semver.major += 1;
} else if (typeTag === TAG_TYPE.MINOR) {
      console.log("minor")
      newTag.semver.minor += 1;
    } else if (typeTag === TAG_TYPE.PATCH) {
      console.log("patch")
      newTag.semver.patch += 1;
    } else if (typeTag === TAG_TYPE.PRE_RELEASE) {
      console.log("rc")
      if (!newTag.semver.preRelease && newTag.semver.preRelease !== 0) {
        console.log("rc zerado")
        newTag.semver.preRelease = 0;
    } else {
        console.log("rc incrementado")
      newTag.semver.preRelease += 1;
    }
  }
  
  return newTag;
}

async function generateTag(
  namespace,
  major,
  minor,
  patch,
  preRelease,
  tag
) {
  try {
    // console.log(
    //     "namespace", namespace,
    //     "major", major,
    //     "minor", minor,
    //     "patch", patch,
    //     "preRelease", preRelease,
    // );

    let filterTagBy = 0;
    let typeTag = 0;
    if (preRelease) {
      filterTagBy = TAG_TYPE.MAJOR | TAG_TYPE.MINOR | TAG_TYPE.PRE_RELEASE;
      typeTag = TAG_TYPE.PRE_RELEASE;
    } else if (minor) {
      filterTagBy = TAG_TYPE.MAJOR | TAG_TYPE.MINOR;
      typeTag = TAG_TYPE.MINOR;
    } else if (major) {
      filterTagBy = TAG_TYPE.MAJOR | TAG_TYPE.MINOR;
      typeTag = TAG_TYPE.MAJOR;
    } else if (patch) {
        typeTag = TAG_TYPE.PATCH;
      filterTagBy = TAG_TYPE.MAJOR | TAG_TYPE.MINOR | TAG_TYPE.PRE_RELEASE;
    }

    console.log("type", typeTag)

    const listtag = loadTagLists(namespace);
    console.log("listtag", listtag.map((t) => t.version()))
    const previousTag = findPreviousTag(namespace, listtag, filterTagBy);
    console.log("previousTag", previousTag.version())
    const newTag = incrementsTag(previousTag, typeTag);
    console.log("newTag", newTag.version())
    return newTag.version();
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = generateTag;
