"use client";

import * as React from "react";
import {
  Settings,
  PhoneCall,
  FolderKanban,
  Clock,
  FolderCheck,
  Cog,
  Gauge,
  Package,
  ClipboardList,
  Trash2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

import { NavFavorites } from "@/components/nav/favorites";
import { NavSecondary } from "@/components/nav/secondary";
import { NavWorkspaces } from "@/components/nav/workspaces";
import { TeamSwitcher } from "@/components/nav/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

const data = {
  navSecondary: [
    { title: "Settings", url: "/settings", icon: Settings },
  ],

  favorites: [
    {
      name: "Dashboard",
      url: "/dashboard",
      icon: Gauge,
      isActive: true,
    },
  ],

  workspaces: [
    {
      name: "Asset Management",
      icon: FolderKanban,
      pages: [
        { name: "Inventory", url: "/asset/inventory", icon: Package },
        { name: "Assign Assets", url: "/asset/assign", icon: ClipboardList },
        { name: "Disposal", url: "/asset/disposal", icon: Trash2 },
        { name: "Subscriptions", url: "/asset/license", icon: KeyRound },
        { name: "Warranty", url: "/asset/warranty", icon: ShieldCheck },
      ],
    },

    {
      name: "Maintenance",
      icon: Cog,
      pages: [
        {
          name: "Maintenance, Audit & History Logs",
          url: "/maintenance",
          icon: PhoneCall,
        },
      ],
    },

    {
      name: "Audit Logs",
      icon: FolderCheck,
      pages: [
        {
          name: "Audit Logs",
          url: "/taskflow/audit-logs",
          icon: FolderCheck,
        },
      ],
    },

    {
      name: "History Logs",
      icon: Clock,
      pages: [
        {
          name: "History Logs",
          url: "/taskflow/history-logs",
          icon: Clock,
        },
      ],
    },
  ],
};

export function SidebarLeft(props: React.ComponentProps<typeof Sidebar>) {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(
    {}
  );

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUserId(params.get("id"));
  }, []);

  const withUserId = React.useCallback(
    (url: string) => {
      if (!userId || !url || url === "#") return url;
      return url.includes("?")
        ? `${url}&id=${encodeURIComponent(userId)}`
        : `${url}?id=${encodeURIComponent(userId)}`;
    },
    [userId]
  );

  const workspacesWithId = React.useMemo(
    () =>
      data.workspaces.map((workspace) => ({
        ...workspace,
        pages: workspace.pages.map((page) => ({
          ...page,
          url: withUserId(page.url),
        })),
      })),
    [withUserId]
  );

  const favoritesWithId = React.useMemo(
    () =>
      data.favorites.map((fav) => ({
        ...fav,
        url: withUserId(fav.url),
      })),
    [withUserId]
  );

  const navSecondaryWithId = React.useMemo(
    () =>
      data.navSecondary.map((item) => ({
        ...item,
        url: withUserId(item.url),
      })),
    [withUserId]
  );

  const handleToggle = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>

      <SidebarContent>
        <NavFavorites favorites={favoritesWithId} />
        <NavWorkspaces
          workspaces={workspacesWithId}
          openSections={openSections}
          onToggleSection={handleToggle}
        />
        <NavSecondary items={navSecondaryWithId} className="mt-auto" />
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
