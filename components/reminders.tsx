"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Bell, LogOut, X } from "lucide-react";

interface Meeting {
    id: string;
    title: string;
    start_date: Timestamp | Date | string | number;
}

function formatTime(date: Date) {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
}

function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function toDate(date: Timestamp | Date | string | number): Date {
    if (date && typeof date === "object" && "toDate" in date && typeof (date as any).toDate === "function") return (date as Timestamp).toDate();
    if (date instanceof Date) return date;
    return new Date(date as any);
}

const LOCAL_STORAGE_MEETINGS_KEY = "dismissedMeetings";
const LOCAL_STORAGE_LOGOUT_KEY   = "dismissedLogoutReminders";

function getTodayKey() { return new Date().toISOString().split("T")[0]; }

function getDismissedMeetings(): { [date: string]: string[] } {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(LOCAL_STORAGE_MEETINGS_KEY) || "{}"); } catch { return {}; }
}
function saveDismissedMeetings(data: { [date: string]: string[] }) {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(LOCAL_STORAGE_MEETINGS_KEY, JSON.stringify(data)); } catch {}
}
function getDismissedLogout(): { [date: string]: boolean } {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(LOCAL_STORAGE_LOGOUT_KEY) || "{}"); } catch { return {}; }
}
function saveDismissedLogout(data: { [date: string]: boolean }) {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(LOCAL_STORAGE_LOGOUT_KEY, JSON.stringify(data)); } catch {}
}

export function Reminders() {
    const [now,      setNow]      = useState(new Date());
    const [meetings, setMeetings] = useState<Meeting[]>([]);

    const [showMeetingReminder, setShowMeetingReminder] = useState(false);
    const [currentMeeting,      setCurrentMeeting]      = useState<Meeting | null>(null);
    const [showLogoutReminder,  setShowLogoutReminder]  = useState(false);
    const [dismissedMeetings,   setDismissedMeetings]   = useState<string[]>([]);

    useEffect(() => {
        const d = getDismissedMeetings();
        setDismissedMeetings(d[getTodayKey()] || []);
    }, []);

    useEffect(() => {
        const q = query(collection(db, "meetings"), orderBy("start_date"));
        return onSnapshot(q, (snap) => {
            const loaded: Meeting[] = [];
            snap.forEach((doc) => {
                const d = doc.data();
                if (d.start_date && d.type_activity) loaded.push({ id: doc.id, title: d.type_activity, start_date: d.start_date });
            });
            setMeetings(loaded);
        });
    }, []);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const windowMs = 5 * 60 * 1000;
        let matched: Meeting | null = null;
        for (const m of meetings) {
            if (dismissedMeetings.includes(m.id)) continue;
            const d = toDate(m.start_date);
            if (!isSameDay(now, d)) continue;
            if (Math.abs(now.getTime() - d.getTime()) <= windowMs) { matched = m; break; }
        }
        if (matched) { setCurrentMeeting(matched); setShowMeetingReminder(true); }
        else { setShowMeetingReminder(false); setCurrentMeeting(null); }

        const todayKey = getTodayKey();
        const logoutData = getDismissedLogout();
        if (now.getHours() === 16 && now.getMinutes() === 30 && !logoutData[todayKey] && !showLogoutReminder) {
            setShowLogoutReminder(true);
        }
    }, [now, meetings, dismissedMeetings, showLogoutReminder]);

    function dismissMeeting() {
        if (!currentMeeting) return;
        const todayKey = getTodayKey();
        const data = getDismissedMeetings();
        const set = new Set(data[todayKey] || []);
        set.add(currentMeeting.id);
        data[todayKey] = Array.from(set);
        saveDismissedMeetings(data);
        setDismissedMeetings(data[todayKey]);
        setShowMeetingReminder(false);
        setCurrentMeeting(null);
    }

    function dismissLogout() {
        const todayKey = getTodayKey();
        const data = getDismissedLogout();
        data[todayKey] = true;
        saveDismissedLogout(data);
        setShowLogoutReminder(false);
    }

    return (
        <>
            {/* ── Meeting reminder toast (top-right) ── */}
            {showMeetingReminder && currentMeeting && (
                <div
                    className="fixed top-4 right-4 z-50 border font-mono flex flex-col gap-3 p-4 max-w-xs"
                    style={{ backgroundColor: "#0d1117", borderColor: "rgba(52,211,153,0.3)", boxShadow: "0 0 20px rgba(52,211,153,0.1)" }}
                    role="alert"
                    aria-live="assertive"
                >
                    {/* Dot grid */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
                    />
                    <div className="relative z-10 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bell className="h-3 w-3" style={{ color: "#34d399" }} />
                                <span className="text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: "#34d399" }}>
                                    MEETING REMINDER
                                </span>
                            </div>
                            <button onClick={dismissMeeting} className="transition-opacity hover:opacity-70" style={{ color: "rgba(255,255,255,0.3)" }}>
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                        <div className="h-px" style={{ backgroundColor: "rgba(52,211,153,0.15)" }} />
                        <p className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.6)" }}>
                            <span style={{ color: "#34d399" }}>{currentMeeting.title}</span>
                            {" "}starts at{" "}
                            <span style={{ color: "#34d399" }}>{formatTime(toDate(currentMeeting.start_date))}</span>
                        </p>
                        <button
                            onClick={dismissMeeting}
                            className="self-end inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest border font-mono transition-all duration-150"
                            style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}
                        >
                            DISMISS
                        </button>
                    </div>
                </div>
            )}

            {/* ── Logout reminder dialog ── */}
            <Dialog open={showLogoutReminder} onOpenChange={setShowLogoutReminder}>
                <DialogContent
                    className="max-w-sm border font-mono p-0"
                    style={{ backgroundColor: "#0d1117", borderColor: "rgba(251,146,60,0.2)" }}
                >
                    {/* Dot grid */}
                    <div
                        className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden"
                        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px", zIndex: 0 }}
                    />
                    <DialogHeader
                        className="relative z-10 px-6 py-4 border-b"
                        style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                    >
                        <div className="flex items-center gap-2">
                            <LogOut className="h-3.5 w-3.5" style={{ color: "#fb923c" }} />
                            <DialogTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#fb923c" }}>
                                LOGOUT REMINDER
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-[9px] uppercase tracking-widest pl-5 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                            Don&apos;t forget to logout of Stash.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter
                        className="relative z-10 flex justify-end px-6 py-4 border-t"
                        style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                    >
                        <button
                            onClick={dismissLogout}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150"
                            style={{ backgroundColor: "#fb923c", color: "#000", borderColor: "transparent" }}
                        >
                            DISMISS
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
