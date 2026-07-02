"use client";

// components/credential-vault.tsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  KeySquare, Plus, Trash2, Pencil, Eye, EyeOff, Copy, Check,
  Shield, AlertTriangle, Lock, Star, StarOff, Download, Upload,
  RefreshCw, Database, Clock, BarChart2, ChevronDown, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { VaultEntryDialog } from "@/components/vault-entry-dialog";
import type { VaultEntryForm } from "@/components/vault-entry-dialog";
import { VaultImportDialog } from "@/components/vault-import-dialog";
import { STRENGTH_CONFIG } from "@/lib/vault-strength";
import type { VaultEntry, VaultHealthStats, VaultAuditLog } from "@/types/vault";
import { DEPARTMENTS, TAGS } from "@/types/vault";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;
const AUTO_LOCK_MS  = 15 * 60 * 1000;
const WARN_AT_MS    =  2 * 60 * 1000;
const REVEAL_MS     = 30 * 1000;

// ─── Shared styles ────────────────────────────────────────────────────────────

const termBtn =
  "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

// ─── FilterDropdown — dark custom select ─────────────────────────────────────

function FilterDropdown<T extends string | number>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { label: string; value: T }[];
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  React.useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all whitespace-nowrap"
        style={{
          backgroundColor: open || value ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.03)",
          borderColor: open || value ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.1)",
          color: value ? "#34d399" : "rgba(255,255,255,0.5)",
        }}
      >
        {selected.label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-50 top-full mt-1 left-0 min-w-full overflow-hidden"
          style={{
            backgroundColor: "#0d1117",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          }}
        >
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-left transition-all"
              style={{
                backgroundColor: opt.value === value ? "rgba(52,211,153,0.1)" : "transparent",
                color: opt.value === value ? "#34d399" : "rgba(255,255,255,0.55)",
              }}
              onMouseEnter={(e) => { if (opt.value !== value) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { if (opt.value !== value) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check className="h-3 w-3 shrink-0" style={{ color: "#34d399" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TerminalDot({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center justify-center w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
  );
}

function THead({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.15em] whitespace-nowrap select-none"
      style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      {children}
    </th>
  );
}

function TCell({ children, mono }: { children?: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`px-3 py-2.5 text-[11px] whitespace-nowrap ${mono ? "font-mono" : ""}`}
      style={{ color: "rgba(255,255,255,0.65)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      {children ?? <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>}
    </td>
  );
}

function StrengthBadge({ strength }: { strength?: string | null }) {
  if (!strength) return (
    <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border font-mono"
      style={{ color: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
      UNRATED
    </span>
  );
  const cfg = STRENGTH_CONFIG[strength as keyof typeof STRENGTH_CONFIG];
  if (!cfg) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border font-mono"
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}>
      {cfg.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, accent, onClick }: {
  icon: React.ElementType; label: string; value: number; accent: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick}
      className={`relative border p-4 font-mono overflow-hidden ${onClick ? "cursor-pointer hover:brightness-125 transition-all" : ""}`}
      style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
      <div className="absolute top-0 left-0 w-0.5 h-full" style={{ backgroundColor: accent }} />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</span>
        <Icon className="h-3.5 w-3.5 opacity-30" style={{ color: accent }} />
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: accent }}>{value}</div>
    </div>
  );
}

// ─── Auto-lock overlay ────────────────────────────────────────────────────────

function LockScreen({ onUnlock, lockFails, onFail }: {
  onUnlock: (pw: string) => Promise<void>;
  lockFails: number;
  onFail: () => void;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pw) return;
    setBusy(true);
    try { await onUnlock(pw); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-mono"
      style={{ backgroundColor: "rgba(8,12,16,0.97)", backdropFilter: "blur(8px)" }}>
      <div className="flex flex-col items-center gap-6 p-8 border max-w-sm w-full"
        style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#0d1117" }}>
        <Lock className="h-10 w-10" style={{ color: "#f87171" }} />
        <div className="text-center">
          <p className="text-sm uppercase tracking-widest text-white mb-1">Vault Locked</p>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            Session expired due to inactivity. Re-enter your password.
          </p>
        </div>
        {lockFails >= 2 && (
          <p className="text-[10px]" style={{ color: "#f87171" }}>
            {3 - lockFails} attempt(s) remaining.
          </p>
        )}
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full px-3 py-2 text-[11px] border text-center"
          style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", outline: "none" }}
          placeholder="Enter password..."
          autoFocus
        />
        <button onClick={submit} disabled={busy || !pw}
          className={`${termBtn} w-full justify-center`}
          style={{ backgroundColor: "rgba(248,113,113,0.15)", borderColor: "rgba(248,113,113,0.4)", color: "#f87171" }}>
          {busy ? "VERIFYING..." : "UNLOCK VAULT"}
        </button>
      </div>
    </div>
  );
}

// ─── Verify-password modal (gates reveal/copy) ───────────────────────────────

interface VerifyModalProps {
  open: boolean;
  email: string;
  actionLabel: string;
  onVerified: () => void;
  onCancel: () => void;
}

function VerifyPasswordModal({ open, email, actionLabel, onVerified, onCancel }: VerifyModalProps) {
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setPw(""); setErr(""); setShowPw(false); setTimeout(() => inputRef.current?.focus(), 80); }
  }, [open]);

  if (!open) return null;

  async function submit() {
    if (!pw) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email: email, Password: pw }),
      });
      if (r.ok) { onVerified(); }
      else { setErr("Incorrect password. Please try again."); setPw(""); inputRef.current?.focus(); }
    } catch { setErr("Could not verify. Check your connection."); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-mono"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm border flex flex-col gap-0"
        style={{ backgroundColor: "#0a0e14", borderColor: "rgba(255,255,255,0.12)", boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 border"
              style={{ borderColor: "rgba(248,113,113,0.35)", backgroundColor: "rgba(248,113,113,0.1)" }}>
              <Lock className="h-3.5 w-3.5" style={{ color: "#f87171" }} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-white">Confirm Identity</p>
              <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Required to {actionLabel}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="hover:opacity-70 transition-opacity">
            <X className="h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4">
          <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            Enter your account password to access this credential. Access is logged for security.
          </p>

          <div className="relative">
            <input
              ref={inputRef}
              type={showPw ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full px-3 py-2.5 text-[11px] pr-10 border"
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                borderColor: err ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.85)",
                outline: "none",
              }}
              placeholder="Enter your password..."
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 transition-opacity">
              {showPw ? <EyeOff className="h-4 w-4 text-white" /> : <Eye className="h-4 w-4 text-white" />}
            </button>
          </div>

          {err && (
            <div className="flex items-center gap-2 text-[10px] px-3 py-2 border"
              style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.25)", backgroundColor: "rgba(248,113,113,0.07)" }}>
              <AlertTriangle className="h-3 w-3 shrink-0" /> {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t"
          style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.2)" }}>
          <button onClick={onCancel} disabled={busy}
            className="px-4 py-1.5 text-[10px] uppercase tracking-widest font-bold border transition-all hover:bg-white/5"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !pw}
            className="flex items-center gap-2 px-5 py-1.5 text-[10px] uppercase tracking-widest font-bold border transition-all disabled:opacity-40 hover:brightness-125"
            style={{ borderColor: "rgba(52,211,153,0.4)", backgroundColor: "rgba(52,211,153,0.12)", color: "#34d399" }}>
            {busy
              ? <><span className="w-3 h-3 border-t border-current rounded-full animate-spin" /> Verifying...</>
              : <><Check className="h-3 w-3" /> Confirm</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditPanel({ entryId, userId }: { entryId: number; userId: string }) {
  const [logs, setLogs] = useState<VaultAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/vault/audit-logs?credential_id=${entryId}`)
      .then((r) => r.json())
      .then((d) => setLogs(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entryId]);

  if (loading) return (
    <div className="flex items-center gap-2 py-4 px-4 text-[9px] uppercase tracking-widest"
      style={{ color: "rgba(255,255,255,0.25)" }}>
      <div className="w-3 h-3 border-t border-current rounded-full animate-spin" /> LOADING AUDIT LOG...
    </div>
  );

  if (logs.length === 0) return (
    <p className="px-4 py-3 text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
      No audit activity recorded for this entry.
    </p>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            {["Action", "User", "IP Address", "Timestamp"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[9px] uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.25)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="px-3 py-2 font-mono uppercase" style={{ color: "#34d399", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {log.action}
              </td>
              <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.6)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {log.user_name ?? log.user_id}
              </td>
              <td className="px-3 py-2 font-mono" style={{ color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {log.ip_address ?? "—"}
              </td>
              <td className="px-3 py-2 font-mono" style={{ color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {new Date(log.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CredentialVault({ userId }: { userId: string }) {
  // ── Data ────────────────────────────────────────────────────────────────────
  const [entries, setEntries]     = useState<VaultEntry[]>([]);
  const [health, setHealth]       = useState<VaultHealthStats | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userPosition, setUserPosition] = useState<string>("");

  // ── UI state ────────────────────────────────────────────────────────────────
  const [search, setSearch]       = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [expiryDays, setExpiryDays] = useState<7 | 30 | 90 | 0>(0);
  const [strengthFilter, setStrengthFilter] = useState("");
  const [page, setPage]           = useState(1);

  // ── Dialogs ─────────────────────────────────────────────────────────────────
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry]       = useState<VaultEntry | null>(null);
  const [entryLoading, setEntryLoading]       = useState(false);
  const [deleteTarget, setDeleteTarget]       = useState<VaultEntry | null>(null);
  const [deleteLoading, setDeleteLoading]     = useState(false);
  const [importOpen, setImportOpen]           = useState(false);
  const [importLoading, setImportLoading]     = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [expandedId, setExpandedId]           = useState<number | null>(null);

  // ── Reveal state ────────────────────────────────────────────────────────────
  const [revealMap, setRevealMap] = useState<Record<number, string>>({});
  const revealTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // ── Identity verification (gates reveal/copy) ────────────────────────────────
  const VERIFY_TTL_MS = 5 * 60 * 1000; // verified session lasts 5 minutes
  const verifiedUntil = useRef<number>(0);
  const [verifyOpen, setVerifyOpen]       = useState(false);
  const [verifyAction, setVerifyAction]   = useState<"reveal" | "copy">("reveal");
  const [verifyTarget, setVerifyTarget]   = useState<VaultEntry | null>(null);
  const [verifyLabel, setVerifyLabel]     = useState("");

  // ── Auto-lock ────────────────────────────────────────────────────────────────
  const [locked, setLocked]         = useState(false);
  const [lockFails, setLockFails]   = useState(0);
  const [countdown, setCountdown]   = useState<number | null>(null);
  const inactivityTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivity = useRef<number>(Date.now());

  // ── Fetch user info ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        setReferenceId(d.ReferenceID ?? "");
        setUserEmail(d.Email ?? "");
        setUserPosition(d.Position ?? d.Role ?? "");
      })
      .catch(() => {});
  }, [userId]);

  // ── Fetch entries ────────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/vault/entries");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to fetch entries");
      setEntries(d.data ?? []);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const r = await fetch("/api/vault/health");
      if (!r.ok) return;
      setHealth(await r.json());
    } catch {}
  }, []);

  const fetchReminders = useCallback(async () => {
    try {
      const r = await fetch("/api/vault/reminders");
      if (!r.ok) return;
      const d = await r.json();
      (d.data ?? []).forEach((item: { service_name: string; days: number }) => {
        toast.warning(`🔔 "${item.service_name}" review due in ${item.days} day(s).`, { duration: 10000 });
      });
    } catch {
      toast.error("Could not load credential reminders.", { duration: 5000 });
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchHealth();
    fetchReminders();
  }, [fetchEntries, fetchHealth, fetchReminders]);

  // ── Auto-lock logic ──────────────────────────────────────────────────────────

  const lockVault = useCallback(() => {
    setLocked(true);
    setRevealMap({});
    Object.values(revealTimers.current).forEach(clearTimeout);
    revealTimers.current = {};
    setCountdown(null);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  }, []);

  const resetTimer = useCallback(() => {
    lastActivity.current = Date.now();
    setCountdown(null);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);

    inactivityTimer.current = setTimeout(lockVault, AUTO_LOCK_MS);

    // start countdown warning at WARN_AT_MS before lock
    const warnAt = AUTO_LOCK_MS - WARN_AT_MS;
    setTimeout(() => {
      let remaining = Math.ceil(WARN_AT_MS / 1000);
      setCountdown(remaining);
      countdownInterval.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0 && countdownInterval.current) {
          clearInterval(countdownInterval.current);
        }
      }, 1000);
    }, warnAt);
  }, [lockVault]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const handler = () => { if (!locked) resetTimer(); };
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [locked, resetTimer]);

  async function handleUnlock(password: string) {
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email: userEmail, Password: password }),
      });
      if (r.ok) {
        setLocked(false);
        setLockFails(0);
        resetTimer();
      } else {
        const fails = lockFails + 1;
        setLockFails(fails);
        toast.error("Incorrect password.");
        if (fails >= 3) {
          window.location.href = `/auth/login`;
        }
      }
    } catch {
      toast.error("Could not verify password.");
    }
  }

  // ── Identity verify gate ─────────────────────────────────────────────────────

  function requireVerify(action: "reveal" | "copy", entry: VaultEntry, label: string, cb: () => void) {
    if (locked) return;
    if (Date.now() < verifiedUntil.current) { cb(); return; }
    setVerifyAction(action);
    setVerifyTarget(entry);
    setVerifyLabel(label);
    // Store cb reference to call after verification
    pendingVerifyAction.current = cb;
    setVerifyOpen(true);
  }

  const pendingVerifyAction = useRef<(() => void) | null>(null);

  function onVerified() {
    verifiedUntil.current = Date.now() + VERIFY_TTL_MS;
    setVerifyOpen(false);
    if (pendingVerifyAction.current) { pendingVerifyAction.current(); pendingVerifyAction.current = null; }
  }

  // ── Reveal / copy helpers ────────────────────────────────────────────────────

  async function doReveal(entry: VaultEntry) {
    if (revealMap[entry.id]) {
      const next = { ...revealMap };
      delete next[entry.id];
      setRevealMap(next);
      if (revealTimers.current[entry.id]) { clearTimeout(revealTimers.current[entry.id]); delete revealTimers.current[entry.id]; }
      return;
    }
    try {
      const r = await fetch("/api/vault/reveal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to reveal");
      setRevealMap((p) => ({ ...p, [entry.id]: d.password }));
      if (revealTimers.current[entry.id]) clearTimeout(revealTimers.current[entry.id]);
      revealTimers.current[entry.id] = setTimeout(() => {
        setRevealMap((p) => { const n = { ...p }; delete n[entry.id]; return n; });
        delete revealTimers.current[entry.id];
      }, REVEAL_MS);
    } catch (err: any) { toast.error(err.message); }
  }

  async function doCopy(entry: VaultEntry) {
    try {
      const r = await fetch("/api/vault/copy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to copy");
      await navigator.clipboard.writeText(d.password);
      toast.success("Password copied to clipboard.", { duration: 3000 });
    } catch (err: any) { toast.error(err.message); }
  }

  function handleReveal(entry: VaultEntry) {
    if (locked) return;
    // Re-masking doesn't need re-verification
    if (revealMap[entry.id]) { doReveal(entry); return; }
    requireVerify("reveal", entry, "reveal this password", () => doReveal(entry));
  }

  function handleCopy(entry: VaultEntry) {
    if (locked) return;
    requireVerify("copy", entry, "copy this password", () => doCopy(entry));
  }

  async function handleToggleFavorite(entry: VaultEntry) {
    try {
      const r = await fetch(`/api/vault/entry?id=${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: !entry.is_favorite }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setEntries((p) => p.map((e) => e.id === entry.id ? { ...e, is_favorite: !e.is_favorite } : e));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // ── CRUD handlers ────────────────────────────────────────────────────────────

  async function handleEntrySubmit(form: VaultEntryForm) {
    setEntryLoading(true);
    try {
      const isEdit = !!editingEntry;
      const url = isEdit ? `/api/vault/entry?id=${editingEntry!.id}` : "/api/vault/entries";
      const method = isEdit ? "PATCH" : "POST";
      const body: Record<string, unknown> = { ...form };
      if (isEdit && !form.password) delete body.password;

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to save");

      if (d.reuse_warning?.length) {
        toast.warning(`⚠️ Same password used in: ${d.reuse_warning.join(", ")}`, { duration: 8000 });
      }
      toast.success(isEdit ? "Credential updated." : "Credential created.");
      setEntryDialogOpen(false);
      setEditingEntry(null);

      // If this was an edit and the password was changed, clear the cached
      // plaintext so the stale old password isn't shown after re-fetch.
      if (isEdit && form.password) {
        const entryId = editingEntry!.id;
        setRevealMap((p) => { const n = { ...p }; delete n[entryId]; return n; });
        if (revealTimers.current[entryId]) {
          clearTimeout(revealTimers.current[entryId]);
          delete revealTimers.current[entryId];
        }
        // Also reset verification window so next reveal requires re-confirmation
        verifiedUntil.current = 0;
      }

      fetchEntries();
      fetchHealth();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEntryLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const r = await fetch(`/api/vault/entry?id=${deleteTarget.id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to delete");
      toast.success("Credential deleted.");
      setDeleteTarget(null);
      fetchEntries();
      fetchHealth();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleImport(format: "json" | "csv", content: string) {
    setImportLoading(true);
    try {
      const r = await fetch("/api/vault/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, content }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.rowErrors) {
          toast.error(`Import failed — ${d.rowErrors.length} row(s) had validation errors.`, { duration: 8000 });
        } else {
          throw new Error(d.error ?? "Import failed");
        }
        return;
      }
      toast.success(`Imported ${d.count} credential(s).`);
      setImportOpen(false);
      fetchEntries();
      fetchHealth();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImportLoading(false);
    }
  }

  async function handleExport() {
    try {
      const r = await fetch("/api/vault/export");
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Export failed"); }
      const blob = await r.blob();
      const today = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vault-export-${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportConfirmOpen(false);
      toast.warning("⚠️ Export complete. This file contains sensitive encrypted data. Store it securely.", { duration: 10000 });
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // ── Filtering ────────────────────────────────────────────────────────────────

  const today = useMemo(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      if (q && !["service_name", "username", "login_url", "notes"].some(
        (k) => (e[k as keyof VaultEntry] as string ?? "").toLowerCase().includes(q)
      )) return false;
      if (deptFilter && e.department !== deptFilter) return false;
      if (tagFilter && !(e.tags ?? []).includes(tagFilter)) return false;
      if (strengthFilter && e.password_strength !== strengthFilter) return false;
      if (expiryDays > 0) {
        if (!e.review_date) return false;
        const rd = new Date(e.review_date);
        if (isNaN(rd.getTime())) return false;
        const cutoff = new Date(today);
        cutoff.setUTCDate(cutoff.getUTCDate() + expiryDays);
        if (rd > cutoff) return false;
      }
      return true;
    });
  }, [entries, search, deptFilter, tagFilter, strengthFilter, expiryDays, today]);

  const favorites  = useMemo(() => filtered.filter((e) => e.is_favorite), [filtered]);
  const nonFavs    = useMemo(() => filtered.filter((e) => !e.is_favorite), [filtered]);

  const pageCount  = Math.ceil(nonFavs.length / PAGE_SIZE);
  const paginated  = useMemo(() => nonFavs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [nonFavs, page]);

  const existingTags = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => (e.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [entries]);

  const reminderCount = useMemo(() => {
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const cutoff = new Date(today);
    cutoff.setUTCDate(cutoff.getUTCDate() + 30);
    return entries.filter((e) => {
      if (!e.review_date || !e.is_active) return false;
      const rd = new Date(e.review_date);
      if (isNaN(rd.getTime())) return false;
      return rd >= tomorrow && rd <= cutoff;
    }).length;
  }, [entries, today]);

  useEffect(() => { setPage(1); }, [search, deptFilter, tagFilter, strengthFilter, expiryDays]);

  const isAdmin = ["IT Admin", "IT Manager", "Super Admin"].includes(userPosition);

  // ── Row renderer ─────────────────────────────────────────────────────────────

  function EntryRow({ entry, isFav }: { entry: VaultEntry; isFav?: boolean }) {
    const revealed = revealMap[entry.id];
    const isExpanded = expandedId === entry.id;

    return (
      <>
        <tr
          style={{
            backgroundColor: isFav ? "rgba(251,191,36,0.03)" : "transparent",
            cursor: "default",
          }}
          className="hover:bg-white/[0.02] transition-colors"
        >
          <TCell>
            <button onClick={() => handleToggleFavorite(entry)}
              className="hover:opacity-80 transition-opacity">
              {entry.is_favorite
                ? <Star className="h-3.5 w-3.5" style={{ color: "#fbbf24" }} />
                : <StarOff className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.2)" }} />}
            </button>
          </TCell>
          <TCell>
            <span style={{ color: "#38bdf8" }}>{entry.service_name}</span>
          </TCell>
          <TCell>{entry.username}</TCell>
          <TCell>
            <div className="flex items-center gap-2">
              <span className="font-mono" style={{ color: revealed ? "#4ade80" : "rgba(255,255,255,0.3)" }}>
                {revealed ?? "••••••••"}
              </span>
              <button onClick={() => handleReveal(entry)} title={revealed ? "Hide" : "Reveal"}
                className="hover:opacity-80 transition-opacity">
                {revealed
                  ? <EyeOff className="h-3 w-3" style={{ color: "rgba(255,255,255,0.4)" }} />
                  : <Eye className="h-3 w-3" style={{ color: "rgba(255,255,255,0.4)" }} />}
              </button>
              <button onClick={() => handleCopy(entry)} title="Copy to clipboard"
                className="hover:opacity-80 transition-opacity">
                <Copy className="h-3 w-3" style={{ color: "rgba(255,255,255,0.4)" }} />
              </button>
            </div>
          </TCell>
          <TCell>
            {entry.department && (
              <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border font-mono"
                style={{ color: "#38bdf8", backgroundColor: "rgba(56,189,248,0.08)", borderColor: "rgba(56,189,248,0.2)" }}>
                {entry.department}
              </span>
            )}
          </TCell>
          <TCell><StrengthBadge strength={entry.password_strength} /></TCell>
          <TCell>
            {entry.review_date && (() => {
              const rd = new Date(entry.review_date);
              const diff = Math.ceil((rd.getTime() - today.getTime()) / 86400000);
              const color = diff < 0 ? "#f87171" : diff <= 30 ? "#fbbf24" : "rgba(255,255,255,0.4)";
              return <span className="font-mono text-[10px]" style={{ color }}>{entry.review_date}</span>;
            })()}
          </TCell>
          <TCell>
            <div className="flex items-center gap-1.5">
              {(entry.tags ?? []).slice(0, 3).map((t) => (
                <span key={t} className="px-1.5 py-0.5 text-[8px] border font-mono uppercase"
                  style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>
                  {t}
                </span>
              ))}
            </div>
          </TCell>
          <TCell>
            <div className="flex items-center gap-1">
              <button onClick={() => { setEditingEntry(entry); setEntryDialogOpen(true); }}
                className={`${termBtn} !px-2 !py-1`}
                style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)" }}>
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={() => setDeleteTarget(entry)}
                className={`${termBtn} !px-2 !py-1`}
                style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.2)" }}>
                <Trash2 className="h-3 w-3" />
              </button>
              <button onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                className={`${termBtn} !px-2 !py-1`}
                style={{ color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
                <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>
            </div>
          </TCell>
        </tr>
        {isExpanded && (
          <tr>
            <td colSpan={9} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}>
              <div className="px-4 py-3">
                {entry.notes && (
                  <p className="text-[10px] mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
                    <span className="uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>Notes: </span>
                    {entry.notes}
                  </p>
                )}
                {entry.login_url && (
                  <p className="text-[10px] mb-3">
                    <span className="uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>URL: </span>
                    <a href={entry.login_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#38bdf8" }} className="hover:underline">
                      {entry.login_url}
                    </a>
                  </p>
                )}
                <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Audit Log</p>
                <AuditPanel entryId={entry.id} userId={userId} />
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="font-mono flex flex-col gap-0" style={{ backgroundColor: "#080c10", minHeight: "100%" }}>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px", zIndex: 0 }} />

      {/* Auto-lock overlay */}
      {locked && (
        <LockScreen onUnlock={handleUnlock} lockFails={lockFails} onFail={() => { window.location.href = "/auth/login"; }} />
      )}

      {/* Countdown warning */}
      {!locked && countdown !== null && countdown > 0 && (
        <div className="fixed top-4 right-4 z-40 flex items-center gap-2 px-3 py-2 border font-mono text-[10px]"
          style={{ backgroundColor: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.3)", color: "#fbbf24" }}>
          <Clock className="h-3.5 w-3.5" />
          Vault locks in {countdown}s
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-0">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-3">
            <TerminalDot color="#34d399" />
            <KeySquare className="h-4 w-4" style={{ color: "#34d399" }} />
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>
              CREDENTIAL VAULT
            </span>
            {reminderCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold border font-mono"
                style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.08)" }}>
                {reminderCount} DUE SOON
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <>
                <button onClick={() => setImportOpen(true)} className={termBtn}
                  style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)" }}>
                  <Upload className="h-3 w-3" /> IMPORT
                </button>
                <button onClick={() => setExportConfirmOpen(true)} className={termBtn}
                  style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)" }}>
                  <Download className="h-3 w-3" /> EXPORT
                </button>
              </>
            )}
            <button onClick={() => { fetchEntries(); fetchHealth(); }} className={termBtn}
              style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }}>
              <RefreshCw className="h-3 w-3" />
            </button>
            <button onClick={() => { setEditingEntry(null); setEntryDialogOpen(true); }} className={termBtn}
              style={{ backgroundColor: "rgba(52,211,153,0.15)", borderColor: "rgba(52,211,153,0.4)", color: "#34d399" }}>
              <Plus className="h-3 w-3" /> ADD CREDENTIAL
            </button>
          </div>
        </div>

        {/* ── Health dashboard ─────────────────────────────────────────────── */}
        {health && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px border-b"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <StatCard icon={Database} label="Total"   value={health.total}   accent="#38bdf8" />
            <StatCard icon={Shield}   label="Strong"  value={health.strong}  accent="#22d3ee"
              onClick={() => setStrengthFilter(strengthFilter === "strong" ? "" : "strong")} />
            <StatCard icon={BarChart2} label="Good"   value={health.good}    accent="#4ade80"
              onClick={() => setStrengthFilter(strengthFilter === "good" ? "" : "good")} />
            <StatCard icon={BarChart2} label="Fair"   value={health.fair}    accent="#fbbf24"
              onClick={() => setStrengthFilter(strengthFilter === "fair" ? "" : "fair")} />
            <StatCard icon={AlertTriangle} label="Weak" value={health.weak}  accent="#f87171"
              onClick={() => setStrengthFilter(strengthFilter === "weak" ? "" : "weak")} />
            <StatCard icon={Clock}    label="Expired" value={health.expired} accent="#f87171"
              onClick={() => setExpiryDays(expiryDays === 7 ? 0 : 7)} />
            <StatCard icon={AlertTriangle} label="Reused" value={health.reused} accent="#a78bfa" />
          </div>
        )}

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}>
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none"
              style={{ color: "rgba(255,255,255,0.25)" }}>›</span>
            <input type="search" placeholder="SEARCH VAULT..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-6 pr-3 py-1.5 text-[10px] font-mono uppercase tracking-widest outline-none border placeholder:opacity-30"
              style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }} />
          </div>
          {/* Department filter */}
          <FilterDropdown
            value={deptFilter}
            onChange={setDeptFilter}
            options={[
              { label: "All Depts", value: "" },
              ...DEPARTMENTS.map((d) => ({ label: d, value: d })),
            ]}
          />
          {/* Tag filter */}
          <FilterDropdown
            value={tagFilter}
            onChange={setTagFilter}
            options={[
              { label: "All Tags", value: "" },
              ...existingTags.map((t) => ({ label: t, value: t })),
            ]}
          />
          {/* Expiry filter */}
          <FilterDropdown
            value={expiryDays}
            onChange={(v) => setExpiryDays(v as 0 | 7 | 30 | 90)}
            options={[
              { label: "Any Expiry", value: 0 },
              { label: "Expires in 7d", value: 7 },
              { label: "Expires in 30d", value: 30 },
              { label: "Expires in 90d", value: 90 },
            ]}
          />
          <span className="ml-auto text-[9px] uppercase tracking-widest px-2 py-0.5 border font-mono"
            style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.3)", backgroundColor: "rgba(52,211,153,0.06)" }}>
            {filtered.length} RECORDS
          </span>
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        {error ? (
          <div className="flex items-center gap-2 p-6 text-[11px] border m-4"
            style={{ borderColor: "rgba(248,113,113,0.3)", color: "#fca5a5", backgroundColor: "rgba(248,113,113,0.06)" }}>
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-3 py-16" style={{ color: "rgba(255,255,255,0.3)" }}>
            <div className="w-4 h-4 border-t border-current rounded-full animate-spin" />
            <span className="text-[10px] uppercase tracking-widest">LOADING VAULT...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <KeySquare className="h-8 w-8 opacity-10" />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
              NO CREDENTIALS FOUND
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 900 }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                  <THead>★</THead>
                  <THead>Service</THead>
                  <THead>Username</THead>
                  <THead>Password</THead>
                  <THead>Department</THead>
                  <THead>Strength</THead>
                  <THead>Review Date</THead>
                  <THead>Tags</THead>
                  <THead>Actions</THead>
                </tr>
              </thead>
              <tbody>
                {favorites.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={9} className="px-3 py-1.5 text-[9px] uppercase tracking-widest"
                        style={{ color: "#fbbf24", backgroundColor: "rgba(251,191,36,0.05)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        ★ Favorites
                      </td>
                    </tr>
                    {favorites.map((e) => <EntryRow key={e.id} entry={e} isFav />)}
                  </>
                )}
                {favorites.length > 0 && nonFavs.length > 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-1.5 text-[9px] uppercase tracking-widest"
                      style={{ color: "rgba(255,255,255,0.2)", backgroundColor: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      All Credentials
                    </td>
                  </tr>
                )}
                {paginated.map((e) => <EntryRow key={e.id} entry={e} />)}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
              Page {page} of {pageCount}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className={termBtn} style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }}>
                ‹ PREV
              </button>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}
                className={termBtn} style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }}>
                NEXT ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Verify identity modal ────────────────────────────────────────── */}
      <VerifyPasswordModal
        open={verifyOpen}
        email={userEmail}
        actionLabel={verifyLabel}
        onVerified={onVerified}
        onCancel={() => { setVerifyOpen(false); pendingVerifyAction.current = null; }}
      />

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      <VaultEntryDialog
        open={entryDialogOpen}
        onClose={() => { setEntryDialogOpen(false); setEditingEntry(null); }}
        onSubmit={handleEntrySubmit}
        editingEntry={editingEntry}
        loading={entryLoading}
      />

      <VaultImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        loading={importLoading}
      />

      {/* Export confirm */}
      <Dialog open={exportConfirmOpen} onOpenChange={(v) => !v && setExportConfirmOpen(false)}>
        <DialogContent className="font-mono max-w-sm border"
          style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white text-sm uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Export Warning
            </DialogTitle>
            <DialogDescription className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              This will download an encrypted JSON file containing all your credentials. The file includes ciphertext and IVs — store it securely and never share it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <button onClick={() => setExportConfirmOpen(false)} className={termBtn}
              style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>
              CANCEL
            </button>
            <button onClick={handleExport} className={termBtn}
              style={{ backgroundColor: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.3)", color: "#fbbf24" }}>
              <Download className="h-3 w-3" /> EXPORT
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="font-mono max-w-sm border"
          style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white text-sm uppercase tracking-widest">Delete Credential</DialogTitle>
            <DialogDescription className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              Delete <strong style={{ color: "#f87171" }}>{deleteTarget?.service_name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className={termBtn}
              style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>
              CANCEL
            </button>
            <button onClick={handleDelete} disabled={deleteLoading} className={termBtn}
              style={{ backgroundColor: "rgba(248,113,113,0.15)", borderColor: "rgba(248,113,113,0.4)", color: "#f87171" }}>
              <Trash2 className="h-3 w-3" /> {deleteLoading ? "DELETING..." : "DELETE"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
