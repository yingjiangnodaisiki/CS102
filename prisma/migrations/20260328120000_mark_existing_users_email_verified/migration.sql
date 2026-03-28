-- 启用注册邮箱验证前：将已有用户视为已验证，避免历史账号无法登录
UPDATE "users" SET "isEmailVerified" = true;
