"use strict";

/**
 * Small end-to-end smoke for the shipped Electron composition.
 *
 * The controller launches two fresh Electron processes with one temporary
 * user-data directory. Each child loads the real dist/main/main.js and real
 * renderer bundle. The vendor HTTP transport and explicitly named desktop
 * test seams are replaced, so this can prove startup, session restore, IPC,
 * cache persistence, explicit commands, and graceful quit without requiring a
 * student's credentials.
 */

const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ACCOUNT_ID = "190136";
const ACCESS_TOKEN = "smoke-access-token";
const ANSWER_ID = "2644208";
const TASK_ID = "113986";
const FEED_PATHS = [
  "/todo",
  "/course/courses",
  "/exam/exams",
  "/course/agenda",
  "/course/presences/list",
  "/course/materials",
];

if (process.versions.electron) {
  void runElectronPhase();
} else {
  void runController();
}

async function runController() {
  const smokeRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "edunex-plus-electron-smoke-"),
  );

  try {
    for (const phase of ["online", "offline"]) {
      await launchPhase(phase, smokeRoot);
    }
    console.log(
      "electron smoke: online startup/IPC/download and offline restart/cache restore passed",
    );
  } catch (error) {
    console.error("electron smoke failed:", error);
    process.exitCode = 1;
  } finally {
    fs.rmSync(smokeRoot, { recursive: true, force: true });
  }
}

function launchPhase(phase, smokeRoot) {
  return new Promise((resolve, reject) => {
    const electronBinary = require("electron");
    const userDataDir = path.join(smokeRoot, "user-data");
    const childArgs = [
      "--no-sandbox",
      "--disable-gpu",
      `--user-data-dir=${userDataDir}`,
      __filename,
      "--phase",
      phase,
      "--smoke-root",
      smokeRoot,
    ];
    let command = electronBinary;
    let args = childArgs;

    if (process.platform === "linux" && !process.env.DISPLAY) {
      command = "xvfb-run";
      args = ["-a", "-s", "-screen 0 1280x900x24", electronBinary, ...childArgs];
    }

    const child = spawn(command, args, {
      env: {
        ...process.env,
        EDUNEX_SKIP_TEST_NOTIFICATION: "1",
      },
      stdio: "inherit",
    });
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`${phase} Electron phase timed out after 45 seconds`));
    }, 45_000);

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error.code === "ENOENT" && command === "xvfb-run") {
        reject(new Error("Electron smoke needs DISPLAY or xvfb-run on Linux"));
      } else {
        reject(error);
      }
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`${phase} Electron phase exited with ${code ?? signal}`));
    });
  });
}

async function runElectronPhase() {
  const electron = require("electron");
  const { app, BrowserWindow, dialog } = electron;
  const phase = argumentValue("--phase");
  const smokeRoot = argumentValue("--smoke-root");
  const userDataDir = path.join(smokeRoot, "user-data");
  const downloadPath = path.join(userDataDir, "smoke-material.pdf");
  const requests = [];

  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    app.setPath("userData", userDataDir);
    await app.whenReady();

    const safeStorage = installSmokeSafeStorage(electron);
    if (phase === "online") seedOnlineState(safeStorage.service, userDataDir);
    installSaveDialog(dialog, downloadPath);
    installFakeTransport(phase, requests);

    require(path.join(__dirname, "..", "dist", "main", "main.js"));
    const window = await waitForWindow(BrowserWindow);
    await waitForRenderer(window, phase);

    if (phase === "online") {
      await exerciseOnline(window, downloadPath);
    } else {
      await exerciseOffline(window);
    }

    verifyRequests(phase, requests, userAgentForVersion(app.getVersion()));
    fs.writeFileSync(
      path.join(smokeRoot, `requests-${phase}.json`),
      JSON.stringify({ phase, requests }, null, 2),
    );
    console.log(`electron smoke (${phase}, safeStorage=${safeStorage.mode}): app contract checks passed`);
    app.quit();
  } catch (error) {
    console.error(`electron smoke (${phase}) failed:`, error);
    if (requests.length > 0) {
      console.error("electron smoke request summary:", JSON.stringify(requests, null, 2));
    }
    app.exit(1);
  }
}

/**
 * Headless Linux images often have no Secret Service. Use a deterministic
 * AES-backed adapter only for this isolated smoke process in that case; the
 * production platform still refuses to persist tokens when native
 * safeStorage is unavailable. Set EDUNEX_SMOKE_REQUIRE_NATIVE_SAFE_STORAGE=1
 * when a target-platform run must exercise the native backend.
 */
function installSmokeSafeStorage(electron) {
  const native = electron.safeStorage;
  if (native.isEncryptionAvailable()) return { service: native, mode: "native" };
  if (process.env.EDUNEX_SMOKE_REQUIRE_NATIVE_SAFE_STORAGE === "1") {
    throw new Error("Electron safeStorage is unavailable in this environment");
  }

  const key = crypto.createHash("sha256").update("edunex-plus-electron-smoke-key").digest();
  const service = {
    isEncryptionAvailable: () => true,
    encryptString(plaintext) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return Buffer.concat([Buffer.from("edunex-smoke-v1\0"), iv, cipher.getAuthTag(), ciphertext]);
    },
    decryptString(ciphertext) {
      const blob = Buffer.from(ciphertext);
      const prefix = Buffer.from("edunex-smoke-v1\0");
      if (!blob.subarray(0, prefix.length).equals(prefix)) throw new Error("invalid smoke session");
      const ivStart = prefix.length;
      const iv = blob.subarray(ivStart, ivStart + 12);
      const tag = blob.subarray(ivStart + 12, ivStart + 28);
      const encrypted = blob.subarray(ivStart + 28);
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    },
  };

  try {
    Object.defineProperty(electron, "safeStorage", {
      configurable: true,
      value: service,
    });
    return { service, mode: "test-codec" };
  } catch {
    // Some Electron builds expose the module property as non-configurable,
    // while the service methods themselves remain replaceable.
    try {
      for (const [name, implementation] of Object.entries(service)) {
        Object.defineProperty(native, name, {
          configurable: true,
          writable: true,
          value: implementation,
        });
      }
      return { service: native, mode: "test-codec" };
    } catch {
      throw new Error("Electron safeStorage is unavailable and could not be replaced for smoke");
    }
  }
}

function seedOnlineState(safeStorage, userDataDir) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Electron safeStorage is unavailable in this environment");
  }

  const session = {
    accessToken: ACCESS_TOKEN,
    refreshToken: "smoke-refresh-token",
    expirationDate: "2069-01-01T00:00:00.000Z",
    verified: true,
    accounts: [{ id: ACCOUNT_ID }],
  };
  const sessionBlob = safeStorage.encryptString(JSON.stringify(session));
  fs.writeFileSync(path.join(userDataDir, "auth-session.enc"), sessionBlob);

  // A present-but-empty task ledger makes the first smoke sync an observable
  // notification event, while avoiding a real student's historical backlog.
  writeJson(path.join(userDataDir, "seen-ledger", ACCOUNT_ID, "seen-tasks.json"), {
    version: 1,
    accountId: ACCOUNT_ID,
    seenIds: [],
  });
}

function installSaveDialog(dialog, downloadPath) {
  const showSaveDialog = async () => ({ canceled: false, filePath: downloadPath });
  Object.defineProperty(dialog, "showSaveDialog", {
    configurable: true,
    value: showSaveDialog,
  });
}

function installFakeTransport(phase, requests) {
  global.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const parsed = new URL(url);
    const headers = new Headers(init.headers || {});
    const method = String(init.method || "GET").toUpperCase();
    const bodySummary = summarizeBody(parsed.pathname, method, init.body);
    requests.push({
      method,
      path: parsed.pathname,
      search: parsed.search,
      hasBearer: headers.get("Authorization") === `Bearer ${ACCESS_TOKEN}`,
      userAgent: headers.get("User-Agent"),
      body: bodySummary,
    });

    if (phase === "offline") throw new TypeError("simulated offline transport");
    return fakeResponseFor(parsed.pathname, method);
  };
}

function fakeResponseFor(pathname, method) {
  if (pathname === "/login/me") return jsonResponse({ id: ACCOUNT_ID });
  if (pathname === "/todo") return jsonResponse(todoFixture());
  if (pathname === "/course/courses") return jsonResponse(courseFixture());
  if (pathname === "/exam/exams") return jsonResponse([]);
  if (pathname === "/course/agenda") return jsonResponse([]);
  if (pathname === "/course/presences/list") return jsonResponse([]);
  if (pathname === "/course/materials") return jsonResponse(materialFixture());
  if (pathname === "/course/task/answers" && method === "POST") {
    return jsonResponse({ data: { id: ANSWER_ID } }, 201);
  }
  if (pathname === `/course/task/answers/${ANSWER_ID}` && method === "PATCH") {
    return jsonResponse({ data: { id: ANSWER_ID } });
  }
  if (pathname.startsWith("/blob-storage/")) {
    return bytesResponse(Buffer.from("edunex-plus-electron-smoke"));
  }
  return jsonResponse({ error: "No smoke fixture for this path" }, 404);
}

function summarizeBody(pathname, method, rawBody) {
  if (typeof rawBody !== "string" || method === "GET") return null;
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { parseable: false };
  }
  const attributes = body?.data?.attributes;
  if (pathname === "/course/task/answers" && method === "POST") {
    return {
      taskId: attributes?.task_id,
      isSent: attributes?.is_sent,
      hasFiles: Object.prototype.hasOwnProperty.call(attributes || {}, "files"),
    };
  }
  if (pathname.startsWith("/course/task/answers/") && method === "PATCH") {
    return {
      isSent: attributes?.is_sent,
      hasFiles: Object.prototype.hasOwnProperty.call(attributes || {}, "files"),
    };
  }
  return { parseable: true };
}

function todoFixture() {
  return {
    tasks: [
      {
        type: "task",
        code: "II4091",
        course: "Final Project Proposal",
        name: "Answer Tugas 01",
        time: "2100-09-14T23:59:00.000Z",
        id: Number(TASK_ID),
        answers: [{ id: Number(ANSWER_ID), answer: "", is_sent: 0 }],
      },
    ],
    exams: [],
    questions: [],
    modules: [],
  };
}

function courseFixture() {
  return [
    {
      type: "courses",
      id: "smoke-course",
      attributes: {
        code: "II4091",
        name: "Final Project Proposal",
        class_name: "II4091-01",
        period_id: 20261,
        period_year: "2026",
        period_type: "1",
        is_active: 1,
        is_enrolled: 1,
      },
    },
  ];
}

function materialFixture() {
  return [
    {
      id: 9001,
      name: "Week 05 — Slides",
      course_code: "II4091",
      course_name: "Final Project Proposal",
      file_name: "Week-05-Slides.pdf",
      file_url: "/blob-storage/materials/9001/Week-05-Slides.pdf",
      mime_type: "application/pdf",
      size: 245760,
    },
  ];
}

async function exerciseOnline(window, downloadPath) {
  const result = await execute(window, `
    (async () => {
      const todo = await window.edunex.getFeed("todo");
      const courses = await window.edunex.getFeed("courses");
      const materials = await window.edunex.getFeed("materials");
      const notifications = await window.edunex.getNotifications();
      const draft = await window.edunex.saveDraft({
        taskId: "${TASK_ID}",
        answer: "smoke draft",
        answerId: null,
      });
      const submitted = await window.edunex.submitAnswer({ answerId: "${ANSWER_ID}" });
      const download = await window.edunex.downloadMaterial({
        fileUrl: "/blob-storage/materials/9001/Week-05-Slides.pdf",
        fileName: "Week-05-Slides.pdf",
      });
      return { todo, courses, materials, notifications, draft, submitted, download };
    })()
  `);

  assert(result.todo?.data?.tasks?.length === 1, "online To Do feed was not cached");
  assert(result.courses?.data?.length === 1, "online course feed was not cached");
  assert(result.materials?.data?.length === 1, "online materials feed was not cached");
  assert(
    result.notifications?.some((entry) => entry.taskIds?.includes(TASK_ID)),
    "new Task notification was not persisted",
  );
  assert(result.draft?.ok === true && result.draft.answerId === ANSWER_ID, "draft IPC failed");
  assert(result.submitted?.ok === true && result.submitted.status === 200, "submit IPC failed");
  assert(result.download?.ok === true && result.download.filePath === downloadPath, "material IPC failed");
  assert(
    fs.readFileSync(downloadPath, "utf8") === "edunex-plus-electron-smoke",
    "material bytes were not saved",
  );
}

async function exerciseOffline(window) {
  const result = await execute(window, `
    (async () => ({
      auth: await window.edunex.getAuthState(),
      todo: await window.edunex.getFeed("todo"),
      materials: await window.edunex.getFeed("materials"),
      notifications: await window.edunex.getNotifications(),
    }))()
  `);

  assert(result.auth === "signed-in", "offline session restore did not remain signed-in");
  assert(result.todo?.data?.tasks?.length === 1, "offline To Do cache was not restored");
  assert(result.materials?.data?.length === 1, "offline materials cache was not restored");
  assert(
    result.notifications?.some((entry) => entry.taskIds?.includes(TASK_ID)),
    "offline notification history was not restored",
  );
}

function verifyRequests(phase, requests, expectedUserAgent) {
  if (phase === "online") {
    for (const expectedPath of ["/login/me", ...FEED_PATHS]) {
      assert(
        requests.some((request) => request.path === expectedPath),
        `online smoke did not call ${expectedPath}`,
      );
    }
    assert(
      requests.some((request) => request.path.startsWith("/blob-storage/")),
      "online smoke did not download the material bytes",
    );
    const apiRequests = requests.filter((request) => !request.path.startsWith("/blob-storage/"));
    assert(apiRequests.every((request) => request.hasBearer), "an API request missed the bearer header");
    assert(
      requests.every((request) => request.userAgent === expectedUserAgent),
      "a request missed the production User-Agent",
    );
    const create = requests.find(
      (request) => request.path === "/course/task/answers" && request.method === "POST",
    );
    assert(create?.body?.taskId === TASK_ID && create.body.isSent === 0, "draft wire contract changed");
    const submit = requests.find(
      (request) => request.path === `/course/task/answers/${ANSWER_ID}` && request.method === "PATCH",
    );
    assert(submit?.body?.isSent === 1, "submit wire contract changed");
  } else {
    assert(requests.some((request) => request.path === "/login/me"), "offline restore did not probe /login/me");
    assert(
      requests
        .filter((request) => request.path === "/login/me")
        .every((request) => request.userAgent === expectedUserAgent),
      "offline auth probe missed the production User-Agent",
    );
  }
}

function userAgentForVersion(version) {
  return `EdunexPlus/${version} (desktop client; +https://github.com/pablonification/edunex-plus)`;
}

async function waitForWindow(BrowserWindow) {
  return waitFor("BrowserWindow", () => {
    const windows = BrowserWindow.getAllWindows();
    return windows.find((candidate) => !candidate.isDestroyed()) || null;
  });
}

async function waitForRenderer(window, phase) {
  await waitFor("renderer auth state", async () => {
    try {
      return (await execute(window, "window.edunex.getAuthState()")) === "signed-in";
    } catch {
      return false;
    }
  });
  await waitFor(`${phase} cached To Do`, async () => {
    try {
      return await execute(
        window,
        `window.edunex.getFeed("todo").then((snapshot) => Boolean(snapshot?.data?.tasks?.length))`,
      );
    } catch {
      return false;
    }
  });
}

async function waitFor(description, predicate, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${description} did not become ready`);
}

function execute(window, script) {
  return window.webContents.executeJavaScript(script, true);
}

function jsonResponse(body, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    arrayBuffer: async () => bufferArrayBuffer(Buffer.from(JSON.stringify(body))),
  };
}

function bytesResponse(bytes, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      throw new Error("binary smoke response has no JSON body");
    },
    arrayBuffer: async () => bufferArrayBuffer(bytes),
  };
}

function bufferArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value));
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
