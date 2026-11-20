"use client";

import { useActionState, useState } from "react";
import { signIn, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="grid gap-5" aria-describedby={state.error ? "login-error" : undefined}>
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="font-medium">
          אימייל
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          spellCheck={false}
          enterKeyHint="next"
          dir="ltr"
          required
          defaultValue={state.email}
          aria-invalid={state.error ? true : undefined}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="current-password" className="font-medium">
          סיסמה
        </label>
        <div className="flex gap-2">
          <input
            id="current-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            enterKeyHint="done"
            dir="ltr"
            required
            className="min-w-0 flex-1"
            aria-invalid={state.error ? true : undefined}
          />
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            aria-pressed={showPassword}
            aria-describedby="show-password-warning"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? "הסתרה" : "הצגה"}
            <span className="visually-hidden"> של הסיסמה</span>
          </button>
          <span id="show-password-warning" className="visually-hidden">
            הסיסמה תוצג על המסך.
          </span>
        </div>
      </div>

      <p id="login-error" role="alert" className="text-sm font-medium text-danger empty:hidden">
        {state.error && (
          <>
            <span aria-hidden="true">⚠️ </span>
            {state.error}
          </>
        )}
      </p>

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "נכנסת…" : "כניסה"}
      </button>
    </form>
  );
}
