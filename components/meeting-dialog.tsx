"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { toast } from "sonner";

interface MeetingDialogProps {
    referenceid: string;
    onMeetingCreated?: (meeting: any) => void;
    children: React.ReactNode;
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
        <label
            className="text-[9px] uppercase tracking-[0.15em] mb-1.5 block"
            style={{ color: "rgba(255,255,255,0.3)" }}
        >
            {children}
        </label>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MeetingDialog({ referenceid, onMeetingCreated, children }: MeetingDialogProps) {
    const [open,         setOpen]         = useState(false);
    const [typeActivity, setTypeActivity] = useState("Group Meeting");
    const [remarks,      setRemarks]      = useState("");
    const [startDate,    setStartDate]    = useState("");
    const [endDate,      setEndDate]      = useState("");
    const [submitting,   setSubmitting]   = useState(false);

    useEffect(() => {
        if (open) {
            setTypeActivity("Group Meeting");
            setRemarks("");
            setStartDate("");
            setEndDate("");
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!referenceid || !startDate || !endDate) {
            toast.error("Please fill in all required fields.");
            return;
        }
        setSubmitting(true);
        try {
            const now = Timestamp.fromDate(new Date());
            const newMeeting = {
                referenceid,
                type_activity: typeActivity,
                remarks: remarks || "No remarks",
                start_date: startDate,
                end_date:   endDate,
                date_created: now,
                date_updated: now,
            };
            const docRef = await addDoc(collection(db, "meetings"), newMeeting);
            toast.success("Meeting created successfully.");
            onMeetingCreated?.({ id: docRef.id, ...newMeeting });
            setOpen(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to save meeting.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>

            <DialogContent
                className="max-w-lg border font-mono p-0"
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
                            style={{ backgroundColor: "#34d399", boxShadow: "0 0 5px #34d399" }}
                        />
                        <DialogTitle
                            className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono"
                            style={{ color: "#34d399" }}
                        >
                            CREATE MEETING
                        </DialogTitle>
                    </div>
                    <DialogDescription
                        className="text-[9px] uppercase tracking-widest pl-3.5 font-mono"
                        style={{ color: "rgba(255,255,255,0.2)" }}
                    >
                        Fill in the details below to schedule a new meeting.
                    </DialogDescription>
                </DialogHeader>

                {/* Body */}
                <form onSubmit={handleSubmit}>
                    <div className="relative z-10 flex flex-col gap-4 px-6 py-5">

                        {/* Type of Activity */}
                        <div className="flex flex-col">
                            <FieldLabel>Type of Activity</FieldLabel>
                            <select
                                value={typeActivity}
                                onChange={(e) => setTypeActivity(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-[11px] font-mono border"
                                style={selectStyle}
                            >
                                <option value="Group Meeting" style={{ backgroundColor: "#0d1117" }}>Group Meeting</option>
                                <option value="Trainings"     style={{ backgroundColor: "#0d1117" }}>Trainings</option>
                            </select>
                        </div>

                        {/* Remarks */}
                        <div className="flex flex-col">
                            <FieldLabel>Remarks</FieldLabel>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="ADD REMARKS..."
                                rows={3}
                                className="w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none resize-none placeholder:opacity-25"
                                style={inputStyle}
                            />
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col">
                                <FieldLabel>Start Date <span style={{ color: "#f87171" }}>*</span></FieldLabel>
                                <input
                                    type="datetime-local"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    required
                                    className={inputCls}
                                    style={inputStyle}
                                />
                            </div>
                            <div className="flex flex-col">
                                <FieldLabel>End Date <span style={{ color: "#f87171" }}>*</span></FieldLabel>
                                <input
                                    type="datetime-local"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    required
                                    className={inputCls}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <DialogFooter
                        className="relative z-10 flex items-center justify-end gap-2 px-6 py-4 border-t"
                        style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                    >
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer"
                            style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: "#34d399", color: "#000", borderColor: "transparent" }}
                        >
                            {submitting ? "SAVING..." : "CREATE →"}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
