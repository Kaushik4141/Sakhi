"""Shared state for the Vyapar-Mitra AI workforce.

WorkforceState is the single typed object every agent reads from and writes to.
Agents never call each other directly — they update slices of this state, and
the graph's edges decide who runs next. That separation is what lets the Planner
reroute (e.g. SELL_PRODUCT vs BUSINESS_SNAPSHOT) without rewiring any agent code.

This mirrors the multi-agent architecture in the project README:
Layer 2 (Planner) decomposes a goal, Layer 3 (Workforce) executes it, and each
node here corresponds to one specialized "AI employee".
"""

from typing import TypedDict, Optional, Annotated

try:
    # add_messages lets us append progress lines instead of overwriting them,
    # so every agent's status survives to the final response.
    from langgraph.graph.message import add_messages
except Exception:  # pragma: no cover - allow import even if langgraph absent
    def add_messages(left, right):  # type: ignore
        if isinstance(right, list):
            return (left or []) + right
        return (left or []) + [right]


# --------------------------------------------------------------------------- #
# Sub-states — one per agent's output slice
# --------------------------------------------------------------------------- #

class ProductBrief(TypedDict, total=False):
    """Output of the Product Agent (and the Visual Agent fills transparent_image_url)."""
    product_name_english: str
    category: str
    material: str
    color: str
    seo_keywords: list[str]
    detailed_visual_description: str
    transparent_image_url: str
    manufacturing_cost_inr: Optional[float]   # filled by Pricing Agent
    competitor_avg_inr: Optional[float]      # filled by Pricing Agent


class PricingDecision(TypedDict):
    """Output of the Pricing Agent."""
    suggested_price_inr: float
    competitor_avg_inr: float
    manufacturing_cost_inr: float
    margin_percent: float
    rationale: str


class MarketingAssets(TypedDict):
    """Output of the Marketing Agent."""
    whatsapp_campaign: str
    instagram_caption: str
    promo_offer: str


class BusinessSnapshot(TypedDict, total=False):
    """Output of the Sales Intelligence / snapshot node."""
    week_revenue_inr: float
    top_seller: str
    dead_stock_item: str
    pending_payment_inr: float
    summary: str


# --------------------------------------------------------------------------- #
# The graph's root state
# --------------------------------------------------------------------------- #

class WorkforceState(TypedDict, total=False):
    # --- Set by Layer 1 (the Hono voice bridge) before invoking the graph ---
    artisan_id: str
    goal: str                          # "SELL_PRODUCT" | "BUSINESS_SNAPSHOT" | ...
    goal_context: dict                # e.g. {"product": "soap", "quantity": 20, "image_base64": ...}
    chat_transcript: str               # recent conversation memory

    # --- Filled in as agents run ---
    product: Optional[ProductBrief]
    pricing: Optional[PricingDecision]
    marketing: Optional[MarketingAssets]
    snapshot: Optional[BusinessSnapshot]

    # --- Surface back to Gemini Live so the voice agent can narrate progress ---
    progress: Annotated[list[str], add_messages]   # human-readable status lines
    artifacts: dict                               # poster_url, shop_url, etc.
    errors: list[str]
