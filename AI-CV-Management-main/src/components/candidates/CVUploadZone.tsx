 import { Upload, FileText, AlertCircle, CheckCircle, Loader2, X, Server } from 'lucide-react';
import { useState, useEffect } from 'react';
// ✅ FIX: Không cần import CVParserService nữa, dùng trực tiếp cvParser
import { parseCV, validateCVFile, checkBackendHealth, type ParsedCV } from '@/utils/cvParser';

interface CVUploadZoneProps {
  onFileSelect?: (file: File, parsed: ParsedCV) => void;
  onFileRemove?: () => void;
  disabled?: boolean;
  showExtractedData?: boolean;
}

export default function CVUploadZone({ 
  onFileSelect, 
  onFileRemove,
  disabled = false,
  showExtractedData = true 
}: CVUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ParsedCV | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  // Check backend availability on mount
  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    const isAvailable = await checkBackendHealth();
    setBackendAvailable(isAvailable);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (disabled) return;

    // ✅ FIX: Dùng validateCVFile từ cvParser
    const validation = validateCVFile(file);
    if (!validation.valid) {
      setError(validation.error || 'File không hợp lệ');
      return;
    }

    setUploadedFile(file);
    setError(null);

    // Create preview for images (nếu cần)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    // ✅ FIX: Parse CV using parseCV từ cvParser
    setIsProcessing(true);
    try {
      const parsedData = await parseCV(file);
      setExtractedData(parsedData);
      
      // Callback to parent component
      if (onFileSelect) {
        onFileSelect(file, parsedData);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể phân tích CV. Vui lòng thử lại.');
      console.error('CV parsing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (disabled) return;
    
    setUploadedFile(null);
    setPreview(null);
    setExtractedData(null);
    setError(null);
    
    if (onFileRemove) {
      onFileRemove();
    }
  };

  return (
    <div className="w-full">
      {/* Backend Status */}
      {backendAvailable === false && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-red-700 font-medium">Backend API không khả dụng</p>
              <p className="text-red-600 text-sm">Vui lòng khởi động backend server hoặc kiểm tra kết nối</p>
            </div>
            <button
              onClick={checkHealth}
              className="ml-auto px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {backendAvailable === true && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <Server className="w-5 h-5 text-green-600" />
          <span className="text-green-700">Backend API đã sẵn sàng</span>
        </div>
      )}

      {/* Upload Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : uploadedFile
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled || !backendAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="cv-upload"
          className="hidden"
          accept=".pdf,.docx,.txt"
          onChange={handleChange}
          disabled={disabled || isProcessing || !backendAvailable}
        />

        {!uploadedFile ? (
          <label 
            htmlFor="cv-upload" 
            className={disabled || !backendAvailable ? 'cursor-not-allowed' : 'cursor-pointer'}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-700">
              Kéo thả CV vào đây hoặc click để chọn file
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Hỗ trợ: PDF, DOCX, TXT (tối đa 5MB)
            </p>
          </label>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-12 h-12 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-gray-700">{uploadedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            
            {isProcessing && (
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Đang phân tích CV với AI...</span>
              </div>
            )}

            <button
              onClick={handleReset}
              disabled={disabled || isProcessing}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4 inline mr-2" />
              Xóa file
            </button>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Preview:</h3>
          <img src={preview} alt="CV Preview" className="max-w-full h-auto border rounded-lg" />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Extracted Data Display */}
      {showExtractedData && extractedData && (
        <div className="mt-6 space-y-4">
          <h3 className="text-xl font-bold">Thông tin đã trích xuất:</h3>

          {/* Quality Badge */}
          {extractedData.parseQuality && (
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              extractedData.parseQuality === 'excellent' ? 'bg-green-100 text-green-800' :
              extractedData.parseQuality === 'good' ? 'bg-blue-100 text-blue-800' :
              extractedData.parseQuality === 'fair' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Chất lượng: {extractedData.parseQuality === 'excellent' ? 'Xuất sắc' :
                           extractedData.parseQuality === 'good' ? 'Tốt' :
                           extractedData.parseQuality === 'fair' ? 'Khá' : 'Cần cải thiện'}
            </div>
          )}

          {/* Extracted Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ✅ FIX: Đổi name thành fullName */}
            <div className="p-4 bg-white border rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-700 mb-2">Họ tên:</h4>
              <p className="text-gray-900">{extractedData.fullName || 'N/A'}</p>
            </div>
            <div className="p-4 bg-white border rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-700 mb-2">Email:</h4>
              <p className="text-gray-900">{extractedData.email || 'N/A'}</p>
            </div>
            <div className="p-4 bg-white border rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-700 mb-2">Số điện thoại:</h4>
              <p className="text-gray-900">{extractedData.phone || 'N/A'}</p>
            </div>
            <div className="p-4 bg-white border rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-700 mb-2">Trường học:</h4>
              <p className="text-gray-900">{extractedData.university || 'N/A'}</p>
            </div>
          </div>

          {/* Skills */}
          {extractedData.skills && extractedData.skills.length > 0 && (
            <div className="p-4 bg-white border rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-700 mb-2">Kỹ năng:</h4>
              <div className="flex flex-wrap gap-2">
                {extractedData.skills.map((skill, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {extractedData.warnings && extractedData.warnings.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Cảnh báo:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {extractedData.warnings.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Full Text (collapsible) */}
          {extractedData.fullText && (
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                Xem văn bản đầy đủ
              </summary>
              <pre className="mt-2 p-4 bg-gray-50 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap">
                {extractedData.fullText}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}