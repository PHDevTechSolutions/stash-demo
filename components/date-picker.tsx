"use client";

import * as React from "react";
import { type DateRange, DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";

type DatePickerProps = {
    selectedDateRange: DateRange | undefined;
    onDateSelectAction: (dateRange: DateRange | undefined) => void;
};

export function DatePicker({ selectedDateRange, onDateSelectAction }: DatePickerProps) {
    return (
        <SidebarGroup className="px-0">
            <SidebarGroupContent>
                <DayPicker
                    mode="range"
                    selected={selectedDateRange}
                    onSelect={(range: DateRange | undefined) => onDateSelectAction(range)}
                    showOutsideDays
                    components={{
                        Chevron: ({ orientation }) =>
                            orientation === "left"
                                ? <ChevronLeft className="h-3 w-3" />
                                : <ChevronRight className="h-3 w-3" />,
                    }}
                    classNames={{
                        root:        "w-full font-mono px-3 py-2",
                        months:      "flex flex-col",
                        month:       "flex flex-col gap-2",
                        month_caption: "flex items-center justify-between px-1 py-1",
                        caption_label: "text-[10px] uppercase tracking-[0.2em] font-bold",
                        nav:         "flex items-center gap-1",
                        button_previous: [
                            "inline-flex items-center justify-center w-5 h-5 border transition-colors",
                            "border-[rgba(52,211,153,0.2)] text-[#34d399] hover:bg-[rgba(52,211,153,0.08)]",
                        ].join(" "),
                        button_next: [
                            "inline-flex items-center justify-center w-5 h-5 border transition-colors",
                            "border-[rgba(52,211,153,0.2)] text-[#34d399] hover:bg-[rgba(52,211,153,0.08)]",
                        ].join(" "),
                        month_grid:  "w-full border-collapse",
                        weekdays:    "flex",
                        weekday:     "flex-1 text-center text-[8px] uppercase tracking-widest py-1 font-bold",
                        week:        "flex mt-0.5",
                        day:         "flex-1 text-center p-0",
                        day_button: [
                            "w-full h-7 text-[10px] font-mono transition-colors",
                            "hover:bg-[rgba(52,211,153,0.12)] hover:text-[#34d399]",
                        ].join(" "),
                        selected:    "bg-[rgba(52,211,153,0.15)] text-[#34d399]",
                        range_start: "bg-[rgba(52,211,153,0.25)] text-[#34d399] font-bold",
                        range_end:   "bg-[rgba(52,211,153,0.25)] text-[#34d399] font-bold",
                        range_middle:"bg-[rgba(52,211,153,0.08)] text-[#34d399]",
                        today:       "border border-[rgba(52,211,153,0.4)] text-[#34d399]",
                        outside:     "opacity-20",
                        disabled:    "opacity-20 cursor-not-allowed",
                        hidden:      "invisible",
                    }}
                    styles={{
                        caption_label: { color: "#34d399" },
                        weekday:       { color: "rgba(52,211,153,0.35)" },
                        day_button:    { color: "rgba(52,211,153,0.6)" },
                    }}
                />
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
