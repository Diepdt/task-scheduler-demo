import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, Phone, AlertCircle, LogIn, Globe, Calendar } from 'lucide-react';
import { setAccessToken } from '../api';

interface AuthOverlayProps {
  onLoginSuccess: () => void;
}

export const AuthOverlay: React.FC<AuthOverlayProps> = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const url = isRegister ? '/auth/register' : '/auth/login';
    const payload = isRegister ? { email, password, name, phone, birthday: birthday || undefined } : { email, password };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Hành động thất bại!');
      }

      if (isRegister) {
        setIsRegister(false);
        setError('Đăng ký thành công! Vui lòng đăng nhập.');
      } else {
        if (data.access_token) {
          setAccessToken(data.access_token);
          localStorage.setItem('user', JSON.stringify(data.user));
          onLoginSuccess();
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = '/auth/google';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07080a]/95 backdrop-blur-md">
      <div className="w-full max-w-md p-8 rounded-2xl bg-[#111318]/60 border border-[#232730] shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px]" />

        <div className="text-center mb-8 relative">
          <div className="inline-flex p-3 bg-blue-500/10 text-blue-400 rounded-xl mb-4 border border-blue-500/20">
            <LogIn className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-[#f3f4f6] to-gray-400">
            {isRegister ? 'Đăng Ký' : 'Đăng Nhập'}
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            {isRegister ? 'Tạo tài khoản mới để quản lý hệ thống' : 'Nhập thông tin của bạn để truy cập hệ thống'}
          </p>
        </div>

        {error && (
          <div className={`p-4 rounded-xl flex items-start gap-3 text-sm mb-6 ${error.includes('thành công') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative">
          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Họ và Tên</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all placeholder:text-gray-600"
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
                    placeholder="09xxxxxxxx"
                    className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all placeholder:text-gray-600"
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
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all placeholder:text-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all placeholder:text-gray-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl focus:outline-none transition-all cursor-pointer shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Vui lòng đợi...' : isRegister ? 'Đăng ký tài khoản' : 'Đăng nhập'}
          </button>
        </form>

        <div className="relative my-6 text-center">
          <hr className="border-[#232730]" />
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#111318] px-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Hoặc sử dụng</span>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full py-3 px-4 bg-[#161920] border border-[#232730] hover:bg-[#20242e] text-white font-semibold rounded-xl focus:outline-none transition-all cursor-pointer flex items-center justify-center gap-3"
        >
          <Globe className="w-5 h-5 text-blue-400" />
          Tiếp tục với Google
        </button>

        <p className="text-center text-sm text-gray-500 mt-6">
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors cursor-pointer"
          >
            {isRegister ? 'Đăng nhập ngay' : 'Đăng ký ngay'}
          </button>
        </p>
      </div>
    </div>
  );
};
