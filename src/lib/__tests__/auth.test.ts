// @vitest-environment node
//
// jose v6's WebCrypto-based signing does an `instanceof Uint8Array` check
// internally that breaks under jsdom (Vitest's default environment for this
// project) due to a cross-realm identity mismatch. auth.ts has no DOM
// dependency, so running this file under the plain "node" environment
// sidesteps the issue without touching the project-wide jsdom default.
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

const setCookie = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: setCookie,
  })),
}));

import { createSession } from "@/lib/auth";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  setCookie.mockClear();
});

test("stores a signed JWT in the auth-token cookie", async () => {
  await createSession("user-123", "test@example.com");

  expect(setCookie).toHaveBeenCalledTimes(1);

  const [name, token] = setCookie.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(typeof token).toBe("string");

  // Should be a real, verifiable JWT signed with the app's secret.
  await expect(jwtVerify(token, JWT_SECRET)).resolves.toBeDefined();
});

test("encodes userId and email in the session payload", async () => {
  await createSession("user-123", "test@example.com");

  const [, token] = setCookie.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  expect(payload.userId).toBe("user-123");
  expect(payload.email).toBe("test@example.com");
});

test("sets an expiresAt roughly 7 days in the future", async () => {
  const before = Date.now();
  await createSession("user-123", "test@example.com");
  const after = Date.now();

  const [, token] = setCookie.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  const expiresAt = new Date(payload.expiresAt as string).getTime();
  expect(expiresAt).toBeGreaterThanOrEqual(before + SEVEN_DAYS_MS - 5000);
  expect(expiresAt).toBeLessThanOrEqual(after + SEVEN_DAYS_MS + 5000);
});

test("sets the cookie with secure, httpOnly options and a matching expiry", async () => {
  const before = Date.now();
  await createSession("user-123", "test@example.com");
  const after = Date.now();

  const [, , options] = setCookie.mock.calls[0];

  expect(options).toMatchObject({
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  expect(options.expires).toBeInstanceOf(Date);

  const expiresTime = (options.expires as Date).getTime();
  expect(expiresTime).toBeGreaterThanOrEqual(before + SEVEN_DAYS_MS - 5000);
  expect(expiresTime).toBeLessThanOrEqual(after + SEVEN_DAYS_MS + 5000);
});

test("marks the cookie secure only in production", async () => {
  const originalEnv = process.env.NODE_ENV;

  (process.env as any).NODE_ENV = "development";
  await createSession("user-123", "test@example.com");
  expect(setCookie.mock.calls[0][2].secure).toBe(false);

  setCookie.mockClear();

  (process.env as any).NODE_ENV = "production";
  await createSession("user-123", "test@example.com");
  expect(setCookie.mock.calls[0][2].secure).toBe(true);

  (process.env as any).NODE_ENV = originalEnv;
});
