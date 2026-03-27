"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RiskStatus = "OPEN" | "IN_REVIEW" | "MITIGATED" | "FALSE_POSITIVE";

interface RiskEventItem {
  id: string;
  type: "BID_COLLUSION" | "PAYMENT_ANOMALY" | "ACCOUNT_ABUSE" | "DISPUTE_SPIKE";
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: RiskStatus;
  title: string;
  description: string;
  createdAt: string;
}

export default function AdminRiskEventsPage() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<RiskStatus | "ALL">("OPEN");
  const [items, setItems] = useState<RiskEventItem[]>([]);

  const loadData = async (): Promise<void> => {
    setError(null);
    const query = new URLSearchParams({
      page: "1",
      pageSize: "50",
      ...(status !== "ALL" ? { status } : {})
    });
    const response = await fetch(`/api/v1/admin/risk-events?${query.toString()}`, { credentials: "include" });
    const result = (await response.json()) as {
      code?: string;
      message?: string;
      data?: { items?: RiskEventItem[] };
    };
    if (!response.ok) {
      if (result.code === "FORBIDDEN") {
        setForbidden(true);
        return;
      }
      setError(result.message ?? "加载风控事件失败");
      return;
    }
    setForbidden(false);
    setItems(result.data?.items ?? []);
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        await loadData();
      } catch {
        setError("网络异常，请稍后重试");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [status]);

  const handleAction = async (
    id: string,
    action: "MARK_FALSE_POSITIVE" | "MARK_MITIGATED" | "FREEZE_DEVELOPER" | "ESCALATE_REVIEW"
  ): Promise<void> => {
    const note = window.prompt("请输入处置说明（至少4个字符）", "");
    if (!note || note.trim().length < 4) {
      setError("处置说明至少4个字符");
      return;
    }
    setProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/v1/admin/risk-events/${id}/action`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "处置失败");
        return;
      }
      setSuccess("风控事件已处理");
      await loadData();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <main className="platform-page">
        <div className="empty-state">风控模块加载中...</div>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="platform-page">
        <div className="empty-state">
          仅管理员可访问风控模块。<Link href="/admin">返回管理中心</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>风控事件模块</h1>
        <p>独立前端页面 + 独立后端接口：`/api/v1/admin/risk-events`</p>
      </header>

      <section className="platform-panel">
        <div className="inline-actions">
          <Link href="/admin">返回管理中心</Link>
          <Link href="/admin/reviews">去审核模块</Link>
          <select value={status} onChange={(event) => setStatus(event.target.value as RiskStatus | "ALL")}>
            <option value="ALL">全部状态</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="MITIGATED">MITIGATED</option>
            <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
          </select>
          <button type="button" onClick={() => void loadData()}>
            刷新
          </button>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        {success ? <div className="form-success">{success}</div> : null}
        {processing ? <p className="small-tip">处理中...</p> : null}
        {items.length === 0 ? <p className="small-tip">暂无风控事件</p> : null}
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              [{item.level}/{item.status}] {item.title}
              <p className="small-tip">{item.description}</p>
              <span className="inline-actions">
                <button type="button" onClick={() => void handleAction(item.id, "MARK_MITIGATED")}>
                  标记缓解
                </button>
                <button type="button" onClick={() => void handleAction(item.id, "MARK_FALSE_POSITIVE")}>
                  标记误报
                </button>
                <button type="button" onClick={() => void handleAction(item.id, "ESCALATE_REVIEW")}>
                  升级复核
                </button>
                <button type="button" onClick={() => void handleAction(item.id, "FREEZE_DEVELOPER")}>
                  冻结开发者
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
