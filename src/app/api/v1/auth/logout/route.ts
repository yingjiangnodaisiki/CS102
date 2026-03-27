import { ok } from "@/lib/utils/api-response";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource user
 */
export async function POST() {
  const response = ok({ loggedOut: true }, 200);
  response.cookies.set("access_token", "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
