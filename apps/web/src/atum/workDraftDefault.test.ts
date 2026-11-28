import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { expect, it } from "vite-plus/test";
import { DraftId, useComposerDraftStore } from "../composerDraftStore";
import { syncWorkDraftDefault } from "./workDraftDefault";

const atum = {
  instanceId: ProviderInstanceId.make("atum-managed"),
  model: "atum-managed:nguyet-thuc",
};
const sonnet = { instanceId: ProviderInstanceId.make("claudeAgent"), model: "claude-sonnet-5-5" };

function draft(name: string) {
  const id = DraftId.make(name);
  const store = useComposerDraftStore.getState();
  const project = scopeProjectRef(EnvironmentId.make("work-local"), ProjectId.make(name));
  store.setProjectDraftThreadId(project, id, { threadId: ThreadId.make(name) });
  return { id, store };
}

it("refreshes the unsent draft's inherited model when the desktop discovers a subscription", () => {
  const { id, store } = draft("inherited");
  store.setModelSelection(id, atum);
  store.setPrompt(id, "keep the unsent prompt");

  syncWorkDraftDefault(id, sonnet);

  const updated = store.getComposerDraft(id);
  expect(updated?.activeProvider).toBe(sonnet.instanceId);
  expect(updated?.modelSelectionByProvider[sonnet.instanceId]).toEqual(sonnet);
  expect(updated?.prompt).toBe("keep the unsent prompt");
});

it("keeps the model explicitly picked for this draft when the default changes", () => {
  const { id, store } = draft("explicit");
  store.setModelSelection(id, atum, { explicit: true });

  syncWorkDraftDefault(id, sonnet);

  const updated = store.getComposerDraft(id);
  expect(updated?.activeProvider).toBe(atum.instanceId);
  expect(updated?.modelSelectionByProvider[atum.instanceId]).toEqual(atum);
  expect(updated?.modelSelectionExplicit).toBe(true);
});
