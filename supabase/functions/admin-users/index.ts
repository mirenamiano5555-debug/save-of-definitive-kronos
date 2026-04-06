import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Check admin role
    const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, targetUserId, email, reason } = await req.json();

    switch (action) {
      case "list_users_with_email": {
        const { data: { users: authUsers }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        if (error) throw error;
        const emailMap: Record<string, string> = {};
        for (const u of authUsers || []) {
          emailMap[u.id] = u.email || "";
        }
        return new Response(JSON.stringify({ emailMap }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "delete_user": {
        // Delete user but allow re-registration
        const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
        if (error) throw error;
        // Clean up profile and roles
        await adminClient.from("user_roles").delete().eq("user_id", targetUserId);
        await adminClient.from("profiles").delete().eq("user_id", targetUserId);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "ban_user": {
        // Get user email first
        const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(targetUserId);
        if (!targetUser?.email) throw new Error("User not found");
        
        // Add to banned_emails
        await adminClient.from("banned_emails").upsert({
          email: targetUser.email,
          banned_by: user.id,
          reason: reason || null,
        }, { onConflict: "email" });

        // Delete the user
        const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
        if (error) throw error;
        await adminClient.from("user_roles").delete().eq("user_id", targetUserId);
        await adminClient.from("profiles").delete().eq("user_id", targetUserId);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "unban_email": {
        await adminClient.from("banned_emails").delete().eq("email", email);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "list_banned": {
        const { data } = await adminClient.from("banned_emails").select("*").order("banned_at", { ascending: false });
        return new Response(JSON.stringify({ banned: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("admin-users error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
