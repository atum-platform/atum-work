# Work authoring and Desktop placement

A Work draft in managed Scratch can create a Word document, Excel workbook, PowerPoint deck, or editable SVG. The format menu and the session chips use the same choices. Design from the chip starts PowerPoint. Design from the menu starts SVG. Work keeps the draft's provider, model, prompt and attachments and opens the file with the existing Files panel. Opening a starter does not send a message or contact a model.

Work allocates a new folder through the native Scratch thread launcher before creating the thread. Claude Code discovers the project skill in `.claude/skills` and receives its selection through `CLAUDE.md`. The same format guidance is available through `AGENTS.md` to providers that load that file. The Office guidance adapts the relevant authoring and validation guidance from [Anthropic's Office skills at e4bb5d96](https://github.com/anthropics/skills/tree/e4bb5d960d87126ff3b3a8af1a104b7db67560ba/skills). The three upstream license files are identical. The Apache-2.0 text is in [server resources](../../apps/server/resources/work-starter/ANTHROPIC-OFFICE-LICENSE.txt). The starter templates are blank Open XML packages authored for Work. The installed authoring runtime supplies the actual generation and validation tools.

The launch response's `workStarter` contains `format` and a path relative to the thread's Scratch folder. This reference opens the blank starter. It carries no placement authority.

## S1 result contract

Work and Desktop exchange this interface in the trusted local host process after a run settles and the authored output is validated. The authoring runtime provides an explicit output reference. Desktop resolves each relative path under the run's private output directory using the authenticated run binding, or resolves an opaque handle issued under the same binding.

```ts
interface WorkAuthoringOutput {
  readonly threadId: string;
  readonly runId: string;
  readonly artifactId: string;
  readonly format: "docx" | "xlsx" | "pptx" | "svg" | "html";
  readonly file: WorkOutputFile;
  readonly preview?: { readonly mimeType: "image/png"; readonly file: WorkOutputFile };
}

type WorkOutputFile = { readonly relativePath: string } | { readonly handle: string };
```

S1 uses `docx`. The settled output must be a regular file with matching format, bounded size, and a successful format validation. A path in conversation text or a changed-file card is insufficient. Strip user or provider authority from the Desktop message. Keep output references local, pin their byte identity when placing, and use `artifactId` with the run to reconcile retries. Desktop owns the final Drive receipt and sync state. A preview is an optional validated PNG, separate from the editable payload.

The launch tests cover all four formats, receipt replay, and rejection outside managed Scratch. Browser fixtures exercise both entry points, draft promotion, and rendering the blank DOCX through the native viewer in light and dark.

The settled authoring result producer, signed runtime, installed provider acceptance, Drive placement and sync, and post-save memory actions require the corresponding rollout slices. The existing model picker shows the selected model for the new session.
