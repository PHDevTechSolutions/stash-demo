"use client";

import * as React from "react";
import { DatePicker } from "@/components/date-picker";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { useFormat } from "@/contexts/FormatContext";
import { type DateRange } from "react-day-picker";
import { Meeting } from "@/components/meeting";

type SidebarRightProps = React.ComponentProps<typeof Sidebar> & {
    userId?: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
};

export function SidebarRight({
    userId,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
    ...props
}: SidebarRightProps) {
    const { timeFormat, dateFormat } = useFormat();
    const [time, setTime] = React.useState("");
    const [date, setDate] = React.useState("");
    const [userDetails, setUserDetails] = React.useState({
        ReferenceID:    "",
        Firstname:      "",
        Lastname:       "",
        Position:       "",
        Email:          "",
        profilePicture: "",
    });

    // ── Clock ─────────────────────────────────────────────────────────────────
    React.useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const formattedTime = now.toLocaleTimeString("en-US", {
                hour:   "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: timeFormat === "12h",
            });
            let formattedDate = "";
            if (dateFormat === "short") {
                formattedDate = now.toLocaleDateString("en-US");
            } else if (dateFormat === "iso") {
                formattedDate = now.toISOString().split("T")[0];
            } else {
                formattedDate = now.toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric", year: "numeric",
                });
            }
            setTime(formattedTime);
            setDate(formattedDate);
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [timeFormat, dateFormat]);

    // ── User fetch ────────────────────────────────────────────────────────────
    React.useEffect(() => {
        if (!userId) return;
        fetch(`/api/user?id=${encodeURIComponent(userId)}`)
            .then((r) => r.json())
            .then((d) => setUserDetails({
                ReferenceID:    d.ReferenceID    || "",
                Firstname:      d.Firstname      || "",
                Lastname:       d.Lastname       || "",
                Position:       d.Position       || "",
                Email:          d.Email          || "",
                profilePicture: d.profilePicture || "",
            }))
            .catch((err) => console.error(err));
    }, [userId]);

    return (
        <Sidebar
            collapsible="none"
            className="sticky top-0 hidden h-svh lg:flex border-l-0 font-mono"
            style={
                {
                    "--sidebar-background": "#0a0f0a",
                    "--sidebar-foreground": "rgba(52,211,153,0.7)",
                    "--sidebar-border":     "rgba(52,211,153,0.1)",
                } as React.CSSProperties
            }
            {...props}
        >
            {/* Dot grid */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(rgba(52,211,153,0.04) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                    zIndex: 0,
                }}
            />

            {/* ── Header: user info ── */}
            <SidebarHeader
                className="relative z-10 border-b px-4 py-3"
                style={{ borderColor: "rgba(52,211,153,0.1)", backgroundColor: "#0a0f0a" }}
            >
                {userDetails.Firstname ? (
                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div
                            className="flex items-center justify-center w-7 h-7 shrink-0 border text-[10px] font-bold uppercase"
                            style={{
                                backgroundColor: "rgba(52,211,153,0.08)",
                                borderColor:     "rgba(52,211,153,0.25)",
                                color:           "#34d399",
                            }}
                        >
                            {userDetails.Firstname.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span
                                className="text-[10px] uppercase tracking-widest truncate font-bold"
                                style={{ color: "#34d399" }}
                            >
                                {userDetails.Firstname} {userDetails.Lastname}
                            </span>
                            {userDetails.Position && (
                                <span
                                    className="text-[9px] uppercase tracking-widest truncate"
                                    style={{ color: "rgba(52,211,153,0.4)" }}
                                >
                                    {userDetails.Position}
                                </span>
                            )}
                        </div>
                        {/* Online dot */}
                        <span
                            className="ml-auto inline-flex w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: "#34d399", boxShadow: "0 0 5px #34d399" }}
                        />
                    </div>
                ) : (
                    <div className="flex items-center gap-2" style={{ color: "rgba(52,211,153,0.3)" }}>
                        <div className="w-3 h-3 border-t border-current rounded-full animate-spin" />
                        <span className="text-[9px] uppercase tracking-widest">LOADING...</span>
                    </div>
                )}
            </SidebarHeader>

            {/* ── Content ── */}
            <SidebarContent
                className="relative z-10 overflow-y-auto custom-scrollbar"
                style={{ backgroundColor: "#0a0f0a" }}
            >
                {/* Calendar section */}
                <div
                    className="border-b"
                    style={{ borderColor: "rgba(52,211,153,0.08)" }}
                >
                    <div
                        className="flex items-center gap-2 px-4 py-2"
                        style={{ borderBottom: "1px solid rgba(52,211,153,0.06)" }}
                    >
                        <span
                            className="inline-flex w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: "#34d399", boxShadow: "0 0 4px #34d399" }}
                        />
                        <span
                            className="text-[9px] uppercase tracking-[0.2em] font-bold"
                            style={{ color: "#34d399" }}
                        >
                            CALENDAR
                        </span>
                        {dateCreatedFilterRange?.from && (
                            <button
                                onClick={() => setDateCreatedFilterRangeAction(undefined)}
                                className="ml-auto text-[8px] uppercase tracking-widest transition-opacity hover:opacity-70"
                                style={{ color: "rgba(52,211,153,0.4)" }}
                            >
                                CLEAR
                            </button>
                        )}
                    </div>

                    {/* Wrap calendar with green tint overrides */}
                    <div
                        className="[&_.rdp-day_button:hover]:bg-[rgba(52,211,153,0.15)] [&_.rdp-day_button.rdp-day_selected]:bg-[rgba(52,211,153,0.2)] [&_.rdp-day_button.rdp-day_selected]:text-[#34d399] [&_.rdp-caption_label]:text-[#34d399] [&_.rdp-nav_button]:text-[#34d399]"
                    >
                        <DatePicker
                            selectedDateRange={dateCreatedFilterRange}
                            onDateSelectAction={setDateCreatedFilterRangeAction}
                        />
                    </div>

                    {/* Selected range display */}
                    {dateCreatedFilterRange?.from && (
                        <div
                            className="mx-4 mb-3 px-3 py-2 border text-[9px] font-mono uppercase tracking-widest"
                            style={{ borderColor: "rgba(52,211,153,0.2)", backgroundColor: "rgba(52,211,153,0.04)", color: "#34d399" }}
                        >
                            {dateCreatedFilterRange.from.toLocaleDateString()}
                            {dateCreatedFilterRange.to && dateCreatedFilterRange.to !== dateCreatedFilterRange.from
                                ? ` → ${dateCreatedFilterRange.to.toLocaleDateString()}`
                                : ""}
                        </div>
                    )}
                </div>

                {/* Meetings section */}
                <div className="px-4 py-3">
                    <Meeting referenceid={userDetails.ReferenceID} />
                </div>
            </SidebarContent>

            {/* ── Footer: clock ── */}
            <SidebarFooter
                className="relative z-10 border-t px-4 py-3"
                style={{ borderColor: "rgba(52,211,153,0.1)", backgroundColor: "#0a0f0a" }}
            >
                <div className="flex flex-col items-center gap-0.5">
                    <span
                        className="text-[13px] font-mono font-bold tracking-widest"
                        style={{ color: "#34d399", textShadow: "0 0 8px rgba(52,211,153,0.4)" }}
                    >
                        {time}
                    </span>
                    <span
                        className="text-[8px] uppercase tracking-[0.15em] font-mono"
                        style={{ color: "rgba(52,211,153,0.35)" }}
                    >
                        {date}
                    </span>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
