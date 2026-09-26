import React, { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { MapPin, ArrowLeft, Plus, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function ShippingAddressPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    title: 'Home',
    fullName: '',
    phone: '',
    street: '',
    city: '',
    zipCode: '',
    isDefault: false
  });

  useEffect(() => {
    fetchAddresses();
  }, [user]);

  const fetchAddresses = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'shippingAddresses'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAddresses(data);
    } catch (e) {
      toast.error('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'shippingAddresses'), {
        userId: user.uid,
        ...formData
      });
      toast.success('Address added');
      setShowForm(false);
      fetchAddresses();
      setFormData({ title: 'Home', fullName: '', phone: '', street: '', city: '', zipCode: '', isDefault: false });
    } catch (e) {
      toast.error('Failed to add address');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteDoc(doc(db, 'shippingAddresses', id));
      toast.success('Address deleted');
      fetchAddresses();
    } catch (e) {
      toast.error('Failed to delete address');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-8 pb-16 px-4 md:px-8 max-w-4xl mx-auto w-full">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Shipping Addresses</h1>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary-main text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-sky-600 transition-colors">
              <Plus className="w-4 h-4" /> Add New
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Full Name</label>
                <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Phone</label>
                <input required type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2 border rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Street Address</label>
              <input required type="text" value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">City</label>
                <input required type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">ZIP Code</label>
                <input required type="text" value={formData.zipCode} onChange={e => setFormData({...formData, zipCode: e.target.value})} className="w-full p-2 border rounded-lg" />
              </div>
            </div>
            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-xl font-semibold">Cancel</button>
              <button type="submit" className="flex-1 py-2 bg-slate-900 text-white rounded-xl font-semibold">Save Address</button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {addresses.map(addr => (
            <div key={addr.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-sky-100 text-primary-main px-2 py-1 rounded text-xs font-bold">{addr.title}</span>
                  <h3 className="font-bold text-slate-800">{addr.fullName}</h3>
                </div>
                <p className="text-slate-600 text-sm">{addr.street}</p>
                <p className="text-slate-600 text-sm">{addr.city}, {addr.zipCode}</p>
                <p className="text-slate-500 text-sm mt-1">{addr.phone}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleDelete(addr.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5"/></button>
              </div>
            </div>
          ))}
          {!loading && addresses.length === 0 && !showForm && (
            <div className="text-center py-12 text-slate-500">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-20" />
              No shipping addresses saved yet.
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
