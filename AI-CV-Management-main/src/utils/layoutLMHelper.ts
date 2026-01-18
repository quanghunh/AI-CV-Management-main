import { pipeline } from '@xenova/transformers';

// Cache the model instance
let modelInstance: any = null;

export interface LayoutLMResult {
  label: string;
  score: number;
  box: number[];
  text: string;
}

export interface ProcessedDocument {
  fields: {
    [key: string]: {
      value: string;
      confidence: number;
      bbox: number[];
    };
  };
  rawResults: LayoutLMResult[];
}

/**
 * Initialize LayoutLM v3 model
 * Note: First load will download the model (~500MB), subsequent loads use cache
 */
export async function initLayoutLMModel() {
  if (modelInstance) return modelInstance;

  try {
    console.log('Loading LayoutLM v3 model...');
    
    // Use document-question-answering pipeline for LayoutLM
    modelInstance = await pipeline(
      'document-question-answering',
      'Xenova/layoutlmv3-base-finetuned-funsd'
    );
    
    console.log('LayoutLM v3 model loaded successfully');
    return modelInstance;
  } catch (error) {
    console.error('Error loading LayoutLM model:', error);
    throw new Error('Failed to load LayoutLM model');
  }
}

/**
 * Extract information from CV image using LayoutLM
 */
export async function extractCVInformation(
  imageFile: File,
  questions: string[] = [
    'What is the candidate name?',
    'What is the email?',
    'What is the phone number?',
    'What are the skills?',
    'What is the work experience?',
    'What is the education?'
  ]
): Promise<ProcessedDocument> {
  const model = await initLayoutLMModel();

  try {
    // Convert file to base64 or blob URL for processing
    const imageUrl = URL.createObjectURL(imageFile);
    
    const results: LayoutLMResult[] = [];

    // Process each question
    for (const question of questions) {
      try {
        const output = await model(imageUrl, question);
        results.push({
          label: question,
          score: output.score || 0,
          box: output.box || [],
          text: output.answer || ''
        });
      } catch (err) {
        console.warn(`Error processing question "${question}":`, err);
      }
    }

    // Clean up the object URL
    URL.revokeObjectURL(imageUrl);

    // Process and structure the results
    const fields = processResults(results);

    return {
      fields,
      rawResults: results
    };
  } catch (error) {
    console.error('Error extracting CV information:', error);
    throw error;
  }
}

/**
 * Process raw results into structured fields
 */
function processResults(results: LayoutLMResult[]): ProcessedDocument['fields'] {
  const fields: ProcessedDocument['fields'] = {};

  for (const result of results) {
    let fieldName = 'unknown';
    
    // Map questions to field names
    if (result.label.toLowerCase().includes('name')) {
      fieldName = 'name';
    } else if (result.label.toLowerCase().includes('email')) {
      fieldName = 'email';
    } else if (result.label.toLowerCase().includes('phone')) {
      fieldName = 'phone';
    } else if (result.label.toLowerCase().includes('skill')) {
      fieldName = 'skills';
    } else if (result.label.toLowerCase().includes('experience')) {
      fieldName = 'experience';
    } else if (result.label.toLowerCase().includes('education')) {
      fieldName = 'education';
    }

    if (result.text && result.text.trim()) {
      fields[fieldName] = {
        value: result.text,
        confidence: result.score,
        bbox: result.box
      };
    }
  }

  return fields;
}

/**
 * Alternative: Use OCR + LayoutLM for better results
 * This combines Tesseract OCR with LayoutLM for document understanding
 */
export async function extractCVWithOCR(imageFile: File): Promise<ProcessedDocument> {
  // This would require additional OCR library like tesseract.js
  // For now, we'll use the basic extraction
  return extractCVInformation(imageFile);
}

/**
 * Validate extracted information
 */
export function validateExtractedData(fields: ProcessedDocument['fields']): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!fields.name || !fields.name.value) {
    errors.push('Name not found');
  }

  if (!fields.email || !fields.email.value) {
    errors.push('Email not found');
  }

  // Email validation
  if (fields.email?.value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fields.email.value)) {
      errors.push('Invalid email format');
    }
  }

  // Phone validation
  if (fields.phone?.value) {
    const phoneRegex = /[\d\s\-\+\(\)]{8,}/;
    if (!phoneRegex.test(fields.phone.value)) {
      errors.push('Invalid phone format');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}