"use server";

import { redirect } from "next/navigation";
import { clearAdminAuthenticated, setAdminAuthenticated } from "@/lib/admin-auth";

export async function loginAdminAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    redirect("/admin?error=invalid-password");
  }

  await setAdminAuthenticated();
  redirect("/admin");
}

export async function logoutAdminAction() {
  await clearAdminAuthenticated();
  redirect("/admin");
}
