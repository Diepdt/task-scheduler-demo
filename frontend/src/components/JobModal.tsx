import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { authenticatedFetch } from '../api';

interface Job {
  id: number;
  title: string;
  expression: string;
}

interface JobModalProps {
  job: Job | null; // Null means creating new job
  onClose: () => void;
  onSave: () => void;
}

export const JobModal: React.FC<JobModalProps> = ({ job, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [expression, setExpression] = useState('*/5 * * * *');
  const [cronMode, setCronMode] = useState<'presets' | 'raw'>('presets');
  
  // Presets variables
  const [presetMinutes, setPresetMinutes] = useState('*/5');
  const [presetHours, setPresetHours] = useState('*');
  const [presetDays, setPresetDays] = useState('*');
  const [presetMonths, setPresetMonths] = useState('*');
  const [presetWeeks, setPresetWeeks] = useState('*');

  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [validationMsg, setValidationMsg] = useState('');
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (job) {
      setTitle(job.title);
      setExpression(job.expression);
      setCronMode('raw');
    }
  }, [job]);

  // Handle Preset Changes and compute cron
  useEffect(() => {
    if (cronMode === 'presets') {
      const generated = `${presetMinutes} ${presetHours} ${presetDays} ${presetMonths} ${presetWeeks}`;
      setExpression(generated);
    }
  }, [presetMinutes, presetHours, presetDays, presetMonths, presetWeeks, cronMode]);

  // Dynamically validate expression
  useEffect(() => {
    if (!expression.trim()) {
      setIsValid(false);
      setValidationMsg('Biểu thức Cron không được để trống.');
      return;
    }

    const timer = setTimeout(() => {
      setValidating(true);
      authenticatedFetch('/scheduler/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression })
      })
        .then(res => res.json())
        .then(data => {
          if (data.isValid) {
            setIsValid(true);
            setValidationMsg(`Hợp lệ: Sẽ chạy tiếp theo vào lúc: ${data.nextDate}`);
          } else {
            setIsValid(false);
            setValidationMsg(data.message || 'Biểu thức Cron không đúng định dạng.');
          }
        })
        .catch(() => {
          setIsValid(false);
          setValidationMsg('Lỗi kết nối máy chủ để kiểm tra.');
        })
        .finally(() => setValidating(false));
    }, 500);

    return () => clearTimeout(timer);
  }, [expression]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);

    const url = job ? `/scheduler/${job.id}` : '/scheduler';
    const method = job ? 'PUT' : 'POST';

    try {
      const res = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, expression })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Lỗi khi lưu Cron Job');
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl p-6 rounded-2xl bg-[#111318] border border-[#232730] shadow-2xl relative">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">{job ? 'Cập nhật Cron Job' : 'Tạo mới Cron Job'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[#20242e] rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl flex items-start gap-3 text-sm mb-6 bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tên Job / Mô tả</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Gửi email thông báo hàng ngày"
              className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 px-4 text-white focus:outline-none transition-all placeholder:text-gray-600"
            />
          </div>

          <div className="border-t border-[#232730] pt-4">
            <div className="flex gap-4 mb-4">
              <button
                type="button"
                onClick={() => setCronMode('presets')}
                className={`py-2 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer ${cronMode === 'presets' ? 'bg-blue-600 text-white shadow-lg' : 'bg-[#161920] border border-[#232730] text-gray-400 hover:bg-[#20242e]'}`}
              >
                Trình dựng biểu thức (Builder)
              </button>
              <button
                type="button"
                onClick={() => setCronMode('raw')}
                className={`py-2 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer ${cronMode === 'raw' ? 'bg-blue-600 text-white shadow-lg' : 'bg-[#161920] border border-[#232730] text-gray-400 hover:bg-[#20242e]'}`}
              >
                Nhập thủ công (Raw)
              </button>
            </div>

            {cronMode === 'presets' ? (
              <div className="grid grid-cols-5 gap-3 p-4 bg-[#161920] rounded-xl border border-[#232730]">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Phút</label>
                  <select value={presetMinutes} onChange={(e) => setPresetMinutes(e.target.value)} className="w-full bg-[#111318] border border-[#232730] text-white rounded-lg p-2 text-xs focus:outline-none">
                    <option value="*">Mỗi phút (*)</option>
                    <option value="*/5">Mỗi 5 phút (*/5)</option>
                    <option value="*/15">Mỗi 15 phút (*/15)</option>
                    <option value="*/30">Mỗi 30 phút (*/30)</option>
                    <option value="0">Vào phút thứ 0 (0)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Giờ</label>
                  <select value={presetHours} onChange={(e) => setPresetHours(e.target.value)} className="w-full bg-[#111318] border border-[#232730] text-white rounded-lg p-2 text-xs focus:outline-none">
                    <option value="*">Mỗi giờ (*)</option>
                    <option value="*/2">Mỗi 2 giờ (*/2)</option>
                    <option value="*/6">Mỗi 6 giờ (*/6)</option>
                    <option value="*/12">Mỗi 12 giờ (*/12)</option>
                    <option value="0">Vào lúc 0h đêm (0)</option>
                    <option value="12">Vào lúc 12h trưa (12)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ngày</label>
                  <select value={presetDays} onChange={(e) => setPresetDays(e.target.value)} className="w-full bg-[#111318] border border-[#232730] text-white rounded-lg p-2 text-xs focus:outline-none">
                    <option value="*">Mỗi ngày (*)</option>
                    <option value="1">Ngày 1 đầu tháng (1)</option>
                    <option value="15">Ngày 15 giữa tháng (15)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tháng</label>
                  <select value={presetMonths} onChange={(e) => setPresetMonths(e.target.value)} className="w-full bg-[#111318] border border-[#232730] text-white rounded-lg p-2 text-xs focus:outline-none">
                    <option value="*">Mỗi tháng (*)</option>
                    <option value="*/3">Mỗi quý (*/3)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Thứ</label>
                  <select value={presetWeeks} onChange={(e) => setPresetWeeks(e.target.value)} className="w-full bg-[#111318] border border-[#232730] text-white rounded-lg p-2 text-xs focus:outline-none">
                    <option value="*">Mỗi thứ (*)</option>
                    <option value="1-5">Từ Thứ 2 - Thứ 6 (1-5)</option>
                    <option value="0,6">Cuối tuần (0,6)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  required
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="Ví dụ: */5 * * * *"
                  className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 px-4 text-white focus:outline-none transition-all"
                />
              </div>
            )}
          </div>

          {/* Validation section */}
          <div className="p-4 bg-[#161920]/50 rounded-xl border border-[#232730] flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {validating ? (
                <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
              ) : isValid === true ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : isValid === false ? (
                <XCircle className="w-5 h-5 text-rose-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-gray-500" />
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cú pháp hiện tại: <span className="text-white font-mono lowercase bg-[#111318] py-0.5 px-2 rounded-md border border-[#232730] text-sm ml-1 select-all">{expression}</span></div>
              <div className="text-xs text-gray-400 mt-1.5 line-clamp-2">{validationMsg || 'Nhập hoặc xây dựng biểu thức để hệ thống kiểm tra.'}</div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#232730] mt-6">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-5 bg-[#161920] hover:bg-[#20242e] border border-[#232730] text-gray-300 rounded-xl transition-all cursor-pointer font-semibold"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-55 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang lưu...' : 'Lưu lại'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
