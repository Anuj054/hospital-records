// JSZip is only needed by the admin backup page, so it loads on click the
// same way html2pdf.js does rather than riding along in the main bundle.
let modulePromise = null;

export function loadJSZip() {
  if (!modulePromise) {
    modulePromise = import("jszip")
      .then((m) => m.default)
      .catch((err) => {
        modulePromise = null; // let a later click retry after a failed chunk load
        throw err;
      });
  }
  return modulePromise;
}
