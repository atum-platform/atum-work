import { expect, it } from "@effect/vitest";
import { DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts/settings";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { RelayObservability } from "./observability.ts";

it("trial omits Axiom before evaluating any provider or stack resource", async () => {
  const load = RelayObservability.pipe(
    Effect.provide(
      ConfigProvider.layer(ConfigProvider.fromUnknown({ ATUM_CONNECT_TRIAL: "true" })),
    ),
  );
  // Missing services deliberately fail at runtime if trial mode ever evaluates a resource.
  const observability = await Effect.runPromise(load as Effect.Effect<unknown, unknown>);
  expect(observability).toBeNull();
  expect(DEFAULT_SERVER_SETTINGS.requireConnectDeviceApproval).toBe(true);
});
