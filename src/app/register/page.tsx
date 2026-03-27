"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type UserRole = "CLIENT" | "DEVELOPER";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("CLIENT");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const profile = useMemo(() => {
    if (role === "CLIENT") {
      return {
        companyName,
        contactName
      };
    }
    return {
      displayName
    };
  }, [role, companyName, contactName, displayName]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          role,
          profile
        })
      });
      const result = (await response.json()) as { code: string; message?: string };
      if (!response.ok) {
        setError(result.message ?? "注册失败，请检查输入");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>创建账户</h1>
        <p>注册后将自动登录，并进入平台工作台。</p>
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
          <label>
            角色
            <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="CLIENT">甲方（发布项目）</option>
              <option value="DEVELOPER">乙方（参与投标）</option>
            </select>
          </label>
          {role === "CLIENT" ? (
            <>
              <label>
                公司名称
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="示例科技有限公司"
                  minLength={2}
                  required
                />
              </label>
              <label>
                联系人
                <input
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="张三"
                  minLength={2}
                  required
                />
              </label>
            </>
          ) : (
            <label>
              显示名称
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="你的开发者昵称"
                minLength={2}
                required
              />
            </label>
          )}
          {error ? <div className="form-error">{error}</div> : null}
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={submitting}>
            {submitting ? "注册中..." : "注册并登录"}
          </button>
        </form>
        <div className="auth-footer">
          <span>已有账户？</span>
          <Link href="/login">去登录</Link>
        </div>
      </section>
    </main>
  );
}
