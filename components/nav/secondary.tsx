"use client";

import React from "react";
import { type LucideIcon } from "lucide-react";
import { SidebarGroup, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";

export function NavSecondary({
    items,
    ...props
}: {
    items: {
        title: string;
        url: string;
        icon: LucideIcon;
        badge?: React.ReactNode;
    }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";

    return (
        <SidebarGroup {...props} className="group-data-[collapsible=icon]:hidden px-2 pb-3">
            <div
                className="mx-2 mb-2 h-px"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
            />
            <SidebarMenu>
                {items.map((item) => {
                    const isActive = pathname === new URL(item.url, "http://x").pathname;
                    return (
                        <SidebarMenuItem key={item.title}>
                            <a
                                href={item.url}
                                className="flex items-center gap-3 px-2 py-2 text-[11px] font-mono uppercase tracking-widest transition-colors"
                                style={{
                                    color: isActive ? "#34d399" : "rgba(255,255,255,0.35)",
                                    backgroundColor: isActive ? "rgba(52,211,153,0.06)" : "transparent",
                                    borderLeft: isActive ? "2px solid #34d399" : "2px solid transparent",
                                }}
                            >
                                <item.icon className="w-3.5 h-3.5 shrink-0" />
                                <span className="flex-1">{item.title}</span>
                                {item.badge && (
                                    <span
                                        className="text-[9px] font-mono px-1.5 py-0.5 border"
                                        style={{ color: "#fb923c", borderColor: "rgba(251,146,60,0.3)", backgroundColor: "rgba(251,146,60,0.06)" }}
                                    >
                                        {item.badge}
                                    </span>
                                )}
                            </a>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
