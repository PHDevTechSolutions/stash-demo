"use client";

import * as React from "react";
import { Bot, LayoutDashboard, Mail, CalendarDays, Settings, Trash, HelpCircle, } from "lucide-react";

import { NavFavorites } from "@/components/nav-favorites";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavWorkspaces } from "@/components/nav-workspaces";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

// Dummy getMenuItems function - replace or import your actual function
function getMenuItems(userId: string | null) {
  return [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Ask AI", url: "#", icon: Bot },
    { title: "Inbox", url: "#", icon: Mail, badge: "5" },
  ];
}

const data = {
  teams: [
    {
      name: "Taskflow",
      plan: "Enterprise",
    },
  ],
  navMain: [
    { title: "Ask AI", url: "#", icon: Bot },
    { title: "Dashboard", url: "#", icon: LayoutDashboard, isActive: true },
    { title: "Inbox", url: "#", icon: Mail, badge: "5" },
  ],
  navSecondary: [
    { title: "Calendar", url: "#", icon: CalendarDays },
    { title: "Settings", url: "/settings", icon: Settings },
    { title: "Trash", url: "#", icon: Trash },
    { title: "Help & Support", url: "#", icon: HelpCircle },
  ],
  favorites: [
    { name: "Sales Performance", url: "#", emoji: "📊" },
    { name: "National Call Ranking", url: "#", emoji: "📞" },
  ],
  workspaces: [
    {
      name: "Customer Database",
      emoji: "🏠",
      pages: [
        { name: "All", url: "/companies/all", emoji: "📗" }, // For TSM and Manager
        { name: "Active", url: "/companies/active", emoji: "📗" },
        { name: "New Client", url: "/companies/newclient", emoji: "🆕" },
        { name: "Non-Buying", url: "/companies/nonbuying", emoji: "🚫" },
        { name: "Inactive", url: "/companies/inactive", emoji: "🕓" },
        { name: "Deletion", url: "/companies/remove", emoji: "🗑️" },
        { name: "Follow Ups", url: "/companies/followup", emoji: "🔁" },
        { name: "Group Affiliate", url: "/companies/group", emoji: "👥" },
        { name: "Pending Accounts", url: "/companies/pending", emoji: "🔁" }, // For TSM and Manager
        { name: "Pending Transferred", url: "/companies/transfer", emoji: "🔁" }, // For TSM and Manager
        { name: "Account Deletion", url: "/companies/approval", emoji: "🗑️" }, // For TSM and Manager
      ],
    },
    {
      name: "Work Management",
      emoji: "💼",
      pages: [
        { name: "Activity Planner", url: "/activity/planner", emoji: "🎯" },
        { name: "Manual Task", url: "#", emoji: "✍️" },
        { name: "Notes", url: "#", emoji: "📝" },
        { name: "Quotation", url: "#", emoji: "💬" },
        { name: "Client Coverage Guide", url: "#", emoji: "🧭" },
      ],
    },
    {
      name: "Reports",
      emoji: "📊",
      pages: [
        { name: "Account Management", url: "#", emoji: "💰" },
        { name: "Quotation Summary", url: "#", emoji: "📑" },
        { name: "Sales Order Summary", url: "#", emoji: "🛒" },
        { name: "Pending Sales Order", url: "#", emoji: "⏳" },
        { name: "Sales Invoice Summary", url: "#", emoji: "📄" },
        { name: "CSR Inquiry Summary", url: "#", emoji: "📞" },
        { name: "New Client Summary", url: "#", emoji: "🌱" },
        { name: "FB Marketplace Summary", url: "#", emoji: "🛍️" },
      ],
    },
    {
      name: "Conversion Rates",
      emoji: "📈",
      pages: [
        { name: "Calls to Quote", url: "#", emoji: "☎️" },
        { name: "Quote To SO", url: "#", emoji: "📑" },
        { name: "SO To SI", url: "#", emoji: "💳" },
        { name: "Calls to SI", url: "#", emoji: "🚀" },
      ],
    },
  ],
};

export function SidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [userDetails, setUserDetails] = React.useState({
    Firstname: "Task",
    Lastname: "Flow",
    Email: "taskflow@ecoshiftcorp.com",
    Department: "ecoshiftcorp.com",
    Location: "Philippines",
    Role: "Admin",
    Position: "",
    Company: "Ecoshift Corporation",
    Status: "None",
    profilePicture: "",
    ReferenceID: "",
  });
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

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
          Firstname: data.Firstname || prev.Firstname,
          Lastname: data.Lastname || prev.Lastname,
          Email: data.Email || prev.Email,
          Department: data.Department || prev.Department,
          Location: data.Location || prev.Location,
          Role: data.Role || prev.Role,
          Position: data.Position || prev.Position,
          Company: data.Company || prev.Company,
          Status: data.Status || prev.Status,
          ReferenceID: data.ReferenceID || prev.ReferenceID,
          profilePicture: data.profilePicture || prev.profilePicture,
        }));
      })
      .catch((err) => console.error(err));
  }, [userId]);

  const handleToggle = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const menuItems = React.useMemo(() => getMenuItems(userId), [userId]);

  const filteredMenuItems = React.useMemo(() => {
    const role = userDetails.Role || "Admin";
    const allowed: Record<string, string[]> = {
      Admin: menuItems.map((m) => m.title),
      "Super Admin": menuItems.map((m) => m.title),
      Manager: [
        "Session Logs",
        "Sales Performance",
        "Conversion Rates",
        "Customer Database",
        "National",
        "My Team",
        "Work Management",
        "Reports",
        "Help Center",
        "What is Taskflow?",
      ],
      "Special Access": [
        "Session Logs",
        "Sales Performance",
        "Conversion Rates",
        "Customer Database",
        "National",
        "My Team",
        "Reports",
        "Help Center",
        "What is Taskflow?",
      ],
      "Territory Sales Manager": [
        "Session Logs",
        "Sales Performance",
        "Conversion Rates",
        "Customer Database",
        "National",
        "Work Management",
        "My Team",
        "Reports",
        "Help Center",
        "What is Taskflow?",
      ],
      "Territory Sales Associate": [
        "Dashboard",
        "Session Logs",
        "Sales Performance",
        "Conversion Rates",
        "Customer Database",
        "National",
        "Work Management",
        "Reports",
        "Help Center",
        "What is Taskflow?",
      ],
    };
    return menuItems.filter((item) => allowed[role]?.includes(item.title));
  }, [menuItems, userDetails]);

  const withUserId = React.useCallback(
    (url: string) => {
      if (!userId) return url;
      if (!url || url === "#") return url;
      return url.includes("?")
        ? `${url}&id=${encodeURIComponent(userId)}`
        : `${url}?id=${encodeURIComponent(userId)}`;
    },
    [userId]
  );

  // Filter pages in Customer Database workspace for TSM and Manager roles
  const filteredWorkspaces = React.useMemo(() => {
    const role = userDetails.Role || "Admin";

    return data.workspaces.map((workspace) => {
      if (workspace.name === "Customer Database") {
        if (role === "Territory Sales Associate") {
          // Exclude "All", "Pending Accounts", "Account Deletion" for T Sales Associate
          return {
            ...workspace,
            pages: workspace.pages.filter(
              (page) =>
                !["All", "Pending Accounts", "Account Deletion", "Pending Transferred"].includes(page.name)
            ),
          };
        } else if (role === "Territory Sales Manager") {
          // For Territory Sales Manager, show ONLY All, Pending Accounts, Account Deletion
          return {
            ...workspace,
            pages: workspace.pages.filter((page) =>
              ["All", "Pending Accounts", "Account Deletion", "Pending Transferred"].includes(page.name)
            ),
          };
        }
        // Other roles, return full workspace (or customize as needed)
      }
      return workspace;
    });
  }, [userDetails.Role]);


  // Append userId to URLs in filtered workspaces
  const workspacesWithId = React.useMemo(
    () =>
      filteredWorkspaces.map((workspace) => ({
        ...workspace,
        pages: workspace.pages.map((page) => ({
          ...page,
          url: withUserId(page.url),
        })),
      })),
    [filteredWorkspaces, withUserId]
  );

  const navMainWithId = React.useMemo(
    () => filteredMenuItems.map((item) => ({ ...item, url: withUserId(item.url || "#") })),
    [filteredMenuItems, withUserId]
  );

  const navSecondaryWithId = React.useMemo(
    () => data.navSecondary.map((item) => ({ ...item, url: withUserId(item.url) })),
    [withUserId]
  );

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
        <NavMain items={navMainWithId} />
      </SidebarHeader>

      <SidebarContent>
        <NavFavorites favorites={data.favorites} />
        <NavWorkspaces workspaces={workspacesWithId} />
        <NavSecondary items={navSecondaryWithId} className="mt-auto" />
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
