"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Supplies } from "@/components/supplies";
import { type DateRange } from "react-day-picker";

function SuppliesContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();
    const queryUserId = searchParams?.get("id") ?? "";

    const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<DateRange | undefined>(undefined);
    const [referenceid, setReferenceid] = React.useState("");

    React.useEffect(() => {
        if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
    }, [queryUserId, userId, setUserId]);

    React.useEffect(() => {
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
                                        Supplies
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <main className="flex flex-1 flex-col gap-4 overflow-auto" style={{ backgroundColor: "#080c10", minHeight: "100%" }}>
                    <Supplies
                        referenceid={referenceid}
                        dateCreatedFilterRange={dateCreatedFilterRange}
                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                    />
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
                        <SuppliesContent />
                    </Suspense>
                </SidebarProvider>
            </FormatProvider>
        </UserProvider>
    );
}
