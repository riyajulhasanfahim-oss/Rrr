import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { 
  Phone, Mail, MapPin, Clock, Send, CheckCircle2, 
  ArrowLeft, MessageSquare, HeadphonesIcon, HelpCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { rtdbPush } from '../lib/rtdb';
import { useAuth } from '../context/AuthContext';

export default function ContactUsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) {
      toast.error('Please fill in your Name, Phone Number, and Message.');
      return;
    }

    setSubmitting(true);
    try {
      await rtdbPush('customer_inquiries', {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        subject: subject.trim() || 'General Inquiry',
        message: message.trim(),
        userId: user?.uid || null,
        createdAt: Date.now(),
        status: 'pending'
      });

      setSubmitted(true);
      toast.success('Your message has been received! We will contact you shortly.');
      setName('');
      setPhone('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      console.error('Contact submission error:', err);
      toast.error('Failed to submit message. Please call our helpline directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-4 sm:pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6">
          <button 
            type="button"
            onClick={() => navigate(-1)} 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <span>/</span>
          <Link to="/" className="hover:text-primary-main">Home</Link>
          <span>/</span>
          <span className="text-slate-800 font-semibold">Contact Us</span>
        </div>

        {/* Page Title */}
        <div className="mb-6 sm:mb-8 text-center sm:text-left">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800 inline-block mb-2">
            Get in Touch
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Contact RJ WORLD BD
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Have an inquiry about an order, delivery, reseller account, or partnership? We are here to help you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Contact Details Column */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-5">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
                Official Information
              </h2>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 text-primary-main flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Customer Helpline</p>
                  <a href="tel:+8809638969026" className="text-sm font-bold text-slate-900 hover:text-primary-main">
                    +8809638969026
                  </a>
                  <p className="text-[11px] text-slate-500 mt-0.5">Direct phone assistance</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 text-primary-main flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-bold uppercase">Support Email</p>
                  <a href="mailto:support.rjworld@gmail.com" className="text-sm font-bold text-slate-900 hover:text-primary-main break-all block">
                    support.rjworld@gmail.com
                  </a>
                  <p className="text-[11px] text-slate-500 mt-0.5">Quick email response</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 text-primary-main flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Headquarters</p>
                  <p className="text-sm font-bold text-slate-900">Bangladesh</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Nationwide logistics network</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 text-primary-main flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Working Hours</p>
                  <p className="text-sm font-bold text-slate-900">10:00 AM - 10:00 PM</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">7 days a week</p>
                </div>
              </div>
            </div>

            {/* Quick Links Card */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-sky-400" />
                <span>Need Instant Answers?</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Check our Frequently Asked Questions or track your shipment in real time.
              </p>
              <div className="flex gap-2 pt-1">
                <Link to="/faq" className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300">
                  Read FAQs
                </Link>
                <Link to="/track-order" className="px-3 py-1.5 rounded-lg bg-primary-main hover:bg-sky-600 text-xs font-semibold text-white">
                  Track Order
                </Link>
              </div>
            </div>
          </div>

          {/* Contact Form Column */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                Send Us a Message
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-6">
                Fill in the form below and our customer care team will get back to you promptly.
              </p>

              {submitted ? (
                <div className="p-8 text-center rounded-2xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-emerald-900">Message Sent Successfully!</h3>
                  <p className="text-xs sm:text-sm text-emerald-700 mt-1 max-w-md mx-auto">
                    Thank you for reaching out. We have logged your inquiry and our support team will respond via phone or email shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Send Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Mohammad Ali"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-primary-main focus:ring-1 focus:ring-primary-main text-xs sm:text-sm bg-slate-50/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 017xxxxxxxx"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-primary-main focus:ring-1 focus:ring-primary-main text-xs sm:text-sm bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. name@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-primary-main focus:ring-1 focus:ring-primary-main text-xs sm:text-sm bg-slate-50/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Inquiry Subject
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Order Delivery Status / Reseller Query"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-primary-main focus:ring-1 focus:ring-primary-main text-xs sm:text-sm bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Your Message *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Please explain how we can assist you..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-primary-main focus:ring-1 focus:ring-primary-main text-xs sm:text-sm bg-slate-50/50 resize-y"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary-main hover:bg-sky-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submitting ? 'Sending Message...' : 'Submit Message'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
