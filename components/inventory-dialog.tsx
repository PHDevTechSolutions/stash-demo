"use client";

import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface InventoryDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    editingId?: string | null;
    form: Record<string, any>;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSelectChange: (name: string, value: string) => void;
    handleSetAssetTag: (value: string) => void;
    handleSubmit: () => void;
    handleUpdate: () => void;
    resetForm: () => void;
}

// ─── Options ──────────────────────────────────────────────────────────────────

const assetTypeOptions  = ["LAPTOP", "MONITOR", "DESKTOP"];
const statusOptions     = ["SPARE", "DEPLOYED", "LEND", "MISSING", "DEFECTIVE", "DISPOSE"];
const locationOptions   = ["J&L", "PRIMEX", "PASIG WH", "CDO", "CEBU", "DAVAO", "BUILDCHEM", "DISRUPTIVE"];
const departmentOptions = [
    "HUMAN RESOURCES", "INFORMATION TECHNOLOGY", "MARKETING", "SALES",
    "ACCOUNTING", "PROCUREMENT", "ADMIN", "WAREHOUSE OPERATIONS",
    "ENGINEERING", "CUSTOMER SERVICE", "ECOMMERCE", "PRODUCT DEVELOPMENT",
];

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls = "w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none placeholder:opacity-25 transition-colors disabled:opacity-40";
const inputStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.7)",
};
const selectStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.65)",
    outline: "none",
    appearance: "none" as const,
};
const labelCls = "text-[9px] uppercase tracking-[0.15em] mb-1.5 block";
const labelStyle: React.CSSProperties = { color: "rgba(255,255,255,0.3)" };

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
    return (
        <label className={labelCls} style={labelStyle}>
            {children}
            {required && <span style={{ color: "#f87171" }}> *</span>}
        </label>
    );
}

function TermInput({ id, name, value, onChange, placeholder, type = "text", disabled }: {
    id: string; name: string; value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string; type?: string; disabled?: boolean;
}) {
    return (
        <input
            id={id} name={name} value={value} onChange={onChange}
            placeholder={placeholder} type={type} disabled={disabled}
            className={inputCls} style={inputStyle}
        />
    );
}

function TermSelect({ id, value, onChange, options, placeholder }: {
    id: string; value: string;
    onChange: (v: string) => void;
    options: string[]; placeholder?: string;
}) {
    return (
        <select
            id={id} value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-[11px] font-mono border"
            style={selectStyle}
        >
            <option value="" style={{ backgroundColor: "#0d1117", color: "rgba(255,255,255,0.3)" }}>
                {placeholder || "— SELECT —"}
            </option>
            {options.map((o) => (
                <option key={o} value={o} style={{ backgroundColor: "#0d1117", color: "#e2e8f0" }}>
                    {o}
                </option>
            ))}
        </select>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const InventoryDialog: React.FC<InventoryDialogProps> = ({
    open, setOpen, editingId, form,
    handleInputChange, handleSelectChange, handleSetAssetTag,
    handleSubmit, handleUpdate, resetForm,
}) => {
    const [isLoadingAssetTag, setIsLoadingAssetTag] = useState(false);

    // ── Auto asset tag ────────────────────────────────────────────────────────
    useEffect(() => {
        async function fetchNextAssetTag() {
            if (!form.asset_type) return;
            setIsLoadingAssetTag(true);
            handleSetAssetTag("");
            try {
                const res = await fetch(`/api/get-next-asset-tag?asset_type=${encodeURIComponent(form.asset_type)}`);
                if (!res.ok) throw new Error("Failed to fetch asset tag");
                const data = await res.json();
                if (data.asset_tag) handleSetAssetTag(data.asset_tag);
            } catch (e) { console.error(e); }
            finally { setIsLoadingAssetTag(false); }
        }
        fetchNextAssetTag();
    }, [form.asset_type]);

    // ── Auto asset age ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!form.purchase_date) {
            if (form.asset_age !== "") handleInputChange({ target: { name: "asset_age", value: "" } } as React.ChangeEvent<HTMLInputElement>);
            return;
        }
        const purchaseDate = new Date(form.purchase_date);
        const now = new Date();
        if (purchaseDate > now) {
            if (form.asset_age !== "0y, 0m, 0d") handleInputChange({ target: { name: "asset_age", value: "0y, 0m, 0d" } } as React.ChangeEvent<HTMLInputElement>);
            return;
        }
        let years = now.getFullYear() - purchaseDate.getFullYear();
        let months = now.getMonth() - purchaseDate.getMonth();
        let days = now.getDate() - purchaseDate.getDate();
        if (days < 0) { months -= 1; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
        if (months < 0) { years -= 1; months += 12; }
        const val = `${years}y, ${months}m, ${days}d`;
        if (form.asset_age !== val) handleInputChange({ target: { name: "asset_age", value: val } } as React.ChangeEvent<HTMLInputElement>);
    }, [form.purchase_date, form.asset_age, handleInputChange]);

    // ── Auto warranty date ────────────────────────────────────────────────────
    useEffect(() => {
        if (!form.purchase_date) {
            if (form.warranty_date !== "") handleInputChange({ target: { name: "warranty_date", value: "" } } as React.ChangeEvent<HTMLInputElement>);
            return;
        }
        const d = new Date(form.purchase_date);
        const formatted = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()).toISOString().split("T")[0];
        if (form.warranty_date !== formatted) handleInputChange({ target: { name: "warranty_date", value: formatted } } as React.ChangeEvent<HTMLInputElement>);
    }, [form.purchase_date, form.warranty_date, handleInputChange]);

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogContent
                className="max-w-4xl border font-mono p-0"
                style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.08)" }}
            >
                {/* Dot grid */}
                <div
                    className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden"
                    style={{
                        backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                        zIndex: 0,
                    }}
                />

                {/* Header */}
                <DialogHeader
                    className="relative z-10 px-6 py-4 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                >
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-flex w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: "#fb923c", boxShadow: "0 0 5px #fb923c" }}
                        />
                        <DialogTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#fb923c" }}>
                            {editingId ? "EDIT INVENTORY ITEM" : "ADD NEW INVENTORY ITEM"}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-[9px] uppercase tracking-widest pl-3.5 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {editingId ? "Update the fields below to modify this item." : "Fill out the form below to add a new inventory item."}
                    </DialogDescription>
                </DialogHeader>

                {/* Body */}
                <div className="relative z-10 grid grid-cols-2 gap-4 px-6 py-5 max-h-[65vh] overflow-y-auto custom-scrollbar">

                    {/* Add-only fields */}
                    {!editingId && (
                        <>
                            <div className="flex flex-col">
                                <FieldLabel required>Asset Tag</FieldLabel>
                                <TermInput
                                    id="asset_tag" name="asset_tag"
                                    value={isLoadingAssetTag ? "GENERATING..." : form.asset_tag || ""}
                                    onChange={handleInputChange}
                                    placeholder="ASSET TAG"
                                    disabled
                                />
                            </div>
                            <div className="flex flex-col">
                                <FieldLabel>Asset Type</FieldLabel>
                                <TermSelect
                                    id="asset_type"
                                    value={form.asset_type || ""}
                                    onChange={(v) => handleSelectChange("asset_type", v)}
                                    options={assetTypeOptions}
                                    placeholder="SELECT TYPE"
                                />
                            </div>
                        </>
                    )}

                    {/* Status */}
                    <div className="flex flex-col">
                        <FieldLabel required>Status</FieldLabel>
                        <TermSelect
                            id="status"
                            value={form.status || ""}
                            onChange={(v) => handleSelectChange("status", v)}
                            options={statusOptions}
                            placeholder="SELECT STATUS"
                        />
                    </div>

                    {/* Location */}
                    <div className="flex flex-col">
                        <FieldLabel>Location</FieldLabel>
                        <TermSelect
                            id="location"
                            value={form.location || ""}
                            onChange={(v) => handleSelectChange("location", v)}
                            options={locationOptions}
                            placeholder="SELECT LOCATION"
                        />
                    </div>

                    {/* New User */}
                    <div className="flex flex-col">
                        <FieldLabel>New User</FieldLabel>
                        <TermInput id="new_user" name="new_user" value={form.new_user || ""} onChange={handleInputChange} placeholder="NEW USER" />
                    </div>

                    {/* Old User */}
                    <div className="flex flex-col">
                        <FieldLabel>Old User</FieldLabel>
                        <TermInput id="old_user" name="old_user" value={form.old_user || ""} onChange={handleInputChange} placeholder="OLD USER" />
                    </div>

                    {/* Department */}
                    <div className="flex flex-col">
                        <FieldLabel>Department</FieldLabel>
                        <TermSelect
                            id="department"
                            value={form.department || ""}
                            onChange={(v) => handleSelectChange("department", v)}
                            options={departmentOptions}
                            placeholder="SELECT DEPT"
                        />
                    </div>

                    {/* Position */}
                    <div className="flex flex-col">
                        <FieldLabel>Position</FieldLabel>
                        <TermInput id="position" name="position" value={form.position || ""} onChange={handleInputChange} placeholder="POSITION" />
                    </div>

                    {/* Brand */}
                    <div className="flex flex-col">
                        <FieldLabel>Brand</FieldLabel>
                        <TermInput id="brand" name="brand" value={form.brand || ""} onChange={handleInputChange} placeholder="BRAND" />
                    </div>

                    {/* Model */}
                    <div className="flex flex-col">
                        <FieldLabel>Model</FieldLabel>
                        <TermInput id="model" name="model" value={form.model || ""} onChange={handleInputChange} placeholder="MODEL" />
                    </div>

                    {/* Processor */}
                    <div className="flex flex-col">
                        <FieldLabel>Processor</FieldLabel>
                        <TermInput id="processor" name="processor" value={form.processor || ""} onChange={handleInputChange} placeholder="PROCESSOR" />
                    </div>

                    {/* RAM */}
                    <div className="flex flex-col">
                        <FieldLabel>RAM</FieldLabel>
                        <TermInput id="ram" name="ram" value={form.ram || ""} onChange={handleInputChange} placeholder="RAM" />
                    </div>

                    {/* Storage */}
                    <div className="flex flex-col">
                        <FieldLabel>Storage</FieldLabel>
                        <TermInput id="storage" name="storage" value={form.storage || ""} onChange={handleInputChange} placeholder="STORAGE" />
                    </div>

                    {/* Serial Number */}
                    <div className="flex flex-col">
                        <FieldLabel>Serial Number</FieldLabel>
                        <TermInput id="serial_number" name="serial_number" value={form.serial_number || ""} onChange={handleInputChange} placeholder="SERIAL NUMBER" />
                    </div>

                    {/* Purchase Date */}
                    <div className="flex flex-col">
                        <FieldLabel>Purchase Date</FieldLabel>
                        <TermInput id="purchase_date" name="purchase_date" value={form.purchase_date || ""} onChange={handleInputChange} placeholder="PURCHASE DATE" type="date" />
                    </div>

                    {/* Asset Age */}
                    <div className="flex flex-col">
                        <FieldLabel>Asset Age</FieldLabel>
                        <TermInput id="asset_age" name="asset_age" value={form.asset_age || ""} onChange={handleInputChange} placeholder="AUTO-CALCULATED" disabled />
                    </div>

                    {/* Hidden warranty date */}
                    <input type="hidden" name="warranty_date" value={form.warranty_date || ""} onChange={handleInputChange as any} />

                    {/* Amount + MAC Address */}
                    <div className="flex flex-col">
                        <FieldLabel>Amount</FieldLabel>
                        <TermInput id="amount" name="amount" value={form.amount || ""} onChange={handleInputChange} placeholder="AMOUNT" type="number" />
                    </div>

                    <div className="flex flex-col">
                        <FieldLabel>MAC Address</FieldLabel>
                        <TermInput id="mac_address" name="mac_address" value={form.mac_address || ""} onChange={handleInputChange} placeholder="MAC ADDRESS" />
                    </div>

                    {/* Remarks */}
                    <div className="col-span-2 flex flex-col">
                        <FieldLabel>Remarks</FieldLabel>
                        <textarea
                            id="remarks" name="remarks"
                            value={form.remarks || ""}
                            onChange={(e) => handleInputChange(e as any)}
                            placeholder="ADDITIONAL NOTES..."
                            rows={4}
                            className="w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none resize-none placeholder:opacity-25"
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter
                    className="relative z-10 flex items-center justify-end gap-2 px-6 py-4 border-t"
                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                >
                    <button
                        onClick={() => { setOpen(false); resetForm(); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer"
                        style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={editingId ? handleUpdate : handleSubmit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer"
                        style={{ backgroundColor: "#fb923c", color: "#000", borderColor: "transparent" }}
                    >
                        {editingId ? "UPDATE →" : "CREATE →"}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
