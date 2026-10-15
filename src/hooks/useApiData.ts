"use client";
import { useEffect, useState } from "react";

export function useApiData<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{
    data: T | null;
    error: unknown;
    loading: boolean;
    load: typeof load | null;
    revision: number;
  }>({ data: null, error: null, loading: true, load: null, revision: 0 });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, error: null, loading: false, load, revision });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ data: null, error, loading: false, load, revision });
      });
    return () => controller.abort();
  }, [load, revision]);
  const current = state.load === load && state.revision === revision;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current || state.loading,
    retry: () => setRevision((value) => value + 1),
  };
}
