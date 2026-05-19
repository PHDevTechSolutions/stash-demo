"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Trash2, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisposeItem {
    id: string;
    referenceid: string;
    asset_tag?: string;
    asset_type?: string;
    status: string;
    location?: string;
    new_user?: string;
    old_user?: string;
    department?: string;
    position?: string;
    brand?: string;
    model?: string;
    processor?: string;
    ram?: string;
    storage?: string;
    serial_number?: string;
    purchase_date?: string;
    warranty_date?: string;
    asset_age?: string;
    amount?: string;
    remarks?: string;
    mac_address?: string;
    date_created?: string;
}

interface TicketProps {
    referenceid: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}

const PAGE_SIZE = 10;

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

export const Disposal: React.FC<TicketProps> = ({ referenceid, dateCreatedFilterRange }) => {
    const [activities, setActivities] = useState<DisposeItem[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchActivities = useCallback(() => {
        if (!referenceid) { setActivities([]); return; }
        setLoadingActivities(true);
        setErrorActivities(null);
        fetch(`/api/fetch-inventory?referenceid=${encodeURIComponent(referenceid)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.data || []))
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
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
                    const n = payload.new as DisposeItem;
                    const o = payload.old as DisposeItem;
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

        const filtered = activities.filter((item) => {
            if (item.status !== "Dispose") return false;
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
                if (endDate && d > endDate) return false;
            }
            return true;
        });

        filtered.sort((a, b) => {
            if (!a.asset_tag) return 1;
            if (!b.asset_tag) return -1;
            return b.asset_tag.localeCompare(a.asset_tag);
        });

        return filtered;
    }, [activities, search, dateCreatedFilterRange]);

    const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
    const paginatedActivities = useMemo(() => {
        const s = (page - 1) * PAGE_SIZE;
        return filteredActivities.slice(s, s + PAGE_SIZE);
    }, [filteredActivities, page]);

    // ── Selection ─────────────────────────────────────────────────────────────
    function toggleSelect(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function toggleSelectAll() {
        const allSelected = paginatedActivities.every((item) => selectedIds.has(item.id));
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                paginatedActivities.forEach((item) => next.delete(item.id));
            } else {
                paginatedActivities.forEach((item) => next.add(item.id));
            }
            return next;
        });
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    async function confirmDeletion() {
        try {
            const res = await fetch("/api/delete-inventory", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to delete inventory items");
            }
            toast.success(`${selectedIds.size} item(s) deleted successfully.`);
            setSelectedIds(new Set());
            setConfirmDeleteOpen(false);
            fetchActivities();
        } catch (error: any) {
            toast.error(error.message || "Error deleting inventory items");
            setConfirmDeleteOpen(false);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

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
                        <TerminalDot color="#f87171" />
                        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>
                            DISPOSAL RECORDS
                        </span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                            / {referenceid}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span
                            className="text-[9px] uppercase tracking-widest px-2 py-0.5 border font-mono"
                            style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.06)" }}
                        >
                            {filteredActivities.length} DISPOSED
                        </span>
                        {selectedIds.size > 0 && (
                            <button
                                onClick={() => setConfirmDeleteOpen(true)}
                                className={termBtn}
                                style={{ backgroundColor: "#f87171", color: "#000", borderColor: "transparent" }}
                            >
                                <Trash2 className="h-3 w-3" />
                                DELETE ({selectedIds.size})
                            </button>
                        )}
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
                                DISPOSED ASSETS
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
                                onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedIds(new Set()); }}
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
                                    NO DISPOSAL RECORDS
                                </span>
                            </div>
                        ) : (
                            <table className="w-full border-collapse" style={{ minWidth: "1200px" }}>
                                <thead>
                                    <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                                        <THead>
                                            <input
                                                type="checkbox"
                                                onChange={toggleSelectAll}
                                                checked={
                                                    paginatedActivities.length > 0 &&
                                                    paginatedActivities.every((item) => selectedIds.has(item.id))
                                                }
                                                aria-label="Select all items on page"
                                                className="accent-red-400"
                                            />
                                        </THead>
                                        <THead>Asset Tag</THead>
                                        <THead>Type</THead>
                                        <THead>Status</THead>
                                        <THead>Location</THead>
                                        <THead>New User</THead>
                                        <THead>Old User</THead>
                                        <THead>Department</THead>
                                        <THead>Position</THead>
                                        <THead>Brand</THead>
                                        <THead>Model</THead>
                                        <THead>Processor</THead>
                                        <THead>RAM</THead>
                                        <THead>Storage</THead>
                                        <THead>Serial</THead>
                                        <THead>Purchase Date</THead>
                                        <THead>Asset Age</THead>
                                        <THead>Amount</THead>
                                        <THead>Remarks</THead>
                                        <THead>MAC Address</THead>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedActivities.map((item, idx) => (
                                        <tr
                                            key={item.id}
                                            style={{
                                                backgroundColor: selectedIds.has(item.id)
                                                    ? "rgba(248,113,113,0.06)"
                                                    : idx % 2 === 0
                                                    ? "transparent"
                                                    : "rgba(255,255,255,0.012)",
                                            }}
                                        >
                                            <td
                                                className="px-3 py-2.5"
                                                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(item.id)}
                                                    onChange={() => toggleSelect(item.id)}
                                                    aria-label={`Select item ${item.asset_tag || item.id}`}
                                                    className="accent-red-400"
                                                />
                                            </td>
                                            <TCell mono>{item.asset_tag}</TCell>
                                            <TCell>{item.asset_type}</TCell>
                                            <TCell>
                                                <span
                                                    className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border"
                                                    style={{
                                                        color: "#f87171",
                                                        borderColor: "rgba(248,113,113,0.3)",
                                                        backgroundColor: "rgba(248,113,113,0.08)",
                                                    }}
                                                >
                                                    {item.status}
                                                </span>
                                            </TCell>
                                            <TCell>{item.location}</TCell>
                                            <TCell>{item.new_user}</TCell>
                                            <TCell>{item.old_user}</TCell>
                                            <TCell>{item.department}</TCell>
                                            <TCell>{item.position}</TCell>
                                            <TCell>{item.brand}</TCell>
                                            <TCell>{item.model}</TCell>
                                            <TCell>{item.processor}</TCell>
                                            <TCell>{item.ram}</TCell>
                                            <TCell>{item.storage}</TCell>
                                            <TCell mono>{item.serial_number}</TCell>
                                            <TCell muted>
                                                {item.purchase_date
                                                    ? new Date(item.purchase_date).toLocaleDateString(undefined, {
                                                          year: "numeric",
                                                          month: "short",
                                                          day: "numeric",
                                                      })
                                                    : undefined}
                                            </TCell>
                                            <TCell>{item.asset_age}</TCell>
                                            <TCell>{item.amount}</TCell>
                                            <TCell>{item.remarks}</TCell>
                                            <TCell mono>{item.mac_address}</TCell>
                                        </tr>
                                    ))}
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

            {/* ── Confirm Delete Dialog ── */}
            <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <DialogContent
                    className="max-w-sm border font-mono"
                    style={{ backgroundColor: "#0d1117", borderColor: "rgba(248,113,113,0.2)", color: "rgba(255,255,255,0.7)" }}
                >
                    <DialogHeader>
                        <DialogTitle
                            className="text-[11px] uppercase tracking-widest font-mono flex items-center gap-2"
                            style={{ color: "#f87171" }}
                        >
                            <TerminalDot color="#f87171" /> CONFIRM DELETION
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                            {selectedIds.size} item(s) will be permanently deleted. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <button
                            onClick={() => setConfirmDeleteOpen(false)}
                            className={termBtn}
                            style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={confirmDeletion}
                            className={termBtn}
                            style={{ backgroundColor: "#f87171", color: "#000", borderColor: "transparent" }}
                        >
                            DELETE
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
