"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { LogOut, Radar } from "lucide-react";

export function Topbar() {
  const [now, setNow] = useState<Date | null>(null);
  const { user, isAdmin, logout } = useAuth();

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const initial = user?.full_name?.charAt(0)?.toUpperCase() ?? user?.username?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <header className="flex h-14 items-center justify-between border-b border-hairline bg-panel/60 px-6 backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="relative flex size-5 items-center justify-center">
          <Radar className="size-5 text-signal-cyan/80" />
          <span className="absolute inset-0 animate-radar rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,color-mix(in_srgb,var(--signal-cyan)_35%,transparent)_360deg)]" />
        </div>
        <div className="font-mono text-xs text-ink-dim">
          {now
            ? now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
            : ""}
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="font-mono text-sm tabular-nums text-signal-cyan text-glow-cyan">
          {now ? now.toLocaleTimeString() : "--:--:--"}
          <span className="ml-2 text-[10px] text-ink-faint">LOCAL</span>
        </div>
        <div className="flex items-center gap-2 border-l border-hairline pl-6">
          <div className="flex size-7 items-center justify-center rounded-full bg-panel-raised text-xs font-semibold text-ink ring-1 ring-hairline-bright">
            {initial}
          </div>
          <div className="text-xs">
            <div className="font-medium text-ink">{user?.full_name || user?.username || "—"}</div>
            <div className={isAdmin ? "text-signal-cyan" : "text-ink-faint"}>
              {isAdmin ? "Administrator" : "Operator"}
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="ml-2 flex size-7 items-center justify-center rounded-md text-ink-faint hover:bg-panel-raised hover:text-ink"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
