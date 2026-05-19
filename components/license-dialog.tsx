"use client";

import React, { useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface LicenseDialogProps {
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

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
    "w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none placeholder:opacity-25 transition-colors disabled:opacity-40";
const inputStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.7)",
};

function FieldLabel({ children, readOnly }: { children: React.ReactNode; readOnly?: boolean }) {
    return (
        <label
            className="text-[9px] uppercase tracking-[0.15em] mb-1.5 block"
            style={{ color: readOnly ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.3)" }}
        >
            {children}
        </label>
    );
}

function TermInput({
    id, name, value, onChange, placeholder, type = "text", readOnly, disabled,
}: {
    id: string; name: string; value: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string; type?: string; readOnly?: boolean; disabled?: boolean;
}) {
    return (
        <input
            id={id} name={name} value={value}
            onChange={onChange ?? (() => {})}
            placeholder={placeholder} type={type}
            readOnly={readOnly} disabled={disabled}
            className={inputCls}
            style={{
                ...inputStyle,
                ...(readOnly || disabled ? { color: "rgba(255,255,255,0.3)", cursor: "default" } : {}),
            }}
        />
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LicenseDialog: React.FC<LicenseDialogProps> = ({
    open, setOpen, editingId, form,
    handleInputChange, handleSubmit, handleUpdate, resetForm,
}) => {
    // ── Auto asset age ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!form.purchase_date) {
            if (form.asset_age !== "")
                handleInputChange({ target: { name: "asset_age", value: "" } } as React.ChangeEvent<HTMLInputElement>);
            return;
        }
        const purchaseDate = new Date(form.purchase_date);
        const now = new Date();
        if (purchaseDate > now) {
            if (form.asset_age !== "0y, 0m, 0d")
                handleInputChange({ target: { name: "asset_age", value: "0y, 0m, 0d" } } as React.ChangeEvent<HTMLInputElement>);
            return;
        }
        let years  = now.getFullYear() - purchaseDate.getFullYear();
        let months = now.getMonth()    - purchaseDate.getMonth();
        let days   = now.getDate()     - purchaseDate.getDate();
        if (days < 0)   { months -= 1; days   += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
        if (months < 0) { years  -= 1; months += 12; }
        const val = `${years}y, ${months}m, ${days}d`;
        if (form.asset_age !== val)
            handleInputChange({ target: { name: "asset_age", value: val } } as React.ChangeEvent<HTMLInputElement>);
    }, [form.purchase_date, form.asset_age, handleInputChange]);

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogContent
                className="max-w-3xl border font-mono p-0"
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
                        <DialogTitle
                            className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono"
                            style={{ color: "#fb923c" }}
                        >
                            {editingId ? "EDIT LICENSE" : "ADD NEW LICENSE"}
                        </DialogTitle>
                    </div>
                    <DialogDescription
                        className="text-[9px] uppercase tracking-widest pl-3.5 font-mono"
                        style={{ color: "rgba(255,255,255,0.2)" }}
                    >
                        {editingId
                            ? "Update the fields below to modify this license."
                            : "Fill out the form below to add a new license."}
                    </DialogDescription>
                </DialogHeader>

                {/* Body */}
                <div className="relative z-10 grid grid-cols-2 gap-4 px-6 py-5 max-h-[65vh] overflow-y-auto custom-scrollbar">

                    {/* Software Name */}
                    <div className="flex flex-col">
                        <FieldLabel>Software Name</FieldLabel>
                        <TermInput id="software_name" name="software_name" value={form.software_name || ""} onChange={handleInputChange} placeholder="SOFTWARE NAME" />
                    </div>

                    {/* Software Version */}
                    <div className="flex flex-col">
                        <FieldLabel>Software Version</FieldLabel>
                        <TermInput id="software_version" name="software_version" value={form.software_version || ""} onChange={handleInputChange} placeholder="VERSION" />
                    </div>

                    {/* Total Purchased */}
                    <div className="flex flex-col">
                        <FieldLabel>Total Purchased</FieldLabel>
                        <TermInput id="total_purchased" name="total_purchased" value={form.total_purchased || ""} onChange={handleInputChange} placeholder="0" type="number" />
                    </div>

                    {/* Managed Installation */}
                    <div className="flex flex-col">
                        <FieldLabel>Managed Installation</FieldLabel>
                        <TermInput id="managed_installation" name="managed_installation" value={form.managed_installation || ""} onChange={handleInputChange} placeholder="MANAGED INSTALLS" />
                    </div>

                    {/* Remaining */}
                    <div className="flex flex-col">
                        <FieldLabel>Remaining</FieldLabel>
                        <TermInput id="remaining" name="remaining" value={form.remaining || ""} onChange={handleInputChange} placeholder="0" type="number" />
                    </div>

                    {/* Compliance Status */}
                    <div className="flex flex-col">
                        <FieldLabel>Compliance Status</FieldLabel>
                        <TermInput id="compliance_status" name="compliance_status" value={form.compliance_status || ""} onChange={handleInputChange} placeholder="COMPLIANCE STATUS" />
                    </div>

                    {/* Action */}
                    <div className="flex flex-col">
                        <FieldLabel>Action</FieldLabel>
                        <TermInput id="action" name="action" value={form.action || ""} onChange={handleInputChange} placeholder="ACTION" />
                    </div>

                    {/* Purchase Date */}
                    <div className="flex flex-col">
                        <FieldLabel>Purchase Date</FieldLabel>
                        <TermInput id="purchase_date" name="purchase_date" value={form.purchase_date || ""} onChange={handleInputChange} type="date" />
                    </div>

                    {/* Asset Age (read-only) */}
                    <div className="flex flex-col">
                        <FieldLabel readOnly>Asset Age (auto)</FieldLabel>
                        <TermInput id="asset_age" name="asset_age" value={form.asset_age || ""} placeholder="AUTO-CALCULATED" readOnly />
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
