"use client";

import React from "react";
import { SidebarGroup, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";

export function NavFavorites({
    favorites,
}: {
    favorites: {
        name: string;
        url: string;
        icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
        isActive?: boolean;
    }[];
}) {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";

    return (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden px-2 pt-1 pb-0">
            <p
                className="px-2 pb-1.5 text-[9px] uppercase tracking-[0.2em] font-mono font-bold"
                style={{ color: "#fb923c" }}
            >
                NAVIGATION
            </p>
            <SidebarMenu>
                {favorites.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.isActive || pathname === new URL(item.url, "http://x").pathname;
                    return (
                        <SidebarMenuItem key={item.name}>
                            <a
                                href={item.url}
                                className="flex items-center gap-3 px-2 py-2 text-[11px] font-mono uppercase tracking-widest transition-colors"
                                style={{
                                    color: isActive ? "#34d399" : "rgba(255,255,255,0.5)",
                                    backgroundColor: isActive ? "rgba(52,211,153,0.06)" : "transparent",
                                    borderLeft: isActive ? "2px solid #34d399" : "2px solid transparent",
                                }}
                            >
                                <span
                                    className="inline-flex w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{
                                        backgroundColor: isActive ? "#34d399" : "rgba(255,255,255,0.2)",
                                        boxShadow: isActive ? "0 0 5px #34d399" : "none",
                                    }}
                                />
                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                <span>{item.name}</span>
                            </a>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
