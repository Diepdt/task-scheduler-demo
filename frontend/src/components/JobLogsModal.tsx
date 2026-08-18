import React, { useState, useEffect } from 'react';
import { X, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { authenticatedFetch } from '../api';

interface Log {
  id: number;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING';
  message?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  createdAt: string;
}

interface JobLogsModalProps {
  jobId: number;
  jobTitle: string;
  onClose: () => void;
}

export const JobLogsModal: React.FC<JobLogsModalProps> = ({ jobId, jobTitle, onClose }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = () => {
    setLoading(true);
    setError(null);
    authenticatedFetch(`/scheduler/${jobId}/logs`)
      .then(res => {
        if (!res.ok) throw new Error('Không thể tải lịch sử chạy log');
        return res.json();
      })
      .then(data => setLogs(data || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [jobId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl p-6 rounded-2xl bg-[#111318] border border-[#232730] shadow-2xl relative h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <div>
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Lịch sử chạy</span>
            <h3 className="text-xl font-bold text-white mt-0.5">{jobTitle}</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 hover:bg-[#20242e] rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer border border-[#232730] flex items-center gap-2 text-sm font-semibold"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-[#20242e] rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grow overflow-y-auto min-h-0 border border-[#232730] rounded-xl bg-[#161920]/30">
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <span>Đang tải lịch sử chạy...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-rose-400">
              <XCircle className="w-8 h-8 text-rose-500 mb-3" />
              <span>{error}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-gray-500">
              <Clock className="w-8 h-8 text-gray-600 mb-3" />
              <span>Chưa có lịch sử chạy nào cho Job này.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[#161920] text-gray-400 font-semibold border-b border-[#232730] sticky top-0">
                <tr>
                  <th className="py-3.5 px-4">Thời gian chạy</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Thời gian chạy</th>
                  <th className="py-3.5 px-4">Thông điệp/Lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232730]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#161920]/40 transition-colors">
                    <td className="py-3.5 px-4 text-gray-300 font-mono">
                      {new Date(log.startedAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3.5 px-4">
                      {log.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          SUCCESS
                        </span>
                      ) : log.status === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          FAILED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          RUNNING
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400">
                      {log.durationMs ? `${log.durationMs}ms` : '-'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-400 max-w-md truncate" title={log.message}>
                      {log.message || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
