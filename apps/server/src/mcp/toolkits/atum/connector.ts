export interface Caller {
  threadId: string;
  providerSessionId: string;
  providerInstanceId: string;
}
export interface Question {
  agent: string;
  question?: string;
  request_id: string;
}
export interface Result {
  state:
    | "answered"
    | "waiting"
    | "timed_out"
    | "unavailable"
    | "cancelled"
    | "google_requires_atum"
    | "provenance_unavailable";
  request_id: string;
  question_event_id?: string;
  answer?: string;
  provenance?: "non_google" | "google" | "unknown";
}
export async function askConnector(input: {
  caller: Caller;
  question: Question;
  current(): Promise<boolean>;
  endpoint?: string | undefined;
  token?: string | undefined;
  signal?: AbortSignal;
  fetch?: typeof globalThis.fetch;
}): Promise<Result> {
  const unavailable = (): Result => ({
    state: "unavailable",
    request_id: input.question.request_id,
  });
  if (!input.endpoint || !input.token || !(await input.current())) return unavailable();
  const url = URL.parse(input.endpoint);
  if (
    !url ||
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.pathname !== "/ask" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    return unavailable();
  try {
    const response = await (input.fetch ?? globalThis.fetch)(url, {
      method: "POST",
      redirect: "error",
      signal: input.signal
        ? AbortSignal.any([input.signal, AbortSignal.timeout(55_000)])
        : AbortSignal.timeout(55_000),
      headers: {
        authorization: `Bearer ${input.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ caller: input.caller, question: input.question }),
    });
    if (!response.ok || !(await input.current())) return unavailable();
    const result = (await response.json()) as Result;
    if (result.request_id !== input.question.request_id || !(await input.current()))
      return unavailable();
    // Until the release pin has transcript fencing and a certified route, protected bytes stay closed.
    if (result.state === "answered" && result.provenance !== "non_google") {
      return {
        state: result.provenance === "google" ? "google_requires_atum" : "provenance_unavailable",
        request_id: input.question.request_id,
      };
    }
    if (result.state !== "answered") {
      const { state, request_id, question_event_id } = result;
      return { state, request_id, ...(question_event_id ? { question_event_id } : {}) };
    }
    return result;
  } catch {
    return unavailable();
  }
}
