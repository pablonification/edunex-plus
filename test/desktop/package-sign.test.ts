// The Mac app's signature (scripts/package-sign.mjs). Signed ad-hoc, each version is another app
// to macOS, so after every update the keychain asks the Student for their password before the app
// may open "Edunex Plus Safe Storage", the key their sign-in is locked with. Release builds are
// signed again with the project's own certificate, so every version is "id.edunexplus.desktop,
// signed by it" and the keychain lets it in. A test can't sign or open a keychain: these check
// the parts that decide what gets signed and how, and a real build checks what it signed itself.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import config from "../../electron-builder.config.mjs";
import { CERTIFICATE, DAYS, makeSigningCertificate } from "../../scripts/make-signing-cert.mjs";
import { afterSign, codesignArgs, keychainList, namesCertificate, signingIdentity, signingKeychain, signingOrder } from "../../scripts/package-sign.mjs";

// A made-up certificate's SHA-1.
const SHA1 = "C0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FF";
const KEYCHAIN = "/tmp/signing.keychain-db";

describe("the Mac app's signature", () => {
  it("stays electron-builder's ad-hoc one without a certificate: local builds, forks, and releases before the secrets are set", async () => {
    expect(config.mac).toMatchObject({ identity: "-", hardenedRuntime: false });
    expect(config.afterSign).toBe(afterSign);
    expect(signingKeychain({})).toBeNull();
    expect(signingKeychain({ MAC_SIGNING_KEYCHAIN: " " })).toBeNull();
    // The release workflow's keychain step is skipped there, so the build gets an empty value.
    vi.stubEnv("MAC_SIGNING_KEYCHAIN", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const context = { electronPlatformName: "darwin", appOutDir: "/nowhere", packager: { appInfo: { productFilename: "Edunex Plus", id: config.appId } } };
    await expect(afterSign(context)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("kept the ad-hoc signature"));
    log.mockRestore();
    vi.unstubAllEnvs();
  });

  it("is the project's certificate when the release workflow hands over its keychain", () => {
    expect(signingKeychain({ MAC_SIGNING_KEYCHAIN: KEYCHAIN })).toBe(KEYCHAIN);
  });

  it("is made with the one code-signing certificate in that keychain, which macOS doesn't trust and so doesn't list as valid", () => {
    const listed = `
Policy: Code Signing
  Matching identities
  1) ${SHA1} "Edunex Plus" (CSSMERR_TP_NOT_TRUSTED)
     1 identities found

  Valid identities only
     0 valid identities found
`;
    expect(signingIdentity(listed, KEYCHAIN)).toEqual({ hash: SHA1, name: "Edunex Plus" });
    // A certificate macOS trusts is listed twice, once in each part: still one.
    expect(signingIdentity(`  1) ${SHA1} "Edunex Plus"\n  1) ${SHA1} "Edunex Plus"\n`, KEYCHAIN).hash).toBe(SHA1);
  });

  it("stops the build when the keychain holds no certificate, or more than one", () => {
    expect(() => signingIdentity("     0 identities found\n", KEYCHAIN)).toThrow(`No code-signing certificate in ${KEYCHAIN}`);
    const two = `  1) ${SHA1} "Edunex Plus"\n  2) ${"AB".repeat(20)} "Someone else"\n`;
    expect(() => signingIdentity(two, KEYCHAIN)).toThrow("More than one code-signing certificate");
  });

  it("signs the code inside each bundle before the bundle, and the app last", () => {
    const app = "/release/mac-arm64/Edunex Plus.app";
    const inside = (file: string) => `${app}/Contents/${file}`;
    const code = [
      inside("Frameworks/Edunex Plus Helper.app"),
      inside("MacOS/Edunex Plus"),
      inside("Frameworks/Electron Framework.framework"),
      inside("Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt"),
      inside("Frameworks/Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib"),
      inside("Frameworks/Edunex Plus Helper.app/Contents/MacOS/Edunex Plus Helper"),
      inside("Frameworks/Squirrel.framework"),
      inside("Frameworks/Electron Framework.framework/Versions/A/Electron Framework"),
    ];
    const order = signingOrder(app, code);
    expect(order).toHaveLength(code.length + 1);
    expect(order.at(-1)).toBe(app);
    for (const bundle of order) {
      for (const file of order) if (file.startsWith(`${bundle}/`)) expect(order.indexOf(file), `${file} before ${bundle}`).toBeLessThan(order.indexOf(bundle));
    }
  });

  it("replaces only who signed each piece: its name, entitlements and flags stay as electron-builder made them", () => {
    const args = codesignArgs(SHA1, KEYCHAIN, "/app/Contents/MacOS/Edunex Plus");
    expect(args.slice(0, 5)).toEqual(["--sign", SHA1, "--keychain", KEYCHAIN, "--force"]);
    expect(args).toContain("--preserve-metadata=identifier,entitlements,flags");
    // No time-stamp server: the build needs nothing from Apple.
    expect(args).toContain("--timestamp=none");
    expect(args.at(-1)).toBe("/app/Contents/MacOS/Edunex Plus");
  });

  it("is checked to name the app and the certificate, the same in every release, not one build's bytes", () => {
    const named = (end: string) => `designated => identifier "id.edunexplus.desktop" and certificate ${end} = H"${SHA1.toLowerCase()}"`;
    expect(namesCertificate(named("root"), "id.edunexplus.desktop", SHA1)).toBe(true);
    expect(namesCertificate(`${named("leaf")}\n`, "id.edunexplus.desktop", SHA1)).toBe(true);
    // What an ad-hoc build says: it names that build only, so the next update is another app.
    expect(namesCertificate(`# designated => cdhash H"${"0f".repeat(20)}"`, "id.edunexplus.desktop", SHA1)).toBe(false);
    expect(namesCertificate(named("root"), "id.edunexplus.desktop.helper", SHA1)).toBe(false);
    expect(namesCertificate(named("root"), "id.edunexplus.desktop", "AB".repeat(20))).toBe(false);
  });

  it("puts the keychain where codesign looks only while signing, reading the list back as macOS prints it", () => {
    const listed = '    "/Users/runner/Library/Keychains/login.keychain-db"\n    "/Users/runner/Library/Keychains/My Keys.keychain-db"\n';
    expect(keychainList(listed)).toEqual(["/Users/runner/Library/Keychains/login.keychain-db", "/Users/runner/Library/Keychains/My Keys.keychain-db"]);
  });
});

const hasOpenssl = (() => {
  try {
    execFileSync("openssl", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("the certificate a maintainer makes (scripts/make-signing-cert.mjs)", () => {
  it("is for signing code only, good for ten years", () => {
    expect(CERTIFICATE).toContain("extendedKeyUsage = critical, codeSigning");
    expect(CERTIFICATE).toContain("basicConstraints = critical, CA:false");
    expect(CERTIFICATE).toContain("CN = Edunex Plus");
    expect(DAYS).toBe(3650);
  });

  it.skipIf(!hasOpenssl)("comes with its password and opens with it, and is never made over an existing one", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "signing-"));
    try {
      const sha1 = makeSigningCertificate(folder);
      expect(fs.readdirSync(folder).sort()).toEqual(["certificate.pem", "password.txt", "signing.p12", "signing.p12.base64"]);
      const p12 = fs.readFileSync(path.join(folder, "signing.p12"));
      expect(fs.readFileSync(path.join(folder, "signing.p12.base64"), "utf8")).toBe(p12.toString("base64"));
      const env = { ...process.env, SIGNING_PASSWORD: fs.readFileSync(path.join(folder, "password.txt"), "utf8") };
      const openssl = (args: string[], input?: Buffer) => execFileSync("openssl", args, { env, input, stdio: "pipe" });
      const certificate = openssl(["pkcs12", "-in", path.join(folder, "signing.p12"), "-nokeys", "-passin", "env:SIGNING_PASSWORD"]);
      const fingerprint = openssl(["x509", "-noout", "-fingerprint", "-sha1"], certificate).toString();
      expect(fingerprint.replaceAll(":", "").toUpperCase()).toContain(`=${sha1}`);
      expect(() => makeSigningCertificate(folder)).toThrow("already holds a certificate");
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});
