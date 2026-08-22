// Automated check for ISSUE-2 (dead computed) — no human or visible browser
// needed. Spawns the playground dev server, loads the 4-node/3-edge scene in
// HEADLESS Chrome (the bug requires real-browser scheduling; jsdom/node pass),
// counts rendered edges, and reports.
//
//   bun install          # once
//   node repro/check-dead-computed.mjs
//
// Exit 0 = bug reproduced (2 of 3 edges) — the expected result on this branch.
// Exit 1 = all 3 edges rendered (the bug did not reproduce — e.g. running on
//          the fixed `next` branch, or the framework fixed it).
// Exit 2 = environment problem (no Chrome found, server failed).
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const PORT = 3517;
const URL = `http://localhost:${PORT}/?example=StressTest&x=4&y=1`;

const findChrome = () => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ];
  return candidates.find((p) => existsSync(p));
};

const chrome = findChrome();
if (!chrome) {
  console.error("No Chrome/Chromium found. Set CHROME_PATH and re-run.");
  process.exit(2);
}

const server = spawn("node_modules/.bin/vite", ["--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
});
const stop = () => {
  try {
    server.kill();
  } catch {
    /* already gone */
  }
};
process.on("exit", stop);

// wait for the dev server
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try {
    await fetch(`http://localhost:${PORT}/`);
    up = true;
  } catch {
    await new Promise((r) => setTimeout(r, 250));
  }
}
if (!up) {
  console.error(`Dev server did not come up on :${PORT} (did you run bun install?).`);
  process.exit(2);
}

// two runs: warm the vite module graph, then measure
let count = -1;
for (let attempt = 0; attempt < 2; attempt++) {
  const { stdout } = await execFileP(
    chrome,
    ["--headless=new", "--disable-gpu", "--virtual-time-budget=6000", "--dump-dom", URL],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  count = (stdout.match(/class="solid-flow__edge /g) ?? []).length;
}

console.log(`rendered edges: ${count} of 3 expected`);
if (count === 2) {
  console.log(
    "BUG REPRODUCED: the first edge's projection derived while the node record",
  );
  console.log(
    "was committing beneath its reads, registered zero dependencies, and never re-ran.",
  );
  process.exit(0);
} else if (count === 3) {
  console.log("Bug did NOT reproduce (all edges rendered). On the fixed `next` branch this is expected.");
  process.exit(1);
} else {
  console.error(`Unexpected edge count ${count} — page may not have loaded; re-run or raise --virtual-time-budget.`);
  process.exit(2);
}
