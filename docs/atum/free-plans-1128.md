# Free plans in Work

GitHub Copilot runs through the existing local ACP Registry adapter. Desktop registers
the `copilot` instance and Work starts the official browser login for it. When the CLI
is missing, Work uses GitHub’s [installer](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli)
under the user’s home directory. Work retains only its existing sign-in confirmation
and lets the CLI store the credential.

Copilot and Kiro are for interactive Work sessions only. Keep both out of auto-switch
and the Desktop cloud relay.

Owner verification uses an individual Free account. Complete browser sign-in from
Desktop, select Copilot in Work, send one harmless prompt, and check that the account
and native model remain available after a restart.

## Kiro

Work can install the Darwin Kiro CLI archive pinned by the ACP Registry and open
its browser sign-in. An existing Kiro CLI on the Mac can sign in directly. The
native driver uses the CLI’s account and model catalog for readiness.

The owner still needs to confirm Kiro Free availability from Vietnam using an
existing eligible account. In Desktop, click Install & sign in for Kiro, choose
your Free account in the browser, select a model Work offers, send a harmless
prompt, and verify usage and readiness after a restart.

## OpenRouter Free

Connect OpenRouter Free from Settings → Connections after installing OpenCode
2.3.2. This is a manual fallback for a few chats per day. Use a personal
workspace without upstream provider keys. Complete OpenRouter’s browser consent
and select OpenRouter Free in Work. The daily count, when available, comes from
OpenRouter’s key endpoint.

The Work instance stores the PKCE-issued key in OpenCode’s local credential
database beneath the account’s Work directory. It uses a distinct OpenCode
server, provider policy and plugin. The plugin permits two literal Gemma
`:free` models with zero-priced catalogs, limits every request to OpenRouter
chat completions, and sets OpenRouter’s price ceilings to zero. Titles and
compaction use the pinned Gemma free variant. OpenRouter privacy errors link
to its Privacy page.

On a packaged build, choose an already eligible personal account, complete
browser consent, send a harmless Work prompt, and check OpenRouter Activity for
the exact model and zero cost. Verify the separate ordinary OpenCode list has no
OpenRouter models, including after restarting Desktop. Use Work’s provider
settings to disconnect and OpenRouter’s key settings to revoke the issued key.

OpenRouter cloud relay, automatic fallback, upstream key verification, OpenCode
Zen, Cursor and Mistral are outside this release.

Local verification uses synthetic accounts and a loopback fixture. OpenCode
2.3.2 sent both chat and title requests with a zero price limit in the fixture.
Live browser sign-in and the packaged app remain owner acceptance steps.

Run the native isolation release check with
`node --experimental-strip-types --test scripts/atum-work/openrouter-isolation.test.mjs`.
The fixture uses synthetic credentials, two temporary OpenCode data directories,
and no inference calls.

Before opening browser consent, Work initializes the native catalog and checks
that the policy plugin is active. A local OpenCode server fixture verified
the policy check and the isolated credential lookup.
The Privacy link uses Work’s translated Open settings label.
