"use client";

import React from "react";

interface StatusCardProps {
    counts: Record<string, number>;
    userId?: string;
}

const statusMeta: Record<string, { title: string; description: string; link: string; color: string; dot: string }> = {
    spare: {
        title: "SPARE",
        description: "Available assets ready for deployment or replacement.",
        link: "/asset/spare",
        color: "#34d399",
        dot: "#34d399",
    },
    deployed: {
        title: "DEPLOYED",
        description: "Assets currently assigned and actively used.",
        link: "/asset/deployed",
        color: "#38bdf8",
        dot: "#38bdf8",
    },
    missing: {
        title: "MISSING",
        description: "Assets unaccounted for and requiring investigation.",
        link: "/asset/missing",
        color: "#fbbf24",
        dot: "#fbbf24",
    },
    dispose: {
        title: "DISPOSED",
        description: "Assets marked for disposal or decommissioning.",
        link: "/asset/disposal",
        color: "rgba(255,255,255,0.35)",
        dot: "rgba(255,255,255,0.3)",
    },
    lend: {
        title: "LEND",
        description: "Assets temporarily lent out to users or departments.",
        link: "/asset/lend",
        color: "#a78bfa",
        dot: "#a78bfa",
    },
    defective: {
        title: "DEFECTIVE",
        description: "Assets that are malfunctioning and need repair.",
        link: "/asset/defective",
        color: "#f87171",
        dot: "#f87171",
    },
};

const termBtn =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer";

export function StatusCard({ counts, userId }: StatusCardProps) {
    const grandTotal = Object.values(counts).reduce((sum, v) => sum + v, 0);

    return (
        <div className="flex flex-col gap-4">
            {/* ── All Assets banner ── */}
            <div
                className="flex items-center justify-between px-5 py-4 border"
                style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.02)" }}
            >
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        TOTAL ASSETS
                    </span>
                    <span className="text-3xl font-mono font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
                        {grandTotal}
                    </span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                        All IT assets regardless of status
                    </span>
                </div>
                <a
                    href={`/asset/all?id=${encodeURIComponent(userId ?? "")}`}
                    className={termBtn}
                    style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.12)" }}
                >
                    VIEW ALL
                </a>
            </div>

            {/* ── Per-status grid ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {Object.keys(statusMeta).map((status) => {
                    const meta = statusMeta[status];
                    const total = counts[status] ?? 0;
                    return (
                        <div
                            key={status}
                            className="flex flex-col justify-between p-4 border"
                            style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}
                        >
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="inline-flex w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: meta.dot, boxShadow: `0 0 5px ${meta.dot}` }}
                                    />
                                    <span className="text-[9px] uppercase tracking-widest font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                                        {meta.title}
                                    </span>
                                </div>
                                <span className="text-2xl font-mono font-bold" style={{ color: meta.color }}>
                                    {total}
                                </span>
                                <span className="text-[9px] leading-relaxed" style={{ color: "rgba(255,255,255,0.2)" }}>
                                    {meta.description}
                                </span>
                            </div>
                            <a
                                href={`${meta.link}?id=${encodeURIComponent(userId ?? "")}`}
                                className="mt-4 text-[9px] uppercase tracking-widest font-mono border-b pb-0.5 w-fit transition-opacity hover:opacity-70"
                                style={{ color: meta.color, borderColor: meta.color }}
                            >
                                VIEW →
                            </a>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
