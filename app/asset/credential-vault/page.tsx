"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import { FormatProvider } from "@/contexts/FormatContext";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { CredentialVault } from "@/components/credential-vault";
import { type DateRange } from "react-day-picker";

function VaultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams?.get("id") ?? null;
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null); // null = checking

  // Verify session cookie is still valid server-side
  useEffect(() => {
    if (!id) { router.replace("/auth/login"); return; }

    // Call a lightweight session-check endpoint
    fetch("/api/vault/session-check")
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          router.replace("/auth/login");
        } else if (r.ok) {
          setSessionValid(true);
        } else {
          router.replace("/auth/login");
        }
      })
      .catch(() => router.replace("/auth/login"));
  }, [id, router]);

  // Show nothing while checking session — prevents flash of content
  if (!id || sessionValid !== true) {
    return (
      <div className="flex items-center justify-center min-h-screen font-mono text-[10px] uppercase tracking-widest"
        style={{ backgroundColor: "#080c10", color: "rgba(255,255,255,0.3)" }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-t border-current rounded-full animate-spin" />
          Verifying session...
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden" style={{ backgroundColor: "#080c10", minHeight: "100%" }}>
        <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b z-20"
          style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Asset Management
                  </span>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-white text-[11px] font-mono">
                    Credential Vault
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto"
          style={{ backgroundColor: "#080c10", minHeight: "100%" }}>
          <CredentialVault userId={id} />
        </main>
      </SidebarInset>

      <SidebarRight
        userId={id}
        dateCreatedFilterRange={dateRange}
        setDateCreatedFilterRangeAction={setDateRange}
      />
    </>
  );
}

export default function Page() {
  return (
    <FormatProvider>
      <SidebarProvider>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen font-mono text-[10px] uppercase tracking-widest"
            style={{ backgroundColor: "#080c10", color: "rgba(255,255,255,0.3)" }}>
            Loading...
          </div>
        }>
          <VaultContent />
        </Suspense>
      </SidebarProvider>
    </FormatProvider>
  );
}
