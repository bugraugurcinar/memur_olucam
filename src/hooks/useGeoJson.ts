import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";

type GeoJsonState = {
  data: FeatureCollection | null;
  error: string | null;
  isLoading: boolean;
};

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "FeatureCollection" &&
    "features" in value &&
    Array.isArray(value.features)
  );
}

export function useGeoJson(url: string | null): GeoJsonState {
  const [state, setState] = useState<GeoJsonState>({
    data: null,
    error: null,
    isLoading: url !== null,
  });

  useEffect(() => {
    if (!url) {
      setState({ data: null, error: null, isLoading: false });
      return;
    }

    const requestUrl = url;
    const controller = new AbortController();

    async function loadGeoJson() {
      setState({ data: null, error: null, isLoading: true });

      try {
        const response = await fetch(requestUrl, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        const nextData = (await response.json()) as unknown;

        if (!isFeatureCollection(nextData)) {
          throw new Error("GeoJSON FeatureCollection bekleniyordu.");
        }

        setState({ data: nextData, error: null, isLoading: false });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          data: null,
          error: error instanceof Error ? error.message : "GeoJSON yüklenemedi.",
          isLoading: false,
        });
      }
    }

    void loadGeoJson();

    return () => {
      controller.abort();
    };
  }, [url]);

  return state;
}
