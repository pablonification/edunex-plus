// The phone app's build number (app.config.ts: Android's versionCode, the iPhone's buildNumber), worked out from the
// repository's version, so each release installs as newer than the one before: Android refuses to install an APK
// whose versionCode is lower than the installed one's. The in-app updater compares versions by name, not by this
// (src/host/apk-update.ts); this is what Android itself checks.
//
//   major × 10,000,000 + minor × 100,000 + patch × 1,000 + where the pre-release is
//
// where alpha.N is N, beta.N is 300 + N, rc.N is 600 + N (N up to 299 each), and the release itself 999: so
// 0.1.0-alpha.34 is 100034, 0.1.0-rc.2 is 100602, 0.1.0 is 100999, and 0.1.1-alpha.1 is 101001. A version it can't
// read throws rather than guess: a wrong number could make every later release refuse to install.

const STAGES = { alpha: 0, beta: 300, rc: 600 };
const RELEASE = 999;
const PER_STAGE = 300;
// Android's own ceiling for a versionCode.
const MOST = 2_100_000_000;

/** The build number for `version` (as package.json writes it). */
function buildNumber(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/.exec(version);
  if (!match) throw new Error(`Can't make a build number from version "${version}": it must be x.y.z, or x.y.z-alpha.N, -beta.N or -rc.N.`);
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  const [, , , , stage, n] = match;
  if (minor > 99 || patch > 99) throw new Error(`Can't make a build number from version "${version}": minor and patch go up to 99.`);
  if (stage && Number(n) >= PER_STAGE) throw new Error(`Can't make a build number from version "${version}": ${stage}.N goes up to ${PER_STAGE - 1}.`);
  const number = major * 10_000_000 + minor * 100_000 + patch * 1_000 + (stage ? STAGES[stage] + Number(n) : RELEASE);
  if (number > MOST) throw new Error(`Can't make a build number from version "${version}": ${number} is past Android's ${MOST}.`);
  return number;
}

module.exports = { buildNumber };
