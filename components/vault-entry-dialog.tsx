"use client";

import React, { useEffect, useState, useRef } from "react";
import { analyzeStrength, STRENGTH_CONFIG } from "@/lib/vault-strength";
import { DEPARTMENTS, TAGS } from "@/types/vault";
import type { VaultEntry } from "@/types/vault";
import {
  Eye, EyeOff, X, Star, StarOff, Wand2, Check, ChevronDown,
  KeySquare, Globe, User, Building2, CalendarDays, Tag, FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VaultEntryForm {
  service_name: string; login_url: string; username: string; password: string;
  notes: string; department: string; tags: string[]; is_favorite: boolean;
  review_date: string; allowed_roles: string[];
}

const empty = (): VaultEntryForm => ({
  service_name: "", login_url: "", username: "", password: "",
  notes: "", department: "", tags: [], is_favorite: false,
  review_date: "", allowed_roles: [],
});

interface Props {
  open: boolean; onClose: () => void;
  onSubmit: (form: VaultEntryForm) => Promise<void>;
  editingEntry?: VaultEntry | null; loading?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genPassword(len = 20) {
  const u = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", l = "abcdefghijklmnopqrstuvwxyz";
  const d = "0123456789", s = "!@#$%^&*()-_=+[]{}|;:,.<>?";
  const all = u + l + d + s;
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  let pw = u[buf[0] % u.length] + l[buf[1] % l.length] + d[buf[2] % d.length] + s[buf[3] % s.length];
  for (let i = 4; i < len; i++) pw += all[buf[i] % all.length];
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}

const inp: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.85)",
  outline: "none",
  borderRadius: 0,
  fontFamily: "inherit",
};

const focusInp: React.CSSProperties = {
  ...inp,
  border: "1px solid rgba(52,211,153,0.45)",
};

function Lbl({ icon: Icon, text, req }: { icon: React.ElementType; text: string; req?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className="h-3 w-3" style={{ color: "rgba(52,211,153,0.6)" }} />
      <span className="text-[9px] uppercase tracking-[0.15em] font-bold"
        style={{ color: "rgba(255,255,255,0.45)" }}>{text}</span>
      {req && <span style={{ color: "#f87171" }} className="text-[9px]">*</span>}
    </div>
  );
}

// Custom select that stays dark
function DeptSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const opts = [{ v: "", l: "Auto — your department" }, ...DEPARTMENTS.map((d) => ({ v: d, l: d }))];
  const sel = opts.find((o) => o.v === value) ?? opts[0];

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={ref} className="relative select-none">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-[11px]"
        style={open ? focusInp : inp}>
        <span style={{ color: value ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)" }}>{sel.l}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: "rgba(255,255,255,0.3)" }} />
      </button>
      {open && (
        <div className="absolute z-[200] left-0 right-0 top-full mt-1 overflow-hidden"
          style={{ backgroundColor: "#111820", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 16px 48px rgba(0,0,0,0.7)" }}>
          {opts.map((o) => (
            <button key={o.v} type="button"
              onClick={() => { onChange(o.v); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] text-left transition-all"
              style={{
                backgroundColor: o.v === value ? "rgba(52,211,153,0.1)" : "transparent",
                color: o.v === value ? "#34d399" : "rgba(255,255,255,0.65)",
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = o.v === value ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.05)")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = o.v === value ? "rgba(52,211,153,0.1)" : "transparent")}
            >
              <span>{o.l}</span>
              {o.v === value && <Check className="h-3 w-3" style={{ color: "#34d399" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StrengthBar({ pw }: { pw: string }) {
  if (!pw) return (
    <div className="h-1.5 w-full" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }} />
  );
  const s = analyzeStrength(pw);
  const cfg = STRENGTH_CONFIG[s];
  const pct = { weak: 25, fair: 50, good: 75, strong: 100 }[s];
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 relative overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
        <div className="absolute inset-y-0 left-0 transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: cfg.bar }} />
      </div>
      <span className="text-[9px] uppercase tracking-widest font-bold w-10 text-right shrink-0"
        style={{ color: cfg.color }}>{cfg.label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VaultEntryDialog({ open, onClose, onSubmit, editingEntry, loading }: Props) {
  const [form, setForm] = useState<VaultEntryForm>(empty());
  const [showPw, setShowPw] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const isEdit = !!editingEntry;

  useEffect(() => {
    if (!open) return;
    setShowPw(false);
    setFocusedField(null);
    setForm(editingEntry ? {
      service_name: editingEntry.service_name ?? "",
      login_url: editingEntry.login_url ?? "",
      username: editingEntry.username ?? "",
      password: "",
      notes: editingEntry.notes ?? "",
      department: editingEntry.department ?? "",
      tags: editingEntry.tags ?? [],
      is_favorite: editingEntry.is_favorite ?? false,
      review_date: editingEntry.review_date ?? "",
      allowed_roles: editingEntry.allowed_roles ?? [],
    } : empty());
  }, [editingEntry, open]);

  if (!open) return null;

  const s = (field: string): React.CSSProperties =>
    focusedField === field ? focusInp : inp;

  const toggleTag = (t: string) =>
    setForm((p) => ({ ...p, tags: p.tags.includes(t) ? p.tags.filter((x) => x !== t) : [...p.tags, t] }));

  const canSave = form.service_name.trim().length > 0 && (isEdit || form.password.length > 0);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full font-mono flex flex-col"
        style={{
          maxWidth: 680,
          maxHeight: "90vh",
          backgroundColor: "#0a0e14",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 96px rgba(0,0,0,0.9)",
        }}
      >
        {/* ── Title bar ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7"
              style={{ backgroundColor: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}>
              <KeySquare className="h-4 w-4" style={{ color: "#34d399" }} />
            </div>
            <div>
              <h2 className="text-[12px] uppercase tracking-[0.2em] font-bold text-white">
                {isEdit ? "Edit Credential" : "Add Credential"}
              </h2>
              <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                AES-256-CBC encrypted at rest
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => setForm((p) => ({ ...p, is_favorite: !p.is_favorite }))}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] uppercase tracking-widest font-bold transition-all"
              style={form.is_favorite
                ? { border: "1px solid rgba(251,191,36,0.4)", backgroundColor: "rgba(251,191,36,0.1)", color: "#fbbf24" }
                : { border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "transparent", color: "rgba(255,255,255,0.3)" }}>
              {form.is_favorite ? <Star className="h-3 w-3 fill-current" /> : <StarOff className="h-3 w-3" />}
              Favorite
            </button>
            <button type="button" onClick={onClose}
              className="flex items-center justify-center w-7 h-7 transition-all hover:bg-white/5"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <X className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.5)" }} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Row 1: Service name full width */}
          <div>
            <Lbl icon={KeySquare} text="Service Name" req />
            <input
              className="w-full px-3 py-2.5 text-[12px]"
              style={s("svc")}
              value={form.service_name}
              onChange={(e) => setForm((p) => ({ ...p, service_name: e.target.value }))}
              onFocus={() => setFocusedField("svc")}
              onBlur={() => setFocusedField(null)}
              placeholder="e.g.  GitHub  ·  AWS Console  ·  Gmail"
              maxLength={255}
              autoFocus
            />
          </div>

          {/* Row 2: URL + Username */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Lbl icon={Globe} text="Login URL" />
              <input className="w-full px-3 py-2.5 text-[11px]"
                style={s("url")}
                value={form.login_url}
                onChange={(e) => setForm((p) => ({ ...p, login_url: e.target.value }))}
                onFocus={() => setFocusedField("url")}
                onBlur={() => setFocusedField(null)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Lbl icon={User} text="Username / Email" />
              <input className="w-full px-3 py-2.5 text-[11px]"
                style={s("usr")}
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                onFocus={() => setFocusedField("usr")}
                onBlur={() => setFocusedField(null)}
                placeholder="user@example.com"
                maxLength={255}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Row 3: Password */}
          <div>
            <Lbl icon={KeySquare} text={isEdit ? "Password (blank = keep current)" : "Password"} req={!isEdit} />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  className="w-full px-3 py-2.5 text-[11px] tracking-widest pr-10"
                  style={s("pw")}
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  onFocus={() => setFocusedField("pw")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter or generate a secure password..."
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 transition-opacity hover:opacity-100 opacity-40">
                  {showPw
                    ? <EyeOff className="h-4 w-4" style={{ color: "rgba(255,255,255,0.7)" }} />
                    : <Eye className="h-4 w-4" style={{ color: "rgba(255,255,255,0.7)" }} />}
                </button>
              </div>
              <button type="button" onClick={() => { setForm((p) => ({ ...p, password: genPassword() })); setShowPw(true); }}
                className="flex items-center gap-2 px-4 py-2.5 text-[10px] uppercase tracking-widest font-bold shrink-0 transition-all hover:brightness-125"
                style={{ border: "1px solid rgba(52,211,153,0.35)", backgroundColor: "rgba(52,211,153,0.1)", color: "#34d399" }}>
                <Wand2 className="h-3.5 w-3.5" />
                Generate
              </button>
            </div>
            <div className="mt-2">
              <StrengthBar pw={form.password} />
            </div>
          </div>

          {/* Row 4: Dept + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Lbl icon={Building2} text="Department" />
              <DeptSelect value={form.department} onChange={(v) => setForm((p) => ({ ...p, department: v }))} />
            </div>
            <div>
              <Lbl icon={CalendarDays} text="Review Date" />
              <input className="w-full px-3 py-2.5 text-[11px]"
                style={{ ...s("dt"), colorScheme: "dark" } as React.CSSProperties}
                type="date"
                value={form.review_date}
                onChange={(e) => setForm((p) => ({ ...p, review_date: e.target.value }))}
                onFocus={() => setFocusedField("dt")}
                onBlur={() => setFocusedField(null)}
              />
            </div>
          </div>

          {/* Row 5: Tags */}
          <div>
            <Lbl icon={Tag} text="Tags" />
            <div className="flex flex-wrap gap-2 p-3"
              style={{ border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
              {TAGS.map((tag) => {
                const on = form.tags.includes(tag);
                return (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[9px] uppercase tracking-widest font-bold transition-all"
                    style={on
                      ? { border: "1px solid rgba(52,211,153,0.45)", backgroundColor: "rgba(52,211,153,0.12)", color: "#34d399" }
                      : { border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.4)" }}>
                    {on && <Check className="h-2.5 w-2.5" />}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 6: Notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <FileText className="h-3 w-3" style={{ color: "rgba(52,211,153,0.6)" }} />
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold"
                  style={{ color: "rgba(255,255,255,0.45)" }}>Notes</span>
              </div>
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                {form.notes.length}/2000
              </span>
            </div>
            <textarea
              className="w-full px-3 py-2.5 text-[11px] resize-none"
              style={{ ...s("notes"), minHeight: 72 } as React.CSSProperties}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              onFocus={() => setFocusedField("notes")}
              onBlur={() => setFocusedField(null)}
              placeholder="Recovery hints, 2FA location, environment notes..."
              maxLength={2000}
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
          <button type="button" onClick={onClose} disabled={loading}
            className="px-5 py-2 text-[10px] uppercase tracking-widest font-bold transition-all hover:bg-white/5"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
            Cancel
          </button>
          <button type="button" onClick={() => onSubmit(form)}
            disabled={loading || !canSave}
            className="flex items-center gap-2 px-6 py-2 text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-125"
            style={{ border: "1px solid rgba(52,211,153,0.45)", backgroundColor: "rgba(52,211,153,0.15)", color: "#34d399" }}>
            {loading
              ? <><span className="w-3.5 h-3.5 border-t border-current rounded-full animate-spin" /> Saving...</>
              : <><Check className="h-3.5 w-3.5" /> {isEdit ? "Update Credential" : "Create Credential"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
