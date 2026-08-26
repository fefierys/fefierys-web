"use client";

import {
  useActionState,
} from "react";

import {
  loginAction,
  type LoginState,
} from "./actions";

const initialState: LoginState = {
  error: null,
};

export default function LoginForm() {
  const [
    state,
    formAction,
    pending,
  ] =
    useActionState(
      loginAction,
      initialState
    );

  return (
    <form
      action={formAction}
      className="
        flex
        flex-col
        gap-5
      "
    >
      <label
        className="
          flex
          flex-col
          gap-2
        "
      >
        <span>
          Email
        </span>

        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="
            rounded-xl
            border
            border-white/15
            bg-white/5
            px-4
            py-3
            outline-none
          "
        />
      </label>

      <label
        className="
          flex
          flex-col
          gap-2
        "
      >
        <span>
          Password
        </span>

        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="
            rounded-xl
            border
            border-white/15
            bg-white/5
            px-4
            py-3
            outline-none
          "
        />
      </label>

      {state.error && (
        <p
          className="
            text-sm
            text-red-300
          "
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="
          rounded-xl
          border
          border-white/15
          bg-white/10
          px-4
          py-3
          transition
          hover:bg-white/15
          disabled:opacity-50
        "
      >
        {pending
          ? "Signing in..."
          : "Sign in"}
      </button>
    </form>
  );
}