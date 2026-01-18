// src/components/candidates/CVViewDialog.tsx
import { X, Download } from 'lucide-react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CVViewDialogProps {
  candidate: {
    full_name: string;
    cv_url?: string;
    created_at: string;
  } | null;
  open: boolean;
  onClose: () => void;
}

export function CVViewDialog({ candidate, open, onClose }: CVViewDialogProps) {
  if (!candidate || !candidate.cv_url) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = candidate.cv_url!;
    link.download = `CV - ${candidate.full_name}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0">
        {/* Header */}
        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">CV - {candidate.full_name}</h2>
            <p className="text-sm text-gray-300">Ngày upload: {formatDate(candidate.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Tải xuống
            </Button>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="bg-gray-900 flex items-center justify-center" style={{ height: 'calc(95vh - 80px)' }}>
          <iframe
            src={candidate.cv_url}
            className="w-full h-full border-0"
            title={`CV - ${candidate.full_name}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}