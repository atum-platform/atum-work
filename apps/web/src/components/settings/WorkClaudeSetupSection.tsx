import { useAtomValue } from "@effect/atom-react";
import {
  AuthTerminalOperateScope,
  type EnvironmentId,
  type ServerProvider,
} from "@t3tools/contracts";
import { useGT } from "gt-react";
import { lazy, Suspense, useState } from "react";

import {
  resolveOnboardingProviderInstallCommand,
  resolveOnboardingProviderLoginCommand,
} from "../../onboarding/providerReadiness.logic";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { useEnvironmentScope } from "../../state/session";
import type { AgentTerminalSession } from "../onboarding/WelcomePage";
import { Button } from "../ui/button";
import { SettingsRow } from "./settingsLayout";
import { openProviderSignIn } from "./workProviderSignIn";

const AgentInstallTerminal = lazy(() =>
  import("../onboarding/WelcomePage").then(({ AgentInstallTerminal }) => ({
    default: AgentInstallTerminal,
  })),
);
const openClaudeSignIn = (url: string) => openProviderSignIn("claudeAgent", url);

export function WorkClaudeSetupSection({
  environmentId,
  provider,
}: {
  readonly environmentId: EnvironmentId;
  readonly provider: ServerProvider;
}) {
  const gt = useGT();
  const config = useAtomValue(serverEnvironment.configValueAtom(environmentId));
  const canOperate = useEnvironmentScope(environmentId, AuthTerminalOperateScope);
  const refresh = useAtomCommand(serverEnvironment.refreshProviders, { reportFailure: false });
  const [session, setSession] = useState<AgentTerminalSession | null>(null);
  function startSetup() {
    if (!canOperate || !config) return;
    const platform = config.environment.platform.os;
    setSession({
      environmentId,
      driver: "claudeAgent",
      providerInstanceId: provider.instanceId,
      cwd: config.cwd,
      keybindings: config.keybindings,
      command: provider.installed
        ? resolveOnboardingProviderLoginCommand(provider, config.settings, platform)
        : resolveOnboardingProviderInstallCommand("claudeAgent", platform),
    });
  }

  return (
    <>
      <SettingsRow
        title={gt("Claude Code")}
        description={gt("Install Claude Code and sign in with your Claude account.")}
        control={
          <Button
            size="sm"
            variant="outline"
            disabled={!canOperate || !config || !provider.enabled || session !== null}
            onClick={startSetup}
          >
            {provider.installed
              ? provider.auth.status === "authenticated"
                ? gt("Change account")
                : gt("Sign in")
              : gt("Install")}
          </Button>
        }
      />
      {session ? (
        <Suspense fallback={null}>
          <AgentInstallTerminal
            session={session}
            openWebLink={openClaudeSignIn}
            onCommandFinished={() =>
              void refresh({ environmentId, input: { instanceId: provider.instanceId } })
            }
            onClose={() => setSession(null)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
