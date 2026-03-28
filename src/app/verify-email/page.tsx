"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "err">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams?.get("token")?.trim();
    if (!token) {
      setStatus("err");
      setMessage("链接无效：缺少验证参数。请从注册邮件中打开完整链接。");
      return;
    }

    let cancelled = false;
    let redirectTimer: number | undefined;

    void (async () => {
      try {
        const response = await fetch("/api/v1/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        const result = (await response.json()) as { code?: string; message?: string };
        if (cancelled) {
          return;
        }
        if (!response.ok || result.code !== "SUCCESS") {
          setStatus("err");
          setMessage(result.message ?? "验证失败，请重试或申请重发邮件");
          return;
        }
        setStatus("ok");
        setMessage(null);
        redirectTimer = window.setTimeout(() => {
          if (!cancelled) {
            router.push("/login?verified=1");
          }
        }, 2000);
      } catch {
        if (!cancelled) {
          setStatus("err");
          setMessage("网络异常，请稍后重试");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (redirectTimer !== undefined) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [router, searchParams]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>邮箱验证</h1>
        {status === "loading" ? <p>正在验证，请稍候…</p> : null}
        {status === "ok" ? (
          <p>验证成功，即将跳转到登录页。若未跳转，请手动前往登录。</p>
        ) : null}
        {status === "err" && message ? <div className="form-error">{message}</div> : null}
        <div className="auth-footer">
          <Link href="/login">去登录</Link>
          <span> · </span>
          <Link href="/register">返回注册</Link>
        </div>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <section className="auth-card">
            <h1>邮箱验证</h1>
            <p>加载中…</p>
          </section>
        </main>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
