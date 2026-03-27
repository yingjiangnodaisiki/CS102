"use client";

import { AuthQuickPanel } from "./AuthQuickPanel";
import { useEffect, useMemo, useState } from "react";

interface DashboardSummary {
  activeProjects: number;
  activeBids: number;
  pendingCertifications: number;
  escrowTotalAmount: string;
}

interface FocusTask {
  id: string;
  content: string;
  authorType: "PERSONAL" | "AGENT";
  createdAt: string;
}

const FOCUS_TASK_STORAGE_KEY = "ai-dev-platform-focus-tasks";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<FocusTask[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [taskAuthorType, setTaskAuthorType] = useState<"PERSONAL" | "AGENT">("PERSONAL");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/v1/dashboard/summary", {
          credentials: "include"
        });
        const result = (await response.json()) as { message?: string; data?: DashboardSummary };
        if (!response.ok || !result.data) {
          setError(result.message ?? "总览数据加载失败");
          return;
        }
        setSummary(result.data);
      } catch {
        setError("网络异常，请稍后重试");
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const cached = window.localStorage.getItem(FOCUS_TASK_STORAGE_KEY);
    if (!cached) {
      return;
    }
    try {
      const parsed = JSON.parse(cached) as FocusTask[];
      setTasks(parsed);
    } catch {
      window.localStorage.removeItem(FOCUS_TASK_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FOCUS_TASK_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const dashboardStats = useMemo(
    () => [
      { label: "进行中项目", value: String(summary?.activeProjects ?? 0), trend: "实时统计" },
      { label: "活跃投标", value: String(summary?.activeBids ?? 0), trend: "实时统计" },
      { label: "待审核认证", value: String(summary?.pendingCertifications ?? 0), trend: "实时统计" },
      { label: "托管订单金额", value: `¥ ${summary?.escrowTotalAmount ?? "0.00"}`, trend: "实时统计" }
    ],
    [summary]
  );

  const addTask = () => {
    const content = taskInput.trim();
    if (!content) {
      return;
    }
    setTasks((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        content,
        authorType: taskAuthorType,
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
    setTaskInput("");
  };

  const removeTask = (id: string) => {
    setTasks((current) => current.filter((item) => item.id !== id));
  };

  const generateAgentTasks = () => {
    const suggestions = [
      `复核 ${summary?.activeBids ?? 0} 条活跃投标中的异常行为`,
      `跟进进行中项目（${summary?.activeProjects ?? 0}）的里程碑验收`,
      `处理待审核认证（${summary?.pendingCertifications ?? 0}）并更新审核结论`
    ];
    setTasks((current) => [
      ...suggestions.map((content, index) => ({
        id: `${Date.now()}-agent-${index}`,
        content,
        authorType: "AGENT" as const,
        createdAt: new Date().toISOString()
      })),
      ...current
    ]);
  };

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>总览面板</h1>
        <p>集中查看平台交易、风控和交付状态，快速进入关键业务动作。</p>
        <AuthQuickPanel />
      </header>

      <section className="platform-stats-grid">
        {dashboardStats.map((item) => (
          <article className="platform-card" key={item.label}>
            <p>{item.label}</p>
            <h2>{item.value}</h2>
            <span>{item.trend}</span>
          </article>
        ))}
      </section>
      {error ? <div className="empty-state">{error}</div> : null}

      <section className="platform-two-column">
        <article className="platform-panel">
          <h3>今日重点任务</h3>
          <div className="inline-actions" style={{ marginBottom: 10 }}>
            <input
              value={taskInput}
              onChange={(event) => setTaskInput(event.target.value)}
              placeholder="输入重点任务"
            />
            <select value={taskAuthorType} onChange={(event) => setTaskAuthorType(event.target.value as "PERSONAL" | "AGENT")}>
              <option value="PERSONAL">个人撰写</option>
              <option value="AGENT">智能体撰写</option>
            </select>
            <button type="button" onClick={addTask}>
              添加任务
            </button>
            <button type="button" className="mini-action-btn" onClick={generateAgentTasks}>
              智能体生成建议
            </button>
          </div>
          {tasks.length === 0 ? <p className="small-tip">暂无任务，请由个人或智能体添加。</p> : null}
          <ul>
            {tasks.map((task) => (
              <li key={task.id}>
                [{task.authorType === "PERSONAL" ? "个人" : "智能体"}] {task.content}
                <button type="button" onClick={() => removeTask(task.id)} style={{ marginLeft: 8 }}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        </article>
        <article className="platform-panel">
          <h3>系统状态</h3>
          <div className="system-status-list">
            <p>
              <strong>支付回调：</strong> 正常
            </p>
            <p>
              <strong>消息推送：</strong> 稳定
            </p>
            <p>
              <strong>审核队列：</strong> 轻负载
            </p>
            <p>
              <strong>数据库：</strong> 健康
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
