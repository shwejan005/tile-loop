"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthContext } from "../../lib/supabase/server.js";

const projectSchema = z.object({ name: z.string().trim().min(1).max(100) });

export async function createProjectAction(_previousState, formData) {
  const auth = await getAuthContext();
  if (auth.status === "unconfigured") redirect("/setup");
  if (auth.status === "anonymous") redirect("/login");
  if (auth.status !== "authenticated") return { error: "Account service is temporarily unavailable." };

  const parsed = projectSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "Project name must be between 1 and 100 characters." };

  const { data, error } = await auth.supabase
    .from("projects")
    .insert({ owner_id: auth.claims.sub, name: parsed.data.name })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the project. Please try again." };

  revalidatePath("/dashboard");
  redirect(`/projects/${data.id}`);
}

export async function deleteProjectAction(projectId) {
  const parsedId = z.string().uuid().safeParse(projectId);
  if (!parsedId.success) return { error: "Project ID is invalid." };
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return { error: "Sign in again before deleting this project." };

  const { data, error } = await auth.supabase
    .from("projects")
    .delete()
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Could not delete this project. It may no longer be available." };
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function deleteRoomPlanAction(projectId, roomPlanId) {
  const ids = z.object({ projectId: z.string().uuid(), roomPlanId: z.string().uuid() }).safeParse({ projectId, roomPlanId });
  if (!ids.success) return { error: "Room plan ID is invalid." };
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return { error: "Sign in again before deleting this plan." };

  const { data, error } = await auth.supabase
    .from("room_plans")
    .delete()
    .eq("project_id", ids.data.projectId)
    .eq("id", ids.data.roomPlanId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Could not delete this room plan. It may no longer be available." };
  revalidatePath(`/projects/${ids.data.projectId}`);
  return { success: true };
}
