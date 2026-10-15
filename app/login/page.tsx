import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { SignInForm } from "./signin-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { reason } = await searchParams;

  return (
    <div className="signin">
      <div className="signin-card">
        <p className="eyebrow">Provi Beans</p>
        <h1>Stock control</h1>
        <p>
          Sign in to the inventory and stock monitoring system. The demo administrator account is already
          filled in — press <strong>Sign in</strong> to continue.
        </p>

        {reason === "signed-out" ? (
          <p className="notice notice-ok" role="status">
            You have been signed out.
          </p>
        ) : null}

        <SignInForm action={loginAction} initialState={{} as LoginState} />

        <div className="demo">
          <strong>Demo accounts</strong> — password <code>ProviBeans2026</code>
          <br />
          <code>admin@provibeans.ph</code> administrator
          <br />
          <code>staff@provibeans.ph</code> inventory staff
          <br />
          <code>owner@provibeans.ph</code> owner / manager
        </div>

        <p className="faint" style={{ marginTop: 18, marginBottom: 0 }}>
          <Link href="/">← Back to the public site</Link>
        </p>
      </div>
    </div>
  );
}