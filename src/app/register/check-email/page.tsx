import Link from "next/link";

export default function RegisterCheckEmailPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>请查收邮件</h1>
        <p>
          我们已向你的邮箱发送验证链接（24 小时内有效）。点击邮件中的按钮完成验证后，即可登录平台。
        </p>
        <p>若未收到，请检查垃圾箱；仍没有可在登录页使用「重发验证邮件」。</p>
        <div className="auth-footer">
          <Link href="/login">去登录</Link>
        </div>
      </section>
    </main>
  );
}
