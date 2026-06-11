"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertCircleIcon, CheckCircle2Icon, DownloadCloud, Trash2Icon,
    Printer, Plus, UploadCloud, ArchiveIcon, Filter,
    Activity, Database, Cpu, HardDrive, Monitor,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Pagination, PaginationContent, PaginationItem,
    PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import {
    Sheet, SheetContent, SheetDescription,
    SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
    Accordion, AccordionContent,
    AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { InventoryDialog } from "@/components/inventory-dialog";
import { InventoryFilterDialog } from "@/components/inventory-filter-dialog";
import { supabase } from "@/utils/supabase";
import { type InventoryItem } from "@/types/inventory";
import { generateBulkAccountabilityPDF, groupSelectedItems } from "@/utils/generate-bulk-accountability-pdf";

// ─── Types ────────────────────────────────────────────────────────────────────

type InventoryFilters = {
    status: string; location: string; asset_type: string; department: string;
    brand: string; model: string; processor: string; storage: string; pageSize: string;
};

interface TicketProps {
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { dot: string; text: string; bg: string; border: string }> = {
    SPARE:     { dot: "#22c55e", text: "#86efac", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.25)"  },
    DEPLOYED:  { dot: "#38bdf8", text: "#7dd3fc", bg: "rgba(56,189,248,0.08)", border: "rgba(56,189,248,0.25)" },
    LEND:      { dot: "#a78bfa", text: "#c4b5fd", bg: "rgba(167,139,250,0.08)",border: "rgba(167,139,250,0.25)"},
    MISSING:   { dot: "#fbbf24", text: "#fcd34d", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)" },
    DEFECTIVE: { dot: "#f87171", text: "#fca5a5", bg: "rgba(248,113,113,0.08)",border: "rgba(248,113,113,0.25)"},
    DISPOSE:   { dot: "#6b7280", text: "#9ca3af", bg: "rgba(107,114,128,0.08)",border: "rgba(107,114,128,0.25)"},
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TerminalDot({ color }: { color: string }) {
    return (
        <span className="inline-flex items-center justify-center w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
    );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string | number; accent: string }) {
    return (
        <div className="relative border p-4 font-mono overflow-hidden"
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

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status?.toUpperCase()] ?? STATUS_CONFIG.DISPOSE;
    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border font-mono"
            style={{ color: cfg.text, backgroundColor: cfg.bg, borderColor: cfg.border }}>
            <TerminalDot color={cfg.dot} />
            {status}
        </span>
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

function TCell({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
    return (
        <td className={`px-3 py-2.5 text-[11px] ${mono ? "font-mono" : ""} whitespace-nowrap`}
            style={{ color: "rgba(255,255,255,0.65)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            {children || <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>}
        </td>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const Inventory: React.FC<TicketProps> = ({ dateCreatedFilterRange }) => {
    const [activities,        setActivities]        = useState<InventoryItem[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities,   setErrorActivities]   = useState<string | null>(null);
    const [page,   setPage]   = useState(1);
    const [search, setSearch] = useState("");
    const [open,      setOpen]      = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState<Omit<InventoryItem, "id" | "date_created" | "referenceid">>({
        asset_tag: "", asset_type: "", status: "", location: "", new_user: "", old_user: "",
        department: "", position: "", brand: "", model: "", processor: "", ram: "",
        storage: "", serial_number: "", purchase_date: "", warranty_date: "", asset_age: "",
        amount: "", remarks: "", mac_address: "",
    });

    const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set());
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [filterSheetOpen,   setFilterSheetOpen]   = useState(false);
    const [isPdfGenerating,   setIsPdfGenerating]   = useState(false);
    const [printCompany,      setPrintCompany]      = useState<"ecoshift" | "disruptive">("ecoshift");

    const [filters, setFilters] = useState<InventoryFilters>({
        status: "", location: "", asset_type: "", department: "",
        brand: "", model: "", processor: "", storage: "", pageSize: "25",
    });

    const [hasOldItems,      setHasOldItems]      = useState(false);
    const [oldItems,         setOldItems]         = useState<InventoryItem[]>([]);
    const [updatingOldItems, setUpdatingOldItems] = useState(false);
    const [bulkOpen,         setBulkOpen]         = useState(false);
    const [bulkFile,         setBulkFile]         = useState<File | null>(null);
    const [uploadingBulk,    setUploadingBulk]    = useState(false);
    const [disposeSheetOpen,   setDisposeSheetOpen]   = useState(false);
    const [selectedDisposeIds, setSelectedDisposeIds] = useState<Set<string>>(new Set());

    const pageSize = useMemo(() => { const s = Number(filters.pageSize); return Number.isFinite(s) && s > 0 ? s : 25; }, [filters.pageSize]);

    function handleSelectChange(name: string, value: string) { setForm((p) => ({ ...p, [name]: value })); }
    function handleSetAssetTag(value: string) { setForm((p) => ({ ...p, asset_tag: value })); }

    const fetchActivities = useCallback(() => {
        setLoadingActivities(true); setErrorActivities(null);
        fetch(`/api/fetch-inventory`)
            .then(async (res) => { if (!res.ok) throw new Error("Failed to fetch activities"); return res.json(); })
            .then((data) => {
                const items: InventoryItem[] = data.data || [];
                setActivities(items);
                const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
                const oldOnes = items.filter(item => { if (!item.purchase_date) return false; const d = new Date(item.purchase_date); return !isNaN(d.getTime()) && d < fiveYearsAgo && item.status !== "DISPOSE"; });
                setOldItems(oldOnes); setHasOldItems(oldOnes.length > 0);
            })
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, []);

    useEffect(() => {
        fetchActivities();
        const channel = supabase.channel(`public:inventory`)
            .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, (payload) => {
                const n = payload.new as InventoryItem; const o = payload.old as InventoryItem;
                setActivities((curr) => {
                    switch (payload.eventType) {
                        case "INSERT": return curr.some((a) => a.id === n.id) ? curr : [...curr, n];
                        case "UPDATE": return curr.map((a) => (a.id === n.id ? n : a));
                        case "DELETE": return curr.filter((a) => a.id !== o.id);
                        default: return curr;
                    }
                });
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchActivities]);

    function resetFilters() { setFilters({ status: "", location: "", asset_type: "", department: "", brand: "", model: "", processor: "", storage: "", pageSize: "25" }); setPage(1); }
    function applyFilters() { setPage(1); setFilterSheetOpen(false); }

    const filteredActivities = useMemo(() => {
        if (!activities.length) return [];
        let startDate: Date | null = null, endDate: Date | null = null;
        if (dateCreatedFilterRange?.from) { startDate = new Date(dateCreatedFilterRange.from); startDate.setHours(0,0,0,0); }
        if (dateCreatedFilterRange?.to)   { endDate   = new Date(dateCreatedFilterRange.to);   endDate.setHours(23,59,59,999); }
        const filtered = activities.filter((item) => {
            if (item.status === "Dispose") return false;
            if (search.trim() && !Object.values(item).some(v => v?.toString().toLowerCase().includes(search.toLowerCase()))) return false;
            if (!Object.entries(filters).every(([key, fv]) => { if (!fv || key === "pageSize") return true; const iv = item[key as keyof InventoryItem]; return iv?.toString().toLowerCase().includes(fv.toLowerCase()) ?? false; })) return false;
            if (startDate || endDate) { if (!item.purchase_date) return false; const d = new Date(item.purchase_date); if (isNaN(d.getTime())) return false; if (startDate && d < startDate) return false; if (endDate && d > endDate) return false; }
            return true;
        });
        filtered.sort((a, b) => { if (!a.asset_tag) return 1; if (!b.asset_tag) return -1; return b.asset_tag.localeCompare(a.asset_tag); });
        return filtered;
    }, [activities, search, filters, dateCreatedFilterRange]);

    const stats = useMemo(() => ({
        total:    filteredActivities.length,
        deployed: filteredActivities.filter(i => i.status?.toUpperCase() === "DEPLOYED").length,
        spare:    filteredActivities.filter(i => i.status?.toUpperCase() === "SPARE").length,
        defect:   filteredActivities.filter(i => ["DEFECTIVE","MISSING"].includes(i.status?.toUpperCase())).length,
    }), [filteredActivities]);

    const pageCount = Math.ceil(filteredActivities.length / pageSize);
    const paginatedActivities = useMemo(() => { const s = (page - 1) * pageSize; return filteredActivities.slice(s, s + pageSize); }, [filteredActivities, page, pageSize]);

    const showPrintButton = selectedIds.size > 0 && [...selectedIds].some(id => { const item = activities.find(a => a.id === id); return !!item?.new_user?.trim(); });

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) { const { name, value } = e.target; setForm((p) => ({ ...p, [name]: value })); }

    async function handleSubmit() {
        if (!form.status) { alert("Status is required"); return; }
        try {
            const res = await fetch("/api/create-inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form }) });
            if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Failed to create inventory"); }
            toast.success("Record created."); fetchActivities(); setOpen(false); resetForm();
        } catch (e: any) { toast.error(e.message); }
    }

    async function handleUpdate() {
        if (!form.status || !editingId) { alert("Status is required"); return; }
        try {
            const res = await fetch(`/api/update-inventory?id=${encodeURIComponent(editingId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form }) });
            if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Failed to update inventory"); }
            toast.success("Record updated."); fetchActivities(); setOpen(false); resetForm();
        } catch (e: any) { toast.error(e.message); }
    }

    function resetForm() {
        setForm({ asset_tag: "", asset_type: "", status: "", location: "", new_user: "", old_user: "", department: "", position: "", brand: "", model: "", processor: "", ram: "", storage: "", serial_number: "", purchase_date: "", warranty_date: "", asset_age: "", amount: "", remarks: "", mac_address: "" });
        setEditingId(null);
    }

    function openEditDialog(item: InventoryItem) {
        setEditingId(item.id);
        setForm({ status: item.status, location: item.location ?? "", new_user: item.new_user ?? "", old_user: item.old_user ?? "", department: item.department ?? "", position: item.position ?? "", brand: item.brand ?? "", model: item.model ?? "", processor: item.processor ?? "", ram: item.ram ?? "", storage: item.storage ?? "", serial_number: item.serial_number ?? "", purchase_date: item.purchase_date ?? "", warranty_date: item.warranty_date ?? "", asset_age: item.asset_age ?? "", amount: item.amount ?? "", remarks: item.remarks ?? "", mac_address: item.mac_address ?? "" });
        setOpen(true);
    }

    function toggleSelect(id: string) { setSelectedIds((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; }); }
    function toggleSelectAll() { const all = paginatedActivities.every(i => selectedIds.has(i.id)); setSelectedIds((p) => { const s = new Set(p); all ? paginatedActivities.forEach(i => s.delete(i.id)) : paginatedActivities.forEach(i => s.add(i.id)); return s; }); }

    async function handleDeleteSelected() { if (selectedIds.size === 0) return; setConfirmDeleteOpen(true); }
    async function confirmDeletion() {
        try {
            const res = await fetch("/api/delete-inventory", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: Array.from(selectedIds) }) });
            if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Failed to delete inventory items"); }
            toast.success(`${selectedIds.size} record(s) deleted.`); setSelectedIds(new Set()); setConfirmDeleteOpen(false); fetchActivities();
        } catch (e: any) { toast.error(e.message); setConfirmDeleteOpen(false); }
    }

    async function handlePrintBulk() {
        if (selectedIds.size === 0) return;
        const selectedItems = activities.filter(a => selectedIds.has(a.id));
        const groups = groupSelectedItems(selectedItems);
        if (groups.every(g => g.new_user === "Unknown")) { toast.error("None of the selected items have a valid employee name."); return; }
        setIsPdfGenerating(true);
        try { await generateBulkAccountabilityPDF(groups, printCompany); }
        catch { toast.error("Failed to generate PDF"); }
        finally { setIsPdfGenerating(false); }
    }

    function toggleDisposeSelect(id: string) { setSelectedDisposeIds((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; }); }
    function toggleDisposeSelectAll() { setSelectedDisposeIds(selectedDisposeIds.size === oldItems.length ? new Set() : new Set(oldItems.map(i => i.id))); }

    async function confirmUpdateDispose() {
        if (selectedDisposeIds.size === 0) { toast.error("Select at least one item."); return; }
        setUpdatingOldItems(true);
        try {
            const res = await fetch("/api/update-status-old-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: Array.from(selectedDisposeIds), newStatus: "Dispose" }) });
            if (!res.ok) { const j = await res.json(); toast.error("Failed: " + (j.error ?? "")); setUpdatingOldItems(false); return; }
            toast.success(`${selectedDisposeIds.size} item(s) marked as Dispose.`); fetchActivities(); setDisposeSheetOpen(false); setSelectedDisposeIds(new Set());
        } catch { toast.error("Error updating old items."); } finally { setUpdatingOldItems(false); }
    }

    const handleBulkUpload = async () => {
        if (!bulkFile) { toast.error("Please select a CSV file"); return; }
        setUploadingBulk(true);
        try {
            const text = await bulkFile.text();
            const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
            if (lines.length < 2) throw new Error("CSV file is empty");
            const headers = lines[0].split(",").map(h => h.trim());
            const allowed = ["asset_tag","asset_type","status","location","new_user","old_user","department","position","brand","model","processor","ram","storage","serial_number","purchase_date","warranty_date","asset_age","amount","remarks","mac_address"];
            const invalid = headers.filter(h => !allowed.includes(h));
            if (invalid.length > 0) throw new Error(`Invalid column(s): ${invalid.join(", ")}`);
            const records = lines.slice(1).map(line => { const vals = line.split(",").map(v => v.replace(/^"|"$/g, "").trim()); const row: any = { referenceid: null, status: "Spare" }; headers.forEach((h, i) => { row[h] = vals[i] || null; }); return row; });
            const { error } = await supabase.from("inventory").insert(records);
            if (error) throw error;
            toast.success(`${records.length} record(s) imported.`); setBulkOpen(false); setBulkFile(null); fetchActivities();
        } catch (e: any) { toast.error(e.message || "Bulk upload failed"); } finally { setUploadingBulk(false); }
    };

    function handleDownloadCSV() {
        const headers = ["id","referenceid","asset_tag","asset_type","status","location","new_user","old_user","department","position","brand","model","processor","ram","storage","serial_number","purchase_date","warranty_date","asset_age","amount","remarks","mac_address","date_created"];
        const esc = (v: any) => { if (v == null) return ""; const s = v.toString(); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g, '""')}"` : s; };
        const csv = [headers.join(","), ...activities.map(item => headers.map(h => esc(item[h as keyof InventoryItem])).join(","))].join("\n");
        if (!csv) { toast.error("No data available"); return; }
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url;
        link.setAttribute("download", `inventory_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    }

    useEffect(() => { setPage(1); }, [search, filters]);

    // ── Shared button styles ───────────────────────────────────────────────────
    const termBtn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
    const primaryBtn = `${termBtn} text-black border-transparent` ;
    const ghostBtn   = `${termBtn}`;
    const dangerBtn  = `${termBtn}`;

    if (errorActivities) {
        return (
            <div className="font-mono p-6 border text-sm" style={{ backgroundColor: "#080c10", borderColor: "rgba(248,113,113,0.3)", color: "#fca5a5" }}>
                <div className="flex items-center gap-2 mb-2"><TerminalDot color="#f87171" /><span className="uppercase tracking-widest text-[10px]">CONNECTION ERROR</span></div>
                <p className="text-[11px] opacity-60">Failed to fetch inventory. Check network or Supabase credentials.</p>
            </div>
        );
    }

    return (
        <div className="font-mono flex flex-col gap-0" style={{ backgroundColor: "#080c10", minHeight: "100%" }}>

            {/* ── Dot grid background ── */}
            <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px", zIndex: 0 }} />

            <div className="relative z-10 flex flex-col gap-0">

                {/* ── Top bar ── */}
                <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-3">
                        <TerminalDot color="#22c55e" />
                        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>INVENTORY SYSTEM</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>STATUS</span>
                        <TerminalDot color="#22c55e" />
                        <span className="text-[9px] uppercase tracking-widest" style={{ color: "#22c55e" }}>ONLINE</span>
                    </div>
                </div>

                {/* ── Stat cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                    <StatCard icon={Database} label="Total Assets"    value={stats.total}    accent="#38bdf8" />
                    <StatCard icon={Activity} label="Deployed"         value={stats.deployed} accent="#22c55e" />
                    <StatCard icon={HardDrive} label="Spare"           value={stats.spare}    accent="#a78bfa" />
                    <StatCard icon={Cpu}       label="Issues"          value={stats.defect}   accent="#f87171" />
                </div>

                {/* ── Toolbar ── */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}>

                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none" style={{ color: "rgba(255,255,255,0.25)" }}>›</span>
                        <input
                            type="search"
                            placeholder="SEARCH RECORDS..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-6 pr-3 py-1.5 text-[10px] font-mono uppercase tracking-widest outline-none border placeholder:opacity-30"
                            style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                        {/* Export */}
                        <button onClick={handleDownloadCSV} className={ghostBtn} style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)" }}>
                            <DownloadCloud className="h-3 w-3" /> EXPORT
                        </button>

                        {/* Bulk import */}
                        <button onClick={() => setBulkOpen(true)} className={ghostBtn} style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)" }}>
                            <UploadCloud className="h-3 w-3" /> IMPORT
                        </button>

                        {/* Filter */}
                        <InventoryFilterDialog open={filterSheetOpen} setOpen={setFilterSheetOpen} filters={filters} setFilters={setFilters} resetFilters={resetFilters} applyFilters={applyFilters} />

                        {/* Selected actions */}
                        {selectedIds.size > 0 && (
                            <>
                                <button onClick={handleDeleteSelected} className={dangerBtn} style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.06)" }}>
                                    <Trash2Icon className="h-3 w-3" /> DELETE ({selectedIds.size})
                                </button>
                                {showPrintButton && (
                                    <div className="flex items-center gap-1">
                                        <select
                                            value={printCompany}
                                            onChange={(e) => setPrintCompany(e.target.value as "ecoshift" | "disruptive")}
                                            disabled={isPdfGenerating}
                                            className="h-8 px-2 text-[9px] font-mono uppercase tracking-widest border outline-none"
                                            style={{ backgroundColor: "rgba(56,189,248,0.06)", borderColor: "rgba(56,189,248,0.3)", color: "#7dd3fc" }}
                                        >
                                            <option value="ecoshift">ECOSHIFT</option>
                                            <option value="disruptive">DISRUPTIVE</option>
                                        </select>
                                        <button onClick={handlePrintBulk} disabled={isPdfGenerating} className={primaryBtn} style={{ backgroundColor: "#38bdf8" }}>
                                            <Printer className="h-3 w-3" /> {isPdfGenerating ? "GENERATING..." : "PRINT"}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Add new */}
                        <button onClick={() => { resetForm(); setOpen(true); }} className={primaryBtn} style={{ backgroundColor: "#22c55e" }}>
                            <Plus className="h-3 w-3" /> ADD NEW
                        </button>

                        {/* Dispose old */}
                        {hasOldItems && (
                            <button onClick={() => { setSelectedDisposeIds(new Set()); setDisposeSheetOpen(true); }} disabled={updatingOldItems} className={dangerBtn} style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.06)" }}>
                                <ArchiveIcon className="h-3 w-3" /> DISPOSE ({oldItems.length})
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Table area ── */}
                <div className="overflow-x-auto">
                    {loadingActivities ? (
                        <div className="flex items-center justify-center gap-3 py-16" style={{ color: "rgba(255,255,255,0.3)" }}>
                            <div className="w-4 h-4 border-t border-current rounded-full animate-spin" />
                            <span className="text-[10px] uppercase tracking-widest">LOADING RECORDS...</span>
                        </div>
                    ) : filteredActivities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2">
                            <Database className="h-6 w-6 opacity-10" />
                            <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>NO RECORDS FOUND</span>
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-[11px]" style={{ minWidth: "1200px" }}>
                            <thead>
                                <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                                    <th className="px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", width: "32px" }}>
                                        <input type="checkbox" onChange={toggleSelectAll} checked={paginatedActivities.length > 0 && paginatedActivities.every(i => selectedIds.has(i.id))}
                                            className="w-3 h-3 accent-cyan-400" />
                                    </th>
                                    <THead>Action</THead>
                                    <THead>Asset Tag</THead>
                                    <THead>Type</THead>
                                    <THead>Status</THead>
                                    <THead>Location</THead>
                                    <THead>New User</THead>
                                    <THead>Old User</THead>
                                    <THead>Dept</THead>
                                    <THead>Position</THead>
                                    <THead>Brand</THead>
                                    <THead>Model</THead>
                                    <THead>Processor</THead>
                                    <THead>RAM</THead>
                                    <THead>Storage</THead>
                                    <THead>Serial</THead>
                                    <THead>Purchase Date</THead>
                                    <THead>Age</THead>
                                    <THead>Amount</THead>
                                    <THead>Remarks</THead>
                                    <THead>MAC</THead>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedActivities.map((item, idx) => {
                                    const isSelected = selectedIds.has(item.id);
                                    return (
                                        <tr key={item.id}
                                            onClick={() => toggleSelect(item.id)}
                                            className="cursor-pointer transition-colors duration-75"
                                            style={{ backgroundColor: isSelected ? "rgba(56,189,248,0.06)" : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
                                            <td className="px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)} onClick={e => e.stopPropagation()} className="w-3 h-3 accent-cyan-400" />
                                            </td>
                                            <td className="px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openEditDialog(item); }}
                                                    className={`${ghostBtn} text-[9px] py-1 px-2`}
                                                    style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>
                                                    EDIT
                                                </button>
                                            </td>
                                            <TCell mono>{item.asset_tag}</TCell>
                                            <TCell>
                                                <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
                                                    {item.asset_type}
                                                </span>
                                            </TCell>
                                            <TCell><StatusBadge status={item.status} /></TCell>
                                            <TCell>{item.location}</TCell>
                                            <TCell>
                                                {item.new_user
                                                    ? <span style={{ color: "#7dd3fc" }}>{item.new_user}</span>
                                                    : <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>}
                                            </TCell>
                                            <TCell>{item.old_user}</TCell>
                                            <TCell>{item.department}</TCell>
                                            <TCell>{item.position}</TCell>
                                            <TCell>{item.brand}</TCell>
                                            <TCell>{item.model}</TCell>
                                            <TCell mono>{item.processor}</TCell>
                                            <TCell mono>{item.ram}</TCell>
                                            <TCell mono>{item.storage}</TCell>
                                            <TCell mono>{item.serial_number}</TCell>
                                            <TCell mono>{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : ""}</TCell>
                                            <TCell mono>{item.asset_age}</TCell>
                                            <TCell mono>{item.amount}</TCell>
                                            <TCell>{item.remarks}</TCell>
                                            <TCell mono>{item.mac_address}</TCell>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Pagination ── */}
                {filteredActivities.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
                            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredActivities.length)} of {filteredActivities.length} records
                        </span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => page > 1 && setPage(page - 1)} disabled={page <= 1}
                                className={`${ghostBtn} text-[9px] py-1`}
                                style={{ color: page <= 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.08)" }}>
                                ← PREV
                            </button>
                            <span className="px-3 text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
                                {pageCount === 0 ? "0/0" : `${page}/${pageCount}`}
                            </span>
                            <button onClick={() => page < pageCount && setPage(page + 1)} disabled={page >= pageCount}
                                className={`${ghostBtn} text-[9px] py-1`}
                                style={{ color: page >= pageCount ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.08)" }}>
                                NEXT →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Dispose Sheet ── */}
            <Sheet open={disposeSheetOpen} onOpenChange={setDisposeSheetOpen}>
                <SheetContent className="max-w-3xl border-l font-mono" style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
                    <SheetHeader>
                        <SheetTitle className="text-[11px] uppercase tracking-widest font-mono" style={{ color: "#fbbf24" }}>
                            <TerminalDot color="#fbbf24" /> Mark As Dispose
                        </SheetTitle>
                        <SheetDescription className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                            Assets 5+ years old. Select items to mark as DISPOSE.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="overflow-auto max-h-[60vh] mt-4">
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <input type="checkbox" id="selectAllDispose" checked={selectedDisposeIds.size === oldItems.length && oldItems.length > 0} onChange={toggleDisposeSelectAll} className="w-3 h-3 accent-yellow-400" />
                            <label htmlFor="selectAllDispose" className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>SELECT ALL</label>
                        </div>
                        <Accordion type="multiple" className="w-full space-y-px">
                            {oldItems.map((item) => (
                                <AccordionItem key={item.id} value={item.id} className="border-0">
                                    <AccordionTrigger className="px-3 py-2 text-[10px] hover:no-underline" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderLeft: selectedDisposeIds.has(item.id) ? "2px solid #fbbf24" : "2px solid transparent" }}>
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={selectedDisposeIds.has(item.id)} onChange={(e) => { e.stopPropagation(); toggleDisposeSelect(item.id); }} onClick={e => e.stopPropagation()} className="w-3 h-3 accent-yellow-400" />
                                            <span className="font-mono" style={{ color: "rgba(255,255,255,0.7)" }}>{item.asset_tag || "NO TAG"}</span>
                                            <span style={{ color: "rgba(255,255,255,0.3)" }}>{item.brand} {item.model}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-3 pt-1 text-[10px] font-mono grid grid-cols-2 gap-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                                        {[["Dept", item.department], ["Location", item.location], ["Type", item.asset_type], ["Status", item.status], ["Serial", item.serial_number], ["Purchased", item.purchase_date]].map(([k, v]) => (
                                            <div key={k} className="flex gap-2"><span style={{ color: "rgba(255,255,255,0.25)" }}>{k}:</span><span>{v || "—"}</span></div>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                        <button onClick={() => setDisposeSheetOpen(false)} disabled={updatingOldItems} className={ghostBtn} style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>CANCEL</button>
                        <button onClick={confirmUpdateDispose} disabled={updatingOldItems || selectedDisposeIds.size === 0} className={primaryBtn} style={{ backgroundColor: "#fbbf24" }}>
                            {updatingOldItems ? "UPDATING..." : `DISPOSE (${selectedDisposeIds.size})`}
                        </button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* ── Inventory Dialog ── */}
            <InventoryDialog open={open} setOpen={setOpen} editingId={editingId} form={form} handleInputChange={handleInputChange} handleSelectChange={handleSelectChange} handleSetAssetTag={handleSetAssetTag} handleSubmit={handleSubmit} handleUpdate={handleUpdate} resetForm={resetForm} />

            {/* ── Bulk Upload Dialog ── */}
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogContent className="max-w-md border font-mono" style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
                    <DialogHeader>
                        <DialogTitle className="text-[11px] uppercase tracking-widest font-mono" style={{ color: "#38bdf8" }}>BULK IMPORT</DialogTitle>
                        <DialogDescription className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>Upload a CSV file. Column names must match inventory fields.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-[9px] uppercase tracking-widest block mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>CSV File</label>
                            <input type="file" accept=".csv" onChange={(e) => setBulkFile(e.target.files?.[0] || null)} className="w-full px-3 py-1.5 text-[11px] font-mono border outline-none file:mr-3 file:text-[9px] file:uppercase file:tracking-widest file:border-0 file:bg-transparent" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }} />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <button onClick={() => setBulkOpen(false)} className={ghostBtn} style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>CANCEL</button>
                        <button onClick={handleBulkUpload} disabled={uploadingBulk} className={primaryBtn} style={{ backgroundColor: "#38bdf8" }}>{uploadingBulk ? "UPLOADING..." : "UPLOAD"}</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Confirm Delete ── */}
            <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <DialogContent className="max-w-sm border font-mono" style={{ backgroundColor: "#0d1117", borderColor: "rgba(248,113,113,0.2)", color: "rgba(255,255,255,0.7)" }}>
                    <DialogHeader>
                        <DialogTitle className="text-[11px] uppercase tracking-widest font-mono flex items-center gap-2" style={{ color: "#f87171" }}>
                            <TerminalDot color="#f87171" /> CONFIRM DELETION
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                            {selectedIds.size} record(s) will be permanently deleted. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <button onClick={() => setConfirmDeleteOpen(false)} className={ghostBtn} style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>CANCEL</button>
                        <button onClick={confirmDeletion} className={primaryBtn} style={{ backgroundColor: "#f87171" }}>DELETE</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};