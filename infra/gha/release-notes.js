// inputs
// - tag criada <namespace>/v<semver>

function getVersionsFromTag(tag) {
    const [namespace, version] = tag.split('/')
    const [_, semver] = version.split('v')
    const [major, minor, patchWithPreRelease] = semver.split('.');
    const [patch, preRelease] = patchWithPreRelease.split('-');

    return {namespace, version, semver: {semver, major, minor, patch, preRelease}}
}

module.exports = ({github, context, core, glob}) => {
    console.log("ref", context.ref)
    console.log("ref_name", context.ref_name)
    
    console.log(getVersionsFromTag("namespace/v1.2.3"))
    console.log(getVersionsFromTag("namespace/v1.2.3-0"))
    console.log(getVersionsFromTag("namespace/v1.2.3-1"))

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
    return {github, context, core, glob}
}