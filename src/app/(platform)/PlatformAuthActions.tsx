"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface MeData {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
  avatarUrl?: string | null;
}

export function PlatformAuthActions() {
  const router = useRouter();
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  const normalizeAvatarUrl = (input?: string | null): string | null => {
    if (!input) {
      return null;
    }
    if (input.startsWith("/") || input.startsWith("http")) {
      return input;
    }
    return `/${input}`;
  };

  useEffect(() => {
    const run = async () => {
      try {
        const meResponse = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (!meResponse.ok) {
          setMe(null);
          return;
        }
        const meResult = (await meResponse.json()) as { data: MeData };
        const profileResponse = await fetch("/api/v1/profile/me", { credentials: "include" });
        if (!profileResponse.ok) {
          setMe(meResult.data);
          return;
        }
        const profileResult = (await profileResponse.json()) as { data?: { avatarUrl?: string | null } };
        setMe({
          ...meResult.data,
          avatarUrl: normalizeAvatarUrl(profileResult.data?.avatarUrl ?? null)
        });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return <div className="platform-auth-actions loading">账户状态加载中...</div>;
  }

  if (!me) {
    return (
      <div className="platform-auth-actions">
        <Link href="/login">登录</Link>
        <Link href="/register">注册</Link>
      </div>
    );
  }

  return (
    <div className="platform-auth-actions">
      <div className="mini-profile-head">
        {me.avatarUrl ? <img src={me.avatarUrl} alt="avatar" /> : <span>{me.role.slice(0, 1)}</span>}
        <small>{me.userId.slice(0, 8)}...</small>
      </div>
      <Link href="/profile">我的资料</Link>
      <button type="button" onClick={handleLogout}>
        退出登录
      </button>
    </div>
  );
}
