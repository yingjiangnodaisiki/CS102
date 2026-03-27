"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

interface UserSearchItem {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
}

interface PublicProfile {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
  avatarUrl: string | null;
  bio: string | null;
  companyName?: string;
  contactName?: string;
  displayName?: string;
}

export default function MessagesPage() {
  const [me, setMe] = useState<{ userId: string } | null>(null);
  const [content, setContent] = useState("");
  const [newConversationProjectId, setNewConversationProjectId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [activeConversationKey, setActiveConversationKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [sending, setSending] = useState(false);
  const [userKeyword, setUserKeyword] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<UserSearchItem[]>([]);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const response = await fetch("/api/v1/auth/me", {
          credentials: "include"
        });
        if (response.ok) {
          const result = (await response.json()) as { data: { userId: string } };
          setMe(result.data);
        }
      } catch {
        // ignore
      }
    };
    void loadMe();
  }, []);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoadingConversations(true);
        const response = await fetch("/api/v1/messages/conversations", {
          credentials: "include"
        });
        const result = (await response.json()) as { message?: string; data?: ConversationItem[] };
        if (!response.ok) {
          setError(result.message ?? "加载会话失败");
          return;
        }
        const items = result.data ?? [];
        setConversations(items);
        if (items.length > 0 && !activeConversationKey) {
          const first = items[0];
          setActiveConversationKey(`${first.projectId}:${first.counterpartUserId}`);
        }
      } catch {
        setError("网络异常，请稍后重试");
      } finally {
        setLoadingConversations(false);
      }
    };
    void loadConversations();
  }, [activeConversationKey]);

  const activeConversation = useMemo(() => {
    if (!activeConversationKey) {
      return null;
    }
    return conversations.find((item) => `${item.projectId}:${item.counterpartUserId}` === activeConversationKey) ?? null;
  }, [activeConversationKey, conversations]);

  const loadMessages = async (projectId: string) => {
    if (!projectId) {
      return;
    }
    setError(null);
    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/messages?page=1&pageSize=50`, {
        credentials: "include"
      });
      const result = (await response.json()) as {
        message?: string;
        data?: { items?: MessageItem[] };
      };
      if (!response.ok) {
        setError(result.message ?? "加载消息失败");
        return;
      }
      setMessages(result.data?.items ?? []);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }
    void loadMessages(activeConversation.projectId);
  }, [activeConversationKey]);

  useEffect(() => {
    const loadProfiles = async () => {
      const ids = Array.from(new Set(conversations.map((item) => item.counterpartUserId)));
      if (ids.length === 0) {
        return;
      }
      const loaded = await Promise.all(
        ids.map(async (id) => {
          try {
            const response = await fetch(`/api/v1/users/${id}/profile`, {
              credentials: "include"
            });
            if (!response.ok) {
              return null;
            }
            const result = (await response.json()) as { data?: PublicProfile };
            if (!result.data) {
              return null;
            }
            return { id, profile: result.data };
          } catch {
            return null;
          }
        })
      );
      const nextMap: Record<string, PublicProfile> = {};
      for (const item of loaded) {
        if (item) {
          nextMap[item.id] = item.profile;
        }
      }
      setProfiles(nextMap);
    };
    void loadProfiles();
  }, [conversations]);

  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetReceiverId = receiverId.trim() || activeConversation?.counterpartUserId || "";
    const targetProjectId = newConversationProjectId.trim() || activeConversation?.projectId || "";
    if (!targetReceiverId) {
      setError("请选择会话对象");
      return;
    }
    if (!targetProjectId) {
      setError("请先选择或填写项目ID");
      return;
    }
    if (!content.trim()) {
      setError("请输入消息内容");
      return;
    }

    setError(null);
    setSending(true);
    try {
      const response = await fetch("/api/v1/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: targetProjectId,
          receiverId: targetReceiverId,
          content: content.trim()
        })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "发送失败");
        return;
      }
      setContent("");
      setReceiverId("");
      setNewConversationProjectId("");
      if (targetProjectId && targetReceiverId) {
        setActiveConversationKey(`${targetProjectId}:${targetReceiverId}`);
      }
      await loadMessages(targetProjectId);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSending(false);
    }
  };

  const searchUsers = async () => {
    setError(null);
    try {
      const response = await fetch(`/api/v1/users/search?q=${encodeURIComponent(userKeyword.trim())}`, {
        credentials: "include"
      });
      const result = (await response.json()) as { message?: string; data?: UserSearchItem[] };
      if (!response.ok) {
        setError(result.message ?? "搜索用户失败");
        return;
      }
      setSearchedUsers(result.data ?? []);
    } catch {
      setError("网络异常，请稍后重试");
    }
  };

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>消息中心</h1>
        <p>微信式聊天：左侧会话列表，右侧消息窗口，支持搜索用户快速发起沟通。</p>
      </header>

      <section className="platform-panel wechat-shell">
        <aside className="wechat-sidebar">
          <div className="wechat-sidebar-head">
            <h3>会话列表</h3>
            {loadingConversations ? <span className="small-tip">加载中...</span> : null}
          </div>

          <div className="wechat-search-box">
            <input
              value={userKeyword}
              onChange={(event) => setUserKeyword(event.target.value)}
              placeholder="搜索用户（邮箱/公司/昵称）"
            />
            <button type="button" className="mini-action-btn" onClick={searchUsers}>
              搜索
            </button>
          </div>

          {searchedUsers.length > 0 ? (
            <div className="wechat-search-result">
              {searchedUsers.map((item) => (
                <button
                  type="button"
                  key={item.userId}
                  className="wechat-search-user"
                  onClick={() => {
                    setReceiverId(item.userId);
                    setActiveConversationKey(null);
                    setError(null);
                  }}
                >
                  <strong>{item.displayName}</strong>
                  <span>{item.role}</span>
                </button>
              ))}
            </div>
          ) : null}

          {conversations.length === 0 ? <p className="empty-tip">暂无会话</p> : null}
          {conversations.map((item) => {
            const key = `${item.projectId}:${item.counterpartUserId}`;
            const active = key === activeConversationKey;
            const profile = profiles[item.counterpartUserId];
            const displayName = profile?.displayName ?? profile?.contactName ?? profile?.companyName ?? item.counterpartUserId.slice(0, 8);
            return (
              <button
                type="button"
                key={key}
                className={`wechat-conversation-item${active ? " active" : ""}`}
                onClick={() => {
                  setReceiverId("");
                  setNewConversationProjectId("");
                  setActiveConversationKey(key);
                }}
              >
                <strong>{displayName}</strong>
                <span>{item.projectTitle}</span>
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
                ? `对方：${profiles[activeConversation.counterpartUserId]?.displayName ?? activeConversation.counterpartUserId.slice(0, 8)}`
                : "从左侧会话中选择，或先搜索用户并填写项目ID后发送消息"}
            </p>
          </div>

          <div className="wechat-chat-body">
            {loadingMessages ? <p className="small-tip">消息加载中...</p> : null}
            {!loadingMessages && orderedMessages.length === 0 ? <p className="small-tip">暂无消息</p> : null}
            {orderedMessages.map((item) => {
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

          <form className="wechat-composer" onSubmit={handleSend}>
            {!activeConversation ? (
              <div className="project-form-row">
                <label>
                  接收人ID
                  <input
                    value={receiverId}
                    onChange={(event) => setReceiverId(event.target.value)}
                    placeholder="从左侧搜索用户后自动填充，或手动输入"
                  />
                </label>
                <label>
                  项目ID
                  <input
                    value={newConversationProjectId}
                    onChange={(event) => setNewConversationProjectId(event.target.value)}
                    placeholder="首次会话必须填写项目ID"
                  />
                </label>
              </div>
            ) : null}
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
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
              {error ? <div className="form-error">{error}</div> : null}
              <button type="submit" className="mini-action-btn" disabled={sending}>
                {sending ? "发送中..." : "发送"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
