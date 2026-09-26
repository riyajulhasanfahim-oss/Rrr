import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { uploadImageToDrive, authenticateGoogleDrive, getAccessToken } from '../../services/googleDriveService';
import toast from 'react-hot-toast';

interface DriveImageUploadProps {
  value?: string;
  onChange: (url: string, driveFileId?: string) => void;
  label?: string;
  className?: string;
}

export default function DriveImageUpload({ value, onChange, label = 'Image', className = '' }: DriveImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(!!getAccessToken());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleConnect = async () => {
    const token = await authenticateGoogleDrive();
    if (token) {
      setIsConnected(true);
      toast.success('Connected to Google Drive');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setIsUploading(true);
    // Fake progress
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 10, 90));
    }, 200);

    try {
      const result = await uploadImageToDrive(file);
      if (result) {
        onChange(result.viewUrl, result.fileId);
        toast.success('Image uploaded to Google Drive successfully');
      }
    } finally {
      clearInterval(progressInterval);
      setProgress(0);
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onChange('', '');
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      
      {!isConnected ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
            <LinkIcon className="w-6 h-6 text-blue-500" />
          </div>
          <p className="text-sm text-slate-600 mb-4">Connect Google Drive to upload images</p>
          <button
            type="button"
            onClick={handleConnect}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Connect Drive
          </button>
        </div>
      ) : (
        <div className="relative">
          {value ? (
            <div className="relative rounded-xl border border-slate-200 overflow-hidden group">
              <div className="aspect-video bg-slate-50 flex items-center justify-center overflow-hidden">
                <img src={value} alt="Uploaded preview" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 bg-white rounded-full text-slate-700 hover:text-blue-600 transition-colors"
                  title="Replace Image"
                >
                  <Upload className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-2 bg-white rounded-full text-slate-700 hover:text-red-600 transition-colors"
                  title="Remove Image"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
            >
              {isUploading ? (
                <div className="py-4">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-600 font-medium">Uploading to Drive... {progress}%</p>
                  <div className="w-48 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-500">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Click to upload from Drive</p>
                  <p className="text-xs text-slate-500">JPG, PNG, WEBP up to 5MB</p>
                  <div className="mt-3 flex items-center justify-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 w-fit mx-auto px-2 py-1 rounded">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Drive Connected
                  </div>
                </div>
              )}
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
