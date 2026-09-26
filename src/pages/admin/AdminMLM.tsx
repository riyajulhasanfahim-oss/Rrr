import React, { useEffect, useState } from 'react';
import { rtdbList } from '../../lib/rtdb';
import { Search, Filter, Network, ChevronRight, ChevronDown, User, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const formatDateSafe = (val: any) => {
  if (!val) return 'N/A';
  try {
    const d = typeof val === 'number' ? new Date(val) : typeof val === 'string' ? new Date(val) : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return isNaN(d.getTime()) ? 'N/A' : format(d, 'MMM d, yyyy');
  } catch {
    return 'N/A';
  }
};

export default function AdminMLM() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMLMMembers();
  }, []);

  const fetchMLMMembers = async () => {
    try {
      setLoading(true);
      const memberMap = new Map<string, any>();

      // 1. Fetch from RTDB mlm_members
      const rtdbMlm = await rtdbList<any>('mlm_members').catch(() => []);
      rtdbMlm.forEach(({ id, data }) => {
        if (id && data) {
          memberMap.set(id, { id, ...data });
        }
      });

      // 2. Also check RTDB users who have sponsorId or referral / team info
      try {
        const rtdbUsers = await rtdbList<any>('users').catch(() => []);
        rtdbUsers.forEach(({ id, data }) => {
          if (!id || !data) return;
          if (data.sponsorId || data.referrerId || data.isMLM || data.mlmStatus || memberMap.has(id)) {
            const existing = memberMap.get(id) || {};
            memberMap.set(id, {
              id,
              name: data.displayName || data.name || data.fullName || existing.name || 'Member ' + id.substring(0, 5),
              sponsorId: data.sponsorId || data.referrerId || existing.sponsorId || null,
              level: data.mlmLevel || existing.level || 1,
              personalSales: data.personalSales || existing.personalSales || 0,
              teamSales: data.teamSales || existing.teamSales || 0,
              joinDate: data.createdAt || existing.joinDate || Date.now(),
              status: data.status || existing.status || 'Active',
              ...existing
            });
          }
        });
      } catch (err) {
        console.warn('Error fetching users for MLM in RTDB:', err);
      }

      const membersData = Array.from(memberMap.values()).sort((a, b) => {
        const dateA = a.joinDate ? (typeof a.joinDate === 'number' ? a.joinDate : new Date(a.joinDate).getTime()) : 0;
        const dateB = b.joinDate ? (typeof b.joinDate === 'number' ? b.joinDate : new Date(b.joinDate).getTime()) : 0;
        return dateB - dateA;
      });

      setMembers(membersData);
    } catch (error) {
      console.error('Error fetching MLM members:', error);
      toast.error('Failed to load MLM members');
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (membersList: any[]) => {
    const rootMembers = membersList.filter(m => !m.sponsorId);
    
    const getChildren = (parentId: string) => {
      return membersList.filter(m => m.sponsorId === parentId);
    };

    const renderNode = (node: any, depth = 0) => {
      const children = getChildren(node.id);
      const isExpanded = expandedNodes.has(node.id);
      const hasChildren = children.length > 0;

      return (
        <div key={node.id} className="w-full">
          <div 
            className={`flex items-center p-3 hover:bg-slate-50 border-b border-slate-50 transition-colors \${depth === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
            style={{ paddingLeft: `\${depth * 24 + 16}px` }}
          >
            <div className="flex items-center gap-2 w-64">
              {hasChildren ? (
                <button 
                  onClick={() => toggleNode(node.id)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              ) : (
                <div className="w-6 h-6"></div>
              )}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold \${depth === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                  {node.name?.charAt(0) || <User className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm truncate w-32">{node.name}</p>
                  <p className="text-xs text-slate-500">ID: {node.id.substring(0, 8)}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-4 gap-4 px-4">
              <div className="text-sm">
                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                  Level {node.level || (depth + 1)}
                </span>
              </div>
              <div className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> {node.personalSales || 0}
              </div>
              <div className="text-sm font-medium text-indigo-600 flex items-center gap-1">
                <Network className="w-3.5 h-3.5" /> {node.teamSales || 0}
              </div>
              <div className="text-sm text-slate-500">
                {formatDateSafe(node.joinDate)}
              </div>
            </div>
            
            <div className="w-24 text-right">
              <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase \${node.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {node.status || 'Active'}
              </span>
            </div>
          </div>
          
          {isExpanded && hasChildren && (
            <div className="w-full">
              {children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return rootMembers.map(root => renderNode(root, 0));
  };

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const filteredMembers = searchTerm 
    ? members.filter(m => m.name?.toLowerCase().includes(searchTerm.toLowerCase()) || m.id?.toLowerCase().includes(searchTerm.toLowerCase()))
    : members;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leadership Network</h1>
          <p className="text-sm text-slate-500 mt-1">Manage multi-level marketing hierarchy and teams.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Network Size</p>
            <p className="text-2xl font-bold text-slate-900">{members.length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Active Members</p>
            <p className="text-2xl font-bold text-slate-900">{members.filter(m => m.status === 'Active' || !m.status).length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 shrink-0">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search member by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors w-full sm:w-auto">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        <div className="flex text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-200 p-3 shrink-0">
          <div className="w-64 pl-4">Member</div>
          <div className="flex-1 grid grid-cols-4 gap-4 px-4">
            <div>Level</div>
            <div>Personal Sales</div>
            <div>Team Sales</div>
            <div>Join Date</div>
          </div>
          <div className="w-24 text-right pr-4">Status</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main"></div>
            </div>
          ) : members.length === 0 ? (
            <div className="flex justify-center items-center h-full text-slate-500">
              No leadership network members found.
            </div>
          ) : searchTerm ? (
            <div>
              {filteredMembers.map(member => (
                <div key={member.id} className="flex items-center p-3 border-b border-slate-100 hover:bg-slate-50 pl-4">
                  <div className="flex items-center gap-2 w-64">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                      {member.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm truncate w-40">{member.name}</p>
                      <p className="text-xs text-slate-500">Sponsor: {member.sponsorId ? member.sponsorId.substring(0,8) : 'None'}</p>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-4 gap-4 px-4">
                    <div className="text-sm text-slate-600">Level {member.level || 1}</div>
                    <div className="text-sm font-medium text-emerald-600">৳{member.personalSales || 0}</div>
                    <div className="text-sm font-medium text-indigo-600">৳{member.teamSales || 0}</div>
                    <div className="text-sm text-slate-500">{formatDateSafe(member.joinDate)}</div>
                  </div>
                  <div className="w-24 text-right pr-4">
                    <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">
                      {member.status || 'Active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {buildTree(members)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
