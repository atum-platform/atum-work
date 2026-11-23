import { describe, expect, it } from "vite-plus/test";
import { checkAtumIconImports } from "../../vite/atumIcons.mjs";

describe("Atum icon coverage", () => {
  it("accepts mapped aliases and types while rejecting new rendered icons", () => {
    expect(() => checkAtumIconImports('import { SearchIcon as Find, type LucideProps } from "lucide-react"', "fixture.tsx")).not.toThrow();
    expect(() => checkAtumIconImports('import { NewlyUsedIcon } from "lucide-react"', "fixture.tsx")).toThrow(/unmapped/);
    expect(() => checkAtumIconImports('import * as Icons from "lucide-react"', "fixture.tsx")).toThrow(/named mapped/);
  });
});
