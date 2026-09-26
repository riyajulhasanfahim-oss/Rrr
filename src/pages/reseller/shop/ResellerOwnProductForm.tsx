import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Video } from 'lucide-react';
import { db, storage } from '../../../lib/firebase';
import { X, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ResellerOwnProductFormProps {
  resellerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ResellerOwnProductForm({ resellerId, onClose, onSuccess }: ResellerOwnProductFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    discountPrice: '',
    stock: '',
    category: '',
    brand: '',
    sku: '',
  });
  const [image1, setImage1] = useState('');
  const [image2, setImage2] = useState('');
  const [image3, setImage3] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const id = extractYoutubeId(url);
    return id ? `https://www.youtube.com/embed/${id}` : url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !image1) {
      toast.error('Please fill required fields and provide at least Image 1 URL.');
      return;
    }

    setLoading(true);
    try {
      // Create product document first
      const productData = {
        resellerId,
        source: 'reseller',
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        discountPrice: formData.discountPrice ? Number(formData.discountPrice) : null,
        stock: Number(formData.stock),
        category: formData.category,
        brand: formData.brand,
        sku: formData.sku,
        status: 'active',
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'products'), productData);

      const images = [image1, image2, image3].filter(url => url.trim() !== '');
      let finalVideoUrl = videoUrl.trim();
      if (finalVideoUrl) {
        finalVideoUrl = getYoutubeEmbedUrl(finalVideoUrl);
      }
      await updateDoc(docRef, {
        featuredImage: images[0],
        images: images,
        image: images[0],
        videoUrl: finalVideoUrl || null,
      });

      toast.success('Product uploaded successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error uploading product:', error);
      toast.error('Failed to upload product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold">Add My Own Product</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Images */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Product Images</label>
            {[
              { label: 'Image 1 URL *', value: image1, setter: setImage1, required: true },
              { label: 'Image 2 URL', value: image2, setter: setImage2, required: false },
              { label: 'Image 3 URL', value: image3, setter: setImage3, required: false },
            ].map((img, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <div className="flex-1">
                  <input
                    type="url"
                    placeholder="Paste direct image URL"
                    value={img.value}
                    onChange={(e) => img.setter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required={img.required}
                  />
                </div>
                {img.value && (
                  <div className="relative w-16 h-16 rounded-lg border border-gray-200 overflow-hidden shrink-0 bg-gray-50">
                    <img src={img.value} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = 'https://placehold.co/100x100?text=Error')} />
                    <button
                      type="button"
                      onClick={() => img.setter('')}
                      className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Video */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Video className="w-4 h-4 text-red-500" /> YouTube Video URL
            </label>
            <input
              type="url"
              placeholder="Paste YouTube video link (e.g. https://youtu.be/...)"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
              <input required type="text" className="w-full p-2 border rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input type="text" className="w-full p-2 border rounded-lg" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (৳) *</label>
              <input required type="number" min="0" className="w-full p-2 border rounded-lg" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Price (৳)</label>
              <input type="number" min="0" className="w-full p-2 border rounded-lg" value={formData.discountPrice} onChange={e => setFormData({...formData, discountPrice: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
              <input type="number" min="0" className="w-full p-2 border rounded-lg" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input type="text" className="w-full p-2 border rounded-lg" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input type="text" className="w-full p-2 border rounded-lg" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={4} className="w-full p-2 border rounded-lg" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" disabled={loading} className="px-6 py-2 bg-primary-main text-white font-medium rounded-xl flex items-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Publish Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
