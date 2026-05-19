"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { LicenseDialog } from "@/components/license-dialog";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LicenseItem {
    id: string;
    software_name?: string;
    software_version?: string;
    total_purchased: string;
    managed_installation?: string;
    remaining?: string;
    compliance_status?: string;
    action?: string;
    purchase_date?: string;
    asset_age?: string;
    remarks?: string;
    date_created?: string;
}

interface LicenseProps {
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

export const License: React.FC<LicenseProps> = ({ referenceid, dateCreatedFilterRange }) => {
    const [activities,        setActivities]        = useState<LicenseItem[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities,   setErrorActivities]   = useState<string | null>(null);

    const [page,   setPage]   = useState(1);
    const [search, setSearch] = useState("");

    const [open,      setOpen]      = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Omit<LicenseItem, "id" | "date_created">>({
        software_name:        "",
        software_version:     "",
        total_purchased:      "",
        managed_installation: "",
        remaining:            "",
        compliance_status:    "",
        action:               "",
        purchase_date:        "",
        asset_age:            "",
        remarks:              "",
    });

    const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set());
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchActivities = useCallback(async () => {
        if (!referenceid) { setActivities([]); return; }
        setLoadingActivities(true);
        setErrorActivities(null);
        try {
            const { data, error } = await supabase
                .from("license")
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
            .channel(`public:license:referenceid=eq.${referenceid}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "license", filter: `referenceid=eq.${referenceid}` },
                (payload) => {
                    const n = payload.new as LicenseItem;
                    const o = payload.old as LicenseItem;
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

    // ── Form handlers ─────────────────────────────────────────────────────────
    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }
    function handleSelectChange(name: string, value: string) {
        setForm((prev) => ({ ...prev, [name]: value }));
    }
    function handleSetAssetTag(value: string) {
        setForm((prev) => ({ ...prev, asset_tag: value }));
    }
    function resetForm() {
        setForm({
            software_name:        "",
            software_version:     "",
            total_purchased:      "",
            managed_installation: "",
            remaining:            "",
            compliance_status:    "",
            action:               "",
            purchase_date:        "",
            asset_age:            "",
            remarks:              "",
        });
        setEditingId(null);
    }

    async function handleSubmit() {
        try {
            const { error } = await supabase.from("license").insert([{ ...form, referenceid }]);
            if (error) throw error;
            toast.success("License created successfully.");
            fetchActivities();
            setOpen(false);
            resetForm();
        } catch (error: any) {
            toast.error(error.message || "Error creating license");
        }
    }

    async function handleUpdate() {
        if (!editingId) return;
        try {
            const { error } = await supabase.from("license").update(form).eq("id", editingId);
            if (error) throw error;
            toast.success("License updated successfully.");
            fetchActivities();
            setOpen(false);
            resetForm();
        } catch (error: any) {
            toast.error(error.message || "Error updating license");
        }
    }

    function openEditDialog(item: LicenseItem) {
        setEditingId(item.id);
        setForm({
            software_name:        item.software_name        ?? "",
            software_version:     item.software_version     ?? "",
            total_purchased:      item.total_purchased,
            managed_installation: item.managed_installation ?? "",
            remaining:            item.remaining            ?? "",
            compliance_status:    item.compliance_status    ?? "",
            action:               item.action               ?? "",
            purchase_date:        item.purchase_date        ?? "",
            asset_age:            item.asset_age            ?? "",
            remarks:              item.remarks              ?? "",
        });
        setOpen(true);
    }

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
            const { error } = await supabase
                .from("license")
                .delete()
                .in("id", Array.from(selectedIds));
            if (error) throw error;
            toast.success(`${selectedIds.size} item(s) deleted successfully.`);
            setSelectedIds(new Set());
            setConfirmDeleteOpen(false);
            fetchActivities();
        } catch (error: any) {
            toast.error(error.message || "Error deleting license items");
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
                        <TerminalDot color="#34d399" />
                        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>
                            LICENSE MANAGEMENT
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
                            {filteredActivities.length} RECORDS
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
                        <button
                            onClick={() => { resetForm(); setOpen(true); }}
                            className={termBtn}
                            style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.3)", backgroundColor: "rgba(52,211,153,0.06)" }}
                        >
                            <Plus className="h-3 w-3" />
                            ADD LICENSE
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
                                LICENSE RECORDS
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
                                    NO LICENSE RECORDS
                                </span>
                            </div>
                        ) : (
                            <table className="w-full border-collapse" style={{ minWidth: "1000px" }}>
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
                                                className="accent-emerald-400"
                                            />
                                        </THead>
                                        <THead>Actions</THead>
                                        <THead>Software Name</THead>
                                        <THead>Version</THead>
                                        <THead>Total Purchased</THead>
                                        <THead>Managed Installs</THead>
                                        <THead>Remaining</THead>
                                        <THead>Compliance</THead>
                                        <THead>Action</THead>
                                        <THead>Purchase Date</THead>
                                        <THead>Asset Age</THead>
                                        <THead>Remarks</THead>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedActivities.map((item, idx) => (
                                        <tr
                                            key={item.id}
                                            style={{
                                                backgroundColor: selectedIds.has(item.id)
                                                    ? "rgba(52,211,153,0.05)"
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
                                                    aria-label={`Select item ${item.software_name || item.id}`}
                                                    className="accent-emerald-400"
                                                />
                                            </td>
                                            <td
                                                className="px-3 py-2 whitespace-nowrap"
                                                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                                            >
                                                <button
                                                    onClick={() => openEditDialog(item)}
                                                    className={`${termBtn} text-[9px] py-1 px-2`}
                                                    style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.25)", backgroundColor: "rgba(56,189,248,0.05)" }}
                                                >
                                                    <Pencil className="h-2.5 w-2.5" />
                                                </button>
                                            </td>
                                            <TCell>{item.software_name}</TCell>
                                            <TCell mono>{item.software_version}</TCell>
                                            <TCell mono>{item.total_purchased}</TCell>
                                            <TCell>{item.managed_installation}</TCell>
                                            <TCell mono>{item.remaining}</TCell>
                                            <TCell>
                                                {item.compliance_status ? (
                                                    <span
                                                        className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border"
                                                        style={{
                                                            color: "rgba(255,255,255,0.5)",
                                                            borderColor: "rgba(255,255,255,0.1)",
                                                            backgroundColor: "rgba(255,255,255,0.04)",
                                                        }}
                                                    >
                                                        {item.compliance_status}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>
                                                )}
                                            </TCell>
                                            <TCell>{item.action}</TCell>
                                            <TCell muted>
                                                {item.purchase_date
                                                    ? new Date(item.purchase_date).toLocaleDateString(undefined, {
                                                          year: "numeric",
                                                          month: "short",
                                                          day: "numeric",
                                                      })
                                                    : undefined}
                                            </TCell>
                                            <TCell muted>{item.asset_age}</TCell>
                                            <TCell>{item.remarks}</TCell>
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

            {/* ── License Form Dialog ── */}
            <LicenseDialog
                open={open}
                setOpen={setOpen}
                editingId={editingId}
                form={form}
                handleInputChange={handleInputChange}
                handleSelectChange={handleSelectChange}
                handleSetAssetTag={handleSetAssetTag}
                handleSubmit={handleSubmit}
                handleUpdate={handleUpdate}
                resetForm={resetForm}
            />

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
