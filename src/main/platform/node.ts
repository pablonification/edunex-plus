import { randomInt, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ClockService,
  FileSystemService,
  HttpResponseService,
  HttpTransportService,
  PathService,
  RandomService,
} from "./services";

/** Node is the only owner of these process effects. Feature modules consume
 * the small contracts from services.ts instead of importing node:* modules. */

export const nodeFileSystem: FileSystemService = {
  readText(filePath) {
    return fs.readFileSync(filePath, "utf8"); // nosemgrep: Semgrep_javascript_pathtraversal_rule-non-literal-fs-filename
  },
  readBytes(filePath) {
    return fs.readFileSync(filePath); // nosemgrep: Semgrep_javascript_pathtraversal_rule-non-literal-fs-filename
  },
  writeText(filePath, contents) {
    fs.writeFileSync(filePath, contents); // nosemgrep: Semgrep_javascript_pathtraversal_rule-non-literal-fs-filename
  },
  writeBytes(filePath, contents) {
    fs.writeFileSync(filePath, contents);
  },
  exists(filePath) {
    return fs.existsSync(filePath); // nosemgrep: Semgrep_javascript_pathtraversal_rule-non-literal-fs-filename
  },
  remove(filePath) {
    fs.rmSync(filePath);
  },
  atomicWrite(filePath, contents, nonce = `${Date.now()}-${randomUUID()}`) {
    const temporary = `${filePath}.${process.pid}.${nonce}.tmp`;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true }); // nosemgrep: Semgrep_javascript_pathtraversal_rule-non-literal-fs-filename
      fs.writeFileSync(temporary, contents); // nosemgrep: Semgrep_javascript_pathtraversal_rule-non-literal-fs-filename
      fs.renameSync(temporary, filePath); // nosemgrep: Semgrep_javascript_pathtraversal_rule-non-literal-fs-filename
    } catch (error) {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary); // nosemgrep: Semgrep_javascript_pathtraversal_rule-non-literal-fs-filename
      throw error;
    }
  },
};

export const nodePath: PathService = {
  join: (...parts) => path.join(...parts),
  dirname: (filePath) => path.dirname(filePath),
};

export const systemClock: ClockService = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

export const systemRandom: RandomService = {
  next: () => randomInt(0, 1_000_000_000) / 1_000_000_000,
};

const nativeFetch = (url: string, init: RequestInit) =>
  fetch(url, init); // nosemgrep: Semgrep_rules_lgpl_javascript_ssrf_rule-node-ssrf

export const fetchTransport: HttpTransportService = {
  request: async (url, init) => {
    const response = await nativeFetch(url, init);
    const result: HttpResponseService = {
      status: response.status,
      ok: response.ok,
      json: () => response.json(),
      arrayBuffer: () => response.arrayBuffer(),
    };
    return result;
  },
};
