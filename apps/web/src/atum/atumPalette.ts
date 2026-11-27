import { EnvironmentTheme } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

import atumPaletteFile from "../../../../atum-work/theme/atum.json?raw";

/** The id the desktop publishes the same palette under (`theme set atum.json`). */
export const ATUM_PALETTE_THEME_ID = "atum";

const decodeEnvironmentTheme = Schema.decodeUnknownSync(EnvironmentTheme);

/** The theme file as the environment would publish it: the same file, under the id the desktop sets. */
export function parseAtumPalette(raw: string): EnvironmentTheme {
  const file: unknown = JSON.parse(raw);
  return decodeEnvironmentTheme({
    ...(typeof file === "object" && file !== null ? file : {}),
    id: ATUM_PALETTE_THEME_ID,
  });
}

/**
 * Atum's palette, bundled into the Atum build: the page paints it whenever no theme resolves (before the
 * environment's copy arrives, on Welcome, offline), so Work never shows stock T3's blue and near-black.
 * A theme that resolves still wins. Null outside the Atum build.
 */
export const atumPaletteTheme: EnvironmentTheme | null =
  import.meta.env.VITE_ATUM_WORK_BUILD === "1" ? parseAtumPalette(atumPaletteFile) : null;
