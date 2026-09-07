// Runs in the page's MAIN world at document_start. Its only job is to advertise
// the extension's presence synchronously so the SDK can decide whether to show
// the "install the proctor" gate without waiting for an async round-trip.
//
// It deliberately exposes nothing callable — all real communication goes through
// window.postMessage, handled by content-script.js in the isolated world.
(() => {
  try {
    Object.defineProperty(window, "__PROCTOR_EXT__", {
      value: Object.freeze({ version: "0.1.0", vendor: "techspark" }),
      writable: false,
      configurable: false,
      enumerable: false,
    });
  } catch {
    window.__PROCTOR_EXT__ = { version: "0.1.0", vendor: "techspark" };
  }
})();
