"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { SidebarGroup, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";

export function NavWorkspaces({
    workspaces,
    openSections,
    onToggleSection,
}: {
    workspaces: {
        name: string;
        icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
        url?: string;
        pages: {
            name: string;
            icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
            url: string;
        }[];
    }[];
    openSections: Record<string, boolean>;
    onToggleSection: (section: string) => void;
}) {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";

    return (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden px-2 py-1">
            <p
                className="px-2 pb-1.5 text-[9px] uppercase tracking-[0.2em] font-mono font-bold"
                style={{ color: "#fb923c" }}
            >
                WORKSPACES
            </p>
            <SidebarMenu className="flex flex-col gap-0.5">
                {workspaces.map((workspace) => {
                    const WorkspaceIcon = workspace.icon;
                    const isOpen = !!openSections[workspace.name];
                    const hasActivePage = workspace.pages.some(
                        (p) => pathname === new URL(p.url, "http://x").pathname
                    );

                    return (
                        <SidebarMenuItem key={workspace.name}>
                            {/* Section toggle */}
                            <button
                                onClick={() => onToggleSection(workspace.name)}
                                className="w-full flex items-center gap-3 px-2 py-2 text-[11px] font-mono uppercase tracking-widest transition-colors"
                                style={{
                                    color: hasActivePage || isOpen ? "#fb923c" : "rgba(255,255,255,0.4)",
                                    backgroundColor: isOpen ? "rgba(251,146,60,0.04)" : "transparent",
                                    borderLeft: hasActivePage ? "2px solid #fb923c" : "2px solid transparent",
                                }}
                            >
                                <WorkspaceIcon className="w-3.5 h-3.5 shrink-0" />
                                <span className="flex-1 text-left">{workspace.name}</span>
                                <ChevronRight
                                    className="w-3 h-3 shrink-0 transition-transform duration-150"
                                    style={{
                                        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                                        color: "rgba(255,255,255,0.2)",
                                    }}
                                />
                            </button>

                            {/* Sub-pages */}
                            {isOpen && (
                                <div className="flex flex-col gap-0.5 mt-0.5 ml-4 pl-3" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                                    {workspace.pages.map((page) => {
                                        const PageIcon = page.icon;
                                        const isActive = pathname === new URL(page.url, "http://x").pathname;
                                        return (
                                            <a
                                                key={page.name}
                                                href={page.url}
                                                className="flex items-center gap-2.5 px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-colors"
                                                style={{
                                                    color: isActive ? "#34d399" : "rgba(255,255,255,0.4)",
                                                    backgroundColor: isActive ? "rgba(52,211,153,0.06)" : "transparent",
                                                }}
                                            >
                                                <span
                                                    className="inline-flex w-1 h-1 rounded-full shrink-0"
                                                    style={{
                                                        backgroundColor: isActive ? "#34d399" : "rgba(255,255,255,0.2)",
                                                        boxShadow: isActive ? "0 0 4px #34d399" : "none",
                                                    }}
                                                />
                                                <PageIcon className="w-3 h-3 shrink-0" />
                                                <span>{page.name}</span>
                                            </a>
                                        );
                                    })}
                                </div>
                            )}
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
