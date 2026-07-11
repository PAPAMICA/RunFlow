"""Seed a demo Python job for end-to-end testing."""

from __future__ import annotations

import asyncio

import typer
from sqlalchemy import select

from runflow_api.db import async_session_factory
from runflow_api.models import Job, JobFile, JobParameter, Organization, Project
from runflow_api.services.job_files import JobFileStorage
from runflow_api.utils import new_ulid

app = typer.Typer()


DEMO_MAIN = '''from runflow import args, result

domain = args["domain"]
print(f"Checking {domain}")

result.set({
    "domain": domain,
    "status": "online",
})
'''

DEMO_REQUIREMENTS = ""


@app.command("seed-demo-job")
def seed_demo_job():
    async def _run():
        async with async_session_factory() as session:
            org_result = await session.execute(select(Organization).limit(1))
            org = org_result.scalar_one_or_none()
            if not org:
                typer.echo("No organization found. Run create-admin first.", err=True)
                raise typer.Exit(1)

            proj_result = await session.execute(
                select(Project).where(Project.organization_id == org.id).limit(1)
            )
            project = proj_result.scalar_one_or_none()
            if not project:
                typer.echo("No project found.", err=True)
                raise typer.Exit(1)

            existing = await session.execute(
                select(Job).where(Job.slug == "demo-python", Job.project_id == project.id)
            )
            if existing.scalar_one_or_none():
                typer.echo("Demo job already exists")
                return

            job = Job(
                id=new_ulid(),
                organization_id=org.id,
                project_id=project.id,
                name="Demo Python",
                slug="demo-python",
                description="Demo job for end-to-end validation",
                entrypoint="main.py",
            )
            session.add(job)
            await session.flush()

            session.add(
                JobParameter(
                    id=new_ulid(),
                    job_id=job.id,
                    name="domain",
                    label="Domain",
                    param_type="string",
                    required=True,
                    position=0,
                )
            )
            session.add(
                JobFile(id=new_ulid(), job_id=job.id, path="main.py", content=DEMO_MAIN)
            )
            if DEMO_REQUIREMENTS:
                session.add(
                    JobFile(
                        id=new_ulid(),
                        job_id=job.id,
                        path="requirements.txt",
                        content=DEMO_REQUIREMENTS,
                    )
                )
            await session.commit()

            storage = JobFileStorage()
            storage.write_file(job.id, "main.py", DEMO_MAIN)
            if DEMO_REQUIREMENTS:
                storage.write_file(job.id, "requirements.txt", DEMO_REQUIREMENTS)

            typer.echo(f"Demo job created: {job.slug} (id: {job.id})")

    asyncio.run(_run())


if __name__ == "__main__":
    app()
