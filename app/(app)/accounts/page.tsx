"use client";

import { ROLE_LABELS, canManageAccounts, canViewAccounts, useMockStore } from "@/lib/mock-store";
import { AccountForm, AccountStateControl } from "./forms";
import { BackupPanel } from "./backup";

export default function AccountsPage() {
  const { state, user } = useMockStore();
  if (!user) return null;

  if (!canViewAccounts(user.role)) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Accounts</h1>
            <p>Create sign-in accounts for staff, and deactivate ones that should stop signing in.</p>
          </div>
        </div>
        <p className="notice notice-crit" role="note">
          Only an administrator or the owner may view accounts.
        </p>
      </>
    );
  }

  const canManage = canManageAccounts(user.role);
  const rows = [...state.users].sort((a, b) => a.email.localeCompare(b.email));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Accounts</h1>
          <p>
            {canManage
              ? "Create sign-in accounts for staff, and deactivate ones that should stop signing in."
              : "The account list is visible for oversight. An administrator manages accounts and backups."}
          </p>
        </div>
      </div>

      <section className="panel">
        <header>
          <h2>Accounts</h2>
          <p>{rows.length} accounts</p>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">State</th>
              {canManage ? <th scope="col">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 5 : 4}>
                  <p className="empty">No accounts yet.</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.name}
                    {row.id === user.id ? (
                      <div>
                        <span className="badge badge-mute">You</span>
                      </div>
                    ) : null}
                  </td>
                  <td className="code">{row.email}</td>
                  <td className="muted">{ROLE_LABELS[row.role]}</td>
                  <td>
                    {row.isActive ? (
                      <span className="badge badge-ok">Active</span>
                    ) : (
                      <span className="badge badge-mute">Inactive</span>
                    )}
                  </td>
                  {canManage ? (
                    <td>
                      {row.id === user.id ? (
                        <span className="muted">Signed in</span>
                      ) : (
                        <AccountStateControl userId={row.id} email={row.email} isActive={row.isActive} />
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="panel-body muted">
          Deactivating blocks sign-in and keeps the account, so it can be switched back on later.
        </p>
      </section>

      {canManage ? (
        <>
          <section className="panel">
            <header>
              <h2>Add an account</h2>
              <p>New accounts can sign in immediately.</p>
            </header>
            <div className="panel-body">
              <AccountForm actorRole={user.role} />
            </div>
          </section>

          <BackupPanel />
        </>
      ) : (
        <p className="notice" role="note">
          Your role has read-only access. Only an administrator may add accounts, deactivate them, or
          restore a backup.
        </p>
      )}
    </>
  );
}
