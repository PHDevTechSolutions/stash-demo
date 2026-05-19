"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from "@/components/ui/dialog";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { X, Ticket } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestItem {
    id: string;
    ticket_id: string;
    requestor_name: string;
    ticket_subject: string;
    department: string;
    request_type: string;
    type_concern: string;
    mode: string;
    group_services: string;
    technician_name: string;
    site: string;
    priority: string;
    status: string;
    date_scheduled: string;
    remarks: string;
    processed_by: string;
    closed_by: string;
    date_created?: string;
    date_closed?: string;
}

const STORAGE_KEY = "stash_popup_ticket_hash";

function hashTickets(tickets: RequestItem[]) {
    return tickets.map((t) => t.id).sort().join(",");
}

const priorityColor: Record<string, string> = {
    Critical: "#f87171",
    High:     "#fb923c",
    Medium:   "#fbbf24",
    Low:      "#34d399",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PopUp() {
    const [activities, setActivities] = useState<RequestItem[]>([]);
    const [loading,    setLoading]    = useState(false);
    const [error,      setError]      = useState<string | null>(null);
    const [open,       setOpen]       = useState(false);

    const soundPlayedRef = useRef(false);
    const audioRef       = useRef<HTMLAudioElement | null>(null);

    useEffect(() => { audioRef.current = new Audio("/ticket-endorsed.mp3"); }, []);

    const fetchActivities = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const { data, error } = await supabase
                .from("tickets")
                .select("*")
                .gte("date_created", todayStart.toISOString())
                .in("request_type", ["Maintenance", "Dispose"])
                .order("date_created", { ascending: false });
            if (error) throw error;
            setActivities(data ?? []);
            const storedHash  = localStorage.getItem(STORAGE_KEY) || "";
            const currentHash = hashTickets(data ?? []);
            if ((data?.length ?? 0) > 0 && storedHash !== currentHash) {
                setOpen(true);
                soundPlayedRef.current = false;
            } else {
                setOpen(false);
            }
        } catch (err: any) {
            setError(err.message || "Error fetching tickets");
            toast.error(err.message || "Error fetching tickets");
            setOpen(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchActivities(); }, [fetchActivities]);

    useEffect(() => {
        if (open && !soundPlayedRef.current && audioRef.current) {
            const audio = audioRef.current;
            const play = () => { audio.play().catch(() => {}); soundPlayedRef.current = true; };
            if (audio.readyState >= 4) { play(); }
            else { audio.oncanplaythrough = () => { play(); audio.oncanplaythrough = null; }; }
        }
    }, [open]);

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) localStorage.setItem(STORAGE_KEY, hashTickets(activities));
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="max-w-lg border font-mono p-0"
                style={{ backgroundColor: "#0d1117", borderColor: "rgba(251,146,60,0.2)" }}
            >
                {/* Dot grid */}
                <div
                    className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden"
                    style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px", zIndex: 0 }}
                />

                {/* Header */}
                <DialogHeader
                    className="relative z-10 px-6 py-4 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Ticket className="h-3.5 w-3.5" style={{ color: "#fb923c" }} />
                            <DialogTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#fb923c" }}>
                                TICKETS — MAINTENANCE / DISPOSE
                            </DialogTitle>
                        </div>
                        <DialogClose asChild>
                            <button className="transition-opacity hover:opacity-70" style={{ color: "rgba(255,255,255,0.3)" }}>
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </DialogClose>
                    </div>
                    <DialogDescription className="text-[9px] uppercase tracking-widest pl-5 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {error ? error : `${activities.length} ticket${activities.length !== 1 ? "s" : ""} created today`}
                    </DialogDescription>
                </DialogHeader>

                {/* Body */}
                <div className="relative z-10 flex flex-col gap-2 px-6 py-4 max-h-[55vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center gap-2 py-6" style={{ color: "rgba(255,255,255,0.25)" }}>
                            <div className="w-3.5 h-3.5 border-t border-current rounded-full animate-spin" />
                            <span className="text-[9px] uppercase tracking-widest">LOADING...</span>
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>NO TICKETS FOUND</span>
                        </div>
                    ) : (
                        activities.map((ticket, idx) => {
                            const pColor = priorityColor[ticket.priority] ?? "rgba(255,255,255,0.4)";
                            return (
                                <div
                                    key={ticket.id}
                                    className="border px-4 py-3 flex flex-col gap-1.5"
                                    style={{
                                        borderColor: "rgba(255,255,255,0.07)",
                                        backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                                    }}
                                >
                                    {/* Subject + priority */}
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.75)" }}>
                                            {ticket.ticket_subject || "—"}
                                        </span>
                                        {ticket.priority && (
                                            <span
                                                className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 border shrink-0 font-mono"
                                                style={{ color: pColor, borderColor: `${pColor}40`, backgroundColor: `${pColor}10` }}
                                            >
                                                {ticket.priority}
                                            </span>
                                        )}
                                    </div>

                                    {/* Meta rows */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                        <MetaRow label="TICKET ID"   value={ticket.ticket_id}      />
                                        <MetaRow label="REQUESTOR"   value={ticket.requestor_name} />
                                        <MetaRow label="TYPE"        value={ticket.request_type}   />
                                        <MetaRow label="DATE"        value={ticket.date_created ? new Date(ticket.date_created).toLocaleString() : "—"} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div
                    className="relative z-10 flex justify-end px-6 py-3.5 border-t"
                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                >
                    <DialogClose asChild>
                        <button
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer"
                            style={{ backgroundColor: "#fb923c", color: "#000", borderColor: "transparent" }}
                        >
                            CLOSE
                        </button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-1.5 text-[9px] font-mono">
            <span className="uppercase tracking-widest shrink-0" style={{ color: "rgba(255,255,255,0.25)" }}>{label}</span>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>{value || "—"}</span>
        </div>
    );
}
