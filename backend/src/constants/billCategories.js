// The 15 pre-printed lines on NeelKanth Mahadev Hospital's BILL/CASH pad, in
// the order they appear on paper. Every bill prints all of them whether or not
// they carry an amount, so the printout can be laid next to the pad and read
// the same way.
//
// `slug` is what gets stored on a bill item; the printed bill groups items by
// it. Renaming a slug orphans historical bills — add a new one instead.
//
// MIRRORED in frontend/src/lib/billCategories.js. This file is canonical; keep
// the two in step.
export const BILL_CATEGORIES = [
  {
    slug: "room",
    no: "1.",
    label: "Room Charges",
    // Rendered as unpriced text under the label, exactly as pre-printed.
    lines: ["Bed Charges"],
    // Amount comes from rate x days rather than being typed directly.
    perDay: true,
  },
  {
    slug: "investigation",
    no: "2.",
    label: "Investigation",
    // Priced sub-lines: the parent row carries no amount of its own, each
    // child is billed separately, and the pad's indentation is reproduced.
    children: [
      { slug: "investigation_pathology", label: "-Pathlogy" },
      { slug: "investigation_xray", label: "- X.ray Charges" },
      { slug: "investigation_ecg", label: "- E.C.G. Charges" },
    ],
  },
  { slug: "blood_transfusion", no: "3.", label: "Blood Transfusion Charges" },
  { slug: "iv_drip", no: "4.", label: "I/v Drip Charges" },
  { slug: "delivery", no: "5.", label: "Delivery Charges" },
  { slug: "operation", no: "6.", label: "Operation Fee" },
  { slug: "assistant", no: "7.", label: "Assistant Fee" },
  { slug: "anesthesia", no: "8.", label: "Anesthesia Fee" },
  { slug: "ot", no: "9.", label: "O. T. Charges" },
  { slug: "paediatrician", no: "10.", label: "Paediatrician Charges" },
  { slug: "nursing", no: "11.", label: "Nursing Charges" },
  { slug: "dressing", no: "12.", label: "Dressing Charges" },
  { slug: "po_care", no: "13.", label: "P. O. Care" },
  { slug: "doctor_call", no: "14.", label: "Doctor Call" },
  { slug: "misc", no: "15.", label: "Misc." },
];

// Flat list of every slug an item may be stored under — the parent slugs plus
// Investigation's three children. Used as the schema enum.
export const BILL_CATEGORY_SLUGS = BILL_CATEGORIES.flatMap((c) =>
  c.children ? c.children.map((child) => child.slug) : [c.slug]
);

// Catalog items and free-typed extras land here when nothing better applies.
export const DEFAULT_BILL_CATEGORY = "misc";
