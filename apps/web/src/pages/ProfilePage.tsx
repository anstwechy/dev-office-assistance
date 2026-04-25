import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeProfileDto } from "@office/types";
import { useAuth, type SessionUser } from "../auth/AuthContext";
import { useApi } from "../useApi";
import { PageHeader } from "../components/PageHeader";

function errorMessage(code: string | undefined): string {
  switch (code) {
    case "email_taken":
      return "That email is already in use by another account.";
    case "invalid_current_password":
      return "Current password is incorrect.";
    case "validation":
      return "Check the fields and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function ProfilePage() {
  const { user, applyAuthRefresh } = useAuth();
  const { request } = useApi();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.displayName ?? "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState(false);
  const [profilePending, setProfilePending] = useState(false);

  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [passwordOk, setPasswordOk] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);

  const [notifyTriage, setNotifyTriage] = useState(false);
  const [notifyDigest, setNotifyDigest] = useState(false);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await request("/api/me");
      if (!res.ok) throw new Error("me_failed");
      return (await res.json()) as MeProfileDto;
    },
  });

  useEffect(() => {
    setEmail(user.email);
    setDisplayName(user.displayName ?? "");
  }, [user.email, user.displayName]);

  useEffect(() => {
    if (!meQuery.data) return;
    setNotifyTriage(meQuery.data.notifyEmailTriage);
    setNotifyDigest(meQuery.data.notifyEmailDigest);
  }, [meQuery.data]);

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Workspace"
        title="Your profile"
        lead="Update how you appear in the app and change your sign-in password. Role is managed separately."
      />

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <div className="card__head">
          <h2 className="card__title">Profile</h2>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setProfileErr(null);
            setProfileOk(false);
            setProfilePending(true);
            try {
              const res = await request("/api/me", {
                method: "PATCH",
                body: JSON.stringify({
                  email: email.toLowerCase().trim(),
                  displayName,
                  notifyEmailTriage: notifyTriage,
                  notifyEmailDigest: notifyDigest,
                }),
              });
              const data = (await res.json().catch(() => ({}))) as {
                error?: string;
                token?: string;
                user?: SessionUser;
              };
              if (!res.ok) {
                throw new Error(data.error ?? "failed");
              }
              if (!data.token || !data.user) {
                throw new Error("invalid_response");
              }
              applyAuthRefresh(data.token, data.user);
              await queryClient.invalidateQueries({ queryKey: ["me"] });
              setProfileOk(true);
            } catch (err) {
              const code = err instanceof Error ? err.message : undefined;
              setProfileErr(errorMessage(code));
            } finally {
              setProfilePending(false);
            }
          }}
        >
          <div className="field">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="profile-display">Display name</label>
            <input
              id="profile-display"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="field field--row">
            <input
              id="notify-triage"
              type="checkbox"
              checked={notifyTriage}
              onChange={(e) => setNotifyTriage(e.target.checked)}
            />
            <label htmlFor="notify-triage" style={{ margin: 0 }}>
              Opt in to triage assignment email (when supported)
            </label>
          </div>
          <div className="field field--row">
            <input
              id="notify-digest"
              type="checkbox"
              checked={notifyDigest}
              onChange={(e) => setNotifyDigest(e.target.checked)}
            />
            <label htmlFor="notify-digest" style={{ margin: 0 }}>
              Opt in to a weekly summary email (when supported)
            </label>
          </div>
          <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.88rem" }}>
            Outbound email is not connected in v1. These settings are stored so a future release can
            send notifications without re-asking.
          </p>
          <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
            Role: <strong>{user.role}</strong>
          </p>
          {profileErr ? (
            <p role="alert" style={{ marginTop: 0 }}>
              {profileErr}
            </p>
          ) : null}
          {profileOk ? (
            <p role="status" className="muted" style={{ marginTop: 0 }}>
              Profile saved.
            </p>
          ) : null}
          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="primary" disabled={profilePending}>
              {profilePending ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card__head">
          <h2 className="card__title">Password</h2>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPasswordErr(null);
            setPasswordOk(false);
            if (newPassword !== confirmPassword) {
              setPasswordErr("New password and confirmation do not match.");
              return;
            }
            if (newPassword.length < 8) {
              setPasswordErr("New password must be at least 8 characters.");
              return;
            }
            setPasswordPending(true);
            try {
              const res = await request("/api/me/password", {
                method: "POST",
                body: JSON.stringify({ currentPassword, newPassword }),
              });
              const data = (await res.json().catch(() => ({}))) as { error?: string };
              if (!res.ok) {
                setPasswordErr(errorMessage(data.error));
                return;
              }
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
              setPasswordOk(true);
            } catch {
              setPasswordErr(errorMessage(undefined));
            } finally {
              setPasswordPending(false);
            }
          }}
        >
          <div className="field">
            <label htmlFor="current-pw">Current password</label>
            <input
              id="current-pw"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-pw">New password</label>
            <input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-pw">Confirm new password</label>
            <input
              id="confirm-pw"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {passwordErr ? (
            <p role="alert" style={{ marginTop: 0 }}>
              {passwordErr}
            </p>
          ) : null}
          {passwordOk ? (
            <p role="status" className="muted" style={{ marginTop: 0 }}>
              Password updated. Use the new password next time you sign in on another device.
            </p>
          ) : null}
          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="primary" disabled={passwordPending}>
              {passwordPending ? "Updating…" : "Change password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
