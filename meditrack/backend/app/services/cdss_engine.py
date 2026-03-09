"""
MediTrack CDSS - Clinical Decision Support Engine

Deterministic rule-based engine that evaluates patient admission data
and clinical observations to generate action suggestions.

Each rule is a pure function that accepts patient context and returns
an optional CdssSuggestion. Rules are registered in RULE_REGISTRY and
evaluated in priority order.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Optional

from app.schemas import CdssEvaluationResult, CdssSuggestion


# ============================================================
# PATIENT CONTEXT
# A lightweight data transfer object passed to every rule function.
# ============================================================
@dataclass(frozen=True)
class PatientContext:
    """All data a CDSS rule needs to make a decision."""
    patient_id: str
    admission_id: str
    los_hours: float                        # Current length of stay in hours
    primary_condition: str                  # e.g., 'post-op', 'cardiac'
    latest_scan_status: Optional[str]       # e.g., 'fluid_present', 'clear'
    latest_scan_type: Optional[str]         # e.g., 'CT Abdomen'
    heart_rate: Optional[int]
    blood_pressure_systolic: Optional[int]
    oxygen_saturation: Optional[float]
    temperature_celsius: Optional[float]
    expected_los_hours: Optional[int]


# ============================================================
# RULE TYPE ALIAS
# Each rule is a callable: PatientContext -> Optional[CdssSuggestion]
# ============================================================
RuleFunction = Callable[[PatientContext], Optional[CdssSuggestion]]


# ============================================================
# RULE IMPLEMENTATIONS
# ============================================================

def rule_post_op_fluid_drainage(ctx: PatientContext) -> Optional[CdssSuggestion]:
    """
    RULE CDSS-001: Post-op patient with extended LOS and fluid detected on scan.
    Trigger: warded_duration > 72h AND condition = 'post-op' AND scan_status = 'fluid_present'
    """
    conditions_met = []

    if ctx.los_hours > 72:
        conditions_met.append(f"LOS > 72h (current: {ctx.los_hours:.1f}h)")
    if ctx.primary_condition.lower() in ("post-op", "post_op", "postop"):
        conditions_met.append(f"Primary condition: {ctx.primary_condition}")
    if ctx.latest_scan_status and "fluid" in ctx.latest_scan_status.lower():
        conditions_met.append(f"Scan status: {ctx.latest_scan_status}")

    if len(conditions_met) == 3:
        return CdssSuggestion(
            rule_id="CDSS-RULE-001",
            suggested_action="Order ultrasound-guided drainage",
            action_type="Order Drainage",
            rationale=(
                f"Patient has been warded for {ctx.los_hours:.1f} hours post-operatively "
                f"with fluid detected on the most recent scan ({ctx.latest_scan_type or 'imaging'}). "
                "Ultrasound-guided drainage is clinically indicated to prevent post-op complications."
            ),
            severity="critical",
            triggered_conditions=conditions_met,
        )
    return None


def rule_extended_los_review(ctx: PatientContext) -> Optional[CdssSuggestion]:
    """
    RULE CDSS-002: Patient significantly exceeds expected LOS without discharge plan.
    Trigger: los_hours > expected_los_hours * 1.5 (or > 120h if no expectation set)
    """
    if ctx.expected_los_hours:
        threshold = ctx.expected_los_hours * 1.5
    else:
        threshold = 120.0  # Default: flag after 5 days

    if ctx.los_hours > threshold:
        return CdssSuggestion(
            rule_id="CDSS-RULE-002",
            suggested_action="Schedule clinical review and update discharge plan",
            action_type="Dosage Observation",
            rationale=(
                f"Patient LOS ({ctx.los_hours:.1f}h) has exceeded the expected threshold "
                f"({threshold:.0f}h). A multidisciplinary review should be scheduled to "
                "reassess the treatment plan and update the discharge timeline."
            ),
            severity="warning",
            triggered_conditions=[
                f"LOS {ctx.los_hours:.1f}h exceeds threshold {threshold:.0f}h",
            ],
        )
    return None


def rule_low_oxygen_saturation(ctx: PatientContext) -> Optional[CdssSuggestion]:
    """
    RULE CDSS-003: Oxygen saturation below safe threshold.
    Trigger: SpO2 < 92%
    """
    if ctx.oxygen_saturation is not None and ctx.oxygen_saturation < 92.0:
        return CdssSuggestion(
            rule_id="CDSS-RULE-003",
            suggested_action="Administer supplemental oxygen and escalate to respiratory team",
            action_type="Order Dosage",
            rationale=(
                f"Oxygen saturation is critically low at {ctx.oxygen_saturation:.1f}%. "
                "Immediate supplemental oxygen administration is required. "
                "Consider ABG analysis and respiratory specialist review."
            ),
            severity="critical",
            triggered_conditions=[f"SpO2 = {ctx.oxygen_saturation:.1f}% (threshold: 92%)"],
        )
    return None


def rule_elevated_heart_rate(ctx: PatientContext) -> Optional[CdssSuggestion]:
    """
    RULE CDSS-004: Sustained tachycardia in a post-op patient.
    Trigger: HR > 100 bpm AND condition = 'post-op'
    """
    conditions_met = []

    if ctx.heart_rate is not None and ctx.heart_rate > 100:
        conditions_met.append(f"Heart rate: {ctx.heart_rate} bpm (>100)")
    if ctx.primary_condition.lower() in ("post-op", "post_op", "postop"):
        conditions_met.append(f"Post-operative patient")

    if len(conditions_met) == 2:
        return CdssSuggestion(
            rule_id="CDSS-RULE-004",
            suggested_action="Order ECG and assess for post-op bleeding or infection",
            action_type="Order Investigation",
            rationale=(
                f"Sustained tachycardia ({ctx.heart_rate} bpm) in a post-operative patient "
                "may indicate haemorrhage, sepsis, or PE. An immediate ECG and clinical "
                "assessment for bleeding signs are recommended."
            ),
            severity="warning",
            triggered_conditions=conditions_met,
        )
    return None


def rule_fluid_present_cardiac(ctx: PatientContext) -> Optional[CdssSuggestion]:
    """
    RULE CDSS-005: Fluid detected in a cardiac patient — possible pleural effusion.
    Trigger: condition = 'cardiac' AND scan_status = 'fluid_present' AND LOS > 48h
    """
    conditions_met = []

    if ctx.primary_condition.lower() in ("cardiac", "heart_failure", "chf"):
        conditions_met.append(f"Cardiac condition: {ctx.primary_condition}")
    if ctx.latest_scan_status and "fluid" in ctx.latest_scan_status.lower():
        conditions_met.append(f"Scan status: {ctx.latest_scan_status}")
    if ctx.los_hours > 48:
        conditions_met.append(f"LOS > 48h (current: {ctx.los_hours:.1f}h)")

    if len(conditions_met) == 3:
        return CdssSuggestion(
            rule_id="CDSS-RULE-005",
            suggested_action="Cardiology consult and echocardiogram to assess effusion",
            action_type="Order Consult",
            rationale=(
                f"Fluid detected on imaging for a cardiac patient after {ctx.los_hours:.1f}h "
                "admission. This pattern is consistent with possible pleural or pericardial "
                "effusion requiring urgent cardiology review and echocardiogram."
            ),
            severity="critical",
            triggered_conditions=conditions_met,
        )
    return None


# ============================================================
# RULE REGISTRY
# Rules are evaluated in order. Earlier rules have higher priority.
# ============================================================
RULE_REGISTRY: list[RuleFunction] = [
    rule_post_op_fluid_drainage,
    rule_low_oxygen_saturation,
    rule_fluid_present_cardiac,
    rule_elevated_heart_rate,
    rule_extended_los_review,
]


# ============================================================
# ENGINE ENTRY POINT
# ============================================================
def evaluate_patient(ctx: PatientContext) -> CdssEvaluationResult:
    """
    Run all registered rules against the patient context.
    Returns a fully populated CdssEvaluationResult.
    """
    suggestions: list[CdssSuggestion] = []

    for rule_fn in RULE_REGISTRY:
        suggestion = rule_fn(ctx)
        if suggestion is not None:
            suggestions.append(suggestion)

    has_critical = any(s.severity == "critical" for s in suggestions)

    return CdssEvaluationResult(
        patient_id=ctx.patient_id,
        admission_id=ctx.admission_id,
        evaluated_at=datetime.now(timezone.utc),
        los_hours=ctx.los_hours,
        primary_condition=ctx.primary_condition,
        latest_scan_status=ctx.latest_scan_status,
        suggestions=suggestions,
        has_critical_suggestions=has_critical,
    )
