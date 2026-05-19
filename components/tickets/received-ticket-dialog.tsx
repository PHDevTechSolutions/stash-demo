"use client";

import React, { useEffect, useRef } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TicketDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    editingId?: string | null;
    form: Record<string, any>;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSelectChange: (name: string, value: string) => void;
    handleSubmit: () => void;
    handleUpdate: () => void;
    resetForm: () => void;
    fullname: string;
    existingTicketIds: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateTicketID(existingTicketIds: string[]): string {
    const prefix = "DSI";
    const now = new Date();
    const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayIds = existingTicketIds.filter((id) => id.startsWith(`${prefix}-${datePart}`));
    let maxSeq = 0;
    for (const id of todayIds) {
        const seq = parseInt(id.split("-")[4], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    return `${prefix}-${datePart}-${String(maxSeq + 1).padStart(3, "0")}`;
}

function toDateTimeLocalString(iso?: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
    "w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none placeholder:opacity-25 transition-colors";
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

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <label className="text-[9px] uppercase tracking-[0.15em] mb-1.5 block" style={{ color: "rgba(255,255,255,0.3)" }}>
            {children}
        </label>
    );
}

function TermInput({ name, value, onChange, placeholder, type = "text" }: {
    name: string; value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string; type?: string;
}) {
    return (
        <input name={name} value={value} onChange={onChange} placeholder={placeholder}
            type={type} className={inputCls} style={inputStyle} />
    );
}

function TermSelect({ name, value, onChange, options, placeholder }: {
    name: string; value: string;
    onChange: (name: string, value: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(name, e.target.value)}
            className="w-full px-2.5 py-1.5 text-[11px] font-mono border"
            style={selectStyle}
        >
            <option value="" style={{ backgroundColor: "#0d1117", color: "rgba(255,255,255,0.3)" }}>
                {placeholder || "— SELECT —"}
            </option>
            {options.map((o) => (
                <option key={o.value} value={o.value} style={{ backgroundColor: "#0d1117", color: "#e2e8f0" }}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ReceivedDialog: React.FC<TicketDialogProps> = ({
    open, setOpen, editingId, form,
    handleInputChange, handleSelectChange,
    handleSubmit, handleUpdate, resetForm,
    fullname, existingTicketIds,
}) => {
    const initializedRef = useRef(false);

    useEffect(() => {
        if (open && !editingId && !initializedRef.current) {
            handleInputChange({ target: { name: "ticket_id",       value: generateTicketID(existingTicketIds) } } as React.ChangeEvent<HTMLInputElement>);
            if (!form.processed_by)    handleInputChange({ target: { name: "processed_by",    value: fullname } } as React.ChangeEvent<HTMLInputElement>);
            if (!form.technician_name) handleInputChange({ target: { name: "technician_name", value: fullname } } as React.ChangeEvent<HTMLInputElement>);
            if (!form.requestor_name)  handleInputChange({ target: { name: "requestor_name",  value: fullname } } as React.ChangeEvent<HTMLInputElement>);
            if (!form.closed_by)       handleInputChange({ target: { name: "closed_by",       value: fullname } } as React.ChangeEvent<HTMLInputElement>);
            initializedRef.current = true;
        }
        if (!open) initializedRef.current = false;
    }, [open, editingId, existingTicketIds, fullname, handleInputChange, form.processed_by]);

    const onDateCreatedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleInputChange({ target: { name: "date_created", value: new Date(e.target.value).toISOString() } } as React.ChangeEvent<HTMLInputElement>);
    };

    return (
        <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <SheetContent
                side="right"
                className="w-[420px] sm:w-[520px] p-0 border-l font-mono flex flex-col"
                style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.07)" }}
            >
                {/* Dot grid */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px", zIndex: 0 }}
                />

                {/* Header */}
                <SheetHeader
                    className="relative z-10 px-5 py-3.5 border-b flex-row items-center justify-between"
                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                >
                    <div className="flex items-center gap-2">
                        <span className="inline-flex w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#fb923c", boxShadow: "0 0 5px #fb923c" }} />
                        <SheetTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#fb923c" }}>
                            {editingId ? "EDIT TICKET" : "NEW TICKET"}
                        </SheetTitle>
                    </div>
                    <button onClick={() => { setOpen(false); resetForm(); }} className="transition-opacity hover:opacity-70" style={{ color: "rgba(255,255,255,0.3)" }}>
                        <X className="h-3.5 w-3.5" />
                    </button>
                    <SheetDescription className="sr-only">
                        {editingId ? "Update ticket details." : "Fill out the form to create a new ticket."}
                    </SheetDescription>
                </SheetHeader>

                {/* Body */}
                <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 custom-scrollbar">

                    {/* Ticket info banner */}
                    <div className="border px-4 py-3 flex flex-col gap-1.5" style={{ borderColor: "rgba(251,146,60,0.2)", backgroundColor: "rgba(251,146,60,0.04)" }}>
                        <InfoRow label="TICKET ID"     value={form.ticket_id      || "—"} />
                        <InfoRow label="PROCESSED BY"  value={form.processed_by   || "—"} />
                        <InfoRow label="TECHNICIAN"    value={form.technician_name || "—"} />
                        {form.status === "Resolved" && <InfoRow label="CLOSED BY" value={form.closed_by || "—"} />}
                    </div>

                    {/* Requestor Name */}
                    <div className="flex flex-col">
                        <FieldLabel>Full Name</FieldLabel>
                        <TermInput name="requestor_name" value={form.requestor_name || ""} onChange={handleInputChange} placeholder="REQUESTER'S FULL NAME" />
                    </div>

                    {/* Ticket Subject */}
                    <div className="flex flex-col">
                        <FieldLabel>Ticket Subject</FieldLabel>
                        <TermInput name="ticket_subject" value={form.ticket_subject || ""} onChange={handleInputChange} placeholder="TICKET SUBJECT" />
                    </div>

                    {/* Department */}
                    <div className="flex flex-col">
                        <FieldLabel>Department</FieldLabel>
                        <TermSelect name="department" value={form.department || ""} onChange={handleSelectChange} placeholder="SELECT DEPARTMENT"
                            options={["Admin","Accounting","Business Development","Customer Service Representative","Engineering","E-Commerce","Human Resources","Information Technology","Marketing","Procurement","Sales","Warehouse Operations"].map((v) => ({ value: v, label: v }))}
                        />
                    </div>

                    {/* Request Type */}
                    <div className="flex flex-col">
                        <FieldLabel>Request Type</FieldLabel>
                        <TermSelect name="request_type" value={form.request_type || ""} onChange={handleSelectChange} placeholder="SELECT TYPE"
                            options={["Advisory","Incident","Maintenance","Major Incident","Incident / Service Request","Request","Service Request","Service Request / Incident"].map((v) => ({ value: v, label: v }))}
                        />
                    </div>

                    {/* Type of Concern */}
                    <div className="flex flex-col">
                        <FieldLabel>Type of Concern</FieldLabel>
                        <TermSelect name="type_concern" value={form.type_concern || ""} onChange={handleSelectChange} placeholder="SELECT CONCERN"
                            options={[{ value: "Incident", label: "Incident" }, { value: "Request", label: "Request" }]}
                        />
                    </div>

                    {/* Mode */}
                    <div className="flex flex-col">
                        <FieldLabel>Mode</FieldLabel>
                        <TermSelect name="mode" value={form.mode || ""} onChange={handleSelectChange} placeholder="SELECT MODE"
                            options={["Chat","Email","Phone Call","System Directory","Walk In","Web Form"].map((v) => ({ value: v, label: v }))}
                        />
                    </div>

                    {/* Services Group */}
                    <div className="flex flex-col">
                        <FieldLabel>Services Group</FieldLabel>
                        <TermSelect name="group_services" value={form.group_services || ""} onChange={handleSelectChange} placeholder="SELECT GROUP"
                            options={[{ value: "Service Desk", label: "Service Desk" }, { value: "System and Website Services", label: "System and Website Services" }]}
                        />
                    </div>

                    {/* Site */}
                    <div className="flex flex-col">
                        <FieldLabel>Site</FieldLabel>
                        <TermSelect name="site" value={form.site || ""} onChange={handleSelectChange} placeholder="SELECT SITE"
                            options={["Disruptive - Primex","Disruptive - J&L","Buildchem - Carmona","Disruptive - Pasig","Disruptive - CDO","Disruptive - Cebu","Disruptive - Davao"].map((v) => ({ value: v, label: v }))}
                        />
                    </div>

                    {/* Priority */}
                    <div className="flex flex-col">
                        <FieldLabel>Priority</FieldLabel>
                        <TermSelect name="priority" value={form.priority || ""} onChange={handleSelectChange} placeholder="SELECT PRIORITY"
                            options={[
                                { value: "Critical", label: "P-1 — Critical (15 min response / 4 hr resolve)" },
                                { value: "High",     label: "P-2 — High (1 hr response / 8 hr resolve)"      },
                                { value: "Medium",   label: "P-3 — Medium (4 hr response / 1-2 day resolve)" },
                                { value: "Low",      label: "P-4 — Low (8 hr response / 3-4 day resolve)"    },
                            ]}
                        />
                    </div>

                    {/* Status */}
                    <div className="flex flex-col">
                        <FieldLabel>Status</FieldLabel>
                        <TermSelect name="status" value={form.status || ""} onChange={handleSelectChange} placeholder="SELECT STATUS"
                            options={["Pending","Scheduled","Ongoing","Resolved"].map((v) => ({ value: v, label: v }))}
                        />
                    </div>

                    {/* Remarks */}
                    <div className="flex flex-col">
                        <FieldLabel>Remarks</FieldLabel>
                        <textarea
                            name="remarks"
                            value={form.remarks || ""}
                            onChange={(e) => handleSelectChange("remarks", e.target.value)}
                            rows={4}
                            placeholder="ADDITIONAL NOTES..."
                            className="w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none resize-none placeholder:opacity-25"
                            style={inputStyle}
                        />
                    </div>

                    {/* Date Scheduled */}
                    {form.status === "Scheduled" && (
                        <div className="flex flex-col">
                            <FieldLabel>Date Scheduled</FieldLabel>
                            <TermInput name="date_scheduled" value={form.date_scheduled || ""} onChange={handleInputChange} type="date" />
                        </div>
                    )}

                    {/* Date Created */}
                    {form.status !== "Scheduled" && (
                        <div className="flex flex-col">
                            <FieldLabel>Date Created</FieldLabel>
                            <input
                                type="datetime-local"
                                name="date_created"
                                value={toDateTimeLocalString(form.date_created)}
                                onChange={onDateCreatedChange}
                                className={inputCls}
                                style={inputStyle}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <SheetFooter
                    className="relative z-10 flex items-center justify-end gap-2 px-5 py-3.5 border-t"
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
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
};

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-2 text-[9px] font-mono">
            <span className="uppercase tracking-widest w-24 shrink-0" style={{ color: "rgba(251,146,60,0.5)" }}>{label}</span>
            <span style={{ color: "#fb923c" }}>{value}</span>
        </div>
    );
}
