import { cookies } from "next/headers";

const adminCookieName = "booking_admin_session";
const authenticatedValue = "authenticated";

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get(adminCookieName)?.value === authenticatedValue;
}

export async function setAdminAuthenticated() {
  const cookieStore = await cookies();
  cookieStore.set(adminCookieName, authenticatedValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearAdminAuthenticated() {
  const cookieStore = await cookies();
  cookieStore.delete(adminCookieName);
}
