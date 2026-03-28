"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendSubmitting, setResendSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams?.get("verified") === "1") {
      setInfo("邮箱已验证，请使用密码登录。");
    } else if (searchParams?.get("dev") === "1") {
      setInfo("本地开发环境已自动通过邮箱验证，请直接登录。");
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setShowResend(false);
    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const result = (await response.json()) as { code: string; message?: string };
      if (!response.ok) {
        setError(result.message ?? "登录失败，请检查账号密码");
        setShowResend(result.code === "EMAIL_NOT_VERIFIED");
        return;
      }
      const nextPath = searchParams?.get("next");
      router.push(nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResendSubmitting(true);
    try {
      const response = await fetch("/api/v1/auth/resend-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const result = (await response.json()) as { code: string; message?: string };
      if (!response.ok) {
        setError(result.message ?? "重发失败，请稍后重试");
        return;
      }
      setInfo("若该邮箱有待验证账户，我们已重新发送验证邮件，请查收。");
      setShowResend(false);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setResendSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>登录账户</h1>
        <p>登录后可访问项目中心、投标管理与钱包模块。</p>
        {info ? <div className="form-success">{info}</div> : null}
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            邮箱
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少8位"
              required
              minLength={8}
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          {showResend ? (
            <div className="auth-resend-block">
              <button
                type="button"
                className="btn btn-secondary auth-submit-btn"
                disabled={resendSubmitting || !email.trim()}
                onClick={() => void handleResend()}
              >
                {resendSubmitting ? "发送中…" : "重发验证邮件"}
              </button>
            </div>
          ) : null}
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={submitting}>
            {submitting ? "登录中..." : "登录"}
          </button>
        </form>
        <div className="auth-footer">
          <span>还没有账户？</span>
          <Link href="/register">去注册</Link>
        </div>
        <div className="auth-footer">
          <span>忘记密码？</span>
          <Link href="/forgot-password">去重置</Link>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-page"><section className="auth-card"><h1>登录账户</h1><p>加载中...</p></section></main>}>
      <LoginClient />
    </Suspense>
  );
}
