

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import io
import json
import requests
import PyPDF2
from docx import Document

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

app = FastAPI(
    title="CV Management API",
    description="API for parsing CVs and matching with jobs using OpenRouter AI",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== MODELS ====================

class CVData(BaseModel):
    full_name: str
    email: str
    phone_number: Optional[str] = None
    address: Optional[str] = None
    university: Optional[str] = None
    education: Optional[str] = None
    experience: Optional[str] = None

class JobData(BaseModel):
    id: str
    title: str
    department: Optional[str] = None
    level: Optional[str] = None
    job_type: Optional[str] = None
    work_location: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    benefits: Optional[str] = None
    mandatory_requirements: Optional[str] = None

class MatchCVJobsRequest(BaseModel):
    cv_text: str
    cv_data: CVData
    jobs: List[JobData]
    primary_job_id: Optional[str] = None

class GenerateJobDescriptionRequest(BaseModel):
    title: str
    level: str
    department: str
    work_location: Optional[str] = None
    job_type: Optional[str] = None
    language: str = "vietnamese"
    keywords: Optional[str] = None

class GenerateInterviewQuestionsRequest(BaseModel):
    job_id: str
    job_title: str
    department: str
    level: str
    job_type: Optional[str] = None
    work_location: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    mandatory_requirements: Optional[str] = None
    language: str = "vietnamese"

# ==================== HELPERS ====================

def get_ai_config() -> dict:
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

def get_scoring_rubrics(job_ids: List[str]) -> dict:
    """Fetch scoring rubrics for given job IDs"""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return {}
    
    try:
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
        }
        # Fetch rubrics for all job_ids
        job_ids_str = ','.join(f'"{jid}"' for jid in job_ids)
        query = f"job_id=in.({job_ids_str})"
        res = requests.get(f"{SUPABASE_URL}/rest/v1/cv_job_scoring_rubrics?select=*&{query}", headers=headers, timeout=10)
        
        if res.status_code == 200:
            rubrics = res.json()
            # Convert to dict with job_id as key
            rubric_map = {}
            for rubric in rubrics:
                rubric_map[rubric['job_id']] = rubric
            return rubric_map
    except Exception as e:
        print(f"Error fetching scoring rubrics: {e}")
    return {}


def get_rubric_level_definitions() -> dict:
    """Fetch rubric level categories and their metadata."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return {}

    try:
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
        }
        res = requests.get(f"{SUPABASE_URL}/rest/v1/cv_job_categories?select=*&type=eq.rubric_level", headers=headers, timeout=10)
        if res.status_code == 200:
            levels = res.json()
            return {level['value']: level for level in levels}
    except Exception as e:
        print(f"Error fetching rubric level definitions: {e}")
    return {}


def format_rubric_level_label(level: str, definitions: dict) -> str:
    item = definitions.get(level)
    if item:
        return item.get('label', level)
    fallback = {'required': 'BẮT BUỘC', 'important': 'QUAN TRỌNG', 'nice_to_have': 'CỘNG ĐIỂM'}
    return fallback.get(level, level)


def format_rubric_level_details(level: str, definitions: dict) -> str:
    item = definitions.get(level)
    if not item:
        fallback = {'required': 'Yêu cầu bắt buộc cho tiêu chí này.', 'important': 'Tiêu chí quan trọng cần ưu tiên.', 'nice_to_have': 'Tiêu chí điểm cộng.'}
        return fallback.get(level, '')

    metadata = item.get('metadata') or {}
    details = []
    if metadata.get('description'):
        details.append(f"Mô tả trạng thái: {metadata['description']}")
    if metadata.get('priority') is not None:
        details.append(f"Ưu tiên: {metadata['priority']}")
    if metadata.get('default_weight') is not None:
        details.append(f"Trọng số mặc định: {metadata['default_weight']}")
    return ' '.join(details)


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

import base64

def call_gemini_api(messages: List[dict], api_key: str, model: str = "gemini-3-flash-preview", temperature: float = 0.7, max_tokens: int = 8192, file_content: bytes = None, mime_type: str = None) -> dict:
    contents = []
    
    # Prepend system_text to the first user message
    system_text = ""
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content")
        
        if role == "system":
            system_text += content + "\n\n"
        else:
            gemini_role = "user" if role == "user" else "model"
            
            # Prepend system_text to the first user message
            if gemini_role == "user" and system_text:
                content = system_text + content
                system_text = ""
                
            parts = [{"text": content}]
            
            # Đính kèm file gốc dạng inlineData (Dùng chuẩn Google Document AI)
            if gemini_role == "user" and file_content and mime_type:
                b64_data = base64.b64encode(file_content).decode("utf-8")
                parts.append({
                    "inlineData": {
                        "mimeType": mime_type,
                        "data": b64_data
                    }
                })
                # Chỉ đính kèm 1 lần vào user message đầu tiên
                file_content = None
                
            contents.append({"role": gemini_role, "parts": parts})
            
    # Fallback if no user message was found but we had system text
    if system_text and not contents:
        contents.append({"role": "user", "parts": [{"text": system_text}]})
            
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
            # ❌ KHÔNG dùng responseMimeType: "application/json"
            # → Gemini áp dụng strict JSON schema và cắt output tại ~531 chars!
            # → Thay vào đó: yêu cầu JSON trong prompt, parse thủ công
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    }
        
    # ✅ v1beta + gemini-2.5-flash (stable, không bị truncation)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    try:
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=120)
        if response.status_code != 200:
            error_msg = response.text
            print(f"❌ Gemini API Failed [{response.status_code}]: {error_msg}")
            try:
                error_data = response.json()
                error_msg = error_data.get('error', {}).get('message', error_msg)
            except:
                pass
            raise HTTPException(status_code=response.status_code, detail=f"Gemini API error: {error_msg}")
        
        data = response.json()
        # DEV: Log raw structure for debugging API response format
        print("🔍 RAW GEMINI API RESPONSE:")
        print(data)
        
        text = ""
        if "candidates" in data and len(data["candidates"]) > 0:
            parts = data["candidates"][0].get("content", {}).get("parts", [])
            if parts and len(parts) > 0:
                text = parts[0].get("text", "")
            else:
                print("⚠️ No parts found in content!")
                print(data["candidates"][0])
        else:
            print("⚠️ No candidates found in response!")
                
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

def call_ai_api(messages: List[dict], model: str = "openai/gpt-4o-mini", temperature: float = 0.7, max_tokens: int = 4000, file_content: bytes = None, mime_type: str = None) -> dict:
    config = get_ai_config()
    
    is_gemini = config.get("is_gemini_enabled")
    gemini_key = config.get("gemini_api_key")
    if is_gemini and gemini_key:
        print("🤖 Route -> Gemini 2.5 Flash (v1beta, stable)")
        gemini_model = "gemini-2.5-flash"  # ✅ stable, không bị giới hạn bởi preview quirks
        return call_gemini_api(messages, gemini_key, model=gemini_model, temperature=temperature, max_tokens=max_tokens, file_content=file_content, mime_type=mime_type)
        
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
        raise HTTPException(status_code=500, detail="Cannot route AI request: No provider chosen and no API keys configured.")

import re


def find_json_object(text: str) -> str | None:
    start = text.find('{')
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False
    for idx, ch in enumerate(text[start:], start):
        if escape:
            escape = False
            continue
        if ch == '\\':
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[start:idx + 1]
    return None


def sanitize_json_strings(content: str) -> str:
    in_string = False
    escape = False
    sanitized_chars = []
    for ch in content:
        if escape:
            sanitized_chars.append(ch)
            escape = False
            continue
        if ch == '\\':
            sanitized_chars.append(ch)
            escape = True
            continue
        if ch == '"':
            sanitized_chars.append(ch)
            in_string = not in_string
            continue
        if in_string and ch in '\r\n':
            sanitized_chars.append('\\n')
            continue
        sanitized_chars.append(ch)
    return ''.join(sanitized_chars)


def extract_json_from_response(content: str) -> dict:
    if not content or not content.strip():
        raise HTTPException(status_code=500, detail="AI response is completely empty. Please check API limits or try again.")

    def try_parse(text: str) -> dict | None:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None

    # 1) Try direct parse first
    parsed = try_parse(content)
    if parsed is not None:
        return parsed

    # 2) Try to extract JSON block from markdown fences or whole response
    if '```json' in content:
        extracted = content.split('```json')[1].split('```')[0].strip()
    elif '```' in content:
        extracted = content.split('```')[1].split('```')[0].strip()
    else:
        extracted = content

    parsed = try_parse(extracted)
    if parsed is not None:
        return parsed

    # 3) Try to pull the first balanced JSON object from response text
    balanced = find_json_object(content)
    if balanced:
        parsed = try_parse(balanced)
        if parsed is not None:
            return parsed

        sanitized = sanitize_json_strings(balanced)
        parsed = try_parse(sanitized)
        if parsed is not None:
            return parsed

    # 4) As a last resort, try to sanitize the original extracted content
    sanitized = sanitize_json_strings(extracted)
    parsed = try_parse(sanitized)
    if parsed is not None:
        return parsed

    # 5) Report the parsing failure with a concise snippet
    error_msg = f"Unable to decode AI JSON response."
    print(f"❌ Failed JSON snippet: {content[:1000]}")
    snippet = content[:300].replace('\n', ' ')
    raise HTTPException(status_code=500, detail=f"Lỗi cú pháp. Chuỗi: {snippet}...")

# ==================== ENDPOINTS ====================

class TestOpenAIRequest(BaseModel):
    apiKey: str
    endpoint: Optional[str] = None

class TestOpenRouterRequest(BaseModel):
    apiKey: str

@app.post("/api/test-openai")
async def test_openai(req: TestOpenAIRequest):
    try:
        endpoint = req.endpoint if req.endpoint else "https://api.openai.com/v1"
        url = f"{endpoint}/models"
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {req.apiKey}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        if response.status_code == 200:
            return {"success": True}
        else:
            return {"success": False, "error": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/test-openrouter")
async def test_openrouter(req: TestOpenRouterRequest):
    try:
        url = "https://openrouter.ai/api/v1/models"
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {req.apiKey}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        if response.status_code == 200:
            return {"success": True}
        else:
            return {"success": False, "error": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}



@app.get("/api/test-models")
async def test_models():
    config = get_ai_config()
    gemini_key = config.get("gemini_api_key")
    if not gemini_key: return {"error": "no key"}
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={gemini_key}"
    res = requests.get(url)
    return res.json()

@app.get("/")
async def root():
    return {"message": "CV Management API", "version": "1.0.0", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "openrouter_configured": bool(OPENROUTER_API_KEY)}

@app.post("/api/parse-cv")
async def parse_cv(file: UploadFile = File(None), cv_file: UploadFile = File(None)):
    """
    ✅ ENHANCED VERSION - Comprehensive CV parsing with improved extraction
    
    Improvements:
    - Experience: Extracted from summary, projects, achievements, not just "Experience" section
    - Skills: Aggregated from all mentions throughout CV, deduplicated
    - Education: Includes degrees, certifications, qualifications from all sections
    """
    try:
        upload_file = file if file else cv_file
        
        if not upload_file:
            raise HTTPException(status_code=422, detail="No file provided")
        
        print(f"\n📄 ===== CV PARSING START (ENHANCED) =====")
        print(f"📁 File: {upload_file.filename}")
        
        if not upload_file.filename.endswith(('.pdf', '.doc', '.docx')):
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        file_content = await upload_file.read()
        if not file_content:
            raise HTTPException(status_code=400, detail="File is empty")
        
        print(f"📦 File size: {len(file_content)/1024:.2f} KB")
        
        cv_text = ""
        
        if upload_file.filename.endswith('.pdf'):
            print("📖 Parsing PDF...")
            pdf_file = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            for page_num, page in enumerate(pdf_reader.pages):
                text = page.extract_text()
                if text:
                    cv_text += text + "\n"
                    print(f"  ✓ Page {page_num + 1}: {len(text)} chars")
        
        elif upload_file.filename.endswith(('.doc', '.docx')):
            print("📖 Parsing DOCX...")
            doc_file = io.BytesIO(file_content)
            doc = Document(doc_file)
            cv_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        
        if not cv_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from CV")
        
        print(f"✅ Extracted {len(cv_text)} characters")
        
        ai_input_text = cv_text[:4000] if len(cv_text) > 4000 else cv_text
        
        print(f"🤖 Calling OpenRouter AI with ENHANCED prompt...")
        
        # ✅ ENHANCED PROMPT - Comprehensive extraction from entire CV
        messages = [
            {
                "role": "system", 
                "content": """You are an expert CV parser with deep understanding of resume formats and recruitment practices.

CORE PRINCIPLES:
1. Extract information from ENTIRE CV, not just labeled sections
2. Look for implicit mentions and context clues
3. Aggregate information from multiple sources
4. Deduplicate and organize information logically
5. Return ONLY valid JSON with no markdown formatting"""
            },
            {
                "role": "user", 
                "content": f"""Parse this CV comprehensively and extract ALL relevant information from every section:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CV CONTENT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{ai_input_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPREHENSIVE EXTRACTION GUIDELINES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. FULL NAME:
   - Usually at the very top (first 3-5 lines)
   - Format: 2-5 capitalized words
   - Exclude: email, phone, addresses, titles
   - Example: "JOHN MICHAEL DOE" or "Nguyễn Văn An"

2. CONTACT INFORMATION:
   📧 EMAIL: xxx@domain.com format
   📱 PHONE: Various formats (+84, 0, international codes)
   📍 ADDRESS: Full or partial address, city, country

3. EDUCATION & QUALIFICATIONS - ⚠️ COMPREHENSIVE EXTRACTION:
   
   ✅ Extract from ALL these sources:
   
   A. Traditional "Education" section:
      - University/College name and location
      - Degree (Bachelor's, Master's, PhD, Associate, Diploma)
      - Major/Field of study
      - GPA if mentioned
      - Graduation year or attendance period
      - Academic achievements, honors
   
   B. Certifications & Licenses (often separate section or mixed with education):
      - Professional certifications (AWS Certified, PMP, Google Analytics, etc.)
      - Industry certifications (CompTIA, Cisco, Microsoft, etc.)
      - Language certifications (IELTS, TOEFL, HSK, JLPT)
      - Training certificates
      - Online course completions (Coursera, Udemy certificates if mentioned)
      - Professional licenses (CPA, PE, Medical licenses)
   
   C. Scattered qualifications throughout CV:
      - In Summary/Profile: "MBA graduate", "Certified Developer"
      - In Experience: "Completed X certification while working"
      - In Skills: "AWS Certified Solutions Architect"
      - Footer or header notes about credentials
   
   D. Academic background indicators:
      - Coursework mentions
      - Research projects
      - Thesis or dissertation titles
      - Academic publications
   
   COMBINE ALL into comprehensive "education" field:
   - Start with formal degrees (most recent first)
   - Then add certifications and licenses
   - Include completion dates when available
   - Mention GPA, honors, relevant coursework
   - Format naturally as a paragraph or organized list
   
   Example output:
   "Bachelor of Science in Computer Science, Stanford University (2018-2022), GPA: 3.8/4.0, Magna Cum Laude. 
   AWS Certified Solutions Architect Professional (2023). 
   Google Cloud Professional Data Engineer (2023). 
   IELTS Academic: 7.5 (2022). 
   Completed Advanced Machine Learning Specialization, Coursera (2023)."

4. UNIVERSITY (Specific institution name):
   - Extract the primary university/college name
   - Example: "Stanford University" or "Đại học Bách Khoa Hà Nội"
   - If multiple institutions, use the most recent or highest degree institution

5. EXPERIENCE - ⚠️ COMPREHENSIVE EXTRACTION:
   
   ✅ Extract from ALL these sources:
   
   A. Traditional "Experience" / "Work History" section:
      - Job titles, company names, dates
      - Responsibilities and achievements
      - Technologies and tools used
      - Team size, leadership roles
      - Measurable results (increased by X%, reduced by Y)
   
   B. Summary/Objective/Profile (top of CV):
      - Years of experience mentioned: "5+ years in software development"
      - Industry expertise: "specialized in fintech applications"
      - Leadership experience: "led cross-functional teams"
      - Key achievements highlighted
   
   C. Projects section:
      - Personal projects with technologies used
      - Academic projects demonstrating skills
      - Freelance work
      - Open-source contributions
   
   D. Achievements/Awards section:
      - Professional accomplishments
      - Recognition and awards that indicate experience level
   
   E. Volunteer work and internships:
      - Relevant volunteer experience
      - Internship experiences
   
   COMBINE ALL mentions into ONE comprehensive experience narrative:
   - Preserve chronological sense where possible
   - Include summary statements about total years of experience
   - Mention specific companies, roles, and durations
   - Highlight key technologies, achievements, and responsibilities
   - Keep quantifiable results (percentages, numbers, metrics)
   
   Example output:
   "Experienced software engineer with 6+ years building scalable web applications. 
   Senior Full-Stack Developer at TechCorp Inc. (2021-2024): Led team of 5 developers, 
   architected microservices handling 1M+ daily requests, reduced API latency by 40%. 
   Software Developer at StartupXYZ (2018-2021): Developed e-commerce platform using 
   MERN stack serving 50K+ users, implemented CI/CD pipeline reducing deployment time by 60%. 
   Personal Projects: Built open-source React component library with 2K+ GitHub stars, 
   developed mobile app using React Native with 10K+ downloads."

6. SKILLS - ⚠️ COMPREHENSIVE EXTRACTION & AGGREGATION:
   
   ✅ Extract from ALL these sources:
   
   A. Traditional "Skills" / "Technical Skills" section
   B. Experience descriptions (technologies mentioned in job descriptions)
   C. Projects section (frameworks and tools used)
   D. Education section (programming languages taught, tools learned)
   E. Summary/Profile (self-described expertise)
   F. Certifications (implies proficiency in certified technology)
   G. Tools/Technologies subsections
   
   What to capture:
   - Programming languages: JavaScript, Python, Java, C++, etc.
   - Frameworks & libraries: React, Vue, Django, Spring Boot, etc.
   - Databases: MySQL, PostgreSQL, MongoDB, Redis, etc.
   - Cloud platforms: AWS, Azure, GCP, Heroku, etc.
   - DevOps tools: Docker, Kubernetes, Jenkins, CI/CD, etc.
   - Design tools: Figma, Photoshop, Sketch, etc.
   - Soft skills IF clearly stated: Leadership, Communication, Agile, etc.
   - Domain expertise: Machine Learning, Data Science, DevOps, etc.
   - Methodologies: Agile, Scrum, TDD, Microservices, etc.
   
   CRITICAL: 
   - Aggregate ALL skill mentions from entire CV
   - DEDUPLICATE (remove duplicates)
   - Normalize similar terms: "nodejs" = "Node.js", "reactjs" = "React"
   - Return as ARRAY of distinct skill strings
   - Preserve proper capitalization: "JavaScript" not "javascript"
   
   Example output:
   ["JavaScript", "TypeScript", "React", "Node.js", "Python", "Django", 
   "PostgreSQL", "MongoDB", "AWS", "Docker", "Kubernetes", "Git", "CI/CD", 
   "Agile", "Microservices", "REST API", "GraphQL", "Machine Learning", 
   "TensorFlow", "Leadership", "Team Management"]

7. SUMMARY/PROFILE:
   - Usually at top of CV
   - Section headers: "Summary", "Objective", "Profile", "About Me", "Professional Summary"
   - Brief overview of career (typically 50-200 words)
   - Career goals, highlights, key strengths
   - If no explicit summary section exists, leave as null

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETURN THIS EXACT JSON STRUCTURE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{
  "full_name": "string or null",
  "email": "string or null",
  "phone_number": "string or null",
  "address": "string or null",
  "university": "string or null",
  "education": "COMPREHENSIVE education including degrees, certifications, licenses, courses - combined from all sections",
  "experience": "COMPREHENSIVE experience from ALL sources - summary mentions + work history + projects + achievements",
  "skills": ["skill1", "skill2", "skill3", ...] or [],
  "summary": "string or null"
}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL REMINDERS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ EDUCATION: Include degrees + certifications + licenses + training from ENTIRE CV
✅ EXPERIENCE: Scan ENTIRE CV including summary, projects, achievements
✅ SKILLS: Aggregate from ALL sections, deduplicate, normalize
✅ Preserve original language (Vietnamese or English as written)
✅ Return valid JSON only, no markdown, no extra text, no explanations
✅ If field not found after thorough search, use null or []
✅ Be thorough - scan every section, every paragraph for relevant information"""
            }
        ]
        
        # Determine File Types for direct Document AI features if supported
        mime_type = "application/pdf" if upload_file.filename.lower().endswith('.pdf') else None
        pdf_bytes = file_content if mime_type else None
        
        result = call_ai_api(
            messages=messages, 
            model="openai/gpt-4o-mini", 
            temperature=0.3,  # Low temperature for consistency
            max_tokens=2000,
            file_content=pdf_bytes,
            mime_type=mime_type
        )
        
        print(f"✅ OpenRouter responded")
        
        content = result['choices'][0]['message']['content']
        parsed_data = extract_json_from_response(content)
        parsed_data['fullText'] = cv_text
        
        # ✅ Log extraction statistics
        print(f"📊 Extraction Statistics:")
        print(f"  ├─ Name: {parsed_data.get('full_name', 'N/A')}")
        print(f"  ├─ Email: {parsed_data.get('email', 'N/A')}")
        print(f"  ├─ Skills extracted: {len(parsed_data.get('skills', []))} skills")
        print(f"  ├─ Experience length: {len(str(parsed_data.get('experience', '')))} chars")
        print(f"  ├─ Education length: {len(str(parsed_data.get('education', '')))} chars")
        print(f"  └─ University: {parsed_data.get('university', 'N/A')}")
        
        if parsed_data.get('skills'):
            print(f"  └─ Skills preview: {', '.join(parsed_data.get('skills', [])[:10])}...")
        
        print(f"===== CV PARSING END (ENHANCED) =====\n")
        
        return {
            "success": True,
            "data": parsed_data,
            "message": "CV parsed successfully with enhanced comprehensive extraction",
            "metadata": {
                "model": "gpt-4o-mini",
                "filename": upload_file.filename,
                "enhanced_prompt": True,
                "version": "2.0-comprehensive"
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error parsing CV: {str(e)}")

@app.post("/api/match-cv-jobs")
async def match_cv_jobs(request: MatchCVJobsRequest):
    """
    ✅ OPTIMIZED VERSION: Match CV with multiple job positions using AI analysis
    🔧 Fixed: Mandatory requirements strict matching logic
    """
    try:
        print(f"\n🎯 ===== CV-JOB MATCHING START =====")
        print(f"👤 CV: {request.cv_data.full_name}")
        print(f"📋 Jobs to match: {len(request.jobs)}")
        if request.primary_job_id:
            print(f"⭐ Primary job: {request.primary_job_id}")
        
        # ==================== FETCH SCORING RUBRICS ====================
        job_ids = [job.id for job in request.jobs]
        rubrics_map = get_scoring_rubrics(job_ids)
        print(f"📊 Rubrics loaded: {len(rubrics_map)}/{len(job_ids)} jobs have custom rubrics")

        rubric_level_defs = get_rubric_level_definitions()
        if rubric_level_defs:
            print(f"📌 Rubric level definitions loaded: {len(rubric_level_defs)}")
        else:
            print("📌 No rubric level definitions found")

        rubric_level_text = ""
        if rubric_level_defs:
            rubric_level_text = "\nĐỊNH NGHĨA TRẠNG THÁI/THUỘC TÍNH ĐÁNH GIÁ (rubric_level):\n"
            for value, item in rubric_level_defs.items():
                meta = item.get('metadata') or {}
                desc = meta.get('description', 'Không có mô tả')
                priority = meta.get('priority')
                default_weight = meta.get('default_weight')
                level_label = item.get('label', value)
                rubric_level_text += f"- {level_label} ({value}): {desc}"
                if priority is not None:
                    rubric_level_text += f" | Ưu tiên: {priority}"
                if default_weight is not None:
                    rubric_level_text += f" | Trọng số mặc định: {default_weight}"
                rubric_level_text += "\n"

        # ==================== BUILD CV CONTEXT ====================
        cv_context = f"""
📋 ỨNG VIÊN PROFILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 THÔNG TIN CƠ BẢN:
Họ tên: {request.cv_data.full_name}
Email: {request.cv_data.email}
Số điện thoại: {request.cv_data.phone_number or 'Không có'}
Địa chỉ: {request.cv_data.address or 'Không có'}

🎓 HỌC VẤN:
Trường: {request.cv_data.university or 'Không có thông tin'}
Bằng cấp: {request.cv_data.education or 'Không có thông tin'}

💼 KINH NGHIỆM:
{request.cv_data.experience or 'Không có thông tin'}

📄 CV FULL TEXT (3500 ký tự đầu - dùng để tìm bằng chứng bổ sung):
{request.cv_text[:3500]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
        
        # ==================== BUILD JOBS CONTEXT ====================
        jobs_text = ""
        for idx, job in enumerate(request.jobs, 1):
            is_primary = "⭐ PRIMARY (Ứng viên đã apply)" if job.id == request.primary_job_id else ""
            
            # Get rubric for this job
            rubric = rubrics_map.get(job.id)
            rubric_text = ""
            if rubric:
                rubric_text = f"""

📊 BẢNG ĐIỂM CHẤM ĐÁNH GIÁ (SCORING RUBRIC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Điểm đạt yêu cầu tối thiểu: {rubric.get('passing_score', 70)}/100
Ghi chú: {rubric.get('notes', 'Không có ghi chú')}

Tiêu chí chấm điểm:
"""
                for crit in rubric.get('criteria', []):
                    level_label = format_rubric_level_label(crit.get('level', 'important'), rubric_level_defs)
                    level_details = format_rubric_level_details(crit.get('level', 'important'), rubric_level_defs)
                    rubric_text += f"""
• {crit['name']} ({level_label}) - Trọng số: {crit['weight']}%
  Mô tả: {crit['description']}
  Trạng thái/thuộc tính đánh giá: {level_label}
{f'  {level_details}\n' if level_details else ''}  Hướng dẫn chấm điểm:
    - Xuất sắc: {crit['scoring_guide']['excellent']}
    - Tốt: {crit['scoring_guide']['good']}
    - Trung bình: {crit['scoring_guide']['average']}
    - Kém: {crit['scoring_guide']['poor']}
"""
            else:
                # Use default rubric criteria
                rubric_text = f"""

📊 BẢNG ĐIỂM CHẤM ĐÁNH GIÁ (SCORING RUBRIC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Điểm đạt yêu cầu tối thiểu: 70/100
Ghi chú: Sử dụng tiêu chí mặc định cho vị trí {job.title}

Tiêu chí chấm điểm:
"""
                default_criteria = [
                    {
                        "name": "Kỹ năng kỹ thuật",
                        "level": "required",
                        "weight": 35,
                        "description": "Đánh giá các kỹ năng chuyên môn, công nghệ, công cụ liên quan đến vị trí",
                        "scoring_guide": {
                            "excellent": "Có đầy đủ hoặc vượt yêu cầu kỹ thuật, có dự án thực tế minh chứng",
                            "good": "Đáp ứng đa số yêu cầu kỹ thuật, có một số kinh nghiệm thực tế",
                            "average": "Đáp ứng một phần yêu cầu, cần đào tạo thêm",
                            "poor": "Thiếu nhiều kỹ năng cần thiết"
                        }
                    },
                    {
                        "name": "Kinh nghiệm làm việc",
                        "level": "required", 
                        "weight": 25,
                        "description": "Số năm kinh nghiệm, độ phù hợp ngành nghề, sự tiến bộ trong sự nghiệp",
                        "scoring_guide": {
                            "excellent": "Kinh nghiệm phong phú, vượt yêu cầu, đúng lĩnh vực",
                            "good": "Đủ kinh nghiệm, phần lớn liên quan đến vị trí",
                            "average": "Kinh nghiệm ít hơn yêu cầu hoặc khác ngành",
                            "poor": "Thiếu kinh nghiệm đáng kể"
                        }
                    },
                    {
                        "name": "Học vấn & Bằng cấp",
                        "level": "important",
                        "weight": 20,
                        "description": "Trình độ học vấn, chuyên ngành, trường đại học, các chứng chỉ liên quan",
                        "scoring_guide": {
                            "excellent": "Bằng cấp đúng chuyên ngành từ trường uy tín, có chứng chỉ nổi bật",
                            "good": "Bằng cấp phù hợp, chuyên ngành liên quan",
                            "average": "Bằng cấp không hoàn toàn phù hợp hoặc trường ít tên tuổi",
                            "poor": "Không đáp ứng yêu cầu học vấn tối thiểu"
                        }
                    },
                    {
                        "name": "Kỹ năng mềm",
                        "level": "important",
                        "weight": 12,
                        "description": "Giao tiếp, làm việc nhóm, quản lý thời gian, tư duy giải quyết vấn đề",
                        "scoring_guide": {
                            "excellent": "CV thể hiện rõ kỹ năng lãnh đạo, teamwork, giao tiếp xuất sắc",
                            "good": "Có dẫn chứng về kỹ năng mềm tốt",
                            "average": "Ít thông tin về kỹ năng mềm",
                            "poor": "Không có thông tin hoặc dấu hiệu kỹ năng mềm kém"
                        }
                    },
                    {
                        "name": "Điểm cộng & Thành tích",
                        "level": "nice_to_have",
                        "weight": 8,
                        "description": "Giải thưởng, dự án nổi bật, đóng góp cộng đồng, chứng chỉ thêm",
                        "scoring_guide": {
                            "excellent": "Có nhiều thành tích nổi bật, giải thưởng hoặc đóng góp đáng kể",
                            "good": "Có một vài điểm cộng đáng chú ý",
                            "average": "Ít điểm cộng",
                            "poor": "Không có điểm cộng"
                        }
                    }
                ]
                
                for crit in default_criteria:
                    level_label = format_rubric_level_label(crit.get('level', 'important'), rubric_level_defs)
                    level_details = format_rubric_level_details(crit.get('level', 'important'), rubric_level_defs)
                    rubric_text += f"""
• {crit['name']} ({level_label}) - Trọng số: {crit['weight']}%
  Mô tả: {crit['description']}
  Trạng thái/thuộc tính đánh giá: {level_label}
{f'  {level_details}\n' if level_details else ''}  Hướng dẫn chấm điểm:
    - Xuất sắc: {crit['scoring_guide']['excellent']}
    - Tốt: {crit['scoring_guide']['good']}
    - Trung bình: {crit['scoring_guide']['average']}
    - Kém: {crit['scoring_guide']['poor']}
"""
            
            jobs_text += f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JOB #{idx}: {job.title} {is_primary}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 THÔNG TIN CƠ BẢN:
ID: {job.id}
Tên vị trí: {job.title}
Cấp bậc: {job.level or 'Không xác định'}
Phòng ban: {job.department or 'Không xác định'}
Loại hình: {job.job_type or 'Không xác định'}
Hình thức: {job.work_location or 'Không xác định'}
Địa điểm: {job.location or 'Không xác định'}

📝 MÔ TẢ CÔNG VIỆC:
{job.description or 'Không có mô tả'}

✅ YÊU CẦU:
{job.requirements or 'Không có yêu cầu cụ thể'}

💰 QUYỀN LỢI:
{job.benefits or 'Không có thông tin'}

{rubric_text}
"""
        
        # ==================== SYSTEM PROMPT (RUBRIC-BASED VERSION) ====================
        system_prompt = """Bạn là chuyên gia HR và AI Matching với 15 năm kinh nghiệm tuyển dụng IT.

Nhiệm vụ: Phân tích CV và chấm điểm độ phù hợp với TỪNG job trong danh sách dựa trên BẢNG TIÊU CHÍ CHẤM ĐIỂM (SCORING RUBRIC).

═══════════════════════════════════════════════════════════════
📋 QUY TRÌNH CHẤM ĐIỂM CHUẨN (CHO MỖI JOB)
═══════════════════════════════════════════════════════════════

🔵 BƯỚC 1: SỬ DỤNG BẢNG TIÊU CHÍ CHẤM ĐIỂM (SCORING RUBRIC)

MỖI JOB có bảng tiêu chí riêng với:
- Các tiêu chí chấm điểm (criteria)
- Trọng số (weight) cho từng tiêu chí
- Mô tả và hướng dẫn chấm điểm chi tiết
- Trạng thái/thuộc tính đánh giá (rubric_level) của tiêu chí và metadata liên quan nếu có
- Điểm đạt yêu cầu tối thiểu (passing_score)

QUY TRÌNH CHẤM ĐIỂM:
1. Đọc KỸ bảng tiêu chí của từng job
2. Chấm điểm TỪNG TIÊU CHÍ theo hướng dẫn trong rubric
3. Tính contribution = (điểm tiêu chí * trọng số) / 100
4. TỔNG ĐIỂM = Tổng contribution của tất cả tiêu chí

═══════════════════════════════════════════════════════════════

🔵 BƯỚC 2: PHÂN TÍCH CHI TIẾT

CHO MỖI JOB:
- Tìm bằng chứng trong CV cho từng tiêu chí
- Chấm điểm dựa trên hướng dẫn "excellent/good/average/poor"
- Tính toán điểm số chính xác
- Xác định điểm mạnh, điểm yếu
- Đưa ra gợi ý và khuyến nghị

═══════════════════════════════════════════════════════════════

🔵 BƯỚC 3: XÁC ĐỊNH BEST MATCH & GỠI Ý

- best_match = job có match_score CAO NHẤT
- overall_score = best_match.match_score
- all_matches sắp xếp theo điểm giảm dần

GỠI Ý CÔNG VIỆC PHÙ HỢP HƠN:
- Nếu best_match == primary_job (job đã apply): Khuyến khích tiếp tục
- Nếu best_match != primary_job: Gợi ý chuyển sang vị trí phù hợp hơn với lý do cụ thể

═══════════════════════════════════════════════════════════════
🎯 OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Trả về JSON với format:

{
  "overall_score": <điểm của best_match>,
  "best_match": {
    "job_id": "<job_id>",
    "job_title": "<job_title>",
    "match_score": <0-100>,
    "detailed_scores": {
      "<criterion_name>": {
        "score": <điểm số 0-100>,
        "weight": <trọng số>,
        "contribution": <điểm đóng góp>,
        "reasoning": "<giải thích ngắn gọn>"
      },
      ...
    },
    "strengths": ["Điểm mạnh 1", "Điểm mạnh 2", "Điểm mạnh 3"],
    "weaknesses": ["Điểm yếu 1", "Điểm yếu 2"],
    "recommendation": "Đánh giá chi tiết 100-150 từ về độ phù hợp và gợi ý công việc khác nếu phù hợp hơn"
  },
  "all_matches": [
    {
      "job_id": "<job_id>",
      "job_title": "<job_title>",
      "match_score": <0-100>,
      "detailed_scores": {
        "<criterion_name>": {
          "score": <điểm số 0-100>,
          "weight": <trọng số>,
          "contribution": <điểm đóng góp>,
          "reasoning": "<giải thích ngắn gọn>"
        },
        ...
      },
      "strengths": ["Điểm mạnh 1", "Điểm mạnh 2", "Điểm mạnh 3"],
      "weaknesses": ["Điểm yếu 1", "Điểm yếu 2"],
      "recommendation": "Đánh giá chi tiết 100-150 từ về độ phù hợp và gợi ý công việc khác nếu phù hợp hơn"
    },
    ...
  ]
}

⚠️ CRITICAL RULES:
1. match_score = tổng contribution của tất cả tiêu chí trong rubric
2. detailed_scores PHẢI có cho MỖI tiêu chí trong rubric của job
3. strengths/weaknesses dựa trên phân tích rubric
4. recommendation PHẢI bao gồm gợi ý công việc phù hợp hơn nếu best_match != primary_job
5. all_matches sắp xếp theo match_score giảm dần
6. best_match = job có match_score cao nhất
7. overall_score = best_match.match_score

QUAN TRỌNG: 
- Job có ⭐ PRIMARY → Đánh giá CHI TIẾT và KỸ LƯỠNG hơn
- Luôn trả về JSON hợp lệ, không thêm text giải thích bên ngoài"""

        # ==================== USER PROMPT ====================
        user_prompt = f"""Phân tích CV và matching với các công việc theo QUY TRÌNH RUBRIC-BASED:

{cv_context}

{rubric_level_text}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÁC CÔNG VIỆC CẦN MATCHING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{jobs_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hãy phân tích và chấm điểm cho TẤT CẢ {len(request.jobs)} jobs trên theo đúng quy trình RUBRIC-BASED:

1. Với MỖI JOB: Đọc KỸ bảng tiêu chí chấm điểm (SCORING RUBRIC)
2. Chấm điểm TỪNG TIÊU CHÍ theo hướng dẫn trong rubric
3. Tính contribution = (score * weight) / 100 cho mỗi tiêu chí
4. TỔNG match_score = tổng contribution của tất cả tiêu chí
5. Xác định strengths, weaknesses dựa trên phân tích rubric
6. Viết recommendation chi tiết với gợi ý công việc phù hợp hơn nếu cần

CHI TIẾT VỀ CHẤM ĐIỂM THEO RUBRIC:

Ví dụ với job CÓ RUBRIC tùy chỉnh:
- Tiêu chí "Kỹ năng kỹ thuật" (35%): Đánh giá dựa trên hướng dẫn excellent/good/average/poor
  → Score 85/100 → contribution = 85 * 35 / 100 = 29.75
- Tiêu chí "Kinh nghiệm" (25%): Đánh giá dựa trên kinh nghiệm thực tế
  → Score 70/100 → contribution = 70 * 25 / 100 = 17.5
- Tiêu chí "Học vấn" (20%): Đánh giá bằng cấp và chuyên ngành
  → Score 90/100 → contribution = 90 * 20 / 100 = 18
- TỔNG: 29.75 + 17.5 + 18 = 65.25/100

LƯU Ý QUAN TRỌNG:
- ĐỌC KỸ mô tả và hướng dẫn chấm điểm của từng tiêu chí trong rubric
- Tìm bằng chứng CỤ THỂ trong CV cho từng tiêu chí
- Tính toán contribution chính xác
- Job PRIMARY (⭐) → Đánh giá chi tiết và kỹ lưỡng hơn

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ĐẶC BIỆT CHÚ Ý VỀ RECOMMENDATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Recommendation PHẢI dài 100-150 từ
2. Bao gồm phân tích chi tiết về độ phù hợp
3. Nếu best_match != primary_job: Gợi ý chuyển sang vị trí phù hợp hơn với lý do cụ thể
4. Nếu best_match == primary_job: Khuyến khích tiếp tục với vị trí đã apply

Trả về ONLY valid JSON theo format đã cho."""

        # ==================== BUILD MESSAGES ====================
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # ==================== CALL OPENROUTER API ====================
        print(f"🤖 Calling OpenRouter AI (gpt-4o-mini, temp=0.2)...")
        
        result = call_ai_api(
            messages=messages,
            model="openai/gpt-4o-mini",
            temperature=0.2,  # ✅ Giảm xuống 0.2 cho consistent hơn
            max_tokens=4000
        )
        
        print(f"✅ OpenRouter responded")
        
        # ==================== EXTRACT & VALIDATE RESPONSE ====================
        content = result['choices'][0]['message']['content']
        print(f"📄 Raw AI response length: {len(content)} chars")
        
        analysis_data = extract_json_from_response(content)
        
        # Validate response structure
        if not isinstance(analysis_data, dict):
            raise ValueError("AI response is not a valid dictionary")
        
        # ✅ Ensure best_match exists
        if not analysis_data.get('best_match'):
            print(f"⚠️  Missing best_match, creating fallback")
            analysis_data['best_match'] = {
                "job_id": request.jobs[0].id,
                "job_title": request.jobs[0].title,
                "match_score": 0,
                "strengths": ["Không thể phân tích - vui lòng thử lại"],
                "weaknesses": ["Lỗi hệ thống"],
                "recommendation": "Vui lòng thử lại sau."
            }
        
        # ✅ Ensure all_matches exists
        if not analysis_data.get('all_matches'):
            print(f"⚠️  Missing all_matches, creating from best_match")
            analysis_data['all_matches'] = [analysis_data['best_match']]
        
        # ✅ Sort all_matches by score descending
        analysis_data['all_matches'] = sorted(
            analysis_data['all_matches'],
            key=lambda x: x.get('match_score', 0),
            reverse=True
        )
        
        # ✅ Set best_match as highest score
        if analysis_data['all_matches']:
            analysis_data['best_match'] = analysis_data['all_matches'][0]
        
        # ✅ Set overall_score
        if 'overall_score' not in analysis_data:
            analysis_data['overall_score'] = analysis_data['best_match'].get('match_score', 0)
        
        # ==================== LOG RESULTS ====================
        print(f"✅ Overall score: {analysis_data.get('overall_score', 'N/A')}")
        print(f"🏆 Best match: {analysis_data['best_match'].get('job_title', 'N/A')} ({analysis_data['best_match'].get('match_score', 0)})")
        print(f"📊 All matches: {len(analysis_data.get('all_matches', []))}")
        
        # ✅ Log scores for all jobs
        for idx, match in enumerate(analysis_data['all_matches'], 1):
            score = match.get('match_score', 0)
            has_fail = any('❌' in w for w in match.get('weaknesses', []))
            print(f"  {idx}. {match.get('job_title', 'N/A')}: {score} {'(FAIL MANDATORY)' if has_fail and score <= 50 else ''}")
        
        print(f"===== CV-JOB MATCHING END =====\n")
        
        # ==================== RETURN RESPONSE ====================
        return {
            "success": True,
            "data": analysis_data,
            "message": "CV-Job matching completed",
            "metadata": {
                "model": "gpt-4o-mini",
                "temperature": 0.2,
                "jobs_analyzed": len(request.jobs),
                "primary_job_id": request.primary_job_id
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in match_cv_jobs: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error matching CV with jobs: {str(e)}"
        )

@app.post("/api/generate-job-description")
async def generate_job_description(request: GenerateJobDescriptionRequest):
    """
    Generate job description using AI
    """
    try:
        print(f"\n📝 ===== GENERATING JOB DESCRIPTION =====")
        print(f"💼 Title: {request.title}")
        
        job_context = f"""Job Position: {request.title}
Department: {request.department}
Level: {request.level}
Job Type: {request.job_type or 'Full-time'}
Location: {request.work_location or 'Remote'}"""
        
        if request.keywords:
            job_context += f"\nRequired Skills: {request.keywords}"
        
        lang_instruction = "Write the job description in Vietnamese language." if request.language == "vietnamese" else "Write the job description in English language."
        
        messages = [
            {"role": "system", "content": f"You are a professional HR specialist. {lang_instruction} Return ONLY valid JSON."},
            {"role": "user", "content": f"""Create a detailed job description:

{job_context}

Return JSON:
{{
  "description": "Detailed job description (150-250 words)",
  "requirements": "• Requirement 1\\n• Requirement 2\\n...",
  "benefits": "• Benefit 1\\n• Benefit 2\\n..."
}}"""}
        ]
        
        result = call_ai_api(messages=messages, model="openai/gpt-4o-mini", temperature=0.7, max_tokens=2000)
        
        content = result['choices'][0]['message']['content']
        job_data = extract_json_from_response(content)
        
        if not all(key in job_data for key in ['description', 'requirements', 'benefits']):
            raise HTTPException(status_code=500, detail="Invalid AI response structure")
        
        print(f"✅ Generated job description successfully")
        print(f"===== JOB DESCRIPTION GENERATION END =====\n")
        
        return {
            "success": True,
            "data": job_data,
            "message": "Job description generated successfully",
            "metadata": {"model": "gpt-4o-mini", "language": request.language}
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating job description: {str(e)}")

@app.post("/api/generate-interview-questions")
async def generate_interview_questions(request: GenerateInterviewQuestionsRequest):
    """
    ✅ NEW ENDPOINT - Generate interview questions based on job description using AI
    
    This endpoint analyzes the job requirements and generates comprehensive interview questions
    categorized by:
    - Technical Knowledge
    - Soft Skills
    - Situational Questions
    - Career Goals & Motivation
    
    Returns markdown-formatted questions ready for use in interviews.
    """
    try:
        print(f"\n💬 ===== GENERATING INTERVIEW QUESTIONS =====")
        print(f"📋 Job: {request.job_title} ({request.job_id})")
        print(f"🏢 Department: {request.department}")
        print(f"📊 Level: {request.level}")
        
        # Build comprehensive job context
        job_context = f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JOB INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Position: {request.job_title}
Department: {request.department}
Level: {request.level}
Job Type: {request.job_type or 'Full-time'}
Work Location: {request.work_location or 'Not specified'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JOB DESCRIPTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{request.description or 'Not specified'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{request.requirements or 'Not specified'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY REQUIREMENTS (MUST VERIFY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{request.mandatory_requirements or 'None'}
"""
        
        # Determine language instruction
        if request.language == "vietnamese":
            lang_instruction = "Write ALL interview questions in Vietnamese language with professional tone."
            category_names = {
                "technical": "## 📚 Phần 1: Kiến thức chuyên môn (Technical Knowledge)",
                "soft": "## 🤝 Phần 2: Kỹ năng mềm (Soft Skills)",
                "situational": "## 💡 Phần 3: Tình huống thực tế (Situational Questions)",
                "motivation": "## 🎯 Phần 4: Định hướng & Động lực (Career Goals & Motivation)"
            }
        else:
            lang_instruction = "Write ALL interview questions in English language with professional tone."
            category_names = {
                "technical": "## 📚 Part 1: Technical Knowledge",
                "soft": "## 🤝 Part 2: Soft Skills",
                "situational": "## 💡 Part 3: Situational Questions",
                "motivation": "## 🎯 Part 4: Career Goals & Motivation"
            }
        
        messages = [
            {
                "role": "system", 
                "content": f"""You are an expert HR interviewer and recruitment specialist with deep knowledge of:
- Technical competency assessment
- Behavioral interviewing techniques
- STAR method questioning
- Cultural fit evaluation
- Industry-specific requirements

Your goal is to create comprehensive, insightful interview questions that help recruiters:
1. Assess candidate's technical skills and knowledge
2. Evaluate problem-solving abilities and critical thinking
3. Understand work style and cultural fit
4. Gauge motivation and career alignment

{lang_instruction}

IMPORTANT GUIDELINES:
- Questions should be open-ended to encourage detailed responses
- Include follow-up question suggestions in parentheses where relevant
- Adjust technical depth based on the job level (Junior/Mid/Senior/Lead)
- Make questions specific to the job title and department
- Include scenario-based questions relevant to actual job responsibilities
- If mandatory requirements exist, create questions to verify them"""
            },
            {
                "role": "user", 
                "content": f"""Based on the following job information, create a comprehensive set of 12-15 interview questions:

{job_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRUCTURE YOUR RESPONSE WITH THESE SECTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Câu hỏi phỏng vấn cho vị trí: {request.job_title}

{category_names["technical"]}
- Create 4-5 questions specific to:
  * Required technical skills and technologies
  * Relevant experience in similar roles  
  * Hands-on problem-solving scenarios
  * Best practices and methodologies
  * Tools and frameworks mentioned in requirements

Example format:
1. [Technical question specific to the role]?
   - Follow-up: [Deeper probing question]

{category_names["soft"]}
- Create 3-4 questions about:
  * Teamwork and collaboration style
  * Communication in challenging situations
  * Adaptability and learning approach
  * Conflict resolution
  * Time management under pressure

{category_names["situational"]}
- Create 3-4 scenario-based questions:
  * Real-world challenges specific to this role
  * Decision-making under constraints
  * Handling unexpected changes or failures
  * Prioritization with competing demands
  * Cross-functional collaboration scenarios

{category_names["motivation"]}
- Create 2-3 questions about:
  * Why this specific role and company
  * Career goals and alignment with position
  * Professional development plans
  * Long-term aspirations
  * What success looks like to them

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL REQUIREMENTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Make questions SPECIFIC to "{request.job_title}" in "{request.department}"
✅ Adjust difficulty for "{request.level}" level
✅ Include verification questions for mandatory requirements if they exist
✅ Use markdown formatting (##, -, numbers) for clear structure
✅ Return ONLY the formatted markdown text
✅ NO JSON wrapper, NO code blocks, NO explanations
✅ Start directly with the heading "# Câu hỏi phỏng vấn..."

Begin your response now:"""
            }
        ]
        
        print(f"🤖 Calling OpenRouter AI for interview questions...")
        
        result = call_ai_api(
            messages=messages, 
            model="openai/gpt-4o-mini", 
            temperature=0.7,  # Balanced creativity for diverse questions
            max_tokens=2500   # Enough for comprehensive questions
        )
        
        print(f"✅ OpenRouter responded successfully")
        
        content = result['choices'][0]['message']['content'].strip()
        
        # Clean up any potential markdown code blocks
        if content.startswith('```markdown'):
            content = content.replace('```markdown', '', 1)
        if content.startswith('```'):
            content = content.replace('```', '', 1)
        if content.endswith('```'):
            content = content.rsplit('```', 1)[0]
        
        content = content.strip()
        
        # Count questions (approximate by counting question marks)
        question_count = content.count('?')
        
        print(f"📊 Generated {len(content)} characters")
        print(f"❓ Approximate question count: {question_count}")
        print(f"===== INTERVIEW QUESTIONS GENERATION END =====\n")
        
        return {
            "success": True,
            "data": {
                "questions": content,
                "job_id": request.job_id,
                "job_title": request.job_title,
                "department": request.department,
                "level": request.level
            },
            "message": "Interview questions generated successfully",
            "metadata": {
                "model": "gpt-4o-mini", 
                "language": request.language,
                "question_count": question_count,
                "character_count": len(content)
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error generating interview questions: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Error generating interview questions: {str(e)}"
        )

from pydantic import EmailStr
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class SendEmailRequest(BaseModel):
    subject: str
    body_html: str
    body_text: Optional[str] = None
    to: List[str]
    cc: Optional[List[str]] = None
    app_password: str
    sender_email: str
    sender_name: Optional[str] = "Recruit AI"

@app.post("/api/send-email")
async def send_email(req: SendEmailRequest):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = req.subject
        msg["From"] = f"{req.sender_name} <{req.sender_email}>"
        msg["To"] = ", ".join(req.to)
        if req.cc:
            msg["Cc"] = ", ".join(req.cc)
            
        if req.body_text:
            msg.attach(MIMEText(req.body_text, "plain"))
        else:
            msg.attach(MIMEText("Please view this email in an HTML-compatible client.", "plain"))
            
        msg.attach(MIMEText(req.body_html, "html"))
        
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(req.sender_email, req.app_password)
        
        recipients = req.to.copy()
        if req.cc:
            recipients.extend(req.cc)
            
        server.sendmail(req.sender_email, recipients, msg.as_string())
        server.quit()
        
        return {"success": True, "message": "Email sent successfully"}
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending email: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))  # Đọc PORT từ Railway
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
    