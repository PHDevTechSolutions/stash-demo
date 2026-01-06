"use client";

import * as React from "react";
import { Settings, PhoneCall, FolderKanban, Clock, FolderCheck, Cog, Gauge, } from "lucide-react";

import { NavFavorites } from "@/components/nav/favorites";
import { NavSecondary } from "@/components/nav/secondary";
import { NavWorkspaces } from "@/components/nav/workspaces";
import { TeamSwitcher } from "@/components/nav/team-switcher";
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail, } from "@/components/ui/sidebar";

const initialUserDetails = {
  Firstname: "Itams",
  Lastname: "IT",
  Email: "itams@disruptivesolutions.com",
  Department: "disruptivesolutions.com",
  Location: "Philippines",
  Role: "Admin",
  Position: "",
  Company: "Disruptive Solutions Inc",
  Status: "None",
  profilePicture: "",
  ReferenceID: "",
};

const data = {
  navSecondary: [{ title: "Settings", url: "/settings", icon: Settings }],
  favorites: [{ name: "Dashboard", url: "/dashboard", icon: Gauge, isActive: true }],
  workspaces: [
    {
      name: "Asset Management",
      icon: FolderKanban,
      // Remove icons here from pages
      pages: [
        { name: "Inventory", url: "/asset/inventory" },
        { name: "Assign Assets", url: "/asset/assign" },
        { name: "Disposal", url: "/asset/disposal" },
        { name: "License", url: "/asset/license" },
        { name: "Warranty", url: "/asset/warranty" },
      ],
    },
    {
      // Combine Maintenance, Audit Logs, History Logs into one single item (no submenu, no caret)
      name: "Maintenance",
      icon: Cog,
      // Single page, no nested pages or caret
      pages: [
        {
          name: "Maintenance, Audit & History Logs",
          url: "/taskflow/obc",
          icon: PhoneCall,
        },
      ],
    },
    {
      name: "Audit Logs",
      icon: FolderCheck,
      pages: [{ name: "Audit Logs", url: "/taskflow/audit-logs" }],
    },
    {
      name: "History Logs",
      icon: Clock,
      pages: [{ name: "History Logs", url: "/taskflow/history-logs" }],
    },
  ],
};

export function SidebarLeft(props: React.ComponentProps<typeof Sidebar>) {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [userDetails, setUserDetails] = React.useState(initialUserDetails);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(
    {}
  );

  React.useEffect(() => {
    const saved = localStorage.getItem("sidebarOpenSections");
    if (saved) setOpenSections(JSON.parse(saved));
  }, []);

  React.useEffect(() => {
    localStorage.setItem("sidebarOpenSections", JSON.stringify(openSections));
  }, [openSections]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUserId(params.get("id"));
  }, []);

  React.useEffect(() => {
    if (!userId) return;

    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data) => {
        setUserDetails((prev) => ({
          ...prev,
          ...data,
        }));
      })
      .catch((err) => console.error("Failed to fetch user details:", err));
  }, [userId]);

  const handleToggle = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

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
          // Remove icon for Asset Management pages only
          ...(workspace.name === "Asset Management" ? { icon: undefined } : {}),
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
    () => data.navSecondary.map((item) => ({ ...item, url: withUserId(item.url) })),
    [withUserId]
  );

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
