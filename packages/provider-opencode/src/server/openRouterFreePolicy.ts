export const OPENROUTER_FREE_INSTANCE = "openrouter-free";
export const OPENROUTER_FREE_POLICY = "atum.openrouter-free";
export const OPENROUTER_FREE_VERSION = "2.3.2";

export const supportsOpenRouterFreeVersion = (version: string) => /^2\.3\.\d+$/.test(version);

export function isOpenRouterFreeDailyLimit(
  instanceId: string,
  error: {
    status?: number | undefined;
    message: string;
    response?: { body?: string | undefined } | undefined;
  },
) {
  return (
    instanceId === OPENROUTER_FREE_INSTANCE &&
    (error.status === undefined || error.status === 429) &&
    [error.message, error.response?.body].some((text) =>
      /\bfree-models-per-day\b/i.test(text ?? ""),
    )
  );
}

const titleModel = "openrouter/google/gemma-4-26b-a4b-it:free";

export function openRouterFreeConfig(plugin: string) {
  return JSON.stringify({
    enabled_providers: ["openrouter"],
    autoupdate: false,
    model: titleModel,
    agents: { title: { model: titleModel }, compaction: { model: titleModel } },
    plugins: [plugin],
  });
}

// This runs inside OpenCode, including for titles, compaction, and subagents.
export const openRouterFreePlugin = `
const allowed = new Set(["google/gemma-4-26b-a4b-it:free", "google/gemma-4-31b-it:free"]);
const max_price = { prompt: 0, completion: 0, request: 0, image: 0 };
const allZero = (value) => value === undefined || value === 0 ||
  (value && typeof value === "object" && Object.values(value).every(allZero));
const eligible = (model) => model.providerID === "openrouter" && allowed.has(model.id) &&
  model.capabilities.tools && model.cost?.length > 0 && model.cost.every(({ tier, ...cost }) =>
    cost.input === 0 && cost.output === 0 && Object.values(cost).every(allZero));

export default {
  id: "${OPENROUTER_FREE_POLICY}",
  async setup(ctx) {
    await ctx.model.transform(editor => {
      for (const model of editor.list()) {
        if (!eligible(model)) editor.remove(model.providerID, model.id);
      }
    });
    await ctx.session.hook("http.request", async (event) => {
      const request = event.request;
      if (request.url !== "https://openrouter.ai/api/v1/chat/completions" || request.method !== "POST") {
        throw new Error("OpenRouter Free only allows OpenRouter chat requests.");
      }
      const body = await request.clone().json();
      if (!allowed.has(body.model) || body.tools?.some(tool => tool.type !== "function")) {
        throw new Error("This model or tool is unavailable on OpenRouter Free.");
      }
      for (const field of ["models", "route", "plugins", "preset", "transforms", "web_search_options"]) delete body[field];
      body.provider = { max_price };
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      event.request = new Request(request, { headers, body: JSON.stringify(body), redirect: "error" });
    });
  },
};
`;

const privacyLine =
  "OpenRouter privacy settings block this model. Choose another free model. https://openrouter.ai/settings/privacy";

export function openRouterFreeError(
  instanceId: string,
  formatted: string | undefined,
  body?: string,
): string | undefined {
  return instanceId === OPENROUTER_FREE_INSTANCE &&
    [formatted, body].some((value) =>
      value?.toLowerCase().includes("no endpoints found matching your data policy"),
    )
    ? privacyLine
    : formatted;
}
