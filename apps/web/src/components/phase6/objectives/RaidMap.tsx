"use client";

import { useEffect, useRef } from "react";
import type {
  RaidObjectiveRow,
  RaidParticipantRow,
} from "@/components/phase6/ReservoirRaidDetail";
import type { ObjectiveLang } from "@/lib/raid-objectives";
import { MapMarker } from "./MapMarker";

type Props = {
  objectives: RaidObjectiveRow[];
  participants: RaidParticipantRow[];
  planLang: ObjectiveLang;
  canEdit: boolean;
  isPending: boolean;
  isDesktop: boolean;
  onMarkerClick: (objectiveId: string) => void;
  onAssign: (objectiveId: string, participantId: string) => void;
  onUnassign: (objectiveId: string, participantId: string) => void;
};

export function RaidMap({
  objectives,
  participants,
  planLang,
  canEdit,
  isPending,
  isDesktop,
  onMarkerClick,
  onAssign,
  onUnassign,
}: Props) {
  // onAssign/onUnassign kept for potential future inline use; currently assignment goes through the sheet
  void isPending;
  void onAssign;
  void onUnassign;

  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDesktop) return;
    if (!mobileRef.current) return;

    let cleanup: (() => void) | undefined;

    import("@panzoom/panzoom").then(({ default: Panzoom }) => {
      if (!mobileRef.current) return;
      const pz = Panzoom(mobileRef.current, {
        maxScale: 4,
        contain: "outside",
      });
      const parent = mobileRef.current.parentElement;
      if (parent) {
        parent.addEventListener("wheel", pz.zoomWithWheel);
        cleanup = () => {
          parent.removeEventListener("wheel", pz.zoomWithWheel);
          pz.destroy();
        };
      }
    });

    return () => cleanup?.();
  }, [isDesktop]);

  const mapSrc = `/map.png`;

  const markers = objectives.map((obj) => (
    <MapMarker
      key={obj.id}
      objective={obj}
      planLang={planLang}
      canEdit={canEdit}
      isDesktop={isDesktop}
      onClick={() => obj.isAssignable && onMarkerClick(obj.id)}
    />
  ));

  if (!isDesktop) {
    return (
      <div
        className="relative overflow-hidden rounded-md border border-border-subtle"
        style={{ touchAction: "none" }}
      >
        <div ref={mobileRef} className="relative">
          <img
            src={mapSrc}
            alt="Reservoir Raid map"
            className="w-full h-auto block"
            draggable={false}
          />
          {markers}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-md border border-border-subtle overflow-hidden">
      <img
        src={mapSrc}
        alt="Reservoir Raid map"
        className="w-full h-auto block"
        draggable={false}
      />
      {markers}
    </div>
  );
}
