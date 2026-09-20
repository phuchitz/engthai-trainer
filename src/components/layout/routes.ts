import type { Route } from "next";

export type NavItem = {
  href: Route;
  label: string;
  labelTh: string;
  /** Shown in the compact bottom bar on small screens. */
  primary: boolean;
  /** Single-path stroke icon, drawn on a 24x24 viewBox. */
  icon: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    labelTh: "ภาพรวม",
    primary: true,
    icon: "M3 13h6V3H3v10Zm0 8h6v-6H3v6Zm12 0h6V11h-6v10Zm0-18v6h6V3h-6Z",
  },
  {
    href: "/lessons",
    label: "Lessons",
    labelTh: "บทเรียน",
    primary: true,
    icon: "M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM19 18v3H6.5A2.5 2.5 0 0 1 4 18.5",
  },
  {
    href: "/review",
    label: "Review",
    labelTh: "ทบทวน",
    primary: true,
    icon: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  },
  {
    href: "/vocabulary",
    label: "Vocabulary",
    labelTh: "คำศัพท์",
    primary: true,
    icon: "m11 4 8 8-7 7-8-8V4h7Zm-3.5 3.5h.01",
  },
  {
    href: "/settings",
    label: "Settings",
    labelTh: "ตั้งค่า",
    primary: true,
    icon: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.5 1Z",
  },
  {
    href: "/learn",
    label: "Learn",
    labelTh: "เรียน",
    primary: false,
    icon: "M12 3 2 8l10 5 10-5-10-5Zm-6 8v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5",
  },
  {
    href: "/data",
    label: "Import / Export",
    labelTh: "นำเข้า / ส่งออก",
    primary: false,
    icon: "M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  },
];
