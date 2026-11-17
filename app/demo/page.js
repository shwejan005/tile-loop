import AppHeader from "../../components/AppHeader.jsx";
import RoomPlanEditor from "../../components/RoomPlanEditor.jsx";
import { createDemoForm } from "../../lib/demo-sample.js";

export const metadata = { title: "Interactive demo" };

export default function DemoPage() {
  return (
    <div className="app-shell">
      <AppHeader />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <section className="demo-banner" aria-label="Demo information">
        <div><span className="field-kicker">B2B INSTALLER WORKFLOW · INTERACTIVE DEMO</span><strong>For tile installers and contractors · Sample L-shaped room, obstacle, floor opening, and half-offset pattern</strong><p>The installer or estimator is the primary user. Customers receive read-only project links. All measurements and the 8-tiles-per-carton value are illustrative; nothing is saved or orderable in this demo.</p></div>
      </section>
      <nav className="demo-workflow" aria-label="Demo walkthrough">
        <a href="#planner"><span>01</span><strong>Room geometry</strong></a>
        <a href="#plan-view"><span>02</span><strong>Layout and cuts</strong></a>
        <a href="#estimate"><span>03</span><strong>Material estimate</strong></a>
      </nav>
      <RoomPlanEditor projectId="" initialForm={createDemoForm()} catalogItems={[]} demoMode />
    </div>
  );
}
