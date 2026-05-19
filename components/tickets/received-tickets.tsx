"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Clock3, SlidersHorizontal, Plus, Pencil, Trash2, Download, ChevronLeft, ChevronRight, ClipboardList, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { ReceivedDialog } from "@/components/tickets/received-ticket-dialog";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestItem {
    id: string;
    ticket_id: string;
    requestor_name: string;
    ticket_subject: string;
    department: string;
    request_type: string;
    type_concern: string;
    mode: string;
    group_services: string;
    technician_name: string;
    site: string;
    priority: string;
    status: string;
    date_scheduled: string;
    remarks: string;
    processed_by: string;
    closed_by: string;
    date_created?: string;
    date_closed?: string;
}

interface RequestProps {
    referenceid: string;
    fullname: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}

const PAGE_SIZE = 10;

// ─── Color helpers ────────────────────────────────────────────────────────────

const priorityColors: Record<string, { color: string; bg: string; border: string }> = {
    Critical: { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)" },
    High:     { color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.3)"  },
    Medium:   { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.3)"  },
    Low:      { color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.3)"  },
};

const statusColors: Record<string, { color: string; bg: string; border: string }> = {
    Ongoing:   { color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.3)"  },
    Pending:   { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" },
    Resolved:  { color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.3)"  },
    Scheduled: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.3)"  },
};

function StatusPill({ value }: { value?: string }) {
    const s = statusColors[value ?? ""] ?? { color: "rgba(255,255,255,0.35)", bg: "transparent", border: "rgba(255,255,255,0.1)" };
    return (
        <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border font-mono"
            style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}>
            {value || "—"}
        </span>
    );
}

function PriorityPill({ value }: { value?: string }) {
    const p = priorityColors[value ?? ""] ?? { color: "rgba(255,255,255,0.35)", bg: "transparent", border: "rgba(255,255,255,0.1)" };
    return (
        <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border font-mono"
            style={{ color: p.color, backgroundColor: p.bg, borderColor: p.border }}>
            {value || "—"}
        </span>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TerminalDot({ color }: { color: string }) {
    return <span className="inline-flex w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />;
}

function THead({ children }: { children: React.ReactNode }) {
    return (
        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.15em] whitespace-nowrap select-none"
            style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {children}
        </th>
    );
}

function TCell({ children, mono = false, muted = false }: { children?: React.ReactNode; mono?: boolean; muted?: boolean }) {
    return (
        <td className={`px-3 py-2.5 text-[11px] ${mono ? "font-mono" : ""} whitespace-nowrap`}
            style={{ color: muted ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            {children || <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>}
        </td>
    );
}

const termBtn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer disabled:opacity-40";
const selectStyle: React.CSSProperties = { backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)", outline: "none", appearance: "none" as const };

// ─── Duration helpers ─────────────────────────────────────────────────────────

function getMaxDurationMs(priority: string): number {
    switch (priority) {
        case "Critical": return 4  * 60 * 60 * 1000;
        case "High":     return 8  * 60 * 60 * 1000;
        case "Medium":   return 2  * 24 * 60 * 60 * 1000;
        case "Low":      return 4  * 24 * 60 * 60 * 1000;
        default:         return 0;
    }
}

function formatDuration(ms: number): string {
    if (ms <= 0) return "0h 0m 0s";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return d > 0 ? `${d}d ${h}h ${m}m ${sec}s` : `${h}h ${m}m ${sec}s`;
}

function computeDuration(dateCreated?: string, dateClosed?: string, status?: string): string {
    if (!dateCreated) return "—";
    const created = new Date(dateCreated).getTime();
    if (isNaN(created)) return "—";
    if (status === "Resolved" && dateClosed) {
        const closed = new Date(dateClosed).getTime();
        return isNaN(closed) ? "—" : formatDuration(closed - created);
    }
    return formatDuration(Date.now() - created);
}

function computeRemainingTime(priority?: string, dateCreated?: string, dateClosed?: string, status?: string): string {
    if (!priority || !dateCreated) return "—";
    const created = new Date(dateCreated).getTime();
    if (isNaN(created)) return "—";
    const max = getMaxDurationMs(priority);
    if (max <= 0) return "—";
    const elapsed = (status === "Resolved" && dateClosed)
        ? new Date(dateClosed).getTime() - created
        : Date.now() - created;
    const remaining = max - elapsed;
    return remaining <= 0 ? "OVERDUE" : formatDuration(remaining);
}

function formatDateCreated(dateStr?: string): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const Received: React.FC<RequestProps> = ({ referenceid, fullname, dateCreatedFilterRange }) => {
    const [activities,        setActivities]        = useState<RequestItem[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities,   setErrorActivities]   = useState<string | null>(null);
    const [page,   setPage]   = useState(1);
    const [search, setSearch] = useState("");
    const [open,      setOpen]      = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filterOpen,         setFilterOpen]         = useState(false);
    const [statusFilter,       setStatusFilter]       = useState("");
    const [requestTypeFilter,  setRequestTypeFilter]  = useState("");
    const [priorityFilter,     setPriorityFilter]     = useState("");
    const [selectedIds,        setSelectedIds]        = useState<Set<string>>(new Set());
    const [confirmDeleteOpen,  setConfirmDeleteOpen]  = useState(false);
    const [, forceTick] = useState(0);

    useEffect(() => {
        const iv = setInterval(() => forceTick((t) => t + 1), 1000);
        return () => clearInterval(iv);
    }, []);

    const [form, setForm] = useState<Omit<RequestItem, "id">>({
        ticket_id: "", requestor_name: "", ticket_subject: "", department: "",
        request_type: "", type_concern: "", mode: "", group_services: "",
        technician_name: "", site: "", priority: "", status: "",
        date_scheduled: "", remarks: "", processed_by: "", closed_by: "", date_created: "",
    });

    const existingTicketIds = activities.map((i) => i.ticket_id);

    function handleSelectChange(name: string, value: string) { setForm((p) => ({ ...p, [name]: value })); }
    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) { const { name, value } = e.target; setForm((p) => ({ ...p, [name]: value })); }

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchActivities = useCallback(async () => {
        if (!referenceid) { setActivities([]); return; }
        setLoadingActivities(true); setErrorActivities(null);
        try {
            const { data, error } = await supabase.from("tickets").select("*").order("date_created", { ascending: false });
            if (error) throw error;
            setActivities(data ?? []);
        } catch (err: any) {
            setErrorActivities(err.message || "Error fetching tickets");
            toast.error(err.message || "Error fetching tickets");
        } finally { setLoadingActivities(false); }
    }, [referenceid]);

    useEffect(() => { fetchActivities(); }, [referenceid, fetchActivities]);

    // ── Realtime ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!referenceid) return;
        const ch = supabase.channel(`public:tickets:referenceid=eq.${referenceid}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, (payload) => {
                const n = payload.new as RequestItem, o = payload.old as RequestItem;
                setActivities((c) => {
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

    // ── Filter ────────────────────────────────────────────────────────────────
    const filteredActivities = useMemo(() => {
        let startDate: Date | null = null, endDate: Date | null = null;
        if (dateCreatedFilterRange?.from) { startDate = new Date(dateCreatedFilterRange.from); startDate.setHours(0,0,0,0); }
        if (dateCreatedFilterRange?.to)   { endDate   = new Date(dateCreatedFilterRange.to);   endDate.setHours(23,59,59,999); }
        return activities.filter((item) => {
            if (!["Maintenance","Disposal"].includes(item.request_type)) return false;
            if (search.trim() && !Object.values(item).some((v) => v?.toString().toLowerCase().includes(search.toLowerCase()))) return false;
            if (startDate || endDate) {
                if (!item.date_created) return false;
                const d = new Date(item.date_created);
                if (isNaN(d.getTime())) return false;
                if (startDate && d < startDate) return false;
                if (endDate   && d > endDate)   return false;
            }
            if (statusFilter      && item.status       !== statusFilter)      return false;
            if (requestTypeFilter && item.request_type !== requestTypeFilter) return false;
            if (priorityFilter    && item.priority     !== priorityFilter)    return false;
            return true;
        });
    }, [activities, search, dateCreatedFilterRange, statusFilter, requestTypeFilter, priorityFilter]);

    const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
    const paginatedActivities = useMemo(() => filteredActivities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredActivities, page]);

    // ── CRUD ──────────────────────────────────────────────────────────────────
    async function handleSubmit() {
        try {
            const { error } = await supabase.from("tickets").insert([{ ...form, referenceid }]);
            if (error) throw error;
            toast.success("Ticket created."); fetchActivities(); setOpen(false); resetForm();
        } catch (err: any) { toast.error(err.message || "Error creating ticket"); }
    }

    async function handleUpdate() {
        if (!editingId) return;
        const payload = { ...form, ...(form.status === "Resolved" && { date_closed: new Date().toISOString() }) };
        const { error } = await supabase.from("tickets").update(payload).eq("id", editingId);
        if (error) { toast.error(error.message); return; }
        toast.success("Ticket updated."); setOpen(false); resetForm();
    }

    function resetForm() {
        setForm({ ticket_id: "", requestor_name: "", ticket_subject: "", department: "", request_type: "", type_concern: "", mode: "", group_services: "", technician_name: "", site: "", priority: "", status: "", date_scheduled: "", remarks: "", processed_by: "", closed_by: "", date_created: "" });
        setEditingId(null);
    }

    function openEditDialog(item: RequestItem) {
        setEditingId(item.id);
        setForm({ ticket_id: item.ticket_id ?? "", requestor_name: item.requestor_name ?? "", ticket_subject: item.ticket_subject ?? "", department: item.department ?? "", request_type: item.request_type ?? "", type_concern: item.type_concern ?? "", mode: item.mode ?? "", group_services: item.group_services ?? "", technician_name: item.technician_name ?? "", site: item.site ?? "", priority: item.priority ?? "", status: item.status ?? "", date_scheduled: item.date_scheduled ?? "", remarks: item.remarks ?? "", processed_by: item.processed_by ?? "", closed_by: fullname ?? "", date_created: item.date_created ?? "" });
        setOpen(true);
    }

    // ── Selection ─────────────────────────────────────────────────────────────
    function toggleSelect(id: string) { setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
    function toggleSelectAll() {
        const all = paginatedActivities.every((i) => selectedIds.has(i.id));
        setSelectedIds((p) => { const n = new Set(p); paginatedActivities.forEach((i) => all ? n.delete(i.id) : n.add(i.id)); return n; });
    }

    async function confirmDeletion() {
        try {
            const { error } = await supabase.from("tickets").delete().in("id", Array.from(selectedIds));
            if (error) throw error;
            toast.success(`${selectedIds.size} item(s) deleted.`); setSelectedIds(new Set()); setConfirmDeleteOpen(false); fetchActivities();
        } catch (err: any) { toast.error(err.message || "Error deleting tickets"); setConfirmDeleteOpen(false); }
    }

    // ── CSV ───────────────────────────────────────────────────────────────────
    function downloadCSV() {
        if (!filteredActivities.length) { toast.error("No data to export"); return; }
        const headers = ["Ticket ID","Requestor Name","Ticket Subject","Department","Request Type","Type of Concern","Mode","Group Services","Technician Name","Site","Priority","Duration","Remaining Time","Status","Date Scheduled","Remarks","Processed By","Closed By","Date Created","Date Closed"];
        const esc = (v: string) => (v.includes(",") || v.includes('"') || v.includes("\n")) ? `"${v.replace(/"/g,'""')}"` : v;
        const rows = filteredActivities.map((i) => [i.ticket_id,i.requestor_name,i.ticket_subject,i.department,i.request_type,i.type_concern,i.mode,i.group_services,i.technician_name,i.site,i.priority,computeDuration(i.date_created,i.date_closed,i.status),computeRemainingTime(i.priority,i.date_created,i.date_closed,i.status),i.status,i.date_scheduled,i.remarks,i.processed_by,i.closed_by,i.date_created??"",i.date_closed??""]);
        const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
        const a = document.createElement("a"); a.href = url; a.download = `tickets_${new Date().toISOString()}.csv`; a.click(); URL.revokeObjectURL(url);
    }

    const activeFilterCount = [statusFilter, requestTypeFilter, priorityFilter].filter(Boolean).length;

    // ── Error state ───────────────────────────────────────────────────────────
    if (errorActivities) {
        return (
            <div className="flex items-center gap-2 p-4 border font-mono text-[10px]" style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.2)", backgroundColor: "rgba(248,113,113,0.04)" }}>
                <TerminalDot color="#f87171" /> {errorActivities}
            </div>
        );
    }

    // ── JSX ───────────────────────────────────────────────────────────────────
    return (
        <div className="font-mono flex flex-col gap-0" style={{ backgroundColor: "#080c10", minHeight: "100%" }}>
            <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px", zIndex: 0 }} />

            <div className="relative z-10 flex flex-col gap-4 p-4">

                {/* ── Top bar ── */}
                <div className="flex items-center justify-between px-4 py-2.5 border" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-3">
                        <TerminalDot color="#fb923c" />
                        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>RECEIVED TICKETS</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 border font-mono" style={{ color: "#fb923c", borderColor: "rgba(251,146,60,0.3)", backgroundColor: "rgba(251,146,60,0.06)" }}>
                            {filteredActivities.length} TICKETS
                        </span>
                        {selectedIds.size > 0 && (
                            <button onClick={() => setConfirmDeleteOpen(true)} className={termBtn} style={{ backgroundColor: "#f87171", color: "#000", borderColor: "transparent" }}>
                                <Trash2 className="h-3 w-3" /> DELETE ({selectedIds.size})
                            </button>
                        )}
                        <button onClick={downloadCSV} className={termBtn} style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.25)", backgroundColor: "rgba(52,211,153,0.05)" }}>
                            <Download className="h-3 w-3" /> CSV
                        </button>
                        <button onClick={() => setFilterOpen(true)} className={termBtn} style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)" }}>
                            <SlidersHorizontal className="h-3 w-3" /> FILTER
                            {activeFilterCount > 0 && <span className="px-1.5 py-0.5 text-[8px] border" style={{ color: "#fb923c", borderColor: "rgba(251,146,60,0.3)", backgroundColor: "rgba(251,146,60,0.08)" }}>{activeFilterCount}</span>}
                        </button>
                        <button onClick={() => { resetForm(); setOpen(true); }} className={termBtn} style={{ color: "#fb923c", borderColor: "rgba(251,146,60,0.3)", backgroundColor: "rgba(251,146,60,0.06)" }}>
                            <Plus className="h-3 w-3" /> CREATE TICKET
                        </button>
                    </div>
                </div>

                {/* ── Table panel ── */}
                <div className="border flex flex-col" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}>

                    {/* Panel header / search */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <div className="flex items-center gap-2">
                            <ClipboardList className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                            <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>MAINTENANCE / DISPOSAL TICKETS</span>
                        </div>
                        <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none" style={{ color: "rgba(255,255,255,0.25)" }}>›</span>
                            <input type="search" placeholder="FILTER..." value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedIds(new Set()); }}
                                className="pl-5 pr-3 py-1 text-[10px] font-mono uppercase tracking-widest border outline-none w-44 placeholder:opacity-30"
                                style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }} />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto flex-1">
                        {loadingActivities ? (
                            <div className="flex items-center justify-center gap-2 py-10" style={{ color: "rgba(255,255,255,0.25)" }}>
                                <div className="w-3.5 h-3.5 border-t border-current rounded-full animate-spin" />
                                <span className="text-[9px] uppercase tracking-widest">LOADING...</span>
                            </div>
                        ) : filteredActivities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2">
                                <ClipboardList className="h-6 w-6 opacity-10" />
                                <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>NO TICKET RECORDS</span>
                            </div>
                        ) : (
                            <table className="w-full border-collapse" style={{ minWidth: "1400px" }}>
                                <thead>
                                    <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                                        <THead><input type="checkbox" onChange={toggleSelectAll} checked={paginatedActivities.length > 0 && paginatedActivities.every((i) => selectedIds.has(i.id))} className="accent-orange-400" /></THead>
                                        <THead>Actions</THead>
                                        <THead>Ticket ID</THead>
                                        <THead>Subject</THead>
                                        <THead>Priority</THead>
                                        <THead>Duration</THead>
                                        <THead>Remaining</THead>
                                        <THead>Status</THead>
                                        <THead>Requestor</THead>
                                        <THead>Department</THead>
                                        <THead>Request Type</THead>
                                        <THead>Concern</THead>
                                        <THead>Mode</THead>
                                        <THead>Group</THead>
                                        <THead>Technician</THead>
                                        <THead>Site</THead>
                                        <THead>Scheduled</THead>
                                        <THead>Processed By</THead>
                                        <THead>Closed By</THead>
                                        <THead>Remarks</THead>
                                        <THead>Date Created</THead>
                                        <THead>Date Closed</THead>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedActivities.map((item, idx) => {
                                        const remaining = computeRemainingTime(item.priority, item.date_created, item.date_closed, item.status);
                                        const isOverdue = remaining === "OVERDUE";
                                        return (
                                            <tr key={item.id} style={{ backgroundColor: selectedIds.has(item.id) ? "rgba(251,146,60,0.05)" : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
                                                <td className="px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="accent-orange-400" />
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                    <button onClick={() => openEditDialog(item)} className={`${termBtn} text-[9px] py-1 px-2`} style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.25)", backgroundColor: "rgba(56,189,248,0.05)" }}>
                                                        <Pencil className="h-2.5 w-2.5" />
                                                    </button>
                                                </td>
                                                <TCell mono>{item.ticket_id}</TCell>
                                                <TCell>{item.ticket_subject}</TCell>
                                                <td className="px-3 py-2.5 whitespace-nowrap" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}><PriorityPill value={item.priority} /></td>
                                                <td className="px-3 py-2.5 whitespace-nowrap" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                                                        <Clock3 className="h-3 w-3" />{computeDuration(item.date_created, item.date_closed, item.status)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono" style={{ color: isOverdue ? "#f87171" : "rgba(255,255,255,0.5)" }}>
                                                        <Clock3 className="h-3 w-3" />{remaining}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}><StatusPill value={item.status} /></td>
                                                <TCell>{item.requestor_name}</TCell>
                                                <TCell>{item.department}</TCell>
                                                <TCell>{item.request_type}</TCell>
                                                <TCell>{item.type_concern}</TCell>
                                                <TCell>{item.mode}</TCell>
                                                <TCell>{item.group_services}</TCell>
                                                <TCell>{item.technician_name}</TCell>
                                                <TCell>{item.site}</TCell>
                                                <TCell muted>{item.date_scheduled}</TCell>
                                                <TCell>{item.processed_by}</TCell>
                                                <TCell>{item.closed_by}</TCell>
                                                <TCell>{item.remarks}</TCell>
                                                <TCell mono muted>{formatDateCreated(item.date_created)}</TCell>
                                                <TCell mono muted>{formatDateCreated(item.date_closed)}</TCell>
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
                            {filteredActivities.length === 0 ? "0 RECORDS" : `${(page-1)*PAGE_SIZE+1}–${Math.min(page*PAGE_SIZE,filteredActivities.length)} OF ${filteredActivities.length}`}
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
            </div>

            {/* ── Filter Dialog ── */}
            <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
                <DialogContent className="max-w-sm border font-mono p-0" style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.08)" }}>
                    <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px", zIndex: 0 }} />
                    <DialogHeader className="relative z-10 px-5 py-3.5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <div className="flex items-center gap-2">
                            <TerminalDot color="#fb923c" />
                            <DialogTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#fb923c" }}>FILTER TICKETS</DialogTitle>
                        </div>
                        <DialogDescription className="text-[9px] uppercase tracking-widest pl-3.5 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>Narrow down the ticket list.</DialogDescription>
                    </DialogHeader>
                    <div className="relative z-10 flex flex-col gap-4 px-5 py-4">
                        {[
                            { label: "Status", value: statusFilter, set: setStatusFilter, opts: ["Ongoing","Pending","Resolved","Scheduled"] },
                            { label: "Request Type", value: requestTypeFilter, set: setRequestTypeFilter, opts: ["Advisory","Incident","Maintenance","Disposal","Request"] },
                            { label: "Priority", value: priorityFilter, set: setPriorityFilter, opts: ["Critical","High","Medium","Low"] },
                        ].map(({ label, value, set, opts }) => (
                            <div key={label} className="flex flex-col gap-1.5">
                                <label className="text-[9px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</label>
                                <select value={value} onChange={(e) => set(e.target.value)} className="w-full px-2.5 py-1.5 text-[11px] font-mono border" style={selectStyle}>
                                    <option value="" style={{ backgroundColor: "#0d1117" }}>— ALL —</option>
                                    {opts.map((o) => <option key={o} value={o} style={{ backgroundColor: "#0d1117", color: "#e2e8f0" }}>{o}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                    <DialogFooter className="relative z-10 flex items-center justify-between px-5 py-3.5 border-t" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <button onClick={() => { setStatusFilter(""); setRequestTypeFilter(""); setPriorityFilter(""); }} className={termBtn} style={{ color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.1)" }}>RESET</button>
                        <button onClick={() => setFilterOpen(false)} className={termBtn} style={{ backgroundColor: "#fb923c", color: "#000", borderColor: "transparent" }}>APPLY</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Confirm Delete ── */}
            <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <DialogContent className="max-w-sm border font-mono p-0" style={{ backgroundColor: "#0d1117", borderColor: "rgba(248,113,113,0.2)" }}>
                    <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px", zIndex: 0 }} />
                    <DialogHeader className="relative z-10 px-5 py-3.5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <div className="flex items-center gap-2"><TerminalDot color="#f87171" /><DialogTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#f87171" }}>CONFIRM DELETION</DialogTitle></div>
                        <DialogDescription className="text-[9px] uppercase tracking-widest pl-3.5 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{selectedIds.size} item(s) will be permanently deleted.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="relative z-10 flex items-center justify-end gap-2 px-5 py-3.5 border-t" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <button onClick={() => setConfirmDeleteOpen(false)} className={termBtn} style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>CANCEL</button>
                        <button onClick={confirmDeletion} className={termBtn} style={{ backgroundColor: "#f87171", color: "#000", borderColor: "transparent" }}>DELETE</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Ticket Form ── */}
            <ReceivedDialog open={open} setOpen={setOpen} editingId={editingId} form={form} handleInputChange={handleInputChange} handleSelectChange={handleSelectChange} handleSubmit={handleSubmit} handleUpdate={handleUpdate} resetForm={resetForm} fullname={fullname} existingTicketIds={existingTicketIds} />
        </div>
    );
};
