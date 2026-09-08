// html2pdf.js bundles html2canvas and jsPDF and is by far the largest thing
// in this app — around 900KB of the initial download. Almost no page needs
// it (login, dashboard, patient list, catalog, finance, staff), and the two
// that do only need it once someone clicks "Download PDF". Loading it on
// demand keeps it out of the first paint for everyone.
let modulePromise = null;

export function loadHtml2Pdf() {
  if (!modulePromise) {
    modulePromise = import("html2pdf.js")
      .then((m) => m.default)
      .catch((err) => {
        modulePromise = null; // let a later click retry after a failed chunk load
        throw err;
      });
  }
  return modulePromise;
}
