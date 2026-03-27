"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DisputeStatus = "REQUESTED" | "IN_ARBITRATION" | "RESOLVED" | "REJECTED";

interface DisputeItem {
  id: string;
  projectId: string;
  status: DisputeStatus;
  reason: string;
  resolution: string | null;
  amount: string;
  createdAt: string;
}

export default function AdminDisputesPage() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<DisputeStatus | "ALL">("IN_ARBITRATION");
  const [items, setItems] = useState<DisputeItem[]>([]);

  const loadData = async (): Promise<void> => {
    setError(null);
    const query = new URLSearchParams({
      page: "1",
      pageSize: "50",
      ...(status !== "ALL" ? { status } : {})
    });
    const response = await fetch(`/api/v1/admin/disputes?${query.toString()}`, { credentials: "include" });
    const result = (await response.json()) as {
      code?: string;
      message?: string;
      data?: { items?: DisputeItem[] };
    };
    if (!response.ok) {
      if (result.code === "FORBIDDEN") {
        setForbidden(true);
        return;
      }
      setError(result.message ?? "加载仲裁列表失败");
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

  const resolveItem = async (
    id: string,
    action: "REJECT" | "FULL_REFUND" | "PARTIAL_REFUND" | "RELEASE"
  ): Promise<void> => {
    const resolution = window.prompt("请输入仲裁结论（至少6个字符）", "");
    if (!resolution || resolution.trim().length < 6) {
      setError("仲裁结论至少6个字符");
      return;
    }
    let refundAmount: number | undefined;
    if (action === "PARTIAL_REFUND") {
      const input = window.prompt("请输入部分退款金额", "");
      const parsed = Number(input);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError("部分退款金额不合法");
        return;
      }
      refundAmount = parsed;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/v1/admin/disputes/${id}/resolve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          resolution: resolution.trim(),
          ...(refundAmount !== undefined ? { refundAmount } : {})
        })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "仲裁处理失败");
        return;
      }
      setSuccess("仲裁已处理");
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
        <div className="empty-state">仲裁模块加载中...</div>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="platform-page">
        <div className="empty-state">
          仅管理员可访问仲裁模块。<Link href="/admin">返回管理中心</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>仲裁处理模块</h1>
        <p>独立前端页面 + 独立后端接口：`/api/v1/admin/disputes`</p>
      </header>

      <section className="platform-panel">
        <div className="inline-actions">
          <Link href="/admin">返回管理中心</Link>
          <Link href="/admin/risk-events">去风控模块</Link>
          <select value={status} onChange={(event) => setStatus(event.target.value as DisputeStatus | "ALL")}>
            <option value="ALL">全部状态</option>
            <option value="REQUESTED">REQUESTED</option>
            <option value="IN_ARBITRATION">IN_ARBITRATION</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          <button type="button" onClick={() => void loadData()}>
            刷新
          </button>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        {success ? <div className="form-success">{success}</div> : null}
        {processing ? <p className="small-tip">处理中...</p> : null}
        {items.length === 0 ? <p className="small-tip">暂无争议记录</p> : null}
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              [{item.status}] 项目 {item.projectId.slice(0, 8)}... 金额 ¥{item.amount}
              <p className="small-tip">原因：{item.reason}</p>
              {item.resolution ? <p className="small-tip">结论：{item.resolution}</p> : null}
              <span className="inline-actions">
                <button type="button" onClick={() => void resolveItem(item.id, "REJECT")}>
                  驳回争议
                </button>
                <button type="button" onClick={() => void resolveItem(item.id, "FULL_REFUND")}>
                  全额退款
                </button>
                <button type="button" onClick={() => void resolveItem(item.id, "PARTIAL_REFUND")}>
                  部分退款
                </button>
                <button type="button" onClick={() => void resolveItem(item.id, "RELEASE")}>
                  放款乙方
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
