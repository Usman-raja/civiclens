"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DetectionHistoryProvider } from "@/lib/detection-history-store";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Loader2, Menu } from "lucide-react";

function Gate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    if (!loading && !user && !isLoginRoute) {
      router.replace("/login");
    }
  }, [loading, user, isLoginRoute, router]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-void">
        <Loader2 className="size-6 animate-spin text-signal-cyan" />
      </div>
    );
  }

  return (
    <DetectionHistoryProvider>
      <div className="bg-aurora flex h-screen overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={closeSidebar} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-3 md:hidden px-4 pt-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md border border-hairline-bright p-2 text-ink-dim hover:text-ink"
            >
              <Menu className="size-4" />
            </button>
          </div>
          <Topbar />
          <main className="grid-overlay relative flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </DetectionHistoryProvider>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}
