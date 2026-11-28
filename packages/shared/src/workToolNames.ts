// Canonical toolkit names remain the keys used by handlers, peers and grants.
const aliases = [
  ["t3_attachment_discard", "attachment_discard"],
  ["t3_attachment_prepare_upload", "attachment_prepare_upload"],
  ["t3_background_wait", "background_wait"],
  ["t3_environment_link", "environment_link"],
  ["t3_environment_links", "environment_links"],
  ["t3_environment_preferences_update", "environment_preferences_update"],
  ["t3_environment_read", "environment_read"],
  ["t3_environment_unlink", "environment_unlink"],
  ["t3_feedback", "feedback"],
  ["t3_pending_request", "pending_request"],
  ["t3_preview_close", "preview_close"],
  ["t3_preview_list", "preview_list"],
  ["t3_project_clone", "project_clone"],
  ["t3_project_create", "project_create"],
  ["t3_project_delete", "project_delete"],
  ["t3_project_list", "project_list"],
  ["t3_project_read", "project_read"],
  ["t3_project_update", "project_update"],
  ["t3_queue", "queue"],
  ["t3_submit_output", "submit_output"],
  ["t3_theme_read", "theme_read"],
  ["t3_theme_set", "theme_set"],
  ["t3_thread_configure", "thread_configure"],
  ["t3_thread_interrupt", "thread_interrupt"],
  ["t3_thread_launch", "thread_launch"],
  ["t3_thread_list", "thread_list"],
  ["t3_thread_organize", "thread_organize"],
  ["t3_thread_read", "thread_read"],
  ["t3_thread_search", "thread_search"],
  ["t3_thread_send", "thread_send"],
  ["t3_thread_send_attachments", "thread_send_attachments"],
  ["t3_thread_transfer", "thread_transfer"],
  ["t3_thread_update", "thread_update"],
  ["t3_thread_wait", "thread_wait"],
  ["t3_workflow", "workflow"],
  ["t3_workflow_stop", "workflow_stop"],
  ["t3_worktree_handoff", "worktree_handoff"],
  ["t3_worktree_list", "worktree_list"],
  ["t3_worktree_status", "worktree_status"],
] as const;

const visibleNames = new Map<string, string>(aliases);
const canonicalNames = new Map<string, string>(aliases.map(([key, value]) => [value, key]));

if (visibleNames.size !== aliases.length || canonicalNames.size !== aliases.length) {
  throw new Error("Work tool aliases must be unique");
}

export const workToolName = (name: string): string => visibleNames.get(name) ?? name;
export const canonicalWorkToolName = (name: string): string => canonicalNames.get(name) ?? name;

const toolReferences = /(?<![a-z0-9])t3_[a-z_]+\b/gu;

/** Only for first-party templates and schema documentation. Never use on conversation data. */
export const workInstructionText = (text: string): string =>
  text
    .replaceAll("mcp__t3-code__", "mcp__atum-work__")
    .replaceAll("t3_code_orchestration_instructions", "atum_work_orchestration_instructions")
    .replaceAll("t3_code_instructions", "atum_work_instructions")
    .replaceAll("t3_thread_*", "thread_*")
    .replaceAll("t3_project_*", "project_*")
    .replaceAll(toolReferences, workToolName)
    .replaceAll("T3 Code", "Atum Work")
    .replaceAll("T3 Connect", "Work Connect")
    .replaceAll(/\bT3\b/gu, "Work")
    .replaceAll("`t3`", "`atum work`");
