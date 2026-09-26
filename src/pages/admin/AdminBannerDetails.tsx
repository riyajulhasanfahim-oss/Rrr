import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { rtdbGet } from '../../lib/rtdb';
import { ArrowLeft, Image as ImageIcon, CheckCircle, XCircle, Clock, Calendar, AlertTriangle, Link as LinkIcon, AlignLeft } from 'lucide-react';
import { format, isBefore, isAfter, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminBannerDetails() {
  const { id } = useParams();
  const [banner, setBanner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchBannerDetails();
    }
  }, [id]);

  const fetchBannerDetails = async () => {
    try {
      setLoading(true);
      const data = await rtdbGet<any>(`banners/${id}`);
      if (data) {
        setBanner({ id, ...data });
      }
    } catch (error) {
      console.error('Error fetching banner details from RTDB:', error);
      toast.error('Failed to load banner data');
    } finally {
      setLoading(false);
    }
  };

  const formatDateVal = (val: any) => {
    if (!val) return 'N/A';
    try {
      if (typeof val === 'number') return format(new Date(val), 'PP');
      if (typeof val === 'string') return format(new Date(val), 'PP');
      if (val?.seconds) return format(new Date(val.seconds * 1000), 'PP');
      if (val?.toDate) return format(val.toDate(), 'PP');
    } catch (e) {
      return 'N/A';
    }
    return 'N/A';
  };

  const getComputedStatus = (b: any) => {
    if (!b.active) return 'Inactive';
    
    const now = new Date();
    if (b.startDate && isBefore(now, parseISO(b.startDate))) {
      return 'Scheduled';
    }
    if (b.endDate && isAfter(now, parseISO(b.endDate))) {
      return 'Expired';
    }
    return 'Active';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main"></div>
      </div>
    );
  }

  if (!banner) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Banner not found.</p>
        <Link to="/admin/banners" className="text-primary-main hover:underline mt-2 inline-block">Back to Banners</Link>
      </div>
    );
  }

  const computedStatus = getComputedStatus(banner);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      <div className="flex items-center gap-4">
        <Link to="/admin/banners" className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Banner Details</h1>
          <p className="text-sm text-slate-500">View detailed information about this banner.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Banner Image Header */}
        <div className="relative h-64 w-full bg-slate-100">
          {banner.image ? (
            <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              <ImageIcon className="w-16 h-16 opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <h2 className="text-3xl font-bold mb-2">{banner.title}</h2>
            <p className="text-slate-200 max-w-2xl">{banner.subtitle}</p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlignLeft className="w-4 h-4 text-slate-400" /> Basic Information
              </h3>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <span className="text-sm text-slate-500">Banner ID</span>
                  <span className="text-sm font-mono text-slate-900 bg-white px-2 py-1 rounded border border-slate-200">{banner.id}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <span className="text-sm text-slate-500">Display Order</span>
                  <span className="text-sm font-bold text-slate-900">{banner.order}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <span className="text-sm text-slate-500">Text Alignment</span>
                  <span className="text-sm font-medium text-slate-900 capitalize">{banner.align}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Current Status</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                    computedStatus === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
                    computedStatus === 'Scheduled' ? 'bg-blue-100 text-blue-700' :
                    computedStatus === 'Expired' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {computedStatus === 'Active' && <CheckCircle className="w-3.5 h-3.5" />}
                    {computedStatus === 'Scheduled' && <Clock className="w-3.5 h-3.5" />}
                    {computedStatus === 'Expired' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {computedStatus === 'Inactive' && <XCircle className="w-3.5 h-3.5" />}
                    {computedStatus}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-slate-400" /> Action (CTA)
              </h3>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                <div>
                  <span className="block text-xs text-slate-500 mb-1">Button Text</span>
                  <span className="text-sm font-medium text-slate-900">{banner.ctaText || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 mb-1">Target Link/Route</span>
                  <div className="bg-white p-2 rounded border border-slate-200 text-sm font-mono text-blue-600 break-all">
                    {banner.ctaLink || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" /> Schedule & Timing
              </h3>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <span className="text-sm text-slate-500">Start Date</span>
                  <span className="text-sm font-medium text-slate-900">
                    {banner.startDate ? format(parseISO(banner.startDate), 'PPpp') : 'Immediately'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <span className="text-sm text-slate-500">End Date</span>
                  <span className="text-sm font-medium text-slate-900">
                    {banner.endDate ? format(parseISO(banner.endDate), 'PPpp') : 'Never (Manual)'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <span className="text-sm text-slate-500">Created At</span>
                  <span className="text-sm font-medium text-slate-900">
                    {formatDateVal(banner.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Last Updated</span>
                  <span className="text-sm font-medium text-slate-900">
                    {formatDateVal(banner.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h4 className="text-sm font-bold text-blue-900 mb-2">Admin Notes</h4>
              <p className="text-xs text-blue-800 leading-relaxed">
                This banner is currently <strong className="lowercase">{computedStatus}</strong>. 
                {computedStatus === 'Scheduled' && ' It will automatically become active on the start date.'}
                {computedStatus === 'Expired' && ' It is no longer visible to users as the end date has passed.'}
                {computedStatus === 'Active' && ' It is visible to users on the homepage.'}
                {computedStatus === 'Inactive' && ' It is manually disabled and hidden from users.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
