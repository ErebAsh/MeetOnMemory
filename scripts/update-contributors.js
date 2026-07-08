import { readFile, writeFile } from "fs/promises";
const repository = process.env.GITHUB_REPOSITORY;
if (!repository) {
  throw new Error("GITHUB_REPOSITORY environment variable is missing.");
}
const [owner, repo] = repository.split("/");

async function fetchContributors() {
  const PER_PAGE = 100;
  const headers = {
    Accept: "application/vnd.github+json",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  let page = 1;
  const contributors = [];
  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=${PER_PAGE}&page=${page}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch contributors: ${response.status} ${response.statusText}`,
      );
    }
    const data = await response.json();
    contributors.push(...data);
    if (data.length < PER_PAGE) break;
    page++;
  }
  return contributors.filter((contributor) => contributor.type === "User");
}

function generateContributorHtml(contributors) {
  let html = "";
  for (const contributor of contributors) {
    html += `<a href="${contributor.html_url}">
            <img src="${contributor.avatar_url}" width="75" alt="${contributor.login}"/>
        </a>`;
  }
  return html;
}

async function updateReadme(html) {
  const readme = await readFile("README.md", "utf8");
  const START = "<!-- CONTRIBUTORS:START -->";
  const END = "<!-- CONTRIBUTORS:END -->";

  const startIndex = readme.indexOf(START);
  const endIndex = readme.indexOf(END);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Contributor markers not found in README.");
  }

  const updatedReadme =
    readme.slice(0, startIndex + START.length) +
    "\n\n" +
    html +
    "\n\n" +
    readme.slice(endIndex);

  await writeFile("README.md", updatedReadme, "utf8");
}

async function main() {
  const contributors = await fetchContributors();
  const html = generateContributorHtml(contributors);
  await updateReadme(html);
  console.log("README.md updated successfully.");
}

await main();
