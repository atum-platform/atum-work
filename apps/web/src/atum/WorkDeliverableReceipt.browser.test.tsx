import { expect, it, vi } from "vite-plus/test";
import { act, fakeTimers, render } from "../../test/render";
import { WorkDeliverableReceipt } from "./WorkDeliverableReceipt";

it("offers Open in Drive only after Desktop reports a saved receipt", async () => {
  const identity = { threadId: "thread", runId: "run", artifactId: "artifact" };
  const getDeliverable = vi.fn(async () => ({ state: "saved", name: "Memo.docx" }));
  getDeliverable.mockResolvedValueOnce({ state: "syncing", name: "Memo.docx" });
  const openDeliverable = vi.fn(async () => true);
  vi.stubGlobal("atumWork", { getDeliverable, openDeliverable });
  using _clock = fakeTimers();
  try {
    await using screen = await render(<WorkDeliverableReceipt identity={identity} />, {
      router: false,
    });
    expect(screen.container.textContent).toContain("Syncing to Atum Drive");
    expect(screen.container.querySelector("button")).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(screen.container.textContent).toContain("Saved to Atum Drive · Memo.docx");
    await act(() => screen.container.querySelector("button")?.click());
    expect(openDeliverable).toHaveBeenCalledWith(identity);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("shows the saved PNG thumbnail and opens the requested asset in Drive", async () => {
  const identity = { threadId: "thread", runId: "design-run", artifactId: "design" };
  const previewDataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD5sAAAAASUVORK5CYII=";
  const design = { name: "Design.html", previewName: "Design.html.png", previewDataUrl };
  const getDeliverable = vi.fn(async () => ({ state: "saved", ...design }));
  getDeliverable.mockResolvedValueOnce({ state: "syncing", ...design });
  const openDeliverable = vi.fn(async () => true);
  vi.stubGlobal("atumWork", { getDeliverable, openDeliverable });
  using _clock = fakeTimers();
  try {
    await using screen = await render(<WorkDeliverableReceipt identity={identity} />, {
      router: false,
    });
    expect(screen.container.querySelector("img")).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    const thumbnail = screen.container.querySelector("img");
    expect(thumbnail?.getAttribute("src")).toBe(previewDataUrl);
    expect(thumbnail?.alt).toBe(design.previewName);
    await act(() => thumbnail?.closest("button")?.click());
    expect(openDeliverable).toHaveBeenLastCalledWith({ ...identity, asset: "preview" });
    const openSource = Array.from(screen.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Open in Drive",
    );
    await act(() => openSource?.click());
    expect(openDeliverable).toHaveBeenLastCalledWith(identity);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("shows a single status line when Desktop rejects a deliverable", async () => {
  const identity = { threadId: "thread", runId: "design-run", artifactId: "design" };
  const getDeliverable = vi.fn(async () => ({ state: "invalid" }));
  vi.stubGlobal("atumWork", { getDeliverable, openDeliverable: vi.fn() });
  using _clock = fakeTimers();
  try {
    await using screen = await render(<WorkDeliverableReceipt identity={identity} />, {
      router: false,
    });
    const statuses = screen.container.querySelectorAll('[role="status"]');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.textContent).toBe("This file couldn’t be saved to Atum Drive.");
    expect(screen.container.querySelector("button, img")).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(getDeliverable).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
