import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { formatNumber } from "../../../../lib/planner.js";
import { getProjectWithPlans } from "../../../../lib/data/projects.js";
import DeleteResourceButton from "../../../../components/DeleteResourceButton.jsx";

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
      <Link href="/dashboard" className="back-link"><ArrowLeft size={14} /> ALL PROJECTS</Link>
      <section className="project-hero">
        <div><span className="field-kicker">PROJECT / PRIVATE TO YOUR ACCOUNT</span><h1>{project.name}</h1><p>{project.plans.length} saved {project.plans.length === 1 ? "room plan" : "room plans"} · created {new Date(project.created_at).toLocaleDateString()}</p></div>
        <div className="project-hero-actions"><Link className="primary-action inline-action" href={`/projects/${project.id}/rooms/new`}><Plus size={15} /> Add room plan</Link><DeleteResourceButton type="project" projectId={project.id} label={project.name} /></div>
      </section>

      <section className="room-plan-list" aria-label="Saved room plans">
        {project.plans.map((plan) => {
          const summary = plan.latestSnapshot?.result_summary;
          const savedComparison = plan.latestSnapshot?.installer_comparisons;
          const comparison = Array.isArray(savedComparison) ? savedComparison[0] : savedComparison;
          const difference = comparison ? comparison.installer_estimate_tiles - summary.orderQuantity : null;
          return (
            <Link className="room-plan-card" href={`/projects/${project.id}/rooms/${plan.id}`} key={plan.id}>
              <div className="room-plan-main"><span className="field-kicker">ROOM PLAN / {plan.label}</span><h2>{formatNumber(plan.room_width_mm)} × {formatNumber(plan.room_length_mm)} mm</h2><p>{formatNumber(plan.tile_width_mm)} × {formatNumber(plan.tile_length_mm)} mm tile · {formatNumber(plan.grout_mm)} mm grout · {formatNumber(plan.kerf_mm)} mm kerf</p>{plan.catalog_item && <small className="catalog-project-label">{plan.catalog_item.brand} · {plan.catalog_item.collection_name} · {plan.catalog_item.supplier_code}</small>}</div>
              <div className="room-plan-metric"><span>SUGGESTED ORDER</span><strong>{summary?.orderQuantity ?? "—"}<small>tiles</small></strong></div>
              <div className="room-plan-metric"><span>INSTALLER</span><strong>{comparison?.installer_estimate_tiles ?? "—"}<small>{comparison ? "tiles" : "not entered"}</small></strong></div>
              <div className="room-plan-metric"><span>DIFFERENCE</span><strong className={difference == null ? "" : difference > 0 ? "diff-positive" : difference < 0 ? "diff-negative" : "diff-neutral"}>{difference == null ? "—" : `${difference > 0 ? "+" : ""}${difference}`}<small>tiles</small></strong></div>
              <ArrowRight className="room-plan-arrow" size={16} />
            </Link>
          );
        })}
        {!project.plans.length && <div className="empty-projects"><span className="field-kicker">NO ROOM PLANS YET</span><h2>Add the first room</h2><p>Room inputs, algorithm version, and calculation results will be saved together.</p></div>}
      </section>

      <div className="workflow-note"><strong>Estimate limits</strong><span>Rectangular straight-lay layouts only. Kerf is included conservatively in stock nesting; verify the saw’s actual kerf and tile order with the installer.</span></div>
    </main>
  );
}
