"""
MediTrack CDSS - Unit Tests for the CDSS Rule Engine

These tests validate each rule in isolation and the full evaluate_patient pipeline.
No database or HTTP layer is required — pure unit tests.
"""
import pytest
from app.services.cdss_engine import PatientContext, evaluate_patient


def make_ctx(**overrides) -> PatientContext:
    """Factory for PatientContext with safe defaults."""
    defaults = dict(
        patient_id="patient-1",
        admission_id="admission-1",
        los_hours=24.0,
        primary_condition="respiratory",
        latest_scan_status=None,
        latest_scan_type=None,
        heart_rate=70,
        blood_pressure_systolic=120,
        oxygen_saturation=98.0,
        temperature_celsius=37.0,
        expected_los_hours=48,
    )
    defaults.update(overrides)
    return PatientContext(**defaults)


class TestRulePostOpFluidDrainage:
    """CDSS-RULE-001: Post-op + >72h LOS + fluid present."""

    def test_triggers_when_all_conditions_met(self):
        ctx = make_ctx(los_hours=80, primary_condition="post-op", latest_scan_status="fluid_present")
        result = evaluate_patient(ctx)
        rule_ids = [s.rule_id for s in result.suggestions]
        assert "CDSS-RULE-001" in rule_ids

    def test_does_not_trigger_without_fluid(self):
        ctx = make_ctx(los_hours=80, primary_condition="post-op", latest_scan_status="clear")
        result = evaluate_patient(ctx)
        rule_ids = [s.rule_id for s in result.suggestions]
        assert "CDSS-RULE-001" not in rule_ids

    def test_does_not_trigger_without_postop(self):
        ctx = make_ctx(los_hours=80, primary_condition="cardiac", latest_scan_status="fluid_present")
        result = evaluate_patient(ctx)
        rule_ids = [s.rule_id for s in result.suggestions]
        assert "CDSS-RULE-001" not in rule_ids

    def test_does_not_trigger_under_72h(self):
        ctx = make_ctx(los_hours=60, primary_condition="post-op", latest_scan_status="fluid_present")
        result = evaluate_patient(ctx)
        rule_ids = [s.rule_id for s in result.suggestions]
        assert "CDSS-RULE-001" not in rule_ids

    def test_severity_is_critical(self):
        ctx = make_ctx(los_hours=80, primary_condition="post-op", latest_scan_status="fluid_present")
        result = evaluate_patient(ctx)
        suggestion = next((s for s in result.suggestions if s.rule_id == "CDSS-RULE-001"), None)
        assert suggestion is not None
        assert suggestion.severity == "critical"


class TestRuleLowOxygenSaturation:
    """CDSS-RULE-003: SpO2 < 92%."""

    def test_triggers_on_low_spo2(self):
        ctx = make_ctx(oxygen_saturation=88.0)
        result = evaluate_patient(ctx)
        rule_ids = [s.rule_id for s in result.suggestions]
        assert "CDSS-RULE-003" in rule_ids

    def test_does_not_trigger_on_normal_spo2(self):
        ctx = make_ctx(oxygen_saturation=97.0)
        result = evaluate_patient(ctx)
        rule_ids = [s.rule_id for s in result.suggestions]
        assert "CDSS-RULE-003" not in rule_ids

    def test_does_not_trigger_on_none_spo2(self):
        ctx = make_ctx(oxygen_saturation=None)
        result = evaluate_patient(ctx)
        rule_ids = [s.rule_id for s in result.suggestions]
        assert "CDSS-RULE-003" not in rule_ids


class TestRuleExtendedLos:
    """CDSS-RULE-002: LOS > 1.5x expected."""

    def test_triggers_on_exceeded_expected_los(self):
        ctx = make_ctx(los_hours=100, expected_los_hours=48)  # 100 > 72
        result = evaluate_patient(ctx)
        rule_ids = [s.rule_id for s in result.suggestions]
        assert "CDSS-RULE-002" in rule_ids

    def test_does_not_trigger_within_expected(self):
        ctx = make_ctx(los_hours=40, expected_los_hours=48)
        result = evaluate_patient(ctx)
        rule_ids = [s.rule_id for s in result.suggestions]
        assert "CDSS-RULE-002" not in rule_ids

    def test_uses_120h_default_when_no_expected(self):
        ctx = make_ctx(los_hours=130, expected_los_hours=None)
        result = evaluate_patient(ctx)
        rule_ids = [s.rule_id for s in result.suggestions]
        assert "CDSS-RULE-002" in rule_ids


class TestEvaluatePatientPipeline:
    """Integration-level tests for the full evaluate_patient function."""

    def test_no_suggestions_for_normal_patient(self):
        ctx = make_ctx()  # all normal defaults
        result = evaluate_patient(ctx)
        assert result.suggestions == []
        assert result.has_critical_suggestions is False

    def test_has_critical_when_critical_suggestion_present(self):
        ctx = make_ctx(los_hours=80, primary_condition="post-op", latest_scan_status="fluid_present")
        result = evaluate_patient(ctx)
        assert result.has_critical_suggestions is True

    def test_result_patient_id_matches(self):
        ctx = make_ctx(patient_id="test-patient-42")
        result = evaluate_patient(ctx)
        assert result.patient_id == "test-patient-42"

    def test_multiple_rules_can_fire(self):
        ctx = make_ctx(
            los_hours=90,
            primary_condition="post-op",
            latest_scan_status="fluid_present",
            oxygen_saturation=88.0,  # Also triggers CDSS-RULE-003
            expected_los_hours=48,
        )
        result = evaluate_patient(ctx)
        rule_ids = [s.rule_id for s in result.suggestions]
        assert "CDSS-RULE-001" in rule_ids
        assert "CDSS-RULE-003" in rule_ids
