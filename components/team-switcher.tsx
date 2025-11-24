"use client"

import * as React from "react"
import Image from "next/image"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    plan: string
  }[]
}) {
  const [activeTeam] = React.useState(teams[0])

  if (!activeTeam) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton className="w-full px-2 py-1.5">
          <div className="flex items-center mr-2">
            <Image
              src="/Taskflow.png"
              alt="Taskflow Logo"
              width={28}
              height={28}
              className="rounded-sm"
            />
          </div>
          <span className="truncate font-medium">{activeTeam.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
