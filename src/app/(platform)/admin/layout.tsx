import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAccessToken } from "@/lib/utils/jwt";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) {
    redirect("/login?next=%2Fadmin");
  }
  try {
    const payload = verifyAccessToken(token);
    if (payload.role !== "ADMIN") {
      redirect("/dashboard");
    }
  } catch {
    redirect("/login?next=%2Fadmin");
  }
  return <>{children}</>;
}
