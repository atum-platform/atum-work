import type { CSSProperties } from "react";

const BANNER_LANE_ANCHOR = "--atum-banner-lane";
const isAtumBuild = import.meta.env.VITE_ATUM_WORK_BUILD === "1";

/** Names the banner lane as an anchor, so the empty thread's composer can start below it. */
export const atumBannerLaneStyle: CSSProperties | undefined = isAtumBuild
  ? ({ anchorName: BANNER_LANE_ANCHOR } as CSSProperties)
  : undefined;

/**
 * The empty thread centres the greeting and composer over the whole card, so a provider notice covered the
 * greeting. Starting the overlay at the lane's bottom keeps them below it; an empty lane is zero high.
 */
export const atumDraftOverlayStyle: CSSProperties | undefined = isAtumBuild
  ? { top: `anchor(${BANNER_LANE_ANCHOR} bottom, 0px)` }
  : undefined;
