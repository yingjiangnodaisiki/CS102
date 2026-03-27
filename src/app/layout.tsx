import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI开发者平台",
  description: "去中心化 AI 项目撮合平台"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
