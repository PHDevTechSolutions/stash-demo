"use client"

import * as React from "react"
import Image from "next/image"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

export function TeamSwitcher({

}: {
  }) {
  const [activeTeam] = React.useState([0])

  if (!activeTeam) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton className="w-full pt-8 pb-8">
          <div className="flex items-center space-x-3">
            <Image
              src="/asset.jpg"
              alt="Stash"
              width={40}
              height={40}
              className="rounded-md object-contain"
              priority
            />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Stash</span>
              <span className="truncate text-xs text-muted-foreground">
                IT Asset Inventory System
              </span>
            </div>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
