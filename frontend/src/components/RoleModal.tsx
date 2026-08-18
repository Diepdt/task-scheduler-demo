import React, { useState, useEffect } from 'react';
import { X, Shield, AlertCircle } from 'lucide-react';
import { authenticatedFetch } from '../api';

interface Role {
  id: number;
  name: string;
}

interface RoleModalProps {
  onClose: () => void;
  onSave: () => void;
}

export const RoleModal: React.FC<RoleModalProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch roles to select parent role
    authenticatedFetch('/users/rbac/roles')
      .then(res => res.json())
      .then(data => setRoles(data || []))
      .catch(() => setError('Lỗi khi tải danh sách vai trò.'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: any = { name, description };
    if (parentId) {
      payload.parentId = Number(parentId);
    }

    try {
      const res = await authenticatedFetch('/users/rbac/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Lỗi khi tạo vai trò mới.');
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
          <h3 className="text-xl font-bold text-white">Thêm vai trò (Role) mới</h3>
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
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tên vai trò (Chữ in hoa)</label>
            <div className="relative">
              <Shield className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder="VÍ DỤ: MANAGER"
                className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none transition-all placeholder:text-gray-600 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mô tả chi tiết</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập mô tả vai trò..."
              rows={3}
              className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 px-4 text-white focus:outline-none transition-all placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Kế thừa vai trò cha (Parent Role)</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full bg-[#161920] border border-[#232730] focus:border-blue-500/50 rounded-xl py-3 px-4 text-white focus:outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">-- Không kế thừa (Cấp cao nhất) --</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
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
              {loading ? 'Đang tạo...' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
