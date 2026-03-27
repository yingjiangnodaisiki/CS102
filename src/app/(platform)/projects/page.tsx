"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface ProjectItem {
  id: string;
  title: string;
  description: string;
  status: string;
  budgetMin: string;
  budgetMax: string;
  biddingEndsAt: string;
  tags: string[];
  createdAt: string;
  isMine: boolean;
  hasMyBid: boolean;
  bidCount: number;
  canBid: boolean;
}

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [queryKeyword, setQueryKeyword] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"ALL" | "CAN_BID" | "MY_BID" | "MY_PUBLISH">("ALL");

  const loadProjects = async (nextKeyword: string) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50"
      });
      if (nextKeyword.trim()) {
        params.set("keyword", nextKeyword.trim());
      }
      const response = await fetch(`/api/v1/projects/plaza?${params.toString()}`, {
        method: "GET",
        credentials: "include"
      });
      const result = (await response.json()) as {
        code: string;
        message?: string;
        data?: { items: ProjectItem[] };
      };
      if (!response.ok) {
        setError(result.message ?? "获取项目广场失败，请先登录");
        return;
      }
      setProjects(result.data?.items ?? []);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects(queryKeyword);
  }, []);

  const publishProject = async (projectId: string) => {
    setPublishingId(projectId);
    setError(null);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "发布项目失败");
        return;
      }
      setProjects((current) =>
        current.map((item) => (item.id === projectId ? { ...item, status: "PUBLISHED" } : item))
      );
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setPublishingId(null);
    }
  };

  const visibleProjects = useMemo(() => {
    if (tab === "CAN_BID") {
      return projects.filter((item) => item.canBid);
    }
    if (tab === "MY_BID") {
      return projects.filter((item) => item.hasMyBid);
    }
    if (tab === "MY_PUBLISH") {
      return projects.filter((item) => item.isMine);
    }
    return projects;
  }, [projects, tab]);

  const content = useMemo(() => {
    if (loading) {
      return <div className="empty-state">项目广场加载中...</div>;
    }
    if (error) {
      return (
        <div className="empty-state">
          <p>{error}</p>
          <Link href="/login" className="btn btn-secondary">
            去登录
          </Link>
        </div>
      );
    }
    if (visibleProjects.length === 0) {
      return <div className="empty-state">暂无匹配项目，可尝试切换筛选或发布新项目。</div>;
    }
    return (
      <div className="project-plaza-grid">
        {visibleProjects.map((item) => (
          <article key={item.id} className="project-plaza-card">
            <div className="project-plaza-head">
              <h3>{item.title}</h3>
              <span className="project-status-chip">{item.status}</span>
            </div>
            <p className="project-plaza-desc">{item.description}</p>
            <div className="project-tags">
              {item.tags.length === 0 ? <span>未设置标签</span> : item.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <div className="project-plaza-meta">
              <span>预算：¥{item.budgetMin} - ¥{item.budgetMax}</span>
              <span>截止：{new Date(item.biddingEndsAt).toLocaleString("zh-CN")}</span>
              <span>投标数：{item.bidCount}</span>
              {item.hasMyBid ? <span>你已投标</span> : null}
              {item.isMine ? <span>我发布的</span> : null}
            </div>
            <div className="inline-actions">
              <Link href={`/projects/${item.id}`}>查看详情</Link>
              {item.canBid ? <Link href={`/projects/${item.id}`}>去投标</Link> : null}
              {item.status === "DRAFT" && item.isMine ? (
                <button type="button" onClick={() => publishProject(item.id)} disabled={publishingId === item.id}>
                  {publishingId === item.id ? "发布中..." : "发布"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  }, [loading, error, visibleProjects, publishingId]);

  const tabItems: Array<{ key: "ALL" | "CAN_BID" | "MY_BID" | "MY_PUBLISH"; label: string }> = [
    { key: "ALL", label: "全部项目" },
    { key: "CAN_BID", label: "可投标" },
    { key: "MY_BID", label: "我已投标" },
    { key: "MY_PUBLISH", label: "我发布的" }
  ];

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>项目广场</h1>
        <p>公开项目、可投标项目、我已投标项目与我发布项目统一汇总展示。</p>
      </header>

      <section className="platform-panel">
        <div className="panel-title-row">
          <h3>广场列表</h3>
          <Link href="/projects/new" className="mini-action-btn">
            新建项目
          </Link>
        </div>

        <div className="project-plaza-toolbar">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="按标题/描述/标签搜索"
          />
          <button
            type="button"
            className="mini-action-btn"
            onClick={() => {
              setQueryKeyword(keyword.trim());
              void loadProjects(keyword.trim());
            }}
          >
            搜索
          </button>
          <button
            type="button"
            className="mini-action-btn"
            onClick={() => {
              setKeyword("");
              setQueryKeyword("");
              void loadProjects("");
            }}
          >
            重置
          </button>
        </div>

        <div className="project-plaza-tabs">
          {tabItems.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`project-plaza-tab${tab === item.key ? " active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {queryKeyword ? (
          <p className="small-tip">
            当前关键词：<strong>{queryKeyword}</strong>
          </p>
        ) : null}
        {content}
      </section>
    </main>
  );
}
