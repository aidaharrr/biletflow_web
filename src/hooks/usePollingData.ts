"use client";
import { useEffect, useState } from "react";
/** Keep rendered data and unsent input intact during background polling. */
export function usePollingData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  interval = 15000,
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    load: typeof load | null;
    data: T | null;
    error: unknown;
    revision: number;
  }>({ load: null, data: null, error: null, revision: -1 });
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function read() {
      if (pending) return;
      pending = true;
      try {
        const data = await load(controller.signal);
        if (!controller.signal.aborted)
          setState({ load, data, error: null, revision });
      } catch (error) {
        if (!controller.signal.aborted)
          setState((current) => ({
            load,
            data: current.load === load ? current.data : null,
            error,
            revision,
          }));
      } finally {
        pending = false;
      }
    }
    void read();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void read();
    }, interval);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load, revision, interval]);
  const current = state.load === load;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current || (!state.data && !state.error),
    refreshing: !current || revision !== state.revision,
    retry: () => setRevision((current) => current + 1),
  };
}
