"""Job notification tests."""

from runflow_api.schemas import JobNotificationConfig
from runflow_api.services.notifications import (
    mask_pushover_user_key,
    notification_config_to_response,
    render_email_html,
    render_email_text,
    should_notify,
)
from runflow_shared import RunStatus


def test_should_notify_success_and_failure():
    cfg = JobNotificationConfig(enabled=True, on_success=True, on_failure=False)
    assert should_notify(cfg, RunStatus.SUCCESS) is True
    assert should_notify(cfg, RunStatus.FAILED) is False

    cfg2 = JobNotificationConfig(enabled=False, on_success=True, on_failure=True)
    assert should_notify(cfg2, RunStatus.SUCCESS) is False


def test_mask_pushover_user_key():
    assert mask_pushover_user_key("") == ""
    assert mask_pushover_user_key("short") == "••••••••"
    assert mask_pushover_user_key("uQi9zAbcdefghij") == "uQi9…ghij"


def test_notification_config_to_response_masks_key():
    raw = {
        "enabled": True,
        "pushover": {"enabled": True, "user_key": "uQi9zAbcdefghij"},
    }
    resp = notification_config_to_response(raw)
    assert resp["pushover"]["user_key"] == "uQi9…ghij"
    assert resp["pushover_user_key_set"] is True


def test_render_email_contains_job_and_status():
    context = {
        "subject": "[RunFlow] Succès — backup",
        "title": "Exécution réussie",
        "message": "Le job s'est terminé avec succès.",
        "status_label": "Succès",
        "status_color": "#34d399",
        "status_bg": "rgba(16,185,129,0.15)",
        "status_border": "rgba(16,185,129,0.35)",
        "details": [
            {"label": "Job", "value": "backup (backup)"},
            {"label": "Run ID", "value": "01TEST"},
            {"label": "Statut", "value": "success"},
        ],
        "error": None,
        "run_url": "https://runflow.example.com/runs/01TEST",
        "job_name": "backup",
    }
    html = render_email_html(context)
    text = render_email_text(context)
    assert "backup" in html
    assert "Exécution réussie" in html
    assert "01TEST" in text
    assert "https://runflow.example.com/runs/01TEST" in text
