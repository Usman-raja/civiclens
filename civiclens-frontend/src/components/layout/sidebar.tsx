"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Video,
  Grid3x3,
  BellRing,
  Users,
  ShieldAlert,
  UserSearch,
  BarChart3,
  Camera,
  FileText,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard, code: "OVR" },
  { href: "/live-monitoring", label: "Live Monitoring", icon: Video, code: "LIV" },
  { href: "/camera-wall", label: "Camera Wall", icon: Grid3x3, code: "WAL" },
  { href: "/alerts", label: "Alerts", icon: BellRing, code: "ALR" },
  { href: "/profiles", label: "Citizens", icon: Users, code: "CTZ" },
  { href: "/watchlist", label: "Watchlist", icon: ShieldAlert, code: "WCH" },
  { href: "/missing-persons", label: "Missing Persons", icon: UserSearch, code: "MIS" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, code: "ANL" },
  { href: "/cameras", label: "Cameras", icon: Camera, code: "CAM" },
  { href: "/reports", label: "Reports", icon: FileText, code: "RPT" },
  { href: "/settings", label: "Settings", icon: Settings, code: "SET" },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-hairline bg-panel transition-transform duration-200",
          "md:relative md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex size-8 items-center justify-center rounded-md bg-signal-cyan/10 text-signal-cyan">
              <ShieldCheck className="size-4.5" />
              <span className="absolute -right-0.5 -top-0.5 size-2 animate-blink rounded-full bg-signal-green" />
            </div>
            <div>
              <div className="font-display text-sm font-bold tracking-wide text-ink">CIVICLENS</div>
              <div className="font-mono text-[10px] tracking-wider text-ink-faint">COMMAND CENTER</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-faint hover:text-ink md:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  active
                    ? "bg-signal-cyan/10 text-signal-cyan shadow-[inset_2px_0_0_0_var(--signal-cyan)]"
                    : "text-ink-dim hover:bg-panel-raised hover:text-ink"
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "animate-glow")} strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
                <span
                  className={cn(
                    "font-mono text-[9px] tracking-widest transition-opacity",
                    active ? "text-signal-cyan/70 opacity-100" : "text-ink-faint opacity-0 group-hover:opacity-60"
                  )}
                >
                  {item.code}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-hairline px-4 py-3">
          <div className="flex items-center gap-2.5 font-mono text-[11px] text-ink-faint">
            <span className="eq-bars text-signal-green">
              <span /><span /><span /><span />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal-green opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-signal-green" />
              </span>
              SYSTEM OPERATIONAL
            </span>
          </div>
          <div className="mt-2.5 border-t border-hairline/60 pt-2.5">
            <div className="font-display text-xs font-semibold tracking-wide text-ink-dim">Usman Farid</div>
            <div className="mt-0.5">
              <span className="font-mono text-[9px] tracking-[0.15em] text-ink-faint/50">MADE IN PAKISTAN</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
