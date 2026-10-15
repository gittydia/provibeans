import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_LABELS } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/auth";
import { AppShell } from "./app-shell";
import { AppNav } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reason=auth");

  return (
    <AppShell
      sidebar={
        <>
          <div>
            <Link className="side-mark" href="/dashboard">
              PROVI<span>BEANS</span>
            </Link>
            <p className="side-sub">Stock control</p>
          </div>

          <AppNav />

          <div className="side-foot">
            <strong>{user.name}</strong>
            {ROLE_LABELS[user.role]}
            <form action={logoutAction}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
