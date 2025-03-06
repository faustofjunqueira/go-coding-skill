const { execSync } = require("child_process");

const GLOBAL_SCOPE = "stncard-go";

const TAG_TYPE = {
  MAJOR: 0b1000,
  MINOR: 0b0100,
  PATCH: 0b0010,
  PRE_RELEASE: 0b0001,
};
function completeTagName(tag) {
  return `${tag.namespace}/${tag.version}`;
}
function parseRefName(refName) {
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
}

function checkIfTagIsSemver(refName) {
  const semverRegex = /^([a-zA-Z0-9-_]+)\/v(\d+)\.(\d+)\.(\d+)(?:-([0-9]+))?$/;
  return semverRegex.test(refName);
}

function loadTagLists(tag) {
  try {
    const tagPrefix = tag.namespace + "/v*";
    const tags = execSync(`git tag -l "${tagPrefix}"`, { encoding: "utf-8" })
      .trim()
      .split("\n");

    if (tags.length === 0 || tags[0] === "") {
      return [];
    }

    return tags
      .map(parseRefName) 
      .filter(t => t.namespace === tag.namespace) // tem que ser do mesmo namespace
      .filter(t => t.version !== tag.version) // remove a propria tag em questao;

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
  let filterBy = TAG_TYPE.MAJOR | TAG_TYPE.MINOR;
  if (tag.semver.type === TAG_TYPE.PATCH) {
    filterBy = TAG_TYPE.PATCH;
  }

  const semverTags = listTags
    .filter(filterTagByType(filterBy)) // filtra pelo tipo de tag (major, minor, patch, pre-release)
    .sort(compareTags); // ordena pela versao mais recente

  return semverTags.length > 0 ? semverTags[0] : null;
}

function loadCommitLogs(previousTag, tag) {
  const commitLogs = execSync(
    `git log ${completeTagName(previousTag)}..${completeTagName(tag)} --pretty=format:"%h;(%an);%s" | grep -E "\((${GLOBAL_SCOPE}|${tag.namespace})\):" -i`
  );
  return commitLogs;
}

function createsReleaseNotes({ github, context, core, glob }) {
  try {
    // const ref = context.ref;
    const ref = "refs/tags/namespace/v1.3.0";
    const [, type, ...refsName] = ref.split("/");
    const refName = refsName.join("/");

    console.log(refName);

    if (type == "heads") {
      throw new Error("This action only works with tags");
    }

    if (!checkIfTagIsSemver(refName)) {
      throw new Error("ref is not a valid semver tag");
    }

    const tag = parseRefName(refName);
    const listTags = loadTagLists(tag);
    const previousTag = findPreviousTag(listTags, tag);
    const logs = loadCommitLogs(previousTag, tag);

    console.log("tag", tag);
    console.log("listTags", listTags);
    console.log("previousTag", previousTag);
    console.log("logs", logs);

    // Primeira tag, não tem Previous tag, entao como fica?
    // sempre que criar um novo namespace, criar a tag <namespace>/v0.0.0
    //

    // deve buscar TODOS os commits do mesmo scope
    // Se patch o PREVIOUS_TAG => Ultimo hotfix desse minor em questão
    // Se minor | major o PREVIOUS_TAG => Ultimo Minor gerado
    // Se prerelease o PREVIOUS_TAG => É a ultima hotfix ou minor gerada!
    // Criar uma sessão para Hotfixes, no caso de minor e major. Esses são todos os hotfixes gerados para minor anterior
    // Separa os logs por seção!
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = createsReleaseNotes;
