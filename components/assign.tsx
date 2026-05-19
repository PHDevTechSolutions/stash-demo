"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { AlertCircleIcon, Plus, X, Send, ChevronLeft, ChevronRight, UserPlus, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignItem {
    id: string;
    asset_tag?: string;
    asset_type?: string;
    brand?: string;
    model?: string;
    serial_number?: string;
    remarks?: string;
    date_created?: string;
    status?: string;
    fullName?: string;
    position?: string;
    department?: string;
}

interface AssignedAsset {
    id: string;
    assigned_number: string;
    asset_tag?: string;
    asset_type?: string;
    brand?: string;
    model?: string;
    serial_number?: string;
    new_user?: string;
    position?: string;
    department?: string;
    date_created?: string;
    status?: string;
}

interface AssignProps {
    referenceid: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}

const PAGE_SIZE = 10;

const DEPARTMENTS = [
    "Information Technology", "Human Resources", "Marketing", "Sales",
    "Accounting", "Procurement", "Admin", "Warehouse Operations",
    "Engineering", "Customer Service", "Ecommerce", "Product Development",
];

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

function TCell({ children, mono = false, muted = false }: { children?: React.ReactNode; mono?: boolean; muted?: boolean }) {
    return (
        <td className={`px-3 py-2.5 text-[11px] ${mono ? "font-mono" : ""} whitespace-nowrap`}
            style={{ color: muted ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.65)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            {children || <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>}
        </td>
    );
}

function TermInput({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
    return (
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none placeholder:opacity-30 transition-colors"
            style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)",
            }}
        />
    );
}

function TermSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none appearance-none"
            style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.1)",
                color: value ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
            }}
        >
            <option value="" disabled>{placeholder || "SELECT..."}</option>
            {options.map((o) => <option key={o} value={o} style={{ backgroundColor: "#0d1117", color: "#e2e8f0" }}>{o}</option>)}
        </select>
    );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <label className="block text-[9px] uppercase tracking-[0.15em] mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>{children}</label>;
}

const termBtn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

// ─── Main Component ───────────────────────────────────────────────────────────

export const Assign: React.FC<AssignProps> = ({ referenceid, dateCreatedFilterRange }) => {
    const [activities,           setActivities]           = useState<AssignItem[]>([]);
    const [loadingActivities,    setLoadingActivities]    = useState(false);
    const [errorActivities,      setErrorActivities]      = useState<string | null>(null);
    const [assignedAssets,       setAssignedAssets]       = useState<AssignedAsset[]>([]);
    const [loadingAssignedAssets, setLoadingAssignedAssets] = useState(false);
    const [errorAssignedAssets,  setErrorAssignedAssets]  = useState<string | null>(null);

    const [editId,   setEditId]   = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<AssignedAsset>>({});

    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [deleteTargetId,    setDeleteTargetId]    = useState<string | null>(null);

    const [page,          setPage]          = useState(1);
    const [search,        setSearch]        = useState("");
    const [selectedItems, setSelectedItems] = useState<AssignItem[]>([]);
    const [newUser,    setNewUser]    = useState("");
    const [oldUser,    setOldUser]    = useState("");
    const [position,   setPosition]   = useState("");
    const [department, setDepartment] = useState("");
    const [remarks,    setRemarks]    = useState("");
    const [submitting, setSubmitting] = useState(false);

    // ── Fetch inventory ───────────────────────────────────────────────────────
    const fetchActivities = useCallback(() => {
        if (!referenceid) { setActivities([]); return; }
        setLoadingActivities(true); setErrorActivities(null);
        fetch(`/api/fetch-inventory?referenceid=${encodeURIComponent(referenceid)}`)
            .then(async (res) => { if (!res.ok) throw new Error("Failed to fetch activities"); return res.json(); })
            .then((data) => setActivities(data.data || []))
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, [referenceid]);

    // ── Fetch assigned ────────────────────────────────────────────────────────
    const fetchAssignedAssets = useCallback(() => {
        if (!referenceid) { setAssignedAssets([]); return; }
        setLoadingAssignedAssets(true); setErrorAssignedAssets(null);
        fetch(`/api/fetch-assigned-assets?referenceid=${encodeURIComponent(referenceid)}`)
            .then(async (res) => { if (!res.ok) throw new Error("Failed to fetch assigned assets"); return res.json(); })
            .then((data) => setAssignedAssets(data.data || []))
            .catch((err) => setErrorAssignedAssets(err.message))
            .finally(() => setLoadingAssignedAssets(false));
    }, [referenceid]);

    // ── Realtime ──────────────────────────────────────────────────────────────
    useEffect(() => {
        fetchActivities();
        if (!referenceid) return;
        const ch = supabase.channel(`public:inventory:referenceid=eq.${referenceid}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "inventory", filter: `referenceid=eq.${referenceid}` }, (payload) => {
                const n = payload.new as AssignItem, o = payload.old as AssignItem;
                setActivities((c) => {
                    switch (payload.eventType) {
                        case "INSERT": return c.some(a => a.id === n.id) ? c : [...c, n];
                        case "UPDATE": return c.map(a => a.id === n.id ? n : a);
                        case "DELETE": return c.filter(a => a.id !== o.id);
                        default: return c;
                    }
                });
            }).subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [referenceid, fetchActivities]);

    useEffect(() => {
        fetchAssignedAssets();
        if (!referenceid) return;
        const ch = supabase.channel(`public:assign_asset:referenceid=eq.${referenceid}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "assign_asset", filter: `referenceid=eq.${referenceid}` }, (payload) => {
                const n = payload.new as AssignedAsset, o = payload.old as AssignedAsset;
                setAssignedAssets((c) => {
                    switch (payload.eventType) {
                        case "INSERT": return c.some(a => a.id === n.id) ? c : [...c, n];
                        case "UPDATE": return c.map(a => a.id === n.id ? n : a);
                        case "DELETE": return c.filter(a => a.id !== o.id);
                        default: return c;
                    }
                });
            }).subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [referenceid, fetchAssignedAssets]);

    // ── Filter ────────────────────────────────────────────────────────────────
    const filteredActivities = useMemo(() => {
        let startDate: Date | null = null, endDate: Date | null = null;
        if (dateCreatedFilterRange?.from) { startDate = new Date(dateCreatedFilterRange.from); startDate.setHours(0,0,0,0); }
        if (dateCreatedFilterRange?.to)   { endDate   = new Date(dateCreatedFilterRange.to);   endDate.setHours(23,59,59,999); }
        return activities.filter((item) => {
            const s = item.status?.toLowerCase();
            if (["dispose","missing","deployed","lend","defective"].includes(s ?? "")) return false;
            if (search.trim() && !Object.values(item).some(v => v?.toString().toLowerCase().includes(search.toLowerCase()))) return false;
            if (startDate || endDate) {
                if (!item.date_created) return false;
                const d = new Date(item.date_created);
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

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleAddItem = (item: AssignItem) => {
        setSelectedItems(prev => prev.find(i => i.id === item.id) ? prev : [...prev, { ...item, fullName: "", position: "", department: "" }]);
    };
    const handleRemoveItem = (id: string) => setSelectedItems(prev => prev.filter(i => i.id !== id));

    const handleSubmit = async () => {
        if (selectedItems.length === 0) { toast.error("No selected items"); return; }
        if (!newUser || !position || !department) { toast.error("Please complete user information"); return; }
        setSubmitting(true);
        try {
            const res = await fetch("/api/create-assign-asset", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ referenceid, new_user: newUser, old_user: oldUser || null, position, department, remarks, items: selectedItems.map(item => ({ inventory_id: item.id, asset_tag: item.asset_tag, asset_type: item.asset_type, brand: item.brand, model: item.model, serial_number: item.serial_number })) }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to assign assets");
            toast.success("Assets successfully assigned.");
            setSelectedItems([]); setNewUser(""); setOldUser(""); setPosition(""); setDepartment(""); setRemarks("");
        } catch (e: any) { toast.error(e.message || "Submission failed"); }
        finally { setSubmitting(false); }
    };

    const openDeleteDialog = (id: string) => { setDeleteTargetId(id); setConfirmDeleteOpen(true); };
    const confirmDeletion = async () => {
        if (!deleteTargetId) return;
        try {
            const res = await fetch(`/api/delete-assigned-asset?id=${encodeURIComponent(deleteTargetId)}`, { method: "DELETE" });
            if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Failed to delete"); }
            toast.success("Assignment deleted."); fetchAssignedAssets();
        } catch (e: any) { toast.error(e.message); }
        finally { setConfirmDeleteOpen(false); setDeleteTargetId(null); }
    };

    const startEdit = (item: AssignedAsset) => { setEditId(item.id); setEditData({ new_user: item.new_user, position: item.position, department: item.department }); };
    const cancelEdit = () => { setEditId(null); setEditData({}); };
    const handleEditChange = (field: keyof AssignedAsset, value: string) => setEditData(prev => ({ ...prev, [field]: value }));
    const handleUpdate = async () => {
        if (!editId) return;
        try {
            const res = await fetch("/api/update-assigned-asset", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editId, ...editData }) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to update");
            toast.success("Assignment updated."); cancelEdit(); fetchAssignedAssets();
        } catch (e: any) { toast.error(e.message); }
    };

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="font-mono flex flex-col gap-0" style={{ backgroundColor: "#080c10", minHeight: "100%" }}>

            {/* Dot grid */}
            <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px", zIndex: 0 }} />

            <div className="relative z-10 flex flex-col gap-4 p-4">

                {/* ── Top bar ── */}
                <div className="flex items-center justify-between px-4 py-2.5 border" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-3">
                        <TerminalDot color="#a78bfa" />
                        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>ASSET ASSIGNMENT</span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>/ {referenceid}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 border font-mono" style={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)", backgroundColor: "rgba(167,139,250,0.06)" }}>
                            {filteredActivities.length} AVAILABLE
                        </span>
                        <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 border font-mono" style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.3)", backgroundColor: "rgba(56,189,248,0.06)" }}>
                            {assignedAssets.length} ASSIGNED
                        </span>
                    </div>
                </div>

                {/* ── Main two-column layout ── */}
                <div className={selectedItems.length > 0 ? "grid grid-cols-1 xl:grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>

                    {/* ── LEFT: Available Assets ── */}
                    <div className="border flex flex-col" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}>

                        {/* Panel header */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                            <div className="flex items-center gap-2">
                                <ClipboardList className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                                <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>AVAILABLE ASSETS</span>
                            </div>
                            {/* Search */}
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none" style={{ color: "rgba(255,255,255,0.25)" }}>›</span>
                                <input
                                    type="search"
                                    placeholder="FILTER..."
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                    className="pl-5 pr-3 py-1 text-[10px] font-mono uppercase tracking-widest border outline-none w-44 placeholder:opacity-30"
                                    style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
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
                            ) : (
                                <table className="w-full border-collapse" style={{ minWidth: "520px" }}>
                                    <thead>
                                        <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                                            <THead>Add</THead>
                                            <THead>Status</THead>
                                            <THead>Asset Tag</THead>
                                            <THead>Type</THead>
                                            <THead>Brand</THead>
                                            <THead>Model</THead>
                                            <THead>Serial</THead>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedActivities.length === 0 ? (
                                            <tr><td colSpan={7} className="px-3 py-8 text-center text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>NO RECORDS</td></tr>
                                        ) : paginatedActivities.map((item, idx) => {
                                            const already = selectedItems.some(i => i.id === item.id);
                                            return (
                                                <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
                                                    <td className="px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                        <button
                                                            onClick={() => handleAddItem(item)}
                                                            disabled={already}
                                                            className={`${termBtn} text-[9px] py-1 px-2`}
                                                            style={already
                                                                ? { color: "rgba(255,255,255,0.2)", borderColor: "rgba(255,255,255,0.06)" }
                                                                : { color: "#22c55e", borderColor: "rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.06)" }
                                                            }
                                                        >
                                                            {already ? "ADDED" : <><Plus className="h-2.5 w-2.5" /> ADD</>}
                                                        </button>
                                                    </td>
                                                    <TCell>
                                                        <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border"
                                                            style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)" }}>
                                                            {item.status}
                                                        </span>
                                                    </TCell>
                                                    <TCell mono>{item.asset_tag}</TCell>
                                                    <TCell>{item.asset_type}</TCell>
                                                    <TCell>{item.brand}</TCell>
                                                    <TCell>{item.model}</TCell>
                                                    <TCell mono>{item.serial_number}</TCell>
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
                                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredActivities.length)} OF {filteredActivities.length}
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => page > 1 && setPage(page - 1)} disabled={page <= 1}
                                    className={`${termBtn} text-[9px] py-1 px-2`}
                                    style={{ color: page <= 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.45)", borderColor: "rgba(255,255,255,0.08)" }}>
                                    <ChevronLeft className="h-3 w-3" />
                                </button>
                                <span className="px-2 text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>{pageCount === 0 ? "0/0" : `${page}/${pageCount}`}</span>
                                <button onClick={() => page < pageCount && setPage(page + 1)} disabled={page >= pageCount}
                                    className={`${termBtn} text-[9px] py-1 px-2`}
                                    style={{ color: page >= pageCount ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.45)", borderColor: "rgba(255,255,255,0.08)" }}>
                                    <ChevronRight className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT: Selected + Form ── */}
                    {selectedItems.length > 0 && (
                        <div className="border flex flex-col" style={{ borderColor: "rgba(167,139,250,0.2)", backgroundColor: "rgba(167,139,250,0.02)" }}>

                            {/* Panel header */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(167,139,250,0.15)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                                <div className="flex items-center gap-2">
                                    <UserPlus className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />
                                    <span className="text-[10px] uppercase tracking-widest" style={{ color: "#a78bfa" }}>ASSIGNMENT QUEUE</span>
                                </div>
                                <span className="text-[9px] font-mono px-2 py-0.5 border" style={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)", backgroundColor: "rgba(167,139,250,0.08)" }}>
                                    {selectedItems.length} ITEM{selectedItems.length !== 1 ? "S" : ""}
                                </span>
                            </div>

                            <div className="flex-1 overflow-auto p-4 space-y-5">

                                {/* Selected items list */}
                                <div className="border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                                                <THead>Asset Tag</THead>
                                                <THead>Type</THead>
                                                <THead>Brand / Model</THead>
                                                <THead>Remove</THead>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedItems.map((item, idx) => (
                                                <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                                                    <TCell mono>{item.asset_tag}</TCell>
                                                    <TCell>{item.asset_type}</TCell>
                                                    <TCell>{[item.brand, item.model].filter(Boolean).join(" ")}</TCell>
                                                    <td className="px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                        <button onClick={() => handleRemoveItem(item.id)}
                                                            className={`${termBtn} text-[9px] py-1 px-2`}
                                                            style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.25)", backgroundColor: "rgba(248,113,113,0.05)" }}>
                                                            <X className="h-2.5 w-2.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Separator */}
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
                                    <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>USER INFORMATION</span>
                                    <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
                                </div>

                                {/* Form fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <FieldLabel>New User <span style={{ color: "#f87171" }}>*</span></FieldLabel>
                                        <TermInput value={newUser} onChange={setNewUser} placeholder="FULL NAME" />
                                    </div>
                                    <div>
                                        <FieldLabel>Old User</FieldLabel>
                                        <TermInput value={oldUser} onChange={setOldUser} placeholder="PREVIOUS USER" />
                                    </div>
                                    <div>
                                        <FieldLabel>Position <span style={{ color: "#f87171" }}>*</span></FieldLabel>
                                        <TermInput value={position} onChange={setPosition} placeholder="JOB TITLE" />
                                    </div>
                                    <div>
                                        <FieldLabel>Department <span style={{ color: "#f87171" }}>*</span></FieldLabel>
                                        <TermSelect value={department} onChange={setDepartment} options={DEPARTMENTS} placeholder="SELECT DEPT..." />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <FieldLabel>Remarks</FieldLabel>
                                        <textarea
                                            value={remarks}
                                            onChange={(e) => setRemarks(e.target.value)}
                                            rows={3}
                                            placeholder="ADDITIONAL NOTES..."
                                            className="w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none resize-none placeholder:opacity-25"
                                            style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
                                        />
                                    </div>
                                </div>

                                {/* Submit */}
                                <div className="flex justify-end pt-1">
                                    <button onClick={handleSubmit} disabled={submitting || selectedItems.length === 0}
                                        className={`${termBtn} text-[10px]`}
                                        style={{ backgroundColor: "#a78bfa", color: "#000", borderColor: "transparent" }}>
                                        <Send className="h-3 w-3" />
                                        {submitting ? "SUBMITTING..." : "SUBMIT ASSIGNMENT"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Assigned Assets Table ── */}
                <div className="border" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}>

                    <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <ClipboardList className="h-3.5 w-3.5" style={{ color: "#38bdf8" }} />
                        <span className="text-[10px] uppercase tracking-widest" style={{ color: "#38bdf8" }}>ASSIGNED ASSETS LOG</span>
                        <span className="ml-auto text-[9px] font-mono px-2 py-0.5 border" style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.3)", backgroundColor: "rgba(56,189,248,0.06)" }}>
                            {assignedAssets.length} RECORDS
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        {loadingAssignedAssets ? (
                            <div className="flex items-center justify-center gap-2 py-10" style={{ color: "rgba(255,255,255,0.25)" }}>
                                <div className="w-3.5 h-3.5 border-t border-current rounded-full animate-spin" />
                                <span className="text-[9px] uppercase tracking-widest">LOADING...</span>
                            </div>
                        ) : errorAssignedAssets ? (
                            <div className="flex items-center gap-2 p-4 text-[10px]" style={{ color: "#f87171" }}>
                                <TerminalDot color="#f87171" /> {errorAssignedAssets}
                            </div>
                        ) : assignedAssets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2">
                                <ClipboardList className="h-6 w-6 opacity-10" />
                                <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>NO ASSIGNMENT RECORDS</span>
                            </div>
                        ) : (
                            <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
                                <thead>
                                    <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                                        <THead>Actions</THead>
                                        <THead>Assigned #</THead>
                                        <THead>Asset Tag</THead>
                                        <THead>Type</THead>
                                        <THead>Brand</THead>
                                        <THead>Model</THead>
                                        <THead>Serial</THead>
                                        <THead>New User</THead>
                                        <THead>Position</THead>
                                        <THead>Department</THead>
                                        <THead>Date</THead>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignedAssets.map((item, idx) => {
                                        const isEditing = editId === item.id;
                                        return (
                                            <tr key={item.id} style={{ backgroundColor: isEditing ? "rgba(56,189,248,0.04)" : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
                                                <td className="px-3 py-2 whitespace-nowrap" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                    {isEditing ? (
                                                        <div className="flex gap-1">
                                                            <button onClick={handleUpdate}
                                                                className={`${termBtn} text-[9px] py-1 px-2`}
                                                                style={{ color: "#22c55e", borderColor: "rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.06)" }}>
                                                                SAVE
                                                            </button>
                                                            <button onClick={cancelEdit}
                                                                className={`${termBtn} text-[9px] py-1 px-2`}
                                                                style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>
                                                                CANCEL
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-1">
                                                            <button onClick={() => startEdit(item)}
                                                                className={`${termBtn} text-[9px] py-1 px-2`}
                                                                style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.25)", backgroundColor: "rgba(56,189,248,0.05)" }}>
                                                                <Pencil className="h-2.5 w-2.5" />
                                                            </button>
                                                            <button onClick={() => openDeleteDialog(item.id)}
                                                                className={`${termBtn} text-[9px] py-1 px-2`}
                                                                style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.25)", backgroundColor: "rgba(248,113,113,0.05)" }}>
                                                                <Trash2 className="h-2.5 w-2.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <TCell mono>{item.assigned_number}</TCell>
                                                <TCell mono>{item.asset_tag}</TCell>
                                                <TCell>{item.asset_type}</TCell>
                                                <TCell>{item.brand}</TCell>
                                                <TCell>{item.model}</TCell>
                                                <TCell mono>{item.serial_number}</TCell>

                                                {/* Editable cells */}
                                                <td className="px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                    {isEditing ? (
                                                        <input type="text" value={editData.new_user ?? ""} onChange={(e) => handleEditChange("new_user", e.target.value)}
                                                            className="w-32 px-2 py-1 text-[11px] font-mono border outline-none"
                                                            style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(56,189,248,0.3)", color: "#7dd3fc" }} />
                                                    ) : <span className="text-[11px]" style={{ color: item.new_user ? "#7dd3fc" : "rgba(255,255,255,0.18)" }}>{item.new_user || "—"}</span>}
                                                </td>
                                                <td className="px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                    {isEditing ? (
                                                        <input type="text" value={editData.position ?? ""} onChange={(e) => handleEditChange("position", e.target.value)}
                                                            className="w-28 px-2 py-1 text-[11px] font-mono border outline-none"
                                                            style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(56,189,248,0.3)", color: "#7dd3fc" }} />
                                                    ) : <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>{item.position || "—"}</span>}
                                                </td>
                                                <td className="px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                    {isEditing ? (
                                                        <input type="text" value={editData.department ?? ""} onChange={(e) => handleEditChange("department", e.target.value)}
                                                            className="w-32 px-2 py-1 text-[11px] font-mono border outline-none"
                                                            style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(56,189,248,0.3)", color: "#7dd3fc" }} />
                                                    ) : <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>{item.department || "—"}</span>}
                                                </td>

                                                <TCell mono muted>
                                                    {item.date_created
                                                        ? new Date(item.date_created).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                                                        : ""}
                                                </TCell>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Confirm Delete Dialog ── */}
            <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <DialogContent className="max-w-sm border font-mono" style={{ backgroundColor: "#0d1117", borderColor: "rgba(248,113,113,0.2)", color: "rgba(255,255,255,0.7)" }}>
                    <DialogHeader>
                        <DialogTitle className="text-[11px] uppercase tracking-widest font-mono flex items-center gap-2" style={{ color: "#f87171" }}>
                            <TerminalDot color="#f87171" /> CONFIRM DELETION
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                            This assigned asset record will be permanently deleted. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <button onClick={() => setConfirmDeleteOpen(false)}
                            className={`${termBtn}`}
                            style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>
                            CANCEL
                        </button>
                        <button onClick={confirmDeletion}
                            className={`${termBtn}`}
                            style={{ backgroundColor: "#f87171", color: "#000", borderColor: "transparent" }}>
                            DELETE
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};