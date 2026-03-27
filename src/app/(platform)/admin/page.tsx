"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface AdminOverviewData {
  metrics: {
    pendingRiskEvents: number;
    pendingReviewCases: number;
    pendingDisputes: number;
    pendingCertifications: number;
    pendingWorkspaceSubmissions: number;
    awardedProjects: number;
  };
  latestRiskEvents: Array<{
    id: string;
    level: string;
    status: string;
    title: string;
  }>;
  latestReviewCases: Array<{
    id: string;
    targetType: string;
    status: string;
    title: string;
  }>;
  latestDisputes: Array<{
    id: string;
    status: string;
    reason: string;
  }>;
  latestWorkspaceSubmissions: Array<{
    id: string;
    status: string;
    title: string;
  }>;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminOverviewData | null>(null);

  const loadOverview = async () => {
    setError(null);
    const response = await fetch("/api/v1/admin/overview", { credentials: "include" });
    const result = (await response.json()) as { code?: string; message?: string; data?: AdminOverviewData };
    if (!response.ok) {
      if (result.code === "FORBIDDEN") {
        setForbidden(true);
        return;
      }
      setError(result.message ?? "加载管理总览失败");
      return;
    }
    setForbidden(false);
    setData(result.data ?? null);
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        await loadOverview();
      } catch {
        setError("网络异常，请稍后重试");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  if (loading) {
    return (
      <main className="platform-page">
        <div className="empty-state">管理中心加载中...</div>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="platform-page">
        <header className="platform-page-header">
          <h1>管理中心</h1>
          <p>当前账号不是管理员，无法访问管理功能。</p>
        </header>
        <div className="empty-state">
          <p>请使用管理员账号登录后重试。</p>
          <Link href="/login" className="btn btn-secondary">
            去登录
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>管理中心</h1>
        <p>按模块独立管理：风控、审核、认证、仲裁。</p>
      </header>

      {error ? <div className="form-error">{error}</div> : null}

      <section className="platform-stats-grid">
        <article className="platform-card">
          <p>待处置风控事件</p>
          <h2>{data?.metrics.pendingRiskEvents ?? 0}</h2>
        </article>
        <article className="platform-card">
          <p>待处理审核单</p>
          <h2>{data?.metrics.pendingReviewCases ?? 0}</h2>
        </article>
        <article className="platform-card">
          <p>待审认证</p>
          <h2>{data?.metrics.pendingCertifications ?? 0}</h2>
        </article>
        <article className="platform-card">
          <p>待处理仲裁</p>
          <h2>{data?.metrics.pendingDisputes ?? 0}</h2>
        </article>
      </section>

      <section className="platform-two-column">
        <article className="platform-panel">
          <h3>模块入口（独立前端）</h3>
          <div className="inline-actions" style={{ marginTop: 10 }}>
            <Link href="/admin/risk-events" className="btn btn-secondary">
              风控事件模块
            </Link>
            <Link href="/admin/reviews" className="btn btn-secondary">
              审核单模块
            </Link>
            <Link href="/admin/certifications" className="btn btn-secondary">
              认证审核模块
            </Link>
            <Link href="/admin/disputes" className="btn btn-secondary">
              仲裁处理模块
            </Link>
            <button type="button" onClick={() => void loadOverview()}>
              刷新总览
            </button>
          </div>
          <p className="small-tip" style={{ marginTop: 10 }}>
            当前中标项目：{data?.metrics.awardedProjects ?? 0}，待审核交付：
            {data?.metrics.pendingWorkspaceSubmissions ?? 0}
          </p>
        </article>
        <article className="platform-panel">
          <h3>后端接口分层（独立后端）</h3>
          <ul>
            <li>风控：`/api/v1/admin/risk-events` + `/api/v1/admin/risk-events/[id]/action`</li>
            <li>审核：`/api/v1/admin/reviews` + `/api/v1/admin/reviews/[id]/resolve`</li>
            <li>认证：`/api/v1/admin/certifications` + `/api/v1/admin/certifications/[id]/resolve`</li>
            <li>仲裁：`/api/v1/admin/disputes` + `/api/v1/admin/disputes/[id]/resolve`</li>
          </ul>
        </article>
      </section>

      <section className="platform-two-column">
        <article className="platform-panel">
          <h3>最新风控/审核</h3>
          {data?.latestRiskEvents.length ? (
            <ul>
              {data.latestRiskEvents.map((item) => (
                <li key={item.id}>
                  [风控 {item.level}/{item.status}] {item.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small-tip">暂无风控事件</p>
          )}
          {data?.latestReviewCases.length ? (
            <ul>
              {data.latestReviewCases.map((item) => (
                <li key={item.id}>
                  [审核 {item.targetType}/{item.status}] {item.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small-tip">暂无审核单</p>
          )}
        </article>
        <article className="platform-panel">
          <h3>最新仲裁/交付</h3>
          {data?.latestDisputes.length ? (
            <ul>
              {data.latestDisputes.map((item) => (
                <li key={item.id}>
                  [仲裁 {item.status}] {item.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small-tip">暂无仲裁</p>
          )}
          {data?.latestWorkspaceSubmissions.length ? (
            <ul>
              {data.latestWorkspaceSubmissions.map((item) => (
                <li key={item.id}>
                  [交付 {item.status}] {item.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small-tip">暂无交付</p>
          )}
        </article>
      </section>
    </main>
  );
}
