"use client";

import Panzoom, { type PanzoomObject } from "@panzoom/panzoom";
import { useCallback, useEffect, useRef } from "react";

export function useMapPanzoom() {
  const mapRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<PanzoomObject | null>(null);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const panzoom = Panzoom(map, {
      contain: "outside",
      maxScale: 3.5,
      minScale: 1,
      panOnlyWhenZoomed: true,
      step: 0.25,
    });
    const canvas = map.parentElement;

    function zoomWithWheel(event: WheelEvent) {
      panzoom.zoomWithWheel(event);
    }

    canvas?.addEventListener("wheel", zoomWithWheel, { passive: false });
    panzoomRef.current = panzoom;

    return () => {
      canvas?.removeEventListener("wheel", zoomWithWheel);
      panzoom.destroy();
      panzoomRef.current = null;
    };
  }, []);

  const resetView = useCallback(() => {
    panzoomRef.current?.reset();
  }, []);

  const zoomIn = useCallback(() => {
    panzoomRef.current?.zoomIn();
  }, []);

  const zoomOut = useCallback(() => {
    panzoomRef.current?.zoomOut();
  }, []);

  return { mapRef, resetView, zoomIn, zoomOut };
}
