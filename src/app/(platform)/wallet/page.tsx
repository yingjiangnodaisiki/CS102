"use client";

import { useEffect, useMemo, useState } from "react";

interface WalletResponse {
  userId: string;
  availableBalance: string;
  frozenBalance: string;
  totalBalance: string;
  currency: string;
  recentTransactions: Array<{
    id: string;
    direction: string;
    amount: string;
    reason: string;
    referenceId: string | null;
    createdAt: string;
  }>;
}

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [channels, setChannels] = useState<Array<{ code: "ALIPAY" | "WECHAT"; name: string; status: string }>>([]);
  const [topupAmount, setTopupAmount] = useState("100");
  const [topupChannel, setTopupChannel] = useState<"ALIPAY" | "WECHAT">("ALIPAY");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/v1/wallet/me", { credentials: "include" });
        const result = (await response.json()) as { message?: string; data?: WalletResponse };
        if (!response.ok || !result.data) {
          setError(result.message ?? "钱包初始化失败");
          return;
        }
        setWallet(result.data);
        const channelResponse = await fetch("/api/v1/payments/channels", { credentials: "include" });
        const channelResult = (await channelResponse.json()) as {
          data?: Array<{ code: "ALIPAY" | "WECHAT"; name: string; status: string }>;
        };
        setChannels(channelResult.data ?? []);
      } catch {
        setError("网络异常，请稍后重试");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const mockTopup = async () => {
    if (!wallet) {
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/payments/deposit/mock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: topupChannel,
          amount: Number(topupAmount)
        })
      });
      const result = (await response.json()) as { message?: string; data?: WalletResponse };
      if (!response.ok || !result.data) {
        setError(result.message ?? "模拟充值失败");
        return;
      }
      setWallet(result.data);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setPaying(false);
    }
  };

  const walletItems = useMemo(() => {
    if (!wallet) {
      return [];
    }
    return [
      { label: "可用余额", value: `¥ ${wallet.availableBalance}` },
      { label: "冻结金额", value: `¥ ${wallet.frozenBalance}` },
      { label: "总余额", value: `¥ ${wallet.totalBalance}` }
    ];
  }, [wallet]);

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>资金账户</h1>
        <p>查看钱包余额、冻结金额与最近资金流水，保障托管支付过程透明可追踪。</p>
      </header>

      {loading ? <div className="empty-state">钱包初始化中...</div> : null}
      {!loading && error ? <div className="empty-state">{error}</div> : null}

      {!loading && !error ? <section className="platform-stats-grid">
        {walletItems.map((item) => (
          <article className="platform-card" key={item.label}>
            <p>{item.label}</p>
            <h2>{item.value}</h2>
            <span>实时更新</span>
          </article>
        ))}
      </section> : null}

      {!loading && !error ? <section className="platform-panel">
        <h3>充值与支付通道</h3>
        <p className="small-tip">用户UUID：{wallet?.userId}</p>
        <div className="project-form-row">
          <label>
            支付通道
            <select value={topupChannel} onChange={(event) => setTopupChannel(event.target.value as "ALIPAY" | "WECHAT")}>
              {channels.map((channel) => (
                <option key={channel.code} value={channel.code}>
                  {channel.name}（{channel.status}）
                </option>
              ))}
            </select>
          </label>
          <label>
            充值金额
            <input
              type="number"
              min={1}
              value={topupAmount}
              onChange={(event) => setTopupAmount(event.target.value)}
            />
          </label>
        </div>
        <button type="button" className="mini-action-btn" onClick={mockTopup} disabled={paying}>
          {paying ? "支付处理中..." : "模拟充值"}
        </button>
      </section> : null}

      {!loading && !error ? <section className="platform-panel">
        <h3>最近资金流水</h3>
        <div className="simple-table">
          <div className="simple-table-header">
            <span>类型</span>
            <span>金额</span>
            <span>原因/单号</span>
            <span>时间</span>
          </div>
          {(wallet?.recentTransactions ?? []).map((item) => (
            <div className="simple-table-row" key={item.id}>
              <span>{item.direction}</span>
              <span>¥ {item.amount}</span>
              <span>
                {item.reason}
                {item.referenceId ? ` / ${item.referenceId}` : ""}
              </span>
              <span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
            </div>
          ))}
        </div>
      </section> : null}
    </main>
  );
}
