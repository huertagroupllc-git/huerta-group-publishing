"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";

function messageFor(code: string | undefined): string {
  switch (code) {
    case "email_not_confirmed":
      return "This account's email has not been confirmed yet. Confirm it in Supabase (Authentication → Users) or recreate the user with auto-confirm.";
    case "invalid_credentials":
      return "That email and password were not recognized.";
    default:
      return "Sign-in failed.";
  }
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(
      `/signin?error=${encodeURIComponent("Both email and password are required.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // TEMPORARY auth diagnostics (never logs passwords): Supabase error
    // code/status and which project the server is talking to.
    const host = new URL(supabaseEnv().url ?? "https://unknown").host;
    console.error("[auth] signInWithPassword failed", {
      code: error.code,
      status: error.status,
      message: error.message,
      supabaseHost: host,
    });

    const params = new URLSearchParams({
      error: messageFor(error.code),
      // TEMPORARY: exposed to diagnose the production auth failure;
      // remove once resolved.
      code: error.code ?? "unknown",
      status: String(error.status ?? ""),
      msg: error.message.slice(0, 120),
      ref: host.split(".")[0],
    });
    redirect(`/signin?${params.toString()}`);
  }

  redirect("/workspace");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
