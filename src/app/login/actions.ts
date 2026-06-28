"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SERVER_ENV } from "@/lib/server-env";

export type AuthResult = { error?: string };

export async function signInWithPassword(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "missing_fields" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/inbox");
}

export async function signInDemo(role: "admin" | "agent"): Promise<AuthResult> {
  const email = role === "admin" ? SERVER_ENV.demo.adminEmail : SERVER_ENV.demo.agentEmail;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: SERVER_ENV.demo.password,
  });
  if (error) return { error: error.message };
  redirect("/inbox");
}
