import { NeveRecorder } from "@mavenagi/apps-core-dev";
import { config } from "dotenv";
import { setupServer } from "msw/node";
import type { SetupServerApi } from "msw/node";
import { afterAll, afterEach, beforeEach, expect } from "vitest";

config({ path: ".env.local", override: true });

declare global {
  // eslint-disable-next-line no-var
  var mockServer: SetupServerApi;
}

global.mockServer = setupServer();
mockServer.listen({
  onUnhandledRequest: process.env.CI === "true" ? "error" : "bypass",
});

const neveRecorder = new NeveRecorder({
  expect: expect,
  server: mockServer,
});

beforeEach(() => {
  neveRecorder.start();
});

afterEach(() => {
  mockServer.resetHandlers();
});

afterAll(() => {
  global.mockServer.close();
  neveRecorder.stop();
});
