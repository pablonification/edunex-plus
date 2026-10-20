// Makes the certificate release builds sign the Mac app with (scripts/package-sign.mjs): the
// project's own, made here, not bought from Apple. A maintainer runs it once:
//
//   node scripts/make-signing-cert.mjs [folder]   (default .scratch/mac-signing, which git ignores)
//
// It writes signing.p12 (the certificate and its private key, locked with a new random password),
// signing.p12.base64 (the same, as text) and password.txt, and prints how to hand them to the
// release workflow as the repository secrets MAC_SIGNING_P12 and MAC_SIGNING_PASSWORD. Then keep
// the folder somewhere safe, like a password manager, and never in the repository: every release
// must be signed with this same certificate, or each Student types their password once more after
// the next update; and whoever holds it can sign an app macOS takes for Edunex Plus.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** openssl's settings: a certificate for signing code only, named after the app. */
export const CERTIFICATE = `[req]
distinguished_name = name
x509_extensions = signing
prompt = no
[name]
CN = Edunex Plus
O = Edunex Plus contributors
[signing]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
subjectKeyIdentifier = hash
`;

/** How long it's good for. The app keeps working after; only new releases need a new one, and a new one asks every Student for their password once. */
export const DAYS = 3650;

/** Makes the certificate in `folder`; its SHA-1, as macOS names it. */
export function makeSigningCertificate(folder) {
  if (existsSync(path.join(folder, "signing.p12"))) {
    throw new Error(`${folder} already holds a certificate. Releases must keep using it: move it away first only to replace it on purpose.`);
  }
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const password = randomBytes(24).toString("base64url");
  // One command line, split at its spaces. The password reaches openssl in its environment, never on
  // its command line. No input at all: given an open one, OpenSSL 3 can't read back the key it wrote.
  const env = { ...process.env, SIGNING_PASSWORD: password };
  const openssl = (line, ...more) => execFileSync("openssl", [...line.split(" "), ...more], { cwd: folder, env, stdio: ["ignore", "pipe", "pipe"] }).toString();
  writeFileSync(path.join(folder, "openssl.cnf"), CERTIFICATE);
  try {
    openssl(`req -x509 -newkey rsa:3072 -sha256 -days ${DAYS} -config openssl.cnf -keyout key.pem -passout env:SIGNING_PASSWORD -out certificate.pem`);
    // Triple DES and SHA-1 inside the file: what every macOS's `security import` reads, whichever openssl made it.
    const locks = "-keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1";
    openssl(
      `pkcs12 -export -in certificate.pem -inkey key.pem -passin env:SIGNING_PASSWORD ${locks} -passout env:SIGNING_PASSWORD -out signing.p12`,
      "-name",
      "Edunex Plus",
    );
  } finally {
    for (const file of ["openssl.cnf", "key.pem"]) rmSync(path.join(folder, file), { force: true });
  }
  chmodSync(path.join(folder, "signing.p12"), 0o600);
  writeFileSync(path.join(folder, "signing.p12.base64"), readFileSync(path.join(folder, "signing.p12")).toString("base64"), { mode: 0o600 });
  writeFileSync(path.join(folder, "password.txt"), password, { mode: 0o600 });
  const fingerprint = openssl("x509 -in certificate.pem -noout -fingerprint -sha1");
  return fingerprint
    .slice(fingerprint.indexOf("=") + 1)
    .replaceAll(":", "")
    .trim()
    .toUpperCase();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const folder = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "..", ".scratch", "mac-signing"));
  try {
    const sha1 = makeSigningCertificate(folder);
    const repo = "pablonification/edunex-plus";
    console.log(`Made the signing certificate in ${folder} (SHA-1 ${sha1}).

Give it to the release workflow, signed in to gh as a maintainer:

  gh secret set MAC_SIGNING_P12 --repo ${repo} < "${path.join(folder, "signing.p12.base64")}"
  gh secret set MAC_SIGNING_PASSWORD --repo ${repo} < "${path.join(folder, "password.txt")}"

Then keep the folder somewhere safe (a password manager) and delete it here. From the next
release on, codesign -d -r- "/Applications/Edunex Plus.app" says
  designated => identifier "id.edunexplus.desktop" and certificate root = H"${sha1.toLowerCase()}"`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
