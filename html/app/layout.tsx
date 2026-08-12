import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "弈思五子棋教练",
  description: "使用 Rapfi 本地引擎进行候选着法、局面评分和主变化分析的五子棋教练。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
