const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");
const { getGitHubToken, getGitHubOrg } = require("./config");

let octokitInstance = null;
let graphqlInstance = null;

function getOctokit() {
  const token = getGitHubToken();
  if (!token) {
    throw new Error(
      'GitHub token not configured. Run "gitter-done github config --token <token>" or set GITHUB_TOKEN env var.'
    );
  }

  if (!octokitInstance) {
    octokitInstance = new Octokit({ auth: token });
  }
  return octokitInstance;
}

function getGraphQL() {
  const token = getGitHubToken();
  if (!token) {
    throw new Error(
      'GitHub token not configured. Run "gitter-done github config --token <token>" or set GITHUB_TOKEN env var.'
    );
  }

  if (!graphqlInstance) {
    graphqlInstance = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });
  }
  return graphqlInstance;
}

function requireOrg() {
  const org = getGitHubOrg();
  if (!org) {
    throw new Error(
      'GitHub organization not configured. Run "gitter-done github config --org <org>".'
    );
  }
  return org;
}

// ==================== REST API Functions ====================

async function listRepos(org) {
  const octokit = getOctokit();
  const repos = await octokit.paginate(octokit.repos.listForOrg, {
    org,
    type: "all",
    per_page: 100,
  });
  return repos;
}

async function listMilestones(owner, repo) {
  const octokit = getOctokit();
  const { data } = await octokit.issues.listMilestones({
    owner,
    repo,
    state: "all",
  });
  return data;
}

async function createMilestone(owner, repo, { title, description, dueDate, state }) {
  const octokit = getOctokit();
  const params = {
    owner,
    repo,
    title,
  };

  if (description) params.description = description;
  if (dueDate) params.due_on = `${dueDate}T23:59:59Z`;
  if (state) params.state = state;

  const { data } = await octokit.issues.createMilestone(params);
  return data;
}

async function listIssues(owner, repo, options = {}) {
  const octokit = getOctokit();
  const { data } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: options.state || "open",
    per_page: 100,
  });
  return data.filter((issue) => !issue.pull_request);
}

async function createIssue(owner, repo, { title, body, labels, milestone, assignees }) {
  const octokit = getOctokit();
  const params = {
    owner,
    repo,
    title,
  };

  if (body) params.body = body;
  if (labels && labels.length) params.labels = labels;
  if (milestone) params.milestone = milestone;
  if (assignees && assignees.length) params.assignees = assignees;

  const { data } = await octokit.issues.create(params);
  return data;
}

async function updateIssue(owner, repo, issueNumber, updates) {
  const octokit = getOctokit();
  const { data } = await octokit.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    ...updates,
  });
  return data;
}

// ==================== GraphQL Functions (for Projects V2) ====================

async function getOrgId(org) {
  const gql = getGraphQL();
  const { organization } = await gql(`
    query($login: String!) {
      organization(login: $login) {
        id
        name
      }
    }
  `, { login: org });
  return organization;
}

async function listProjects(org) {
  const gql = getGraphQL();
  const { organization } = await gql(`
    query($login: String!) {
      organization(login: $login) {
        projectsV2(first: 50) {
          nodes {
            id
            title
            shortDescription
            url
            closed
            number
          }
        }
      }
    }
  `, { login: org });
  return organization.projectsV2.nodes;
}

async function getProject(org, projectNumber) {
  const gql = getGraphQL();
  const { organization } = await gql(`
    query($login: String!, $number: Int!) {
      organization(login: $login) {
        projectV2(number: $number) {
          id
          title
          shortDescription
          url
          closed
          number
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  title
                  number
                  state
                  repository {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  `, { login: org, number: projectNumber });
  return organization.projectV2;
}

async function createProject(org, { title, description }) {
  const gql = getGraphQL();
  
  // First get the org ID
  const { id: ownerId } = await getOrgId(org);
  
  const { createProjectV2 } = await gql(`
    mutation($ownerId: ID!, $title: String!) {
      createProjectV2(input: {
        ownerId: $ownerId
        title: $title
      }) {
        projectV2 {
          id
          title
          url
          number
        }
      }
    }
  `, { ownerId, title });

  const project = createProjectV2.projectV2;

  // Update description if provided
  if (description) {
    await gql(`
      mutation($projectId: ID!, $description: String!) {
        updateProjectV2(input: {
          projectId: $projectId
          shortDescription: $description
        }) {
          projectV2 {
            id
          }
        }
      }
    `, { projectId: project.id, description });
  }

  return project;
}

async function addIssueToProject(projectId, issueId) {
  const gql = getGraphQL();
  const { addProjectV2ItemById } = await gql(`
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {
        projectId: $projectId
        contentId: $contentId
      }) {
        item {
          id
        }
      }
    }
  `, { projectId, contentId: issueId });
  return addProjectV2ItemById.item;
}

async function getIssueNodeId(owner, repo, issueNumber) {
  const gql = getGraphQL();
  const { repository } = await gql(`
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
        }
      }
    }
  `, { owner, repo, number: issueNumber });
  return repository.issue.id;
}

module.exports = {
  getOctokit,
  getGraphQL,
  requireOrg,
  // REST
  listRepos,
  listMilestones,
  createMilestone,
  listIssues,
  createIssue,
  updateIssue,
  // GraphQL (Projects V2)
  getOrgId,
  listProjects,
  getProject,
  createProject,
  addIssueToProject,
  getIssueNodeId,
};
