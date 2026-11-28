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
