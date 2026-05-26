# import os
# from PIL import Image, ImageDraw, ImageFont
# import textwrap

# def create_artisan_poster(product_data: dict, input_image_path: str, output_poster_path: str):
#     """
#     Programmatically paints a marketing poster canvas combining 
#     the upscaled product image asset with the parsed Gemma text metadata.
#     """
#     # ─── 1. INITIALIZE CANVAS DIMENSIONS & SCHEME ───
#     POSTER_WIDTH = 1080
#     POSTER_HEIGHT = 1350  # 4:5 Instagram/WhatsApp portrait aspect ratio
#     BACKGROUND_COLOR = (253, 251, 247)  # Warm, organic artisan off-white cream
#     PRIMARY_COLOR = (44, 24, 16)        # Deep earthy brown for headings
#     TEXT_COLOR = (60, 50, 45)           # Soft charcoal for body readable copy
#     ACCENT_COLOR = (212, 140, 70)       # Warm terracotta accent lines/borders

#     # Create empty poster canvas [1.2]
#     poster = Image.new("RGB", (POSTER_WIDTH, POSTER_HEIGHT), BACKGROUND_COLOR)
#     draw = ImageDraw.Draw(poster) # [1.2]

#     # ─── 2. LOAD FONTS ───
#     # For a hackathon, fallback to default if custom ttf fonts aren't in your directory [2.2]
#     try:
#         title_font = ImageFont.truetype("arial.ttf", 46)
#         body_font = ImageFont.truetype("arial.ttf", 28)
#         meta_font = ImageFont.truetype("arial.ttf", 36)
#     except IOError:
#         print("⚠️ Custom fonts missing, loading fallback layout configurations...")
#         title_font = body_font = meta_font = ImageFont.load_default()

#     # ─── 3. PROCESS & EMBED PRODUCT IMAGE ───
#     if os.path.exists(input_image_path):
#         product_img = Image.open(input_image_path).convert("RGB")
        
#         # Resize image to fit nicely within a 900x650 bounding box while preserving aspect ratio
#         target_w, target_h = 900, 650
#         product_img.thumbnail((target_w, target_h), Image.Resampling.LANCZOS)
        
#         # Calculate centering offset math
#         img_x = (POSTER_WIDTH - product_img.width) // 2
#         img_y = 180 # Vertical starting position for the main showcase image
        
#         # Paste product image into the poster grid space [1.4]
#         poster.paste(product_img, (img_x, img_y))
        
#         # Decorative border around the photo block [1.4]
#         draw.rectangle(
#             [img_x - 4, img_y - 4, img_x + product_img.width + 4, img_y + product_img.height + 4],
#             outline=ACCENT_COLOR, width=2
#         )
#     else:
#         print(f"⚠️ Source image missing at {input_image_path}, sketching placeholder frame...")

#     # ─── 4. DRAW HEADER & TEXT LAYERS ───
#     # Platform Tag Header
#     draw.text((POSTER_WIDTH // 2, 80), "✨ KALASAKHI MARKETPLACE ✨", font=body_font, fill=ACCENT_COLOR, anchor="mm")
    
#     # Divider Line [1.4]
#     draw.line([(100, 130), (POSTER_WIDTH - 100, 130)], fill=ACCENT_COLOR, width=1)

#     # Product Title Heading
#     title_text = product_data.get("product_name_english", "Handicraft Asset").upper()
#     draw.text((100, 880), title_text, font=title_font, fill=PRIMARY_COLOR)

#     # ─── 5. AUTOMATIC TEXT WRAPPING FOR DESCRIPTIONS ───
#     # Standard string lines will overflow past the canvas boundary. Use textwrap to cut lines neatly [2.1, 2.5]
#     description_text = product_data.get("detailed_visual_description", "No description provided.")
#     wrapped_lines = textwrap.wrap(description_text, width=65) # Automatically wraps at ~65 characters per line [2.1]
    
#     current_y = 950
#     for line in wrapped_lines:
#         draw.text((100, current_y), line, font=body_font, fill=TEXT_COLOR)
#         current_y += 38 # Line spacing increment height [2.5]

#     # ─── 6. METADATA METRICS FOOTER LAYER ───
#     # Bottom Accent Banner Box [1.4]
#     footer_top_y = 1180
#     draw.rectangle([100, footer_top_y, POSTER_WIDTH - 100, footer_top_y + 90], fill=(242, 234, 222))
    
#     # Inject Price Tag Data Variable
#     price_val = product_data.get("artisan_claimed_price", 0)
#     price_text = f"Price: ₹{price_val}" if price_val > 0 else "Price: Contact Artisan"
#     draw.text((140, footer_top_y + 25), price_text, font=meta_font, fill=PRIMARY_COLOR)

#     # Inject Geographic Origin Location
#     region_text = f"Origin: {product_data.get('origin_region', 'Karnataka')}"
#     draw.text((POSTER_WIDTH - 140, footer_top_y + 25), region_text, font=meta_font, fill=PRIMARY_COLOR, anchor="ra")

#     # ─── 7. EXPORT COMPILED POSTER ASSET ───
#     poster.save(output_poster_path, "PNG", quality=95)
#     print(f"🎉 Production Poster successfully baked and saved at: {output_poster_path}")


# # =====================================================================
# # 🧪 MOCK PIPELINE DATA INVOCATION CHECKER
# # =====================================================================
# if __name__ == "__main__":
#     # Simulating the structured variable object that comes straight out of your Gemma parser
#     MOCK_GEMMA_OUTPUT = {
#         "product_name_english": "Hand-Woven Premium Jute Tote Bag",
#         "artisan_claimed_price": 350,
#         "origin_region": "Bantwal, Dakshina Kannada",
#         "detailed_visual_description": "A beautifully structured carry bag woven from high-density natural jute fibers. Features robust cross-stitch cotton reinforcement along borders with thick braided handles built for durability and premium tactile feel.",
#         "conversation_context_summary": "Artisan working near Bantwal ready to fulfill orders.",
#         "seo_keywords": ["jute bag", "sustainable shopping"]
#     }
    
#     # Point this to your active image path inside the folder
#     TEST_IMAGE = "image.jpg"
#     OUTPUT_POSTER = "artisan_marketing_poster.png"
    
#     print("🎬 Initializing Poster Engine Canvas Compilation Module...")
#     create_artisan_poster(MOCK_GEMMA_OUTPUT, TEST_IMAGE, OUTPUT_POSTER)


import os
import json
from PIL import Image, ImageDraw, ImageFont
import textwrap

def create_poster_from_file(json_file_path: str, input_image_path: str, output_poster_path: str):
    # ─── 0. READ THE REAL AI DATA FROM THE FILE ───
    if not os.path.exists(json_file_path):
        raise FileNotFoundError(f"Cannot find AI data file: {json_file_path}. Run gemini_parser.py first!")
        
    print(f"📂 Reading AI data from {json_file_path}...")
    with open(json_file_path, 'r', encoding='utf-8') as f:
        product_data = json.load(f)

    # ─── 1. CANVAS SETTINGS ───
    W, H = 1080, 1350
    # Create an elegant gradient background
    poster = Image.new("RGB", (W, H))
    draw_bg = ImageDraw.Draw(poster)
    # Draw vertical gradient from light warm beige to a slightly darker terracotta beige
    for y in range(H):
        r = int(252 - (y / H) * (252 - 240))
        g = int(248 - (y / H) * (248 - 228))
        b = int(240 - (y / H) * (240 - 210))
        draw_bg.line([(0, y), (W, y)], fill=(r, g, b))

    TEXT_MAIN = (44, 30, 22)
    TEXT_MUTED = (90, 75, 65)
    ACCENT = (190, 110, 50)

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    try:
        font_title = ImageFont.truetype("arial.ttf", 72)
        font_body = ImageFont.truetype("arial.ttf", 26)
        font_tag = ImageFont.truetype("arialbd.ttf", 28)
    except IOError:
        font_title = font_body = font_tag = ImageFont.load_default()

    # ─── 2. IMAGE & SHADOWS ───
    if os.path.exists(input_image_path):
        # Open as RGBA to preserve transparency from remove.bg
        prod_img = Image.open(input_image_path).convert("RGBA")
        prod_img.thumbnail((750, 750), Image.Resampling.LANCZOS)
        img_x = (W - prod_img.width) // 2
        img_y = 150
        
        # Draw a beautiful soft glowing circle behind the product
        circle_radius = 420
        cx, cy = W // 2, img_y + (prod_img.height // 2)
        draw.ellipse(
            [cx - circle_radius, cy - circle_radius, cx + circle_radius, cy + circle_radius],
            fill=(255, 255, 255, 140)
        )
        
        # Draw soft drop shadow for the transparent object
        shadow = prod_img.copy()
        shadow_data = shadow.load()
        for y in range(shadow.height):
            for x in range(shadow.width):
                r, g, b, a = shadow_data[x, y]
                if a > 0:
                    shadow_data[x, y] = (0, 0, 0, int(a * 0.3))
        
        # Paste shadow with slight offset
        overlay.paste(shadow, (img_x + 10, img_y + 20), shadow)
        
        # Paste actual product
        overlay.paste(prod_img, (img_x, img_y), prod_img)
        
        poster = Image.alpha_composite(poster.convert("RGBA"), overlay).convert("RGB")
        poster_draw = ImageDraw.Draw(poster)
    else:
        poster_draw = ImageDraw.Draw(poster)
        img_y = 160
        prod_img = Image.new("RGB", (700, 700)) # Placeholder

    # ─── 3. TEXT LAYOUT (USING THE REAL DATA) ───
    poster_draw.text((W // 2, 70), "✦ KALASAKHI MARKETPLACE ✦", font=font_body, fill=ACCENT, anchor="mm")
    poster_draw.line([(200, 110), (W - 200, 110)], fill=(230, 220, 210), width=1)

    current_y = img_y + prod_img.height + 60
    title = product_data.get("product_name_english", "Handcrafted Asset").upper()
    poster_draw.text((W // 2, current_y), title, font=font_title, fill=TEXT_MAIN, anchor="mm")
    current_y += 100

    # ─── 4. UI BADGE FOOTER ───
    price = product_data.get('artisan_claimed_price', 0)
    
    poster_draw.rectangle([W//2 - 200, current_y, W//2 + 200, current_y + 80], fill=(245, 240, 230), outline=(230, 220, 210), width=1)
    poster_draw.text((W//2, current_y + 40), f"PRICE: ₹{price}", font=font_tag, fill=TEXT_MAIN, anchor="mm")

    poster.save(output_poster_path, "PNG", quality=100)
    print(f"🎉 Premium Poster saved: {output_poster_path}")

if __name__ == "__main__":
    create_poster_from_file("product_data.json", "image.jpg", "upgraded_poster.png")