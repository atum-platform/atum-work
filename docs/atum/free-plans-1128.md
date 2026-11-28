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
