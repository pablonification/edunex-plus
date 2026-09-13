import { useEffect, useState } from "react";
import type { FeedKey, FeedSnapshot } from "@shared/feeds";

export interface CachedFeedState {
  snapshot: FeedSnapshot | null;
  loading: boolean;
  error: boolean;
}
/** Reads a feed through preload and refreshes when main writes a new snapshot. */
export function useCachedFeed(feed: FeedKey): CachedFeedState {
  const [state, setState] = useState<CachedFeedState>({
    snapshot: null,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;
    let updateReceived = false;

    const unsubscribe = window.edunex.onFeedUpdated((snapshot) => {
      if (snapshot.feed !== feed || cancelled) return;
      updateReceived = true;
      setState({ snapshot, loading: false, error: false });
    });

    void window.edunex.getFeed(feed).then(
      (snapshot) => {
        if (cancelled || updateReceived) return;
        setState({ snapshot, loading: false, error: false });
      },
      () => {
        if (cancelled || updateReceived) return;
        setState({ snapshot: null, loading: false, error: true });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [feed]);

  return state;
}
