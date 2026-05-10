import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, password } = await req.json();
    if (!email || !password) throw new Error("Email and password required");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const normalizedEmail = email.trim().toLowerCase();

    // Find user
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = usersData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
    if (!user) throw new Error("User not found");

    // Update password
    const { error } = await admin.auth.admin.updateUserById(user.id, { password });
    if (error) throw new Error(error.message);

    // Generate magic link for auto-login
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
    });

    if (linkError) throw new Error(linkError.message);

    return new Response(JSON.stringify({
      success: true,
      token_hash: linkData.properties.hashed_token,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-password error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
