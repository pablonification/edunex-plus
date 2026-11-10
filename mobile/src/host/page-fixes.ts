// What ITB's pages need from the app's web views that a browser has and an iPhone app's web view doesn't.
//
// Service workers: iOS gives them only to Safari (and apps with "app-bound domains"), so an app's web view has no
// `navigator.serviceWorker`. Edunex's website starts Firebase's notifications as it loads, and Firebase calls
// `navigator.serviceWorker.addEventListener` without checking, so the whole page stops on its loading spinner, never
// saves its sign-in, and the app's sign-in waits forever. A stand-in that has nothing to offer lets the page start;
// Firebase then finds no push support and only logs it. Android's web view has service workers: the stand-in
// leaves a real one alone.

/** Runs before a page's own scripts: a do-nothing `navigator.serviceWorker` where the web view has none. */
export const noServiceWorkerScript = `(function(){
if (navigator.serviceWorker) return;
var none = function(){};
var serviceWorker = {
  controller: null,
  ready: new Promise(none),
  register: function(){ return Promise.reject(new Error("Service workers aren't available here")); },
  getRegistration: function(){ return Promise.resolve(undefined); },
  getRegistrations: function(){ return Promise.resolve([]); },
  startMessages: none,
  addEventListener: none,
  removeEventListener: none,
  dispatchEvent: function(){ return false; },
  oncontrollerchange: null,
  onmessage: null,
  onmessageerror: null
};
try { Object.defineProperty(navigator, "serviceWorker", { value: serviceWorker, configurable: true }); } catch (e) {}
})();true;`;
