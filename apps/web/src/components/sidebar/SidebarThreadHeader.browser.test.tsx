import { createRef } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import "~/index.css";
import { render } from "../../../test/render";
import { SidebarProvider } from "../ui/sidebar";
import { SidebarThreadHeader, type SidebarThreadHeaderProps } from "./SidebarThreadHeader";

// The Atum build in Work mode: the mode every Atum Work view opens in.
vi.mock("~/atum/surfaceMode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/atum/surfaceMode")>()),
  isAtumWorkBuild: true,
  useActiveAtumSurfaceMode: () => "work",
}));

function props(overrides: Partial<SidebarThreadHeaderProps> = {}): SidebarThreadHeaderProps {
  return {
    hasProjects: true,
    projectScope: <button type="button">Projects</button>,
    onNewThread: () => {},
    newThreadDisabled: false,
    newThreadShortcutLabel: null,
    newThreadInProjectShortcutLabel: null,
    showNewThreadInProjectHint: false,
    searchInputRef: createRef<HTMLInputElement>(),
    searchQuery: "",
    onSearchQueryChange: () => {},
    onSearchKeyDown: () => {},
    isSearching: false,
    searchResultCount: 0,
    activeSearchResultIndex: 0,
    onClearSearch: () => {},
    ...overrides,
  };
}

describe("SidebarThreadHeader in Work mode", () => {
  // Owner 2026-11-28: "Filter button now added to Chat but gone from Work?" Chat's roster draws
  // search, filter, plus; Work's list draws the same row in Work mode, not only in Code mode.
  it("draws search, filter, plus in that order", async () => {
    await using screen = await render(
      <SidebarProvider>
        <SidebarThreadHeader {...props()} />
      </SidebarProvider>,
      { router: false },
    );

    const search = screen.getByRole("combobox", { name: "Search threads" }).element();
    const filter = screen.getByRole("button", { name: "Projects" }).element();
    const plus = screen.getByRole("button", { name: "New" }).element();

    expect(search.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(filter.compareDocumentPosition(plus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("leaves the filter out while there is no project to filter by", async () => {
    await using screen = await render(
      <SidebarProvider>
        <SidebarThreadHeader {...props({ hasProjects: false })} />
      </SidebarProvider>,
      { router: false },
    );

    expect(screen.getByRole("button", { name: "New" }).element()).toBeTruthy();
    expect(screen.getByRole("button", { name: "Projects" }).query()).toBeNull();
  });
});
