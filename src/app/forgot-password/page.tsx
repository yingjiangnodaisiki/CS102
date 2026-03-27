"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugResetUrl, setDebugResetUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setDebugResetUrl(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const result = (await response.json()) as {
        message?: string;
        data?: { resetUrl?: string };
      };
      if (!response.ok) {
        setError(result.message ?? "提交失败，请检查邮箱格式");
        return;
      }
      setSuccess("如该邮箱已注册，重置链接已发送。");
      if (result.data?.resetUrl) {
        setDebugResetUrl(result.data.resetUrl);
      }
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>忘记密码</h1>
        <p>输入注册邮箱，我们将发送密码重置链接。</p>
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
          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}
          {debugResetUrl ? (
            <div className="form-success">
              开发环境调试链接：
              <a href={debugResetUrl} style={{ marginLeft: 6 }}>
                去重置
              </a>
            </div>
          ) : null}
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={submitting}>
            {submitting ? "提交中..." : "发送重置链接"}
          </button>
        </form>
        <div className="auth-footer">
          <span>想起密码了？</span>
          <Link href="/login">返回登录</Link>
        </div>
      </section>
    </main>
  );
}
