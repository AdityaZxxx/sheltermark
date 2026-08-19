import { mock } from "bun:test";

// server-only throws outside Next's react-server condition. Vitest solved
// this with a resolve alias to an inert stub; bun:test has no config-level
// alias, so we stub the module in the registry before any test file loads.
mock.module("server-only", () => ({}));
