import type { ServerProviderModel } from "@t3tools/contracts";

import catalog from "./atum-display-2026-11-27.json" with { type: "json" };

const modelsByAlias = new Map(
  [...catalog.shortlist, ...catalog.showMore].map((model, rank) => [
    model.alias,
    { ...model, rank, isLegacy: rank >= catalog.shortlist.length },
  ]),
);

export function atumProviderName(instanceId: string, driver: string | null): string | undefined {
  if (driver !== "acpRegistry") return undefined;
  if (instanceId === "atum-managed") return catalog.provider;
  if (instanceId === "atum-managed-delegated") return "Atum Delegated";
}

function routeAlias(slug: string): string {
  return slug.replace(/^(?:atum-managed|atum-managed-delegated):/u, "");
}

export function atumModelDisplayName(slug: string): string | undefined {
  const alias = routeAlias(slug);
  return modelsByAlias.get(alias === "default" || alias === "binh-minh" ? "nguyet-thuc" : alias)
    ?.name;
}

export function atumUpstreamModelId(slug: string): string | undefined {
  return modelsByAlias.get(routeAlias(slug))?.model;
}

// ACP supplies eligibility and capabilities. The display catalog supplies names and ordering only.
export function projectAtumModels(
  models: ReadonlyArray<ServerProviderModel>,
): ServerProviderModel[] {
  return models
    .flatMap((model) => {
      if (model.isCustom) return [{ model, rank: modelsByAlias.size }];
      const display = modelsByAlias.get(routeAlias(model.slug));
      if (!display) return [];
      const { subProvider: _backend, ...rest } = model;
      return [
        {
          model: {
            ...rest,
            name: display.name,
            shortName: display.name,
            isLegacy: display.isLegacy,
          },
          rank: display.rank,
        },
      ];
    })
    .sort((left, right) => left.rank - right.rank)
    .map(({ model }) => model);
}
