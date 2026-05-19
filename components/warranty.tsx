"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Download } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WarrantyItem {
    id: string;
    asset_tag?: string;
    asset_type?: string;
    brand?: string;
    model?: string;
    serial_number?: string;
    warranty_date?: string;
    purchase_date?: string;
    remarks?: string;
    date_created?: string;
}

interface WarrantyProps {
    referenceid: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWarrantyInfo(warrantyDateStr?: string): { status: string; days: string; covered: boolean } {
    if (!warrantyDateStr) return { status: "NO WARRANTY SET", days: "—", covered: false };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const warrantyDate = new Date(warrantyDateStr);
    warrantyDate.setHours(0, 0, 0, 0);
    const diffMs = warrantyDate.getTime() - today.getTime();
    const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (remainingDays > 0) {
        return { status: "COVERED", days: `${remainingDays}d`, covered: true };
    }
    return { status: "EXPIRED", days: "0d", covered: false };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TerminalDot({ color }: { color: string }) {
    return (
        <span
            className="inline-flex items-center justify-center w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
    );
}

function THead({ children }: { children: React.ReactNode }) {
    return (
        <th
            className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.15em] whitespace-nowrap select-none"
            style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
            {children}
        </th>
    );
}

function TCell({
    children,
    mono = false,
    muted = false,
}: {
    children?: React.ReactNode;
    mono?: boolean;
    muted?: boolean;
}) {
    return (
        <td
            className={`px-3 py-2.5 text-[11px] ${mono ? "font-mono" : ""} whitespace-nowrap`}
            style={{
                color: muted ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.65)",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}
        >
            {children || <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>}
        </td>
    );
}

const termBtn =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

// ─── Main Component ───────────────────────────────────────────────────────────

export const Warranty: React.FC<WarrantyProps> = ({ referenceid, dateCreatedFilterRange }) => {
    const [activities,        setActivities]        = useState<WarrantyItem[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities,   setErrorActivities]   = useState<string | null>(null);
    const [page,   setPage]   = useState(1);
    const [search, setSearch] = useState("");

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchActivities = useCallback(async () => {
        if (!referenceid) { setActivities([]); return; }
        setLoadingActivities(true);
        setErrorActivities(null);
        try {
            const { data, error } = await supabase
                .from("inventory")
                .select("*")
                .eq("referenceid", referenceid)
                .order("date_created", { ascending: false });
            if (error) throw error;
            setActivities(data ?? []);
        } catch (error: any) {
            setErrorActivities(error.message || "Error fetching activities");
            toast.error(error.message || "Error fetching activities");
        } finally {
            setLoadingActivities(false);
        }
    }, [referenceid]);

    // ── Realtime ──────────────────────────────────────────────────────────────
    useEffect(() => {
        fetchActivities();
        if (!referenceid) return;
        const ch = supabase
            .channel(`public:inventory:referenceid=eq.${referenceid}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "inventory", filter: `referenceid=eq.${referenceid}` },
                (payload) => {
                    const n = payload.new as WarrantyItem;
                    const o = payload.old as WarrantyItem;
                    setActivities((c) => {
                        switch (payload.eventType) {
                            case "INSERT": return c.some((a) => a.id === n.id) ? c : [...c, n];
                            case "UPDATE": return c.map((a) => (a.id === n.id ? n : a));
                            case "DELETE": return c.filter((a) => a.id !== o.id);
                            default: return c;
                        }
                    });
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [referenceid, fetchActivities]);

    // ── Filter ────────────────────────────────────────────────────────────────
    const filteredActivities = useMemo(() => {
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        if (dateCreatedFilterRange?.from) {
            startDate = new Date(dateCreatedFilterRange.from);
            startDate.setHours(0, 0, 0, 0);
        }
        if (dateCreatedFilterRange?.to) {
            endDate = new Date(dateCreatedFilterRange.to);
            endDate.setHours(23, 59, 59, 999);
        }
        return activities.filter((item) => {
            if (
                search.trim() &&
                !Object.values(item).some((v) =>
                    v?.toString().toLowerCase().includes(search.toLowerCase())
                )
            )
                return false;
            if (startDate || endDate) {
                if (!item.purchase_date) return false;
                const d = new Date(item.purchase_date);
                if (isNaN(d.getTime())) return false;
                if (startDate && d < startDate) return false;
                if (endDate   && d > endDate)   return false;
            }
            return true;
        });
    }, [activities, search, dateCreatedFilterRange]);

    const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
    const paginatedActivities = useMemo(() => {
        const s = (page - 1) * PAGE_SIZE;
        return filteredActivities.slice(s, s + PAGE_SIZE);
    }, [filteredActivities, page]);

    // ── CSV Export ────────────────────────────────────────────────────────────
    function exportToCSV() {
        if (!filteredActivities.length) { toast.error("No data to export"); return; }
        const headers = [
            "Asset Tag", "Asset Type", "Brand", "Model", "Serial Number",
            "Purchase Date", "Warranty Date", "Warranty Status", "Days Remaining", "Remarks",
        ];
        const rows = filteredActivities.map((item) => {
            const w = getWarrantyInfo(item.warranty_date);
            return [
                item.asset_tag    ?? "",
                item.asset_type   ?? "",
                item.brand        ?? "",
                item.model        ?? "",
                item.serial_number ?? "",
                item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : "",
                item.warranty_date ? new Date(item.warranty_date).toLocaleDateString() : "",
                w.status,
                w.days,
                item.remarks ?? "",
            ];
        });
        const csv = [headers, ...rows]
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href     = url;
        link.download = `warranty-export-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    // ─────────────────────────────────────────────────────────────────────────

    // Counts for top bar badges
    const coveredCount = useMemo(
        () => filteredActivities.filter((i) => getWarrantyInfo(i.warranty_date).covered).length,
        [filteredActivities]
    );
    const expiredCount = useMemo(
        () => filteredActivities.filter((i) => !getWarrantyInfo(i.warranty_date).covered).length,
        [filteredActivities]
    );

    return (
        <div className="font-mono flex flex-col gap-0" style={{ backgroundColor: "#080c10", minHeight: "100%" }}>

            {/* Dot grid */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    zIndex: 0,
                }}
            />

            <div className="relative z-10 flex flex-col gap-4 p-4">

                {/* ── Top bar ── */}
                <div
                    className="flex items-center justify-between px-4 py-2.5 border"
                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}
                >
                    <div className="flex items-center gap-3">
                        <TerminalDot color="#fbbf24" />
                        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>
                            WARRANTY TRACKER
                        </span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                            / {referenceid}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span
                            className="text-[9px] uppercase tracking-widest px-2 py-0.5 border font-mono"
                            style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.3)", backgroundColor: "rgba(52,211,153,0.06)" }}
                        >
                            {coveredCount} COVERED
                        </span>
                        <span
                            className="text-[9px] uppercase tracking-widest px-2 py-0.5 border font-mono"
                            style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.06)" }}
                        >
                            {expiredCount} EXPIRED
                        </span>
                        <button
                            onClick={exportToCSV}
                            className={termBtn}
                            style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.06)" }}
                        >
                            <Download className="h-3 w-3" />
                            EXPORT CSV
                        </button>
                    </div>
                </div>

                {/* ── Table panel ── */}
                <div
                    className="border flex flex-col"
                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}
                >
                    {/* Panel header */}
                    <div
                        className="flex items-center justify-between px-4 py-2.5 border-b"
                        style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}
                    >
                        <div className="flex items-center gap-2">
                            <ClipboardList className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                            <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                                WARRANTY RECORDS
                            </span>
                        </div>
                        {/* Search */}
                        <div className="relative">
                            <span
                                className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none"
                                style={{ color: "rgba(255,255,255,0.25)" }}
                            >
                                ›
                            </span>
                            <input
                                type="search"
                                placeholder="FILTER..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="pl-5 pr-3 py-1 text-[10px] font-mono uppercase tracking-widest border outline-none w-44 placeholder:opacity-30"
                                style={{
                                    backgroundColor: "rgba(255,255,255,0.03)",
                                    borderColor: "rgba(255,255,255,0.08)",
                                    color: "rgba(255,255,255,0.6)",
                                }}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto flex-1">
                        {loadingActivities ? (
                            <div className="flex items-center justify-center gap-2 py-10" style={{ color: "rgba(255,255,255,0.25)" }}>
                                <div className="w-3.5 h-3.5 border-t border-current rounded-full animate-spin" />
                                <span className="text-[9px] uppercase tracking-widest">LOADING...</span>
                            </div>
                        ) : errorActivities ? (
                            <div className="flex items-center gap-2 p-4 text-[10px]" style={{ color: "#f87171" }}>
                                <TerminalDot color="#f87171" /> {errorActivities}
                            </div>
                        ) : filteredActivities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2">
                                <ClipboardList className="h-6 w-6 opacity-10" />
                                <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                                    NO WARRANTY RECORDS
                                </span>
                            </div>
                        ) : (
                            <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
                                <thead>
                                    <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                                        <THead>Asset Tag</THead>
                                        <THead>Type</THead>
                                        <THead>Brand</THead>
                                        <THead>Model</THead>
                                        <THead>Serial</THead>
                                        <THead>Purchase Date</THead>
                                        <THead>Warranty Date</THead>
                                        <THead>Status</THead>
                                        <THead>Days Remaining</THead>
                                        <THead>Remarks</THead>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedActivities.map((item, idx) => {
                                        const w = getWarrantyInfo(item.warranty_date);
                                        return (
                                            <tr
                                                key={item.id}
                                                style={{
                                                    backgroundColor: idx % 2 === 0
                                                        ? "transparent"
                                                        : "rgba(255,255,255,0.012)",
                                                }}
                                            >
                                                <TCell mono>{item.asset_tag}</TCell>
                                                <TCell>{item.asset_type}</TCell>
                                                <TCell>{item.brand}</TCell>
                                                <TCell>{item.model}</TCell>
                                                <TCell mono>{item.serial_number}</TCell>
                                                <TCell muted>
                                                    {item.purchase_date
                                                        ? new Date(item.purchase_date).toLocaleDateString(undefined, {
                                                              year: "numeric", month: "short", day: "numeric",
                                                          })
                                                        : undefined}
                                                </TCell>
                                                <TCell muted>
                                                    {item.warranty_date
                                                        ? new Date(item.warranty_date).toLocaleDateString(undefined, {
                                                              year: "numeric", month: "short", day: "numeric",
                                                          })
                                                        : undefined}
                                                </TCell>
                                                <td
                                                    className="px-3 py-2.5 whitespace-nowrap"
                                                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                                                >
                                                    <span
                                                        className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border font-mono"
                                                        style={
                                                            w.covered
                                                                ? { color: "#34d399", borderColor: "rgba(52,211,153,0.3)", backgroundColor: "rgba(52,211,153,0.08)" }
                                                                : w.status === "NO WARRANTY SET"
                                                                ? { color: "rgba(255,255,255,0.25)", borderColor: "rgba(255,255,255,0.08)", backgroundColor: "transparent" }
                                                                : { color: "#f87171", borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.08)" }
                                                        }
                                                    >
                                                        {w.status}
                                                    </span>
                                                </td>
                                                <td
                                                    className="px-3 py-2.5 text-[11px] font-mono whitespace-nowrap"
                                                    style={{
                                                        color: w.covered ? "#34d399" : "rgba(255,255,255,0.25)",
                                                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                                                    }}
                                                >
                                                    {w.days}
                                                </td>
                                                <TCell>{item.remarks}</TCell>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    <div
                        className="flex items-center justify-between px-4 py-2 border-t"
                        style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.2)" }}
                    >
                        <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                            {filteredActivities.length === 0
                                ? "0 RECORDS"
                                : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredActivities.length)} OF ${filteredActivities.length}`}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => page > 1 && setPage(page - 1)}
                                disabled={page <= 1}
                                className={`${termBtn} text-[9px] py-1 px-2`}
                                style={{
                                    color: page <= 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.45)",
                                    borderColor: "rgba(255,255,255,0.08)",
                                }}
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </button>
                            <span className="px-2 text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                                {pageCount === 0 ? "0/0" : `${page}/${pageCount}`}
                            </span>
                            <button
                                onClick={() => page < pageCount && setPage(page + 1)}
                                disabled={page >= pageCount}
                                className={`${termBtn} text-[9px] py-1 px-2`}
                                style={{
                                    color: page >= pageCount ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.45)",
                                    borderColor: "rgba(255,255,255,0.08)",
                                }}
                            >
                                <ChevronRight className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
