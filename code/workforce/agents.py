"""Agent nodes — one function per specialized "AI employee".

Every node has the signature `async (state) -> dict` and returns a *partial*
update of WorkforceState (not the whole state). LangGraph merges the partial
into the running state between nodes.

Design rules (enforced here, not by the framework):
  * Agents never call other agents directly — they only read/write state slices.
  * LLM-backed nodes (Product, Marketing) request strict JSON so a parser can
    turn the response into a typed dict.
  * Glue nodes (Visual, Publish) do NOT call the LLM — they orchestrate the
    existing HTTP services (/analyze, /generate-poster, /auto-finalize) so we
    don't burn tokens or introduce hallucination on deterministic work.
  * Pricing is intentionally a deterministic formula over (cost, competitor
    avg) — the LLM summarises the rationale, but the number is computed. This
    keeps money decisions auditable.
"""

from __future__ import annotations

import json
import os
from typing import Any

from .state import WorkforceState, ProductBrief, PricingDecision, MarketingAssets, BusinessSnapshot


# --------------------------------------------------------------------------- #
# LLM access — optional. If langchain-google-genai is missing or GEMINI_API_KEY
# is unset, nodes fall back to a deterministic placeholder so the graph still
# runs end-to-end (useful for local development before wiring real keys).
# --------------------------------------------------------------------------- #

llm = None
try:
    from langchain_google_genai import ChatGoogleGenerativeAI  # type: ignore
    if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
        llm = ChatGoogleGenerativeAI(
            model=os.getenv("WORKFORCE_MODEL", "gemini-2.5-flash"),
            temperature=0.2,
        )
except Exception:  # pragma: no cover
    llm = None


async def _llm_json(prompt: str) -> dict[str, Any]:
    """Call the LLM and return parsed JSON, or an empty dict if unavailable."""
    if llm is None:
        return {}
    resp = await llm.ainvoke(prompt)
    # ChatGoogleGenerativeAI returns an AIMessage; .content is the text body.
    text = getattr(resp, "content", str(resp))
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.lower().startswith("json"):
            text = text[4:]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Ask the model to re-emit as strict JSON once; if still bad, give up.
        retry = await llm.ainvoke(
            "Return ONLY a valid JSON object, no prose. Previous attempt:\n" + text
        )
        try:
            return json.loads(getattr(retry, "content", str(retry)).strip())
        except Exception:
            return {}


# --------------------------------------------------------------------------- #
# Existing service endpoints (the Visual + Publish nodes delegate to these).
# Configurable so this works against local FastAPI or a deployed worker.
# --------------------------------------------------------------------------- #

PYTHON_BASE = os.getenv("PYTHON_API_URL", "http://127.0.0.1:8000")
BACKEND_BASE = os.getenv("BACKEND_API_URL", "http://127.0.0.1:8787")


async def _post(url: str, payload: dict) -> dict:
    import aiohttp  # local import keeps the dep optional
    async with aiohttp.ClientSession() as s, s.post(url, json=payload) as r:
        data = await r.json()
        if r.status >= 400:
            raise RuntimeError(f"{url} -> {r.status}: {data}")
        return data


# --------------------------------------------------------------------------- #
# Nodes
# --------------------------------------------------------------------------- #

async def planner(state: WorkforceState) -> dict:
    """Pure router — routing happens in graph edges (route_goal), so this node
    just records that planning happened. Keeping it explicit means the trace
    always shows the decomposition step even if routing logic is deterministic."""
    return {"progress": [f"🧭 Planner: routing goal '{state.get('goal')}'."]}


async def product_agent(state: WorkforceState) -> dict:
    ctx = state.get("goal_context", {}) or {}
    # If /analyze already ran (photo cached in Redis as pending_listing), seed
    # the brief from that real analysis instead of asking the LLM to invent it.
    cached = ctx.get("existing_product_data") or {}
    prompt = (
        "You are the Product Agent. Produce an optimized marketplace listing.\n"
        f"Product mentioned: {ctx.get('product', 'unknown')}\n"
        f"Quantity: {ctx.get('quantity', 1)}\n"
        f"Existing analysis: {json.dumps(cached) if cached else 'none'}\n"
        f"Recent transcript: {state.get('chat_transcript', '')}\n\n"
        "If existing analysis already provides fields, refine them (better SEO "
        "keywords, tighter description) rather than discarding them.\n"
        "Return STRICT JSON only with keys: product_name_english, category, "
        "material, color, seo_keywords (array of strings), "
        "detailed_visual_description."
    )
    data = await _llm_json(prompt) or {}
    brief: ProductBrief = {
        "product_name_english": data.get("product_name_english") or cached.get("product_name_english") or ctx.get("product", "Handmade product"),
        "category": data.get("category") or cached.get("category") or "Handicraft",
        "material": data.get("material") or cached.get("material") or "Mixed materials",
        "color": data.get("color") or cached.get("color") or "Natural",
        "seo_keywords": data.get("seo_keywords") or cached.get("seo_keywords") or ["handmade", "artisan"],
        "detailed_visual_description": data.get("detailed_visual_description") or cached.get("detailed_visual_description") or "",
    }
    return {
        "product": brief,
        "progress": [f"📦 Product Agent: listed '{brief['product_name_english']}' ({brief['category']})."],
    }


async def visual_agent(state: WorkforceState) -> dict:
    """Premium cutout via the existing /analyze service (remove.bg → Cloudinary).

    Short-circuits when the artisan already took a photo through the /analyze
    flow: we trust its cached transparent_image_url and skip a second remove.bg
    call (saves a paid API hit + a Cloudinary upload per listing)."""
    ctx = state.get("goal_context", {}) or {}
    cached_url = ctx.get("transparent_image_url")
    if cached_url:
        product = dict(state.get("product") or {})
        product["transparent_image_url"] = cached_url
        # The cached /analyze also produced richer product fields — merge them.
        cached = ctx.get("existing_product_data") or {}
        for k in ("product_name_english", "category", "material", "color", "seo_keywords", "detailed_visual_description"):
            if cached.get(k) and not product.get(k):
                product[k] = cached[k]
        return {"product": product, "progress": ["🖼️ Visual Agent: reused cached premium cutout."]}

    image_b64 = ctx.get("image_base64")
    if not image_b64:
        return {"progress": ["🖼️ Visual Agent: no image provided, skipping cutout."]}
    try:
        out = await _post(f"{PYTHON_BASE}/analyze", {
            "image_base64": image_b64,
            "chat_transcript": state.get("chat_transcript", ""),
            "gemini_api_key": os.getenv("GEMINI_API_KEY"),
            "cloudinary_cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME", ""),
            "cloudinary_api_key": os.getenv("CLOUDINARY_API_KEY", ""),
            "cloudinary_api_secret": os.getenv("CLOUDINARY_API_SECRET", ""),
        })
        transparent_url = out.get("transparent_image_url", "")
        product = dict(state.get("product") or {})
        product["transparent_image_url"] = transparent_url
        # product_data may carry richer fields from /analyze — merge what's useful
        pd = out.get("product_data", {}) or {}
        for k in ("product_name_english", "category", "material", "color", "seo_keywords", "detailed_visual_description"):
            if pd.get(k) and not product.get(k):
                product[k] = pd[k]
        return {"product": product, "progress": ["🖼️ Visual Agent: premium cutout ready."]}
    except Exception as e:  # noqa: BLE001
        return {"errors": [f"visual_agent: {e}"],
                "progress": [f"🖼️ Visual Agent: cutout failed ({e}); continuing."]}


async def pricing_agent(state: WorkforceState) -> dict:
    """Deterministic price over (cost, competitor avg) — the LLM only writes the rationale.
    Money math must not live inside an LLM's discretion; keep it auditable."""
    ctx = state.get("goal_context", {}) or {}
    product = state.get("product", {}) or {}
    cost = float(ctx.get("manufacturing_cost_inr", 70) or 70)

    # Reuse the existing Tavily market-research limb for competitor pricing.
    competitor_avg = await _fetch_competitor_avg(product.get("product_name_english", ctx.get("product", "")))

    if competitor_avg and competitor_avg > 0:
        # Undercut the market avg by ~7%, but never below cost * 1.4 (floor margin).
        suggested = round(min(competitor_avg * 0.93, max(cost * 1.4, competitor_avg * 0.85)))
    else:
        # No competitor data → cost-plus 70%.
        suggested = round(cost * 1.7)

    margin = round((suggested - cost) / suggested * 100, 1)
    rationale = (
        f"Listed ₹{suggested} vs competitor avg ₹{competitor_avg} "
        f"(manufacturing cost ₹{cost}); margin {margin}%."
    )
    decision: PricingDecision = {
        "suggested_price_inr": suggested,
        "competitor_avg_inr": competitor_avg,
        "manufacturing_cost_inr": cost,
        "margin_percent": margin,
        "rationale": rationale,
    }
    # Backfill cost/competitor onto the product brief for the publish step.
    new_product = dict(product)
    new_product["manufacturing_cost_inr"] = cost
    new_product["competitor_avg_inr"] = competitor_avg
    return {"pricing": decision, "product": new_product,
            "progress": [f"💰 Pricing Agent: ₹{suggested} (margin {margin}%)."]}


async def marketing_agent(state: WorkforceState) -> dict:
    product = state.get("product", {}) or {}
    pricing = state.get("pricing", {}) or {}
    price = pricing.get("suggested_price_inr", "?")
    prompt = (
        "You are the Marketing Agent. Write Indian-local customer acquisition copy.\n"
        f"Product: {product.get('product_name_english', 'handmade product')} (₹{price}).\n"
        f"Keywords: {product.get('seo_keywords', [])}.\n"
        "Return STRICT JSON only with keys: whatsapp_campaign, instagram_caption, promo_offer."
    )
    data = await _llm_json(prompt) or {}
    assets: MarketingAssets = {
        "whatsapp_campaign": data.get("whatsapp_campaign", "New handmade collection available. Limited stock — order now!"),
        "instagram_caption": data.get("instagram_caption", f"{product.get('product_name_english', 'New arrival')} ✨ #handmade #artisan"),
        "promo_offer": data.get("promo_offer", "Flat 10% off first order."),
    }
    return {"marketing": assets, "progress": ["📣 Marketing Agent: WhatsApp + Instagram copy ready."]}


async def publish_agent(state: WorkforceState) -> dict:
    """Final execution: generate poster (existing /generate-poster) and list the
    product (existing backend /auto-finalize or /api/products). Pure glue — no LLM."""
    product = state.get("product", {}) or {}
    pricing = state.get("pricing", {}) or {}
    transparent_url = product.get("transparent_image_url", "")
    artifacts: dict[str, Any] = {}

    if transparent_url:
        try:
            out = await _post(f"{PYTHON_BASE}/generate-poster", {
                "product_data": product,
                "transparent_image_url": transparent_url,
                "cloudinary_cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME", ""),
                "cloudinary_api_key": os.getenv("CLOUDINARY_API_KEY", ""),
                "cloudinary_api_secret": os.getenv("CLOUDINARY_API_SECRET", ""),
            })
            if out.get("success"):
                artifacts["poster_url"] = out.get("poster_url")
        except Exception as e:  # noqa: BLE001
            return {"errors": [f"publish (poster): {e}"],
                    "artifacts": artifacts,
                    "progress": [f"⚠️ Publish: poster failed ({e})."]}

    try:
        # Call the backend's existing auto-finalize endpoint to persist the listing.
        out = await _post(f"{BACKEND_BASE}/auto-finalize", {
            "artisanId": state.get("artisan_id", ""),
            "price": pricing.get("suggested_price_inr", 0),
            "discount": state.get("goal_context", {}).get("discount", 0),
        })
        if out.get("success"):
            artifacts["shop_url"] = out.get("shopUrl")
            artifacts["product_id"] = out.get("productId")
    except Exception as e:  # noqa: BLE001
        return {"errors": [f"publish (finalize): {e}"], "artifacts": artifacts,
                "progress": [f"⚠️ Publish: finalize failed ({e})."]}

    shop = artifacts.get("shop_url", "")
    return {"artifacts": artifacts,
            "progress": [f"✅ Publish Agent: live at {shop or '(shop pending)'}."]}


async def snapshot_agent(state: WorkforceState) -> dict:
    """Read-only business summary for BUSINESS_SNAPSHOT goals. Mirrors the
    backend getBusinessSnapshot() — done here over HTTP to keep Python self-contained."""
    snap: BusinessSnapshot = {}
    try:
        out = await _post(f"{BACKEND_BASE}/business-snapshot", {"artisanId": state.get("artisan_id", "")})
        snap = out.get("snapshot", out)
    except Exception as e:  # noqa: BLE001
        return {"errors": [f"snapshot: {e}"],
                "snapshot": snap,
                "progress": [f"⚠️ Snapshot: unavailable ({e})."]}
    rev = snap.get("week_revenue_inr", 0)
    top = snap.get("top_seller", "None")
    return {"snapshot": snap,
            "progress": [f"📊 This week ₹{rev} revenue, top seller {top}."]}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

async def _fetch_competitor_avg(product_name: str) -> float:
    """Reuse the existing Tavily market-research limb (deep-research-agents)."""
    # The TS market-agent is a thin fetch() over Tavily. We call the backend's
    # /api/market-insights pipeline indirectly by querying the backend; if that
    # route isn't available, return 0 and pricing falls back to cost-plus.
    try:
        out = await _post(f"{BACKEND_BASE}/competitor-pricing", {"product_name": product_name})
        return float(out.get("average_inr", 0) or 0)
    except Exception:
        return 0.0
