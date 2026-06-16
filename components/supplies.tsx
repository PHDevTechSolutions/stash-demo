"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight, BoxesIcon, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplyItem {
    id: string;
    referenceid: string;
    name: string;
    category?: string;
    brand?: string;
    model?: string;
    serial_number?: string;
    quantity?: number;
    unit?: string;
    location?: string;
    condition?: string;
    assigned_to?: string;
    department?: string;
    remarks?: string;
    date_created?: string;
}

interface SuppliesProps {
    referenceid: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}

const PAGE_SIZE = 15;

const CATEGORY_OPTIONS = [
    "AVR / UPS", "Printer", "Scanner", "Keyboard", "Mouse",
    "Headset", "Webcam", "External Drive", "Flash Drive", "Cable / Adapter",
    "Network Device", "Phone / Tablet", "Toner / Ink", "Office Supply", "Other",
];
const CONDITION_OPTIONS = ["Good", "Fair", "For Repair", "Defective", "Disposed"];
const UNIT_OPTIONS      = ["pc", "unit", "set", "box", "pair", "roll", "pack"];

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls  = "w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none placeholder:opacity-25 transition-colors disabled:opacity-40";
const inputStyle: React.CSSProperties = { backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" };
const selectStyle: React.CSSProperties = { backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)", outline: "none", appearance: "none" as const };
const termBtn   = "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer disabled:opacity-40";

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

function TCell({ children, mono = false }: { children?: React.ReactNode; mono?: boolean }) {
    return (
        <td className={`px-3 py-2.5 text-[11px] ${mono ? "font-mono" : ""} whitespace-nowrap`}
            style={{ color: "rgba(255,255,255,0.65)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            {children || <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>}
        </td>
    );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
    return (
        <label className="text-[9px] uppercase tracking-[0.15em] mb-1.5 block" style={{ color: "rgba(255,255,255,0.3)" }}>
            {children}{required && <span style={{ color: "#f87171" }}> *</span>}
        </label>
    );
}

function TermInput({ id, name, value, onChange, placeholder, type = "text", disabled }: {
    id?: string; name: string; value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string; type?: string; disabled?: boolean;
}) {
    return <input id={id} name={name} value={value} onChange={onChange} placeholder={placeholder} type={type} disabled={disabled} className={inputCls} style={inputStyle} />;
}

function TermSelect({ id, name, value, onChange, options, placeholder }: {
    id?: string; name: string; value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[]; placeholder?: string;
}) {
    return (
        <select id={id} name={name} value={value} onChange={onChange} className="w-full px-2.5 py-1.5 text-[11px] font-mono border" style={selectStyle}>
            <option value="" style={{ backgroundColor: "#0d1117", color: "rgba(255,255,255,0.3)" }}>{placeholder || "— SELECT —"}</option>
            {options.map((o) => <option key={o} value={o} style={{ backgroundColor: "#0d1117", color: "#e2e8f0" }}>{o}</option>)}
        </select>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const emptyForm = (): Omit<SupplyItem, "id" | "referenceid" | "date_created"> => ({
    name: "", category: "", brand: "", model: "", serial_number: "",
    quantity: undefined, unit: "", location: "", condition: "", assigned_to: "",
    department: "", remarks: "",
});

export const Supplies: React.FC<SuppliesProps> = ({ referenceid, dateCreatedFilterRange }) => {
    const [activities,        setActivities]        = useState<SupplyItem[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities,   setErrorActivities]   = useState<string | null>(null);
    const [page,   setPage]   = useState(1);
    const [search, setSearch] = useState("");
    const [open,       setOpen]       = useState(false);
    const [editingId,  setEditingId]  = useState<string | null>(null);
    const [form,       setForm]       = useState(emptyForm());
    const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set());
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchActivities = useCallback(async () => {
        if (!referenceid) { setActivities([]); return; }
        setLoadingActivities(true); setErrorActivities(null);
        try {
            const { data, error } = await supabase
                .from("supplies").select("*")
                .eq("referenceid", referenceid)
                .order("date_created", { ascending: false });
            if (error) throw error;
            setActivities(data ?? []);
        } catch (err: any) {
            setErrorActivities(err.message || "Error fetching supplies");
            toast.error(err.message || "Error fetching supplies");
        } finally { setLoadingActivities(false); }
    }, [referenceid]);

    useEffect(() => { fetchActivities(); }, [fetchActivities]);

    // ── Realtime ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!referenceid) return;
        const ch = supabase.channel(`public:supplies:referenceid=eq.${referenceid}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "supplies", filter: `referenceid=eq.${referenceid}` }, (payload) => {
                const n = payload.new as SupplyItem, o = payload.old as SupplyItem;
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
            if (search.trim() && !Object.values(item).some((v) => v?.toString().toLowerCase().includes(search.toLowerCase()))) return false;
            if (startDate || endDate) {
                if (!item.date_created) return false;
                const d = new Date(item.date_created);
                if (isNaN(d.getTime())) return false;
                if (startDate && d < startDate) return false;
                if (endDate   && d > endDate)   return false;
            }
            return true;
        });
    }, [activities, search, dateCreatedFilterRange]);

    const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
    const paginatedActivities = useMemo(() => filteredActivities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredActivities, page]);

    // ── Form handlers ─────────────────────────────────────────────────────────
    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: name === "quantity" ? (value === "" ? undefined : Number(value)) : value }));
    }

    function resetForm() { setForm(emptyForm()); setEditingId(null); }

    function openEditDialog(item: SupplyItem) {
        setEditingId(item.id);
        setForm({ name: item.name, category: item.category ?? "", brand: item.brand ?? "", model: item.model ?? "", serial_number: item.serial_number ?? "", quantity: item.quantity, unit: item.unit ?? "", location: item.location ?? "", condition: item.condition ?? "", assigned_to: item.assigned_to ?? "", department: item.department ?? "", remarks: item.remarks ?? "" });
        setOpen(true);
    }

    async function handleSubmit() {
        if (!form.name.trim()) { toast.error("Name is required."); return; }
        try {
            const { error } = await supabase.from("supplies").insert([{ ...form, referenceid }]);
            if (error) throw error;
            toast.success("Supply created."); fetchActivities(); setOpen(false); resetForm();
        } catch (err: any) { toast.error(err.message || "Error creating supply"); }
    }

    async function handleUpdate() {
        if (!editingId) return;
        try {
            const { error } = await supabase.from("supplies").update(form).eq("id", editingId);
            if (error) throw error;
            toast.success("Supply updated."); fetchActivities(); setOpen(false); resetForm();
        } catch (err: any) { toast.error(err.message || "Error updating supply"); }
    }

    // ── Selection ─────────────────────────────────────────────────────────────
    function toggleSelect(id: string) { setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
    function toggleSelectAll() {
        const all = paginatedActivities.every((i) => selectedIds.has(i.id));
        setSelectedIds((p) => { const n = new Set(p); paginatedActivities.forEach((i) => all ? n.delete(i.id) : n.add(i.id)); return n; });
    }

    async function confirmDeletion() {
        try {
            const { error } = await supabase.from("supplies").delete().in("id", Array.from(selectedIds));
            if (error) throw error;
            toast.success(`${selectedIds.size} item(s) deleted.`); setSelectedIds(new Set()); setConfirmDeleteOpen(false); fetchActivities();
        } catch (err: any) { toast.error(err.message || "Error deleting supplies"); setConfirmDeleteOpen(false); }
    }

    // ── JSX ───────────────────────────────────────────────────────────────────
    return (
        <div className="font-mono flex flex-col gap-0" style={{ backgroundColor: "#080c10", minHeight: "100%" }}>
            <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px", zIndex: 0 }} />

            <div className="relative z-10 flex flex-col gap-4 p-4">

                {/* Top bar */}
                <div className="flex items-center justify-between px-4 py-2.5 border" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-3">
                        <TerminalDot color="#a78bfa" />
                        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>SUPPLIES</span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>/ {referenceid}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 border font-mono" style={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)", backgroundColor: "rgba(167,139,250,0.06)" }}>
                            {filteredActivities.length} ITEMS
                        </span>
                        {selectedIds.size > 0 && (
                            <button onClick={() => setConfirmDeleteOpen(true)} className={termBtn} style={{ backgroundColor: "#f87171", color: "#000", borderColor: "transparent" }}>
                                <Trash2 className="h-3 w-3" /> DELETE ({selectedIds.size})
                            </button>
                        )}
                        <button onClick={() => { resetForm(); setOpen(true); }} className={termBtn} style={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)", backgroundColor: "rgba(167,139,250,0.06)" }}>
                            <Plus className="h-3 w-3" /> ADD SUPPLY
                        </button>
                    </div>
                </div>

                {/* Table panel */}
                <div className="border flex flex-col" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}>
                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <div className="flex items-center gap-2">
                            <BoxesIcon className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                            <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>SUPPLY RECORDS</span>
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
                        ) : errorActivities ? (
                            <div className="flex items-center gap-2 p-4 text-[10px]" style={{ color: "#f87171" }}>
                                <TerminalDot color="#f87171" /> {errorActivities}
                            </div>
                        ) : filteredActivities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2">
                                <BoxesIcon className="h-6 w-6 opacity-10" />
                                <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>NO SUPPLY RECORDS</span>
                            </div>
                        ) : (
                            <table className="w-full border-collapse" style={{ minWidth: "1000px" }}>
                                <thead>
                                    <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                                        <THead><input type="checkbox" onChange={toggleSelectAll} checked={paginatedActivities.length > 0 && paginatedActivities.every((i) => selectedIds.has(i.id))} className="accent-violet-400" /></THead>
                                        <THead>Actions</THead>
                                        <THead>Name</THead>
                                        <THead>Category</THead>
                                        <THead>Brand</THead>
                                        <THead>Model</THead>
                                        <THead>Serial #</THead>
                                        <THead>Qty</THead>
                                        <THead>Unit</THead>
                                        <THead>Location</THead>
                                        <THead>Condition</THead>
                                        <THead>Assigned To</THead>
                                        <THead>Department</THead>
                                        <THead>Remarks</THead>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedActivities.map((item, idx) => (
                                        <tr key={item.id} style={{ backgroundColor: selectedIds.has(item.id) ? "rgba(167,139,250,0.06)" : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
                                            <td className="px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="accent-violet-400" />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                <button onClick={() => openEditDialog(item)} className={`${termBtn} text-[9px] py-1 px-2`} style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.25)", backgroundColor: "rgba(56,189,248,0.05)" }}>
                                                    <Pencil className="h-2.5 w-2.5" />
                                                </button>
                                            </td>
                                            <TCell>{item.name}</TCell>
                                            <TCell>
                                                {item.category && (
                                                    <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border font-mono" style={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.25)", backgroundColor: "rgba(167,139,250,0.06)" }}>
                                                        {item.category}
                                                    </span>
                                                )}
                                            </TCell>
                                            <TCell>{item.brand}</TCell>
                                            <TCell>{item.model}</TCell>
                                            <TCell mono>{item.serial_number}</TCell>
                                            <TCell mono>{item.quantity?.toString()}</TCell>
                                            <TCell>{item.unit}</TCell>
                                            <TCell>{item.location}</TCell>
                                            <TCell>
                                                {item.condition && (
                                                    <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border font-mono"
                                                        style={{
                                                            color: item.condition === "Good" ? "#34d399" : item.condition === "Defective" || item.condition === "Disposed" ? "#f87171" : "#fbbf24",
                                                            borderColor: item.condition === "Good" ? "rgba(52,211,153,0.3)" : item.condition === "Defective" || item.condition === "Disposed" ? "rgba(248,113,113,0.3)" : "rgba(251,191,36,0.3)",
                                                            backgroundColor: item.condition === "Good" ? "rgba(52,211,153,0.06)" : item.condition === "Defective" || item.condition === "Disposed" ? "rgba(248,113,113,0.06)" : "rgba(251,191,36,0.06)",
                                                        }}>
                                                        {item.condition}
                                                    </span>
                                                )}
                                            </TCell>
                                            <TCell>{item.assigned_to}</TCell>
                                            <TCell>{item.department}</TCell>
                                            <TCell>{item.remarks}</TCell>
                                        </tr>
                                    ))}
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

            {/* ── Create / Edit Dialog ── */}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
                <DialogContent className="max-w-2xl border font-mono p-0" style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.08)" }}>
                    <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px", zIndex: 0 }} />
                    <DialogHeader className="relative z-10 px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#a78bfa", boxShadow: "0 0 5px #a78bfa" }} />
                            <DialogTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#a78bfa" }}>
                                {editingId ? "EDIT SUPPLY" : "ADD NEW SUPPLY"}
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-[9px] uppercase tracking-widest pl-3.5 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                            {editingId ? "Update the supply record." : "Fill out the form to add a new supply item."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative z-10 grid grid-cols-2 gap-4 px-6 py-5 max-h-[65vh] overflow-y-auto custom-scrollbar">
                        <div className="col-span-2 flex flex-col">
                            <FieldLabel required>Name</FieldLabel>
                            <TermInput name="name" value={form.name} onChange={handleChange} placeholder="SUPPLY NAME" />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Category</FieldLabel>
                            <TermSelect name="category" value={form.category ?? ""} onChange={handleChange} options={CATEGORY_OPTIONS} placeholder="SELECT CATEGORY" />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Brand</FieldLabel>
                            <TermInput name="brand" value={form.brand ?? ""} onChange={handleChange} placeholder="BRAND" />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Model</FieldLabel>
                            <TermInput name="model" value={form.model ?? ""} onChange={handleChange} placeholder="MODEL" />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Serial Number</FieldLabel>
                            <TermInput name="serial_number" value={form.serial_number ?? ""} onChange={handleChange} placeholder="SERIAL #" />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Quantity</FieldLabel>
                            <TermInput name="quantity" value={form.quantity ?? ""} onChange={handleChange} placeholder="0" type="number" />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Unit</FieldLabel>
                            <TermSelect name="unit" value={form.unit ?? ""} onChange={handleChange} options={UNIT_OPTIONS} placeholder="SELECT UNIT" />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Location</FieldLabel>
                            <TermInput name="location" value={form.location ?? ""} onChange={handleChange} placeholder="LOCATION" />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Condition</FieldLabel>
                            <TermSelect name="condition" value={form.condition ?? ""} onChange={handleChange} options={CONDITION_OPTIONS} placeholder="SELECT CONDITION" />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Assigned To</FieldLabel>
                            <TermInput name="assigned_to" value={form.assigned_to ?? ""} onChange={handleChange} placeholder="ASSIGNED TO" />
                        </div>
                        <div className="flex flex-col">
                            <FieldLabel>Department</FieldLabel>
                            <TermInput name="department" value={form.department ?? ""} onChange={handleChange} placeholder="DEPARTMENT" />
                        </div>
                        <div className="col-span-2 flex flex-col">
                            <FieldLabel>Remarks</FieldLabel>
                            <textarea name="remarks" value={form.remarks ?? ""} onChange={handleChange} placeholder="ADDITIONAL NOTES..." rows={3}
                                className="w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none resize-none placeholder:opacity-25" style={inputStyle} />
                        </div>
                    </div>

                    <DialogFooter className="relative z-10 flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <button onClick={() => { setOpen(false); resetForm(); }} className={termBtn} style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>CANCEL</button>
                        <button onClick={editingId ? handleUpdate : handleSubmit} className={termBtn} style={{ backgroundColor: "#a78bfa", color: "#000", borderColor: "transparent" }}>
                            {editingId ? "UPDATE →" : "CREATE →"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Confirm Delete ── */}
            <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <DialogContent className="max-w-sm border font-mono p-0" style={{ backgroundColor: "#0d1117", borderColor: "rgba(248,113,113,0.2)" }}>
                    <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px", zIndex: 0 }} />
                    <DialogHeader className="relative z-10 px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <div className="flex items-center gap-2"><TerminalDot color="#f87171" /><DialogTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#f87171" }}>CONFIRM DELETION</DialogTitle></div>
                        <DialogDescription className="text-[9px] uppercase tracking-widest pl-3.5 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{selectedIds.size} item(s) will be permanently deleted.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="relative z-10 flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <button onClick={() => setConfirmDeleteOpen(false)} className={termBtn} style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>CANCEL</button>
                        <button onClick={confirmDeletion} className={termBtn} style={{ backgroundColor: "#f87171", color: "#000", borderColor: "transparent" }}>DELETE</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
