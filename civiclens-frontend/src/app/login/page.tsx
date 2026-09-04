"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, Loader2, Fingerprint } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [mode, setMode] = useState<"loading" | "login" | "bootstrap">("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace("/");
      return;
    }
    api.auth
      .needsBootstrap()
      .then((r) => setMode(r.needs_bootstrap ? "bootstrap" : "login"))
      .catch(() => setMode("login"));
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "bootstrap") {
        await api.auth.bootstrap(username, password, fullName);
      }
      await login(username, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^\d+\s\w+:\s*/, "") : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-void">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex size-16 items-center justify-center">
            <span className="absolute inset-0 animate-radar rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,color-mix(in_srgb,var(--signal-cyan)_40%,transparent)_360deg)]" />
            <ShieldCheck className="size-7 text-signal-cyan" />
          </div>
          <p className="animate-blink font-mono text-[11px] tracking-[0.3em] text-ink-faint">
            INITIALIZING SECURE ENVIRONMENT
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-overlay relative flex h-screen items-center justify-center bg-aurora">
      <div className="scanline-strong" />

      <div className="hud-corners relative w-full max-w-sm rounded-lg border border-hairline-bright bg-panel/90 p-8 shadow-[0_0_60px_rgba(53,199,224,0.08)] backdrop-blur-xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="relative flex size-12 items-center justify-center rounded-lg border border-signal-cyan/40 bg-signal-cyan/10">
            <Fingerprint className="size-6 text-signal-cyan" />
            <span className="absolute -right-1 -top-1 size-2 animate-blink rounded-full bg-signal-green" />
          </div>
          <h1 className="font-display text-xl font-bold tracking-wide text-ink">CIVICLENS</h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">Command Center</p>
        </div>

        {mode === "bootstrap" && (
          <div className="mb-4 rounded-md border border-signal-amber/40 bg-signal-amber/5 p-3 text-xs text-signal-amber">
            First-time setup: create the initial administrator account. This option disappears once an admin exists.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "bootstrap" && (
            <div>
              <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-dim">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-md border border-hairline-bright bg-panel-raised px-3 py-2 text-sm text-ink outline-none transition-shadow focus:border-signal-cyan focus:shadow-[0_0_0_3px_rgba(53,199,224,0.1)]"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-dim">Operator ID</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-hairline-bright bg-panel-raised px-3 py-2 text-sm text-ink outline-none transition-shadow focus:border-signal-cyan focus:shadow-[0_0_0_3px_rgba(53,199,224,0.1)]"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-dim">Passphrase</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-hairline-bright bg-panel-raised px-3 py-2 text-sm text-ink outline-none transition-shadow focus:border-signal-cyan focus:shadow-[0_0_0_3px_rgba(53,199,224,0.1)]"
            />
            {mode === "bootstrap" && (
              <p className="mt-1 text-[10px] text-ink-faint">At least 8 characters.</p>
            )}
          </div>

          {error && <p className="font-mono text-xs text-signal-red">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-signal-cyan px-4 py-2 text-sm font-semibold text-void shadow-[0_0_24px_rgba(53,199,224,0.25)] transition-all hover:shadow-[0_0_36px_rgba(53,199,224,0.4)] disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "bootstrap" ? "Create admin & sign in" : "Authenticate"}
          </button>
        </form>

        <div className="mt-6 border-t border-hairline pt-4 text-center">
          <div className="font-display text-xs font-semibold tracking-wide text-ink-dim">Usman Farid</div>
          <div className="mt-0.5 font-mono text-[10px] text-ink-faint/60">0317 750 5992</div>
          <div className="mt-1 font-mono text-[9px] tracking-[0.2em] text-ink-faint/50">MADE IN PAKISTAN</div>
        </div>
      </div>
    </div>
  );
}
