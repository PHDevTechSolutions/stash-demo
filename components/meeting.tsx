"use client";

import React, { useState, useEffect } from "react";
import { MeetingDialog } from "@/components/meeting-dialog";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { db } from "@/lib/firebase";
import {
    collection,
    getDocs,
    query,
    orderBy,
    where,
    Timestamp,
    deleteDoc,
    doc,
} from "firebase/firestore";
import { toast } from "sonner";

interface MeetingItem {
    id: string;
    referenceid: string;
    type_activity: string;
    remarks: string;
    start_date: string;
    end_date: string;
    date_created: Timestamp;
    date_updated: Timestamp;
}

interface MeetingProps {
    referenceid: string;
}

function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const datePart = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${datePart} / ${hours}:${minutes} ${ampm}`;
}

const termBtn =
    "inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer disabled:opacity-40";

export function Meeting({ referenceid }: MeetingProps) {
    const [meetings,   setMeetings]   = useState<MeetingItem[]>([]);
    const [loading,    setLoading]    = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchMeetings() {
            setLoading(true);
            try {
                const q = query(
                    collection(db, "meetings"),
                    where("referenceid", "==", referenceid),
                    orderBy("date_created", "desc")
                );
                const snap = await getDocs(q);
                const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingItem));
                const today = new Date().toISOString().split("T")[0];
                setMeetings(all.filter((m) => m.end_date >= today));
            } catch (err) {
                console.error(err);
                toast.error("Failed to load meetings.");
            }
            setLoading(false);
        }
        fetchMeetings();
    }, [referenceid]);

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this meeting?")) return;
        try {
            await deleteDoc(doc(db, "meetings", id));
            setMeetings((prev) => prev.filter((m) => m.id !== id));
            toast.success("Meeting deleted.");
        } catch {
            toast.error("Failed to delete meeting.");
        }
    };

    const handleCreated = (m: MeetingItem) => {
        const today = new Date().toISOString().split("T")[0];
        if (m.end_date >= today) setMeetings((prev) => [m, ...prev]);
    };

    const displayed = meetings.slice(0, 3);

    return (
        <div className="flex flex-col gap-3">

            {/* Section header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        className="inline-flex w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: "#34d399", boxShadow: "0 0 4px #34d399" }}
                    />
                    <span
                        className="text-[9px] uppercase tracking-[0.2em] font-bold"
                        style={{ color: "#34d399" }}
                    >
                        MEETINGS
                    </span>
                    <span
                        className="text-[9px] font-mono px-1.5 py-0.5 border"
                        style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.25)", backgroundColor: "rgba(52,211,153,0.06)" }}
                    >
                        {meetings.length}
                    </span>
                </div>

                <MeetingDialog referenceid={referenceid} onMeetingCreated={handleCreated}>
                    <button
                        className={termBtn}
                        style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.25)", backgroundColor: "rgba(52,211,153,0.05)" }}
                    >
                        <Plus className="h-2.5 w-2.5" />
                        NEW
                    </button>
                </MeetingDialog>
            </div>

            {/* Divider */}
            <div className="h-px" style={{ backgroundColor: "rgba(52,211,153,0.08)" }} />

            {/* List */}
            {loading ? (
                <div className="flex items-center gap-2" style={{ color: "rgba(52,211,153,0.3)" }}>
                    <div className="w-3 h-3 border-t border-current rounded-full animate-spin" />
                    <span className="text-[9px] uppercase tracking-widest">LOADING...</span>
                </div>
            ) : displayed.length === 0 ? (
                <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(52,211,153,0.25)" }}>
                    NO UPCOMING MEETINGS
                </p>
            ) : (
                <div className="flex flex-col gap-1.5">
                    {displayed.map(({ id, type_activity, remarks, start_date, end_date }) => {
                        const isOpen = expandedId === id;
                        return (
                            <div
                                key={id}
                                className="border"
                                style={{
                                    borderColor: isOpen ? "rgba(52,211,153,0.3)" : "rgba(52,211,153,0.1)",
                                    backgroundColor: isOpen ? "rgba(52,211,153,0.04)" : "transparent",
                                }}
                            >
                                {/* Row header */}
                                <button
                                    onClick={() => setExpandedId(isOpen ? null : id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left"
                                >
                                    <span
                                        className="inline-flex w-1 h-1 rounded-full shrink-0"
                                        style={{ backgroundColor: "#34d399", boxShadow: "0 0 3px #34d399" }}
                                    />
                                    <span
                                        className="flex-1 text-[10px] uppercase tracking-widest truncate"
                                        style={{ color: "#34d399" }}
                                    >
                                        {type_activity}
                                    </span>
                                    {isOpen
                                        ? <ChevronDown className="h-3 w-3 shrink-0" style={{ color: "rgba(52,211,153,0.4)" }} />
                                        : <ChevronRight className="h-3 w-3 shrink-0" style={{ color: "rgba(52,211,153,0.4)" }} />
                                    }
                                </button>

                                {/* Expanded details */}
                                {isOpen && (
                                    <div
                                        className="px-3 pb-3 flex flex-col gap-2 border-t"
                                        style={{ borderColor: "rgba(52,211,153,0.1)" }}
                                    >
                                        <div className="pt-2 flex flex-col gap-1">
                                            <Row label="START" value={formatDateTime(start_date)} />
                                            <Row label="END"   value={formatDateTime(end_date)}   />
                                            {remarks && <Row label="REMARKS" value={remarks} />}
                                        </div>
                                        <div className="flex justify-end pt-1">
                                            <button
                                                onClick={() => handleDelete(id)}
                                                className={termBtn}
                                                style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.25)", backgroundColor: "rgba(248,113,113,0.05)" }}
                                            >
                                                <Trash2 className="h-2.5 w-2.5" />
                                                DELETE
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex gap-2 text-[9px] font-mono">
            <span className="uppercase tracking-widest shrink-0 w-14" style={{ color: "rgba(52,211,153,0.4)" }}>
                {label}
            </span>
            <span style={{ color: "rgba(52,211,153,0.7)" }}>{value}</span>
        </div>
    );
}
