import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import RoomPlanEditor from "../../../../../../components/RoomPlanEditor.jsx";
import InstallationOutcomeForm from "../../../../../../components/InstallationOutcomeForm.jsx";
import DeleteResourceButton from "../../../../../../components/DeleteResourceButton.jsx";
import { DEFAULT_FORM, formatNumber } from "../../../../../../lib/planner.js";
import { getProjectWithPlans, getRoomPlan } from "../../../../../../lib/data/projects.js";
import { getPublishedCatalogItems } from "../../../../../../lib/data/catalog.js";

export async function generateMetadata({ params }) {
  const { projectId, roomId } = await params;
  const plan = await getRoomPlan(projectId, roomId);
  return { title: plan?.label || "Room plan" };
}

export default async function RoomPlanPage({ params }) {
  const { projectId, roomId } = await params;
  const [project, plan, catalogItems] = await Promise.all([
    getProjectWithPlans(projectId),
    getRoomPlan(projectId, roomId),
    getPublishedCatalogItems("AE"),
  ]);
  if (!project || !plan) notFound();

  const initialForm = {
    ...DEFAULT_FORM,
    planId: plan.label,
    roomWidth: Number(plan.room_width_mm),
    roomLength: Number(plan.room_length_mm),
    tileWidth: Number(plan.tile_width_mm),
    tileLength: Number(plan.tile_length_mm),
    grout: Number(plan.grout_mm),
    kerf: Number(plan.kerf_mm),
    orientation: plan.orientation,
    reserve: Number(plan.reserve_pct),
    roomGeometry: plan.latestSnapshot?.inputs?.roomGeometry || null,
    pattern: plan.latestSnapshot?.inputs?.layout?.pattern || DEFAULT_FORM.pattern,
    tilesPerCarton: plan.latestSnapshot?.inputs?.tilesPerCarton ?? "",
  };
  const savedComparisons = plan.latestSnapshot?.installer_comparisons;
  const latestComparison = Array.isArray(savedComparisons) ? savedComparisons[0] : savedComparisons;
  const savedOutcomes = plan.latestSnapshot?.installation_outcomes;
  const latestOutcome = Array.isArray(savedOutcomes) ? savedOutcomes[0] : savedOutcomes;

  return (
    <>
      <div className="workspace-breadcrumb"><Link href={`/projects/${project.id}`}><ArrowLeft size={14} /> {project.name}</Link><span>/</span><span>{plan.label} · {formatNumber(plan.room_width_mm)} × {formatNumber(plan.room_length_mm)} mm</span></div>
      <RoomPlanEditor
        projectId={project.id}
        roomPlanId={plan.id}
        initialForm={initialForm}
        initialInstallerEstimate={latestComparison ? String(latestComparison.installer_estimate_tiles) : ""}
        initialCatalogItemId={plan.catalog_item?.id || null}
        catalogItems={catalogItems}
        history={plan.snapshots}
      />
      {plan.latestSnapshot && <InstallationOutcomeForm
        projectId={project.id}
        roomPlanId={plan.id}
        estimatedTiles={plan.latestSnapshot.result_summary?.orderQuantity ?? null}
        initialOutcome={latestOutcome || null}
      />}
      <div className="room-delete-action"><DeleteResourceButton type="room" projectId={project.id} roomPlanId={plan.id} label={plan.label} /></div>
    </>
  );
}
