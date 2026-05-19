"use client";

import * as React from "react";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";

export function TeamSwitcher() {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <div className="flex items-center gap-3 px-3 py-4">
                    {/* Glowing logo mark */}
                    <div
                        className="flex items-center justify-center w-7 h-7 shrink-0 border font-mono font-bold text-[11px]"
                        style={{
                            backgroundColor: "rgba(251,146,60,0.1)",
                            borderColor: "rgba(251,146,60,0.3)",
                            color: "#fb923c",
                            boxShadow: "0 0 8px rgba(251,146,60,0.2)",
                        }}
                    >
                        S
                    </div>
                    <div className="flex flex-col">
                        <span
                            className="text-[11px] font-bold uppercase tracking-[0.15em] font-mono"
                            style={{ color: "#fb923c" }}
                        >
                            STASH
                        </span>
                        <span
                            className="text-[9px] uppercase tracking-widest font-mono"
                            style={{ color: "rgba(255,255,255,0.25)" }}
                        >
                            IT ASSET SYSTEM
                        </span>
                    </div>
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
