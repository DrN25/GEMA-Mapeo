"""Compatibility facade for report and audit consumers; no independent definitions."""
from app.validation.registry import (
    RuleCategory, ErrorRule, CATEGORIES_REGISTRY, RULES_REGISTRY,
    GEOMECHANICAL_THRESHOLDS, CATEGORY_OBSERVATIONS_REGISTRY,
    RULE_RECOMMENDATIONS_REGISTRY, get_rules_catalog_data,
)
