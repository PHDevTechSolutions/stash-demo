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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";
import { TrendingUp } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";

import { StatusCard } from "@/components/dashboard-card-status";

interface InventoryItem {
  id: string; // supabase id
  status: string;
  asset_type: string;
  brand: string;
  date_created?: string;
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
    const countSpare = activities.filter((item) => item.status === "Spare").length;
    const countDeploy = activities.filter((item) => item.status === "Deploy").length;
    const countMissing = activities.filter((item) => item.status === "Missing").length;
    const countDispose = activities.filter((item) => item.status === "Dispose").length;

    return {
      Spare: countSpare,
      Deploy: countDeploy,
      Missing: countMissing,
      Dispose: countDispose,
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

  // Chart configs
  const chartConfigAssetType = {
    desktop: {
      label: "Assets",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  const chartConfigBrand = {
    desktop: {
      label: "Brand",
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

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
                <Card>
                  <CardHeader>
                    <CardTitle>Asset Types Distribution</CardTitle>
                    <CardDescription>Based on asset_type counts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfigAssetType}>
                      <BarChart
                        accessibilityLayer
                        data={assetTypeChartData}
                        layout="vertical"
                        margin={{ left: -20 }}
                      >
                        <XAxis type="number" dataKey="desktop" hide />
                        <YAxis
                          dataKey="month"
                          type="category"
                          tickLine={false}
                          tickMargin={10}
                          axisLine={false}
                          tickFormatter={(value) => value.slice(0, 10)}
                        />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={5} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-2 text-sm">
                    <div className="flex gap-2 leading-none font-medium">
                      Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="text-muted-foreground leading-none">
                      Showing total assets grouped by type
                    </div>
                  </CardFooter>
                </Card>

                {/* Brand Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Brand Distribution</CardTitle>
                    <CardDescription>Based on brand counts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfigBrand}>
                      <BarChart
                        accessibilityLayer
                        data={brandChartData}
                        margin={{ top: 20 }}
                      >
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          tickMargin={10}
                          axisLine={false}
                          tickFormatter={(value) => value.slice(0, 3)}
                        />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Bar dataKey="desktop" fill="var(--color-brand)" radius={8}>
                          <LabelList
                            position="top"
                            offset={12}
                            className="fill-foreground"
                            fontSize={12}
                          />
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-2 text-sm">
                    <div className="flex gap-2 leading-none font-medium">
                      Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="text-muted-foreground leading-none">
                      Showing total assets grouped by brand
                    </div>
                  </CardFooter>
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
