// inputs
// - tag criada <namespace>/v<semver>

function parseRefName(refName) {
  const [namespace, version] = refName.split("/");
  const [_, semver] = version.split("v");
  const [major, minor, patchWithPreRelease] = semver.split(".");
  const [patch, preRelease] = patchWithPreRelease.split("-");

  return {
    namespace,
    version,
    semver: { semver, major, minor, patch, preRelease },
  };
}

function checkIfTagIsSemver(refName) {
  const semverRegex = /^([a-zA-Z0-9-_]+)\/v(\d+)\.(\d+)\.(\d+)(?:-([0-9]+))?$/;
  return semverRegex.test(tag);
}

function createsReleaseNotes({ github, context, core, glob }) {
  try {
    // const ref = context.ref;
    const ref = "refs/tags/namespace/v1.2.3";
    const [, type, ...refsName] = ref.split("/");
    const refName = refsName.join("/");

    console.log(refName);

    if (type == 'heads') {
        throw new Error('This action only works with tags');
    }

    if (!checkIfTagIsSemver(refName)) {
      throw new Error("ref is not a valid semver tag");
    }

    const tag = parseRefName(refName);

    console.log(tag)

    // Verifica a tag
    // Verifica se major, minor, patch ou pre-release
    // se minor: a tag X.X.0 se termina com zero é minor
    // se patch: a tag X.X.X se termina com numero é patch
    // se major: a tag X.0.0 se termina com zero é major
    // se pre-release: a tag X.X.X-<pre-release> se termina com pre-release é pre-release

    // se for pre-release, não cria changelog
    // deve buscar TODOS os commits do mesmo scope
    // Se patch o PREVIOUS_TAG => Ultimo hotfix desse minor em questão
    // Se minor | major o PREVIOUS_TAG => Ultimo Minor gerado
    // Se prerelease o PREVIOUS_TAG => É a ultima hotfix ou minor gerada!
    // Criar uma sessão para Hotfixes, no caso de minor e major. Esses são todos os hotfixes gerados para minor anterior
    // Separa os logs por seção!
  } catch (error) {
    core.setFailed(error.message);
  }
};

module.exports = createsReleaseNotes;
