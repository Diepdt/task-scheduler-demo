import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, Phone, Mail, Lock, AlertCircle, Calendar, Eye, EyeOff } from 'lucide-react';
import { authenticatedFetch } from '../api';

interface ProfileModalProps {
  onClose: () => void;
  onUpdate: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose, onUpdate }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial profile data
    authenticatedFetch('/users/profile')
      .then(res => {
        if (!res.ok) throw new Error('Không thể tải profile');
        return res.json();
      })
      .then(user => {
        setName(user.name || '');
        setEmail(user.email || '');
        setPhone(user.phone || '');
        if (user.birthday) {
          setBirthday(user.birthday.split('T')[0]);
        }
      })
      .catch(err => setError(err.message));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: any = { name, email, phone, birthday: birthday || null };
    if (password) {
      payload.password = password;
    }

    try {
      const res = await authenticatedFetch('/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Cập nhật thất bại');
      }

      // Update localStorage cached profile
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.name = data.name;
        user.email = data.email;
        localStorage.setItem('user', JSON.stringify(user));
      }

      alert('Cập nhật thông tin cá nhân thành công!');
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg p-6 rounded-2xl bg-[#111318] border border-[#232730] shadow-2xl relative">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Chỉnh sửa thông tin cá nhân</h3>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Họ và Tên</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Số điện thoại</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ngày sinh</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mật khẩu mới (Để trống nếu giữ nguyên)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-12 text-white focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 w-6 h-6 text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
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
              disabled={loading}
              className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
