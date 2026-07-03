"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function messageFor(code: string | undefined): string {
  switch (code) {
    case "email_not_confirmed":
      return "This account's email has not been confirmed yet. Please contact the publisher.";
    case "invalid_credentials":
      return "That email and password were not recognized.";
    default:
      return "Sign-in failed. Please try again, or contact the publisher if it persists.";
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
    // Server-side only (Vercel function logs); never includes passwords.
    console.error("[auth] signInWithPassword failed", {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    redirect(`/signin?error=${encodeURIComponent(messageFor(error.code))}`);
  }

  redirect("/workspace");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
