"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Bell, LogOut, ChevronUp } from "lucide-react";
import { SidebarMenu, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const termBtn =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer disabled:opacity-40";

export function NavUser({
    user,
    userId,
}: {
    user: { name: string; position?: string; email: string; avatar: string };
    userId: string;
}) {
    const { isMobile } = useSidebar();
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [menuOpen,     setMenuOpen]     = useState(false);

    const logLogoutActivity = async () => {
        try {
            const deviceId = localStorage.getItem("deviceId") || "unknown-device";
            await addDoc(collection(db, "activity_logs"), {
                userId, email: user.email, status: "logout",
                timestamp: new Date().toISOString(), deviceId, location: null,
                browser: navigator.userAgent, os: navigator.platform,
                date_created: serverTimestamp(),
            });
        } catch (err) { console.error("Failed to log logout activity:", err); }
    };

    const doLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logLogoutActivity();
            // Expire the session cookie server-side
            await fetch("/api/auth/logout", { method: "POST" });
            localStorage.removeItem("userId");
            router.replace("/auth/login");
        } finally { setIsLoggingOut(false); setIsDialogOpen(false); }
    };

    const initials = user.name
        ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
        : "??";

    return (
        <>
            <SidebarMenu>
                <SidebarMenuItem className="relative">

                    {/* Trigger button */}
                    <button
                        onClick={() => setMenuOpen((p) => !p)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors"
                        style={{
                            backgroundColor: menuOpen ? "rgba(255,255,255,0.04)" : "transparent",
                        }}
                    >
                        {/* Avatar */}
                        <div
                            className="flex items-center justify-center w-7 h-7 shrink-0 border text-[10px] font-bold uppercase font-mono"
                            style={{
                                backgroundColor: "rgba(251,146,60,0.1)",
                                borderColor: "rgba(251,146,60,0.3)",
                                color: "#fb923c",
                            }}
                        >
                            {user.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : initials}
                        </div>

                        {/* Name / position */}
                        <div className="flex flex-col flex-1 min-w-0 text-left">
                            <span
                                className="text-[10px] uppercase tracking-widest font-bold truncate font-mono"
                                style={{ color: "rgba(255,255,255,0.65)" }}
                            >
                                {user.name || "USER"}
                            </span>
                            {user.position && (
                                <span
                                    className="text-[8px] uppercase tracking-widest truncate font-mono"
                                    style={{ color: "rgba(255,255,255,0.25)" }}
                                >
                                    {user.position}
                                </span>
                            )}
                        </div>

                        <ChevronUp
                            className="h-3 w-3 shrink-0 transition-transform duration-150"
                            style={{
                                color: "rgba(255,255,255,0.2)",
                                transform: menuOpen ? "rotate(0deg)" : "rotate(180deg)",
                            }}
                        />
                    </button>

                    {/* Dropdown menu */}
                    {menuOpen && (
                        <div
                            className="absolute bottom-full left-0 right-0 mb-1 border flex flex-col py-1 z-50"
                            style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.08)" }}
                        >
                            {/* User info header */}
                            <div
                                className="flex items-center gap-3 px-3 py-2.5 border-b"
                                style={{ borderColor: "rgba(255,255,255,0.06)" }}
                            >
                                <div
                                    className="flex items-center justify-center w-7 h-7 shrink-0 border text-[10px] font-bold uppercase font-mono"
                                    style={{ backgroundColor: "rgba(251,146,60,0.1)", borderColor: "rgba(251,146,60,0.3)", color: "#fb923c" }}
                                >
                                    {user.avatar ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                    ) : initials}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] uppercase tracking-widest font-bold truncate font-mono" style={{ color: "#fb923c" }}>
                                        {user.name || "USER"}
                                    </span>
                                    <span className="text-[8px] truncate font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                                        {user.email}
                                    </span>
                                </div>
                            </div>

                            {/* Menu items */}
                            <Link
                                href={`/profile?id=${encodeURIComponent(userId)}`}
                                onClick={() => setMenuOpen(false)}
                                className="flex items-center gap-2.5 px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                style={{ color: "rgba(255,255,255,0.5)" }}
                            >
                                <BadgeCheck className="h-3 w-3 shrink-0" />
                                ACCOUNT
                            </Link>

                            <button
                                className="flex items-center gap-2.5 px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors hover:bg-[rgba(255,255,255,0.04)] text-left"
                                style={{ color: "rgba(255,255,255,0.5)" }}
                                onClick={() => setMenuOpen(false)}
                            >
                                <Bell className="h-3 w-3 shrink-0" />
                                NOTIFICATIONS
                            </button>

                            <div className="h-px mx-3 my-1" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

                            <button
                                onClick={() => { setMenuOpen(false); setIsDialogOpen(true); }}
                                disabled={isLoggingOut}
                                className="flex items-center gap-2.5 px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors hover:bg-[rgba(248,113,113,0.06)] text-left disabled:opacity-40"
                                style={{ color: "#f87171" }}
                            >
                                <LogOut className="h-3 w-3 shrink-0" />
                                LOG OUT
                            </button>
                        </div>
                    )}
                </SidebarMenuItem>
            </SidebarMenu>

            {/* ── Confirm Logout Dialog ── */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent
                    className="max-w-sm border font-mono p-0"
                    style={{ backgroundColor: "#0d1117", borderColor: "rgba(248,113,113,0.2)", color: "rgba(255,255,255,0.7)" }}
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
                            <LogOut className="h-3.5 w-3.5" style={{ color: "#f87171" }} />
                            <DialogTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#f87171" }}>
                                CONFIRM LOGOUT
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-[9px] uppercase tracking-widest pl-5 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                            Are you sure you want to log out of Stash?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter
                        className="relative z-10 flex items-center justify-end gap-2 px-6 py-4 border-t"
                        style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                    >
                        <button
                            onClick={() => setIsDialogOpen(false)}
                            disabled={isLoggingOut}
                            className={termBtn}
                            style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={doLogout}
                            disabled={isLoggingOut}
                            className={termBtn}
                            style={{ backgroundColor: "#f87171", color: "#000", borderColor: "transparent" }}
                        >
                            {isLoggingOut ? "LOGGING OUT..." : "LOGOUT"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
