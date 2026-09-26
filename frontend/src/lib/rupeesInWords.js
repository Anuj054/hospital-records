// Fills the pad's "Total Rupees ....." line, which is written out in words so
// the figure in the amount column can't be altered after the fact.

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return (TENS[Math.floor(n / 10)] + " " + ONES[n % 10]).trim();
}

function threeDigits(n) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (hundred) parts.push(ONES[hundred], "Hundred");
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

// Indian grouping: crore, lakh, thousand, then the last three digits — not
// the Western thousand/million, which would read wrong on a rupee bill.
function wholeRupeesInWords(n) {
  if (n === 0) return "Zero";
  const groups = [
    [Math.floor(n / 10000000), "Crore"],
    [Math.floor(n / 100000) % 100, "Lakh"],
    [Math.floor(n / 1000) % 100, "Thousand"],
  ];
  const parts = [];
  for (const [value, name] of groups) {
    if (value) parts.push(twoDigits(value), name);
  }
  const last = n % 1000;
  if (last) parts.push(threeDigits(last));
  return parts.join(" ");
}

// "One Thousand Eight Hundred Thirty Four and Fifty Paise Only" — paise are
// named separately because the pad splits Rs. and P. into two columns.
export function rupeesInWords(amount) {
  const safe = Math.max(Number(amount) || 0, 0);
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  const words = wholeRupeesInWords(rupees);
  if (paise) return `${words} and ${twoDigits(paise)} Paise Only`;
  return `${words} Only`;
}
