"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetMin, setBudgetMin] = useState("1000");
  const [budgetMax, setBudgetMax] = useState("5000");
  const [biddingEndsAt, setBiddingEndsAt] = useState("");
  const [tags, setTags] = useState("nlp,chatbot");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          budgetMin: Number(budgetMin),
          budgetMax: Number(budgetMax),
          biddingEndsAt: new Date(biddingEndsAt).toISOString(),
          tags: tags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        })
      });
      const result = (await response.json()) as {
        code: string;
        message?: string;
        data?: { id: string };
      };
      if (!response.ok) {
        setError(result.message ?? "创建项目失败");
        return;
      }
      const projectId = result.data?.id;
      router.push(projectId ? `/projects/${projectId}` : "/projects");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>新建项目</h1>
        <p>仅甲方角色可创建项目。提交后将进入项目中心列表。</p>
      </header>
      <section className="platform-panel">
        <form className="project-form" onSubmit={handleSubmit}>
          <label>
            项目标题
            <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={4} required />
          </label>
          <label>
            项目描述
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={10}
              rows={5}
              required
            />
          </label>
          <div className="project-form-row">
            <label>
              最小预算
              <input
                type="number"
                value={budgetMin}
                onChange={(event) => setBudgetMin(event.target.value)}
                min={1}
                required
              />
            </label>
            <label>
              最大预算
              <input
                type="number"
                value={budgetMax}
                onChange={(event) => setBudgetMax(event.target.value)}
                min={1}
                required
              />
            </label>
          </div>
          <label>
            竞标截止时间
            <input
              type="datetime-local"
              value={biddingEndsAt}
              onChange={(event) => setBiddingEndsAt(event.target.value)}
              required
            />
          </label>
          <label>
            标签（逗号分隔）
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="nlp,cv,llm" />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={submitting}>
            {submitting ? "提交中..." : "创建项目"}
          </button>
        </form>
      </section>
    </main>
  );
}
