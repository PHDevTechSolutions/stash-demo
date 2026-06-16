"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ServiceSubscriptions } from "@/components/service-subscriptions";
import { type DateRange } from "react-day-picker";

function PageContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();
    const queryUserId = searchParams?.get("id") ?? "";

    const [referenceid, setReferenceid] = useState("");
    const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<DateRange | undefined>(undefined);

    useEffect(() => {
        if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
    }, [queryUserId, userId, setUserId]);

    useEffect(() => {
        if (!queryUserId) return;
        fetch(`/api/user?id=${encodeURIComponent(queryUserId)}`)
            .then((r) => r.json())
            .then((d) => setReferenceid(d.ReferenceID || ""))
            .catch(() => {});
    }, [queryUserId]);

    return (
        <>
            <SidebarLeft />
            <SidebarInset className="overflow-hidden" style={{ backgroundColor: "#080c10", minHeight: "100%" }}>
                <header
                    className="sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b font-mono"
                    style={{ backgroundColor: "rgba(13,17,23,0.95)", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}
                >
                    <div className="flex flex-1 items-center gap-2 px-3">
                        <SidebarTrigger />
                        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                                        Platform Plans
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <main className="flex flex-1 flex-col overflow-auto" style={{ backgroundColor: "#080c10" }}>
                    {/* Dot grid */}
                    <div
                        className="fixed inset-0 pointer-events-none"
                        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px", zIndex: 0 }}
                    />
                    <div className="relative z-10 p-4">
                        <ServiceSubscriptions referenceid={referenceid} />
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

export default function Page() {
    return (
        <UserProvider>
            <FormatProvider>
                <SidebarProvider>
                    <Suspense fallback={<div>Loading...</div>}>
                        <PageContent />
                    </Suspense>
                </SidebarProvider>
            </FormatProvider>
        </UserProvider>
    );
}
