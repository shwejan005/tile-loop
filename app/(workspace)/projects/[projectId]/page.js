import Link from "next/link";
import { notFound } from "next/navigation";
import { formatNumber } from "../../../../lib/planner.js";
import { getProjectWithPlans } from "../../../../lib/data/projects.js";
import DeleteResourceButton from "../../../../components/DeleteResourceButton.jsx";
import ProjectShareControl from "../../../../components/ProjectShareControl.jsx";

export async function generateMetadata({ params }) {
  const { projectId } = await params;
  const project = await getProjectWithPlans(projectId);
  return { title: project?.name || "Project" };
}

export default async function ProjectPage({ params }) {
  const { projectId } = await params;
  const project = await getProjectWithPlans(projectId);
  if (!project) notFound();

  return (
    <main id="main-content" className="workspace-main">
      <Link href="/dashboard" className="back-link">All projects</Link>
      <section className="project-hero">
        <div><span className="field-kicker">PROJECT / PRIVATE TO YOUR ACCOUNT</span><h1>{project.name}</h1><p>{project.plans.length} saved {project.plans.length === 1 ? "surface plan" : "surface plans"} · created {new Date(project.created_at).toLocaleDateString()}</p></div>
        <div className="project-hero-actions"><Link className="primary-action inline-action" href={`/projects/${project.id}/rooms/new`}>Add surface plan</Link><DeleteResourceButton type="project" projectId={project.id} label={project.name} /></div>
      </section>

      <section className="project-takeoff" aria-labelledby="project-takeoff-heading">
        <div className="detail-heading"><div><span className="field-kicker">PROJECT MATERIALS</span><h2 id="project-takeoff-heading">Consolidated takeoff</h2></div><span className="table-count">{project.materials.length} materials</span></div>
        <p className="takeoff-note">Each room plan represents a separately specified surface. Tile requirements are summed by product, then rounded to cartons once for the project.</p>
        {project.materials.length ? <div className="takeoff-table-wrap"><table className="takeoff-table"><thead><tr><th>MATERIAL / SURFACES</th><th>FORMAT</th><th>STOCK PLAN</th><th>BUFFERED QTY</th><th>CARTONS</th><th>ORDER QTY</th></tr></thead><tbody>
          {project.materials.map((material) => <tr key={material.key}>
            <td><strong>{material.label}</strong><small>{material.surfaces.join(" · ")}</small></td>
            <td>{formatNumber(material.tileWidth)} × {formatNumber(material.tileLength)} mm</td>
            <td>{formatNumber(material.stockTiles)} tiles</td>
            <td>{formatNumber(material.quantity)} tiles</td>
            <td>{material.cartons == null ? "Pack size needed" : `${formatNumber(material.cartons)} × ${material.packSize}`}</td>
            <td>{formatNumber(material.tilesToOrder)} tiles</td>
          </tr>)}
        </tbody></table></div> : <p className="takeoff-note">Save a plan for each floor, wall, or accent surface to build the combined estimate.</p>}
      </section>

      <section className="room-plan-list" aria-label="Saved surface plans">
        {project.plans.map((plan) => {
          const summary = plan.latestSnapshot?.result_summary;
          const savedComparison = plan.latestSnapshot?.installer_comparisons;
          const comparison = Array.isArray(savedComparison) ? savedComparison[0] : savedComparison;
          const difference = comparison ? comparison.installer_estimate_tiles - summary.orderQuantity : null;
          return (
            <Link className="room-plan-card" href={`/projects/${project.id}/rooms/${plan.id}`} key={plan.id}>
              <div className="room-plan-main"><span className="field-kicker">SURFACE / {plan.label}</span><h2>{formatNumber(plan.room_width_mm)} × {formatNumber(plan.room_length_mm)} mm</h2><p>{formatNumber(plan.tile_width_mm)} × {formatNumber(plan.tile_length_mm)} mm tile · {formatNumber(plan.grout_mm)} mm grout · {formatNumber(plan.kerf_mm)} mm kerf</p>{plan.catalog_item && <small className="catalog-project-label">{plan.catalog_item.brand} · {plan.catalog_item.collection_name} · {plan.catalog_item.supplier_code}</small>}</div>
              <div className="room-plan-metric"><span>SUGGESTED ORDER</span><strong>{summary?.orderQuantity ?? "—"}<small>tiles</small></strong></div>
              <div className="room-plan-metric"><span>INSTALLER</span><strong>{comparison?.installer_estimate_tiles ?? "—"}<small>{comparison ? "tiles" : "not entered"}</small></strong></div>
              <div className="room-plan-metric"><span>DIFFERENCE</span><strong className={difference == null ? "" : difference > 0 ? "diff-positive" : difference < 0 ? "diff-negative" : "diff-neutral"}>{difference == null ? "—" : `${difference > 0 ? "+" : ""}${difference}`}<small>tiles</small></strong></div>
              <span className="room-plan-arrow" aria-hidden="true">Open plan</span>
            </Link>
          );
        })}
        {!project.plans.length && <div className="empty-projects"><span className="field-kicker">NO ROOM PLANS YET</span><h2>Add the first room</h2><p>Room inputs, algorithm version, and calculation results will be saved together.</p></div>}
      </section>

      <ProjectShareControl projectId={project.id} hasActiveShare={(project.project_share_links || []).some((share) => !share.revoked_at)} />

      <div className="workflow-note"><strong>Estimate limits</strong><span>Cut nesting is heuristic. Verify layout, saw kerf, pack sizes, and order quantities with the installer and product packaging.</span></div>
    </main>
  );
}
