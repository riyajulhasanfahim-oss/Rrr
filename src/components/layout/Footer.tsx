import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { useLanguage } from '../common/LanguageProvider';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-slate-900 text-slate-300 pt-8 pb-16 md:pb-6 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
          
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              RJ <span className="text-primary-main">WORLD BD</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
              {t('Your one-stop destination for premium products. Experience the best shopping journey with us.')}
            </p>
            <div className="flex space-x-2.5 pt-1">
              <a href="#" aria-label="Facebook" className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary-main hover:text-white transition-colors text-slate-300">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="#" aria-label="Twitter" className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary-main hover:text-white transition-colors text-slate-300">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" aria-label="Instagram" className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary-main hover:text-white transition-colors text-slate-300">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" aria-label="Youtube" className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary-main hover:text-white transition-colors text-slate-300">
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-span-1">
            <h3 className="text-sm sm:text-base font-bold text-white mb-2.5">{t('Quick Links')}</h3>
            <ul className="space-y-1.5 text-xs sm:text-sm">
              <li><Link to="/about" className="text-slate-400 hover:text-primary-main transition-colors">{t('About Us')}</Link></li>
              <li><Link to="/contact" className="text-slate-400 hover:text-primary-main transition-colors">{t('Contact Us')}</Link></li>
              <li><Link to="/products" className="text-slate-400 hover:text-primary-main transition-colors">{t('All Products')}</Link></li>
              <li><Link to="/faq" className="text-slate-400 hover:text-primary-main transition-colors">{t('FAQ')}</Link></li>
              <li><Link to="/blog" className="text-slate-400 hover:text-primary-main transition-colors">{t('Blog')}</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="col-span-1">
            <h3 className="text-sm sm:text-base font-bold text-white mb-2.5">{t('Customer Service')}</h3>
            <ul className="space-y-1.5 text-xs sm:text-sm">
              <li><Link to="/account" className="text-slate-400 hover:text-primary-main transition-colors">{t('My Account')}</Link></li>
              <li><Link to="/track-order" className="text-slate-400 hover:text-primary-main transition-colors">{t('Track Order')}</Link></li>
              <li><Link to="/returns" className="text-slate-400 hover:text-primary-main transition-colors">{t('Returns & Exchanges')}</Link></li>
              <li><Link to="/shipping" className="text-slate-400 hover:text-primary-main transition-colors">{t('Shipping Info')}</Link></li>
              <li><Link to="/privacy" className="text-slate-400 hover:text-primary-main transition-colors">{t('Privacy Policy')}</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="col-span-2 sm:col-span-1 md:col-span-1">
            <h3 className="text-sm sm:text-base font-bold text-white mb-2.5">{t('Contact Info')}</h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
              <li className="flex items-center">
                <MapPin className="h-4 w-4 text-primary-main mr-2.5 shrink-0" />
                <span>{t('Bangladesh')}</span>
              </li>
              <li className="flex items-center">
                <Phone className="h-4 w-4 text-primary-main mr-2.5 shrink-0" />
                <a href="tel:+8809638969026" className="hover:text-white transition-colors">+8809638969026</a>
              </li>
              <li className="flex items-center">
                <Mail className="h-4 w-4 text-primary-main mr-2.5 shrink-0" />
                <a href="mailto:support.rjworld@gmail.com" className="break-all hover:text-white transition-colors">support.rjworld@gmail.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            &copy; {new Date().getFullYear()} RJ WORLD BD. {t('All rights reserved.')}
          </p>
          <div className="flex space-x-3 text-xs">
            <Link to="/terms" className="text-slate-500 hover:text-white transition-colors">{t('Terms of Service')}</Link>
            <span className="text-slate-700">|</span>
            <Link to="/privacy" className="text-slate-500 hover:text-white transition-colors">{t('Privacy Policy')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
