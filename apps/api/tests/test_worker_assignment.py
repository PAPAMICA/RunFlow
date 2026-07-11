"""Tests for worker run assignment logic."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from runflow_shared import RunStatus


@pytest.mark.asyncio
async def test_claim_next_run_assigns_queued_run():
    """Verify claim transitions queued run to assigned with worker_id."""
    from runflow_api.services.queue import claim_next_run

    mock_run = MagicMock()
    mock_run.id = "01RUN123"
    mock_run.status = RunStatus.QUEUED
    mock_run.organization_id = "01ORG123"
    mock_run.job_id = "01JOB123"

    mock_job = MagicMock()
    mock_job.worker_id = None
    mock_job.worker_group_id = None
    mock_job.worker_labels = {}

    mock_worker = MagicMock()
    mock_worker.id = "01WRK123"
    mock_worker.organization_id = "01ORG123"
    mock_worker.current_runs = 0
    mock_worker.labels = {}

    mock_session = AsyncMock()
    mock_run_result = MagicMock()
    mock_run_result.scalars.return_value.all.return_value = [mock_run]
    mock_job_result = MagicMock()
    mock_job_result.scalar_one_or_none.return_value = mock_job
    mock_session.execute.side_effect = [mock_run_result, mock_job_result]

    with patch("runflow_api.services.queue.publish_run_status", new_callable=AsyncMock):
        with patch("runflow_api.services.queue.asyncio.sleep", new_callable=AsyncMock):
            run = await claim_next_run(mock_session, mock_worker, timeout_seconds=0.1)

    assert run is mock_run
    assert mock_run.status == RunStatus.ASSIGNED
    assert mock_run.worker_id == mock_worker.id
    assert mock_worker.current_runs == 1


@pytest.mark.asyncio
async def test_claim_returns_none_when_no_runs():
    from runflow_api.services.queue import claim_next_run

    mock_worker = MagicMock()
    mock_worker.id = "01WRK123"
    mock_worker.organization_id = "01ORG123"
    mock_worker.current_runs = 0

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = mock_result

    with patch("runflow_api.services.queue.asyncio.sleep", new_callable=AsyncMock):
        run = await claim_next_run(mock_session, mock_worker, timeout_seconds=0.1)

    assert run is None
