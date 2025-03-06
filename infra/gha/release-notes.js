const { execSync } = require("child_process");

const TAG_TYPE = {
  MAJOR: "major",
  MINOR: "minor",
  PATCH: "patch",
  PRE_RELEASE: "pre-release",
};

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

    return tags;
  } catch (error) {
    throw new Error(`Failed to fetch tags: ${error.message}`);
  }
}

function findPreviousTag(tag) {
  const listTags = loadTagLists(tag);
    console.log("==> ", listTags)

  if (preRelease) {
    // É a ultima hotfix ou minor gerada!
  } else if (patch === "0") {
    // Ultimo Minor gerado
  } else {
    // Ultimo hotfix desse minor em questão
  }
}

function createsReleaseNotes({ github, context, core, glob }) {
  try {
    // const ref = context.ref;
    const ref = "refs/tags/namespace/v1.2.3";
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
    const previousTag = findPreviousTag(tag);

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
