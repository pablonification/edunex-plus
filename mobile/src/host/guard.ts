// The QA builds' read-only guard (EXPO_PUBLIC_R3_GUARD=1, R3_GUARD in ./version.ts): a build run against a real
// Student's account reads Edunex, SIX and Microsoft and changes nothing there. Only reads (GET, HEAD,
// OPTIONS) and the sign-in's own calls reach them; a hand-in, a comment, Tandai Hadir, a KRS change,
// the questionnaire, a payment and signing out never do, whatever the method. The release Students
// get has the flag unset and none of this runs.
//
// One rule, two places: `blockedLine` for the engine's network (./transport.ts) and `guardScript`, the
// same rule as plain JavaScript for the pages the app opens in web views (form sends, fetch, XHR).
// test/mobile/guard.test.ts checks both give the same answers.
import { type HttpRequest, type HttpResponse, NetworkError, type Transport } from "../../../src/engine/http/transport";

/** Microsoft's sign-in pages: writes allowed (signing in), signing out not. */
const MICROSOFT_SIGN_IN = /(^|\.)microsoftonline\.com$|^login\.(live|microsoft|windows)\.(com|net)$/;
/** Everything else of Microsoft's: reads only. Edunex's file storage (*.blob.core.windows.net) too. */
const MICROSOFT = /(^|\.)(microsoft\.com|live\.com|msauth\.net|msftauth\.net|windows\.net|microsoftonline\.com)$/;
/** ITB's sign-in doors (Edunex's and ITB's own): writes allowed. */
const ITB_SIGN_IN = /^(sso-edunex|login)\.itb\.ac\.id$/;
const ITB = /(^|\.)itb\.ac\.id$/;
const SIX = /^six\.itb\.ac\.id$/;
/** Edunex's API (api-edunex.cognisia.id) and the rest of its vendor's hosts. */
const COGNISIA = /(^|\.)cognisia\.id$/;

/** Signing out, anywhere: never, so the Student's session stays theirs. */
const LOGOUT = /\/(log-?out|sign-?out|log-?off|end-?session)(\/|$)/;
/** Never, whatever the method: the questionnaire, and paying (UKT included). */
const NEVER = /\/(evaluasi\/)?kuesioner(\/|$)|questionnaire|\/(bayar|pembayaran|payment|payments|checkout|ukt)(\/|$)/;
/** SIX's class popup the engine reads for Tandai Hadir; anything further under a class's meeting is pressing it. */
const SIX_MEETING = /\/kelas\/pertemuan\//;
const SIX_MEETING_READ = /\/kelas\/pertemuan\/\d+\/mhs\/\d+$/;
const SIX_ATTENDANCE = /\/(hadir|tandai-?hadir|presensi|absen)(\/|$)/;
/** SIX's KRS: the pages the engine reads; anything else under /registrasi/ changes it. */
const SIX_REGISTRATION = /\/registrasi\//;
const SIX_REGISTRATION_READ = /\/registrasi\/(rencanastudi|ksm)\/\d+$/;
/** SIX's fees page is read; anything below it is paying. */
const SIX_FEES_BELOW = /\/keuangan\/./;
/** Sign-in paths that may write on SIX (/login/…) and Edunex's API (/login/…, /auth/…). */
const SIX_SIGN_IN_PATH = /^\/login(\/|$)/;
const COGNISIA_SIGN_IN_PATH = /^\/(login|auth)(\/|$)/;

const READS = /^(GET|HEAD|OPTIONS)$/;

/**
 * Whether the guard stops `method` to `url`: the log line's "<METHOD> <host><path>" (no query, no body) when it does,
 * null when it may go. Hosts other than Edunex's, SIX's, ITB's and Microsoft's are left alone.
 */
export function blockedLine(method: string, url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const verb = method.toUpperCase();
  const microsoft = MICROSOFT.test(host);
  const six = SIX.test(host);
  const itb = ITB.test(host);
  const cognisia = COGNISIA.test(host);
  if (!microsoft && !itb && !cognisia) return null;
  const path = parsed.pathname.toLowerCase();
  const line = `${verb} ${host}${parsed.pathname}`;
  if (LOGOUT.test(path) || NEVER.test(path)) return line;
  if (six) {
    if (SIX_MEETING.test(path) && !SIX_MEETING_READ.test(path)) return line;
    if (SIX_ATTENDANCE.test(path)) return line;
    if (SIX_REGISTRATION.test(path) && !SIX_REGISTRATION_READ.test(path)) return line;
    if (SIX_FEES_BELOW.test(path)) return line;
  }
  if (READS.test(verb)) return null;
  if (MICROSOFT_SIGN_IN.test(host) || ITB_SIGN_IN.test(host)) return null;
  if (six && SIX_SIGN_IN_PATH.test(path)) return null;
  if (cognisia && COGNISIA_SIGN_IN_PATH.test(path)) return null;
  return line;
}

/** The engine's network with the guard in front: a stopped request fails as a NetworkError, and says so on the log. */
export function guardedTransport(inner: Transport, log: (line: string) => void = console.warn): Transport {
  return {
    request(request: HttpRequest): Promise<HttpResponse> {
      const blocked = blockedLine(request.method, request.url);
      if (!blocked) return inner.request(request);
      log(`[guard] blocked ${blocked}`);
      return Promise.reject(new NetworkError("failed", `[guard] blocked ${blocked}`));
    },
  };
}

/** A regular expression as JavaScript source, for the web views' copy of the rule. */
const js = (pattern: RegExp) => pattern.toString();

/**
 * The guard inside a page the app opens, run before the page's own scripts: forms sent, fetch, XHR and beacons go
 * through `blockedLine`'s rule (the same expressions, as ES5). A stopped one fails as the network would, says
 * `[guard] blocked …` on the page's console, and posts `{ guard: "<METHOD> <host><path>" }` to the app.
 * The page's navigations are the web view's to stop (`onShouldStartLoadWithRequest` with `blockedLine`).
 */
export const guardScript = `(function(){
if (window.__edunexPlusGuard) return;
var blockedLine = function(method, url){
  var parsed; try { parsed = new URL(url, location.href); } catch (e) { return null; }
  var host = parsed.hostname.toLowerCase(), verb = String(method || "GET").toUpperCase();
  var microsoft = ${js(MICROSOFT)}.test(host), six = ${js(SIX)}.test(host), itb = ${js(ITB)}.test(host), cognisia = ${js(COGNISIA)}.test(host);
  if (!microsoft && !itb && !cognisia) return null;
  var path = parsed.pathname.toLowerCase(), line = verb + " " + host + parsed.pathname;
  if (${js(LOGOUT)}.test(path) || ${js(NEVER)}.test(path)) return line;
  if (six) {
    if (${js(SIX_MEETING)}.test(path) && !${js(SIX_MEETING_READ)}.test(path)) return line;
    if (${js(SIX_ATTENDANCE)}.test(path)) return line;
    if (${js(SIX_REGISTRATION)}.test(path) && !${js(SIX_REGISTRATION_READ)}.test(path)) return line;
    if (${js(SIX_FEES_BELOW)}.test(path)) return line;
  }
  if (${js(READS)}.test(verb)) return null;
  if (${js(MICROSOFT_SIGN_IN)}.test(host) || ${js(ITB_SIGN_IN)}.test(host)) return null;
  if (six && ${js(SIX_SIGN_IN_PATH)}.test(path)) return null;
  if (cognisia && ${js(COGNISIA_SIGN_IN_PATH)}.test(path)) return null;
  return line;
};
window.__edunexPlusGuard = blockedLine;
var say = function(line){
  try { console.warn("[guard] blocked " + line); } catch (e) {}
  try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ guard: line })); } catch (e) {}
};
var formLine = function(form, submitter){
  var method = (submitter && submitter.getAttribute && submitter.getAttribute("formmethod")) || form.getAttribute("method") || "GET";
  var action = (submitter && submitter.getAttribute && submitter.getAttribute("formaction")) || form.getAttribute("action") || location.href;
  return blockedLine(method, action);
};
document.addEventListener("submit", function(event){
  var line = formLine(event.target, event.submitter);
  if (line) { event.preventDefault(); event.stopImmediatePropagation(); say(line); }
}, true);
var submit = HTMLFormElement.prototype.submit;
HTMLFormElement.prototype.submit = function(){
  var line = formLine(this, null);
  if (line) { say(line); return; }
  return submit.apply(this, arguments);
};
if (window.fetch) {
  var fetch0 = window.fetch;
  window.fetch = function(input, init){
    var url = typeof input === "string" ? input : (input && input.url) || String(input);
    var method = (init && init.method) || (input && typeof input === "object" && input.method) || "GET";
    var line = blockedLine(method, url);
    if (line) { say(line); return Promise.reject(new TypeError("[guard] blocked " + line)); }
    return fetch0.apply(this, arguments);
  };
}
var open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function(method, url){
  this.__edunexPlusGuard = blockedLine(method, url);
  return open.apply(this, arguments);
};
XMLHttpRequest.prototype.send = function(){
  var line = this.__edunexPlusGuard, xhr = this;
  if (!line) return send.apply(this, arguments);
  say(line);
  setTimeout(function(){
    try { xhr.dispatchEvent(new Event("error")); xhr.dispatchEvent(new Event("loadend")); } catch (e) {}
  }, 0);
};
if (navigator.sendBeacon) {
  var beacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = function(url, data){
    var line = blockedLine("POST", url);
    if (line) { say(line); return false; }
    return beacon(url, data);
  };
}
})();true;`;

/** A web view's navigation (always a GET to the web view): false, and the log line, when the guard stops it. */
export function navigationAllowed(url: string, log: (line: string) => void = console.warn): boolean {
  const blocked = blockedLine("GET", url);
  if (blocked) log(`[guard] blocked ${blocked}`);
  return !blocked;
}

/** What a web view's page posted, when it's the guard saying it stopped something: its line on the app's log. */
export function guardMessage(data: string, log: (line: string) => void = console.warn): void {
  try {
    const said = JSON.parse(data) as { guard?: unknown };
    if (typeof said.guard === "string") log(`[guard] blocked ${said.guard}`);
  } catch {}
}
