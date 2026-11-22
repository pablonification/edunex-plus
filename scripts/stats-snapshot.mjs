#!/usr/bin/env node
// A day's numbers about the app's reach (.github/workflows/stats.yml): every release's download
// counts, the repository's stars and forks, and GitHub's traffic (views, clones, where visitors
// came from, the pages they read). GitHub keeps traffic for 14 days and download counts only as
// running totals; a file a day keeps both. Only totals: nothing here is about a person.
//
//   node scripts/stats-snapshot.mjs <folder>
//
// GH_TOKEN reads the releases. TRAFFIC_TOKEN (a fine-grained token with Administration: Read on
// this repository) reads the traffic; without it, the file has no traffic.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const REPO = process.env.GITHUB_REPOSITORY ?? "pablonification/edunex-plus";
const folder = process.argv[2];
if (!folder) {
  console.error("usage: node scripts/stats-snapshot.mjs <folder>");
  process.exit(2);
}

async function api(route, token) {
  const response = await fetch(`https://api.github.com/repos/${REPO}${route}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "edunex-plus-stats",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`${route}: ${response.status} ${await response.text()}`);
  return response.json();
}

async function releases(token) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await api(`/releases?per_page=100&page=${page}`, token);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all
    .filter((release) => !release.draft)
    .map((release) => ({
      tag: release.tag_name,
      published: release.published_at,
      prerelease: release.prerelease,
      downloads: Object.fromEntries(release.assets.map((asset) => [asset.name, asset.download_count])),
    }));
}

async function traffic(token) {
  if (!token) return null;
  const [views, clones, referrers, paths] = await Promise.all([
    api("/traffic/views", token),
    api("/traffic/clones", token),
    api("/traffic/popular/referrers", token),
    api("/traffic/popular/paths", token),
  ]);
  const days = (list) => Object.fromEntries(list.map((one) => [one.timestamp.slice(0, 10), { count: one.count, uniques: one.uniques }]));
  return {
    views: days(views.views),
    clones: days(clones.clones),
    referrers: referrers.map(({ referrer, count, uniques }) => ({ referrer, count, uniques })),
    paths: paths.map(({ path, count, uniques }) => ({ path, count, uniques })),
  };
}

const releasesToken = process.env.GH_TOKEN;
const repo = await api("", releasesToken);
const snapshot = {
  at: new Date().toISOString(),
  repo: { stars: repo.stargazers_count, forks: repo.forks_count, watchers: repo.subscribers_count },
  releases: await releases(releasesToken),
  traffic: await traffic(process.env.TRAFFIC_TOKEN),
};
const file = path.join(folder, `${snapshot.at.slice(0, 10)}.json`);
await mkdir(folder, { recursive: true });
await writeFile(file, `${JSON.stringify(snapshot, null, 1)}\n`);
console.log(`${file}: ${snapshot.releases.length} releases${snapshot.traffic ? ", traffic" : ", no traffic (TRAFFIC_TOKEN not set)"}`);
