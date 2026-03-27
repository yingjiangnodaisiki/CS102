"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MeData {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

export function AuthQuickPanel() {
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (!response.ok) {
          setMe(null);
          return;
        }
        const json = (await response.json()) as { data: MeData };
        setMe(json.data);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return <p className="auth-tip">登录状态检测中...</p>;
  }

  if (!me) {
    return (
      <div className="auth-tip">
        <p>当前未登录，部分功能不可用。</p>
        <div className="auth-inline-actions">
          <Link href="/login">去登录</Link>
          <Link href="/register">创建账户</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-tip">
      <p>
        已登录：<strong>{me.role}</strong>（用户ID：{me.userId.slice(0, 8)}...）
      </p>
    </div>
  );
}
