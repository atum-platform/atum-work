import type { ModelSelection } from "@t3tools/contracts";
import { type DraftId, useComposerDraftStore } from "../composerDraftStore";

/** The host can finish probing plans after the initial Work draft has been seeded. */
export function syncWorkDraftDefault(draftId: DraftId, selection: ModelSelection) {
  const store = useComposerDraftStore.getState();
  const draft = store.getComposerDraft(draftId);
  if (draft?.modelSelectionExplicit === true || store.getDraftThread(draftId)?.promotedTo) return;
  store.setModelSelection(draftId, selection, { replaceOptions: true });
}
