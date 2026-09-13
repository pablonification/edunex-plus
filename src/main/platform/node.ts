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
    return fs.readFileSync(filePath, "utf8");
  },
  readBytes(filePath) {
    return fs.readFileSync(filePath);
  },
  writeText(filePath, contents) {
    fs.writeFileSync(filePath, contents);
  },
  writeBytes(filePath, contents) {
    fs.writeFileSync(filePath, contents);
  },
  exists(filePath) {
    return fs.existsSync(filePath);
  },
  remove(filePath) {
    fs.rmSync(filePath);
  },
  atomicWrite(filePath, contents, nonce = `${Date.now()}-${Math.random()}`) {
    const temporary = `${filePath}.${process.pid}.${nonce}.tmp`;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(temporary, contents);
      fs.renameSync(temporary, filePath);
    } catch (error) {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
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
  next: () => Math.random(),
};

const nativeFetch = (url: string, init: RequestInit) => fetch(url, init);

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
