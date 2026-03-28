"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

const showMockPayment =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ALLOW_MOCK_PAYMENT === "true";

interface ProjectDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  budgetMin: string;
  budgetMax: string;
  biddingEndsAt: string;
  tags: string[];
  clientId: string;
  createdAt: string;
}

interface MeData {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface BidItem {
  id: string;
  developerId: string;
  amount: string;
  proposal: string;
  expectedDays: number;
  status: "PENDING" | "WITHDRAWN" | "ACCEPTED" | "REJECTED";
}

interface AcceptBidResponse {
  acceptedBidId: string;
  rejectedCount: number;
  projectStatus: string;
}

interface WorkspaceSubmissionItem {
  id: string;
  projectId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submitterUser?: { id: string };
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id ?? "";
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [me, setMe] = useState<MeData | null>(null);
  const [bids, setBids] = useState<BidItem[]>([]);
  const [bidAmount, setBidAmount] = useState("10000");
  const [proposal, setProposal] = useState(
    "我将基于你提供的业务场景给出完整方案，包括技术选型、里程碑计划、测试策略和交付文档，确保可按期上线。"
  );
  const [expectedDays, setExpectedDays] = useState("14");
  const [bidding, setBidding] = useState(false);
  const [creatingEscrow, setCreatingEscrow] = useState<string | null>(null);
  const [payingOrderNo, setPayingOrderNo] = useState<string | null>(null);
  const [escrowOrderNo, setEscrowOrderNo] = useState<string | null>(null);
  const [acceptingBidId, setAcceptingBidId] = useState<string | null>(null);
  const [approvedSubmissionReady, setApprovedSubmissionReady] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [disputeAmount, setDisputeAmount] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeEscrowId, setDisputeEscrowId] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeInfo, setDisputeInfo] = useState<string | null>(null);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/v1/projects/${projectId}`, { credentials: "include" });
        const result = (await response.json()) as { message?: string; data?: ProjectDetail };
        if (!response.ok || !result.data) {
          setError(result.message ?? "项目不存在");
          return;
        }
        setProject(result.data);

        const meResponse = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (meResponse.ok) {
          const meResult = (await meResponse.json()) as { data: MeData };
          setMe(meResult.data);
        }

        const bidsResponse = await fetch(`/api/v1/projects/${projectId}/bids`, { credentials: "include" });
        if (bidsResponse.ok) {
          const bidResult = (await bidsResponse.json()) as { data?: BidItem[] };
          const loadedBids = bidResult.data ?? [];
          setBids(loadedBids);

          const accepted = loadedBids.find((item) => item.status === "ACCEPTED");
          if (accepted) {
            setSubmissionsLoading(true);
            const submissionsResponse = await fetch(
              `/api/v1/workspace/submissions?projectId=${projectId}&status=APPROVED`,
              { credentials: "include" }
            );
            if (submissionsResponse.ok) {
              const submissionResult = (await submissionsResponse.json()) as {
                data?: WorkspaceSubmissionItem[];
              };
              const hasApproved = (submissionResult.data ?? []).some(
                (item) => item.submitterUser?.id === accepted.developerId
              );
              setApprovedSubmissionReady(hasApproved);
            } else {
              setApprovedSubmissionReady(false);
            }
            setSubmissionsLoading(false);
          } else {
            setApprovedSubmissionReady(false);
          }
        }
      } catch {
        setError("网络异常，请稍后重试");
      } finally {
        setLoading(false);
      }
    };
    if (projectId) {
      void load();
    }
  }, [projectId]);

  const isDeveloperBidAllowed = useMemo(() => {
    if (!me || !project) {
      return false;
    }
    return me.role === "DEVELOPER" && project.clientId !== me.userId && ["PUBLISHED", "BIDDING"].includes(project.status);
  }, [me, project]);

  const myBid = useMemo(() => {
    if (!me) {
      return null;
    }
    return bids.find((item) => item.developerId === me.userId && item.status !== "WITHDRAWN") ?? null;
  }, [me, bids]);

  const acceptedBid = useMemo(() => bids.find((item) => item.status === "ACCEPTED") ?? null, [bids]);

  const publish = async () => {
    if (!project) {
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/projects/${project.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "发布失败");
        return;
      }
      setProject((current) => (current ? { ...current, status: "PUBLISHED" } : current));
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setPublishing(false);
    }
  };

  const placeBid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project) {
      return;
    }
    setBidding(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/projects/${project.id}/bids`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(bidAmount),
          proposal,
          expectedDays: Number(expectedDays)
        })
      });
      const result = (await response.json()) as { message?: string; data?: BidItem };
      if (!response.ok || !result.data) {
        const detailMessage = (result as { data?: { issues?: Array<{ message?: string }> } }).data?.issues?.[0]?.message;
        setError(detailMessage ?? result.message ?? "投标失败");
        return;
      }
      setBids((current) => [result.data as BidItem, ...current]);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBidding(false);
    }
  };

  const createEscrowOrder = async (bid: BidItem) => {
    if (!project) {
      return;
    }
    setCreatingEscrow(bid.id);
    setError(null);
    setEscrowOrderNo(null);
    try {
      const response = await fetch("/api/v1/payments/escrow/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          developerId: bid.developerId,
          amount: Number(bid.amount)
        })
      });
      const result = (await response.json()) as { message?: string; data?: { orderNo: string } };
      if (!response.ok || !result.data?.orderNo) {
        setError(result.message ?? "创建托管订单失败");
        return;
      }
      setEscrowOrderNo(result.data.orderNo);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setCreatingEscrow(null);
    }
  };

  const mockPayOrder = async (orderNo: string) => {
    setPayingOrderNo(orderNo);
    setError(null);
    try {
      const response = await fetch(`/api/v1/payments/escrow/orders/${orderNo}/mock-paid`, {
        method: "POST",
        credentials: "include"
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "模拟支付失败");
        return;
      }
      setEscrowOrderNo(null);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setPayingOrderNo(null);
    }
  };

  const canApplyPlatformDispute = useMemo(() => {
    if (!me || !project || !acceptedBid) {
      return false;
    }
    if (me.role !== "CLIENT" && me.role !== "DEVELOPER") {
      return false;
    }
    const isClientParty = me.userId === project.clientId;
    const isDeveloperParty = me.userId === acceptedBid.developerId;
    return isClientParty || isDeveloperParty;
  }, [me, project, acceptedBid]);

  const submitPlatformDispute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project) {
      return;
    }
    setDisputeSubmitting(true);
    setDisputeError(null);
    setDisputeInfo(null);
    try {
      const amountNum = Number(disputeAmount);
      const body: {
        projectId: string;
        amount: number;
        reason: string;
        escrowOrderId?: string;
      } = {
        projectId: project.id,
        amount: amountNum,
        reason: disputeReason.trim()
      };
      const escrowTrim = disputeEscrowId.trim();
      if (escrowTrim.length > 0) {
        body.escrowOrderId = escrowTrim;
      }
      const response = await fetch("/api/v1/disputes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = (await response.json()) as {
        message?: string;
        data?: { dispute?: { status?: string; id?: string }; idempotent?: boolean };
      };
      if (!response.ok) {
        setDisputeError(result.message ?? "申请失败");
        return;
      }
      const st = result.data?.dispute?.status ?? "已提交";
      setDisputeInfo(
        result.data?.idempotent ? `争议单已存在，当前状态：${st}` : `已提交平台仲裁申请，状态：${st}`
      );
    } catch {
      setDisputeError("网络异常，请稍后重试");
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const acceptBid = async (bidId: string) => {
    if (!project) {
      return;
    }
    setAcceptingBidId(bidId);
    setError(null);
    try {
      const response = await fetch(`/api/v1/bids/${bidId}/accept`, {
        method: "POST",
        credentials: "include"
      });
      const result = (await response.json()) as { message?: string; data?: AcceptBidResponse };
      if (!response.ok || !result.data) {
        setError(result.message ?? "确认中标失败");
        return;
      }

      setBids((current) =>
        current.map((item) => {
          if (item.id === result.data?.acceptedBidId) {
            return { ...item, status: "ACCEPTED" };
          }
          if (item.status === "PENDING") {
            return { ...item, status: "REJECTED" };
          }
          return item;
        })
      );
      setProject((current) => (current ? { ...current, status: result.data?.projectStatus ?? current.status } : current));
      setApprovedSubmissionReady(false);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setAcceptingBidId(null);
    }
  };

  if (loading) {
    return <main className="platform-page"><div className="empty-state">项目详情加载中...</div></main>;
  }

  if (!project) {
    return <main className="platform-page"><div className="empty-state">{error ?? "项目不存在"}</div></main>;
  }

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>{project.title}</h1>
        <p>项目详情与发布入口，支持从草稿直接发布。</p>
      </header>

      <section className="platform-panel">
        <div className="project-detail-grid">
          <p>
            <strong>状态：</strong>
            {project.status}
          </p>
          <p>
            <strong>预算：</strong>¥{project.budgetMin} - ¥{project.budgetMax}
          </p>
          <p>
            <strong>截止时间：</strong>
            {new Date(project.biddingEndsAt).toLocaleString("zh-CN")}
          </p>
          <p>
            <strong>项目ID：</strong>
            {project.id}
          </p>
        </div>

        <div className="project-tags">
          {project.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <article className="project-description">{project.description}</article>

        {error ? <div className="form-error">{error}</div> : null}

        {isDeveloperBidAllowed ? (
          <section className="platform-panel nested-panel">
            <h3>参与投标</h3>
            {myBid ? (
              <p className="small-tip">你已投标：{myBid.status}，报价 ¥{myBid.amount}</p>
            ) : (
              <form className="project-form" onSubmit={placeBid}>
                <p className="small-tip">
                  投标前请先在个人主页完成能力验证，否则会被系统拒绝。
                  <button type="button" onClick={() => router.push("/profile")} style={{ marginLeft: 8 }}>
                    去完成验证
                  </button>
                </p>
                <div className="project-form-row">
                  <label>
                    报价金额
                    <input type="number" min={1} value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} required />
                  </label>
                  <label>
                    工期(天)
                    <input type="number" min={1} value={expectedDays} onChange={(event) => setExpectedDays(event.target.value)} required />
                  </label>
                </div>
                <label>
                  方案说明
                  <textarea value={proposal} onChange={(event) => setProposal(event.target.value)} minLength={20} rows={4} required />
                </label>
                <button type="submit" className="mini-action-btn" disabled={bidding}>
                  {bidding ? "投标中..." : "提交投标"}
                </button>
              </form>
            )}
          </section>
        ) : null}

        {me?.role === "CLIENT" && project.clientId === me.userId ? (
          <section className="platform-panel nested-panel">
            <h3>投标管理</h3>
            {bids.length === 0 ? (
              <p className="small-tip">当前暂无投标。</p>
            ) : (
              <div className="list-table">
                {bids.map((item) => (
                  <article key={item.id} className="list-item">
                    <div>
                      <p>
                        <strong>开发者：</strong>
                        {item.developerId}
                      </p>
                      <p>
                        <strong>报价：</strong>¥{item.amount}
                      </p>
                      <p>
                        <strong>工期：</strong>
                        {item.expectedDays} 天
                      </p>
                      <p>
                        <strong>状态：</strong>
                        {item.status}
                      </p>
                    </div>
                    <div className="inline-actions">
                      {item.status === "PENDING" && !acceptedBid ? (
                        <button type="button" onClick={() => acceptBid(item.id)} disabled={acceptingBidId === item.id}>
                          {acceptingBidId === item.id ? "处理中..." : "确认中标"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {me?.role === "CLIENT" && project.clientId === me.userId ? (
          <section className="platform-panel nested-panel">
            <h3>中标支付</h3>
            {acceptedBid ? (
              <>
                <p className="small-tip">已中标开发者：{acceptedBid.developerId}</p>
                <p className="small-tip">中标金额：¥{acceptedBid.amount}</p>
                {submissionsLoading ? <p className="small-tip">正在检查乙方交付审核状态...</p> : null}
                {!submissionsLoading && !approvedSubmissionReady ? (
                  <p className="small-tip">乙方需先在工作区提交成果并通过甲方审核，才能发起支付。</p>
                ) : null}
                <button
                  type="button"
                  className="mini-action-btn"
                  onClick={() => createEscrowOrder(acceptedBid)}
                  disabled={creatingEscrow === acceptedBid.id || submissionsLoading || !approvedSubmissionReady}
                >
                  {creatingEscrow === acceptedBid.id ? "创建订单中..." : "创建托管支付订单"}
                </button>
                {escrowOrderNo ? (
                  <div className="inline-actions" style={{ marginTop: 10 }}>
                    <span className="small-tip">订单号：{escrowOrderNo}</span>
                    {showMockPayment ? (
                      <button
                        type="button"
                        onClick={() => mockPayOrder(escrowOrderNo)}
                        disabled={payingOrderNo === escrowOrderNo}
                      >
                        {payingOrderNo === escrowOrderNo ? "支付中..." : "模拟支付成功"}
                      </button>
                    ) : (
                      <span className="small-tip">正式环境已关闭模拟支付；请走真实托管支付回调。</span>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="small-tip">当前暂无 ACCEPTED 状态投标，无法支付。</p>
            )}
          </section>
        ) : null}

        {canApplyPlatformDispute ? (
          <section className="platform-panel nested-panel">
            <h3>申请平台仲裁</h3>
            <p className="small-tip">
              已签约（已产生合约）的甲方或乙方可发起争议。金额超过 ¥5000 将自动进入仲裁中；否则需双方均发起后进入仲裁。管理员在「管理中心 → 仲裁处理」裁决。
            </p>
            {disputeInfo ? <div className="form-success">{disputeInfo}</div> : null}
            {disputeError ? <div className="form-error">{disputeError}</div> : null}
            <form className="project-form" onSubmit={submitPlatformDispute}>
              <label>
                争议涉及金额（元）
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={disputeAmount}
                  onChange={(event) => setDisputeAmount(event.target.value)}
                  placeholder="例如中标金额或托管金额"
                  required
                />
              </label>
              <label>
                托管订单主键（选填，EscrowOrder.id 的 UUID，非 orderNo）
                <input
                  value={disputeEscrowId}
                  onChange={(event) => setDisputeEscrowId(event.target.value)}
                  placeholder="可在数据库 escrow_orders.id 查看；不填则仅关联项目争议"
                />
              </label>
              <label>
                事由说明（至少 10 字）
                <textarea
                  value={disputeReason}
                  onChange={(event) => setDisputeReason(event.target.value)}
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  required
                  placeholder="请说明争议背景、已沟通情况等"
                />
              </label>
              <button type="submit" className="mini-action-btn" disabled={disputeSubmitting}>
                {disputeSubmitting ? "提交中..." : "提交仲裁申请"}
              </button>
            </form>
          </section>
        ) : null}

        <div className="inline-actions">
          {project.status === "DRAFT" ? (
            <button type="button" onClick={publish} disabled={publishing}>
              {publishing ? "发布中..." : "发布项目"}
            </button>
          ) : null}
          <button type="button" onClick={() => router.push("/projects")}>
            返回项目列表
          </button>
        </div>
      </section>
    </main>
  );
}
