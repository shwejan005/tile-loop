import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, ClipboardList } from "lucide-react";
import { getPilotEvaluation } from "../../../lib/data/evaluation.js";
import { formatNumber } from "../../../lib/planner.js";

export const metadata = { title: "Pilot evaluation" };

function metricValue(value, suffix = "") {
  return value == null ? "—" : `${formatNumber(value)}${suffix}`;
}

export default async function EvaluationPage() {
  const { outcomes, metrics } = await getPilotEvaluation();
  return (
    <main id="main-content" className="evaluation-page">
      <div className="evaluation-header"><div><span className="field-kicker">FIELD VALIDATION / PRIVATE TO YOUR ACCOUNT</span><h1>Pilot evaluation.</h1><p>Compare saved cut-plan stock estimates with recorded installation outcomes across projects.</p></div><ChartNoAxesCombined size={23} /></div>
      <div className="evaluation-caveat"><ClipboardList size={15} /><p>Descriptive results only—not proof of accuracy or material savings. Compare similar room, tile, pattern, and site conditions; the planned stock count uses a conservative bounding-box nesting heuristic.</p></div>
      <section className="evaluation-metrics" aria-label="Pilot summary">
        <article><span>RECORDED JOBS</span><strong>{metrics.sampleCount}</strong><small>with usable planned and actual counts</small></article>
        <article><span>MEAN ABSOLUTE ERROR</span><strong>{metricValue(metrics.meanAbsoluteErrorTiles, " tiles")}</strong><small>difference from planned stock tiles</small></article>
        <article><span>MEAN ABSOLUTE PERCENT ERROR</span><strong>{metricValue(metrics.meanAbsolutePercentageError, "%")}</strong><small>descriptive sample statistic</small></article>
        <article><span>MEAN BIAS</span><strong>{metricValue(metrics.meanBiasTiles, " tiles")}</strong><small>positive means more tiles used on site</small></article>
        <article><span>AVERAGE PRACTICALITY</span><strong>{metricValue(metrics.averagePracticalityRating, " / 5")}</strong><small>installer-submitted rating</small></article>
        <article><span>BREAKAGE RATE</span><strong>{metricValue(metrics.breakageRatePercent, "%")}</strong><small>only jobs with breakage recorded</small></article>
      </section>
      <section className="evaluation-table-panel">
        <div className="detail-heading"><div><span className="field-kicker">OBSERVATIONS / LATEST FIRST</span><h2>Installation outcomes</h2></div><span className="table-count">{outcomes.length} jobs</span></div>
        {outcomes.length ? <div className="evaluation-table-scroll"><table className="evaluation-table"><thead><tr><th>PROJECT / ROOM</th><th>PLANNED STOCK</th><th>ACTUAL USED</th><th>DIFFERENCE</th><th>BREAKAGE</th><th>TIME</th><th>RATING</th><th /></tr></thead><tbody>
          {outcomes.map((outcome) => <tr key={outcome.id}>
            <td><Link href={`/projects/${outcome.projectId}/rooms/${outcome.roomPlanId}`}>{outcome.projectName} · {outcome.roomLabel}</Link><small>{outcome.algorithmVersion} · {new Date(outcome.completedAt).toLocaleDateString()}</small></td>
            <td>{outcome.plannedStockTiles}</td><td>{outcome.actualTilesUsed}</td>
            <td className={outcome.delta > 0 ? "evaluation-over" : outcome.delta < 0 ? "evaluation-under" : ""}>{outcome.delta > 0 ? "+" : ""}{outcome.delta}</td>
            <td>{outcome.breakageTiles ?? "—"}</td><td>{outcome.laborMinutes == null ? "—" : `${outcome.laborMinutes} min`}</td><td>{outcome.practicalityRating == null ? "—" : `${outcome.practicalityRating}/5`}</td>
            <td><Link className="evaluation-open" href={`/projects/${outcome.projectId}/rooms/${outcome.roomPlanId}`} aria-label={`Open ${outcome.roomLabel}`}><ArrowRight size={14} /></Link></td>
          </tr>)}
        </tbody></table></div> : <div className="evaluation-empty"><ClipboardList size={18} /><strong>No field outcomes recorded yet.</strong><span>Open a saved room plan and add its actual tile use after installation. Results will appear here.</span><Link href="/dashboard">Open projects <ArrowRight size={13} /></Link></div>}
      </section>
    </main>
  );
}
