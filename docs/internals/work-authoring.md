# Work authoring and Desktop placement

A Work draft in managed Scratch can create a Word document, Excel workbook, PowerPoint deck, or editable design. The Design chip and Create → Design both open the blank SVG starter. The Slides chip and Create → Slides open PowerPoint. Work keeps the draft's provider, model, prompt and attachments and opens the file with the existing Files panel. Opening a starter does not send a message or contact a model.

Work allocates a new folder through the native Scratch thread launcher before creating the thread. Claude Code discovers the project skill in `.claude/skills` and receives its selection through `CLAUDE.md`. The same format guidance is available through `AGENTS.md` to providers that load that file. The Office guidance adapts the relevant authoring and validation guidance from [Anthropic's Office skills at e4bb5d96](https://github.com/anthropics/skills/tree/e4bb5d960d87126ff3b3a8af1a104b7db67560ba/skills). The three upstream license files are identical. The Apache-2.0 text is in [server resources](../../apps/server/resources/work-starter/ANTHROPIC-OFFICE-LICENSE.txt). The starter templates are blank Open XML packages authored for Work. The installed authoring runtime supplies the actual generation and validation tools.

The launch response's `workStarter` contains `format` and a path relative to the thread's Scratch folder. This reference opens the blank starter. It carries no placement authority.

## S1 result contract

Work reuses the inherited Desktop sidecar IPC channel. A Claude turn in a Word Scratch session gets its own private output directory and the absolute paths for the bundled memo helper. Work requests a Desktop pin before dispatch using the thread, run and artifact IDs. A Drive admission failure still allows local authoring.

The memo helper writes to the output slot Work assigned for the turn. Work records the artifact ID on the run only after checking the bounded DOCX archive and finding editable Word text. The durable finalization worker verifies the completed run and validates the file again before sending `work-deliverable-settled` with the same IDs and `{ path: "Memo.docx", format: "docx", preview: null }`. Desktop resolves the relative path under its pinned directory and owns byte identity, placement, sync and the final Drive receipt. The renderer asks the existing preload for status and opens the saved file by ID.

The local pilot ran Claude Haiku 4.5 through Work with an uploaded meeting-notes fixture. After restarting during finalization, the outbox emitted a settlement for the original completed run with no additional generation. LibreOffice opened the 37,251-byte DOCX and rendered two pages. The editable document has four Word headings and one native table with four rows. Claude inferred an owner for the Friday review where the fixture had left the owner unspecified. The proof covers Work's local production and IPC emission. Installed Drive sync and opening from a second signed-in client remain acceptance checks.

The launch tests cover all four formats, receipt replay, and rejection outside managed Scratch. Browser fixtures exercise both entry points, draft promotion, and rendering the blank DOCX through the native viewer in light and dark.

The signed runtime, installed provider acceptance, Drive placement and sync, and post-save memory actions require the corresponding rollout slices. The existing model picker shows the selected model for the new session.

## S6 HTML and SVG

Desktop passes the path to the staged `work-design` skill in the private sidecar environment as `ATUM_WORK_DESIGN_SKILL`. New Design starters install it in `.claude/skills/work-design/SKILL.md` and point providers that load `AGENTS.md` to the same file. At turn start Work sends a single line with the two allowed absolute output paths through the existing provider app context.

Each completed design turn records its new artifact ID and selected format when it finds one non-empty regular source file of at most 512 KiB. Finalization rechecks that specific file and sends an explicit run-relative `Design.html` or `Design.svg` with the matching format and `preview: null`. Desktop alone validates the static source. It renders the companion PNG, versions both files together and reports Saved when each has sync evidence. Existing Word receipts default to `docx` during replay.

The same receipt shows a save failure if Desktop reports an invalid file and shows the saved PNG thumbnail when Desktop supplies `previewDataUrl`. Open in Drive opens the editable source. Selecting the thumbnail opens the companion PNG by the same receipt identity plus `asset: "preview"`.

For signed-app acceptance, create an HTML flyer and an SVG diagram from Design with an enrolled Drive target. Check the PNG and source from each receipt, then revise the flyer in its original thread and confirm the first pair and versioned pair both open in Drive. Repeat the authoring path on the supported provider families and check from a second signed-in client that both files synced.

A local fixture sent real Work pin and settlement messages over Node IPC to Desktop's host. Pinned Electron and resvg produced the PNGs for the flyer, same-thread revision and SVG diagram. The fixture verified both Open actions and receipt thumbnails against a simulated Drive manifest. The round-three rerun included an HTML named entity and verified the one-line output context.
