import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, Mail, Phone, Shield, Lock, AlertCircle, Calendar } from 'lucide-react';
import { authenticatedFetch } from '../api';

interface UserRole {
  role: {
    id: number;
    name: string;
  };
}

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  birthday?: string;
  userRoles?: UserRole[];
}

interface RoleOption {
  id: number;
  name: string;
}

interface UserModalProps {
  user: User | null;
  onClose: () => void;
  onSave: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({ user, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch available roles
    authenticatedFetch('/users/rbac/roles')
      .then(res => res.json())
      .then(data => {
        setRoles(data || []);
        if (data.length > 0 && !user) {
          setSelectedRole(data[0].name);
        }
      })
      .catch(() => setError('Không thể tải danh sách vai trò.'));
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone);
      if (user.birthday) {
        setBirthday(user.birthday.split('T')[0]);
      } else {
        setBirthday('');
      }
      if (user.userRoles && user.userRoles.length > 0) {
        setSelectedRole(user.userRoles[0].role.name);
      }
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: any = { name, email, phone, birthday: birthday || null, roles: [selectedRole] };
    if (password) {
      payload.password = password;
    } else if (!user) {
      setError('Mật khẩu không được để trống khi tạo mới.');
      setLoading(false);
      return;
    }

    const url = user ? `/users/${user.id}` : '/users';
    const method = user ? 'PATCH' : 'POST';

    try {
      const res = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Lỗi khi lưu thông tin người dùng.');
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
      <div className="w-full max-w-lg p-6 rounded-2xl bg-[#111318] border border-[#232730] shadow-2xl relative">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">{user ? 'Cập nhật Người dùng' : 'Thêm Người dùng mới'}</h3>
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
                placeholder="Nguyễn Văn A"
                className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all placeholder:text-gray-600"
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
                placeholder="example@domain.com"
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

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mật khẩu {user && '(Để trống nếu giữ nguyên)'}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="password"
                required={!user}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all placeholder:text-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Vai trò (Role)</label>
            <div className="relative">
              <Shield className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all appearance-none cursor-pointer"
              >
                {roles.map((r: RoleOption) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
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
