import React, { useState, useEffect } from 'react';
import { X, RefreshCw, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { authenticatedFetch } from '../api';

interface Permission {
  id: number;
  name: string;
  description?: string;
}

interface RolePermissionsModalProps {
  roleId: number;
  roleName: string;
  onClose: () => void;
}

export const RolePermissionsModal: React.FC<RolePermissionsModalProps> = ({ roleId, roleName, onClose }) => {
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Fetch all permissions and role specific permissions in parallel
    Promise.all([
      authenticatedFetch('/users/rbac/permissions').then(res => res.json()),
      authenticatedFetch(`/users/rbac/roles/${roleId}/permissions`).then(res => res.json())
    ])
      .then(([allPerms, rolePerms]) => {
        setAllPermissions(allPerms || []);
        setCheckedIds(rolePerms || []);
      })
      .catch(() => setError('Lỗi khi tải cấu hình quyền.'))
      .finally(() => setLoading(false));
  }, [roleId]);

  const handleToggle = (permissionId: number) => {
    if (checkedIds.includes(permissionId)) {
      setCheckedIds(checkedIds.filter(id => id !== permissionId));
    } else {
      setCheckedIds([...checkedIds, permissionId]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await authenticatedFetch(`/users/rbac/roles/${roleId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds: checkedIds })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Lỗi khi lưu cấu hình quyền.');
      }
      alert('Cấu hình quyền cho vai trò thành công!');
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg p-6 rounded-2xl bg-[#111318] border border-[#232730] shadow-2xl relative flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Phân quyền vai trò</span>
            <h3 className="text-xl font-bold text-white mt-0.5">{roleName}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#20242e] rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl flex items-start gap-3 text-sm mb-6 bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grow overflow-y-auto space-y-3 min-h-0 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span>Đang tải cấu hình...</span>
            </div>
          ) : allPermissions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Không tìm thấy quyền nào.</div>
          ) : (
            allPermissions.map(p => {
              const isChecked = checkedIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => handleToggle(p.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${isChecked ? 'bg-blue-500/5 border-blue-500/30' : 'bg-[#161920]/40 border-[#232730] hover:bg-[#161920]/80'}`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isChecked ? (
                      <CheckSquare className="w-5 h-5 text-blue-500" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white font-mono">{p.name}</div>
                    <div className="text-xs text-gray-400 mt-1">{p.description || 'Chưa cấu hình mô tả.'}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#232730] mt-6 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 bg-[#161920] hover:bg-[#20242e] border border-[#232730] text-gray-300 rounded-xl transition-all cursor-pointer font-semibold"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-55 disabled:cursor-not-allowed"
          >
            {saving ? 'Đang lưu...' : 'Lưu quyền hạn'}
          </button>
        </div>
      </div>
    </div>
  );
};
