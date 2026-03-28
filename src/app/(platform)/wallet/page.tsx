"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { walletDirectionLabel, walletTransactionReasonLabel } from "@/lib/utils/wallet-tx-labels";

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

const showMockDepositUi =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ALLOW_MOCK_PAYMENT === "true";

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [channels, setChannels] = useState<Array<{ code: "ALIPAY" | "WECHAT"; name: string; status: string }>>([]);
  const [topupAmount, setTopupAmount] = useState("100");
  const [topupChannel, setTopupChannel] = useState<"ALIPAY" | "WECHAT">("ALIPAY");
  const [paying, setPaying] = useState(false);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
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
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

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
      const result = (await response.json()) as { message?: string; code?: string; data?: WalletResponse };
      if (!response.ok || !result.data) {
        setError(result.message ?? "充值失败");
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
        <p>
          余额与流水来自数据库真实记录；托管支付、仲裁退款等会同步写入流水。正式环境默认关闭「模拟充值」，与真实支付渠道对接后可走线上充值接口。
        </p>
      </header>

      {loading ? <div className="empty-state">钱包加载中...</div> : null}
      {!loading && error ? <div className="empty-state">{error}</div> : null}

      {!loading && !error ? (
        <section className="platform-panel">
          <div className="inline-actions" style={{ marginBottom: 12 }}>
            <button type="button" className="mini-action-btn" onClick={() => void loadWallet()}>
              刷新余额与流水
            </button>
          </div>
        </section>
      ) : null}

      {!loading && !error ? (
        <section className="platform-stats-grid">
          {walletItems.map((item) => (
            <article className="platform-card" key={item.label}>
              <p>{item.label}</p>
              <h2>{item.value}</h2>
              <span>币种 {wallet?.currency ?? "CNY"}</span>
            </article>
          ))}
        </section>
      ) : null}

      {!loading && !error && showMockDepositUi ? (
        <section className="platform-panel">
          <h3>模拟充值（仅开发 / 演示）</h3>
          <p className="small-tip">
            生产环境需在 Vercel 同时设置 <code>ALLOW_MOCK_PAYMENT=true</code> 与{" "}
            <code>NEXT_PUBLIC_ALLOW_MOCK_PAYMENT=true</code> 后重新部署，按钮与接口才会放行。
          </p>
          <p className="small-tip">用户UUID：{wallet?.userId}</p>
          <div className="project-form-row">
            <label>
              支付通道
              <select
                value={topupChannel}
                onChange={(event) => setTopupChannel(event.target.value as "ALIPAY" | "WECHAT")}
              >
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
          <button type="button" className="mini-action-btn" onClick={() => void mockTopup()} disabled={paying}>
            {paying ? "处理中..." : "模拟充值"}
          </button>
        </section>
      ) : null}

      {!loading && !error && !showMockDepositUi ? (
        <section className="platform-panel">
          <h3>充值说明</h3>
          <p className="small-tip">
            当前为正式构建且未开启演示开关：不提供模拟充值。请对接支付宝/微信等企业支付能力后，通过服务端充值接口入账；自检需要模拟时请在部署环境开启{" "}
            <code>ALLOW_MOCK_PAYMENT</code> 与 <code>NEXT_PUBLIC_ALLOW_MOCK_PAYMENT</code>。
          </p>
        </section>
      ) : null}

      {!loading && !error ? (
        <section className="platform-panel">
          <h3>资金流水（最近 50 条）</h3>
          <p className="small-tip">数据来自 wallet_transactions 表，与托管、退款等业务写入一致。</p>
          <div className="simple-table">
            <div className="simple-table-header">
              <span>方向</span>
              <span>金额</span>
              <span>类型 / 关联单号</span>
              <span>时间</span>
            </div>
            {(wallet?.recentTransactions ?? []).length === 0 ? (
              <div className="simple-table-row">
                <span>—</span>
                <span>—</span>
                <span>暂无流水</span>
                <span>—</span>
              </div>
            ) : null}
            {(wallet?.recentTransactions ?? []).map((item) => (
              <div className="simple-table-row" key={item.id}>
                <span>{walletDirectionLabel(item.direction)}</span>
                <span>¥ {item.amount}</span>
                <span>
                  {walletTransactionReasonLabel(item.reason)}
                  {item.referenceId ? ` / ${item.referenceId}` : ""}
                </span>
                <span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
