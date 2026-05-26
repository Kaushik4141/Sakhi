import os
import json
from pydantic import BaseModel, Field
from google import genai  
from google.genai import types
from PIL import Image

# We will initialize the client dynamically inside the function
# client = genai.Client()

# =====================================================================
# 📋 STEP 1: DEFINE THE RICH DESCRIPTION & CONVERSATION SCHEMA
# =====================================================================
class CompleteProductBrief(BaseModel):
    product_name_english: str = Field(description="Marketable English name for the product.")
    artisan_claimed_price: int = Field(description="The listing price discussed in the chat.")
    origin_region: str = Field(description="Specific locality/district mentioned or implied.")
    detailed_visual_description: str = Field(
        description="A rich, multi-sentence analysis of the product's design, quality, color palette, "
                    "and visible craftsmanship as seen in the photo. Highlight what makes it unique."
    )
    conversation_context_summary: str = Field(
        description="A clear summary of the interaction. Note the artisan's mood, readiness to sell, "
                    "any specific requests they made, and the next operational steps agreed upon with the AI."
    )
    seo_keywords: list[str] = Field(
        description="A list of 6-8 search-optimized keywords for digital marketing (e.g., 'sustainable tote', 'handmade jute bag')."
    )

# =====================================================================
# 🛠️ STEP 2: THE SINGLE-SHOT MULTIMODAL PARSING CORNERSTONE FUNCTION
# =====================================================================
# 👇 THIS IS THE LINE THAT WAS CAUSING YOUR CRASH! IT NOW HAS output_json_path
def generate_product_brief(chat_transcript: str, image_file_path: str, output_json_path: str, api_key: str = None) -> dict:
    if not os.path.exists(image_file_path):
        raise FileNotFoundError(f"Target product image missing at: {image_file_path}")
        
    print("🔮 Opening artisan asset and packaging cloud contents...")
    raw_img = Image.open(image_file_path)
    
    system_prompt = """\
# ============================================================
# KALASAKHI PRODUCT CATALOGING ENGINE — SYSTEM PROMPT v2.0
# ============================================================

## ROLE & MISSION
You are the Senior Product Intelligence Engine for KalaSakhi, a platform that
digitizes traditional Indian handicrafts for rural artisans. Your sole purpose in
every invocation is to produce a single, valid, raw JSON object — nothing else.

You receive TWO inputs simultaneously:
1. A voice conversation transcript between the KalaSakhi app and an artisan.
2. A smartphone photograph of the artisan's handicraft product.

Your output MUST be a raw JSON object conforming exactly to the schema below.
No markdown. No explanation. No preamble. No trailing text. No code fences.
Start the response with { and end it with }.

---

## OUTPUT SCHEMA (strict — never add or remove keys)
{
  "product_name_english": <string>,
  "artisan_claimed_price": <integer>,
  "origin_region": <string>,
  "detailed_visual_description": <string>,
  "conversation_context_summary": <string>,
  "seo_keywords": [<string>, <string>, ...]
}

---

## FIELD-BY-FIELD EXTRACTION RULES

### `product_name_english`
- Produce a short (3–6 words), marketable, e-commerce-ready English product title.

### `artisan_claimed_price`
- Extract the numeric price the artisan stated they want for the item. Output as an integer.

### `origin_region`
- Extract the most specific geographic reference mentioned.

### `detailed_visual_description`
- This field is IMAGE-DRIVEN. Describe form factor, material, texture, color, and craftsmanship in 3-5 sentences. Do not use "I see". Write as a product listing.

### `conversation_context_summary`
- This field is TRANSCRIPT-DRIVEN. Summarize operational intelligence (base, readiness, concerns) in 3-5 sentences.

### `seo_keywords`
- Output a JSON array of exactly 6 to 8 search-optimized keywords.

---
## HARD CONSTRAINTS (never violate these)
1. RAW JSON ONLY. 
2. NO HALLUCINATION. Use 0 for unknown price, "Karnataka" for unknown location.
3. SCHEMA COMPLIANCE. Output exactly the 6 keys listed.
4. MULTIMODAL PRIORITY. Trust the image for visuals, transcript for operations.
5. LANGUAGE NORMALIZATION. All outputs in English.

Every token you output must serve the JSON structure. Begin your response immediately with {.
"""

    user_prompt = f"Execute structural catalog parsing. Here is the active context transcript:\n\n{chat_transcript}"
    
    print("⚡ Transmitting multimodal payload to Gemini 2.5 Matrix...")
    
    # Initialize client locally
    if api_key:
        client = genai.Client(api_key=api_key)
    else:
        client = genai.Client()
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[raw_img, user_prompt],
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=CompleteProductBrief,  
            temperature=0.1
        ),
    )
    
    extracted_data = json.loads(response.text)
    
    # 👇 THIS IS WHERE IT SAVES THE FILE
    print(f"💾 Saving data to {output_json_path}...")
    with open(output_json_path, 'w', encoding='utf-8') as file:
        json.dump(extracted_data, file, indent=4)
        
    return extracted_data