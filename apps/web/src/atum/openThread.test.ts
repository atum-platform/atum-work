import { describe, expect, it } from "vite-plus/test";

import atumPaletteFile from "../../../../atum-work/theme/atum.json?raw";
import { ATUM_PALETTE_THEME_ID, parseAtumPalette } from "./atumPalette";
import { atumOpenThreadFrom, offerAtumOpenThread, readAtumOpenThread } from "./openThread";

describe("atumOpenThreadFrom", () => {
  it("names a thread by its trimmed title and leaves out what it does not have", () => {
    expect(atumOpenThreadFrom({ title: "  Ship it ", repo: " atum ", branch: "main" })).toEqual({
      title: "Ship it",
      repo: "atum",
      branch: "main",
    });
    expect(atumOpenThreadFrom({ title: "Draft", repo: null, branch: "  " })).toEqual({
      title: "Draft",
    });
  });

  it("names nothing without a title", () => {
    expect(atumOpenThreadFrom({ title: "  ", repo: "atum", branch: "main" })).toBeNull();
    expect(atumOpenThreadFrom({ title: undefined, repo: "atum", branch: "main" })).toBeNull();
  });
});

describe("offerAtumOpenThread", () => {
  it("a stale withdrawal never clears a newer thread", () => {
    const withdrawFirst = offerAtumOpenThread({ title: "First" });
    const withdrawSecond = offerAtumOpenThread({ title: "Second" });
    // The first view's cleanup can run after the second one offered: the second stays named.
    withdrawFirst();
    expect(readAtumOpenThread()).toEqual({ title: "Second" });
    withdrawSecond();
    expect(readAtumOpenThread()).toBeNull();
  });
});

describe("the bundled Atum palette", () => {
  it("decodes as the environment theme the desktop publishes, colours only, light with a dark variant", () => {
    const theme = parseAtumPalette(atumPaletteFile);
    expect(theme.id).toBe(ATUM_PALETTE_THEME_ID);
    expect(theme.css).toBeUndefined();
    expect(theme.colors?.accent).toBeDefined();
    expect(theme.variants?.dark?.accent).toBeDefined();
    // Atum's ink accent is neutral: its button is never a hue (stock T3 paints a blue one).
    expect(theme.colors?.accent).not.toBe(theme.colors?.canvas);
  });
});
