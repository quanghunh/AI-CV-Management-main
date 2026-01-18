// src/types/cv.ts

export interface ParsedCV {
  name: string;
  email: string;
  phone: string;
  address?: string;
  skills: string[];
  experience?: string;
  education?: string;
  university?: string;
  rawText: string;
}