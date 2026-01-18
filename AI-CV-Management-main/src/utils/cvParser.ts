// src/utils/cvParser.ts - OPTIMIZED VERSION
// Kết hợp tính năng tốt nhất từ cvParser.ts, cvParserService.ts, advancedCVParser.ts

import mammoth from 'mammoth';

// ==================== TYPES & INTERFACES ====================

export interface ParsedCV {
  fullText: string;
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  university?: string;
  education?: string;
  experience?: string;
  skills?: string[];
  certifications?: string[];
  languages?: string[];
  summary?: string;
  // ✅ NEW: Thêm từ advancedCVParser
  parseQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  extractedFields?: string[];
  warnings?: string[];
}

// ✅ NEW: Response interface từ backend
interface BackendCVResponse {
  success: boolean;
  data: {
    full_name?: string;
    email?: string;
    phone_number?: string;
    address?: string;
    university?: string;
    education?: string;
    experience?: string;
    skills?: string[];
    summary?: string;
    fullText?: string;
  };
  metadata?: {
    tokens_count?: number;
    confidence?: number;
    model?: string;
    filename?: string;
  };
  message?: string;
}

// ==================== CONFIGURATION ====================

const CONFIG = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  AI_TIMEOUT: 30000, // 30 seconds
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  SUPPORTED_FORMATS: ['.pdf', '.docx', '.txt'],
  RETRY_ATTEMPTS: 2, // ✅ NEW: Retry logic
  CACHE_DURATION: 5 * 60 * 1000, // ✅ NEW: 5 minutes cache
};

// ✅ NEW: Simple cache để tránh parse lại cùng file
const parseCache = new Map<string, { result: ParsedCV; timestamp: number }>();

// ==================== UTILITY FUNCTIONS ====================

// ✅ NEW: Generate file hash for caching
function generateFileHash(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

// ✅ NEW: Check cache
function getCachedResult(file: File): ParsedCV | null {
  const hash = generateFileHash(file);
  const cached = parseCache.get(hash);
  
  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
    console.log('✅ Using cached parse result');
    return cached.result;
  }
  
  return null;
}

// ✅ NEW: Save to cache
function saveCacheResult(file: File, result: ParsedCV): void {
  const hash = generateFileHash(file);
  parseCache.set(hash, { result, timestamp: Date.now() });
  
  // Clean old cache entries
  if (parseCache.size > 50) {
    const entries = Array.from(parseCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    parseCache.delete(entries[0][0]);
  }
}

// ✅ NEW: Health check từ cvParserService
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${CONFIG.API_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      console.warn('⚠️ Backend health check failed:', response.status);
      return false;
    }
    
    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    console.warn('⚠️ Backend not available:', error);
    return false;
  }
}

// ==================== FILE PARSING FUNCTIONS ====================

async function parsePDF(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('❌ PDF parsing error:', error);
    throw new Error('Không thể đọc file PDF');
  }
}

async function parseDOCX(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('❌ DOCX parsing error:', error);
    throw new Error('Không thể đọc file DOCX');
  }
}

async function parseTXT(file: File): Promise<string> {
  try {
    return await file.text();
  } catch (error) {
    console.error('❌ TXT parsing error:', error);
    throw new Error('Không thể đọc file TXT');
  }
}

// ==================== AI BACKEND INTEGRATION ====================

// ✅ IMPROVED: Better error handling và retry logic
async function extractInfoWithAI(file: File, retryCount = 0): Promise<ParsedCV> {
  console.log('🤖 Đang gọi AI backend để parse CV...', 
    retryCount > 0 ? `(Retry ${retryCount}/${CONFIG.RETRY_ATTEMPTS})` : '');
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.AI_TIMEOUT);
    
    const response = await fetch(`${CONFIG.API_URL}/api/parse-cv`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    const result: BackendCVResponse = await response.json();
    
    if (!result.success) {
      throw new Error('Backend parsing failed');
    }
    
    // ✅ IMPROVED: Better mapping với validation
    const parsedCV: ParsedCV = {
      fullText: result.data.fullText || '',
      fullName: result.data.full_name || undefined,
      email: result.data.email || undefined,
      phone: result.data.phone_number || undefined,
      address: result.data.address || undefined,
      skills: Array.isArray(result.data.skills) ? result.data.skills : [],
      experience: result.data.experience || undefined,
      education: result.data.education || undefined,
      university: result.data.university || undefined,
      summary: result.data.summary || undefined,
    };
    
    // ✅ NEW: Calculate quality từ advancedCVParser
    const extractedFields: string[] = [];
    if (parsedCV.fullName) extractedFields.push('fullName');
    if (parsedCV.email) extractedFields.push('email');
    if (parsedCV.phone) extractedFields.push('phone');
    if (parsedCV.address) extractedFields.push('address');
    if (parsedCV.university) extractedFields.push('university');
    if (parsedCV.education) extractedFields.push('education');
    if (parsedCV.experience) extractedFields.push('experience');
    if (parsedCV.skills && parsedCV.skills.length > 0) extractedFields.push('skills');
    if (parsedCV.summary) extractedFields.push('summary');
    
    parsedCV.extractedFields = extractedFields;
    parsedCV.parseQuality = calculateParseQuality(extractedFields.length);
    
    console.log(`✅ AI parsing thành công (${extractedFields.length} fields, quality: ${parsedCV.parseQuality})`);
    
    return parsedCV;
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ AI request timeout sau', CONFIG.AI_TIMEOUT / 1000, 'giây');
    } else {
      console.error('❌ Lỗi khi gọi AI backend:', error);
    }
    
    // ✅ NEW: Retry logic
    if (retryCount < CONFIG.RETRY_ATTEMPTS) {
      console.log(`🔄 Đang thử lại... (${retryCount + 1}/${CONFIG.RETRY_ATTEMPTS})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
      return extractInfoWithAI(file, retryCount + 1);
    }
    
    throw error;
  }
}

// ✅ NEW: Calculate parse quality từ advancedCVParser
function calculateParseQuality(fieldsCount: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (fieldsCount >= 8) return 'excellent';
  if (fieldsCount >= 5) return 'good';
  if (fieldsCount >= 3) return 'fair';
  return 'poor';
}

// ==================== REGEX EXTRACTION FUNCTIONS ====================
// ✅ IMPROVED: Kết hợp logic tốt nhất từ cả 2 file

function extractFullName(text: string): string | undefined {
  console.log('🔍 Extracting full name...');
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Strategy 1: Tìm ở 15 dòng đầu tiên
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i].trim();
    
    // Skip keywords
    const skipKeywords = [
      'curriculum', 'vitae', 'resume', 'cv', 'profile', 'contact',
      'personal', 'information', 'objective', 'summary', 'education',
      'experience', 'skills', 'projects', 'achievements'
    ];
    
    const lowerLine = line.toLowerCase();
    if (skipKeywords.some(keyword => lowerLine.includes(keyword))) {
      continue;
    }
    
    // Skip lines with email, numbers, or special chars
    if (/@/.test(line) || /\d{3,}/.test(line) || /[#$%^&*()[\]{}]/.test(line)) {
      continue;
    }
    
    const words = line.split(/\s+/);
    
    // Check: 2-5 words, proper capitalization
    if (words.length >= 2 && words.length <= 5) {
      if (line.length < 5 || line.length > 60) continue;
      
      const isValidName = words.every(word => {
        // Allow lowercase conjunctions like "van", "de", "von"
        if (word.length <= 3 && /^[a-z]+$/.test(word)) return true;
        // Other words must be capitalized (Unicode support for Vietnamese)
        return /^[\p{Lu}][\p{Ll}\p{M}]*$/u.test(word);
      });
      
      if (isValidName) {
        console.log('✅ Found fullName:', line);
        return line;
      }
    }
  }
  
  // Strategy 2: Pattern "Name:" or "Họ tên:"
  const namePatterns = [
    /(?:name|họ\s*tên|full\s*name|tên)[\s:：]+([^\n]{5,60})/gi,
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      const extracted = match[0].split(/[:：]/)[1]?.trim();
      if (extracted && extracted.length > 5 && extracted.length < 60) {
        if (!/@/.test(extracted) && !/\d{3,}/.test(extracted)) {
          console.log('✅ Found fullName (Pattern):', extracted);
          return extracted;
        }
      }
    }
  }
  
  console.log('❌ Full name not found');
  return undefined;
}

function extractEmail(text: string): string | undefined {
  // ✅ IMPROVED: Better regex
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex);
  
  if (emails && emails.length > 0) {
    const email = emails[0].toLowerCase();
    console.log('✅ Found email:', email);
    return email;
  }
  
  console.log('❌ Email not found');
  return undefined;
}

function extractPhone(text: string): string | undefined {
  // ✅ IMPROVED: Better Vietnamese phone patterns
  const phonePatterns = [
    // Vietnamese formats: +84, 84, 0
    /(?:\+84|84|0)[\s.-]?([0-9]{2,3})[\s.-]?([0-9]{3})[\s.-]?([0-9]{3,4})/g,
    /\b0[0-9]{9,10}\b/g,
    /\b\+84[0-9]{9,10}\b/g,
    // International formats
    /\(?\+?[0-9]{1,3}\)?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}/g,
  ];
  
  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const phone = matches[0].replace(/[\s.-]/g, '');
      console.log('✅ Found phone:', phone);
      return phone;
    }
  }
  
  console.log('❌ Phone not found');
  return undefined;
}

function extractAddress(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Pattern 1: Lines with numbers and location keywords
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    if (/\d+/.test(line) && (
      lowerLine.includes('street') || lowerLine.includes('ward') || 
      lowerLine.includes('district') || lowerLine.includes('phường') || 
      lowerLine.includes('quận') || lowerLine.includes('đường') ||
      lowerLine.includes('city') || lowerLine.includes('thành phố')
    )) {
      if (!line.includes('@') && !line.includes('+84') && 
          line.length > 20 && line.length < 200) {
        console.log('✅ Found address:', line);
        return line;
      }
    }
  }
  
  // Pattern 2: "Địa chỉ:" or "Address:"
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();
    
    if (lowerLine.includes('địa chỉ:') || lowerLine.includes('address:')) {
      const parts = lines[i].split(/[:：]/);
      if (parts.length > 1 && parts[1].trim().length > 10) {
        console.log('✅ Found address:', parts[1].trim());
        return parts[1].trim();
      }
      
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.length > 15 && nextLine.length < 200 && !nextLine.includes('@')) {
          console.log('✅ Found address:', nextLine);
          return nextLine;
        }
      }
    }
  }
  
  console.log('❌ Address not found');
  return undefined;
}

function extractUniversity(text: string): string | undefined {
  const universityKeywords = [
    'university', 'đại học', 'học viện', 'college', 
    'trường', 'institute', 'academy', 'polytechnic'
  ];
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Method 1: Find in Education section
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();
    
    if (lowerLine === 'education' || lowerLine.startsWith('education') || 
        lowerLine === 'học vấn' || lowerLine.startsWith('học vấn')) {
      // Check next 4 lines
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j].trim();
        const nextLower = nextLine.toLowerCase();
        
        if (nextLine.length > 15) {
          for (const keyword of universityKeywords) {
            if (nextLower.includes(keyword)) {
              const cleaned = nextLine.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
              console.log('✅ Found university:', cleaned);
              return cleaned;
            }
          }
        }
      }
    }
  }
  
  // Method 2: Direct keyword search
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    for (const keyword of universityKeywords) {
      if (lowerLine.includes(keyword) && line.length > 15 && line.length < 200) {
        const cleaned = line.trim().replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
        console.log('✅ Found university:', cleaned);
        return cleaned;
      }
    }
  }
  
  console.log('❌ University not found');
  return undefined;
}

// ✅ IMPROVED: Kết hợp skill database từ cả 2 file
function extractSkills(text: string): string[] {
  const skillDatabase = [
    // Programming Languages
    'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'c', 
    'php', 'ruby', 'go', 'golang', 'rust', 'swift', 'kotlin', 'scala', 'dart', 'r',
    
    // Frontend Frameworks & Libraries
    'react', 'reactjs', 'vue', 'vuejs', 'angular', 'svelte', 'nextjs', 'next.js', 
    'nuxt', 'nuxtjs', 'gatsby', 'ember', 'backbone', 'jquery',
    
    // Styling
    'html', 'html5', 'css', 'css3', 'sass', 'scss', 'less', 'tailwind', 'tailwindcss',
    'bootstrap', 'material-ui', 'mui', 'chakra ui', 'ant design', 'styled components',
    
    // Backend Frameworks
    'nodejs', 'node.js', 'express', 'expressjs', 'nestjs', 'nest.js', 'fastify',
    'django', 'flask', 'fastapi', 'spring', 'spring boot', 
    'laravel', 'symfony', 'rails', 'ruby on rails', 'asp.net', '.net',
    
    // Databases
    'sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 
    'elasticsearch', 'cassandra', 'dynamodb', 'oracle', 'sqlite',
    'mariadb', 'firestore', 'couchdb', 'neo4j',
    
    // Cloud & DevOps
    'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'heroku', 
    'docker', 'kubernetes', 'k8s', 'jenkins', 'gitlab ci', 'github actions', 
    'circleci', 'travis ci', 'terraform', 'ansible', 'vagrant',
    'nginx', 'apache', 'cloudflare',
    
    // Tools & Others
    'git', 'github', 'gitlab', 'bitbucket', 'svn', 'mercurial',
    'jira', 'confluence', 'trello', 'asana', 'slack',
    'figma', 'sketch', 'photoshop', 'illustrator', 'xd', 'invision',
    
    // Mobile
    'react native', 'flutter', 'ionic', 'xamarin', 'android', 'ios',
    'swift ui', 'jetpack compose',
    
    // AI/ML
    'tensorflow', 'pytorch', 'keras', 'sklearn', 'scikit-learn',
    'pandas', 'numpy', 'opencv', 'nlp', 'machine learning', 'deep learning',
    'computer vision', 'data science',
    
    // API & Architecture
    'rest', 'restful', 'rest api', 'graphql', 'grpc', 'websocket',
    'microservices', 'api', 'soap', 'json', 'xml',
    
    // Methodologies
    'agile', 'scrum', 'kanban', 'waterfall', 'tdd', 'bdd', 'ci/cd',
    'devops', 'clean code', 'solid', 'design patterns',
    
    // State Management
    'redux', 'mobx', 'zustand', 'recoil', 'context api', 'pinia', 'vuex',
    
    // Build Tools
    'webpack', 'vite', 'rollup', 'parcel', 'babel', 'gulp', 'grunt', 'esbuild',
    
    // Testing
    'jest', 'mocha', 'chai', 'jasmine', 'cypress', 'selenium', 'playwright',
    'pytest', 'junit', 'testng', 'vitest',
    
    // Backend as a Service
    'firebase', 'supabase', 'amplify', 'parse', 'backendless',
    
    // ORM/ODM
    'prisma', 'typeorm', 'sequelize', 'mongoose', 'hibernate', 'entity framework',
    
    // Message Queues
    'rabbitmq', 'kafka', 'redis pub/sub', 'aws sqs', 'celery',
    
    // Monitoring & Logging
    'prometheus', 'grafana', 'elk', 'datadog', 'new relic', 'sentry',
  ];
  
  const textLower = text.toLowerCase();
  const foundSkills = new Set<string>();
  
  for (const skill of skillDatabase) {
    // ✅ IMPROVED: Better regex escaping
    const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i');
    
    if (regex.test(textLower)) {
      // Capitalize first letter for display
      const displaySkill = skill.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      foundSkills.add(displaySkill);
    }
  }
  
  const skills = Array.from(foundSkills);
  
  if (skills.length > 0) {
    console.log(`✅ Found ${skills.length} skills:`, skills.slice(0, 10).join(', '));
  } else {
    console.log('❌ Skills not found');
  }
  
  return skills;
}

// ✅ IMPROVED: Better section extraction từ advancedCVParser
function extractExperience(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const experienceKeywords = [
    'experience', 'work experience', 'employment', 'work history',
    'kinh nghiệm', 'kinh nghiệm làm việc', 'công việc',
    'projects', 'project', 'dự án'
  ];
  
  let experienceSection = '';
  let capturing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase().trim();
    
    // Start capturing
    if (!capturing && experienceKeywords.some(kw => 
      lowerLine === kw || lowerLine.startsWith(kw + ':') || lowerLine.startsWith(kw)
    )) {
      capturing = true;
      
      // If line is not just a header, include it
      const isJustHeader = experienceKeywords.some(kw => lowerLine === kw);
      if (!isJustHeader && line.length > 10) {
        experienceSection += line + '\n';
      }
      continue;
    }
    
    // Stop capturing
    if (capturing) {
      const stopKeywords = [
        'education', 'học vấn', 'skills', 'kỹ năng', 
        'certificate', 'chứng chỉ', 'interests', 'sở thích',
        'references', 'languages', 'hobbies'
      ];
      
      const isStopLine = stopKeywords.some(kw => 
        lowerLine === kw || (lowerLine.startsWith(kw) && line.length < 50)
      );
      
      if (isStopLine) {
        break;
      }
      
      experienceSection += line + '\n';
      
      // Stop if too long
      if (experienceSection.length > 1000) break;
    }
  }
  
  const result = experienceSection.trim();
  
  if (result.length > 30) {
    console.log('✅ Found experience:', result.substring(0, 100) + '...');
    return result.length > 800 ? result.substring(0, 800) : result;
  }
  
  console.log('❌ Experience not found');
  return undefined;
}

function extractEducation(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const educationKeywords = [
    'education', 'học vấn', 'academic', 'qualification', 
    'degree', 'major', 'bachelor', 'master', 'phd'
  ];
  
  let educationSection = '';
  let capturing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase().trim();
    
    // Start capturing
    if (!capturing && educationKeywords.some(kw => 
      lowerLine === kw || lowerLine.startsWith(kw + ':') || lowerLine.startsWith(kw)
    )) {
      capturing = true;
      
      const isJustHeader = educationKeywords.some(kw => lowerLine === kw);
      if (!isJustHeader && line.length > 10) {
        educationSection += line + '\n';
      }
      continue;
    }
    
    // Stop capturing
    if (capturing) {
      const stopKeywords = [
        'experience', 'kinh nghiệm', 'projects', 'dự án',
        'certificate', 'chứng chỉ', 'skills', 'kỹ năng',
        'interests', 'sở thích', 'references', 'hobbies'
      ];
      
      const isStopLine = stopKeywords.some(kw => 
        lowerLine === kw || (lowerLine.startsWith(kw) && line.length < 50)
      );
      
      if (isStopLine) {
        break;
      }
      
      educationSection += line + '\n';
      
      if (educationSection.length > 600) break;
    }
  }
  
  const result = educationSection.trim();
  
  if (result.length > 20) {
    console.log('✅ Found education:', result.substring(0, 100) + '...');
    return result.length > 500 ? result.substring(0, 500) : result;
  }
  
  console.log('❌ Education not found');
  return undefined;
}

function extractCertifications(text: string): string[] {
  const certKeywords = [
    'certification', 'certificate', 'chứng chỉ', 
    'certified', 'license', 'award', 'giấy chứng nhận'
  ];
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const certifications: string[] = [];
  let capturing = false;
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    if (!capturing && certKeywords.some(kw => lowerLine.includes(kw))) {
      capturing = true;
      
      if (!certKeywords.some(kw => lowerLine === kw) && line.length > 5) {
        certifications.push(line.replace(/^[-•*]\s*/, ''));
      }
      continue;
    }
    
    if (capturing) {
      const stopKeywords = ['experience', 'education', 'skills', 'projects', 'interests'];
      if (stopKeywords.some(kw => lowerLine.includes(kw)) && line.length < 50) {
        break;
      }
      
      if (line.length > 5 && line.length < 150) {
        certifications.push(line.replace(/^[-•*]\s*/, ''));
      }
      
      if (certifications.length >= 10) break;
    }
  }
  
  if (certifications.length > 0) {
    console.log(`✅ Found ${certifications.length} certifications`);
  } else {
    console.log('❌ Certifications not found');
  }
  
  return certifications;
}

function extractLanguages(text: string): string[] {
  const languageMap: Record<string, string> = {
    'english': 'English',
    'vietnamese': 'Vietnamese',
    'tiếng anh': 'English',
    'tiếng việt': 'Vietnamese',
    'chinese': 'Chinese',
    'japanese': 'Japanese',
    'korean': 'Korean',
    'french': 'French',
    'german': 'German',
    'spanish': 'Spanish',
    'mandarin': 'Mandarin',
    'cantonese': 'Cantonese',
    'thai': 'Thai',
    'indonesian': 'Indonesian',
    'russian': 'Russian',
  };
  
  const languages = new Set<string>();
  const textLower = text.toLowerCase();
  
  for (const [key, value] of Object.entries(languageMap)) {
    if (textLower.includes(key)) {
      languages.add(value);
    }
  }
  
  const result = Array.from(languages);
  
  if (result.length > 0) {
    console.log('✅ Found languages:', result.join(', '));
  } else {
    console.log('❌ Languages not found');
  }
  
  return result;
}

function extractSummary(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const summaryKeywords = [
    'summary', 'objective', 'profile', 'about', 'about me',
    'tóm tắt', 'mục tiêu', 'giới thiệu', 'về tôi'
  ];
  
  let summarySection = '';
  let capturing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase().trim();
    
    if (!capturing && summaryKeywords.some(kw => lowerLine === kw || lowerLine.startsWith(kw))) {
      capturing = true;
      
      if (!summaryKeywords.some(kw => lowerLine === kw) && line.length > 10) {
        summarySection += line + ' ';
      }
      continue;
    }
    
    if (capturing) {
      const stopKeywords = ['experience', 'education', 'skills', 'projects', 'kinh nghiệm', 'học vấn'];
      if (stopKeywords.some(kw => lowerLine === kw || lowerLine.startsWith(kw))) {
        break;
      }
      
      summarySection += line + ' ';
      if (summarySection.length > 600) break;
    }
  }
  
  const result = summarySection.trim().replace(/\s+/g, ' ');
  
  if (result.length > 20) {
    console.log('✅ Found summary:', result.substring(0, 100) + '...');
    return result.length > 600 ? result.substring(0, 600) : result;
  }
  
  console.log('❌ Summary not found');
  return undefined;
}

// ✅ IMPROVED: Complete regex parser
function extractInfoWithRegex(text: string): ParsedCV {
  console.log('\n🔍 ===== REGEX PARSING START =====');
  console.log('📄 Text length:', text.length, 'characters');
  
  const extractedFields: string[] = [];
  const warnings: string[] = [];
  
  const fullName = extractFullName(text);
  if (fullName) extractedFields.push('fullName'); else warnings.push('Không tìm thấy họ tên');
  
  const email = extractEmail(text);
  if (email) extractedFields.push('email'); else warnings.push('Không tìm thấy email');
  
  const phone = extractPhone(text);
  if (phone) extractedFields.push('phone'); else warnings.push('Không tìm thấy số điện thoại');
  
  const address = extractAddress(text);
  if (address) extractedFields.push('address');
  
  const university = extractUniversity(text);
  if (university) extractedFields.push('university');
  
  const education = extractEducation(text);
  if (education) extractedFields.push('education');
  
  const experience = extractExperience(text);
  if (experience) extractedFields.push('experience');
  
  const skills = extractSkills(text);
  if (skills.length > 0) extractedFields.push('skills'); else warnings.push('Không tìm thấy kỹ năng');
  
  const certifications = extractCertifications(text);
  if (certifications.length > 0) extractedFields.push('certifications');
  
  const languages = extractLanguages(text);
  if (languages.length > 0) extractedFields.push('languages');
  
  const summary = extractSummary(text);
  if (summary) extractedFields.push('summary');
  
  const parsed: ParsedCV = {
    fullText: text,
    fullName,
    email,
    phone,
    address,
    university,
    education,
    experience,
    skills,
    certifications,
    languages,
    summary,
    extractedFields,
    warnings: warnings.length > 0 ? warnings : undefined,
    parseQuality: calculateParseQuality(extractedFields.length),
  };
  
  console.log('\n📊 ===== REGEX PARSING RESULT =====');
  console.log(`Extracted ${extractedFields.length} fields:`, extractedFields.join(', '));
  console.log('Quality:', parsed.parseQuality);
  console.log('===== REGEX PARSING END =====\n');
  
  return parsed;
}

// ==================== MAIN PARSE FUNCTION ====================

export async function parseCV(file: File): Promise<ParsedCV> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  try {
    // ✅ NEW: Check cache first
    const cachedResult = getCachedResult(file);
    if (cachedResult) {
      return cachedResult;
    }
    
    // Validate file type
    const validExtensions = CONFIG.SUPPORTED_FORMATS;
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension && !fileType) {
      throw new Error('Định dạng file không được hỗ trợ');
    }
    
    console.log('\n🚀 ===== CV PARSING START =====');
    console.log('📄 File:', fileName);
    console.log('📋 Type:', fileType);
    console.log('💾 Size:', (file.size / 1024).toFixed(2), 'KB');
    
    // ✅ STEP 1: Try AI Backend First
    try {
      console.log('\n🤖 Step 1: Trying AI Backend...');
      
      const aiResult = await extractInfoWithAI(file);
      
      // Validate AI result - if missing too many critical fields, fallback to regex
      const criticalFields = ['fullName', 'email', 'phone'];
      const missingCritical = criticalFields.filter(field => !aiResult[field as keyof ParsedCV]);
      
      if (missingCritical.length <= 1 && aiResult.parseQuality !== 'poor') {
        // AI result is good
        console.log('✅ AI parsing successful with good quality');
        console.log('===== CV PARSING END (AI) =====\n');
        
        // ✅ NEW: Cache the result
        saveCacheResult(file, aiResult);
        
        return aiResult;
      } else {
        console.log(`⚠️ AI result quality: ${aiResult.parseQuality}, missing: ${missingCritical.join(', ')}`);
        console.log('🔄 Falling back to regex parsing for better extraction...');
      }
      
    } catch (aiError) {
      console.log('⚠️ AI Backend failed:', aiError instanceof Error ? aiError.message : 'Unknown error');
      console.log('🔄 Falling back to regex parsing...');
    }
    
    // ✅ STEP 2: Fallback to Regex Parsing
    console.log('\n📝 Step 2: Using Regex Parsing...');
    
    // Extract text from file
    let text = '';
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      console.log('📄 Parsing PDF...');
      text = await parsePDF(file);
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      console.log('📄 Parsing DOCX...');
      text = await parseDOCX(file);
    } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      console.log('📄 Parsing TXT...');
      text = await parseTXT(file);
    }
    
    console.log('✅ Text extracted:', text.length, 'characters');
    
    // Parse with regex
    const result = extractInfoWithRegex(text);
    
    console.log('===== CV PARSING END (REGEX) =====\n');
    
    // ✅ NEW: Cache the result
    saveCacheResult(file, result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Parse error:', error);
    throw error;
  }
}

// ==================== VALIDATION FUNCTIONS ====================

export function validateCVFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  const allowedExtensions = CONFIG.SUPPORTED_FORMATS;
  const fileName = file.name.toLowerCase();
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  if (!allowedTypes.includes(file.type) && !hasValidExtension) {
    return { valid: false, error: 'Chỉ chấp nhận file PDF, DOCX hoặc TXT' };
  }
  
  if (file.size > CONFIG.MAX_FILE_SIZE) {
    return { valid: false, error: `File không được vượt quá ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB` };
  }
  
  if (file.size === 0) {
    return { valid: false, error: 'File rỗng' };
  }
  
  return { valid: true };
}

// ✅ NEW: Batch parsing từ cvParserService (nếu backend support)
export async function batchParseCV(files: File[]): Promise<Array<{
  filename: string;
  success: boolean;
  data?: ParsedCV;
  error?: string;
}>> {
  console.log(`\n🚀 ===== BATCH PARSING ${files.length} FILES =====`);
  
  const results = await Promise.allSettled(
    files.map(async (file) => {
      try {
        const data = await parseCV(file);
        return {
          filename: file.name,
          success: true,
          data,
        };
      } catch (error) {
        return {
          filename: file.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );
  
  return results.map(result => 
    result.status === 'fulfilled' ? result.value : {
      filename: 'unknown',
      success: false,
      error: 'Promise rejected'
    }
  );
}

// ✅ NEW: Clear cache utility
export function clearParseCache(): void {
  parseCache.clear();
  console.log('✅ Parse cache cleared');
}

// ✅ NEW: Get cache stats
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: parseCache.size,
    entries: Array.from(parseCache.keys()),
  };
}