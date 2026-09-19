// Vitest stand-in for the `server-only` package.
// The real module throws when imported outside a React Server bundle so that
// lib/server/** can never leak into client code. Under vitest there is no
// bundle, so we alias it to this empty module (see vitest.config.ts).
export {};
