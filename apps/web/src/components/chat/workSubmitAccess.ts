const WORK_PROVIDER_INSTANCE_ID = "atum-managed";

export type WorkPlanProvider = "codex" | "claudeAgent" | "antigravity";

type WorkAccessState = "allowed" | "empty" | "unavailable";

/** The owner view's preload delegates this read to desktop main. */
export interface WorkSubmitAccessBridge {
  readonly readModelAccess: () => Promise<WorkAccessState>;
  /** Opens the existing Protons top-up page; older preloads do not expose it. */
  readonly openProtons?: () => Promise<boolean>;
  readonly prepareCodexSignIn?: () => Promise<boolean>;
  readonly openProviderSignIn?: (provider: WorkPlanProvider, url: string) => Promise<boolean>;
}

declare global {
  interface Window {
    readonly atumWork?: WorkSubmitAccessBridge;
  }
}

// Lane-specific UI copy lives at this boundary so the send path only sees a refusal or null.
// One plain line each, no balance figure (plan section 9.3). Vietnamese waits for the Q5 locale:
// "Bạn đã hết Proton. Nạp thêm Proton để bắt đầu Work." / "Chưa bắt đầu được Work. Hãy thử lại."
const empty = "You're out of Protons. Add Protons to start Work.";
const unavailable = "Work couldn't start just now. Try again.";
export const WORK_ADD_PROTONS_LABEL = "Add Protons";

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

/** The out-of-Protons line gets one top-up action, but only when the preload can open the page. */
export function readWorkProtonsAction(
  error: string | null,
  bridge: WorkSubmitAccessBridge | undefined = globalThis.window?.atumWork,
): (() => void) | null {
  const openProtons = bridge?.openProtons;
  if (error !== empty || typeof openProtons !== "function") return null;
  return () => void openProtons.call(bridge).catch(() => false);
}
