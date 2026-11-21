const WORK_PROVIDER_INSTANCE_ID = "atum-managed";

type WorkAccessState = "allowed" | "empty" | "unavailable";

/** The owner view's preload delegates this read to desktop main. */
export interface WorkSubmitAccessBridge {
  readonly readModelAccess: () => Promise<WorkAccessState>;
}

declare global {
  interface Window {
    readonly atumWork?: WorkSubmitAccessBridge;
  }
}

// Lane-specific UI copy lives at this boundary so the send path only sees a refusal or null.
const empty = "There is no balance available for this turn.";
const unavailable = "Work couldn't check your balance. Try again.";

export function checkWorkSubmitAccess(
  instanceIds: ReadonlyArray<string>,
  bridge: WorkSubmitAccessBridge | undefined = globalThis.window?.atumWork,
): Promise<string | null> | undefined {
  if (!instanceIds.includes(WORK_PROVIDER_INSTANCE_ID)) return undefined;

  // An absent bridge, rejection or unrecognized response all leave the draft available to retry.
  return Promise.resolve()
    .then(() => bridge?.readModelAccess())
    .then((state) => (state === "allowed" ? null : state === "empty" ? empty : unavailable))
    .catch(() => unavailable);
}
