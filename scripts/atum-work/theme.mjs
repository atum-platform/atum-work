// Generates the Atum environment theme (atum-work/theme/atum.json) from Atum Kit's tokens.json.
// Usage: node scripts/atum-work/theme.mjs <atum-kit/tokens.json> [output.json]
// Desktop main publishes the output once per home with the bundled CLI: `theme set <path>`.
import * as NodeAssert from "node:assert/strict";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const repo = NodePath.resolve(import.meta.dirname, "../..");

function parse(value) {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(\.?\d*\.?\d+)\s*\)$/.exec(value);
  NodeAssert.ok(rgba, `Unsupported token colour: ${value}`);
  return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: +rgba[4] };
}

// Kit lines and fills are translucent; T3 roles take solid colours, so composite them onto the
// surface they sit on in Atum.
function solid(value, over) {
  const top = parse(value);
  const base = over ? parse(over) : { r: 0, g: 0, b: 0, a: 1 };
  const mix = (t, b) => Math.round(t * top.a + b * (1 - top.a));
  return `#${[mix(top.r, base.r), mix(top.g, base.g), mix(top.b, base.b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function atumThemeColors(theme, mode) {
  const t = (name) => {
    const value = theme[name]?.[mode];
    NodeAssert.ok(value, `Missing token ${name}.${mode}`);
    return value;
  };
  const surface = t("surface");
  const ground = t("ground");
  const on = (name, base = surface) => solid(t(name), base);
  return {
    // Main card: opaque surface. Frame and sidebar: the ground behind it (STYLE.md section 2).
    canvas: surface,
    chrome: ground,
    toolbar: surface,
    toolbarForeground: t("ink"),
    toolbarBorder: on("line"),
    toolbarControl: surface,
    toolbarControlForeground: t("ink-2"),
    toolbarControlHover: on("fill-hover"),
    surface,
    surfaceRaised: t("raised"),
    surfaceOverlay: t("raised"),
    text: t("ink"),
    textMuted: t("ink-3"),
    border: on("line"),
    input: on("line-2"),
    focus: on("focus"),
    // No accent colour: on is ink, selected is a fill (STYLE.md section 3).
    accent: t("ink"),
    accentForeground: t("on-ink"),
    secondary: on("fill-quiet"),
    secondaryForeground: t("ink"),
    muted: on("fill-quiet"),
    mutedForeground: t("ink-3"),
    placeholder: t("ink-3"),
    secondaryLabel: t("ink-3"),
    iconMuted: t("ink-4"),
    // A notice band is the quiet fill with ink text; only its glyph takes the colour.
    error: t("danger"),
    errorForeground: t("ink"),
    errorSurface: on("fill-quiet"),
    warning: t("warn"),
    warningForeground: t("ink"),
    warningSurface: on("fill-quiet"),
    update: t("ink"),
    updateForeground: t("ink"),
    updateSurface: on("fill-quiet"),
    accentSurface: on("fill-selected"),
    accentSurfaceForeground: t("ink"),
    messageSurface: t("bubble-own"),
    messageForeground: t("on-bubble-own"),
    messageAction: t("ink"),
    messageActionForeground: t("on-ink"),
    messageActionHover: t("ink-hover"),
    codeBackground: on("fill-quiet"),
    codeForeground: t("ink"),
    searchMatchBackground: on("warn-fill"),
    searchMatchForeground: t("ink"),
    searchMatchActiveBackground: t("warn"),
    searchMatchActiveForeground: t("on-ink"),
    sidebar: ground,
    sidebarForeground: t("ink"),
    sidebarMutedForeground: t("ink-3"),
    sidebarControlSurface: on("fill-quiet", ground),
    sidebarRowHover: on("fill-hover", ground),
    sidebarRowActive: on("fill-press", ground),
    sidebarRowSelected: on("fill-selected", ground),
    sidebarBorder: on("line", ground),
    terminalBackground: surface,
    terminalForeground: t("ink"),
    terminalCursor: t("ink"),
    terminalSelection: on("fill-press"),
    terminalScrollbar: on("line-2"),
    terminalScrollbarHover: t("ink-4"),
  };
}

export function atumTheme(tokens) {
  const px = (n) => `${n / 16}rem`;
  // Shape and type only; colours come from the palette. Targets data- attributes, which upstream
  // documents as the stable hooks for theme CSS.
  const css = [
    `:root { --radius: ${px(tokens.radius.md)}; --font-sans: ${tokens.font.text}; --font-mono: ${tokens.font.mono}; }`,
    // A notice is quiet glass with a hairline; only its glyph carries the colour (STYLE.md section 3).
    `[data-slot="alert"][data-variant] { --alert-glass-tint: transparent; border-color: var(--border); }`,
    // Switches take Kit's proportions (.ak-switch is 22 by 38): a 20px thumb gives exactly that.
    `[data-slot="switch"][data-size="default"] { --thumb-size: 20px; }`,
  ].join("\n");
  return {
    version: 1,
    name: "Atum",
    appearance: "light",
    colors: atumThemeColors(tokens.theme, "light"),
    variants: { dark: atumThemeColors(tokens.theme, "dark") },
    css,
  };
}

if (import.meta.main) {
  const [tokensPath, output = NodePath.join(repo, "atum-work/theme/atum.json")] =
    process.argv.slice(2);
  NodeAssert.ok(tokensPath, "Usage: node scripts/atum-work/theme.mjs <tokens.json> [output.json]");
  const raw = NodeFS.readFileSync(tokensPath);
  const tokens = JSON.parse(raw.toString("utf8"));
  NodeFS.writeFileSync(output, JSON.stringify(atumTheme(tokens), null, 2) + "\n");
  NodeFS.writeFileSync(
    output.replace(/\.json$/, ".provenance.json"),
    JSON.stringify(
      {
        source: "atum-desktop packages/atum-kit/tokens.json",
        kitVersion: tokens.version,
        sha256: NodeCrypto.createHash("sha256").update(raw).digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Wrote ${output}`);
}
