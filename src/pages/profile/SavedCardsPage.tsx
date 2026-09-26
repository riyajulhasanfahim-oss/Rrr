import React, { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { CreditCard, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function SavedCardsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvv: ''
  });

  useEffect(() => {
    fetchCards();
  }, [user]);

  const fetchCards = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'saved_cards'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCards(data);
    } catch (e) {
      toast.error('Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Simple validation
    if (formData.cardNumber.length < 15) {
      toast.error("Invalid card number");
      return;
    }

    try {
      // In a real app, you would tokenize this with Stripe, never save raw card details.
      // Since this is a demo, we will only save the last 4 digits.
      await addDoc(collection(db, 'saved_cards'), {
        userId: user.uid,
        cardName: formData.cardName,
        last4: formData.cardNumber.slice(-4),
        expiry: formData.expiry
      });
      toast.success('Card added successfully');
      setShowForm(false);
      fetchCards();
      setFormData({ cardName: '', cardNumber: '', expiry: '', cvv: '' });
    } catch (e) {
      toast.error('Failed to add card');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteDoc(doc(db, 'saved_cards', id));
      toast.success('Card removed');
      fetchCards();
    } catch (e) {
      toast.error('Failed to remove card');
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
          <h1 className="text-2xl font-bold text-slate-900">Saved Cards</h1>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary-main text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-sky-600 transition-colors">
              <Plus className="w-4 h-4" /> Add Card
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6 space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Name on Card</label>
              <input required type="text" value={formData.cardName} onChange={e => setFormData({...formData, cardName: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Card Number</label>
              <input required type="text" value={formData.cardNumber} onChange={e => setFormData({...formData, cardNumber: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="**** **** **** ****" maxLength={19} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Expiry Date</label>
                <input required type="text" value={formData.expiry} onChange={e => setFormData({...formData, expiry: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="MM/YY" maxLength={5} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">CVV</label>
                <input required type="password" value={formData.cvv} onChange={e => setFormData({...formData, cvv: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="***" maxLength={4} />
              </div>
            </div>
            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-xl font-semibold">Cancel</button>
              <button type="submit" className="flex-1 py-2 bg-slate-900 text-white rounded-xl font-semibold">Save Card</button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map(card => (
            <div key={card.id} className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <CreditCard className="w-24 h-24" />
              </div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-8">
                  <span className="font-bold tracking-wider text-xl">VISA</span>
                  <button onClick={() => handleDelete(card.id)} className="text-white/50 hover:text-white transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Card Number</p>
                  <p className="text-xl tracking-[0.2em] font-mono mb-4">**** **** **** {card.last4}</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Card Holder</p>
                      <p className="font-semibold">{card.cardName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Expires</p>
                      <p className="font-semibold">{card.expiry}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!loading && cards.length === 0 && !showForm && (
            <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-100">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20" />
              No saved cards. Add one for faster checkout.
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
