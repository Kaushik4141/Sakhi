"""The LangGraph workflow — where the spoken goal becomes an explicit,
inspectable DAG of agents.

   merchant: "I made 20 soaps. Help me sell them."
                       │
                       ▼
                   planner ──(SELL_PRODUCT)──► product → visual → pricing
                       │                                          │
                       │                                          ▼
                       │                                       marketing → publish → END
                       │
                  (BUSINESS_SNAPSHOT)──► snapshot → END

State is shared (WorkforceState); edges are conditional on `state.goal`.
Because the graph is data, not code, adding a new goal path later (e.g.
RESTOCK) means adding one edge, not touching any agent.
"""

from __future__ import annotations

from typing import Any

from langgraph.graph import StateGraph, END

from .state import WorkforceState
from .agents import (
    planner,
    product_agent,
    visual_agent,
    pricing_agent,
    marketing_agent,
    publish_agent,
    snapshot_agent,
)

# Goals the Planner can route to. Kept as a module constant so the router and
# the /run-workforce endpoint agree on the vocabulary.
SUPPORTED_GOALS = {"SELL_PRODUCT", "BUSINESS_SNAPSHOT"}


def route_goal(state: WorkforceState) -> str:
    """Conditional-edge function: pick the first node to run after the planner."""
    goal = (state.get("goal") or "").upper()
    if goal == "SELL_PRODUCT":
        return "product"
    if goal == "BUSINESS_SNAPSHOT":
        return "snapshot"
    # Unknown goal → end immediately. (Caller can inspect state.progress/errors.)
    return END


def build_workforce_graph() -> Any:
    """Compile and return the runnable graph. Thread-safe to share one compiled
    instance across FastAPI requests."""
    g: StateGraph = StateGraph(WorkforceState)

    g.add_node("planner", planner)
    g.add_node("product", product_agent)
    g.add_node("visual", visual_agent)
    g.add_node("pricing", pricing_agent)
    g.add_node("marketing", marketing_agent)
    g.add_node("publish", publish_agent)
    g.add_node("snapshot", snapshot_agent)

    g.set_entry_point("planner")
    # Conditional routing out of the planner — the graph's "decomposition" step.
    g.add_conditional_edges("planner", route_goal)

    # The "sell this product" path — a straight, auditable DAG.
    g.add_edge("product", "visual")
    g.add_edge("visual", "pricing")
    g.add_edge("pricing", "marketing")
    g.add_edge("marketing", "publish")
    g.add_edge("publish", END)

    # The read-only business check.
    g.add_edge("snapshot", END)

    return g.compile()


# One compiled graph, reused per request. If state needs to survive across
# processes or restarts later, attach a Postgres checkpointer here without
# touching any agent code.
workforce_graph = build_workforce_graph()
