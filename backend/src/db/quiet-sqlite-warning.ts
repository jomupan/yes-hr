/* Hide Node's one-off "SQLite is an experimental feature" warning (printed on
   Node 22/23 when node:sqlite loads). Must be imported before node:sqlite. */
const originalEmit = process.emitWarning;
process.emitWarning = function (warning: string | Error, ...rest: unknown[]) {
  const msg = typeof warning === "string" ? warning : warning?.message;
  if (msg && msg.includes("SQLite is an experimental feature")) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (originalEmit as any).call(process, warning, ...rest);
} as typeof process.emitWarning;

export {};
