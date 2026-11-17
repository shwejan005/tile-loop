import Link from "next/link";
import { getPilotEvaluation } from "../../../lib/data/evaluation.js";
import { groupEvaluationOutcomes } from "../../../lib/evaluation-metrics.js";
import { formatNumber } from "../../../lib/planner.js";

export const metadata = { title: "Pilot evaluation" };

function metricValue(value, suffix = "") {
  return value == null ? "—" : `${formatNumber(value)}${suffix}`;
}

const COHORTS = [
  ["pattern", "Installation pattern"],
  ["roomShape", "Room geometry"],
  ["roomSize", "Room size"],
  ["tileFormat", "Tile format"],
  ["material", "Material"],
  ["installer", "Installer / crew"],
];

function offcutSummary(entries = []) {
  const quantity = entries.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const area = entries.reduce((sum, entry) => sum + Number(entry.widthMm || 0) * Number(entry.lengthMm || 0) * Number(entry.quantity || 0), 0);
  return quantity ? `${quantity} pcs · ${formatNumber(area / 1_000_000)} m²` : "—";
}

export default async function EvaluationPage({ searchParams }) {
  const query = await searchParams;
  const selectedCohort = COHORTS.some(([key]) => key === query?.cohort) ? query.cohort : "pattern";
  const { outcomes, metrics } = await getPilotEvaluation();
  const cohorts = groupEvaluationOutcomes(outcomes, selectedCohort);
  return (
    <main id="main-content" className="evaluation-page">
      <div className="evaluation-header"><div><span className="field-kicker">FIELD VALIDATION / PRIVATE TO YOUR ACCOUNT</span><h1>Pilot evaluation.</h1><p>Compare saved cut-plan stock estimates with recorded installation outcomes across projects.</p></div></div>
      <div className="evaluation-caveat"><p>Descriptive results only—not proof of accuracy or material savings. Percentage error is |actual consumed − planned stock| ÷ actual consumed. Older records without a defined consumption basis remain visible but are excluded from accuracy metrics until confirmed. Compare similar room, tile, pattern, and site conditions; the stock estimate uses conservative nesting heuristics.</p></div>
      <section className="cohort-panel" aria-labelledby="cohort-heading">
        <div className="detail-heading"><div><span className="field-kicker">HISTORICAL PROJECT INTELLIGENCE</span><h2 id="cohort-heading">Compare like with like</h2></div><span className="table-count">Evidence only</span></div>
        <p>Choose a dimension to group recorded jobs. Each row shows only eligible outcomes and displays its sample size; small groups are descriptive, not predictive.</p>
        <form className="cohort-filter" method="get">
          <label className="input-label" htmlFor="cohort-dimension">Group outcomes by</label>
          <select id="cohort-dimension" className="text-control" name="cohort" defaultValue={selectedCohort}>{COHORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <button className="outline-button" type="submit">Update comparison</button>
        </form>
        {cohorts.length ? <div className="cohort-table-wrap"><table className="cohort-table"><thead><tr><th>COHORT</th><th>ELIGIBLE JOBS</th><th>MEDIAN APE</th><th>WITHIN 5%</th><th>MEAN BIAS</th></tr></thead><tbody>
          {cohorts.map((cohort) => <tr key={cohort.label}><td>{cohort.label}</td><td>{cohort.metrics.sampleCount}</td><td>{metricValue(cohort.metrics.medianAbsolutePercentageError, "%")}</td><td>{metricValue(cohort.metrics.within5PercentRate, "%")}</td><td>{metricValue(cohort.metrics.meanBiasTiles, " tiles")}</td></tr>)}
        </tbody></table></div> : <p>No project groups have been recorded yet.</p>}
      </section>
      <section className="evaluation-metrics" aria-label="Pilot summary">
        <article><span>RECORDED JOBS</span><strong>{metrics.sampleCount}</strong><small>with usable planned and actual counts</small></article>
        <article><span>MEAN ABSOLUTE ERROR</span><strong>{metricValue(metrics.meanAbsoluteErrorTiles, " tiles")}</strong><small>difference from planned stock tiles</small></article>
        <article><span>MEAN APE · ACTUAL BASE</span><strong>{metricValue(metrics.meanAbsolutePercentageError, "%")}</strong><small>descriptive sample statistic</small></article>
        <article><span>MEDIAN APE · ACTUAL BASE</span><strong>{metricValue(metrics.medianAbsolutePercentageError, "%")}</strong><small>proposed target ≤5%</small></article>
        <article><span>WITHIN 5% APE</span><strong>{metricValue(metrics.within5PercentRate, "%")}</strong><small>{metrics.within5PercentCount} of {metrics.sampleCount} jobs · proposed target ≥70%</small></article>
        <article><span>WITHIN 10% APE</span><strong>{metricValue(metrics.within10PercentRate, "%")}</strong><small>{metrics.within10PercentCount} of {metrics.sampleCount} jobs · proposed target ≥90%</small></article>
        <article><span>MEAN BIAS</span><strong>{metricValue(metrics.meanBiasTiles, " tiles")}</strong><small>positive means more tiles used on site</small></article>
        <article><span>AVERAGE PRACTICALITY</span><strong>{metricValue(metrics.averagePracticalityRating, " / 5")}</strong><small>installer-submitted rating</small></article>
        <article><span>BREAKAGE RATE</span><strong>{metricValue(metrics.breakageRatePercent, "%")}</strong><small>only jobs with breakage recorded</small></article>
      </section>
      <section className="evaluation-table-panel">
        <div className="detail-heading"><div><span className="field-kicker">OBSERVATIONS / LATEST FIRST</span><h2>Installation outcomes</h2></div><span className="table-count">{outcomes.length} jobs</span></div>
        {outcomes.length ? <div className="evaluation-table-scroll"><table className="evaluation-table"><thead><tr><th>PROJECT / ROOM</th><th>PLANNED STOCK</th><th>TILES CONSUMED</th><th>INSTALLED</th><th>DIFFERENCE</th><th>BREAKAGE</th><th>REUSABLE</th><th>DISCARDED</th><th>TIME</th><th>RATING</th><th /></tr></thead><tbody>
          {outcomes.map((outcome) => <tr key={outcome.id}>
            <td><Link href={`/projects/${outcome.projectId}/rooms/${outcome.roomPlanId}`}>{outcome.projectName} · {outcome.roomLabel}</Link><small>{outcome.algorithmVersion} · {new Date(outcome.completedAt).toLocaleDateString()}</small></td>
            <td>{outcome.plannedStockTiles}</td><td>{outcome.actualTilesUsed}<small className="outcome-basis-note">{outcome.accuracyEligible ? "includes breakage" : "legacy basis · excluded from accuracy"}</small></td>
            <td>{outcome.actualTilesInstalled ?? "—"}</td>
            <td className={outcome.delta > 0 ? "evaluation-over" : outcome.delta < 0 ? "evaluation-under" : ""}>{outcome.delta > 0 ? "+" : ""}{outcome.delta}</td>
            <td>{outcome.breakageTiles ?? "—"}</td><td>{offcutSummary(outcome.reusableOffcuts)}</td><td>{offcutSummary(outcome.discardedOffcuts)}</td><td>{outcome.laborMinutes == null ? "—" : `${outcome.laborMinutes} min`}</td><td>{outcome.practicalityRating == null ? "—" : `${outcome.practicalityRating}/5`}</td>
            <td><Link className="evaluation-open" href={`/projects/${outcome.projectId}/rooms/${outcome.roomPlanId}`}>Open</Link></td>
          </tr>)}
        </tbody></table></div> : <div className="evaluation-empty"><strong>No field outcomes recorded yet.</strong><span>Open a saved room plan and add its actual tile use after installation. Results will appear here.</span><Link href="/dashboard">Open projects</Link></div>}
      </section>
    </main>
  );
}
