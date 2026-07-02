"use client";

import React, { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import { FormatProvider } from "@/contexts/FormatContext";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { CredentialVault } from "@/components/credential-vault";
import { type DateRange } from "react-day-picker";

function VaultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams?.get("id") ?? null;

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);

  React.useEffect(() => {
    if (!id) router.replace("/auth/login");
  }, [id, router]);

  if (!id) return null;

  return (
    <>
      <SidebarLeft />
      <SidebarInset
        className="overflow-hidden"
        style={{ backgroundColor: "#080c10", minHeight: "100%" }}
      >
        <header
          className="sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b z-20"
          style={{
            backgroundColor: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.07)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
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

        <main
          className="flex flex-1 flex-col gap-4 p-4 overflow-auto"
          style={{ backgroundColor: "#080c10", minHeight: "100%" }}
        >
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
        <Suspense
          fallback={
            <div
              className="flex items-center justify-center min-h-screen font-mono text-[10px] uppercase tracking-widest"
              style={{ backgroundColor: "#080c10", color: "rgba(255,255,255,0.3)" }}
            >
              Loading...
            </div>
          }
        >
          <VaultContent />
        </Suspense>
      </SidebarProvider>
    </FormatProvider>
  );
}
