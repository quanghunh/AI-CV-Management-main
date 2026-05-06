import { useState, useEffect, useCallback } from 'react';

import { 
  initLayoutLMModel, 
  extractCVInformation,
  validateExtractedData 
} from '../utils/layoutLMHelper';
import type { ProcessedDocument } from '../utils/layoutLMHelper';

interface UseLayoutLMResult {
  isModelLoaded: boolean;
  isProcessing: boolean;
  error: string | null;
  extractedData: ProcessedDocument | null;
  validationResult: { valid: boolean; errors: string[] } | null;
  processCV: (file: File) => Promise<ProcessedDocument | null>;
  resetData: () => void;
  loadModel: () => Promise<void>;
}

export function useLayoutLM(): UseLayoutLMResult {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ProcessedDocument | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);

  useEffect(() => {

  }, []);

  const loadModel = useCallback(async () => {
    try {
      setError(null);
      await initLayoutLMModel();
      setIsModelLoaded(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load model';
      setError(errorMessage);
      setIsModelLoaded(false);
    }
  }, []);

  const processCV = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    
    try {

      if (!isModelLoaded) {
        await loadModel();
      }

      const data = await extractCVInformation(file);
      setExtractedData(data);

      const validation = validateExtractedData(data.fields);
      setValidationResult(validation);

      if (!validation.valid) {
        console.warn('Validation errors:', validation.errors);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process CV';
      setError(errorMessage);
      setExtractedData(null);
      setValidationResult(null);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [isModelLoaded, loadModel]);

  const resetData = useCallback(() => {
    setExtractedData(null);
    setValidationResult(null);
    setError(null);
  }, []);

  return {
    isModelLoaded,
    isProcessing,
    error,
    extractedData,
    validationResult,
    processCV,
    resetData,
    loadModel
  };
}