"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ServerIcon, Bell } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceSub {
    id: string;
    referenceid: string;
    service_name: string;
    plan?: string;
    billing_cycle?: string;
    amount?: number;
    currency?: string;
    status?: string;
    renewal_date?: string;
    notes?: string;
    date_created?: string;
}

interface Props { referenceid: string; }

const PAGE_SIZE = 10;
const NOTIF_KEY = "stash_svc_sub_notif_sent"; // localStorage key to track sent dates

const BILLING_OPTIONS  = ["Monthly", "Quarterly", "Semi-Annual", "Annual", "Lifetime", "Pay-as-you-go"];
const STATUS_OPTIONS   = ["Active", "Expiring Soon", "Expired", "Cancelled", "Trial"];
const CURRENCY_OPTIONS = ["PHP", "USD", "EUR", "SGD"];

// Billing cycle → days to add on auto-renew
const CYCLE_DAYS: Record<string, number> = {
    "Monthly":       30,
    "Quarterly":     90,
    "Semi-Annual":   180,
    "Annual":        365,
    "Lifetime":      0,
    "Pay-as-you-go": 0,
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls = "w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none placeholder:opacity-25 transition-colors";
const iStyle: React.CSSProperties = { backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" };
const sStyle: React.CSSProperties = { backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)", outline: "none", appearance: "none" as const };
const termBtn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer disabled:opacity-40";

const statusColors: Record<string, { color: string; bg: string; border: string }> = {
    "Active":        { color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.3)"  },
    "Expiring Soon": { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.3)"  },
    "Expired":       { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)" },
    "Cancelled":     { color: "rgba(255,255,255,0.3)", bg: "transparent", border: "rgba(255,255,255,0.1)" },
    "Trial":         { color: "#38bdf8", bg: "rgba(56,189,248,0.08)",  border: "rgba(56,189,248,0.3)"  },
};

function TerminalDot({ color }: { color: string }) {
    return <span className="inline-flex w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />;
}
function THead({ children }: { children: React.ReactNode }) {
    return <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.15em] whitespace-nowrap select-none" style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{children}</th>;
}
function TCell({ children, mono = false }: { children?: React.ReactNode; mono?: boolean }) {
    return <td className={`px-3 py-2.5 text-[11px] ${mono ? "font-mono" : ""} whitespace-nowrap`} style={{ color: "rgba(255,255,255,0.65)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{children || <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>}</td>;
}
function FieldLabel({ children, req }: { children: React.ReactNode; req?: boolean }) {
    return <label className="text-[9px] uppercase tracking-[0.15em] mb-1.5 block" style={{ color: "rgba(255,255,255,0.3)" }}>{children}{req && <span style={{ color: "#f87171" }}> *</span>}</label>;
}

// Days until a date
function daysUntil(dateStr?: string): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    const t = new Date();       t.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - t.getTime()) / 86400000);
}

// Add N days to a date string, return new YYYY-MM-DD
function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
}

const emptyForm = () => ({
    service_name: "", plan: "", billing_cycle: "", amount: "" as string | number,
    currency: "USD", status: "Active", renewal_date: "", notes: "",
});

// ─── Main Component ───────────────────────────────────────────────────────────

export function ServiceSubscriptions({ referenceid }: Props) {
    const [items,       setItems]       = useState<ServiceSub[]>([]);
    const [loading,     setLoading]     = useState(false);
    const [page,        setPage]        = useState(1);
    const [search,      setSearch]      = useState("");
    const [open,        setOpen]        = useState(false);
    const [editingId,   setEditingId]   = useState<string | null>(null);
    const [form,        setForm]        = useState(emptyForm());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirmOpen, setConfirmOpen] = useState(false);
    const notifCheckedRef = useRef(false);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchItems = useCallback(async () => {
        if (!referenceid) { setItems([]); return; }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("service_subscriptions").select("*")
                .eq("referenceid", referenceid)
                .order("renewal_date", { ascending: true });
            if (error) throw error;
            setItems(data ?? []);
        } catch (err: any) {
            toast.error(err.message || "Error fetching subscriptions");
        } finally { setLoading(false); }
    }, [referenceid]);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    // ── Realtime ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!referenceid) return;
        const ch = supabase.channel(`svc_subs:${referenceid}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "service_subscriptions", filter: `referenceid=eq.${referenceid}` }, (payload) => {
                const n = payload.new as ServiceSub, o = payload.old as ServiceSub;
                setItems((c) => {
                    switch (payload.eventType) {
                        case "INSERT": return c.some((a) => a.id === n.id) ? c : [...c, n];
                        case "UPDATE": return c.map((a) => a.id === n.id ? n : a);
                        case "DELETE": return c.filter((a) => a.id !== o.id);
                        default: return c;
                    }
                });
            }).subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [referenceid]);

    // ── Auto-renew + notifications ────────────────────────────────────────────
    useEffect(() => {
        if (!items.length || notifCheckedRef.current) return;
        notifCheckedRef.current = true;

        const today    = new Date(); today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];

        // Load which subscription IDs already got a notification today
        let sentToday: string[] = [];
        try {
            const raw = localStorage.getItem(NOTIF_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            sentToday = parsed[todayStr] ?? [];
        } catch { sentToday = []; }

        const toNotify: (ServiceSub & { diffDays: number })[] = [];
        const renewPromises: Promise<void>[] = [];

        items.forEach((item) => {
            if (!item.renewal_date || item.status === "Cancelled") return;

            const days = daysUntil(item.renewal_date) ?? Infinity;

            // ── Auto-renew: renewal_date is today or past ──
            if (days <= 0 && item.billing_cycle && CYCLE_DAYS[item.billing_cycle] > 0) {
                const newDate = addDays(item.renewal_date!, CYCLE_DAYS[item.billing_cycle]);
                renewPromises.push(
                    Promise.resolve(
                        supabase.from("service_subscriptions")
                            .update({ renewal_date: newDate, status: "Active" })
                            .eq("id", item.id)
                    ).then(({ error }) => {
                        if (!error) toast.success(`Auto-renewed: ${item.service_name} → ${newDate}`);
                    })
                );
                return; // no alert needed — just renewed
            }

            // ── 7-day notification window ──
            if (days >= 1 && days <= 7 && !sentToday.includes(item.id)) {
                toNotify.push({ ...item, diffDays: days });
            }

            // Update status to "Expiring Soon" if within 7 days
            if (days >= 1 && days <= 7 && item.status !== "Expiring Soon") {
                Promise.resolve(
                    supabase.from("service_subscriptions").update({ status: "Expiring Soon" }).eq("id", item.id)
                ).then(() => {});
            }

            // Update status to "Expired" if past
            if (days <= 0 && item.status !== "Expired" && (!item.billing_cycle || CYCLE_DAYS[item.billing_cycle] === 0)) {
                Promise.resolve(
                    supabase.from("service_subscriptions").update({ status: "Expired" }).eq("id", item.id)
                ).then(() => {});
            }
        });

        // Run auto-renew updates
        if (renewPromises.length) {
            Promise.all(renewPromises).then(() => fetchItems());
        }

        // Send email alert for items expiring within 7 days
        if (toNotify.length > 0) {
            const savedEmails  = typeof window !== "undefined" ? localStorage.getItem("domain_notification_emails") : null;
            const customEmails = savedEmails ? JSON.parse(savedEmails) : [];

            fetch("/api/send-subscription-alert", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subscriptions: toNotify, customEmails }),
            })
            .then((r) => r.json())
            .then(() => {
                // Mark these IDs as notified today
                try {
                    const raw     = localStorage.getItem(NOTIF_KEY);
                    const parsed  = raw ? JSON.parse(raw) : {};
                    parsed[todayStr] = [...new Set([...(parsed[todayStr] ?? []), ...toNotify.map((s) => s.id)])];
                    localStorage.setItem(NOTIF_KEY, JSON.stringify(parsed));
                } catch {}

                toNotify.forEach((s) => {
                    toast.warning(
                        `${s.service_name} renews in ${s.diffDays} day${s.diffDays > 1 ? "s" : ""}!`,
                        { duration: 8000, icon: <Bell className="h-4 w-4" /> }
                    );
                });
            })
            .catch((err) => console.error("Subscription alert error:", err));
        }
    }, [items, fetchItems]);

    // ── Filter / pagination ───────────────────────────────────────────────────
    const filtered  = items.filter((i) => !search.trim() || Object.values(i).some((v) => v?.toString().toLowerCase().includes(search.toLowerCase())));
    const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // ── Form handlers ─────────────────────────────────────────────────────────
    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: value }));
    }
    function resetForm() { setForm(emptyForm()); setEditingId(null); }
    function openEdit(item: ServiceSub) {
        setEditingId(item.id);
        setForm({ service_name: item.service_name, plan: item.plan ?? "", billing_cycle: item.billing_cycle ?? "", amount: item.amount?.toString() ?? "", currency: item.currency ?? "USD", status: item.status ?? "Active", renewal_date: item.renewal_date ?? "", notes: item.notes ?? "" });
        setOpen(true);
    }

    async function handleSubmit() {
        if (!form.service_name.trim()) { toast.error("Service name is required."); return; }
        try {
            const { error } = await supabase.from("service_subscriptions").insert([{ ...form, amount: form.amount === "" ? null : Number(form.amount), referenceid }]);
            if (error) throw error;
            toast.success("Subscription added."); fetchItems(); setOpen(false); resetForm();
            notifCheckedRef.current = false; // re-check notifications after new entry
        } catch (err: any) { toast.error(err.message || "Error adding subscription"); }
    }

    async function handleUpdate() {
        if (!editingId) return;
        try {
            const { error } = await supabase.from("service_subscriptions").update({ ...form, amount: form.amount === "" ? null : Number(form.amount) }).eq("id", editingId);
            if (error) throw error;
            toast.success("Subscription updated."); fetchItems(); setOpen(false); resetForm();
            notifCheckedRef.current = false;
        } catch (err: any) { toast.error(err.message || "Error updating subscription"); }
    }

    function toggleSelect(id: string) { setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
    function toggleAll() {
        const all = paginated.every((i) => selectedIds.has(i.id));
        setSelectedIds((p) => { const n = new Set(p); paginated.forEach((i) => all ? n.delete(i.id) : n.add(i.id)); return n; });
    }
    async function confirmDelete() {
        try {
            const { error } = await supabase.from("service_subscriptions").delete().in("id", Array.from(selectedIds));
            if (error) throw error;
            toast.success(`${selectedIds.size} item(s) deleted.`); setSelectedIds(new Set()); setConfirmOpen(false); fetchItems();
        } catch (err: any) { toast.error(err.message || "Error deleting"); setConfirmOpen(false); }
    }

    // ── JSX ───────────────────────────────────────────────────────────────────
    return (
        <div className="font-mono flex flex-col gap-4">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-3">
                    <TerminalDot color="#38bdf8" />
                    <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>SERVICE SUBSCRIPTIONS</span>
                    {items.filter((i) => { const d = daysUntil(i.renewal_date); return d !== null && d >= 0 && d <= 7; }).length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 border" style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.08)" }}>
                            <Bell className="h-2.5 w-2.5" />
                            {items.filter((i) => { const d = daysUntil(i.renewal_date); return d !== null && d >= 0 && d <= 7; }).length} EXPIRING SOON
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 border font-mono" style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.3)", backgroundColor: "rgba(56,189,248,0.06)" }}>
                        {items.length} SERVICES
                    </span>
                    {selectedIds.size > 0 && (
                        <button onClick={() => setConfirmOpen(true)} className={termBtn} style={{ backgroundColor: "#f87171", color: "#000", borderColor: "transparent" }}>
                            <Trash2 className="h-3 w-3" /> DELETE ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={() => { resetForm(); setOpen(true); }} className={termBtn} style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.3)", backgroundColor: "rgba(56,189,248,0.06)" }}>
                        <Plus className="h-3 w-3" /> ADD SERVICE
                    </button>
                </div>
            </div>

            {/* Table panel */}
            <div className="border flex flex-col" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                    <div className="flex items-center gap-2">
                        <ServerIcon className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                        <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>PLATFORM PLANS</span>
                    </div>
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none" style={{ color: "rgba(255,255,255,0.25)" }}>›</span>
                        <input type="search" placeholder="FILTER..." value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="pl-5 pr-3 py-1 text-[10px] font-mono uppercase tracking-widest border outline-none w-44 placeholder:opacity-30"
                            style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }} />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10" style={{ color: "rgba(255,255,255,0.25)" }}>
                            <div className="w-3.5 h-3.5 border-t border-current rounded-full animate-spin" />
                            <span className="text-[9px] uppercase tracking-widest">LOADING...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2">
                            <ServerIcon className="h-6 w-6 opacity-10" />
                            <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>NO SERVICE SUBSCRIPTIONS</span>
                        </div>
                    ) : (
                        <table className="w-full border-collapse" style={{ minWidth: "950px" }}>
                            <thead>
                                <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                                    <THead><input type="checkbox" onChange={toggleAll} checked={paginated.length > 0 && paginated.every((i) => selectedIds.has(i.id))} className="accent-sky-400" /></THead>
                                    <THead>Actions</THead>
                                    <THead>Service</THead>
                                    <THead>Plan</THead>
                                    <THead>Billing</THead>
                                    <THead>Amount</THead>
                                    <THead>Status</THead>
                                    <THead>Renewal Date</THead>
                                    <THead>Days Left</THead>
                                    <THead>Auto-Renew</THead>
                                    <THead>Notes</THead>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((item, idx) => {
                                    const days   = daysUntil(item.renewal_date);
                                    const sc     = statusColors[item.status ?? ""] ?? statusColors["Active"];
                                    const dColor = days === null ? "rgba(255,255,255,0.3)" : days <= 3 ? "#f87171" : days <= 7 ? "#fbbf24" : "#34d399";
                                    const autoRenew = item.billing_cycle && CYCLE_DAYS[item.billing_cycle] > 0;
                                    return (
                                        <tr key={item.id} style={{ backgroundColor: selectedIds.has(item.id) ? "rgba(56,189,248,0.05)" : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
                                            <td className="px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="accent-sky-400" />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                <button onClick={() => openEdit(item)} className={`${termBtn} text-[9px] py-1 px-2`} style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.25)", backgroundColor: "rgba(56,189,248,0.05)" }}>
                                                    <Pencil className="h-2.5 w-2.5" />
                                                </button>
                                            </td>
                                            <TCell><span className="font-bold" style={{ color: "#38bdf8" }}>{item.service_name}</span></TCell>
                                            <TCell>{item.plan}</TCell>
                                            <TCell>{item.billing_cycle}</TCell>
                                            <TCell mono>{item.amount != null ? `${item.currency ?? ""} ${item.amount}` : undefined}</TCell>
                                            <td className="px-3 py-2.5 whitespace-nowrap" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border font-mono" style={{ color: sc.color, borderColor: sc.border, backgroundColor: sc.bg }}>{item.status}</span>
                                            </td>
                                            <TCell mono>{item.renewal_date ? new Date(item.renewal_date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : undefined}</TCell>
                                            <td className="px-3 py-2.5 whitespace-nowrap" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                <span className="text-[10px] font-mono font-bold" style={{ color: dColor }}>
                                                    {days === null ? "—" : days < 0 ? "EXPIRED" : days === 0 ? "TODAY" : `${days}d`}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border font-mono"
                                                    style={{ color: autoRenew ? "#34d399" : "rgba(255,255,255,0.25)", borderColor: autoRenew ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)", backgroundColor: autoRenew ? "rgba(52,211,153,0.06)" : "transparent" }}>
                                                    {autoRenew ? "YES" : "NO"}
                                                </span>
                                            </td>
                                            <TCell>{item.notes}</TCell>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.2)" }}>
                    <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {filtered.length === 0 ? "0 RECORDS" : `${(page-1)*PAGE_SIZE+1}–${Math.min(page*PAGE_SIZE,filtered.length)} OF ${filtered.length}`}
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => page > 1 && setPage(page-1)} disabled={page<=1} className={`${termBtn} text-[9px] py-1 px-2`} style={{ color: page<=1?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.45)", borderColor:"rgba(255,255,255,0.08)" }}>
                            <ChevronLeft className="h-3 w-3" />
                        </button>
                        <span className="px-2 text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>{pageCount===0?"0/0":`${page}/${pageCount}`}</span>
                        <button onClick={() => page < pageCount && setPage(page+1)} disabled={page>=pageCount} className={`${termBtn} text-[9px] py-1 px-2`} style={{ color: page>=pageCount?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.45)", borderColor:"rgba(255,255,255,0.08)" }}>
                            <ChevronRight className="h-3 w-3" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Create / Edit Dialog ── */}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
                <DialogContent className="max-w-lg border font-mono p-0" style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.08)" }}>
                    <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px", zIndex: 0 }} />
                    <DialogHeader className="relative z-10 px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#38bdf8", boxShadow: "0 0 5px #38bdf8" }} />
                            <DialogTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#38bdf8" }}>
                                {editingId ? "EDIT SERVICE" : "ADD SERVICE SUBSCRIPTION"}
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-[9px] uppercase tracking-widest pl-3.5 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                            Monthly/Annual/Quarterly billing cycles will auto-renew. Email alerts sent 7 days before renewal.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative z-10 grid grid-cols-2 gap-4 px-6 py-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <div className="col-span-2 flex flex-col">
                            <FieldLabel req>Service Name</FieldLabel>
                            <input name="service_name" value={form.service_name} onChange={handleChange} placeholder="E.G. SUPABASE, FIREBASE, NEON, ELEMENTOR..." className={inputCls} style={iStyle} />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Plan / Tier</FieldLabel>
                            <input name="plan" value={form.plan} onChange={handleChange} placeholder="FREE / PRO / TEAM" className={inputCls} style={iStyle} />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Billing Cycle</FieldLabel>
                            <select name="billing_cycle" value={form.billing_cycle} onChange={handleChange} className="w-full px-2.5 py-1.5 text-[11px] font-mono border" style={sStyle}>
                                <option value="" style={{ backgroundColor: "#0d1117" }}>— SELECT —</option>
                                {BILLING_OPTIONS.map((o) => <option key={o} value={o} style={{ backgroundColor: "#0d1117", color: "#e2e8f0" }}>{o}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Amount</FieldLabel>
                            <input name="amount" value={form.amount} onChange={handleChange} placeholder="0.00" type="number" className={inputCls} style={iStyle} />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Currency</FieldLabel>
                            <select name="currency" value={form.currency} onChange={handleChange} className="w-full px-2.5 py-1.5 text-[11px] font-mono border" style={sStyle}>
                                {CURRENCY_OPTIONS.map((o) => <option key={o} value={o} style={{ backgroundColor: "#0d1117", color: "#e2e8f0" }}>{o}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Status</FieldLabel>
                            <select name="status" value={form.status} onChange={handleChange} className="w-full px-2.5 py-1.5 text-[11px] font-mono border" style={sStyle}>
                                {STATUS_OPTIONS.map((o) => <option key={o} value={o} style={{ backgroundColor: "#0d1117", color: "#e2e8f0" }}>{o}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Renewal Date</FieldLabel>
                            <input name="renewal_date" value={form.renewal_date} onChange={handleChange} type="date" className={inputCls} style={iStyle} />
                        </div>
                        <div className="col-span-2 flex flex-col">
                            <FieldLabel>Notes</FieldLabel>
                            <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="ADDITIONAL NOTES..." rows={3}
                                className="w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none resize-none placeholder:opacity-25" style={iStyle} />
                        </div>
                    </div>
                    <DialogFooter className="relative z-10 flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <button onClick={() => { setOpen(false); resetForm(); }} className={termBtn} style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>CANCEL</button>
                        <button onClick={editingId ? handleUpdate : handleSubmit} className={termBtn} style={{ backgroundColor: "#38bdf8", color: "#000", borderColor: "transparent" }}>
                            {editingId ? "UPDATE →" : "ADD →"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Confirm Delete ── */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="max-w-sm border font-mono p-0" style={{ backgroundColor: "#0d1117", borderColor: "rgba(248,113,113,0.2)" }}>
                    <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px", zIndex: 0 }} />
                    <DialogHeader className="relative z-10 px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <div className="flex items-center gap-2"><TerminalDot color="#f87171" /><DialogTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#f87171" }}>CONFIRM DELETION</DialogTitle></div>
                        <DialogDescription className="text-[9px] uppercase tracking-widest pl-3.5 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{selectedIds.size} item(s) will be permanently deleted.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="relative z-10 flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <button onClick={() => setConfirmOpen(false)} className={termBtn} style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>CANCEL</button>
                        <button onClick={confirmDelete} className={termBtn} style={{ backgroundColor: "#f87171", color: "#000", borderColor: "transparent" }}>DELETE</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
