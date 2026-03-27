"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CertificationStatus = "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";

interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  status: CertificationStatus;
  certificateNo: string | null;
  verifyUrl: string | null;
  issuedAt: string;
}

export default function AdminCertificationsPage() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<CertificationStatus | "ALL">("PENDING");
  const [items, setItems] = useState<CertificationItem[]>([]);

  const loadData = async (): Promise<void> => {
    setError(null);
    const query = new URLSearchParams({
      page: "1",
      pageSize: "50",
      ...(status !== "ALL" ? { status } : {})
    });
    const response = await fetch(`/api/v1/admin/certifications?${query.toString()}`, { credentials: "include" });
    const result = (await response.json()) as {
      code?: string;
      message?: string;
      data?: { items?: CertificationItem[] };
    };
    if (!response.ok) {
      if (result.code === "FORBIDDEN") {
        setForbidden(true);
        return;
      }
      setError(result.message ?? "加载认证审核失败");
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

  const resolveItem = async (id: string, decision: "APPROVE" | "REJECT"): Promise<void> => {
    const note = window.prompt("请输入认证审核意见（至少6个字符）", "");
    if (!note || note.trim().length < 6) {
      setError("认证审核意见至少6个字符");
      return;
    }
    setProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/v1/admin/certifications/${id}/resolve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "认证审核处理失败");
        return;
      }
      setSuccess("认证审核已处理");
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
        <div className="empty-state">认证模块加载中...</div>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="platform-page">
        <div className="empty-state">
          仅管理员可访问认证模块。<Link href="/admin">返回管理中心</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>认证审核模块</h1>
        <p>独立前端页面 + 独立后端接口：`/api/v1/admin/certifications`</p>
      </header>

      <section className="platform-panel">
        <div className="inline-actions">
          <Link href="/admin">返回管理中心</Link>
          <Link href="/admin/disputes">去仲裁模块</Link>
          <select value={status} onChange={(event) => setStatus(event.target.value as CertificationStatus | "ALL")}>
            <option value="ALL">全部状态</option>
            <option value="PENDING">PENDING</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>
          <button type="button" onClick={() => void loadData()}>
            刷新
          </button>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        {success ? <div className="form-success">{success}</div> : null}
        {processing ? <p className="small-tip">处理中...</p> : null}
        {items.length === 0 ? <p className="small-tip">暂无认证记录</p> : null}
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              [{item.status}] {item.name} - {item.issuer}
              <p className="small-tip">
                证书编号：{item.certificateNo ?? "无"} | 发证时间：{new Date(item.issuedAt).toLocaleString()}
              </p>
              {item.verifyUrl ? (
                <p className="small-tip">
                  验证地址：<a href={item.verifyUrl} target="_blank" rel="noreferrer">{item.verifyUrl}</a>
                </p>
              ) : null}
              <span className="inline-actions">
                <button type="button" onClick={() => void resolveItem(item.id, "APPROVE")}>
                  通过
                </button>
                <button type="button" onClick={() => void resolveItem(item.id, "REJECT")}>
                  驳回
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
