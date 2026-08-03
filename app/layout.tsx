import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steam 折扣专区 · 打折游戏总览",
  description:
    "实时聚合 Steam 当前所有打折游戏，支持按折扣力度与好评率排序、搜索、筛选与收藏，不错过每一款划算的好游戏。",
  keywords: ["Steam", "折扣", "打折", "特惠", "优惠", "游戏"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
