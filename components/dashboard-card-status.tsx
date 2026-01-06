"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface StatusCardProps {
  counts: Record<string, number>;
  userId?: string;
}

export function StatusCard({ counts, userId }: StatusCardProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {["Spare", "Deploy", "Missing", "Dispose"].map((status) => (
        <Card key={status} className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{status}</CardTitle>
          </CardHeader>

          <CardContent className="flex items-center justify-between font-semibold">
            <span>
              {counts[status as keyof typeof counts] === 0
                ? "No items"
                : `Total ${counts[status as keyof typeof counts]} items`}
            </span>

            <Badge className="h-8 min-w-[2rem] rounded-full px-2 font-mono tabular-nums">
              {counts[status as keyof typeof counts]}
            </Badge>
          </CardContent>
          <Separator />
          <CardFooter className="flex justify-end gap-2">
            {status === "Spare" && (
              <Button variant="outline" asChild>
                <a href={`/asset/inventory?id=${encodeURIComponent(userId ?? "")}`}>
                  View Spare
                </a>
              </Button>
            )}
            {status === "Deploy" && (
              <Button variant="outline" asChild>
                <a href={`/asset/inventory?id=${encodeURIComponent(userId ?? "")}`}>
                  View Deploy
                </a>
              </Button>
            )}
            {status === "Missing" && (
              <Button variant="outline" asChild>
                <a href={`/asset/inventory?id=${encodeURIComponent(userId ?? "")}`}>
                  View Missing
                </a>
              </Button>
            )}
            {status === "Dispose" && (
              <Button variant="outline" asChild>
                <a href={`/asset/disposal?id=${encodeURIComponent(userId ?? "")}`}>
                  View Dispose
                </a>
              </Button>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
