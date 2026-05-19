"use client";

import React, { useMemo } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    LabelList,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

interface AssetCardProps {
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
            <div style={{ color: "#38bdf8" }}>{payload[0].value} assets</div>
        </div>
    );
}

export function AssetCard({ chartData, title, description }: AssetCardProps) {
    const normalizedData = useMemo(() => {
        const map = new Map<string, number>();
        chartData.forEach(({ month, desktop }) => {
            const key =
                month.trim().toLowerCase().charAt(0).toUpperCase() +
                month.trim().toLowerCase().slice(1);
            map.set(key, (map.get(key) ?? 0) + desktop);
        });
        return Array.from(map.entries())
            .map(([month, desktop]) => ({ month, desktop }))
            .sort((a, b) => b.desktop - a.desktop);
    }, [chartData]);

    const yAxisWidth = Math.min(Math.max(...normalizedData.map((d) => d.month.length * 7), 80), 160);

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
                        style={{ backgroundColor: "#38bdf8", boxShadow: "0 0 5px #38bdf8" }}
                    />
                    <span className="text-[10px] uppercase tracking-widest font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {title}
                    </span>
                </div>
                <p className="text-[9px] pl-3.5" style={{ color: "rgba(255,255,255,0.2)" }}>{description}</p>
            </div>

            {/* Chart */}
            <div className="p-4 flex-1">
                {normalizedData.length === 0 ? (
                    <div className="flex items-center justify-center py-10">
                        <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                            NO DATA
                        </span>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={Math.max(normalizedData.length * 36, 120)}>
                        <BarChart
                            data={normalizedData}
                            layout="vertical"
                            barSize={16}
                            margin={{ left: 0, right: 40, top: 4, bottom: 4 }}
                        >
                            <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.04)" />
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="month"
                                width={yAxisWidth}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "monospace" }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                            <Bar dataKey="desktop" fill="#38bdf8" radius={[0, 3, 3, 0]} opacity={0.8}>
                                <LabelList
                                    dataKey="desktop"
                                    position="right"
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
                    {normalizedData.length} TYPE{normalizedData.length !== 1 ? "S" : ""} · {normalizedData.reduce((s, d) => s + d.desktop, 0)} TOTAL
                </span>
            </div>
        </div>
    );
}
