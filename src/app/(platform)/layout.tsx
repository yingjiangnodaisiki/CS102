import Link from "next/link";
import { PlatformAuthActions } from "./PlatformAuthActions";

const navItems: Array<{ href: string; label: string }> = [
  { href: "/dashboard", label: "总览面板" },
  { href: "/admin", label: "管理中心" },
  { href: "/profile", label: "用户主页" },
  { href: "/projects", label: "项目中心" },
  { href: "/bids", label: "投标管理" },
  { href: "/wallet", label: "资金账户" },
  { href: "/messages", label: "消息中心" },
  { href: "/workspace", label: "工作区" }
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="platform-shell">
      <aside className="platform-sidebar">
        <div className="platform-brand">
          <span className="platform-brand-mark">AI</span>
          <div>
            <strong>AI Dev Platform</strong>
            <p>平台工作台</p>
          </div>
        </div>
        <nav className="platform-nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <PlatformAuthActions />
      </aside>
      <section className="platform-content">{children}</section>
    </div>
  );
}
