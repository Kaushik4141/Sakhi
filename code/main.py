import os
import base64
import uuid
import json
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import cloudinary
import cloudinary.uploader

# Import local modules
from parser import generate_product_brief
from poster import create_poster_from_file

app = FastAPI(title="KalaSakhi Python Engine")

# =====================================================================
# MODELS
# =====================================================================
class AnalyzeRequest(BaseModel):
    image_base64: str
    chat_transcript: str
    gemini_api_key: str = None
    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str

class GeneratePosterRequest(BaseModel):
    product_data: dict
    transparent_image_url: str
    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str

# =====================================================================
# HELPER: REMOVE BG VIA API
# =====================================================================
def remove_background_via_api(input_path: str, output_path: str, api_key: str):
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Cannot find the image at {input_path}")

    print("☁️  Uploading image to Background Removal API...")
    
    with open(input_path, 'rb') as file:
        response = requests.post(
            'https://api.remove.bg/v1.0/removebg',
            files={'image_file': file},
            data={'size': 'auto'},
            headers={'X-Api-Key': api_key},
        )

    if response.status_code == 200:
        with open(output_path, 'wb') as out_file:
            out_file.write(response.content)
        print(f"✅ API Success! Transparent cutout saved to: {output_path}")
        return True
    else:
        print(f"❌ API Request Failed: {response.status_code}")
        print(response.text)
        return False

# =====================================================================
# ENDPOINTS
# =====================================================================

@app.post("/analyze")
async def analyze_endpoint(req: AnalyzeRequest):
    try:
        # 1. Decode base64 and save raw image
        session_id = str(uuid.uuid4())
        raw_image_path = f"temp_{session_id}_raw.jpg"
        transparent_image_path = f"temp_{session_id}_transparent.png"
        json_output_path = f"temp_{session_id}.json"

        # Handle data URL prefix if present
        b64_data = req.image_base64
        if ',' in b64_data:
            b64_data = b64_data.split(',')[1]

        with open(raw_image_path, "wb") as fh:
            fh.write(base64.b64decode(b64_data))

        # 2. Extract Data using Gemini
        print("🧠 Calling Gemini for product analysis...")
        product_data = generate_product_brief(
            chat_transcript=req.chat_transcript, 
            image_file_path=raw_image_path, 
            output_json_path=json_output_path,
            api_key=req.gemini_api_key
        )

        # 3. Remove Background
        print("✂️ Removing background...")
        # Using the API key provided by the user
        REMOVE_BG_API_KEY = "H5rzBoFS4P7B62n5FRouEums"
        success = remove_background_via_api(raw_image_path, transparent_image_path, REMOVE_BG_API_KEY)
        
        if not success:
            raise Exception("Background removal API failed")

        # 4. Upload Transparent Image to Cloudinary
        print("☁️ Uploading transparent image to Cloudinary...")
        cloudinary.config(
            cloud_name=req.cloudinary_cloud_name,
            api_key=req.cloudinary_api_key,
            api_secret=req.cloudinary_api_secret
        )
        
        upload_result = cloudinary.uploader.upload(transparent_image_path, folder="kalasakhi_assets")
        transparent_url = upload_result.get("secure_url")

        # Cleanup
        for path in [raw_image_path, transparent_image_path, json_output_path]:
            if os.path.exists(path):
                os.remove(path)

        return {
            "success": True,
            "product_data": product_data,
            "transparent_image_url": transparent_url
        }

    except Exception as e:
        print(f"❌ Error in /analyze: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-poster")
async def generate_poster_endpoint(req: GeneratePosterRequest):
    try:
        session_id = str(uuid.uuid4())
        transparent_image_path = f"temp_{session_id}_transparent.png"
        json_input_path = f"temp_{session_id}.json"
        poster_output_path = f"temp_{session_id}_poster.png"

        # 1. Download the transparent image from Cloudinary
        print("📥 Downloading transparent image from Cloudinary...")
        img_data = requests.get(req.transparent_image_url).content
        with open(transparent_image_path, 'wb') as handler:
            handler.write(img_data)

        # 2. Write the JSON data to a file for poster.py to read
        with open(json_input_path, 'w', encoding='utf-8') as f:
            json.dump(req.product_data, f)

        # 3. Generate Poster
        print("🎨 Generating final marketing poster...")
        create_poster_from_file(json_input_path, transparent_image_path, poster_output_path)

        # 4. Upload Poster to Cloudinary
        print("☁️ Uploading final poster to Cloudinary...")
        cloudinary.config(
            cloud_name=req.cloudinary_cloud_name,
            api_key=req.cloudinary_api_key,
            api_secret=req.cloudinary_api_secret
        )
        
        upload_result = cloudinary.uploader.upload(poster_output_path, folder="kalasakhi_posters")
        poster_url = upload_result.get("secure_url")

        # Cleanup
        for path in [transparent_image_path, json_input_path, poster_output_path]:
            if os.path.exists(path):
                os.remove(path)

        return {
            "success": True,
            "poster_url": poster_url
        }

    except Exception as e:
        print(f"❌ Error in /generate-poster: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
