

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

if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY not found in environment variables")

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

def call_openrouter_api(messages: List[dict], model: str = "openai/gpt-4o-mini", temperature: float = 0.7, max_tokens: int = 4000) -> dict:
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
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")

def extract_json_from_response(content: str) -> dict:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()
        
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse AI response as JSON: {str(e)}")

# ==================== ENDPOINTS ====================

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
        
        result = call_openrouter_api(
            messages=messages, 
            model="openai/gpt-4o-mini", 
            temperature=0.3,  # Low temperature for consistency
            max_tokens=2000
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

⚠️⚠️⚠️ YÊU CẦU BẮT BUỘC (MANDATORY):
{job.mandatory_requirements or 'KHÔNG CÓ yêu cầu bắt buộc'}
⚠️⚠️⚠️

💰 QUYỀN LỢI:
{job.benefits or 'Không có thông tin'}

"""
        
        # ==================== SYSTEM PROMPT (FIXED VERSION) ====================
        system_prompt = """Bạn là chuyên gia HR và AI Matching với 15 năm kinh nghiệm tuyển dụng IT.

Nhiệm vụ: Phân tích CV và chấm điểm độ phù hợp với TỪNG job trong danh sách.

═══════════════════════════════════════════════════════════════
📋 QUY TRÌNH CHẤM ĐIỂM CHUẨN (CHO MỖI JOB)
═══════════════════════════════════════════════════════════════

🔴 BƯỚC 1: KIỂM TRA YÊU CẦU BẮT BUỘC MANDATORY (STRICT MATCHING - KHÔNG SUY LUẬN)

Nếu job có "YÊU CẦU BẮT BUỘC/"MANDATORY REQUIREMENTS"" (mandatory_requirements):

1️ Đọc KỸ từng yêu cầu bắt buộc VÀ PHÂN TÍCH từ khóa bắt buộc:
   VD: "Tốt nghiệp Cử Nhân Đại Học"
   → Keywords cần tìm: ["cử nhân", "đại học"]
   
   VD: "3+ năm kinh nghiệm Python"
   → Keywords cần tìm: ["python", "3 năm" hoặc "3+"]

2️ TÌM BẰNG CHỨNG trong CV (THEO THỨ TỰ ƯU TIÊN):
   
   🎯 Priority 1: Field "Bằng cấp" (education)
   - Đây là field QUAN TRỌNG NHẤT cho yêu cầu học vấn
   - VD: "Cử nhân Công nghệ Thông tin"
   - VD: "Kỹ sư Điện tử"
   
   🎯 Priority 2: Field "Trường" (university)
   - Chỉ chứa TÊN TRƯỜNG, thường KHÔNG chứa bằng cấp
   - VD: "Đại học Bách Khoa Hà Nội"
   - VD: "Học viện Công nghệ Bưu chính Viễn thông"
   
   🎯 Priority 3: Field "Kinh nghiệm" (experience)
   - Dùng cho yêu cầu về số năm kinh nghiệm và skills
   
   🎯 Priority 4: Full CV Text (backup - tìm trong đoạn HỌC VẤN/EDUCATION)
   - Dùng khi các field trên null hoặc thiếu thông tin

3️ QUY TẮC MATCHING:
   
   ✅ PASS mandatory nếu:
   - Tìm thấy TẤT CẢ keywords trong CV
   - Có BẰNG CHỨNG CỤ THỂ (text chính xác)
   
   ❌ FAIL mandatory nếu:
   - THIẾU BẤT KỲ keyword nào
   
   ⚠️ KHÔNG được suy luận:
     ❌ "Có Đại học" ≠ "Có Cử nhân"
     ❌ "Có trường top" ≠ "Có bằng"
     ❌ "Có 1 năm exp" ≠ "Có 3 năm exp"
     ❌ "Có Node.js" ≠ "Có Python"
     
KẾT LUẬN:
- NẾU ứng viên ĐÁP ỨNG → Tiếp tục chấm trên BASE 100
- NẾU ứng viên KHÔNG ĐÁP ỨNG → Áp dụng PENALTY -50 điểm NGAY

═══════════════════════════════════════════════════════════════

🔵 BƯỚC 2A: CHẤM ĐIỂM (NẾU PASS MANDATORY/đáp ứng trường bắt buộc hoặc KHÔNG CÓ MANDATORY)

Base: 100 điểm

Phân bổ điểm (Tổng = 100):
- Kinh nghiệm phù hợp: 0-30 điểm
- Kỹ năng kỹ thuật: 0-25 điểm
- Học vấn phù hợp: 0-15 điểm
- Level/Seniority match: 0-15 điểm
- Địa điểm phù hợp: 0-10 điểm
- Kỹ năng mềm: 0-5 điểm

TỔNG: X/100

Strengths: ["Điểm mạnh 1", "Điểm mạnh 2", "Điểm mạnh 3"]
Weaknesses: ["Điểm yếu 1", "Điểm yếu 2"], Các điểm yếu thông thường (KHÔNG liên quan mandatory)
Recommendation: "Đánh giá chi tiết 80-120 từ"

═══════════════════════════════════════════════════════════════

🔴 BƯỚC 2B: CHẤM ĐIỂM (NẾU FAIL MANDATORY / không đáp ứng trường bắt buộc)

🚨 ÁP DỤNG PENALTY ngay lập tức: -50 ĐIỂM
 Base điểm giảm: 100 → 50
 Điểm tối đa có thể: 50 (Base mới)

SAU ĐÓ Chấm trên BASE 50 (mỗi component giảm 50%):

- Kinh nghiệm phù hợp: 0-15 điểm (giảm 50%)
- Kỹ năng kỹ thuật: 0-12 điểm (giảm 50%)
- Học vấn: 0-8 điểm (giảm 50%)
- Level phù hợp: 0-8 điểm (giảm 50%)
- Địa điểm: 0-5 điểm (giảm 50%)
- Kỹ năng mềm: 0-2 điểm (giảm 50%)

TỔNG: Y/50 (tối đa 50)

⚠️ LƯU Ý QUAN TRỌNG:
- Điểm yếu: PHẢI có "Ứng viên không đáp ứng yêu cầu bắt buộc: [yêu cầu cụ thể]" + các điểm yếu khác"
- Recommendation: "Ứng viên có [điểm mạnh] nhưng KHÔNG ĐỦ ĐIỀU KIỆN do thiếu [requirement cụ thể]"

QUAN TRỌNG: Với JOB ⭐ PRIMARY (job ứng viên đã apply):
- Đánh giá CHI TIẾT HỖN hơn
- Đây là job ứng viên QUAN TÂM - phải đánh giá kỹ lưỡng


═══════════════════════════════════════════════════════════════
🎯 OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Trả về JSON với format:

{
  "overall_score": <điểm của best_match>,
  "best_match": {
    "job_id": "<job_id>",
    "job_title": "<job_title>",
    "match_score": <0-100 hoặc 0-50 nếu fail mandatory>,
    "strengths": ["...", "...", "..."],
    "weaknesses": ["...", "..."],
    "recommendation": "..."
  },
  "all_matches": [
    {
      "job_id": "<job_id>",
      "job_title": "<job_title>",
      "match_score": <0-100 hoặc 0-50>,
      "strengths": ["...", "...", "..."],
      "weaknesses": ["...", "..."],
      "recommendation": "..."
    },
    ...
  ]
}

⚠️ CRITICAL RULES:
1. Nếu FAIL mandatory → match_score PHẢI ≤ 50
2. Weaknesses của job fail mandatory PHẢI có: "❌ Không đáp ứng yêu cầu bắt buộc: [requirement]"
3. KHÔNG được suy luận: "Có Đại học" ≠ "Có Cử nhân"
4. Phải tìm CHÍNH XÁC từ khóa trong CV
5. all_matches phải được sắp xếp theo match_score giảm dần
6. best_match = job có match_score CAO NHẤT
7. overall_score = best_match.match_score

QUAN TRỌNG: 
- Job có ⭐ PRIMARY → Đánh giá CHI TIẾT và KỸ LƯỠNG hơn
- Luôn trả về JSON hợp lệ, không thêm text giải thích bên ngoài"""

        # ==================== USER PROMPT ====================
        user_prompt = f"""Phân tích CV và matching với các công việc theo QUY TRÌNH CHÍNH XÁC:

{cv_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÁC CÔNG VIỆC CẦN MATCHING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{jobs_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hãy phân tích và chấm điểm cho TẤT CẢ {len(request.jobs)} jobs trên theo đúng quy trình:

1. Với MỖI JOB: Kiểm tra mandatory TRƯỚC
2. Nếu PASS hoặc không có mandatory → Base 100
3. Nếu FAIL mandatory → Penalty -50 → Base 50
4. Chấm điểm trên base tương ứng
5. Sắp xếp all_matches theo điểm giảm dần
6. best_match = job có điểm cao nhất

LƯU Ý:
- ĐỌC KỸ: Bằng cấp, Trường, Kinh nghiệm, Full text
- KHÔNG SUY LUẬN: "Có Đại học" ≠ "Có Cử nhân"
- STRICT MATCH: Phải tìm thấy CHÍNH XÁC từ khóa
- Nếu mandatory là một kỹ năng bắt buộc phải có thì phải tìm được script trùng khớp trong CV
- Nếu mandatory là số năm kinh nghiệm thì phải tìm được số năm đúng hoặc lớn hơn trong CV hoặc công các năm dựa theo các công việc đã làm trong mục kinh nghiệm
- Fail mandatory → PHẢI có "❌ Không đáp ứng..." trong weaknesses
- Job PRIMARY → Đánh giá kỹ hơn

CHO MỖI CÔNG VIỆC, ÁP DỤNG QUY TRÌNH:

VÍ DỤ MINH HỌA:

Ví dụ 1: Job yêu cầu "Tốt nghiệp Đại học" + Ứng viên có "university: HUST"
→ Bắt buộc: ĐÁP ỨNG ✅
→ Base điểm: 100
→ Tính: 28 (exp) + 23 (skills) + 15 (edu) + 12 (level) + 8 (loc) + 3 (soft) = 89
→ Kết quả: 89/100
→ Điểm yếu: ["Thiếu kinh nghiệm quản lý nhóm"]

Ví dụ 2: Job yêu cầu "Tốt nghiệp Đại học" + Ứng viên university: null, education: null
→ Bắt buộc: KHÔNG ĐÁP ỨNG ❌
→ Penalty: -50 NGAY LẬP TỨC
→ Base điểm mới: 50 tối đa
→ Tính trên base 50: 12 (exp) + 10 (skills) + 0 (edu) + 6 (level) + 4 (loc) + 2 (soft) = 34
→ Kết quả: 34/50
→ Điểm yếu: ["Ứng viên không đáp ứng yêu cầu bắt buộc: Tốt nghiệp Đại học", "Thiếu kinh nghiệm cloud"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ĐẶC BIỆT CHÚ Ý VỀ BEST_MATCH:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. best_match PHẢI là job có match_score CAO NHẤT trong all_matches
2. overall_score PHẢI = best_match.match_score
3. all_matches PHẢI được sắp xếp theo match_score giảm dần

4. Khi viết recommendation cho best_match:
   - NẾU best_match.job_id == primary_job_id (job ứng viên đã apply):
     → Viết: "Ứng viên đã apply đúng vị trí phù hợp với hồ sơ. [Điểm mạnh chính]..."
   
   - NẾU best_match.job_id != primary_job_id:
     → Viết: "Ứng viên phù hợp hơn với vị trí [best_match_title] so với vị trí đã apply [primary_job_title]. Lý do: [so sánh cụ thể]..."

5. Đảm bảo recommendation dài 100-150 từ, chi tiết và có bằng chứng cụ thể

Trả về ONLY valid JSON theo format đã cho."""

        # ==================== BUILD MESSAGES ====================
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # ==================== CALL OPENROUTER API ====================
        print(f"🤖 Calling OpenRouter AI (gpt-4o-mini, temp=0.2)...")
        
        result = call_openrouter_api(
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
        
        result = call_openrouter_api(messages=messages, model="openai/gpt-4o-mini", temperature=0.7, max_tokens=2000)
        
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
        
        result = call_openrouter_api(
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

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))  # Đọc PORT từ Railway
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
    