import type { Plugin } from "vite-plus";
export const atumIconAlias: { find: RegExp; replacement: string };
export function checkAtumIconImports(source: string, file: string): void;
export function atumIconsPlugin(): Plugin;
