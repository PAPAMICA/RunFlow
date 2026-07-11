"""Tests for parameter validation."""

import pytest

from runflow_api.core.parameter_validation import ParameterValidationError, validate_job_arguments
from runflow_api.models import JobParameter
from runflow_shared import ParameterType


def _param(
    name: str,
    ptype: str,
    required: bool = False,
    options: list | None = None,
    default=None,
    enabled: bool = True,
):
    return JobParameter(
        id="01TEST",
        job_id="01JOB",
        name=name,
        param_type=ptype,
        required=required,
        options=options,
        default_value=default,
        position=0,
        enabled=enabled,
    )


def test_disabled_param_is_ignored():
    params = [
        _param("domain", ParameterType.STRING, required=True),
        _param("legacy", ParameterType.STRING, required=True, enabled=False),
    ]
    # 'legacy' is required but disabled -> no error, and its value is dropped.
    result = validate_job_arguments(params, {"domain": "x", "legacy": "ignored"})
    assert result["domain"] == "x"
    assert "legacy" not in result


def test_disabled_flag_type():
    params = [_param("verbose", ParameterType.FLAG, enabled=True)]
    result = validate_job_arguments(params, {"verbose": "true"})
    assert result["verbose"] is True


def test_validate_string_required():
    params = [_param("domain", ParameterType.STRING, required=True)]
    with pytest.raises(ParameterValidationError) as exc:
        validate_job_arguments(params, {})
    assert "domain" in exc.value.errors


def test_validate_string_ok():
    params = [_param("domain", ParameterType.STRING, required=True)]
    result = validate_job_arguments(params, {"domain": "example.com"})
    assert result["domain"] == "example.com"


def test_validate_select_invalid():
    params = [_param("env", ParameterType.SELECT, options=["prod", "dev"])]
    with pytest.raises(ParameterValidationError):
        validate_job_arguments(params, {"env": "staging"})


def test_validate_boolean():
    params = [_param("force", ParameterType.BOOLEAN, default=False)]
    result = validate_job_arguments(params, {"force": "true"})
    assert result["force"] is True


def test_unknown_parameter():
    params = [_param("domain", ParameterType.STRING)]
    with pytest.raises(ParameterValidationError) as exc:
        validate_job_arguments(params, {"domain": "x", "extra": "y"})
    assert "extra" in exc.value.errors


def test_forced_arguments_only_no_declared_params():
    """Job with only forced args and no parameters should validate."""
    result = validate_job_arguments(
        [],
        {},
        forced_arguments={"cal_only": True},
    )
    assert result == {"cal_only": True}


def test_forced_arguments_override_user_input():
    params = [_param("env", ParameterType.STRING, required=True)]
    result = validate_job_arguments(
        params,
        {"env": "dev"},
        forced_arguments={"env": "production"},
    )
    assert result["env"] == "production"


def test_forced_arguments_hide_required_param():
    """Forced value satisfies a required parameter without user input."""
    params = [_param("cal_only", ParameterType.BOOLEAN, required=True)]
    result = validate_job_arguments(
        params,
        {},
        forced_arguments={"cal_only": True},
    )
    assert result["cal_only"] is True
