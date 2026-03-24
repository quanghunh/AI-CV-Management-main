import os

filepath = r"c:\Users\Admin\Downloads\AI-CV-Management-main\AI-CV-Management-main\backend\main.py"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Normalize line endings to avoid \r conflicts
content = content.replace("\r\n", "\n")

# Replace env vars definition
old_env = """OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY not found in environment variables")"""

new_env = """OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")"""

if old_env in content:
    content = content.replace(old_env, new_env)
    print("Env replacement done.")
else:
    print("Warning: old_env not found!")

# Replace the OpenRouter helper
old_helper = """def call_openrouter_api(messages: List[dict], model: str = "openai/gpt-4o-mini", temperature: float = 0.7, max_tokens: int = 4000) -> dict:
    try:
        response = requests.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "CV Management System"
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            },
            timeout=60
        )
        
        if response.status_code != 200:
            error_data = response.json()
            raise HTTPException(
                status_code=response.status_code,
                detail=f"OpenRouter API error: {error_data.get('error', {}).get('message', 'Unknown error')}"
            )
        
        return response.json()
    
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="OpenRouter API timeout")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")"""

new_helper = """def get_ai_config() -> dict:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return {}
    try:
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
        }
        res = requests.get(f"{SUPABASE_URL}/rest/v1/cv_ai_settings?select=*", headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            if data and len(data) > 0:
                return data[0]
    except Exception as e:
        print(f"Error fetching AI config: {e}")
    return {}

def call_openai_api(messages: List[dict], api_key: str, endpoint: str = "https://api.openai.com/v1", model: str = "gpt-4o-mini", temperature: float = 0.7, max_tokens: int = 4000) -> dict:
    if not endpoint:
        endpoint = "https://api.openai.com/v1"
    url = f"{endpoint}/chat/completions"
    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            },
            timeout=60
        )
        if response.status_code != 200:
            error_data = response.json()
            raise HTTPException(status_code=response.status_code, detail=f"OpenAI API error: {error_data.get('error', {}).get('message', 'Unknown error')}")
        return response.json()
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="OpenAI API timeout")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")

def call_gemini_api(messages: List[dict], api_key: str, model: str = "gemini-1.5-pro", temperature: float = 0.7, max_tokens: int = 4000) -> dict:
    contents = []
    system_instruction = None
    
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content")
        if role == "system":
            system_instruction = {"parts": [{"text": content}]}
        else:
            gemini_role = "user" if role == "user" else "model"
            contents.append({"role": gemini_role, "parts": [{"text": content}]})
            
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens
        }
    }
    if system_instruction:
        payload["systemInstruction"] = system_instruction
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    try:
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=60)
        if response.status_code != 200:
            error_data = response.json()
            raise HTTPException(status_code=response.status_code, detail=f"Gemini API error: {error_data.get('error', {}).get('message', 'Unknown error')}")
        
        data = response.json()
        text = ""
        if "candidates" in data and len(data["candidates"]) > 0:
            parts = data["candidates"][0].get("content", {}).get("parts", [])
            if parts and len(parts) > 0:
                text = parts[0].get("text", "")
                
        return {
            "choices": [
                {
                    "message": {
                        "content": text
                    }
                }
            ]
        }
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Gemini API timeout")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")

def call_openrouter_api_internal(messages: List[dict], api_key: str, model: str = "openai/gpt-4o-mini", temperature: float = 0.7, max_tokens: int = 4000) -> dict:
    try:
        response = requests.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "CV Management System"
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            },
            timeout=60
        )
        if response.status_code != 200:
            error_data = response.json()
            raise HTTPException(status_code=response.status_code, detail=f"OpenRouter API error: {error_data.get('error', {}).get('message', 'Unknown error')}")
        return response.json()
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="OpenRouter API timeout")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")

def call_ai_api(messages: List[dict], model: str = "openai/gpt-4o-mini", temperature: float = 0.7, max_tokens: int = 4000) -> dict:
    config = get_ai_config()
    
    is_gemini = config.get("is_gemini_enabled")
    gemini_key = config.get("gemini_api_key")
    if is_gemini and gemini_key:
        print("🤖 Route -> Gemini API")
        gemini_model = "gemini-1.5-pro" if "pro" in model else "gemini-1.5-flash"
        return call_gemini_api(messages, gemini_key, model=gemini_model, temperature=temperature, max_tokens=max_tokens)
        
    is_openai = config.get("is_openai_enabled")
    openai_key = config.get("openai_api_key")
    openai_endpoint = config.get("openai_endpoint", "https://api.openai.com/v1")
    if is_openai and openai_key:
        print("🤖 Route -> OpenAI API")
        openai_model = "gpt-4o" if "4o" in model and "mini" not in model else "gpt-4o-mini"
        return call_openai_api(messages, openai_key, endpoint=openai_endpoint, model=openai_model, temperature=temperature, max_tokens=max_tokens)
        
    is_or = config.get("is_openrouter_enabled")
    or_key = config.get("openrouter_api_key")
    if is_or and or_key:
        print("🤖 Route -> OpenRouter API")
        return call_openrouter_api_internal(messages, or_key, model=model, temperature=temperature, max_tokens=max_tokens)
        
    print("🤖 Route -> Default OpenRouter Env")
    if OPENROUTER_API_KEY:
        return call_openrouter_api_internal(messages, OPENROUTER_API_KEY, model=model, temperature=temperature, max_tokens=max_tokens)
    else:
        raise HTTPException(status_code=500, detail="Cannot route AI request: No provider chosen and no API keys configured.")"""

if old_helper in content:
    content = content.replace(old_helper, new_helper)
    print("Helper replacement done.")
else:
    print("Warning: old_helper not found!")

# Now replace 'call_openrouter_api(' with 'call_ai_api('
content = content.replace("call_openrouter_api(", "call_ai_api(")

# Restore original newlines just in case
content = content.replace("\n", "\r\n")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Modification complete.")
