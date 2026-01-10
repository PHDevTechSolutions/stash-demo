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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemHeader,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";

import { StatusCard } from "@/components/dashboard-card-status";
import { AssetCard } from "@/components/dashboard-card-asset_type";
import { BrandCard } from "@/components/dashboard-card-brand";

interface InventoryItem {
  id: string; // supabase id
  status: string;
  asset_tag: string;
  asset_type: string;
  model: string;
  brand: string;
  location: string;
  date_created?: string;
  warranty_date: string;
}

interface UserDetails {
  referenceid: string;
}

function DashboardContent() {
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<
    DateRange | undefined
  >(undefined);

  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [activities, setActivities] = useState<InventoryItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);

  const [loadingUser, setLoadingUser] = useState(true);
  const [errorUser, setErrorUser] = useState<string | null>(null);

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
  });

  // Get userId from URL query param
  const queryUserId = searchParams?.get("id") ?? "";

  // Sync context with URL param on mount or param change
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // Fetch user details when userId changes
  useEffect(() => {
    if (!userId) {
      setErrorUser("User ID is missing.");
      setLoadingUser(false);
      return;
    }

    const fetchUserData = async () => {
      setErrorUser(null);
      setLoadingUser(true);
      try {
        const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();

        setUserDetails({
          referenceid: data.ReferenceID || "",
        });

        toast.success("User data loaded successfully!");
      } catch (err) {
        console.error("Error fetching user data:", err);
        setErrorUser(
          "Failed to connect to server. Please try again later or check your network connection."
        );
        toast.error(
          "Failed to connect to server. Please try again later or refresh your network connection"
        );
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  // Use referenceid from fetched userDetails (not directly from URL)
  const referenceid = userDetails.referenceid;

  // Fetch activities
  const fetchActivities = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      return;
    }
    setLoadingActivities(true);
    setErrorActivities(null);

    fetch(`/api/fetch-inventory?referenceid=${encodeURIComponent(referenceid)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => {
        const items: InventoryItem[] = data.data || [];
        setActivities(items);
      })
      .catch((err) => setErrorActivities(err.message))
      .finally(() => setLoadingActivities(false));
  }, [referenceid]);

  useEffect(() => {
    fetchActivities();

    if (!referenceid) return;

    // Supabase realtime subscription
    const channel = supabase
      .channel(`inventory-${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory",
          filter: `referenceid=eq.${referenceid}`,
        },
        (payload) => {
          const newRecord = payload.new as InventoryItem;
          const oldRecord = payload.old as InventoryItem;

          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT":
                if (!curr.some((a) => a.id === newRecord.id)) {
                  return [...curr, newRecord];
                }
                return curr;
              case "UPDATE":
                return curr.map((a) => (a.id === newRecord.id ? newRecord : a));
              case "DELETE":
                return curr.filter((a) => a.id !== oldRecord.id);
              default:
                return curr;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [referenceid, fetchActivities]);

  // Count items by status
  const counts = React.useMemo(() => {
    const normalize = (status?: string) => status?.toLowerCase() ?? "";

    const countSpare = activities.filter(
      (item) => normalize(item.status) === "spare"
    ).length;

    const countDeploy = activities.filter(
      (item) => normalize(item.status) === "deployed"
    ).length;

    const countMissing = activities.filter(
      (item) => normalize(item.status) === "missing"
    ).length;

    const countDispose = activities.filter(
      (item) => normalize(item.status) === "dispose"
    ).length;

    const countLend = activities.filter(
      (item) => normalize(item.status) === "lend"
    ).length;

    const countDefective = activities.filter(
      (item) => normalize(item.status) === "defective"
    ).length;

    return {
      spare: countSpare,
      deployed: countDeploy,
      missing: countMissing,
      dispose: countDispose,
      lend: countLend,
      defective: countDefective,
    };
  }, [activities]);

  // Count asset_type occurrences for first chart
  const assetTypeCounts: Record<string, number> = {};
  activities.forEach(({ asset_type }) => {
    assetTypeCounts[asset_type] = (assetTypeCounts[asset_type] ?? 0) + 1;
  });
  const assetTypeChartData = Object.entries(assetTypeCounts).map(([month, desktop]) => ({
    month,
    desktop,
  }));

  // Count brand occurrences for second chart
  const brandCounts: Record<string, number> = {};
  activities.forEach(({ brand }) => {
    brandCounts[brand] = (brandCounts[brand] ?? 0) + 1;
  });
  const brandChartData = Object.entries(brandCounts).map(([month, desktop]) => ({
    month,
    desktop,
  }));

  const locationCounts: Record<string, number> = {};
  activities.forEach(({ location }) => {
    locationCounts[location] = (locationCounts[location] ?? 0) + 1;
  });

  const expiredWarranties = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return activities.filter((item) => {
      if (!item.warranty_date) return false;

      const warrantyDate = new Date(item.warranty_date);
      warrantyDate.setHours(0, 0, 0, 0);

      return warrantyDate < today; // expired if warranty date is before today
    });
  }, [activities]);




  return (
    <>
      <SidebarLeft />
      <SidebarInset>
        <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="line-clamp-1">Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <main className="flex flex-col gap-4 p-4 overflow-auto">
          {loadingUser ? (
            <p>Loading user data...</p>
          ) : errorUser ? (
            <p className="text-red-600 font-semibold">{errorUser}</p>
          ) : (
            <>
              {loadingActivities && <p>Loading activities...</p>}
              {errorActivities && <p className="text-red-600 font-semibold">{errorActivities}</p>}

              <div className="flex flex-col gap-4">
                <StatusCard counts={counts} userId={userId ?? undefined} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Asset Types Distribution */}
                <AssetCard
                  chartData={assetTypeChartData}
                  title="Asset Types Distribution"
                  description="Based on asset_type counts"
                />

                {/* Brand Distribution */}
                <BrandCard
                  chartData={brandChartData}
                  title="Brand Distribution"
                  description="Based on brand counts"
                />

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Location Distribution</CardTitle>
                    <CardDescription>Count of items grouped by location</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      {Object.entries(locationCounts).map(([location, count]) => (
                        <Item key={location}>
                          <Separator />
                          <ItemContent>
                            <div className="flex justify-between items-center w-full">
                              <ItemTitle className="flex-1 text-left">{location}</ItemTitle>
                              <ItemDescription className="flex-none">
                                <Badge className="h-8 min-w-[2rem] rounded-full px-2 font-mono tabular-nums">{count}</Badge>
                              </ItemDescription>
                            </div>
                          </ItemContent>
                        </Item>
                      ))}
                      {Object.keys(locationCounts).length === 0 && (
                        <p className="text-muted-foreground">No location data available.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Out of Warranty / Expired Items</CardTitle>
                    <CardDescription>Items with expired warranty dates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {expiredWarranties.length === 0 ? (
                      <p className="text-muted-foreground">No expired warranty items.</p>
                    ) : (
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Asset Tag</TableHead>
                            <TableHead>Asset Type</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Warranty Date</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expiredWarranties.map((item) => (
                            <TableRow key={item.id} className="odd:bg-white even:bg-gray-50">
                              <TableCell>{item.asset_tag || "-"}</TableCell>
                              <TableCell>{item.asset_type || "-"}</TableCell>
                              <TableCell>{item.brand || "-"}</TableCell>
                              <TableCell>{item.model || "-"}</TableCell>
                              <TableCell>
                                {item.warranty_date
                                  ? new Date(item.warranty_date).toLocaleDateString()
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="destructive" className="capitalize">
                                  Expired
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

              </div>
            </>
          )}
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
            <DashboardContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
