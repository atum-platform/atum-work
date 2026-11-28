const legacyBrand =
  /(?:^|[^\p{L}\p{N}])(?:t3(?:[ _.-]?(?:code|connect|chat|thread))?|hermes(?:[ _.-]?agent)?|nous(?:[ _.-]?research)?)(?=$|[^\p{L}\p{N}])|t3\.codes|t3code|HERMES_HOME|T3CODE_HOME/iu;

// The ACP fallback invokes these existing environment variables. Only the ACP
// instruction fixture grants them, never the rendered UI or MCP tool catalog.
export const acpCompatibilityKeys = [
  "T3_ACP_MCP_NODE",
  "T3_ACP_MCP_ENTRYPOINT",
  "T3_ACP_MCP_CALL",
] as const;

export function assertWorkBrandText(
  surface: string,
  text: string,
  compatibilityKeys: readonly string[] = [],
): void {
  if (!text.trim()) throw new Error("Missing Work brand fixture: " + surface);
  const decoded = text
    .replace(/(?:%[a-f0-9]{2})+/gi, (value) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    })
    .replace(/&#(x[\da-f]+|\d+);/gi, (entity: string, digits: string) => {
      const codePoint = digits.startsWith("x")
        ? Number.parseInt(digits.slice(1), 16)
        : Number.parseInt(digits, 10);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    })
    .normalize("NFKC");
  const checked = compatibilityKeys.reduce(
    (value, key) => value.replaceAll(new RegExp("\\b" + key + "\\b", "gu"), ""),
    decoded,
  );
  const match = legacyBrand.exec(checked);
  if (match !== null) {
    throw new Error(
      "Legacy product text in Work brand fixture " + surface + ": " + match[0].trim(),
    );
  }
}
