const { execSync } = require("child_process");

const templateMD = `
<!-- auditing-block start -->
## Repositório Auditado

\`\`\`yml
descricao_da_mudanca: $$DESCRICAO$$ 
objetivo_da_mudanca: $$OBJETIVO$$
plano_de_rollback: $$ROLLBACK$$
plano_de_teste: $$TESTE$$
[opcional] link_do_card_no_jira: $$LINK_JIRA$$
[opcional] id_do_incidente_opsgenie: $$ID_OPSGENIE$$
\`\`\`
<!-- auditing-block end -->

## :anchor: Changelog for $$VERSION$$

$$CATEGORIES$$

---
$$FOOTER$$
`;

const categoryTemplate = `
### $$CATEGORY_TITLE$$

$$LOGS$$
`;

const hotfixSectionTemplate = `
### :fire: Hotfixes

$$HOTFIXES$$

---
`

const hotfixLineTemplate = `- [$$TAG$$]($$RELEASE_LINK$$)`

const GLOBAL_SCOPE = "stncard-go";

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
    console.log(command)
    return execSync(command, { encoding: "utf-8" }).trim();
  } catch (error) {
    throw new Error(`Failed to execute command: ${error.message}`);
  }
}

function loadCommitLogs(repoName, namespace, previousTag, tag) {
  try {
    if (previousTag == null) {
        return [];
    }

    const prCommitRegex = /^([a-zA-Z]+)\(([a-zA-Z-]+)\): (.+)\(#([0-9]+)\)$/;

    const commitLogs = execCommand(
      `git log ${previousTag}..${tag} --pretty=format:"%s;%h;%an" | grep -E "\((${GLOBAL_SCOPE}|${namespace})\)" -i`
    ).split("\n");

    console.log("Commit logs:\n", commitLogs.join("\n"))

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

      for (const [, cat] of Object.entries(LOG_CATEGORY)) {
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

function writeTemplate(repoName, previousTag, tag, categorizeLogs, hotfixes, description = "", objective = "", rollbackPlan = "", testPlan = "", jiraLink = "", opsgenieId = "") {
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

    let footer = "";
    if (previousTag) {
      footer = `:monocle_face: Compare: [${previousTag} .. ${tag}](https://github.com/${repoName}/compare/${previousTag}..${tag})`
    } else {
      footer = `:confetti_ball: :sparkles: First release! :sparkles: :confetti_ball:`;
    }

    if (hotfixes) {
        const hotfixesTemplate = hotfixes.split(",").map((tag) => {
            return hotfixLineTemplate
                .replaceAll("$$TAG$$", tag)
                .replaceAll("$$RELEASE_LINK$$", `https://github.com/${repoName}/releases/tag/${tag}`);
        }).join("\n");

        footer = hotfixSectionTemplate.replaceAll("$$HOTFIXES$$", hotfixesTemplate) + footer;
    }

    return templateMD
      .replaceAll("$$DESCRICAO$$", description)
      .replaceAll("$$OBJETIVO$$", objective)
      .replaceAll("$$ROLLBACK$$", rollbackPlan)
      .replaceAll("$$TESTE$$", testPlan)
      .replaceAll("$$LINK_JIRA$$", jiraLink)
      .replaceAll("$$ID_OPSGENIE$$", opsgenieId)
      .replaceAll("$$FOOTER$$", footer)
      .replaceAll("$$VERSION$$", tag)
      .replaceAll("$$CATEGORIES$$", categories.join("\n"))

  } catch (error) {
    throw new Error(`Failed to write template: ${error.message}`);
  }
}

async function sendReleaseNotes(github, context, core, releaseNotes, tag) {
    // Verifica se a release já existe
    const existingReleases = await github.rest.repos.listReleases({
      owner: context.repo.owner,
      repo: context.repo.repo,
    });

    const releaseExists = existingReleases.data.some(
      r => r.tag_name === tag
    );

    if (releaseExists) {
      core.notice(`Release for tag ${tag} already exists.`);
      return;
    }

    // cria a release no github
    const response = await github.rest.repos.createRelease({
      owner: context.repo.owner,
      repo: context.repo.repo,
      tag_name: tag,
      name: `${tag}`,
      body: releaseNotes,
    });

    if (response.status != 201) {
      throw new Error(`Failed to create release: ${JSON.stringify(response)}`);
    }

    core.notice('Release created successfully: ' + response.data.html_url);
}

async function createsReleaseNotes({ github, context, core }, previousTag, tag, description, objective, rollbackPlan, testPlan, jiraLink, opsgenieId, hotfixes) {
  try {
    const [namespace] = tag.split('/')
    const repoName = [context.repo.owner, context.repo.repo].join("/");
    const logs = categorizeLogs(loadCommitLogs(repoName, namespace, previousTag, tag));
    const releaseNotes = writeTemplate(repoName, previousTag, tag, logs, hotfixes, description, objective, rollbackPlan, testPlan, jiraLink, opsgenieId);
    await sendReleaseNotes(github, context, core, releaseNotes, tag);
    // escreve a release no summary
    core.summary.addRaw(releaseNotes).write();

    // Primeira tag, não tem Previous tag, entao como fica?
    // sempre que criar um novo namespace, criar a tag <namespace>/v0.0.0
  } catch (error) {
    console.log(error)
    core.setFailed(error.message);
  }
}

module.exports = createsReleaseNotes;

// createsReleaseNotes(
//     {
//         core: {
//         debug: console.log,
//         notice: console.log,
//         exportVariable: console.log,
//         setFailed: console.error,
//         summary: {
//             addRaw: (param) => {
//                 return { write: () => console.log(param)  };
//             },
//             write: console.log,
//         },
//         },
//         github: {
//             rest: {
//                 repos: {
//                     listReleases: () => ({
//                         data: [
//                         // { tag_name: "card-notification/v0.0.0" },
//                         // { tag_name: "card-notification/v0.0.1" },
//                         ],
//                     }),
//                     createRelease: () => ({
//                         status: 201,
//                         data: { html_url: "qualquerurl"},
//                     }),
//                 },
//             },
//         },
//         context: {
//             repo: {
//                 owner: "stone-payments",
//                 repo: "stncard-go",
//             },
//         },
//     },
//     null,
//     "card-notification/v0.0.0",
//     ""
// );
// createsReleaseNotes(
//     {
//         core: {
//         debug: console.log,
//         notice: console.log,
//         exportVariable: console.log,
//         setFailed: console.error,
//         summary: {
//             addRaw: (param) => {
//                 return { write: () => console.log(param)  };
//             },
//             write: console.log,
//         },
//         },
//         github: {
//             rest: {
//                 repos: {
//                     listReleases: () => ({
//                         data: [
//                         { tag_name: "card-webhook/v0.0.0" },
//                         { tag_name: "card-webhook/v0.0.1" },
//                         ],
//                     }),
//                     createRelease: () => ({
//                         status: 201,
//                         data: { html_url: "qualquerurl"},
//                     }),
//                 },
//             },
//         },
//         context: {
//             repo: {
//                 owner: "stone-payments",
//                 repo: "stncard-go",
//             },
//         },
//     },
//     "card-webhook/v1.0.0",
//     "card-webhook/v1.0.18",
//     "Description for card-webhook",
//     "Objective for card-webhook",
//     "Rollback plan for card-webhook",
//     "Test plan for card-webhook",
//     "https://jira.example.com/browse/CARD-123",
//     "OPS-456",  
//     "card-webhook/v1.0.1,card-webhook/v1.0.2,card-webhook/v1.0.3,card-webhook/v1.0.4,card-webhook/v1.0.5,card-webhook/v1.0.6,card-webhook/v1.0.7,card-webhook/v1.0.8,card-webhook/v1.0.10,card-webhook/v1.0.11,card-webhook/v1.0.12,card-webhook/v1.0.13,card-webhook/v1.0.14,card-webhook/v1.0.15,card-webhook/v1.0.16,card-webhook/v1.0.17,card-webhook/v1.0.18",
//   );
