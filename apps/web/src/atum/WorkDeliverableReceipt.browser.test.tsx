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
