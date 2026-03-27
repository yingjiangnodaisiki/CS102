"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";

function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const queryToken = useMemo(
    () => searchParams?.get("verificationToken") ?? searchParams?.get("token") ?? "",
    [searchParams]
  );
  const [verificationToken, setVerificationToken] = useState("");
  const [tokenReady, setTokenReady] = useState(false);
  const [tokenChecking, setTokenChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (queryToken) {
      setVerificationToken(queryToken);
      if (typeof window !== "undefined" && window.location.search) {
        window.history.replaceState(null, "", "/reset-password");
      }
    }
  }, [queryToken]);

  useEffect(() => {
    let cancelled = false;
    const verifyToken = async () => {
      setTokenChecking(true);
      setTokenReady(false);
      try {
        const verifyPath = verificationToken
          ? `/api/v1/auth/password/reset/verify?verificationToken=${encodeURIComponent(verificationToken)}`
          : "/api/v1/auth/password/reset/verify";
        const response = await fetch(verifyPath, { method: "GET" });
        const result = (await response.json()) as { message?: string };
        if (!response.ok) {
          if (!cancelled) {
            setError(result.message ?? "重置链接无效或已过期，请重新申请");
          }
          return;
        }
        if (!cancelled) {
          setError(null);
          setTokenReady(true);
        }
      } catch {
        if (!cancelled) {
          setError("网络异常，请稍后重试");
        }
      } finally {
        if (!cancelled) {
          setTokenChecking(false);
        }
      }
    };
    verifyToken();
    return () => {
      cancelled = true;
    };
  }, [verificationToken]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!tokenReady) {
      setError("重置令牌缺失，请重新获取重置链接");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次密码输入不一致");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(verificationToken ? { verificationToken } : {}),
          newPassword: password
        })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "重置失败");
        return;
      }
      setSuccess("密码已重置成功，请使用新密码登录。");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>重置密码</h1>
        <p>请通过邮件链接进入此页面，再输入新密码完成重置。</p>
        {tokenChecking ? <div className="form-success">正在校验链接有效性...</div> : null}
        {!tokenChecking && !tokenReady ? (
          <div className="form-error">
            当前重置链接无效或已过期，请前往
            <Link href="/forgot-password" style={{ marginLeft: 4 }}>
              忘记密码
            </Link>
            重新申请。
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            新密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少8位"
              minLength={8}
              required
            />
          </label>
          <label>
            确认密码
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="再次输入新密码"
              minLength={8}
              required
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}
          <button
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={submitting || tokenChecking || !tokenReady}
          >
            {submitting ? "提交中..." : "确认重置"}
          </button>
        </form>
        <div className="auth-footer">
          <span>返回登录</span>
          <Link href="/login">去登录</Link>
        </div>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="auth-page"><section className="auth-card"><h1>重置密码</h1><p>加载中...</p></section></main>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
