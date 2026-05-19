"use client";

import * as React from "react";
import {
    Settings,
    PhoneCall,
    FolderKanban,
    Clock,
    FolderCheck,
    Cog,
    Gauge,
    Package,
    ClipboardList,
    Trash2,
    KeyRound,
    ShieldCheck,
} from "lucide-react";

import { NavFavorites } from "@/components/nav/favorites";
import { NavSecondary } from "@/components/nav/secondary";
import { NavWorkspaces } from "@/components/nav/workspaces";
import { TeamSwitcher } from "@/components/nav/team-switcher";
import { NavUser } from "@/components/nav/user";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar";

// ─── Nav data ─────────────────────────────────────────────────────────────────

const data = {
    navSecondary: [
        { title: "Settings", url: "/settings", icon: Settings },
    ],
    favorites: [
        { name: "Dashboard", url: "/dashboard", icon: Gauge, isActive: true },
    ],
    workspaces: [
        {
            name: "Asset Management",
            icon: FolderKanban,
            pages: [
                { name: "Inventory",      url: "/asset/inventory", icon: Package      },
                { name: "Assign Assets",  url: "/asset/assign",    icon: ClipboardList },
                { name: "Disposal",       url: "/asset/disposal",  icon: Trash2        },
                { name: "Subscriptions",  url: "/asset/license",   icon: KeyRound      },
                { name: "Warranty",       url: "/asset/warranty",  icon: ShieldCheck   },
            ],
        },
        {
            name: "Maintenance",
            icon: Cog,
            pages: [
                { name: "Maintenance, Audit & History Logs", url: "/maintenance", icon: PhoneCall },
            ],
        },
        {
            name: "Audit Logs",
            icon: FolderCheck,
            pages: [
                { name: "Audit Logs", url: "/taskflow/audit-logs", icon: FolderCheck },
            ],
        },
        {
            name: "History Logs",
            icon: Clock,
            pages: [
                { name: "History Logs", url: "/taskflow/history-logs", icon: Clock },
            ],
        },
    ],
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SidebarLeft(props: React.ComponentProps<typeof Sidebar>) {
    const [userId,       setUserId]       = React.useState<string | null>(null);
    const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
    const [userData,     setUserData]     = React.useState<{ name: string; email: string; position?: string; avatar: string } | null>(null);

    // ── Read userId from URL ──────────────────────────────────────────────────
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        setUserId(id);
    }, []);

    // ── Fetch user info for footer ────────────────────────────────────────────
    React.useEffect(() => {
        if (!userId) return;
        fetch(`/api/user?id=${encodeURIComponent(userId)}`)
            .then((r) => r.json())
            .then((d) => {
                setUserData({
                    name:     d.FullName  || d.fullname  || d.name  || "User",
                    email:    d.Email     || d.email     || "",
                    position: d.Position  || d.position  || undefined,
                    avatar:   d.Avatar    || d.avatar    || "",
                });
            })
            .catch(() => {});
    }, [userId]);

    // ── URL helpers ───────────────────────────────────────────────────────────
    const withUserId = React.useCallback(
        (url: string) => {
            if (!userId || !url || url === "#") return url;
            return url.includes("?") ? `${url}&id=${encodeURIComponent(userId)}` : `${url}?id=${encodeURIComponent(userId)}`;
        },
        [userId]
    );

    const workspacesWithId = React.useMemo(
        () => data.workspaces.map((ws) => ({ ...ws, pages: ws.pages.map((p) => ({ ...p, url: withUserId(p.url) })) })),
        [withUserId]
    );
    const favoritesWithId    = React.useMemo(() => data.favorites.map((f)    => ({ ...f, url: withUserId(f.url) })), [withUserId]);
    const navSecondaryWithId = React.useMemo(() => data.navSecondary.map((i) => ({ ...i, url: withUserId(i.url) })), [withUserId]);

    const handleToggle = (section: string) =>
        setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));

    return (
        <Sidebar
            className="border-none font-mono"
            style={
                {
                    "--sidebar-background": "#0d1117",
                    "--sidebar-foreground": "rgba(255,255,255,0.6)",
                    "--sidebar-border": "rgba(255,255,255,0.07)",
                    "--sidebar-accent": "rgba(255,255,255,0.04)",
                    "--sidebar-accent-foreground": "rgba(255,255,255,0.7)",
                } as React.CSSProperties
            }
            {...props}
        >
            {/* ── Header: logo ── */}
            <SidebarHeader
                className="border-b"
                style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "#0d1117" }}
            >
                <TeamSwitcher />
            </SidebarHeader>

            {/* ── Dot grid overlay ── */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                    zIndex: 0,
                }}
            />

            {/* ── Content ── */}
            <SidebarContent
                className="relative z-10 overflow-y-auto"
                style={{ backgroundColor: "#0d1117" }}
            >
                <NavFavorites favorites={favoritesWithId} />

                {/* Divider */}
                <div className="mx-4 my-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

                <NavWorkspaces
                    workspaces={workspacesWithId}
                    openSections={openSections}
                    onToggleSection={handleToggle}
                />

                <NavSecondary items={navSecondaryWithId} className="mt-auto" />
            </SidebarContent>

            {/* ── Footer: user ── */}
            {userData && userId && (
                <SidebarFooter
                    className="border-t relative z-10"
                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "#0d1117" }}
                >
                    <NavUser user={userData} userId={userId} />
                </SidebarFooter>
            )}

            <SidebarRail />
        </Sidebar>
    );
}
