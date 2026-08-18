import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, XCircle, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { authenticatedFetch } from '../api';

interface InvalidRow {
  row: number;
  email?: string;
  name?: string;
  phone?: string;
  role?: string;
  reason: string;
}

interface PreviewData {
  total: number;
  validCount: number;
  invalidCount: number;
  invalidRows: InvalidRow[];
  errorFileKey?: string;
}

interface UserImportWizardProps {
  onImportComplete: () => void;
}

export const UserImportWizard: React.FC<UserImportWizardProps> = ({ onImportComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Job Import Status
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setPreview(null);
    setJobId(null);
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      uploadAndPreview(selectedFile);
    }
  };

  const uploadAndPreview = async (selectedFile: File) => {
    setLoadingPreview(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await authenticatedFetch('/users/import/preview', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Lỗi khi kiểm tra file Excel.');
      }
      setPreview(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview || !file) return;
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await authenticatedFetch('/users/import/confirm', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Không thể bắt đầu quá trình import.');
      }
      if (data.jobId) {
        setJobId(data.jobId);
        setJobStatus('active');
        setJobProgress(0);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Poll job status
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(() => {
      authenticatedFetch(`/users/import/status/${jobId}`)
        .then(res => res.json())
        .then(statusData => {
          const progress = statusData.progress || 0;
          setJobProgress(progress);
          setJobStatus(statusData.status);
          setProcessedCount(statusData.processed || 0);
          setFailedCount(statusData.failed || 0);

          if (statusData.status === 'completed' || statusData.status === 'failed') {
            clearInterval(interval);
            onImportComplete();
          }
        })
        .catch(() => {
          clearInterval(interval);
          setError('Mất kết nối theo dõi tiến độ import.');
        });
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <div className="p-6 rounded-2xl bg-[#111318] border border-[#232730] shadow-xl relative overflow-hidden mt-6">
      <h3 className="text-lg font-bold text-white mb-2">Nhập dữ liệu nâng cao từ Excel</h3>
      <p className="text-sm text-gray-400 mb-6">
        Chọn file Excel để tải lên, hệ thống sẽ kiểm tra và hiển thị kết quả xem trước (Preview) lỗi trước khi ghi vào CSDL.
      </p>

      {error && (
        <div className="p-4 rounded-xl flex items-start gap-3 text-sm mb-6 bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* File select button */}
      <div className="flex gap-4 items-center">
        <input
          type="file"
          id="import-excel-file"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => document.getElementById('import-excel-file')?.click()}
          className="py-2.5 px-5 bg-[#161920] hover:bg-[#20242e] border border-[#232730] text-white font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 text-sm"
        >
          <Upload className="w-4 h-4" />
          Chọn file Excel
        </button>
        <span className="text-sm text-gray-400">
          {file ? file.name : 'Chưa chọn file nào'}
        </span>
      </div>

      {loadingPreview && (
        <div className="flex items-center gap-3 text-sm text-blue-400 mt-6 animate-pulse">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Đang tải và kiểm tra file Excel...</span>
        </div>
      )}

      {/* Preview results */}
      {preview && !jobId && (
        <div className="mt-8 border-t border-[#232730] pt-6 animate-fadeIn">
          <h4 className="text-sm font-bold text-white mb-4">Kết quả xem trước (Preview)</h4>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-[#161920] border border-[#232730] text-center">
              <div className="text-2xl font-bold text-white">{preview.total}</div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">Tổng số dòng</div>
            </div>
            <div className="p-4 rounded-xl bg-[#161920] border border-emerald-500/20 text-center">
              <div className="text-2xl font-bold text-emerald-400">{preview.validCount}</div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">Hợp lệ (Sẵn sàng)</div>
            </div>
            <div className="p-4 rounded-xl bg-[#161920] border border-rose-500/20 text-center">
              <div className="text-2xl font-bold text-rose-400">{preview.invalidCount}</div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">Bị lỗi (Sẽ bỏ qua)</div>
            </div>
          </div>

          {/* Invalid rows error details */}
          {preview.invalidRows.length > 0 && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/5 border border-rose-500/15">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold text-rose-400">Danh sách các dòng bị lỗi chi tiết:</span>
                {preview.errorFileKey && (
                  <a
                    href={`/users/import/errors/${preview.errorFileKey}`}
                    className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold underline cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Tải file Excel chứa các dòng lỗi
                  </a>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 text-xs font-mono text-gray-400">
                {preview.invalidRows.map((r, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-rose-400 shrink-0">Dòng {r.row}:</span>
                    <span>{r.reason} ({r.email || r.phone || '-'})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-[#232730] pt-4">
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="py-2 px-4 bg-[#161920] hover:bg-[#20242e] border border-[#232730] text-gray-300 rounded-xl transition-all cursor-pointer font-semibold text-sm"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={preview.validCount === 0}
              className="py-2 px-5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Xác nhận Import ({preview.validCount} dòng)
            </button>
          </div>
        </div>
      )}

      {/* Import progress bar */}
      {jobId && (
        <div className="mt-8 border-t border-[#232730] pt-6 animate-fadeIn">
          <div className="flex justify-between text-sm mb-3">
            <span className="font-semibold text-white">
              {jobStatus === 'completed' ? (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Import thành công!
                </span>
              ) : jobStatus === 'failed' ? (
                <span className="text-rose-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Import thất bại
                </span>
              ) : (
                <span className="text-blue-400 flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Đang xử lý tệp Excel...
                </span>
              )}
            </span>
            <span className="text-gray-400 font-semibold">{jobProgress}%</span>
          </div>

          <div className="w-full bg-[#161920] h-2.5 rounded-full overflow-hidden border border-[#232730]">
            <div
              className={`h-full transition-all duration-300 ${jobStatus === 'completed' ? 'bg-emerald-500' : jobStatus === 'failed' ? 'bg-rose-500' : 'bg-blue-500'}`}
              style={{ width: `${jobProgress}%` }}
            />
          </div>

          <div className="flex gap-6 mt-4 text-xs text-gray-400 font-semibold uppercase tracking-wider">
            <div>Đã xử lý: <span className="text-white text-sm font-mono ml-1">{processedCount}</span></div>
            <div>Bị lỗi: <span className="text-rose-400 text-sm font-mono ml-1">{failedCount}</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
