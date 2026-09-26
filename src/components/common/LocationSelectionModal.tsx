import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, MapPin, Check, Sparkles } from 'lucide-react';
import { BANGLADESH_DISTRICTS } from '../../data/bangladeshDistricts';
import { useLanguage } from './LanguageProvider';

export interface LocationItem {
  id: string;
  name: string;
  en: string;
  bn: string;
  division: string;
}

export interface LocationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocationId: string;
  onSelectLocation: (location: LocationItem) => void;
}

// Popular key cities across Bangladesh
const POPULAR_CITY_IDS = [
  'Dhaka',
  'Chattogram',
  'Gazipur',
  'Narayanganj',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Rangpur',
  'Mymensingh',
  'Cumilla',
  'Cox\'s Bazar'
];

// Pre-computed static lists outside component to avoid re-computation overhead
const ALL_LOCATIONS: LocationItem[] = BANGLADESH_DISTRICTS.map((d) => {
  const en = d.name.split(' (')[0].trim() || d.id;
  const bnMatch = d.name.match(/\((.*?)\)/);
  const bn = bnMatch ? bnMatch[1].trim() : en;
  return {
    id: d.id,
    name: d.name,
    en,
    bn,
    division: d.division
  };
});

const ALL_DIVISIONS: string[] = ['All', ...Array.from(new Set(BANGLADESH_DISTRICTS.map((d) => d.division)))];

const POPULAR_LOCATIONS: LocationItem[] = ALL_LOCATIONS.filter((loc) => POPULAR_CITY_IDS.includes(loc.id));

export default function LocationSelectionModal({
  isOpen,
  onClose,
  selectedLocationId,
  onSelectLocation
}: LocationSelectionModalProps) {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('All');

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll only while open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen]);

  // Filtered districts based on user search & division
  const filteredLocations = useMemo(() => {
    let result = ALL_LOCATIONS;

    if (selectedDivision !== 'All') {
      result = result.filter((loc) => loc.division.toLowerCase() === selectedDivision.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (loc) =>
          loc.id.toLowerCase().includes(q) ||
          loc.en.toLowerCase().includes(q) ||
          loc.bn.toLowerCase().includes(q) ||
          loc.division.toLowerCase().includes(q)
      );
    }

    return result;
  }, [selectedDivision, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-main/10 flex items-center justify-center text-primary-main shrink-0">
              <MapPin className="w-5 h-5 text-primary-main" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {language === 'bn' ? 'ডেলিভারি লোকেশন নির্বাচন করুন' : 'Select Delivery Location'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'bn'
                  ? 'আপনার পণ্য ডেলিভারির জন্য সঠিক শহর বা জেলা নির্বাচন করুন'
                  : 'Choose your preferred city or district in Bangladesh'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Popular Area */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white shrink-0 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'bn'
                  ? 'শহর বা জেলা খুঁজুন (যেমন: ঢাকা, সিলেট, গাজীপুর)...'
                  : 'Search city or district (e.g. Dhaka, Sylhet, Gazipur)...'
              }
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-main focus:bg-white transition-all text-slate-800"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Popular Cities */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === 'bn' ? 'জনপ্রিয় শহরসমূহ' : 'Popular Cities'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_LOCATIONS.map((item) => {
                const isSelected = selectedLocationId.toLowerCase() === item.id.toLowerCase();
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectLocation(item);
                      onClose();
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-primary-main text-white border-primary-main shadow-2xs font-semibold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span>{language === 'bn' ? item.bn : item.en}</span>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Division Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none pt-1">
            {ALL_DIVISIONS.map((div) => {
              const isTabActive = selectedDivision === div;
              let label = div;
              if (div === 'All') {
                label = language === 'bn' ? 'সকল বিভাগ' : 'All Divisions';
              } else if (language === 'bn') {
                const banglaDivs: Record<string, string> = {
                  Dhaka: 'ঢাকা',
                  Chattogram: 'চট্টগ্রাম',
                  Rajshahi: 'রাজশাহী',
                  Khulna: 'খুলনা',
                  Barishal: 'বরিশাল',
                  Sylhet: 'সিলেট',
                  Rangpur: 'রংপুর',
                  Mymensingh: 'ময়মনসিংহ'
                };
                label = banglaDivs[div] || div;
              }

              return (
                <button
                  key={div}
                  type="button"
                  onClick={() => setSelectedDivision(div)}
                  className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-colors cursor-pointer shrink-0 ${
                    isTabActive
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Districts Grid / List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 max-h-[380px]">
          {filteredLocations.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">
                {language === 'bn' ? 'কোনো লোকেশন পাওয়া যায়নি' : 'No locations found'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'bn' ? 'বানান পরীক্ষা করুন বা অন্য নাম লিখুন' : 'Check your spelling or try another term'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredLocations.map((item) => {
                const isSelected = selectedLocationId.toLowerCase() === item.id.toLowerCase();
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectLocation(item);
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer group ${
                      isSelected
                        ? 'bg-sky-50/70 border-primary-main shadow-2xs'
                        : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-primary-main text-white'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        }`}
                      >
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {language === 'bn' ? item.bn : item.en}
                          <span className="text-xs text-slate-400 font-normal ml-1.5">
                            ({language === 'bn' ? item.en : item.bn})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {item.division} {language === 'bn' ? 'বিভাগ' : 'Division'}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary-main text-white flex items-center justify-center shrink-0 ml-2">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-400">{language === 'bn' ? 'বর্তমান লোকেশন:' : 'Current Location:'}</span>
            <span className="font-bold text-slate-800">
              {(() => {
                const found = ALL_LOCATIONS.find(
                  (l) => l.id.toLowerCase() === selectedLocationId.toLowerCase()
                );
                if (found) {
                  return language === 'bn' ? found.bn : found.en;
                }
                return selectedLocationId;
              })()}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-lg transition-colors cursor-pointer"
          >
            {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
