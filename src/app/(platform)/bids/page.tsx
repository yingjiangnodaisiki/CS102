"use client";

import { useEffect, useMemo, useState } from "react";

interface BidRow {
  id: string;
  projectTitle: string;
  developerName: string;
  amount: string;
  status: "PENDING" | "WITHDRAWN" | "ACCEPTED" | "REJECTED";
  createdAt: string;
}

export default function BidsPage() {
  const [bidRows, setBidRows] = useState<BidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/bids/me", {
          credentials: "include"
        });
        const result = (await response.json()) as { message?: string; data?: BidRow[] };
        if (!response.ok || !result.data) {
          setError(result.message ?? "投标列表加载失败");
          return;
        }
        setBidRows(result.data);
      } catch {
        setError("网络异常，请稍后重试");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const totalAmount = useMemo(() => {
    return bidRows.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2);
  }, [bidRows]);

  const exportCsv = () => {
    const header = ["项目", "乙方", "报价", "状态", "创建时间"];
    const rows = bidRows.map((item) => [item.projectTitle, item.developerName, item.amount, item.status, item.createdAt]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bids-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>投标管理</h1>
        <p>查看投标报价、方案摘要与风险提示，支持快速筛选与状态跟踪。</p>
      </header>

      <section className="platform-panel">
        <div className="panel-title-row">
          <h3>投标列表</h3>
          <button type="button" className="mini-action-btn" onClick={exportCsv} disabled={bidRows.length === 0}>
            导出数据
          </button>
        </div>
        <p className="small-tip">共 {bidRows.length} 条，累计报价 ¥{totalAmount}</p>
        <div className="simple-table">
          <div className="simple-table-header">
            <span>项目</span>
            <span>乙方</span>
            <span>报价</span>
            <span>状态</span>
          </div>
          {loading ? <div className="empty-state">投标列表加载中...</div> : null}
          {!loading && bidRows.length === 0 ? <div className="empty-state">暂无投标记录</div> : null}
          {!loading
            ? bidRows.map((item) => (
                <div className="simple-table-row" key={item.id}>
                  <span>{item.projectTitle}</span>
                  <span>{item.developerName}</span>
                  <span>¥{item.amount}</span>
                  <span>{item.status}</span>
                </div>
              ))
            : null}
        </div>
        {error ? <div className="form-error">{error}</div> : null}
      </section>
    </main>
  );
}
