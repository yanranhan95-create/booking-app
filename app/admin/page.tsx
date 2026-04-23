import BookingPage from "../booking-page";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { loginAdminAction, logoutAdminAction } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const authenticated = await isAdminAuthenticated();
  const params = await searchParams;

  if (!authenticated) {
    const showError = params.error === "invalid-password";

    return (
      <main className="page-shell">
        <section className="hero">
          <div>
            <p className="eyebrow">Admin Access</p>
            <h1>Enter the admin password.</h1>
          </div>
          <p className="hero-copy">
            This page is only for managing booked slots and creating new time
            slots.
          </p>
        </section>

        {showError && <section className="notice error">Incorrect password.</section>}

        <section className="auth-shell">
          <form action={loginAdminAction} className="panel stack-form auth-panel">
            <h2>Admin Login</h2>
            <label>
              <span>Password</span>
              <input name="password" required type="password" />
            </label>
            <button type="submit">Open admin page</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="page-shell admin-toolbar-shell">
        <form action={logoutAdminAction}>
          <button className="ghost-button" type="submit">
            Log out
          </button>
        </form>
      </div>
      <BookingPage mode="admin" />
    </>
  );
}
