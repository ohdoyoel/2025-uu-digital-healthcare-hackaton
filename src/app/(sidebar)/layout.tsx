"use client";

import React, { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  SidebarLogo,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Settings, User, MessageCircle } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface SidebarLinkItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const sidebarLinks: SidebarLinkItem[] = [
  {
    label: "새 대화",
    href: "/chat",
    icon: <MessageCircle className="text-neutral-700 h-6 w-6 flex-shrink-0" />,
  },
  {
    label: "대화 기록",
    href: "/dashboard",
    icon: (
      <LayoutDashboard className="text-neutral-700 h-6 w-6 flex-shrink-0" />
    ),
  },
  {
    label: "설정",
    href: "/settings",
    icon: <Settings className="text-neutral-700 h-6 w-6 flex-shrink-0" />,
  },
];

export default function SidebarLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "rounded-md flex flex-col md:flex-row bg-gray-100 w-full flex-1 mx-auto border border-neutral-200 overflow-hidden",
        "h-screen"
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            <SidebarLogo
              href="/dashboard"
              label="ER:ight?"
              iconClassName="relative h-8 w-6 flex-shrink-0"
              textClassName="font-bold text-black text-xl whitespace-pre"
            />
            <div className="mt-8 flex flex-col gap-2">
              {sidebarLinks.map((link, idx) => (
                <SidebarLink
                  key={idx}
                  link={{
                    ...link,
                  }}
                  className={cn(pathname === link.href && "font-semibold")}
                />
              ))}
            </div>
          </div>
        </SidebarBody>
      </Sidebar>
      <div className="flex flex-1">{children}</div>
    </div>
  );
}
