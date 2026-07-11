"""RunFlow administration CLI."""

from __future__ import annotations

import asyncio
import getpass

import typer
from sqlalchemy import select

from runflow_api import __version__
from runflow_api.core.security import hash_password
from runflow_api.db import async_session_factory
from runflow_api.models import Organization, OrganizationMember, Project, User, Worker
from runflow_api.utils import generate_registration_token, hash_registration_token, new_ulid
from runflow_shared import UserRole, WorkerStatus

app = typer.Typer(name="runflow", help="RunFlow administration CLI")


@app.command("version")
def version_cmd():
    typer.echo(f"RunFlow API {__version__}")


@app.command("create-admin")
def create_admin(
    email: str = typer.Option(..., prompt=True),
    password: str = typer.Option(None, hide_input=True),
    org_name: str = typer.Option("Default Organization", "--org-name"),
    org_slug: str = typer.Option("default", "--org-slug"),
):
    if password is None:
        password = getpass.getpass("Password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            typer.echo("Passwords do not match", err=True)
            raise typer.Exit(1)

    async def _run():
        async with async_session_factory() as session:
            existing = await session.execute(select(User).where(User.email == email))
            if existing.scalar_one_or_none():
                typer.echo(f"User {email} already exists", err=True)
                raise typer.Exit(1)

            user = User(id=new_ulid(), email=email, password_hash=hash_password(password))
            org = Organization(id=new_ulid(), name=org_name, slug=org_slug)
            member = OrganizationMember(
                id=new_ulid(),
                organization_id=org.id,
                user_id=user.id,
                role=UserRole.OWNER,
            )
            project = Project(
                id=new_ulid(),
                organization_id=org.id,
                name="Default Project",
                slug="default",
                description="Default project",
            )
            session.add_all([user, org, member, project])
            await session.commit()
            typer.echo(f"Admin user created: {email}")
            typer.echo(f"Organization: {org_name} ({org_slug})")
            typer.echo(f"Default project: default")

    asyncio.run(_run())


@app.command("worker-create-registration-token")
def worker_create_registration_token(
    name: str = typer.Option(..., prompt=True),
    org_id: str = typer.Option(..., "--org-id"),
):
    async def _run():
        async with async_session_factory() as session:
            reg_token, _, reg_hash = generate_registration_token()
            placeholder_hash = hash_registration_token(reg_token + ":pending")
            worker = Worker(
                id=new_ulid(),
                organization_id=org_id,
                name=name,
                token_prefix=f"pending_{new_ulid()[:10]}",
                token_hash=placeholder_hash,
                registration_token_hash=reg_hash,
                status=WorkerStatus.PENDING,
            )
            session.add(worker)
            await session.commit()
            typer.echo(f"Worker pending registration: {name}")
            typer.echo(f"Worker ID: {worker.id}")
            typer.echo(f"Registration token (shown once): {reg_token}")
            typer.echo("On the worker host, run:")
            typer.echo(f"  runflow-worker register --server <API_URL> --registration-token {reg_token}")

    asyncio.run(_run())


if __name__ == "__main__":
    app()
