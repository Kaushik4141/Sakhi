"""Shared state for the Vyapar-Mitra AI workforce (see __init__.py docstring).

This file re-exports WorkforceState and the TypedDicts from the package __init__
so nodes can do `from workforce.state import WorkforceState, ...` regardless of
how the package is laid out.
"""

from . import (  # noqa: F401  (re-export)
    ProductBrief,
    PricingDecision,
    MarketingAssets,
    BusinessSnapshot,
    WorkforceState,
)
