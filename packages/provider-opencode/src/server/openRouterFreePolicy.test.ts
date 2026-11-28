import { describe, expect, it } from "@effect/vitest";
import { openRouterFreeError, openRouterFreePlugin } from "./openRouterFreePolicy.ts";

const free = "google/gemma-4-26b-a4b-it:free";
const fixtureModel = {
  providerID: "openrouter",
  id: free,
  capabilities: { tools: true },
  cost: [{ input: 0, output: 0 }],
};

async function registerPolicy() {
  const pluginUrl = `data:text/javascript,${encodeURIComponent(openRouterFreePlugin)}`;
  const { default: plugin } = await import(/* @vite-ignore */ pluginUrl);
  const hooks: Record<string, (event: { request: Request }) => Promise<void>> = {};
  const providers = [
    fixtureModel,
    { ...fixtureModel, providerID: "anthropic" },
    { ...fixtureModel, id: "openrouter/auto" },
    {
      ...fixtureModel,
      id: free.replace("26b-a4b", "31b"),
      cost: [{ input: 0, output: 0, cache: { write: 1 } }],
    },
  ];
  const removed: string[][] = [];
  await plugin.setup({
    model: {
      transform: (run: (editor: unknown) => void) =>
        run({ list: () => providers, remove: (...entry: string[]) => removed.push(entry) }),
    },
    session: {
      hook: (name: string, hook: (typeof hooks)[string]) => {
        hooks[name] = hook;
      },
    },
  });
  return { hooks, removed };
}

describe("OpenRouter Free policy", () => {
  it("keeps only reviewed zero-cost models", async () => {
    const { removed } = await registerPolicy();
    expect(removed).toEqual([
      ["anthropic", free],
      ["openrouter", "openrouter/auto"],
      ["openrouter", "google/gemma-4-31b-it:free"],
    ]);
  });

  it.each(["primary", "title", "compaction", "generate"])(
    "caps every %s request at zero",
    async (kind) => {
      const { hooks } = await registerPolicy();
      const event = {
        kind,
        request: new Request("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          body: JSON.stringify({
            model: free,
            models: ["paid"],
            plugins: [{ id: "web" }],
            provider: { max_price: { prompt: 1 } },
          }),
        }),
      };
      await hooks["http.request"]!(event);
      expect(await event.request.json()).toEqual({
        model: free,
        provider: { max_price: { prompt: 0, completion: 0, request: 0, image: 0 } },
      });
      expect(event.request.redirect).toBe("error");
    },
  );

  it("refuses paid models and an unexpected destination", async () => {
    const { hooks } = await registerPolicy();
    const request = (url: string, model: string) =>
      new Request(url, { method: "POST", body: JSON.stringify({ model }) });
    await expect(
      hooks["http.request"]!({
        request: request("https://openrouter.ai/api/v1/chat/completions", "paid"),
      }),
    ).rejects.toThrow();
    await expect(
      hooks["http.request"]!({
        request: request("https://other.invalid/api/v1/chat/completions", free),
      }),
    ).rejects.toThrow();
  });

  it("provides the Privacy link for explicit data policy errors", () => {
    expect(
      openRouterFreeError("openrouter-free", "No endpoints found matching your data policy"),
    ).toContain("https://openrouter.ai/settings/privacy");
    expect(openRouterFreeError("openrouter-free", "Model unavailable")).toBe("Model unavailable");
    expect(
      openRouterFreeError(
        "openrouter-free",
        "HTTP 404",
        '{"message":"No endpoints found matching your data policy"}',
      ),
    ).toContain("https://openrouter.ai/settings/privacy");
  });
});
