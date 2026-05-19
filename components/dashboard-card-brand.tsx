"use client";

import React from "react";
import {
    BarChart,
    Bar,
    XAxis,
    CartesianGrid,
    LabelList,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

interface BrandCardProps {
    chartData: { month: string; desktop: number }[];
    title: string;
    description: string;
}

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div
            className="px-3 py-2 border font-mono text-[10px]"
            style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
        >
            <div style={{ color: "rgba(255,255,255,0.4)" }}>{label}</div>
            <div style={{ color: "#a78bfa" }}>{payload[0].value} assets</div>
        </div>
    );
}

export function BrandCard({ chartData, title, description }: BrandCardProps) {
    const sortedData = [...chartData].sort((a, b) => b.desktop - a.desktop);

    return (
        <div
            className="border flex flex-col"
            style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}
        >
            {/* Header */}
            <div
                className="px-4 py-3 border-b"
                style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}
            >
                <div className="flex items-center gap-2 mb-0.5">
                    <span
                        className="inline-flex w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: "#a78bfa", boxShadow: "0 0 5px #a78bfa" }}
                    />
                    <span className="text-[10px] uppercase tracking-widest font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {title}
                    </span>
                </div>
                <p className="text-[9px] pl-3.5" style={{ color: "rgba(255,255,255,0.2)" }}>{description}</p>
            </div>

            {/* Chart */}
            <div className="p-4 flex-1">
                {sortedData.length === 0 ? (
                    <div className="flex items-center justify-center py-10">
                        <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                            NO DATA
                        </span>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                            data={sortedData}
                            margin={{ top: 24, right: 8, left: 8, bottom: 8 }}
                            barSize={20}
                        >
                            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                            <XAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "monospace" }}
                                tickFormatter={(v) => v.slice(0, 6)}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                            <Bar dataKey="desktop" fill="#a78bfa" radius={[3, 3, 0, 0]} opacity={0.8}>
                                <LabelList
                                    position="top"
                                    offset={8}
                                    style={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "monospace" }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Footer */}
            <div
                className="px-4 py-2 border-t"
                style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.2)" }}
            >
                <span className="text-[9px] uppercase tracking-widest font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {sortedData.length} BRAND{sortedData.length !== 1 ? "S" : ""} · {sortedData.reduce((s, d) => s + d.desktop, 0)} TOTAL
                </span>
            </div>
        </div>
    );
}
