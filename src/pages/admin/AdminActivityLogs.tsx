import React, { useState, useEffect } from 'react';
import { rtdbList } from '../../lib/rtdb';
import { 
  ClipboardList, Search, Filter, Clock, User, ArrowRight, ShieldAlert 
} from 'lucide-react';
import { format } from 'date-fns';

const formatLogDate = (val: any) => {
  if (!val) return 'Unknown';
  try {
    const d = typeof val === 'number' 
      ? new Date(val) 
      : typeof val === 'string' 
      ? new Date(val) 
      : val.toDate 
      ? val.toDate() 
      : val.seconds 
      ? new Date(val.seconds * 1000) 
      : new Date(val);
    return isNaN(d.getTime()) ? 'Unknown' : format(d, 'MMM dd, yyyy HH:mm:ss');
  } catch {
    return 'Unknown';
  }
};

export default function AdminActivityLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModule, setFilterModule] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const [settingsHistory, activityLogs] = await Promise.all([
        rtdbList<any>('settingsHistory').catch(() => []),
        rtdbList<any>('activity_logs').catch(() => [])
      ]);
      
      const logsData: any[] = [];

      settingsHistory.forEach(({ id, data }) => {
        if (!data) return;
        logsData.push({
          id,
          ...data,
          module: 'Settings',
          action: 'Updated Configuration',
          targetId: data.section || 'General',
          adminName: data.changedBy || 'Admin',
          adminId: data.adminId,
          timestamp: data.timestamp || Date.now()
        });
      });

      activityLogs.forEach(({ id, data }) => {
        if (!data) return;
        logsData.push({
          id,
          ...data,
          module: data.module || 'System',
          action: data.action || 'Activity',
          targetId: data.targetId || '-',
          adminName: data.adminName || data.performedBy || 'System',
          adminId: data.adminId,
          timestamp: data.timestamp || Date.now()
        });
      });

      logsData.sort((a, b) => {
        const timeA = typeof a.timestamp === 'number' ? a.timestamp : a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = typeof b.timestamp === 'number' ? b.timestamp : b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      
      setLogs(logsData);
    } catch (error) {
      console.error("Error fetching activity logs from RTDB:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.adminName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.targetId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesModule = filterModule === 'all' || log.module === filterModule;
    
    return matchesSearch && matchesModule;
  });

  return (
    <div className="max-w-7xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Activity Logs</h1>
          <p className="text-sm text-slate-500 mt-1">Immutable audit trail of administrative actions.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-sm"
            >
              <option value="all">All Modules</option>
              <option value="Settings">Settings</option>
              <option value="Users">Users</option>
              <option value="Products">Products</option>
              <option value="Orders">Orders</option>
              <option value="Financial">Financial</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-blue-800">Immutable Audit Trail</h3>
          <p className="text-xs text-blue-600 mt-1">These records are append-only. They cannot be edited or deleted to ensure complete security and accountability of administrative actions.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main"></div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No logs found</h3>
          <p className="text-slate-500">No activity logs match your current filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Admin</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Module</th>
                  <th className="px-6 py-4">Target / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatLogDate(log.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary-50 text-primary-main flex items-center justify-center font-bold text-xs shrink-0">
                          {log.adminName?.charAt(0) || 'A'}
                        </div>
                        <span className="font-medium text-slate-900">{log.adminName || 'Unknown Admin'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {log.action}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                        {log.module}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <span className="font-medium text-slate-900">{log.targetId}</span>
                        {log.changes && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(log.changes).slice(0, 3).map(([key, value]: any) => (
                              <div key={key} className="flex items-center gap-2 text-xs">
                                <span className="text-slate-500">{key}:</span>
                                <span className="text-slate-400 line-through truncate max-w-[80px]" title={JSON.stringify(value.old)}>
                                  {JSON.stringify(value.old) || 'empty'}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span className="text-emerald-600 font-medium truncate max-w-[80px]" title={JSON.stringify(value.new)}>
                                  {JSON.stringify(value.new)}
                                </span>
                              </div>
                            ))}
                            {Object.keys(log.changes).length > 3 && (
                              <p className="text-xs text-slate-400 italic">+{Object.keys(log.changes).length - 3} more changes</p>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
