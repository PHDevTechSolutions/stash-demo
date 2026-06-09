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
import { Plus, X, Mail } from "lucide-react";

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

    const [customEmails, setCustomEmails] = useState<string[]>([]);
    const [newEmail, setNewEmail] = useState("");
    const [sendingTest, setSendingTest] = useState(false);

    // Load custom emails from localStorage (or you could use a database)
    useEffect(() => {
        const saved = localStorage.getItem("domain_notification_emails");
        if (saved) {
            try {
                setCustomEmails(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved emails");
            }
        }
    }, []);

    const addEmail = () => {
        if (!newEmail) return;
        if (!newEmail.includes("@")) {
            toast.error("Invalid email address");
            return;
        }
        if (customEmails.includes(newEmail)) {
            toast.error("Email already added");
            return;
        }
        const updated = [...customEmails, newEmail];
        setCustomEmails(updated);
        localStorage.setItem("domain_notification_emails", JSON.stringify(updated));
        setNewEmail("");
        toast.success("Recipient added successfully");
    };

    const removeEmail = (email: string) => {
        const updated = customEmails.filter(e => e !== email);
        setCustomEmails(updated);
        localStorage.setItem("domain_notification_emails", JSON.stringify(updated));
        toast.success("Recipient removed");
    };

    const sendTestEmail = async () => {
        setSendingTest(true);
        try {
            const response = await fetch("/api/send-domain-alert", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    domains: [
                        {
                            domain: "test-domain.com",
                            source: "test-registrar",
                            status: "ACTIVE",
                            expires: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
                            diffDays: 15,
                            isCritical: false
                        }
                    ],
                    customEmails: customEmails
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to send test email");
            
            toast.success("Test email sent successfully to all recipients!");
        } catch (error: any) {
            console.error("Test email error:", error);
            toast.error(error.message || "Failed to send test email");
        } finally {
            setSendingTest(false);
        }
    };

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

                        {/* Domain Notifications */}
                        <SectionPanel dot="#34d399" title="DOMAIN NOTIFICATIONS">
                            <div className="flex flex-col gap-3">
                                <span className="text-[10px] uppercase tracking-widest font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
                                    Email Recipients
                                </span>
                                
                                {/* Default Email (Static) */}
                                <div className="flex items-center justify-between p-2 border" style={{ borderColor: "rgba(255,255,255,0.05)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-3 w-3 opacity-30" />
                                        <span className="text-[11px] font-mono text-white/40">phdevtechsolutions@gmail.com</span>
                                    </div>
                                    <span className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 border border-white/10 text-white/20">Default</span>
                                </div>

                                {/* Custom Emails List */}
                                {customEmails.map((email) => (
                                    <div key={email} className="flex items-center justify-between p-2 border" style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-3 w-3 text-emerald-400/50" />
                                            <span className="text-[11px] font-mono text-white/70">{email}</span>
                                        </div>
                                        <button 
                                            onClick={() => removeEmail(email)}
                                            className="p-1 hover:bg-white/5 text-white/20 hover:text-red-400 transition-colors"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}

                                {/* Add New Email Input */}
                                <div className="flex items-center gap-2 mt-2">
                                    <input
                                        type="email"
                                        placeholder="ADD RECIPIENT EMAIL..."
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && addEmail()}
                                        className="flex-1 px-2.5 py-1.5 text-[11px] font-mono border outline-none placeholder:opacity-20"
                                        style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
                                    />
                                    <button
                                        onClick={addEmail}
                                        className="px-3 py-1.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                <button
                                    onClick={sendTestEmail}
                                    disabled={sendingTest}
                                    className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                                >
                                    {sendingTest ? (
                                        <div className="w-3.5 h-3.5 border-t border-current rounded-full animate-spin" />
                                    ) : (
                                        <Mail className="h-3.5 w-3.5" />
                                    )}
                                    <span className="text-[10px] uppercase tracking-widest font-bold">Send Test Alert Email</span>
                                </button>

                                <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">
                                    Notifications will be sent 30 days and 14 days before expiration.
                                </p>
                            </div>
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
