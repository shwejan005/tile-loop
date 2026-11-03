import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import RoomPlanEditor from "../../../../../../components/RoomPlanEditor.jsx";
import { DEFAULT_FORM } from "../../../../../../lib/planner.js";
import { getProjectWithPlans } from "../../../../../../lib/data/projects.js";
import { getPublishedCatalogItems } from "../../../../../../lib/data/catalog.js";

export default async function NewRoomPlanPage({ params }) {
  const { projectId } = await params;
  const [project, catalogItems] = await Promise.all([
    getProjectWithPlans(projectId),
    getPublishedCatalogItems("AE"),
  ]);
  if (!project) notFound();
  const initialForm = { ...DEFAULT_FORM, planId: `ROOM-${String(project.plans.length + 1).padStart(2, "0")}` };

  return (
    <>
      <div className="workspace-breadcrumb"><Link href={`/projects/${project.id}`}><ArrowLeft size={14} /> {project.name}</Link></div>
      <RoomPlanEditor projectId={project.id} initialForm={initialForm} catalogItems={catalogItems} />
    </>
  );
}
