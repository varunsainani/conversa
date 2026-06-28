import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Placeholder. The full three-pane inbox is built in task 128.
export default async function InboxPlaceholder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Setting up your Conversa workspace…
        </h1>
      </div>
    </div>
  );
}
