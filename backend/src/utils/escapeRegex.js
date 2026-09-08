// Search boxes feed straight into a RegExp. Without escaping, a stray "("
// or "[" throws a SyntaxError (surfacing as a 500), and a crafted pattern
// like "(a+)+$" pins the CPU — on a shared Atlas tier that's everyone's CPU.
export function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
