import Link from "next/link";
import ProjectForm from "../../../components/ProjectForm.jsx";
import LegacyPilotImport from "../../../components/LegacyPilotImport.jsx";
import { getDashboardProjects } from "../../../lib/data/projects.js";

export const metadata = { title: "Your projects" };

export default async function DashboardPage() {
  const projects = await getDashboardProjects();
  return (
    <main id="main-content" className="workspace-main">
      <section className="workspace-hero">
        <div>
          <span className="eyebrow-chip">PRIVATE WORKSPACE</span>
          <h1>Your tile projects.</h1>
          <p>Keep room measurements, saved estimates, and installer comparisons in one place.</p>
        </div>
        <div className="workspace-count"><strong>{projects.length}</strong><span>PROJECTS</span></div>
      </section>

      <LegacyPilotImport />

      <section className="workspace-grid" aria-label="Projects">
        {projects.map((project) => (
          <Link className="project-card" href={`/projects/${project.id}`} key={project.id}>
            <span className="field-kicker">PROJECT / {project.id.slice(0, 8).toUpperCase()}</span>
            <h2>{project.name}</h2>
            <div className="project-card-meta"><span>{project.roomCount} {project.roomCount === 1 ? "room plan" : "room plans"}</span><span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span></div>
            <span className="project-card-link">Open project →</span>
          </Link>
        ))}
        {!projects.length && <div className="empty-projects"><span className="field-kicker">GET STARTED</span><h2>Create your first project</h2><p>Projects group the rooms you plan for one customer, site, or job.</p></div>}
      </section>

      <section className="create-project-panel">
        <div><span className="field-kicker">NEW PROJECT</span><h2>Start a project</h2><p>Use a non-sensitive project name; room records are private to your account.</p></div>
        <ProjectForm />
      </section>
    </main>
  );
}
