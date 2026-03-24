import os
import requests
import traceback
from dotenv import load_dotenv

out = ""
try:
    load_dotenv(r"c:\Users\Admin\Downloads\AI-CV-Management-main\AI-CV-Management-main\backend\.env")
    SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
    }
    res = requests.get(f"{SUPABASE_URL}/rest/v1/cv_ai_settings?select=*", headers=headers)
    data = res.json()
    if not data:
        out += "No settings found in Supabase\n"
    else:
        gemini_key = data[0].get("gemini_api_key")
        if not gemini_key:
            out += "No Gemini Key found in settings\n"
        else:
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={gemini_key}"
            response = requests.get(url)
            out += f"status {response.status_code}\n"
            try:
                models = response.json().get('models', [])
                for model in models:
                    methods = model.get('supportedGenerationMethods', [])
                    if 'generateContent' in methods:
                        out += f"Supported model: {model.get('name')}\n"
            except Exception as e:
                out += f"Error parsing: {e} {response.text}\n"
except Exception as e:
    out += traceback.format_exc()

with open(r"c:\Users\Admin\Downloads\AI-CV-Management-main\AI-CV-Management-main\backend\out_models.txt", "w", encoding="utf-8") as f:
    f.write(out)
