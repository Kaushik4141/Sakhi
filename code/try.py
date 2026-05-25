import code.parser as parser
import code.poster as poster

def run_kalasakhi_pipeline(chat_log: str, raw_image_path: str, json_file_path: str, final_poster_path: str):
    print("🚀 STARTING KALASAKHI AUTOMATION PIPELINE...\n")
    
    try:
        # --- 1. RUN THE AI BRAIN (Saves to JSON) ---
        print("▶️ Phase 1: Analyzing data with Gemini...")
        parser.generate_product_brief(
            chat_transcript=chat_log, 
            image_file_path=raw_image_path,
            output_json_path=json_file_path
        )
        print("✅ AI Extraction Complete! Real data saved to disk.\n")
        
        # --- 2. RUN THE POSTER ENGINE (Reads from JSON) ---
        print("▶️ Phase 2: Painting the marketing poster...")
        poster.create_poster_from_file(
            json_file_path=json_file_path, 
            input_image_path=raw_image_path, 
            output_poster_path=final_poster_path
        )
        
        print(f"\n🏆 PIPELINE FINISHED! Check your folder for {final_poster_path} and {json_file_path}.")
        
    except Exception as e:
        print(f"\n❌ Pipeline crashed: {e}")

# =====================================================================
# 🔥 RUN THE LIVE TEST
# =====================================================================
if __name__ == "__main__":
    # The raw inputs from your application
    USER_CHAT = """
    Artisan: Hello, can you hear me? Look, I took a picture of the jute bag I finished sewing. It has a nice handle.
    App: Namaste! Yes, the picture came through perfectly. The weave looks very durable. Are you based in the Mangaluru area?
    Artisan: Yes, I am stitching these from my home setup near Bantwal. I want to sell this piece for 300 rupees.
    """
    
    # The exact filenames the pipeline will use and create
    SOURCE_IMAGE = "image.jpg"
    TEMP_JSON_FILE = "product_data.json"
    FINAL_POSTER = "kalasakhi_final_poster.png"
    
    # Fire the bridge function
    run_kalasakhi_pipeline(USER_CHAT, SOURCE_IMAGE, TEMP_JSON_FILE, FINAL_POSTER)