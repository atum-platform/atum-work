import { expect, it } from "vitest";
import { askConnector } from "./connector.ts";
it.each(["atum-managed", "codex", "claudeAgent", "antigravity"])(
  "forwards a native %s caller and revalidates before release",
  async (providerInstanceId) => {
    let active = true;
    const result = await askConnector({
      caller: { threadId: "t", providerSessionId: "s", providerInstanceId },
      question: { agent: "owned", question: "hello", request_id: "request" },
      endpoint: "http://127.0.0.1:1234/ask",
      token: "fixture",
      current: async () => active,
      fetch: async (_url, init) => {
        expect(JSON.parse(String(init?.body)).caller.providerInstanceId).toBe(
          providerInstanceId,
        );
        active = false;
        return Response.json({
          state: "answered",
          request_id: "request",
          answer: "private",
          provenance: "non_google",
        });
      },
    });
    expect(result).toEqual({ state: "unavailable", request_id: "request" });
  },
);
it("does not expose protected content or follow a nonlocal transport", async () => {
  let calls = 0;
  const input = {
    caller: {
      threadId: "t",
      providerSessionId: "s",
      providerInstanceId: "codex",
    },
    question: { agent: "owned", request_id: "request" },
    token: "fixture",
    current: async () => true,
    fetch: async () => {
      calls++;
      return Response.json({
        state: "answered",
        request_id: "request",
        answer: "secret",
        provenance: "unknown",
      });
    },
  };
  expect(
    await askConnector({ ...input, endpoint: "http://127.0.0.1:1234/ask" }),
  ).toEqual({ state: "google_requires_atum", request_id: "request" });
  expect(
    await askConnector({ ...input, endpoint: "https://example.invalid/ask" }),
  ).toEqual({ state: "unavailable", request_id: "request" });
  expect(calls).toBe(1);
});
