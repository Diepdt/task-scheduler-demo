import { useState, useEffect } from 'react';
import { 
  Calendar, Users, RefreshCw, LogOut, Settings, 
  Plus, Edit, Trash2, Play, History, Download, Database, KeyRound
} from 'lucide-react';
import { 
  authenticatedFetch, hasPermission, setAccessToken, refreshAccessToken, type User 
} from './api';
import { AuthOverlay } from './components/AuthOverlay';
import { ProfileModal } from './components/ProfileModal';
import { JobModal } from './components/JobModal';
import { JobLogsModal } from './components/JobLogsModal';
import { UserModal } from './components/UserModal';
import { UserImportWizard } from './components/UserImportWizard';
import { RoleModal } from './components/RoleModal';
import { RolePermissionsModal } from './components/RolePermissionsModal';

interface Job {
  id: number;
  title: string;
  expression: string;
}

interface RbacRole {
  id: number;
  name: string;
  description?: string;
  parent?: {
    name: string;
  };
  rolePermissions?: any[];
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'users' | 'sync' | 'rbac'>('jobs');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Modals state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedJobLogs, setSelectedJobLogs] = useState<{ id: number; title: string } | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<{ id: number; name: string } | null>(null);

  // Tab Data States
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userLimit] = useState(10);
  const [userTotal, setUserTotal] = useState(0);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userSortBy, setUserSortBy] = useState('id');
  const [userSortOrder, setUserSortOrder] = useState('desc');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // 1. Initial Authentication and Google Callback Handling
  useEffect(() => {
    const handleAuthChange = () => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    };

    window.addEventListener('auth-change', handleAuthChange);

    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const urlUser = urlParams.get('user');

    const initAuth = async () => {
      if (urlToken && urlUser) {
        const decodedUser = decodeURIComponent(urlUser);
        setAccessToken(urlToken);
        localStorage.setItem('user', decodedUser);
        setUser(JSON.parse(decodedUser));
        setIsAuthenticated(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const token = await refreshAccessToken();
          if (token) {
            setUser(JSON.parse(userStr));
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('user');
          }
        }
      }
      setCheckingAuth(false);
    };

    initAuth();

    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  // Update initial active tab selection based on permissions
  useEffect(() => {
    if (isAuthenticated) {
      if (hasPermission('TASK_READ')) {
        setActiveTab('jobs');
        loadJobs();
      } else if (hasPermission('USER_READ')) {
        setActiveTab('users');
        loadUsers();
      } else {
        setActiveTab('sync');
        loadSync();
      }
    }
  }, [isAuthenticated]);

  // Tab change actions
  const handleTabChange = (tab: 'jobs' | 'users' | 'sync' | 'rbac') => {
    setActiveTab(tab);
    if (tab === 'jobs') loadJobs();
    if (tab === 'users') loadUsers();
    if (tab === 'sync') loadSync();
    if (tab === 'rbac') loadRbac();
  };

  const handleProfileUpdate = () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  };

  // 2. Tab: Cron Jobs API
  const loadJobs = () => {
    if (!hasPermission('TASK_READ')) return;
    setLoadingJobs(true);
    authenticatedFetch('/scheduler')
      .then(res => res.json())
      .then(data => setJobs(data || []))
      .catch(() => alert('Lỗi khi tải danh sách Cron Jobs.'))
      .finally(() => setLoadingJobs(false));
  };

  const handleDeleteJob = (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa Job này không?')) return;
    authenticatedFetch(`/scheduler/${id}`, { method: 'DELETE' })
      .then(() => loadJobs())
      .catch(() => alert('Lỗi khi xóa Job.'));
  };

  const handleRunJob = (id: number) => {
    authenticatedFetch(`/scheduler/${id}/run`, { method: 'POST' })
      .then(() => alert('Đã kích hoạt chạy Job thành công!'))
      .catch(() => alert('Lỗi khi kích hoạt chạy Job.'));
  };

  // 3. Tab: User Management API
  const loadUsers = () => {
    if (!hasPermission('USER_READ')) return;
    setLoadingUsers(true);
    const query = `page=${userPage}&limit=${userLimit}&search=${encodeURIComponent(userSearch)}&role=${userRoleFilter}&sortBy=${userSortBy}&sortOrder=${userSortOrder}`;
    authenticatedFetch(`/users?${query}`)
      .then(res => res.json())
      .then(resData => {
        setUsers(resData.data || []);
        setUserTotal(resData.meta?.total || 0);
        setUserTotalPages(resData.meta?.totalPages || 1);
      })
      .catch(() => alert('Lỗi khi tải danh sách người dùng.'))
      .finally(() => setLoadingUsers(false));
  };

  // Trigger search or filter changes
  useEffect(() => {
    if (isAuthenticated && activeTab === 'users') {
      loadUsers();
    }
  }, [userPage, userRoleFilter, userSortBy, userSortOrder]);

  const handleDeleteUser = (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa người dùng này?')) return;
    authenticatedFetch(`/users/${id}`, { method: 'DELETE' })
      .then(() => loadUsers())
      .catch(() => alert('Lỗi khi xóa người dùng.'));
  };

  const handleExportUsers = () => {
    const query = `search=${encodeURIComponent(userSearch)}&role=${userRoleFilter}&sortBy=${userSortBy}&sortOrder=${userSortOrder}`;
    authenticatedFetch(`/users/export?${query}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_export_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(() => alert('Lỗi khi xuất danh sách người dùng.'));
  };

  const handleSeedUsers = () => {
    if (!confirm('Bạn có muốn tự động tạo nhanh tài khoản mẫu để kiểm thử không?')) return;
    authenticatedFetch('/users/seed-demo', { method: 'POST' })
      .then(() => {
        alert('Đã thêm thành công tài khoản mẫu!');
        loadUsers();
      })
      .catch(() => alert('Lỗi khi chạy seeding.'));
  };

  const handleDownloadTemplate = () => {
    authenticatedFetch('/users/import/template')
      .then(async (res) => {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'user_import_template.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(() => alert('Không thể tải file mẫu.'));
  };

  const loadSync = () => {
    authenticatedFetch('/sync/status')
      .then(res => res.json())
      .then(data => {
        setSyncHistory(data.history || []);
      })
      .catch(() => {});
  };

  const handleTriggerSync = () => {
    setSyncing(true);
    authenticatedFetch('/sync/trigger', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        alert(data.message || 'Bắt đầu tiến trình đồng bộ dữ liệu...');
        loadSync();
      })
      .catch(() => alert('Lỗi khi kích hoạt đồng bộ.'))
      .finally(() => setSyncing(false));
  };

  // 5. Tab: RBAC API
  const loadRbac = () => {
    if (!hasPermission('USER_READ')) return;
    setLoadingRoles(true);
    authenticatedFetch('/users/rbac/roles')
      .then(res => res.json())
      .then(data => setRoles(data || []))
      .catch(() => alert('Lỗi khi tải danh sách vai trò.'))
      .finally(() => setLoadingRoles(false));
  };

  const handleDeleteRole = (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa vai trò này?')) return;
    authenticatedFetch(`/users/rbac/roles/${id}`, { method: 'DELETE' })
      .then(() => loadRbac())
      .catch(() => alert('Lỗi khi xóa vai trò.'));
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    setAccessToken(null);
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#07080a] text-gray-400">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <span>Đang khởi động hệ thống...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthOverlay onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#07080a] flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0d0f14] border-r border-[#1f232c] flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Area */}
          <div className="p-6 border-b border-[#1f232c]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-white text-base leading-none">Task Scheduler</h1>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Enterprise System</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {hasPermission('TASK_READ') && (
              <button
                onClick={() => handleTabChange('jobs')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'jobs' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/15' : 'text-gray-400 hover:bg-[#161920] hover:text-white'}`}
              >
                <Calendar className="w-4 h-4" />
                Cấu hình Cron Jobs
              </button>
            )}

            {hasPermission('USER_READ') && (
              <button
                onClick={() => handleTabChange('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'users' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/15' : 'text-gray-400 hover:bg-[#161920] hover:text-white'}`}
              >
                <Users className="w-4 h-4" />
                Quản lý Người dùng
              </button>
            )}

            <button
              onClick={() => handleTabChange('sync')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'sync' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/15' : 'text-gray-400 hover:bg-[#161920] hover:text-white'}`}
            >
              <RefreshCw className="w-4 h-4" />
              Đồng bộ CSDL
            </button>

            {hasPermission('USER_READ') && (
              <button
                onClick={() => handleTabChange('rbac')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'rbac' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/15' : 'text-gray-400 hover:bg-[#161920] hover:text-white'}`}
              >
                <KeyRound className="w-4 h-4" />
                Phân quyền (RBAC)
              </button>
            )}
          </nav>
        </div>

        {/* User profile & settings section */}
        <div className="p-4 border-t border-[#1f232c] bg-[#0b0c10]">
          {user && (
            <div className="mb-4">
              <div className="font-semibold text-white text-sm truncate">{user.name}</div>
              <div className="flex gap-1.5 items-center mt-1">
                {user.roles?.map((r, i) => (
                  <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#232730] text-blue-400 border border-[#2d323e]">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex-1 py-2 bg-[#161920] hover:bg-[#20242e] border border-[#232730] text-gray-300 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              Profile
            </button>
            <button
              onClick={logout}
              className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg transition-all cursor-pointer flex items-center justify-center"
              title="Đăng xuất"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content body */}
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        {/* TAB 1: CRON JOBS TAB */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">Hệ thống lập lịch</span>
                <h2 className="text-2xl font-bold text-white mt-1">Danh sách Cron Jobs</h2>
              </div>
              {hasPermission('TASK_RUN') && (
                <button 
                  onClick={() => { setSelectedJob(null); setShowJobModal(true); }}
                  className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Thêm Job mới
                </button>
              )}
            </div>

            <div className="bg-[#0d0f14] border border-[#1f232c] rounded-2xl overflow-hidden shadow-xl">
              {loadingJobs ? (
                <div className="p-20 flex flex-col items-center justify-center text-gray-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                  <span>Đang tải danh sách Cron Jobs...</span>
                </div>
              ) : jobs.length === 0 ? (
                <div className="p-20 text-center text-gray-500">
                  Không tìm thấy Cron Job nào được đăng ký.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#161920]/40 text-gray-400 font-semibold border-b border-[#1f232c]">
                    <tr>
                      <th className="py-4 px-6">Task</th>
                      <th className="py-4 px-6">Cron Expression</th>
                      <th className="py-4 px-6">Hành động</th>
                      <th className="py-4 px-6 text-right">Lịch sử chạy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f232c]">
                    {jobs.map(job => (
                      <tr key={job.id} className="hover:bg-[#161920]/20 transition-colors">
                        <td className="py-4 px-6 font-semibold text-white">{job.title}</td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 bg-[#1c1e26] border border-[#2a2d39] text-gray-300 rounded-md font-mono text-xs select-all">
                            {job.expression}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex gap-2">
                            {hasPermission('TASK_RUN') ? (
                              <>
                                <button 
                                  onClick={() => handleRunJob(job.id)}
                                  className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors border border-blue-500/10 cursor-pointer"
                                  title="Chạy ngay lập tức"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => { setSelectedJob(job); setShowJobModal(true); }}
                                  className="p-1.5 bg-[#1f232c] hover:bg-[#2c313e] text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Chỉnh sửa"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteJob(job.id)}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors border border-rose-500/10 cursor-pointer"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <span className="text-gray-500 text-xs italic">Chỉ xem</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => setSelectedJobLogs({ id: job.id, title: job.title })}
                            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">Hệ thống nhân sự</span>
                <h2 className="text-2xl font-bold text-white mt-1">Quản lý tài khoản</h2>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleDownloadTemplate}
                  className="py-2.5 px-4 bg-[#161920] hover:bg-[#20242e] border border-[#232730] text-gray-300 font-semibold rounded-xl text-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Mẫu excel
                </button>
                <button 
                  onClick={handleExportUsers}
                  className="py-2.5 px-4 bg-[#161920] hover:bg-[#20242e] border border-[#232730] text-gray-300 font-semibold rounded-xl text-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Xuất Excel
                </button>
                {hasPermission('USER_CREATE') && (
                  <>
                    <button 
                      onClick={handleSeedUsers}
                      className="py-2.5 px-4 bg-[#161920] hover:bg-[#20242e] border border-[#232730] text-gray-300 font-semibold rounded-xl text-sm transition-all cursor-pointer flex items-center gap-2"
                    >
                      Seed Demo
                    </button>
                    <button 
                      onClick={() => { setSelectedUser(null); setShowUserModal(true); }}
                      className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Thêm User mới
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Filter grid */}
            <div className="grid grid-cols-4 gap-4 p-5 bg-[#0d0f14] border border-[#1f232c] rounded-2xl">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tìm kiếm</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Tìm kiếm theo Tên hoặc Email..."
                    className="flex-1 bg-[#161920] border border-[#232730] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-blue-500/50 text-sm"
                  />
                  <button onClick={loadUsers} className="py-2 px-5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer">
                    Tìm
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Vai trò (Role)</label>
                <select
                  value={userRoleFilter}
                  onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }}
                  className="w-full bg-[#161920] border border-[#232730] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-blue-500/50 text-sm appearance-none cursor-pointer"
                >
                  <option value="">-- Tất cả Role --</option>
                  <option value="USER">USER</option>
                  <option value="STAFF">STAFF</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sắp xếp</label>
                <div className="flex gap-2">
                  <select
                    value={userSortBy}
                    onChange={(e) => setUserSortBy(e.target.value)}
                    className="flex-1 bg-[#161920] border border-[#232730] rounded-xl py-2 px-3 text-white focus:outline-none text-sm cursor-pointer"
                  >
                    <option value="id">ID</option>
                    <option value="name">Tên</option>
                    <option value="email">Email</option>
                    <option value="createdAt">Ngày tạo</option>
                  </select>
                  <select
                    value={userSortOrder}
                    onChange={(e) => setUserSortOrder(e.target.value)}
                    className="w-24 bg-[#161920] border border-[#232730] rounded-xl py-2 px-2 text-white focus:outline-none text-sm cursor-pointer"
                  >
                    <option value="desc">Giảm</option>
                    <option value="asc">Tăng</option>
                  </select>
                </div>
              </div>
            </div>

            {/* User List Table */}
            <div className="bg-[#0d0f14] border border-[#1f232c] rounded-2xl overflow-hidden shadow-xl">
              {loadingUsers ? (
                <div className="p-20 flex flex-col items-center justify-center text-gray-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                  <span>Đang tải danh sách người dùng...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="p-20 text-center text-gray-500">
                  Không tìm thấy người dùng nào khớp điều kiện.
                </div>
              ) : (
                <>
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-[#161920]/40 text-gray-400 font-semibold border-b border-[#1f232c]">
                      <tr>
                        <th className="py-4 px-6">ID</th>
                        <th className="py-4 px-6">Họ và Tên</th>
                        <th className="py-4 px-6">Email</th>
                        <th className="py-4 px-6">Số điện thoại</th>
                        <th className="py-4 px-6">Quyền (Role)</th>
                        <th className="py-4 px-6">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f232c]">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-[#161920]/20 transition-colors">
                          <td className="py-4 px-6 text-gray-400 font-mono">{u.id}</td>
                          <td className="py-4 px-6 font-semibold text-white">{u.name}</td>
                          <td className="py-4 px-6 text-gray-300">{u.email}</td>
                          <td className="py-4 px-6 text-gray-300 font-mono">{u.phone}</td>
                          <td className="py-4 px-6">
                            <div className="flex gap-1.5">
                              {u.userRoles?.map((ur: any, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#1c1e26] border border-[#2a2d39] text-blue-400">
                                  {ur.role.name}
                                </span>
                              )) || '-'}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex gap-2">
                              {hasPermission('USER_CREATE') ? (
                                <button 
                                  onClick={() => { setSelectedUser(u); setShowUserModal(true); }}
                                  className="p-1.5 bg-[#1f232c] hover:bg-[#2c313e] text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Sửa thông tin"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              ) : null}
                              {hasPermission('USER_DELETE') ? (
                                <button 
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors border border-rose-500/10 cursor-pointer"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : null}
                              {!hasPermission('USER_CREATE') && !hasPermission('USER_DELETE') ? (
                                <span className="text-gray-500 text-xs italic">Chỉ xem</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Pagination Footer */}
                  <div className="p-4 border-t border-[#1f232c] bg-[#0b0c10] flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Trang {userPage} / {userTotalPages} (Tổng {userTotal})
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUserPage(p => Math.max(p - 1, 1))}
                        disabled={userPage <= 1}
                        className="py-1.5 px-3 bg-[#161920] border border-[#232730] hover:bg-[#20242e] text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                      >
                        Trước
                      </button>
                      <button
                        onClick={() => setUserPage(p => Math.min(p + 1, userTotalPages))}
                        disabled={userPage >= userTotalPages}
                        className="py-1.5 px-3 bg-[#161920] border border-[#232730] hover:bg-[#20242e] text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Import Excel section (restricted) */}
            {hasPermission('USER_CREATE') && (
              <UserImportWizard onImportComplete={loadUsers} />
            )}
          </div>
        )}

        {/* TAB 3: DATA SYNC */}
        {activeTab === 'sync' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">Replication & Backup</span>
                <h2 className="text-2xl font-bold text-white mt-1">Đồng bộ CSDL song song</h2>
              </div>
              <button 
                onClick={handleTriggerSync}
                disabled={syncing}
                className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
              </button>
            </div>

            {/* Sync status card */}
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-[#0d0f14] border border-[#1f232c] shadow-xl">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">CSDL Nguồn</h3>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">PostgreSQL</h4>
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                      Đang chạy (Cổng 6432)
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[#0d0f14] border border-[#1f232c] shadow-xl">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">CSDL Đích (Replicated)</h3>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">MariaDB / MySQL</h4>
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                      Đang chạy (Cổng 3306)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sync Logs list */}
            <div className="bg-[#0d0f14] border border-[#1f232c] rounded-2xl overflow-hidden shadow-xl">
              <div className="p-6 border-b border-[#1f232c] bg-[#161920]/20 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Lịch sử đồng bộ gần nhất</h3>
                <button onClick={loadSync} className="p-1 hover:bg-[#20242e] rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {syncHistory.length === 0 ? (
                <div className="p-12 text-center text-gray-500">Chưa có bản ghi đồng bộ nào được tạo.</div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#161920]/40 text-gray-400 font-semibold border-b border-[#1f232c]">
                    <tr>
                      <th className="py-4 px-6">ID</th>
                      <th className="py-4 px-6">Bắt đầu lúc</th>
                      <th className="py-4 px-6">Trạng thái</th>
                      <th className="py-4 px-6">Bản ghi được đồng bộ</th>
                      <th className="py-4 px-6 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f232c]">
                    {syncHistory.map((log: any) => (
                      <tr key={log.id} className="hover:bg-[#161920]/20 transition-colors">
                        <td className="py-4 px-6 text-gray-400 font-mono">{log.id}</td>
                        <td className="py-4 px-6 font-mono text-gray-300">
                          {new Date(log.startedAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-4 px-6">
                          {log.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              SUCCESS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              FAILED
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-gray-300 font-semibold">{log.recordsCount} hàng</td>
                        <td className="py-4 px-6 text-right text-gray-400 text-xs font-mono">{log.message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: RBAC MANAGEMENT */}
        {activeTab === 'rbac' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">Phân quyền vai trò</span>
                <h2 className="text-2xl font-bold text-white mt-1">Vai trò & Quyền hạn</h2>
              </div>
              {hasPermission('USER_CREATE') && (
                <button 
                  onClick={() => setShowRoleModal(true)}
                  className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Thêm Role mới
                </button>
              )}
            </div>

            <div className="bg-[#0d0f14] border border-[#1f232c] rounded-2xl overflow-hidden shadow-xl">
              {loadingRoles ? (
                <div className="p-20 flex flex-col items-center justify-center text-gray-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                  <span>Đang tải danh sách vai trò...</span>
                </div>
              ) : roles.length === 0 ? (
                <div className="p-20 text-center text-gray-500">
                  Chưa có vai trò nào được tạo.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#161920]/40 text-gray-400 font-semibold border-b border-[#1f232c]">
                    <tr>
                      <th className="py-4 px-6">ID</th>
                      <th className="py-4 px-6">Vai trò (Role)</th>
                      <th className="py-4 px-6">Mô tả</th>
                      <th className="py-4 px-6">Kế thừa cha</th>
                      <th className="py-4 px-6">Số quyền</th>
                      <th className="py-4 px-6">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f232c]">
                    {roles.map(role => (
                      <tr key={role.id} className="hover:bg-[#161920]/20 transition-colors">
                        <td className="py-4 px-6 text-gray-400 font-mono">{role.id}</td>
                        <td className="py-4 px-6 font-bold text-white">{role.name}</td>
                        <td className="py-4 px-6 text-gray-400">{role.description || '-'}</td>
                        <td className="py-4 px-6">
                          {role.parent ? (
                            <span className="px-2.5 py-0.5 rounded-md text-xs bg-blue-500/10 text-blue-400 border border-blue-500/15 font-semibold">
                              {role.parent.name}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-4 px-6 text-gray-300 font-semibold">{role.rolePermissions?.length || 0} quyền trực tiếp</td>
                        <td className="py-4 px-6">
                          <div className="flex gap-2">
                            {hasPermission('USER_CREATE') && (
                              <button 
                                onClick={() => setSelectedRolePermissions({ id: role.id, name: role.name })}
                                className="py-1 px-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/15 text-blue-400 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                              >
                                Cấu hình quyền
                              </button>
                            )}
                            {hasPermission('USER_DELETE') && (
                              <button 
                                onClick={() => handleDeleteRole(role.id)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/15 rounded-lg transition-colors cursor-pointer"
                                title="Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {!hasPermission('USER_CREATE') && !hasPermission('USER_DELETE') && (
                              <span className="text-gray-500 text-xs italic">Chỉ xem</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Render MODALS conditionally */}
      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} onUpdate={handleProfileUpdate} />
      )}

      {showJobModal && (
        <JobModal job={selectedJob} onClose={() => { setSelectedJob(null); setShowJobModal(false); }} onSave={loadJobs} />
      )}

      {selectedJobLogs && (
        <JobLogsModal jobId={selectedJobLogs.id} jobTitle={selectedJobLogs.title} onClose={() => setSelectedJobLogs(null)} />
      )}

      {showUserModal && (
        <UserModal user={selectedUser} onClose={() => { setSelectedUser(null); setShowUserModal(false); }} onSave={loadUsers} />
      )}

      {showRoleModal && (
        <RoleModal onClose={() => setShowRoleModal(false)} onSave={loadRbac} />
      )}

      {selectedRolePermissions && (
        <RolePermissionsModal roleId={selectedRolePermissions.id} roleName={selectedRolePermissions.name} onClose={() => { setSelectedRolePermissions(null); loadRbac(); }} />
      )}
    </div>
  );
}

export default App;
