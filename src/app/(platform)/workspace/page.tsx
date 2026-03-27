"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";

interface MeData {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface WorkspaceSubmissionItem {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  createdAt: string;
  project: { id: string; title: string; clientId: string };
  submitterUser?: { id: string };
}

interface MessageItem {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
}

interface ConversationItem {
  projectId: string;
  projectTitle: string;
  counterpartUserId: string;
  lastMessage: string;
  lastMessageAt: string;
}

interface WorkspaceTodoItem {
  projectId: string;
  title: string;
  status: string;
  clientId: string;
  acceptedDeveloperId: string | null;
  latestSubmissionStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  latestSubmissionAt: string | null;
  counterpartUserId: string | null;
  isCompleted: boolean;
}

interface WorkspaceSubmissionDraft {
  projectId: string;
  title: string;
  description: string;
  fileMeta: {
    fileName: string;
    url: string;
    fileSize: number;
    mimeType: string;
  } | null;
}

const WORKSPACE_SUBMISSION_DRAFT_KEY = "ai-dev-platform-workspace-submission-draft";
const WORKSPACE_MESSAGE_DRAFT_KEY = "ai-dev-platform-workspace-message-draft";
const WORKSPACE_REVIEW_NOTE_DRAFT_KEY = "ai-dev-platform-workspace-review-note-draft";

export default function WorkspacePage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileMeta, setFileMeta] = useState<{
    fileName: string;
    url: string;
    fileSize: number;
    mimeType: string;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<WorkspaceSubmissionItem[]>([]);
  const [todoProjects, setTodoProjects] = useState<WorkspaceTodoItem[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [messageContent, setMessageContent] = useState("");
  const [composeProjectId, setComposeProjectId] = useState("");
  const [composeReceiverId, setComposeReceiverId] = useState("");
  const [projectMessages, setProjectMessages] = useState<MessageItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationKey, setActiveConversationKey] = useState<string | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    try {
      const submissionDraftRaw = window.localStorage.getItem(WORKSPACE_SUBMISSION_DRAFT_KEY);
      if (submissionDraftRaw) {
        const submissionDraft = JSON.parse(submissionDraftRaw) as WorkspaceSubmissionDraft;
        setProjectId(submissionDraft.projectId ?? "");
        setTitle(submissionDraft.title ?? "");
        setDescription(submissionDraft.description ?? "");
        setFileMeta(submissionDraft.fileMeta ?? null);
      }
    } catch {
      window.localStorage.removeItem(WORKSPACE_SUBMISSION_DRAFT_KEY);
    }

    try {
      const messageDraftRaw = window.localStorage.getItem(WORKSPACE_MESSAGE_DRAFT_KEY);
      if (messageDraftRaw) {
        const messageDraft = JSON.parse(messageDraftRaw) as {
          composeProjectId: string;
          composeReceiverId: string;
          messageContent: string;
        };
        setComposeProjectId(messageDraft.composeProjectId ?? "");
        setComposeReceiverId(messageDraft.composeReceiverId ?? "");
        setMessageContent(messageDraft.messageContent ?? "");
      }
    } catch {
      window.localStorage.removeItem(WORKSPACE_MESSAGE_DRAFT_KEY);
    }

    try {
      const reviewDraftRaw = window.localStorage.getItem(WORKSPACE_REVIEW_NOTE_DRAFT_KEY);
      if (reviewDraftRaw) {
        const notes = JSON.parse(reviewDraftRaw) as Record<string, string>;
        setReviewNotes(notes);
      }
    } catch {
      window.localStorage.removeItem(WORKSPACE_REVIEW_NOTE_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    const draft: WorkspaceSubmissionDraft = {
      projectId,
      title,
      description,
      fileMeta
    };
    window.localStorage.setItem(WORKSPACE_SUBMISSION_DRAFT_KEY, JSON.stringify(draft));
  }, [projectId, title, description, fileMeta]);

  useEffect(() => {
    window.localStorage.setItem(
      WORKSPACE_MESSAGE_DRAFT_KEY,
      JSON.stringify({
        composeProjectId,
        composeReceiverId,
        messageContent
      })
    );
  }, [composeProjectId, composeReceiverId, messageContent]);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_REVIEW_NOTE_DRAFT_KEY, JSON.stringify(reviewNotes));
  }, [reviewNotes]);

  const loadSubmissions = async () => {
    try {
      const response = await fetch("/api/v1/workspace/submissions", {
        credentials: "include"
      });
      const result = (await response.json()) as { message?: string; data?: WorkspaceSubmissionItem[] };
      if (!response.ok) {
        setError(result.message ?? "加载工作区失败");
        return;
      }
      setSubmissions(result.data ?? []);
    } catch {
      setError("网络异常，请稍后重试");
    }
  };

  const loadTodoProjects = async () => {
    try {
      const response = await fetch("/api/v1/workspace/todos", {
        credentials: "include"
      });
      const result = (await response.json()) as {
        message?: string;
        data?: WorkspaceTodoItem[];
      };
      if (!response.ok) {
        setError(result.message ?? "加载工作区待办失败");
        return;
      }
      setTodoProjects(result.data ?? []);
    } catch {
      setError("网络异常，请稍后重试");
    }
  };

  const loadConversations = async () => {
    try {
      const response = await fetch("/api/v1/messages/conversations", {
        credentials: "include"
      });
      const result = (await response.json()) as {
        message?: string;
        data?: ConversationItem[];
      };
      if (!response.ok) {
        setError(result.message ?? "加载会话失败");
        return;
      }
      setConversations(result.data ?? []);
      if (!activeConversationKey && (result.data?.length ?? 0) > 0) {
        const first = result.data?.[0];
        if (first) {
          setActiveConversationKey(`${first.projectId}:${first.counterpartUserId}`);
        }
      }
    } catch {
      setError("网络异常，请稍后重试");
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const meResponse = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (meResponse.ok) {
          const meResult = (await meResponse.json()) as { data: MeData };
          setMe(meResult.data);
        }
      } catch {
        setError("身份信息加载失败");
      }
      await Promise.all([loadSubmissions(), loadTodoProjects(), loadConversations()]);
    };
    void init();
  }, []);

  useEffect(() => {
    const preventWindowDrop = (event: Event) => {
      event.preventDefault();
    };
    window.addEventListener("dragover", preventWindowDrop);
    window.addEventListener("drop", preventWindowDrop);
    return () => {
      window.removeEventListener("dragover", preventWindowDrop);
      window.removeEventListener("drop", preventWindowDrop);
    };
  }, []);

  const uploadFile = async (
    file: File
  ): Promise<{ fileName: string; url: string; fileSize: number; mimeType: string } | null> => {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/v1/files/workspace", {
        method: "POST",
        credentials: "include",
        body: formData
      });
      const result = (await response.json()) as {
        code?: string;
        message?: string;
        data?: { fileName: string; url: string; fileSize: number; mimeType: string };
      };
      if (!response.ok || !result.data) {
        setError(result.message ?? `上传失败（${result.code ?? "UNKNOWN"}）`);
        return null;
      }
      setFileMeta(result.data);
      setTitle((current) => current || result.data?.fileName || "");
      setSelectedFile(null);
      setSuccess("文件上传成功，可提交给甲方审核");
      return result.data;
    } catch {
      setError("网络异常，请稍后重试");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    setSelectedFile(file);
    await uploadFile(file);
  };

  const submitWorkspace = async () => {
    let effectiveFileMeta = fileMeta;
    if (!effectiveFileMeta && selectedFile) {
      const uploadedMeta = await uploadFile(selectedFile);
      if (uploadedMeta) {
        effectiveFileMeta = uploadedMeta;
      }
    }
    if (!effectiveFileMeta || !effectiveFileMeta.url) {
      setError("请先上传文件（仅“选择文件”不等于上传成功）");
      return;
    }
    if (!projectId.trim()) {
      setError("请填写项目ID");
      return;
    }
    if (!title.trim() || title.trim().length < 2) {
      setError("请填写至少2个字符的交付标题");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/workspace/submissions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title,
          description: description || undefined,
          fileName: effectiveFileMeta.fileName,
          fileUrl: effectiveFileMeta.url,
          fileSize: effectiveFileMeta.fileSize,
          mimeType: effectiveFileMeta.mimeType
        })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "提交失败");
        return;
      }
      setSuccess("交付物已提交，等待甲方审核");
      setFileMeta(null);
      setSelectedFile(null);
      setProjectId("");
      setTitle("");
      setDescription("");
      window.localStorage.removeItem(WORKSPACE_SUBMISSION_DRAFT_KEY);
      await Promise.all([loadSubmissions(), loadTodoProjects()]);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const reviewSubmission = async (id: string, action: "APPROVE" | "REJECT") => {
    const note = reviewNotes[id]?.trim() ?? "";
    if (action === "REJECT" && note.length < 5) {
      setError("驳回时请填写至少5个字符的审核意见");
      return;
    }
    setReviewingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/v1/workspace/submissions/${id}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewNote: note || undefined
        })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "审核失败");
        return;
      }
      setSuccess(action === "APPROVE" ? "已通过该交付物" : "已驳回该交付物");
      setReviewNotes((current) => ({ ...current, [id]: "" }));
      await Promise.all([loadSubmissions(), loadTodoProjects()]);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setReviewingId(null);
    }
  };

  const pendingCount = useMemo(() => submissions.filter((item) => item.status === "PENDING").length, [submissions]);

  const activeConversation = useMemo(() => {
    if (!activeConversationKey) {
      return null;
    }
    return conversations.find((item) => `${item.projectId}:${item.counterpartUserId}` === activeConversationKey) ?? null;
  }, [activeConversationKey, conversations]);

  const loadProjectMessages = async (targetProjectId: string) => {
    if (!targetProjectId.trim()) {
      setError("请选择项目后再加载消息");
      return;
    }
    setMessageLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/projects/${targetProjectId}/messages?page=1&pageSize=20`, {
        credentials: "include"
      });
      const result = (await response.json()) as { message?: string; data?: { items?: MessageItem[] } };
      if (!response.ok) {
        setError(result.message ?? "加载项目消息失败");
        return;
      }
      setProjectMessages((result.data?.items ?? []).reverse());
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setMessageLoading(false);
    }
  };

  useEffect(() => {
    if (!activeConversation) {
      setProjectMessages([]);
      return;
    }
    void loadProjectMessages(activeConversation.projectId);
  }, [activeConversationKey]);

  const sendWorkspaceMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetProjectId = activeConversation?.projectId ?? composeProjectId.trim();
    const targetReceiverId = activeConversation?.counterpartUserId ?? composeReceiverId.trim();
    if (!targetProjectId) {
      setError("请先选择项目会话或填写项目ID");
      return;
    }
    if (!targetReceiverId) {
      setError("请先选择会话对象或填写接收人ID");
      return;
    }
    if (!messageContent.trim()) {
      setError("请填写消息内容");
      return;
    }

    setError(null);
    setSendingMessage(true);
    try {
      const response = await fetch("/api/v1/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: targetProjectId,
          receiverId: targetReceiverId,
          content: messageContent.trim()
        })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "发送消息失败");
        return;
      }
      setMessageContent("");
      setComposeProjectId("");
      setComposeReceiverId("");
      window.localStorage.removeItem(WORKSPACE_MESSAGE_DRAFT_KEY);
      setActiveConversationKey(`${targetProjectId}:${targetReceiverId}`);
      await Promise.all([loadProjectMessages(targetProjectId), loadConversations()]);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>工作区</h1>
        <p>乙方上传项目交付物，甲方在此接收并审核。</p>
      </header>

      {me?.role === "DEVELOPER" ? (
        <section className="platform-panel">
          <h3>乙方上传区（支持拖拽）</h3>
          <div
            onDrop={(event) => void handleDrop(event)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            style={{
              border: dragActive ? "1px dashed #38bdf8" : "1px dashed #aaa",
              background: dragActive ? "rgba(14, 116, 144, 0.22)" : "transparent",
              padding: 16,
              borderRadius: 8,
              marginBottom: 12
            }}
          >
            <p className="small-tip">把文件拖到这里，或手动选择上传（最大 200MB）。支持 zip/pdf/docx/xlsx/txt/json/md/png/jpg/webp。</p>
            <input
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setSelectedFile(file);
                  void uploadFile(file);
                }
              }}
            />
          </div>
          {selectedFile && !fileMeta ? <p className="small-tip">已选择文件：{selectedFile.name}（等待上传结果）</p> : null}
          <div className="project-form-row">
            <label>
              项目ID
              <input value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="项目UUID" />
            </label>
            <label>
              标题
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="交付标题" />
            </label>
          </div>
          <label>
            描述
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </label>
          {fileMeta ? <p className="small-tip">已上传文件：{fileMeta.fileName}</p> : null}
          {!fileMeta ? <p className="small-tip">未检测到上传文件，无法提交审核。</p> : null}
          <button type="button" className="mini-action-btn" onClick={submitWorkspace} disabled={uploading || submitting}>
            {uploading ? "上传中..." : submitting ? "提交中..." : "提交给甲方审核"}
          </button>
        </section>
      ) : null}

      <section className="platform-panel">
        <div className="panel-title-row">
          <h3>工作区待办</h3>
          <span className="small-tip">中标未完成：{todoProjects.length}</span>
        </div>
        {todoProjects.length === 0 ? (
          <p className="small-tip">当前没有中标待办项目。</p>
        ) : (
          <div className="list-table">
            {todoProjects.map((item) => (
              <article key={item.projectId} className="list-item">
                <div>
                  <p>
                    <strong>{item.title}</strong>
                  </p>
                  <p className="small-tip">项目状态：{item.status}</p>
                  <p className="small-tip">交付状态：{item.latestSubmissionStatus ?? "未提交"}</p>
                </div>
                <div className="inline-actions">
                  {me?.role === "DEVELOPER" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setProjectId(item.projectId);
                        setTitle((current) => current || `${item.title} - 交付物`);
                        setSuccess("已自动填充项目ID，请上传文件后提交审核");
                      }}
                    >
                      填入交付表单
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (item.counterpartUserId) {
                        setActiveConversationKey(`${item.projectId}:${item.counterpartUserId}`);
                        setComposeProjectId("");
                        setComposeReceiverId("");
                      } else {
                        setActiveConversationKey(null);
                        setComposeProjectId(item.projectId);
                      }
                    }}
                  >
                    去沟通
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="platform-panel">
        <div className="panel-title-row">
          <h3>交付物列表</h3>
          <span className="small-tip">待审核：{pendingCount}</span>
        </div>
        <div className="simple-table">
          <div className="simple-table-header">
            <span>项目</span>
            <span>交付标题</span>
            <span>文件</span>
            <span>状态</span>
          </div>
          {submissions.map((item) => (
            <div className="simple-table-row" key={item.id}>
              <span>{item.project.title}</span>
              <span>{item.title}</span>
              <span>
                <a href={item.fileUrl} target="_blank" rel="noreferrer">
                  {item.fileName}
                </a>
              </span>
              <span>
                <span>{item.status}</span>
                {item.status === "REJECTED" && item.reviewNote ? (
                  <div className="workspace-review-note">
                    <strong>驳回意见：</strong>
                    <span>{item.reviewNote}</span>
                  </div>
                ) : null}
                {(me?.role === "CLIENT" || me?.role === "ADMIN") && item.status === "PENDING" ? (
                  <span style={{ marginLeft: 8, display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input
                      value={reviewNotes[item.id] ?? ""}
                      onChange={(event) =>
                        setReviewNotes((current) => ({
                          ...current,
                          [item.id]: event.target.value
                        }))
                      }
                      placeholder="审核意见（驳回必填）"
                    />
                    <button type="button" onClick={() => void reviewSubmission(item.id, "APPROVE")} disabled={reviewingId === item.id}>
                      通过
                    </button>
                    <button type="button" onClick={() => void reviewSubmission(item.id, "REJECT")} disabled={reviewingId === item.id}>
                      驳回
                    </button>
                  </span>
                ) : null}
                <button
                  type="button"
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    const counterpartUserId =
                      me?.role === "CLIENT" ? item.submitterUser?.id ?? null : item.project.clientId;
                    if (!counterpartUserId) {
                      setError("该交付物缺少提交者信息，无法发起会话");
                      return;
                    }
                    setActiveConversationKey(`${item.projectId}:${counterpartUserId}`);
                    setComposeProjectId("");
                    setComposeReceiverId("");
                  }}
                >
                  项目沟通
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="platform-panel">
        <h3>工作区项目消息</h3>
        <div className="wechat-shell" style={{ marginTop: 12 }}>
          <aside className="wechat-sidebar">
            <div className="wechat-sidebar-head">
              <h3>会话列表</h3>
            </div>
            {conversations.length === 0 ? <p className="empty-tip">暂无会话</p> : null}
            {conversations.map((item) => {
              const key = `${item.projectId}:${item.counterpartUserId}`;
              const active = key === activeConversationKey;
              return (
                <button
                  type="button"
                  key={key}
                  className={`wechat-conversation-item${active ? " active" : ""}`}
                  onClick={() => {
                    setActiveConversationKey(key);
                    setComposeProjectId("");
                    setComposeReceiverId("");
                  }}
                >
                  <strong>{item.projectTitle}</strong>
                  <span>对方：{item.counterpartUserId.slice(0, 8)}...</span>
                  <span>{item.lastMessage}</span>
                  <span>{new Date(item.lastMessageAt).toLocaleString("zh-CN")}</span>
                </button>
              );
            })}
          </aside>
          <div className="wechat-main">
            <div className="wechat-chat-head">
              <h3>{activeConversation ? activeConversation.projectTitle : "新会话"}</h3>
              <p>
                {activeConversation
                  ? `对方：${activeConversation.counterpartUserId}`
                  : "可在待办或交付物中点击“项目沟通”，也可手动填写项目和接收人"}
              </p>
            </div>
            <div className="wechat-chat-body">
              {messageLoading ? <p className="small-tip">消息加载中...</p> : null}
              {!messageLoading && projectMessages.length === 0 ? <p className="small-tip">暂无消息</p> : null}
              {projectMessages.map((item) => {
                const isMe = item.senderId === me?.userId;
                return (
                  <div key={item.id} className={`wechat-msg-row${isMe ? " me" : ""}`}>
                    <div className={`wechat-msg-bubble${isMe ? " me" : ""}`}>
                      <p>{item.content}</p>
                      <small>{new Date(item.createdAt).toLocaleString("zh-CN")}</small>
                    </div>
                  </div>
                );
              })}
            </div>
            <form className="wechat-composer" onSubmit={sendWorkspaceMessage}>
              {!activeConversation ? (
                <div className="project-form-row">
                  <label>
                    项目ID
                    <input
                      value={composeProjectId}
                      onChange={(event) => setComposeProjectId(event.target.value)}
                      placeholder="项目UUID"
                    />
                  </label>
                  <label>
                    接收人ID
                    <input
                      value={composeReceiverId}
                      onChange={(event) => setComposeReceiverId(event.target.value)}
                      placeholder="接收方用户UUID"
                    />
                  </label>
                </div>
              ) : null}
              <textarea
                value={messageContent}
                onChange={(event) => setMessageContent(event.target.value)}
                rows={3}
                placeholder="输入消息，回车发送（Shift+Enter 换行）"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    const form = event.currentTarget.form;
                    if (form) {
                      form.requestSubmit();
                    }
                  }
                }}
              />
              <div className="wechat-composer-actions">
                <span className="small-tip">
                  当前项目：{(activeConversation?.projectId ?? composeProjectId) || "未指定"}
                </span>
                <button type="submit" className="mini-action-btn" disabled={sendingMessage}>
                  {sendingMessage ? "发送中..." : "发送"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}
    </main>
  );
}
