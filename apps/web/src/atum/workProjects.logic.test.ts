import { describe, expect, it } from "vite-plus/test";

import { workGreeting, workProjectFoldersOn } from "./workProjects.logic";

describe("Work projects", () => {
  it("groups the list by project in Work mode, and in Code mode only when Labs asks", () => {
    expect(workProjectFoldersOn(false, true, "work")).toBe(true);
    expect(workProjectFoldersOn(false, true, "code")).toBe(false);
    expect(workProjectFoldersOn(true, true, "code")).toBe(true);
    // A plain T3 build has no Work mode: only the Labs toggle counts.
    expect(workProjectFoldersOn(false, false, "work")).toBe(false);
  });

  it("greets by the part of the day, every hour landing in exactly one part", () => {
    const parts = Array.from({ length: 24 }, (_, hour) => workGreeting(hour));
    expect(parts[9]).toBe("morning");
    expect(parts[14]).toBe("afternoon");
    expect(parts[21]).toBe("evening");
    expect(parts[2]).toBe("evening");
    // Each part is one unbroken run of hours (treating the day as a circle).
    const changes = parts.filter((part, hour) => part !== parts[(hour + 23) % 24]).length;
    expect(changes).toBe(3);
  });
});
