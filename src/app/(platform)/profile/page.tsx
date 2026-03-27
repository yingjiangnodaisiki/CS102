"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface ProfileData {
  userId: string;
  email: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
  avatarUrl: string | null;
  bio: string | null;
  companyName?: string;
  contactName?: string;
  displayName?: string;
}

interface CapabilityData {
  capabilityPassed: boolean;
  isRiskFrozen: boolean;
  verifiedSkills: string[];
  passScore: number;
  questions: Array<{
    id: string;
    question: string;
    options: Array<{ id: string; label: string }>;
  }>;
}

function ProfileClient() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [capability, setCapability] = useState<CapabilityData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [verifyingCapability, setVerifyingCapability] = useState(false);
  const [requestingPasswordVerification, setRequestingPasswordVerification] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordVerificationToken, setPasswordVerificationToken] = useState("");

  const normalizedAvatarUrl = avatarUrl.trim()
    ? avatarUrl.trim().startsWith("/") || avatarUrl.trim().startsWith("http")
      ? avatarUrl.trim()
      : `/${avatarUrl.trim()}`
    : "";

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/profile/me", { credentials: "include" });
        const result = (await response.json()) as { message?: string; data?: ProfileData };
        if (!response.ok || !result.data) {
          setError(result.message ?? "加载资料失败");
          return;
        }
        setProfile(result.data);
        setAvatarUrl(result.data.avatarUrl ?? "");
        setBio(result.data.bio ?? "");
        setCompanyName(result.data.companyName ?? "");
        setContactName(result.data.contactName ?? "");
        setDisplayName(result.data.displayName ?? "");

        if (result.data.role === "DEVELOPER") {
          const capabilityResponse = await fetch("/api/v1/developer/capability/me", {
            credentials: "include"
          });
          const capabilityResult = (await capabilityResponse.json()) as { message?: string; data?: CapabilityData };
          if (capabilityResponse.ok && capabilityResult.data) {
            setCapability(capabilityResult.data);
          }
        }
      } catch {
        setError("网络异常，请稍后重试");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const token = searchParams?.get("verificationToken") ?? "";
    if (token) {
      setPasswordVerificationToken(token);
      setSuccess("已获取邮箱验证令牌，请继续提交改密");
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const body =
      profile.role === "CLIENT"
        ? {
            ...(normalizedAvatarUrl ? { avatarUrl: normalizedAvatarUrl } : {}),
            ...(bio.trim() ? { bio: bio.trim() } : {}),
            ...(companyName.trim() ? { companyName: companyName.trim() } : {}),
            ...(contactName.trim() ? { contactName: contactName.trim() } : {})
          }
        : {
            ...(normalizedAvatarUrl ? { avatarUrl: normalizedAvatarUrl } : {}),
            ...(bio.trim() ? { bio: bio.trim() } : {}),
            ...(displayName.trim() ? { displayName: displayName.trim() } : {})
          };
    try {
      const response = await fetch("/api/v1/profile/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = (await response.json()) as { message?: string; data?: ProfileData };
      if (!response.ok || !result.data) {
        const detailMessage = (result as { data?: { issues?: Array<{ message?: string }> } }).data?.issues?.[0]?.message;
        setError(detailMessage ?? result.message ?? "保存失败");
        return;
      }
      setProfile(result.data);
      setAvatarUrl(result.data.avatarUrl ?? "");
      setSuccess("资料已保存");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAvatar = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/v1/files/avatar", {
        method: "POST",
        credentials: "include",
        body: formData
      });
      const result = (await response.json()) as { message?: string; data?: { url: string } };
      if (!response.ok || !result.data?.url) {
        setError(result.message ?? "头像上传失败");
        return;
      }
      setAvatarUrl(result.data.url);
      setSuccess("头像上传成功，记得保存资料");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setUploading(false);
    }
  };

  const verifyCapability = async () => {
    if (!capability) {
      return;
    }
    if (capability.capabilityPassed) {
      setSuccess("你已通过能力验证，无需重复验证");
      return;
    }
    if (Object.keys(answers).length < capability.questions.length) {
      setError("请先完成所有题目");
      return;
    }
    setVerifyingCapability(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/v1/developer/capability/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: capability.questions.map((item) => ({
            questionId: item.id,
            optionId: answers[item.id]
          }))
        })
      });
      const result = (await response.json()) as {
        message?: string;
        data?: { capabilityPassed: boolean; score: number; passScore: number; idempotent?: boolean };
      };
      if (!response.ok || !result.data) {
        setError(result.message ?? "能力验证失败");
        return;
      }
      setCapability((current) =>
        current
          ? {
              ...current,
              capabilityPassed: result.data?.capabilityPassed ?? current.capabilityPassed
            }
          : current
      );
      setSuccess(`能力验证通过（得分 ${result.data.score}/${capability.questions.length}），后续无需重复验证`);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setVerifyingCapability(false);
    }
  };

  const requestPasswordVerification = async () => {
    setRequestingPasswordVerification(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/v1/auth/password/change/request-verification", {
        method: "POST",
        credentials: "include"
      });
      const result = (await response.json()) as {
        message?: string;
        data?: { verificationToken?: string; verifyUrl?: string };
      };
      if (!response.ok) {
        setError(result.message ?? "邮箱验证申请失败");
        return;
      }
      if (result.data?.verificationToken) {
        setPasswordVerificationToken(result.data.verificationToken);
      }
      if (result.data?.verifyUrl) {
        setSuccess(`邮箱验证已发送。开发环境调试链接：${result.data.verifyUrl}`);
      } else {
        setSuccess("邮箱验证已发送，请查收邮箱后完成改密。");
      }
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setRequestingPasswordVerification(false);
    }
  };

  const changePassword = async () => {
    if (!passwordVerificationToken.trim()) {
      setError("请先完成邮箱验证");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("两次新密码输入不一致");
      return;
    }
    setChangingPassword(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/v1/auth/password/change", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          verificationToken: passwordVerificationToken.trim()
        })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "修改密码失败");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordVerificationToken("");
      setSuccess("密码修改成功，请使用新密码重新登录。");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <main className="platform-page"><div className="empty-state">资料加载中...</div></main>;
  }

  if (!profile) {
    return <main className="platform-page"><div className="empty-state">{error ?? "资料不存在"}</div></main>;
  }

  return (
    <main className="platform-page">
      <header className="platform-page-header">
        <h1>用户主页</h1>
        <p>管理账户头像与基础信息，更新后会用于投标和项目协作展示。</p>
      </header>

      <section className="platform-panel">
        <form className="project-form" onSubmit={handleSubmit}>
          <label>
            用户UUID
            <div className="uuid-row">
              <input value={profile.userId} disabled />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(profile.userId)}
              >
                复制
              </button>
            </div>
          </label>
          <label>
            账户邮箱
            <input value={profile.email} disabled />
          </label>
          <label>
            头像上传（jpg/png/webp，2MB内）
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleUploadAvatar(file);
                }
              }}
            />
          </label>
          {avatarUrl ? (
            <div className="avatar-preview">
              <img src={avatarUrl} alt="avatar" />
            </div>
          ) : null}
          <label>
            头像地址（URL）
            <input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." />
          </label>
          <label>
            个人简介
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} maxLength={500} />
          </label>

          {profile.role === "CLIENT" ? (
            <div className="project-form-row">
              <label>
                公司名称
                <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required minLength={2} />
              </label>
              <label>
                联系人
                <input value={contactName} onChange={(event) => setContactName(event.target.value)} required minLength={2} />
              </label>
            </div>
          ) : (
            <>
              <label>
                显示名称
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} />
              </label>
              <section className="platform-panel nested-panel">
                <h3>能力验证</h3>
                <p className="small-tip">
                  状态：{capability?.capabilityPassed ? "已通过" : "未通过"}
                  {capability?.isRiskFrozen ? "（风控冻结）" : ""}
                </p>
                <p className="small-tip">通过条件：答对至少 {capability?.passScore ?? 0} 题。</p>
                {(capability?.questions ?? []).map((question) => (
                  <label key={question.id}>
                    {question.question}
                    <select
                      value={answers[question.id] ?? ""}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: event.target.value
                        }))
                      }
                      disabled={Boolean(capability?.isRiskFrozen) || Boolean(capability?.capabilityPassed)}
                    >
                      <option value="">请选择</option>
                      {question.options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <div className="inline-actions">
                  <button
                    type="button"
                    className="mini-action-btn"
                    onClick={verifyCapability}
                    disabled={verifyingCapability || Boolean(capability?.isRiskFrozen) || Boolean(capability?.capabilityPassed)}
                  >
                    {verifyingCapability ? "验证中..." : "提交能力验证"}
                  </button>
                </div>
              </section>
            </>
          )}

          <section className="platform-panel nested-panel">
            <h3>修改密码（需邮箱验证）</h3>
            <p className="small-tip">
              安全要求：忘记密码与登录后改密都必须先完成邮箱验证。
            </p>
            <div className="inline-actions">
              <button
                type="button"
                className="mini-action-btn"
                onClick={requestPasswordVerification}
                disabled={requestingPasswordVerification}
              >
                {requestingPasswordVerification ? "发送中..." : "发送邮箱验证"}
              </button>
            </div>
            <div className="project-form">
              <label>
                邮箱验证令牌
                <input
                  value={passwordVerificationToken}
                  onChange={(event) => setPasswordVerificationToken(event.target.value)}
                  placeholder="邮箱验证后获得（开发环境可自动回填）"
                  required
                />
              </label>
              <label>
                当前密码
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <label>
                新密码
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <label>
                确认新密码
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <button
                type="button"
                className="mini-action-btn"
                onClick={() => void changePassword()}
                disabled={changingPassword}
              >
                {changingPassword ? "提交中..." : "确认修改密码"}
              </button>
            </div>
          </section>

          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={saving}>
            {saving ? "保存中..." : "保存资料"}
          </button>
          {uploading ? <p className="small-tip">头像上传中...</p> : null}
        </form>
      </section>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className="platform-page"><div className="empty-state">资料加载中...</div></main>}>
      <ProfileClient />
    </Suspense>
  );
}
