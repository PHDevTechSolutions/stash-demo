"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider, useFormat } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { type DateRange } from "react-day-picker";
import { useTheme } from "next-themes";
import { toast } from "sonner";

// ─── Shared styles ────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.65)",
    outline: "none",
    appearance: "none" as const,
};

function TermSelect({ id, value, onChange, options }: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="px-2.5 py-1.5 text-[11px] font-mono border w-48"
            style={selectStyle}
        >
            {options.map((o) => (
                <option key={o.value} value={o.value} style={{ backgroundColor: "#0d1117", color: "#e2e8f0" }}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}

function SectionPanel({ dot, title, children }: { dot: string; title: string; children: React.ReactNode }) {
    return (
        <div className="border" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}>
            <div
                className="flex items-center gap-2 px-4 py-2.5 border-b"
                style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}
            >
                <span className="inline-flex w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dot, boxShadow: `0 0 5px ${dot}` }} />
                <span className="text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: dot }}>{title}</span>
            </div>
            <div className="p-4 flex flex-col gap-4">{children}</div>
        </div>
    );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
                {label}
            </span>
            {children}
        </div>
    );
}

// ─── Settings Content ─────────────────────────────────────────────────────────

function SettingsContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();
    const queryUserId = searchParams?.get("id") ?? "";
    const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = useState<DateRange | undefined>(undefined);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { if (queryUserId && queryUserId !== userId) setUserId(queryUserId); }, [queryUserId, userId, setUserId]);
    useEffect(() => setMounted(true), []);

    const { theme, setTheme } = useTheme();
    const { timeFormat, setTimeFormat, dateFormat, setDateFormat } = useFormat();

    const onTimeFormatChange = (val: string) => { setTimeFormat(val); toast.success(`Time format → ${val}`); };
    const onDateFormatChange = (val: string) => { setDateFormat(val); toast.success(`Date format → ${val}`); };

    if (!mounted) return null;

    return (
        <>
            <SidebarLeft />
            <SidebarInset className="overflow-hidden" style={{ backgroundColor: "#080c10" }}>
                {/* Dot grid */}
                <div
                    className="fixed inset-0 pointer-events-none"
                    style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px", zIndex: 0 }}
                />

                <header
                    className="sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b z-10 font-mono"
                    style={{ backgroundColor: "rgba(13,17,23,0.95)", borderColor: "rgba(255,255,255,0.07)" }}
                >
                    <div className="flex flex-1 items-center gap-2 px-3">
                        <SidebarTrigger />
                        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                                        Settings
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <main className="relative z-10 flex flex-col gap-4 p-4 overflow-auto font-mono" style={{ minHeight: "calc(100vh - 3.5rem)" }}>

                    {/* Top bar */}
                    <div
                        className="flex items-center gap-3 px-4 py-2.5 border"
                        style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}
                    >
                        <span className="inline-flex w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#fb923c", boxShadow: "0 0 5px #fb923c" }} />
                        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>SYSTEM SETTINGS</span>
                    </div>

                    <div className="max-w-2xl w-full mx-auto flex flex-col gap-4">

                        {/* Theme */}
                        <SectionPanel dot="#a78bfa" title="THEME">
                            <SettingRow label="Select Theme">
                                <TermSelect
                                    id="theme"
                                    value={theme ?? "system"}
                                    onChange={setTheme}
                                    options={[
                                        { value: "light",       label: "Light"                        },
                                        { value: "dark",        label: "Dark"                         },
                                        { value: "system",      label: "System"                       },
                                        { value: "ecoshift",    label: "Ecoshift Corporation"         },
                                        { value: "prms",        label: "Progressive Material Solutions"},
                                        { value: "vah",         label: "Value Acquisition Holdings"   },
                                        { value: "buildchem",   label: "Buildchem Solutions"          },
                                        { value: "disruptive",  label: "Disruptive Solutions"         },
                                        { value: "outlook",     label: "Outlook"                      },
                                        { value: "viber",       label: "Viber"                        },
                                    ]}
                                />
                            </SettingRow>
                        </SectionPanel>

                        {/* Time & Date */}
                        <SectionPanel dot="#38bdf8" title="TIME & DATE FORMAT">
                            <SettingRow label="Time Format">
                                <TermSelect
                                    id="time-format"
                                    value={timeFormat}
                                    onChange={onTimeFormatChange}
                                    options={[
                                        { value: "12h", label: "12-Hour (AM/PM)" },
                                        { value: "24h", label: "24-Hour"         },
                                    ]}
                                />
                            </SettingRow>
                            <div className="h-px" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
                            <SettingRow label="Date Format">
                                <TermSelect
                                    id="date-format"
                                    value={dateFormat}
                                    onChange={onDateFormatChange}
                                    options={[
                                        { value: "short", label: "MM/DD/YYYY"              },
                                        { value: "long",  label: "Monday, November 11 2025"},
                                        { value: "iso",   label: "2025-11-11"              },
                                    ]}
                                />
                            </SettingRow>
                        </SectionPanel>
                    </div>
                </main>
            </SidebarInset>
            <SidebarRight
                userId={userId ?? undefined}
                dateCreatedFilterRange={dateCreatedFilterRange}
                setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
            />
        </>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    return (
        <UserProvider>
            <FormatProvider>
                <SidebarProvider>
                    <Suspense fallback={<div>Loading...</div>}>
                        <SettingsContent />
                    </Suspense>
                </SidebarProvider>
            </FormatProvider>
        </UserProvider>
    );
}
