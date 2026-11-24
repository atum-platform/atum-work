import { afterEach, expect, it, vi } from "vite-plus/test";
import { assertionOwner, atumConnectIdentity } from "./connectIdentity";

afterEach(() => vi.unstubAllGlobals());

it("passes the host assertion unchanged without a Clerk identity", async () => {
  vi.stubGlobal("window", { atumWork: { getConnectAssertion: async () => "host.assertion.token" } });
  await expect(atumConnectIdentity.getAssertion()).resolves.toBe("host.assertion.token");
});

it("requires host sign-in and rejects an empty host response", async () => {
  vi.stubGlobal("window", {});
  await expect(atumConnectIdentity.getAssertion()).rejects.toThrow("Atum sign-in required");
  vi.stubGlobal("window", { atumWork: { getConnectAssertion: async () => "" } });
  await expect(atumConnectIdentity.getAssertion()).rejects.toThrow("Invalid Atum assertion response");
});

it("reads the asserted owner and rejects missing owner claims", () => {
  expect(assertionOwner(`header.${btoa(JSON.stringify({ sub: "owner" }))}.signature`)).toBe("owner");
  expect(() => assertionOwner(`header.${btoa("{}")}.signature`)).toThrow("Invalid Atum owner");
});
