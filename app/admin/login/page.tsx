import {
  redirect,
} from "next/navigation";

import {
  getAdminSession,
} from "@/lib/auth/admin";

import LoginForm
  from "./LoginForm";

export const dynamic =
  "force-dynamic";

export default async function AdminLoginPage() {
  const session =
    await getAdminSession();

  if (session) {
    redirect(
      "/admin"
    );
  }

  return (
    <main
      className="
        flex
        min-h-screen
        items-center
        justify-center
        px-6
      "
    >
      <section
        className="
          w-full
          max-w-md
          rounded-3xl
          border
          border-white/10
          bg-white/5
          p-8
          backdrop-blur-xl
        "
      >
        <h1
          className="
            mb-2
            text-3xl
            font-light
          "
        >
          Admin
        </h1>

        <p
          className="
            mb-8
            text-white/60
          "
        >
          Sign in to manage Fefierys.
        </p>

        <LoginForm />
      </section>
    </main>
  );
}