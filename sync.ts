import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SyncContext } from "./types";

let supabase: SupabaseClient;

export function initSupabase(url: string, key: string): void {
  supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function repoUrlParts(repoUrl: string | undefined): { owner: string | null; name: string | null } {
  if (!repoUrl) return { owner: null, name: null };
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  return match ? { owner: match[1], name: match[2] } : { owner: null, name: null };
}

export async function syncProjectContent(ctx: SyncContext): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();

  try {
    // 1. Upsert projects row and resolve proj_id
    let projId: string | null = null;

    if (ctx.project) {
      const { owner, name } = repoUrlParts(ctx.project.repo);
      const { data, error } = await supabase
        .from("projects")
        .upsert(
          {
            content_slug: ctx.contentSlug,
            title: ctx.project.title,
            description: ctx.project.description,
            status: ctx.project.status,
            state: ctx.project.state,
            topics: ctx.project.topics,
            repo_url: ctx.project.repo ?? null,
            repo_owner: owner ?? ctx.repoOwner,
            repo_name: name ?? ctx.repoName,
            stack: ctx.project.stack ?? [],
            infrastructure: ctx.project.infrastructure ?? [],
            agents: ctx.project.agents ?? [],
            related_content: ctx.project.relatedContent ?? [],
            body: ctx.project.body,
            synced_at: now,
          },
          { onConflict: "content_slug" }
        )
        .select("proj_id")
        .single();
      if (error) throw new Error(`projects: ${error.message}`);
      projId = data.proj_id;
      console.log(`  projects: upserted ${ctx.contentSlug} (proj_id=${projId})`);
    }

    // If no project upserted, look up existing proj_id
    if (!projId) {
      const { data } = await supabase
        .from("projects")
        .select("proj_id")
        .eq("content_slug", ctx.contentSlug)
        .single();
      projId = data?.proj_id ?? null;
    }

    if (!projId) {
      console.warn(`  No proj_id found for ${ctx.contentSlug} — skipping child tables`);
      return { ok: true };
    }

    // 2. Sync hypotheses (upsert + delete removed)
    if (ctx.hypotheses.length > 0 || ctx.project) {
      const incomingIds = ctx.hypotheses.map((h) => h.id);

      for (const h of ctx.hypotheses) {
        const { error } = await supabase.from("hypotheses").upsert(
          {
            proj_id: projId,
            id: h.id,
            statement: h.statement,
            status: h.status,
            date: h.date,
            revises_id: h.revisesId ?? null,
            notes: h.notes,
          },
          { onConflict: "proj_id,id" }
        );
        if (error) console.warn(`  hypotheses/${h.id}: ${error.message}`);
      }

      // Delete hypotheses no longer in .lo/
      if (incomingIds.length > 0) {
        await supabase
          .from("hypotheses")
          .delete()
          .eq("proj_id", projId)
          .not("id", "in", `(${incomingIds.map((s) => `"${s}"`).join(",")})`);
      } else {
        await supabase.from("hypotheses").delete().eq("proj_id", projId);
      }
      console.log(`  hypotheses: synced ${ctx.hypotheses.length} entries`);
    }

    // 3. Sync stream entries (source='webhook' only)
    if (ctx.streamEntries.length > 0 || ctx.project) {
      const incomingSlugs = ctx.streamEntries.map((s) => s.slug);

      for (const entry of ctx.streamEntries) {
        const { error } = await supabase.from("project_stream").upsert(
          {
            proj_id: projId,
            slug: entry.slug,
            title: entry.title,
            date: entry.date,
            type: entry.type,
            body: entry.body,
            source: "webhook",
          },
          { onConflict: "proj_id,slug" }
        );
        if (error) console.warn(`  stream/${entry.slug}: ${error.message}`);
      }

      // Delete webhook-sourced entries no longer in .lo/
      let deleteQuery = supabase
        .from("project_stream")
        .delete()
        .eq("proj_id", projId)
        .eq("source", "webhook");

      if (incomingSlugs.length > 0) {
        deleteQuery = deleteQuery.not(
          "slug",
          "in",
          `(${incomingSlugs.map((s) => `"${s}"`).join(",")})`
        );
      }
      await deleteQuery;
      console.log(`  project_stream: synced ${ctx.streamEntries.length} entries`);
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Sync failed for ${ctx.contentSlug}: ${msg}`);
    return { ok: false, error: msg };
  }
}

export async function syncContributors(
  contentSlug: string,
  contributors: Array<{
    username: string;
    avatarUrl: string;
    profileUrl: string;
    commits: number;
    type: string;
    agentName?: string;
  }>
): Promise<void> {
  // Look up proj_id from content_slug
  const { data } = await supabase
    .from("projects")
    .select("proj_id")
    .eq("content_slug", contentSlug)
    .single();

  if (!data?.proj_id) {
    console.warn(`  contributors: no proj_id for ${contentSlug} — skipping`);
    return;
  }

  const projId = data.proj_id;

  for (const c of contributors) {
    const { error } = await supabase.from("project_contributors").upsert(
      {
        proj_id: projId,
        username: c.username,
        avatar_url: c.avatarUrl,
        profile_url: c.profileUrl,
        commits: c.commits,
        type: c.type,
        agent_name: c.agentName ?? null,
      },
      { onConflict: "proj_id,username" }
    );
    if (error) console.warn(`  contributor/${c.username}: ${error.message}`);
  }
  console.log(`  project_contributors: synced ${contributors.length} entries`);
}
