"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";
import { StatusCard } from "@/components/dashboard-card-status";
import { AssetCard } from "@/components/dashboard-card-asset_type";
import { BrandCard } from "@/components/dashboard-card-brand";
import { Globe, Bell } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string;
  status: string;
  asset_tag: string;
  asset_type: string;
  model: string;
  brand: string;
  location: string;
  date_created?: string;
  warranty_date: string;
}

interface DomainItem {
  domain: string;
  status: string;
  expires: string; // Unified expiration field
  source: "godaddy" | "hostinger";
}

interface UserDetails {
  referenceid: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TerminalDot({ color }: { color: string }) {
  return (
    <span
      className="inline-flex items-center justify-center w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}

function THead({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.15em] whitespace-nowrap select-none"
      style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      {children}
    </th>
  );
}

function TCell({ children, mono = false }: { children?: React.ReactNode; mono?: boolean }) {
  return (
    <td
      className={`px-3 py-2.5 text-[11px] ${mono ? "font-mono" : ""} whitespace-nowrap`}
      style={{ color: "rgba(255,255,255,0.65)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      {children || <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>}
    </td>
  );
}

// ─── Dashboard Content ────────────────────────────────────────────────────────

function DashboardContent() {
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<DateRange | undefined>(undefined);
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [activities, setActivities] = useState<InventoryItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [errorUser, setErrorUser] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails>({ referenceid: "" });

  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);

  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  // ── Fetch user ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { setErrorUser("User ID is missing."); setLoadingUser(false); return; }
    const fetchUserData = async () => {
      setErrorUser(null);
      setLoadingUser(true);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();
        setUserDetails({ referenceid: data.ReferenceID || "" });
        toast.success("User data loaded successfully!");
      } catch (err) {
        setErrorUser("Failed to connect to server. Please try again later or check your network connection.");
        toast.error("Failed to connect to server. Please refresh or check your network connection.");
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUserData();
  }, [userId]);

  const referenceid = userDetails.referenceid;

  // ── Fetch inventory ───────────────────────────────────────────────────────
  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
    setLoadingActivities(true);
    setErrorActivities(null);
    fetch(`/api/fetch-inventory?referenceid=${encodeURIComponent(referenceid)}`)
      .then(async (res) => { if (!res.ok) throw new Error("Failed to fetch activities"); return res.json(); })
      .then((data) => setActivities(data.data || []))
      .catch((err) => setErrorActivities(err.message))
      .finally(() => setLoadingActivities(false));
  }, [referenceid]);

  const fetchDomains = useCallback(async () => {
    setLoadingDomains(true);
    try {
      const [gdRes, hostRes] = await Promise.all([
        fetch("/api/godaddy-domains"),
        fetch("/api/hostinger-domains")
      ]);

      let gdData: DomainItem[] = [];
      let hostData: DomainItem[] = [];

      if (gdRes.ok) {
        const raw = await gdRes.json();
        gdData = raw.map((d: any) => ({
          domain: d.domain,
          status: d.status,
          expires: d.expires,
          source: "godaddy"
        }));
      }

      if (hostRes.ok) {
        const raw = await hostRes.json();
        hostData = raw.map((d: any) => ({
          domain: d.domain || d.domain_name,
          status: d.status,
          expires: d.expires_at || d.expires || d.expiration_date,
          source: "hostinger"
        }));
      }

      const allDomains = [...gdData, ...hostData].sort((a, b) => 
        new Date(a.expires).getTime() - new Date(b.expires).getTime()
      );
      setDomains(allDomains);

      // ── Notifications ──
      const today = new Date();
      const expiringDomains: any[] = [];

      allDomains.forEach(d => {
        if (!d.expires) return;
        const expiryDate = new Date(d.expires);
        const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 30 && diffDays > 0) {
          expiringDomains.push({ ...d, diffDays, isCritical: diffDays <= 14 });
          
          if (diffDays <= 14) {
            toast.error(`DOMAIN EXPIRING SOON: ${d.domain} expires in ${diffDays} days! (${d.source.toUpperCase()})`, {
              duration: 10000,
              icon: <Bell className="h-4 w-4" />
            });
          } else {
            toast.warning(`DOMAIN RENEWAL: ${d.domain} expires in ${diffDays} days. (${d.source.toUpperCase()})`, {
              duration: 8000,
              icon: <Bell className="h-4 w-4" />
            });
          }
        }
      });

      // Send email if there are expiring domains
      if (expiringDomains.length > 0) {
        // Load custom emails from localStorage
        const savedEmails = localStorage.getItem("domain_notification_emails");
        const customEmails = savedEmails ? JSON.parse(savedEmails) : [];

        fetch("/api/send-domain-alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            domains: expiringDomains,
            customEmails: customEmails
          })
        }).catch(err => console.error("Failed to trigger email alert:", err));
      }

    } catch (err) {
      console.error("Error fetching domains:", err);
    } finally {
      setLoadingDomains(false);
    }
  }, []);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchActivities();
    fetchDomains();
    if (!referenceid) return;
    const ch = supabase
      .channel(`inventory-${referenceid}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "inventory", filter: `referenceid=eq.${referenceid}` },
        (payload) => {
          const n = payload.new as InventoryItem;
          const o = payload.old as InventoryItem;
          setActivities((c) => {
            switch (payload.eventType) {
              case "INSERT": return c.some((a) => a.id === n.id) ? c : [...c, n];
              case "UPDATE": return c.map((a) => (a.id === n.id ? n : a));
              case "DELETE": return c.filter((a) => a.id !== o.id);
              default: return c;
            }
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [referenceid, fetchActivities]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const counts = React.useMemo(() => {
    const n = (s?: string) => s?.toLowerCase() ?? "";
    return {
      spare: activities.filter((i) => n(i.status) === "spare").length,
      deployed: activities.filter((i) => n(i.status) === "deployed").length,
      missing: activities.filter((i) => n(i.status) === "missing").length,
      dispose: activities.filter((i) => n(i.status) === "dispose").length,
      lend: activities.filter((i) => n(i.status) === "lend").length,
      defective: activities.filter((i) => n(i.status) === "defective").length,
    };
  }, [activities]);

  const assetTypeChartData = React.useMemo(() => {
    const map: Record<string, number> = {};
    activities.forEach(({ asset_type }) => { map[asset_type] = (map[asset_type] ?? 0) + 1; });
    return Object.entries(map).map(([month, desktop]) => ({ month, desktop }));
  }, [activities]);

  const brandChartData = React.useMemo(() => {
    const map: Record<string, number> = {};
    activities.forEach(({ brand }) => { map[brand] = (map[brand] ?? 0) + 1; });
    return Object.entries(map).map(([month, desktop]) => ({ month, desktop }));
  }, [activities]);

  const locationCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    activities.forEach(({ location }) => { map[location] = (map[location] ?? 0) + 1; });
    return map;
  }, [activities]);

  const expiredWarranties = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return activities.filter((item) => {
      if (!item.warranty_date) return false;
      const d = new Date(item.warranty_date);
      d.setHours(0, 0, 0, 0);
      return d < today;
    });
  }, [activities]);

  // ── Expired warranty table state ──────────────────────────────────────────
  const [warrantySearch,       setWarrantySearch]       = useState("");
  const [warrantyDisplayLimit, setWarrantyDisplayLimit] = useState(10);

  const filteredExpired = React.useMemo(() => {
    const q = warrantySearch.trim().toLowerCase();
    if (!q) return expiredWarranties;
    return expiredWarranties.filter((item) =>
      [item.asset_tag, item.asset_type, item.brand, item.model, item.warranty_date]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [expiredWarranties, warrantySearch]);

  // Reset limit when search changes
  React.useEffect(() => { setWarrantyDisplayLimit(10); }, [warrantySearch]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden" style={{ backgroundColor: "#080c10", minHeight: "100%" }}>
        <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b-1" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="line-clamp-1 text-white">Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* ── Main content ── */}
        <main
          className="flex flex-col gap-4 p-4 overflow-auto font-mono"
          style={{ backgroundColor: "#080c10", minHeight: "calc(100vh - 3.5rem)" }}
        >
          {/* Dot grid */}
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              zIndex: 0,
            }}
          />

          <div className="relative z-10 flex flex-col gap-6">

            {loadingUser ? (
              <div className="flex items-center gap-2 py-10" style={{ color: "rgba(255,255,255,0.25)" }}>
                <div className="w-3.5 h-3.5 border-t border-current rounded-full animate-spin" />
                <span className="text-[9px] uppercase tracking-widest">LOADING USER...</span>
              </div>
            ) : errorUser ? (
              <div className="flex items-center gap-2 p-4 text-[10px] border" style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.2)", backgroundColor: "rgba(248,113,113,0.04)" }}>
                <TerminalDot color="#f87171" /> {errorUser}
              </div>
            ) : (
              <>
                {/* Loading / error for activities */}
                {loadingActivities && (
                  <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                    <div className="w-3 h-3 border-t border-current rounded-full animate-spin" />
                    <span className="text-[9px] uppercase tracking-widest">LOADING INVENTORY...</span>
                  </div>
                )}
                {errorActivities && (
                  <div className="flex items-center gap-2 p-3 text-[10px] border" style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.2)" }}>
                    <TerminalDot color="#f87171" /> {errorActivities}
                  </div>
                )}

                {/* ── Status cards ── */}
                <StatusCard counts={counts} userId={userId ?? undefined} />

                {/* ── Domain Monitoring Card ── */}
                <div
                  className="border flex flex-col"
                  style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}
                >
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}
                  >
                    <TerminalDot color="#34d399" />
                    <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                      DOMAIN EXPIRATION MONITORING
                    </span>
                    <Globe className="ml-auto h-3.5 w-3.5 opacity-30" />
                  </div>

                  <div className="overflow-x-auto">
                    {loadingDomains ? (
                      <div className="flex items-center justify-center py-10 gap-2">
                        <div className="w-3 h-3 border-t border-current rounded-full animate-spin" />
                        <span className="text-[9px] uppercase tracking-widest opacity-30">SCANNING REGISTRARS...</span>
                      </div>
                    ) : domains.length === 0 ? (
                      <div className="flex items-center justify-center py-10">
                        <span className="text-[9px] uppercase tracking-widest opacity-20">NO DOMAIN DATA FOUND</span>
                      </div>
                    ) : (
                      <table className="w-full border-collapse" style={{ minWidth: "600px" }}>
                        <thead>
                          <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                            <THead>Domain</THead>
                            <THead>Registrar</THead>
                            <THead>Status</THead>
                            <THead>Expiration</THead>
                            <THead>Time Left</THead>
                          </tr>
                        </thead>
                        <tbody>
                          {domains.slice(0, 5).map((item, idx) => {
                            const diffDays = Math.ceil((new Date(item.expires).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                            const isUrgent = diffDays <= 30;
                            const isCritical = diffDays <= 14;

                            return (
                              <tr
                                key={item.domain}
                                style={{
                                  backgroundColor: idx % 2 === 0
                                    ? "transparent"
                                    : "rgba(255,255,255,0.012)",
                                }}
                              >
                                <TCell>
                                  <span className="font-bold text-white/80">{item.domain}</span>
                                </TCell>
                                <TCell>
                                  <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-white/10 bg-white/5">
                                    {item.source}
                                  </span>
                                </TCell>
                                <TCell>
                                  <span
                                    className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border"
                                    style={{
                                      color: item.status.toLowerCase() === "active" ? "#34d399" : "#f87171",
                                      borderColor: item.status.toLowerCase() === "active" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)",
                                      backgroundColor: item.status.toLowerCase() === "active" ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)",
                                    }}
                                  >
                                    {item.status}
                                  </span>
                                </TCell>
                                <TCell mono>
                                  {new Date(item.expires).toLocaleDateString(undefined, {
                                    year: "numeric", month: "short", day: "numeric",
                                  })}
                                </TCell>
                                <TCell>
                                  <span 
                                    className="font-mono font-bold"
                                    style={{ color: isCritical ? "#f87171" : isUrgent ? "#fbbf24" : "inherit" }}
                                  >
                                    {diffDays} DAYS
                                  </span>
                                </TCell>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* ── Charts row ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AssetCard
                    chartData={assetTypeChartData}
                    title="Asset Types Distribution"
                    description="Based on asset_type counts"
                  />
                  <BrandCard
                    chartData={brandChartData}
                    title="Brand Distribution"
                    description="Based on brand counts"
                  />
                </div>

                {/* ── Location distribution ── */}
                <div
                  className="border flex flex-col"
                  style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}
                >
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}
                  >
                    <TerminalDot color="#fbbf24" />
                    <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                      LOCATION DISTRIBUTION
                    </span>
                    <span
                      className="ml-auto text-[9px] font-mono px-2 py-0.5 border"
                      style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.06)" }}
                    >
                      {Object.keys(locationCounts).length} LOCATIONS
                    </span>
                  </div>

                  {Object.keys(locationCounts).length === 0 ? (
                    <div className="flex items-center justify-center py-10">
                      <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                        NO LOCATION DATA
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                      {Object.entries(locationCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([location, count]) => (
                          <div
                            key={location}
                            className="flex items-center justify-between px-3 py-2 border"
                            style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.01)" }}
                          >
                            <span className="text-[10px] truncate pr-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                              {location || "—"}
                            </span>
                            <span
                              className="text-[10px] font-mono font-bold shrink-0 px-2 py-0.5 border"
                              style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.25)", backgroundColor: "rgba(251,191,36,0.06)" }}
                            >
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* ── Expired warranty table ── */}
                <div
                  className="border flex flex-col"
                  style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}
                >
                  {/* Panel header */}
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}
                  >
                    <TerminalDot color="#f87171" />
                    <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                      OUT OF WARRANTY / EXPIRED
                    </span>
                    <span
                      className="ml-auto text-[9px] font-mono px-2 py-0.5 border"
                      style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.06)" }}
                    >
                      {filteredExpired.length} / {expiredWarranties.length} ITEMS
                    </span>
                  </div>

                  {/* Search bar */}
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.05)", backgroundColor: "rgba(0,0,0,0.15)" }}
                  >
                    <span className="text-[10px] font-mono select-none" style={{ color: "rgba(255,255,255,0.25)" }}>›</span>
                    <input
                      type="search"
                      placeholder="SEARCH EXPIRED..."
                      value={warrantySearch}
                      onChange={(e) => setWarrantySearch(e.target.value)}
                      className="flex-1 bg-transparent outline-none text-[10px] font-mono uppercase tracking-widest placeholder:opacity-30"
                      style={{ color: "rgba(255,255,255,0.6)" }}
                    />
                    {warrantySearch && (
                      <button
                        onClick={() => setWarrantySearch("")}
                        className="text-[9px] font-mono uppercase tracking-widest"
                        style={{ color: "rgba(255,255,255,0.25)" }}
                      >
                        CLEAR
                      </button>
                    )}
                  </div>

                  {/* Table */}
                  {expiredWarranties.length === 0 ? (
                    <div className="flex items-center justify-center py-10">
                      <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                        NO EXPIRED WARRANTIES
                      </span>
                    </div>
                  ) : filteredExpired.length === 0 ? (
                    <div className="flex items-center justify-center py-10">
                      <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                        NO RESULTS FOR "{warrantySearch.toUpperCase()}"
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse" style={{ minWidth: "700px" }}>
                          <thead>
                            <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                              <THead>Asset Tag</THead>
                              <THead>Type</THead>
                              <THead>Brand</THead>
                              <THead>Model</THead>
                              <THead>Warranty Date</THead>
                              <THead>Status</THead>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredExpired.slice(0, warrantyDisplayLimit).map((item, idx) => (
                              <tr
                                key={item.id}
                                style={{
                                  backgroundColor: idx % 2 === 0
                                    ? "transparent"
                                    : "rgba(255,255,255,0.012)",
                                }}
                              >
                                <TCell mono>{item.asset_tag}</TCell>
                                <TCell>{item.asset_type}</TCell>
                                <TCell>{item.brand}</TCell>
                                <TCell>{item.model}</TCell>
                                <TCell mono>
                                  {item.warranty_date
                                    ? new Date(item.warranty_date).toLocaleDateString(undefined, {
                                        year: "numeric", month: "short", day: "numeric",
                                      })
                                    : undefined}
                                </TCell>
                                <td
                                  className="px-3 py-2.5 whitespace-nowrap"
                                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                                >
                                  <span
                                    className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border font-mono"
                                    style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.08)" }}
                                  >
                                    EXPIRED
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Load more / footer */}
                      <div
                        className="flex items-center justify-between px-4 py-2.5 border-t"
                        style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.2)" }}
                      >
                        <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                          SHOWING {Math.min(warrantyDisplayLimit, filteredExpired.length)} OF {filteredExpired.length}
                        </span>
                        {warrantyDisplayLimit < filteredExpired.length && (
                          <button
                            onClick={() => setWarrantyDisplayLimit((prev) => prev + 10)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer"
                            style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.05)" }}
                          >
                            LOAD MORE (+10)
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
