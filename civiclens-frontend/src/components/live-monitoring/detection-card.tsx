"use client";

import { useRef, useState } from "react";
import { Badge, riskTone } from "@/components/ui/badge";
import { ScoreDot } from "@/components/ui/score-dot";
import { imageUrl, type RedlistAlert, type DetectionResult, type MissingPersonAlertData, type CrowdEventData, type SceneEventHit } from "@/lib/api";
import { ShieldAlert, ScanFace, UserSearch, Users, TrendingUp, Clock, Package, GripVertical, Siren, X } from "lucide-react";

interface Position {
  x: number;
  y: number;
}

export function DetectionCard({
  tone,
  redlistData,
  knownData,
  missingData,
  crowdData,
  sceneData,
  position,
  onMove,
  onDismiss,
}: {
  tone: "redlist" | "known" | "missing" | "crowd" | "surge" | "loitering" | "unattended" | "accident";
  redlistData?: RedlistAlert;
  knownData?: DetectionResult;
  missingData?: MissingPersonAlertData;
  crowdData?: CrowdEventData;
  sceneData?: SceneEventHit;
  position: Position;
  onMove: (pos: Position) => void;
  onDismiss: () => void;
}) {
  const draggingRef = useRef(false);
  const startPointer = useRef<Position>({ x: 0, y: 0 });
  const startPos = useRef<Position>(position);
  const [pos, setPos] = useState(position);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    startPointer.current = { x: e.clientX, y: e.clientY };
    startPos.current = pos;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startPointer.current.x;
    const dy = e.clientY - startPointer.current.y;
    setPos({ x: startPos.current.x + dx, y: startPos.current.y + dy });
  };
  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    onMove(pos);
  };

  const isRedlist = tone === "redlist";
  const isMissing = tone === "missing";
  const isCrowd = tone === "crowd";
  const isSurge = tone === "surge";
  const isLoitering = tone === "loitering";
  const isUnattended = tone === "unattended";
  const isAccident = tone === "accident";

  const borderClass = isRedlist || isSurge || isUnattended || isAccident
    ? "border-signal-red bg-signal-red/10"
    : isMissing
      ? "border-signal-green bg-signal-green/10"
      : isCrowd || isLoitering
        ? "border-signal-amber bg-signal-amber/10"
        : "border-signal-cyan bg-panel/90";

  const headerTextClass = isRedlist || isSurge || isUnattended || isAccident
    ? "text-signal-red"
    : isMissing
      ? "text-signal-green"
      : isCrowd || isLoitering
        ? "text-signal-amber"
        : "text-signal-cyan";

  const headerIcon = isRedlist ? <ShieldAlert className="size-3" />
    : isMissing ? <UserSearch className="size-3" />
    : isCrowd ? <Users className="size-3" />
    : isSurge ? <TrendingUp className="size-3" />
    : isLoitering ? <Clock className="size-3" />
    : isUnattended ? <Package className="size-3" />
    : isAccident ? <Siren className="size-3" />
    : <ScanFace className="size-3" />;

  const headerLabel = isRedlist ? "Watchlist match"
    : isMissing ? "Missing person found"
    : isCrowd ? "Crowd alert"
    : isSurge ? "Surge risk"
    : isLoitering ? "Loitering"
    : isUnattended ? "Unattended object"
    : isAccident ? "Road accident"
    : "Live match";

  return (
    <div
      className={`absolute w-64 rounded-md border-2 shadow-xl backdrop-blur-md ${borderClass}`}
      style={{ left: pos.x, top: pos.y, zIndex: 20 }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex cursor-grab items-center justify-between rounded-t-md border-b border-hairline/50 px-2 py-1 active:cursor-grabbing"
      >
        <span className={`flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${headerTextClass}`}>
          {headerIcon}
          {headerLabel}
        </span>
        <div className="flex items-center gap-1">
          <GripVertical className="size-3.5 text-ink-faint" />
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="text-ink-faint hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3">
        {isRedlist && redlistData ? (
          <>
            <div className="flex items-center gap-3">
              {redlistData.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl(redlistData.photo) ?? undefined} alt={redlistData.name}
                  className="size-14 rounded-md border border-signal-red/40 object-cover" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-md border border-signal-red/40 bg-panel text-ink-faint">
                  <ScanFace className="size-6" />
                </div>
              )}
              <div>
                <div className="font-display text-sm font-bold text-ink">{redlistData.name}</div>
                <div className="font-mono text-[11px] text-ink-faint">{redlistData.redlist_id}</div>
                <Badge tone={riskTone(redlistData.risk_level)} className="mt-1">{redlistData.risk_level} RISK</Badge>
              </div>
            </div>
            <div className="mt-2 space-y-0.5 font-mono text-[11px] text-ink-dim">
              <div>Similarity: <span className="text-ink">{(redlistData.similarity_score * 100).toFixed(1)}%</span></div>
              <div>Camera: <span className="text-ink">{redlistData.camera_name}</span></div>
              <div>Prior detections: <span className="text-ink">{redlistData.previous_detection_count}</span></div>
            </div>
            <div className="mt-2 rounded bg-panel-raised p-2 text-[11px] text-ink-dim">{redlistData.recommended_action}</div>
          </>

        ) : isMissing && missingData ? (
          <>
            <div className="flex items-center gap-3">
              {missingData.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl(missingData.photo) ?? undefined} alt={missingData.name}
                  className="size-14 rounded-md border border-signal-green/40 object-cover" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-md border border-signal-green/40 bg-panel text-ink-faint">
                  <UserSearch className="size-6" />
                </div>
              )}
              <div>
                <div className="font-display text-sm font-bold text-ink">{missingData.name}</div>
                <div className="font-mono text-[11px] text-ink-faint">{missingData.missing_id}</div>
                {missingData.age !== null && <Badge tone="green" className="mt-1">AGE {missingData.age}</Badge>}
              </div>
            </div>
            <div className="mt-2 space-y-0.5 font-mono text-[11px] text-ink-dim">
              <div>Similarity: <span className="text-ink">{(missingData.similarity_score * 100).toFixed(1)}%</span></div>
              <div>Camera: <span className="text-ink">{missingData.camera_name}</span></div>
              <div>Prior detections: <span className="text-ink">{missingData.previous_detection_count}</span></div>
            </div>
            {missingData.contact_info && (
              <div className="mt-2 rounded bg-panel-raised p-2 text-[11px] text-ink-dim">Notify: {missingData.contact_info}</div>
            )}
          </>

        ) : isCrowd && crowdData ? (
          <>
            <div className="flex items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-md border border-signal-amber/40 bg-panel text-signal-amber">
                <Users className="size-7" strokeWidth={1.5} />
              </div>
              <div>
                <div className="font-display text-2xl font-bold leading-none text-ink">
                  {crowdData.person_count}+
                  <span className="ml-1 text-xs font-normal text-ink-dim">persons</span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-ink-faint">in {crowdData.zone_name}</div>
              </div>
            </div>
            <div className="mt-2 space-y-0.5 font-mono text-[11px] text-ink-dim">
              <div>Camera: <span className="text-ink">{crowdData.camera_name}</span></div>
              {crowdData.occurred_at && (
                <div>Time: <span className="text-ink">{new Date(crowdData.occurred_at).toLocaleTimeString()}</span></div>
              )}
              {crowdData.image_url && (
                <div>Evidence:{" "}
                  <a href={imageUrl(crowdData.image_url) ?? "#"} target="_blank" rel="noreferrer" className="text-signal-cyan underline">view frame</a>
                </div>
              )}
            </div>
            <div className="mt-2 rounded border border-signal-amber/30 bg-signal-amber/10 p-2 text-[11px] text-ink-dim">
              {crowdData.recommended_action}
            </div>
          </>

        ) : (isSurge || isLoitering || isUnattended || isAccident) && sceneData ? (
          <>
            <div className="flex items-center gap-3">
              <div className={`flex size-14 items-center justify-center rounded-md border bg-panel ${isSurge || isUnattended || isAccident ? "border-signal-red/40 text-signal-red" : "border-signal-amber/40 text-signal-amber"}`}>
                {isSurge ? <TrendingUp className="size-7" strokeWidth={1.5} />
                  : isLoitering ? <Clock className="size-7" strokeWidth={1.5} />
                  : isAccident ? <Siren className="size-7" strokeWidth={1.5} />
                  : <Package className="size-7" strokeWidth={1.5} />}
              </div>
              <div>
                {isSurge && (
                  <div className="font-display text-lg font-bold leading-tight text-ink">
                    +{sceneData.increase ?? "?"}<span className="ml-1 text-xs font-normal text-ink-dim">persons</span>
                    <div className="mt-0.5 font-mono text-[11px] text-ink-faint">in {sceneData.window_seconds ?? "?"}s</div>
                  </div>
                )}
                {isLoitering && (
                  <div className="font-display text-sm font-bold text-ink">
                    Restricted zone
                    <div className="mt-0.5 font-mono text-[11px] text-ink-faint">{sceneData.zone_name ?? "restricted_zone"}</div>
                  </div>
                )}
                {isUnattended && (
                  <div className="font-display text-sm font-bold text-ink">
                    {sceneData.object_id ?? "Object"}
                    <div className="mt-0.5 font-mono text-[11px] text-ink-faint">{sceneData.dwell_seconds ?? "?"}s unattended</div>
                  </div>
                )}
                {isAccident && (
                  <div className="font-display text-sm font-bold text-ink">
                    {sceneData.detail ?? "Probable accident"}
                    <div className="mt-0.5 font-mono text-[11px] text-ink-faint">
                      {sceneData.type === "fallen_person" ? "person lying on road"
                        : sceneData.type === "person_vehicle_overlap" ? "person under vehicle"
                        : sceneData.type === "vehicle_collision" ? "two vehicles in contact"
                        : sceneData.type === "crashed_vehicle_pair" ? "two vehicles stopped together"
                        : "vehicle stopped on road"}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2 space-y-0.5 font-mono text-[11px] text-ink-dim">
              <div>Camera: <span className="text-ink">{sceneData.camera_name}</span></div>
              {sceneData.occurred_at && (
                <div>Time: <span className="text-ink">{new Date(sceneData.occurred_at).toLocaleTimeString()}</span></div>
              )}
            </div>
            <div className={`mt-2 rounded border p-2 text-[11px] text-ink-dim ${isSurge || isUnattended ? "border-signal-red/30 bg-signal-red/10" : "border-signal-amber/30 bg-signal-amber/10"}`}>
              {sceneData.recommended_action}
            </div>
          </>

        ) : knownData ? (
          <div className="flex items-center gap-3">
            <ScoreDot color={knownData.score_color ?? "gray"} size="lg" />
            <div>
              <div className="font-display text-sm font-bold text-ink">{knownData.name}</div>
              <div className="font-mono text-[11px] text-ink-faint">{knownData.person_id}</div>
              <div className="mt-1 font-mono text-[11px] text-ink-dim">
                Confidence: <span className="text-ink">{((knownData.match_confidence ?? 0) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
