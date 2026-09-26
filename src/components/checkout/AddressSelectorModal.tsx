import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Check, ChevronDown, ChevronRight, MapPin, Building2, Compass, Layers } from 'lucide-react';
import { 
  BANGLADESH_DISTRICTS, 
  getDistrictById,
  type Upazila,
  type District
} from '../../data/bangladeshDistricts';

export interface SelectedAddressLocation {
  district: string;
  upazila: string;
}

interface AddressSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: SelectedAddressLocation;
  onSelect: (location: SelectedAddressLocation) => void;
}

// Bengali & English text normalizer to handle phonetic spelling, nukta variations (য vs য়, ড vs ড়, etc.), and punctuation
function normalizeSearchText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFC')
    .replace(/\u09AF\u09BC/g, '\u09DF') // য + nukta -> য়
    .replace(/\u09A1\u09BC/g, '\u09DC') // ড + nukta -> ড়
    .replace(/\u09A2\u09BC/g, '\u09DD') // ঢ + nukta -> ঢ়
    .replace(/['"’`\-\/\\,.]/g, '')     // remove punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Known legacy/phonetic aliases for districts
const DISTRICT_ALIASES: Record<string, string> = {
  'Chattogram': 'chittagong chattagram ctg বন্দরনগরী',
  'Bogura': 'bogra বগুড়া',
  'Cumilla': 'comilla',
  'Jashore': 'jessore',
  'Barishal': 'barisal',
  'Netrokona': 'netrakona নেত্রকোনা',
  'Moulvibazar': 'maulvibazar',
  'Chapai Nawabganj': 'chapainawabganj চাঁপাই চাঁপাইনবাবগঞ্জ nawabganj',
  "Coxs Bazar": 'cox coxs coxsbazar coxs bazar কক্স'
};

export const AddressSelectorModal: React.FC<AddressSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedLocation,
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDistricts, setExpandedDistricts] = useState<Record<string, boolean>>({});
  const listContainerRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef<boolean>(false);

  // Alphabetically sorted districts (A to Z)
  const sortedDistricts = useMemo(() => {
    return [...BANGLADESH_DISTRICTS].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Sync initial state when modal opens: automatically expand the user's currently selected district
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setSearchQuery('');
      const currentDist = selectedLocation?.district ? getDistrictById(selectedLocation.district) : undefined;
      if (currentDist) {
        setExpandedDistricts({ [currentDist.id]: true });
      } else {
        setExpandedDistricts({});
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, selectedLocation?.district]);

  // When searching, auto-expand any district that matches or has matching thanas
  useEffect(() => {
    const normQ = normalizeSearchText(searchQuery);
    if (normQ) {
      const nextExpanded: Record<string, boolean> = {};
      sortedDistricts.forEach(d => {
        const extraAliases = DISTRICT_ALIASES[d.id] || '';
        const distFullText = normalizeSearchText(`${d.name} ${d.id} ${d.division} ${extraAliases}`);
        const distMatches = distFullText.includes(normQ);
        const hasMatchingThana = d.upazilas.some(u => 
          normalizeSearchText(`${u.name} ${u.id}`).includes(normQ)
        );
        if (distMatches || hasMatchingThana) {
          nextExpanded[d.id] = true;
        }
      });
      setExpandedDistricts(nextExpanded);
    }
  }, [searchQuery, sortedDistricts]);

  // Filter districts and their thanas based on search query
  const filteredDistrictsWithThanas = useMemo(() => {
    const normQ = normalizeSearchText(searchQuery);
    if (!normQ) {
      return sortedDistricts.map(d => ({
        district: d,
        matchingUpazilas: d.upazilas,
        isDirectDistrictMatch: true
      }));
    }

    const results: Array<{ district: District; matchingUpazilas: Upazila[]; isDirectDistrictMatch: boolean }> = [];

    for (const d of sortedDistricts) {
      const extraAliases = DISTRICT_ALIASES[d.id] || '';
      const distFullText = normalizeSearchText(`${d.name} ${d.id} ${d.division} ${extraAliases}`);
      const districtMatches = distFullText.includes(normQ);

      const matchingUpazilas = d.upazilas.filter(u => 
        normalizeSearchText(`${u.name} ${u.id}`).includes(normQ)
      );

      // If district matches, show all its upazilas
      if (districtMatches) {
        results.push({
          district: d,
          matchingUpazilas: d.upazilas,
          isDirectDistrictMatch: true
        });
      } else if (matchingUpazilas.length > 0) {
        // If only specific thanas match, show this district with its matching thanas
        results.push({
          district: d,
          matchingUpazilas: matchingUpazilas,
          isDirectDistrictMatch: false
        });
      }
    }

    return results;
  }, [sortedDistricts, searchQuery]);

  // Toggle single district expand/collapse
  const toggleDistrict = (districtId: string) => {
    setExpandedDistricts(prev => ({
      ...prev,
      [districtId]: !prev[districtId]
    }));
  };

  // Expand all or collapse all districts
  const allExpanded = useMemo(() => {
    if (filteredDistrictsWithThanas.length === 0) return false;
    return filteredDistrictsWithThanas.every(item => expandedDistricts[item.district.id]);
  }, [filteredDistrictsWithThanas, expandedDistricts]);

  const toggleExpandAll = () => {
    const nextState = !allExpanded;
    const nextMap: Record<string, boolean> = {};
    filteredDistrictsWithThanas.forEach(item => {
      nextMap[item.district.id] = nextState;
    });
    setExpandedDistricts(nextMap);
  };

  // Handle selecting a thana under a district
  const handleSelectThana = (districtId: string, upazilaId: string) => {
    onSelect({
      district: districtId,
      upazila: upazilaId,
    });
    onClose();
  };

  if (!isOpen) return null;

  const currentDistObj = selectedLocation?.district ? getDistrictById(selectedLocation.district) : undefined;
  const currentDistrictName = currentDistObj ? currentDistObj.name : selectedLocation?.district;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity p-0 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="w-full sm:max-w-md md:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative border-b border-gray-100 px-4 py-3.5 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                জেলা ও থানা নির্বাচন
              </h2>
              <p className="text-[11px] text-gray-500">
                যেকোনো জেলা ক্লিক করে তার অধীনে থাকা সকল থানা দেখুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Currently Selected Location Info (if any) */}
        {selectedLocation?.district && (
          <div className="px-4 py-2 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-1.5 text-sky-900 truncate">
              <Building2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="truncate">
                বর্তমান ঠিকানা: <strong className="font-bold">{currentDistrictName}</strong>
                {selectedLocation.upazila ? ` → ${selectedLocation.upazila}` : ''}
              </span>
            </div>
            {selectedLocation.upazila && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0 ml-1">
                সিলেক্টেড
              </span>
            )}
          </div>
        )}

        {/* Search Bar */}
        <div className="px-3.5 py-2.5 bg-white border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="জেলা বা থানার নাম লিখুন (যেমন: কক্সবাজার, উখিয়া, চট্টগ্রাম, মিরপুর)..."
              className="w-full pl-9 pr-8 py-2.5 bg-gray-50 hover:bg-gray-100/60 focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder-gray-400 transition-colors"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Sub-header with Expand/Collapse toggle */}
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 px-0.5">
            <span>
              {searchQuery ? (
                <>ফলাফল: <strong>{filteredDistrictsWithThanas.length}টি জেলা</strong></>
              ) : (
                <>সকল <strong>৬৪টি জেলা ও থানা</strong></>
              )}
            </span>
            <button
              type="button"
              onClick={toggleExpandAll}
              className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 font-medium hover:underline cursor-pointer"
            >
              <Layers className="w-3 h-3" />
              <span>{allExpanded ? 'সবগুলো বন্ধ করুন' : 'সবগুলো খুলুন'}</span>
            </button>
          </div>
        </div>

        {/* Districts and Thanas List */}
        <div ref={listContainerRef} className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
          {filteredDistrictsWithThanas.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500 space-y-2">
              <Compass className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="font-semibold text-gray-700 text-sm">
                "{searchQuery}" নামে কোনো জেলা বা থানা পাওয়া যায়নি
              </p>
              <p className="text-[11px] text-gray-400">
                বানান সঠিক আছে কিনা চেক করুন অথবা সার্চ বক্স খালি করে স্ক্রল করুন
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg font-semibold text-xs hover:bg-sky-100 transition-colors cursor-pointer"
              >
                সকল জেলা দেখুন
              </button>
            </div>
          ) : (
            filteredDistrictsWithThanas.map(({ district, matchingUpazilas }) => {
              const isExpanded = !!expandedDistricts[district.id];
              const isDistrictSelected = selectedLocation?.district === district.id;

              return (
                <div 
                  key={district.id}
                  className={`border rounded-xl transition-all duration-150 overflow-hidden ${
                    isDistrictSelected 
                      ? 'border-sky-300 bg-white shadow-2xs ring-1 ring-sky-200' 
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {/* District Header Card (Clicking expands/collapses its thanas) */}
                  <div
                    onClick={() => toggleDistrict(district.id)}
                    className={`w-full py-2.5 px-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isExpanded 
                        ? 'bg-gray-50/90 border-b border-gray-100' 
                        : 'bg-white hover:bg-gray-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isDistrictSelected ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className={`text-xs sm:text-sm block truncate ${
                          isDistrictSelected ? 'font-bold text-sky-900' : 'font-semibold text-gray-900'
                        }`}>
                          {district.name}
                        </span>
                        <span className="text-[10px] text-gray-400 block truncate">
                          {district.division} বিভাগ
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                        {district.upazilas.length}টি থানা
                      </span>
                      <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-sky-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Thanas of this District (Directly Under the District) */}
                  {isExpanded && (
                    <div className="p-2 bg-slate-50/50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {matchingUpazilas.map((u) => {
                          const isThanaSelected = isDistrictSelected && (
                            selectedLocation?.upazila === u.id || 
                            selectedLocation?.upazila === u.name
                          );

                          return (
                            <button
                              key={`${district.id}-${u.id}`}
                              type="button"
                              onClick={() => handleSelectThana(district.id, u.id)}
                              className={`w-full text-left py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-between cursor-pointer border ${
                                isThanaSelected
                                  ? 'bg-sky-50 text-sky-900 font-bold border-sky-400 shadow-2xs'
                                  : 'bg-white text-gray-700 hover:bg-sky-50/60 hover:text-sky-800 border-gray-200/80 hover:border-sky-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-1">
                                <Compass className={`w-3.5 h-3.5 shrink-0 ${
                                  isThanaSelected ? 'text-sky-600' : 'text-gray-400'
                                }`} />
                                <span className="truncate">{u.name}</span>
                              </div>
                              {isThanaSelected ? (
                                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <span className="text-[10px] text-gray-400 font-medium shrink-0 opacity-0 hover:opacity-100">
                                  সিলেক্ট
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Helper Hint */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500 text-center shrink-0">
          যেকোনো জেলার ওপর ক্লিক করলে তার অধীনস্থ সকল থানা দেখতে পাবেন
        </div>
      </div>
    </div>
  );
};
