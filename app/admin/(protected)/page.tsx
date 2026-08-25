import {
  requireAdmin,
} from "@/lib/auth/admin";

import {
  logoutAction,
} from "./actions";

export default async function AdminPage() {
  const session =
    await requireAdmin();

  return (
    <main
      className="
        min-h-screen
        px-6
        py-32
      "
    >
      <div
        className="
          mx-auto
          max-w-6xl
        "
      >
        <h1
          className="
            text-4xl
            font-light
          "
        >
          Fefierys Admin
        </h1>

        <p
          className="
            mt-4
            text-white/60
          "
        >
          Signed in as{" "}
          {session.user.email}
        </p>

        <form
            action={logoutAction}
            className="mt-8"
            >
            <button
                type="submit"
                className="
                rounded-xl
                border
                border-white/15
                px-4
                py-2
                "
            >
                Sign out
            </button>
        </form>
      </div>
    </main>
  );
}