import { headers } from "next/headers";

export interface RequestMeta {
  ip: string | null;
  device: string | null;
}

export async function getRequestMeta(): Promise<RequestMeta> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : null;
  const device = headerList.get("user-agent");

  return {
    ip,
    device
  };
}
