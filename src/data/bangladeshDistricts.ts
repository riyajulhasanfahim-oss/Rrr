export interface Area {
  id: string;
  name: string;
}

export interface Upazila {
  id: string;
  name: string;
  areas?: Area[];
}

export interface District {
  id: string;
  name: string;
  division: string;
  upazilas: Upazila[];
}

export const BANGLADESH_DISTRICTS: District[] = [
  // --- DHAKA DIVISION ---
  {
    id: 'Dhaka',
    name: 'Dhaka (ঢাকা)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Dhaka Sadar / Kotwali', name: 'Dhaka Sadar / Kotwali (ঢাকা সদর / কোতোয়ালী)' },
      { id: 'Dhanmondi', name: 'Dhanmondi (ধানমন্ডি)' },
      { id: 'Gulshan', name: 'Gulshan (গুলশান)' },
      { id: 'Banani', name: 'Banani (বনানী)' },
      { id: 'Uttara', name: 'Uttara (উত্তরা)' },
      { id: 'Mirpur', name: 'Mirpur (মিরপুর)' },
      { id: 'Mohammadpur', name: 'Mohammadpur (মোহাম্মদপুর)' },
      { id: 'Badda', name: 'Badda (বাড্ডা)' },
      { id: 'Motijheel', name: 'Motijheel (মতিঝিল)' },
      { id: 'Paltan', name: 'Paltan (পল্টন)' },
      { id: 'Ramna', name: 'Ramna (রমনা)' },
      { id: 'Tejgaon', name: 'Tejgaon (তেজগাঁও)' },
      { id: 'Khilgaon', name: 'Khilgaon (খিলগাঁও)' },
      { id: 'Rampura', name: 'Rampura (রামপুরা)' },
      { id: 'Sabujbagh', name: 'Sabujbagh (সবুজবাগ)' },
      { id: 'Jatrabari', name: 'Jatrabari (যাত্রাবাড়ী)' },
      { id: 'Demra', name: 'Demra (ডেমরা)' },
      { id: 'Kadamtali', name: 'Kadamtali (কদমতলী)' },
      { id: 'Lalbagh', name: 'Lalbagh (লালবাগ)' },
      { id: 'Chawkbazar', name: 'Chawkbazar (চকবাজার)' },
      { id: 'Sutrapur', name: 'Sutrapur (সূত্রাপুর)' },
      { id: 'Wari', name: 'Wari (ওয়ারী)' },
      { id: 'Kamrangirchar', name: 'Kamrangirchar (কামরাঙ্গীরচর)' },
      { id: 'Hazaribagh', name: 'Hazaribagh (হাজারীবাগ)' },
      { id: 'Kafrul', name: 'Kafrul (কাফরুল)' },
      { id: 'Cantonment', name: 'Cantonment (ক্যান্টনমেন্ট)' },
      { id: 'Shah Ali', name: 'Shah Ali (শাহ আলী)' },
      { id: 'Khilkhet', name: 'Khilkhet (খিলক্ষেত)' },
      { id: 'Bhatara', name: 'Bhatara (ভাটারা)' },
      { id: 'Turag', name: 'Turag (তুরাগ)' },
      { id: 'Savar', name: 'Savar (সাভার)' },
      { id: 'Dhamrai', name: 'Dhamrai (ধামরাই)' },
      { id: 'Keraniganj', name: 'Keraniganj (কেরানীগঞ্জ)' },
      { id: 'Dohar', name: 'Dohar (দোহার)' },
      { id: 'Nawabganj', name: 'Nawabganj (নবাবগঞ্জ)' }
    ]
  },
  {
    id: 'Gazipur',
    name: 'Gazipur (গাজীপুর)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Gazipur Sadar', name: 'Gazipur Sadar (গাজীপুর সদর)' },
      { id: 'Tongi', name: 'Tongi (টঙ্গী)' },
      { id: 'Kaliakair', name: 'Kaliakair (কালিয়াকৈর)' },
      { id: 'Sreepur', name: 'Sreepur (শ্রীপুর)' },
      { id: 'Kapasia', name: 'Kapasia (কাপাসিয়া)' },
      { id: 'Kaliganj', name: 'Kaliganj (কালীগঞ্জ)' }
    ]
  },
  {
    id: 'Narayanganj',
    name: 'Narayanganj (নারায়ণগঞ্জ)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Narayanganj Sadar', name: 'Narayanganj Sadar (নারায়ণগঞ্জ সদর)' },
      { id: 'Fatullah', name: 'Fatullah (ফতুল্লা)' },
      { id: 'Siddhirganj', name: 'Siddhirganj (সিদ্ধিরগঞ্জ)' },
      { id: 'Bandar', name: 'Bandar (বন্দর)' },
      { id: 'Rupganj', name: 'Rupganj (রূপগঞ্জ)' },
      { id: 'Araihazar', name: 'Araihazar (আড়াইহাজার)' },
      { id: 'Sonargaon', name: 'Sonargaon (সোনারগাঁও)' }
    ]
  },
  {
    id: 'Narsingdi',
    name: 'Narsingdi (নরসিংদী)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Narsingdi Sadar', name: 'Narsingdi Sadar (নরসিংদী সদর)' },
      { id: 'Belabo', name: 'Belabo (বেলাবো)' },
      { id: 'Monohardi', name: 'Monohardi (মনোহরদী)' },
      { id: 'Palash', name: 'Palash (পলাশ)' },
      { id: 'Raipura', name: 'Raipura (রায়পুরা)' },
      { id: 'Shibpur', name: 'Shibpur (শিবপুর)' }
    ]
  },
  {
    id: 'Tangail',
    name: 'Tangail (টাঙ্গাইল)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Tangail Sadar', name: 'Tangail Sadar (টাঙ্গাইল সদর)' },
      { id: 'Basail', name: 'Basail (বাসাইল)' },
      { id: 'Bhuapur', name: 'Bhuapur (ভূঞাপুর)' },
      { id: 'Delduar', name: 'Delduar (দেলদুয়ার)' },
      { id: 'Dhanbari', name: 'Dhanbari (ধনবাড়ী)' },
      { id: 'Ghatail', name: 'Ghatail (ঘাটাইল)' },
      { id: 'Gopalpur', name: 'Gopalpur (গোপালপুর)' },
      { id: 'Kalihati', name: 'Kalihati (কালিহাতী)' },
      { id: 'Madhupur', name: 'Madhupur (মধুপুর)' },
      { id: 'Mirzapur', name: 'Mirzapur (মির্জাপুর)' },
      { id: 'Nagarpur', name: 'Nagarpur (নাগরপুর)' },
      { id: 'Sakhipur', name: 'Sakhipur (সখীপুর)' }
    ]
  },
  {
    id: 'Kishoreganj',
    name: 'Kishoreganj (কিশোরগঞ্জ)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Kishoreganj Sadar', name: 'Kishoreganj Sadar (কিশোরগঞ্জ সদর)' },
      { id: 'Astagram', name: 'Astagram (অষ্টগ্রাম)' },
      { id: 'Bajitpur', name: 'Bajitpur (বাজিতপুর)' },
      { id: 'Bhairab', name: 'Bhairab (ভৈরব)' },
      { id: 'Hossainpur', name: 'Hossainpur (হোসেনপুর)' },
      { id: 'Itna', name: 'Itna (ইটনা)' },
      { id: 'Karimganj', name: 'Karimganj (করিমগঞ্জ)' },
      { id: 'Katiadi', name: 'Katiadi (কটিয়াদী)' },
      { id: 'Kuliarchar', name: 'Kuliarchar (কুলিয়ারচর)' },
      { id: 'Mithamain', name: 'Mithamain (মিঠামইন)' },
      { id: 'Nikli', name: 'Nikli (নিকলী)' },
      { id: 'Pakundia', name: 'Pakundia (পাকুন্দিয়া)' },
      { id: 'Tarail', name: 'Tarail (তাড়াইল)' }
    ]
  },
  {
    id: 'Manikganj',
    name: 'Manikganj (মানিকগঞ্জ)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Manikganj Sadar', name: 'Manikganj Sadar (মানিকগঞ্জ সদর)' },
      { id: 'Singair', name: 'Singair (সিংগাইর)' },
      { id: 'Shibalaya', name: 'Shibalaya (শিবালয়)' },
      { id: 'Saturia', name: 'Saturia (সাটুরিয়া)' },
      { id: 'Harirampur', name: 'Harirampur (হরিরামপুর)' },
      { id: 'Ghior', name: 'Ghior (ঘিওরে)' },
      { id: 'Daulatpur', name: 'Daulatpur (দৌলতপুর)' }
    ]
  },
  {
    id: 'Munshiganj',
    name: 'Munshiganj (মুন্সীগঞ্জ)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Munshiganj Sadar', name: 'Munshiganj Sadar (মুন্সীগঞ্জ সদর)' },
      { id: 'Sreenagar', name: 'Sreenagar (শ্রীনগর)' },
      { id: 'Sirajdikhan', name: 'Sirajdikhan (সিরাজদিখান)' },
      { id: 'Louhajang', name: 'Louhajang (লৌহজং)' },
      { id: 'Tongibari', name: 'Tongibari (টঙ্গীবাড়ি)' },
      { id: 'Gazaria', name: 'Gazaria (গজারিয়া)' }
    ]
  },
  {
    id: 'Faridpur',
    name: 'Faridpur (ফরিদপুর)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Faridpur Sadar', name: 'Faridpur Sadar (ফরিদপুর সদর)' },
      { id: 'Alfadanga', name: 'Alfadanga (আলফাডাঙ্গা)' },
      { id: 'Bhanga', name: 'Bhanga (ভাঙ্গা)' },
      { id: 'Boalmari', name: 'Boalmari (বোয়ালমারী)' },
      { id: 'Charbhadrasan', name: 'Charbhadrasan (চরভদ্রাসন)' },
      { id: 'Madhukhali', name: 'Madhukhali (মধুখালী)' },
      { id: 'Nagarkanda', name: 'Nagarkanda (নগরকান্দা)' },
      { id: 'Sadarpur', name: 'Sadarpur (সদরপুর)' },
      { id: 'Saltha', name: 'Saltha (সালথা)' }
    ]
  },
  {
    id: 'Gopalganj',
    name: 'Gopalganj (গোপালগঞ্জ)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Gopalganj Sadar', name: 'Gopalganj Sadar (গোপালগঞ্জ সদর)' },
      { id: 'Kashiani', name: 'Kashiani (কাশিয়ানী)' },
      { id: 'Kotalipara', name: 'Kotalipara (কোটালীপাড়া)' },
      { id: 'Muksudpur', name: 'Muksudpur (মুকসুদপুর)' },
      { id: 'Tungipara', name: 'Tungipara (টুঙ্গিপাড়া)' }
    ]
  },
  {
    id: 'Madaripur',
    name: 'Madaripur (মাদারীপুর)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Madaripur Sadar', name: 'Madaripur Sadar (মাদারীপুর সদর)' },
      { id: 'Kalkini', name: 'Kalkini (কালকিনি)' },
      { id: 'Rajoir', name: 'Rajoir (রাজৈর)' },
      { id: 'Shibchar', name: 'Shibchar (শিবচর)' },
      { id: 'Dasar', name: 'Dasar (ডাসার)' }
    ]
  },
  {
    id: 'Rajbari',
    name: 'Rajbari (রাজবাড়ী)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Rajbari Sadar', name: 'Rajbari Sadar (রাজবাড়ী সদর)' },
      { id: 'Goalanda', name: 'Goalanda (গোয়ালন্দ)' },
      { id: 'Pangsha', name: 'Pangsha (পাংশা)' },
      { id: 'Baliakandi', name: 'Baliakandi (বালিয়াকান্দি)' },
      { id: 'Kalukhali', name: 'Kalukhali (কালুখালী)' }
    ]
  },
  {
    id: 'Shariatpur',
    name: 'Shariatpur (শরীয়তপুর)',
    division: 'Dhaka',
    upazilas: [
      { id: 'Shariatpur Sadar', name: 'Shariatpur Sadar (শরীয়তপুর সদর)' },
      { id: 'Damudya', name: 'Damudya (ডামুড্যা)' },
      { id: 'Naria', name: 'Naria (নড়িয়া)' },
      { id: 'Jajira', name: 'Jajira (জাজিরা)' },
      { id: 'Bhedarganj', name: 'Bhedarganj (ভেদরগঞ্জ)' },
      { id: 'Gosairhat', name: 'Gosairhat (গোসাইরহাট)' }
    ]
  },

  // --- SYLHET DIVISION ---
  {
    id: 'Sylhet',
    name: 'Sylhet (সিলেট)',
    division: 'Sylhet',
    upazilas: [
      { id: 'Sylhet Sadar', name: 'Sylhet Sadar / City (সিলেট সদর / সিটি)' },
      { id: 'Beanibazar', name: 'Beanibazar (বিয়ানীবাজার)' },
      { id: 'Golapganj', name: 'Golapganj (গোলাপগঞ্জ)' },
      { id: 'Zakiganj', name: 'Zakiganj (জকিগঞ্জ)' },
      { id: 'Kanaighat', name: 'Kanaighat (কানাইঘাট)' },
      { id: 'Jaintiapur', name: 'Jaintiapur (জৈন্তাপুর)' },
      { id: 'Gowainghat', name: 'Gowainghat (গোয়াইনঘাট)' },
      { id: 'Companiganj', name: 'Companiganj (কোম্পানীগঞ্জ)' },
      { id: 'Fenchuganj', name: 'Fenchuganj (ফেঞ্চুগঞ্জ)' },
      { id: 'Balaganj', name: 'Balaganj (বালাগঞ্জ)' },
      { id: 'Bishwanath', name: 'Bishwanath (বিশ্বনাথ)' },
      { id: 'South Surma', name: 'South Surma (দক্ষিণ সুরমা)' },
      { id: 'Osmani Nagar', name: 'Osmani Nagar (ওসমানী নগর)' }
    ]
  },
  {
    id: 'Moulvibazar',
    name: 'Moulvibazar (মৌলভীবাজার)',
    division: 'Sylhet',
    upazilas: [
      { id: 'Moulvibazar Sadar', name: 'Moulvibazar Sadar (মৌলভীবাজার সদর)' },
      { id: 'Barlekha', name: 'Barlekha (বড়লেখা)' },
      { id: 'Juri', name: 'Juri (জুড়ী)' },
      { id: 'Kamalganj', name: 'Kamalganj (কমলগঞ্জ)' },
      { id: 'Kulaura', name: 'Kulaura (কুলাউড়া)' },
      { id: 'Rajnagar', name: 'Rajnagar (রাজনগর)' },
      { id: 'Sreemangal', name: 'Sreemangal (শ্রীমঙ্গল)' }
    ]
  },
  {
    id: 'Habiganj',
    name: 'Habiganj (হবিগঞ্জ)',
    division: 'Sylhet',
    upazilas: [
      { id: 'Habiganj Sadar', name: 'Habiganj Sadar (হবিগঞ্জ সদর)' },
      { id: 'Ajmiriganj', name: 'Ajmiriganj (আজমিরীগঞ্জ)' },
      { id: 'Bahubal', name: 'Bahubal (বাহুবল)' },
      { id: 'Baniyachong', name: 'Baniyachong (বানিয়াচং)' },
      { id: 'Chunarughat', name: 'Chunarughat (চুনারুঘাট)' },
      { id: 'Lakhai', name: 'Lakhai (লাখাই)' },
      { id: 'Madhabpur', name: 'Madhabpur (মাধবপুর)' },
      { id: 'Nabiganj', name: 'Nabiganj (নবীগঞ্জ)' },
      { id: 'Shayestaganj', name: 'Shayestaganj (শায়েস্তাগঞ্জ)' }
    ]
  },
  {
    id: 'Sunamganj',
    name: 'Sunamganj (সুনামগঞ্জ)',
    division: 'Sylhet',
    upazilas: [
      { id: 'Sunamganj Sadar', name: 'Sunamganj Sadar (সুনামগঞ্জ সদর)' },
      { id: 'Bishwamvarpur', name: 'Bishwamvarpur (বিশ্বম্ভরপুর)' },
      { id: 'Chhatak', name: 'Chhatak (ছাতক)' },
      { id: 'Derai', name: 'Derai (দিরাই)' },
      { id: 'Dharamapasha', name: 'Dharamapasha (ধর্মপাশা)' },
      { id: 'Dowarabazar', name: 'Dowarabazar (দোয়ারাবাজার)' },
      { id: 'Jagannathpur', name: 'Jagannathpur (জগন্নাথপুর)' },
      { id: 'Jamalganj', name: 'Jamalganj (জামালগঞ্জ)' },
      { id: 'Sullah', name: 'Sullah (শাল্লা)' },
      { id: 'Tahirpur', name: 'Tahirpur (তাহিরপুর)' },
      { id: 'Shantiganj', name: 'Shantiganj / South Sunamganj (শান্তিগঞ্জ)' },
      { id: 'Madhyanagar', name: 'Madhyanagar (মধ্যনগর)' }
    ]
  },

  // --- CHATTOGRAM DIVISION ---
  {
    id: 'Chattogram',
    name: 'Chattogram (চট্টগ্রাম)',
    division: 'Chattogram',
    upazilas: [
      { id: 'Kotwali', name: 'Kotwali (কোতোয়ালী)' },
      { id: 'Panchlaish', name: 'Panchlaish (পাঁচলাইশ)' },
      { id: 'Pahartali', name: 'Pahartali (পাহাড়তলী)' },
      { id: 'Double Mooring', name: 'Double Mooring (ডবলমুরিং)' },
      { id: 'Chandgaon', name: 'Chandgaon (চান্দগাঁও)' },
      { id: 'Halishahar', name: 'Halishahar (হালিশহর)' },
      { id: 'Khulshi', name: 'Khulshi (খুলশী)' },
      { id: 'Bakalia', name: 'Bakalia (বাকলিয়া)' },
      { id: 'Bayezid', name: 'Bayezid (বায়েজিদ)' },
      { id: 'Patenga', name: 'Patenga (পতেঙ্গা)' },
      { id: 'Karnaphuli', name: 'Karnaphuli (কর্ণফুলী)' },
      { id: 'Anwara', name: 'Anwara (আনোয়ারা)' },
      { id: 'Banshkhali', name: 'Banshkhali (বাঁশখালী)' },
      { id: 'Boalkhali', name: 'Boalkhali (বোয়ালখালী)' },
      { id: 'Chandanaish', name: 'Chandanaish (চন্দনাইশ)' },
      { id: 'Fatikchhari', name: 'Fatikchhari (ফটিকছড়ি)' },
      { id: 'Hathazari', name: 'Hathazari (হাটহাজারী)' },
      { id: 'Lohagara', name: 'Lohagara (লোহাগাড়া)' },
      { id: 'Mirsharai', name: 'Mirsharai (মীরসরাই)' },
      { id: 'Patiya', name: 'Patiya (পটিয়া)' },
      { id: 'Rangunia', name: 'Rangunia (রাঙ্গুনিয়া)' },
      { id: 'Raozan', name: 'Raozan (রাউজান)' },
      { id: 'Sandwip', name: 'Sandwip (সন্দ্বীপ)' },
      { id: 'Satkania', name: 'Satkania (সাতকানিয়া)' },
      { id: 'Sitakunda', name: 'Sitakunda (সীতাকুন্ড)' }
    ]
  },
  {
    id: 'Coxs Bazar',
    name: 'Cox\'s Bazar (কক্সবাজার)',
    division: 'Chattogram',
    upazilas: [
      { id: 'Coxs Bazar Sadar', name: 'Cox\'s Bazar Sadar (কক্সবাজার সদর)' },
      { id: 'Chakaria', name: 'Chakaria (চকরিয়া)' },
      { id: 'Maheshkhali', name: 'Maheshkhali (মহেশখালী)' },
      { id: 'Kutubdia', name: 'Kutubdia (কুতুবদিয়া)' },
      { id: 'Pekua', name: 'Pekua (পেকুয়া)' },
      { id: 'Ramu', name: 'Ramu (রামু)' },
      { id: 'Teknaf', name: 'Teknaf (টেকনাফ)' },
      { id: 'Ukhiya', name: 'Ukhiya (উখিয়া)' },
      { id: 'Eidgaon', name: 'Eidgaon (ঈদগাঁও)' }
    ]
  },
  {
    id: 'Cumilla',
    name: 'Cumilla (কুমিল্লা)',
    division: 'Chattogram',
    upazilas: [
      { id: 'Cumilla Sadar', name: 'Cumilla Sadar (কুমিল্লা আদর্শ সদর)' },
      { id: 'Cumilla Sadar South', name: 'Cumilla Sadar South (কুমিল্লা সদর দক্ষিণ)' },
      { id: 'Barura', name: 'Barura (বরুড়া)' },
      { id: 'Brahmanpara', name: 'Brahmanpara (ব্রাহ্মণপাড়া)' },
      { id: 'Burichang', name: 'Burichang (বুড়িচং)' },
      { id: 'Chandina', name: 'Chandina (চান্দিনা)' },
      { id: 'Chauddagram', name: 'Chauddagram (চৌদ্দগ্রাম)' },
      { id: 'Daudkandi', name: 'Daudkandi (দাউদকান্দি)' },
      { id: 'Debidwar', name: 'Debidwar (দেবিদ্বার)' },
      { id: 'Homna', name: 'Homna (হোমনা)' },
      { id: 'Laksam', name: 'Laksam (লাকসাম)' },
      { id: 'Muradnagar', name: 'Muradnagar (মুরাদনগর)' },
      { id: 'Nangalkot', name: 'Nangalkot (নাঙ্গলকোট)' },
      { id: 'Meghna', name: 'Meghna (মেঘনা)' },
      { id: 'Titas', name: 'Titas (তিতাস)' },
      { id: 'Monohargonj', name: 'Monohargonj (মনোহরগঞ্জ)' },
      { id: 'Lalmai', name: 'Lalmai (লালমাই)' }
    ]
  },
  {
    id: 'Brahmanbaria',
    name: 'Brahmanbaria (ব্রাহ্মণবাড়িয়া)',
    division: 'Chattogram',
    upazilas: [
      { id: 'Brahmanbaria Sadar', name: 'Brahmanbaria Sadar (ব্রাহ্মণবাড়িয়া সদর)' },
      { id: 'Ashuganj', name: 'Ashuganj (আশুগঞ্জ)' },
      { id: 'Akhaura', name: 'Akhaura (আখাউড়া)' },
      { id: 'Bancharampur', name: 'Bancharampur (বাঞ্ছারামপুর)' },
      { id: 'Bijoynagar', name: 'Bijoynagar (বিজয়নগর)' },
      { id: 'Kasba', name: 'Kasba (কসবা)' },
      { id: 'Nabinagar', name: 'Nabinagar (নবীনগর)' },
      { id: 'Nasirnagar', name: 'Nasirnagar (নাসিরনগর)' },
      { id: 'Sarail', name: 'Sarail (সরাইল)' }
    ]
  },
  {
    id: 'Chandpur',
    name: 'Chandpur (চাঁদপুর)',
    division: 'Chattogram',
    upazilas: [
      { id: 'Chandpur Sadar', name: 'Chandpur Sadar (চাঁদপুর সদর)' },
      { id: 'Faridganj', name: 'Faridganj (ফরিদগঞ্জ)' },
      { id: 'Haimchar', name: 'Haimchar (হাইমচর)' },
      { id: 'Haziganj', name: 'Haziganj (হাজীগঞ্জ)' },
      { id: 'Kachua', name: 'Kachua (কচুয়া)' },
      { id: 'Matlab North', name: 'Matlab North (মতলব উত্তর)' },
      { id: 'Matlab South', name: 'Matlab South (মতলব দক্ষিণ)' },
      { id: 'Shahrasti', name: 'Shahrasti (শাহরাস্তি)' }
    ]
  },
  {
    id: 'Feni',
    name: 'Feni (ফেনী)',
    division: 'Chattogram',
    upazilas: [
      { id: 'Feni Sadar', name: 'Feni Sadar (ফেনী সদর)' },
      { id: 'Chhagalnaiya', name: 'Chhagalnaiya (ছাগলনাইয়া)' },
      { id: 'Daganbhuiyan', name: 'Daganbhuiyan (দাগনভূঞা)' },
      { id: 'Parshuram', name: 'Parshuram (পরশুরাম)' },
      { id: 'Fulgazi', name: 'Fulgazi (ফুলগাজী)' },
      { id: 'Sonagazi', name: 'Sonagazi (সোনাগাজী)' }
    ]
  },
  {
    id: 'Noakhali',
    name: 'Noakhali (নোয়াখালী)',
    division: 'Chattogram',
    upazilas: [
      { id: 'Noakhali Sadar', name: 'Noakhali Sadar (নোয়াখালী সদর)' },
      { id: 'Begumganj', name: 'Begumganj (বেগমগঞ্জ)' },
      { id: 'Chatkhil', name: 'Chatkhil (চাটখিল)' },
      { id: 'Companiganj', name: 'Companiganj (কোম্পানীগঞ্জ)' },
      { id: 'Hatiya', name: 'Hatiya (হাতিয়া)' },
      { id: 'Senbagh', name: 'Senbagh (সেনবাগ)' },
      { id: 'Sonaimuri', name: 'Sonaimuri (সোনাইমুড়ী)' },
      { id: 'Subarnachar', name: 'Subarnachar (সুবর্ণচর)' },
      { id: 'Kabirhat', name: 'Kabirhat (কবিরহাট)' }
    ]
  },
  {
    id: 'Lakshmipur',
    name: 'Lakshmipur (লক্ষ্মীপুর)',
    division: 'Chattogram',
    upazilas: [
      { id: 'Lakshmipur Sadar', name: 'Lakshmipur Sadar (লক্ষ্মীপুর সদর)' },
      { id: 'Raipur', name: 'Raipur (রায়পুর)' },
      { id: 'Ramganj', name: 'Ramganj (রামগঞ্জ)' },
      { id: 'Ramgati', name: 'Ramgati (রামগতি)' },
      { id: 'Kamalnagar', name: 'Kamalnagar (কমলনগর)' }
    ]
  },
  {
    id: 'Bandarban',
    name: 'Bandarban (বান্দরবান)',
    division: 'Chattogram',
    upazilas: [
      { id: 'Bandarban Sadar', name: 'Bandarban Sadar (বান্দরবান সদর)' },
      { id: 'Alikadam', name: 'Alikadam (আলীকদম)' },
      { id: 'Naikhongchhari', name: 'Naikhongchhari (নাইক্ষ্যংছড়ি)' },
      { id: 'Rowangchhari', name: 'Rowangchhari (রোয়াংছড়ি)' },
      { id: 'Ruma', name: 'Ruma (রুমা)' },
      { id: 'Thanchi', name: 'Thanchi (থানচি)' },
      { id: 'Lama', name: 'Lama (লামা)' }
    ]
  },
  {
    id: 'Khagrachhari',
    name: 'Khagrachhari (খাগড়াছড়ি)',
    division: 'Chattogram',
    upazilas: [
      { id: 'Khagrachhari Sadar', name: 'Khagrachhari Sadar (খাগড়াছড়ি সদর)' },
      { id: 'Dighinala', name: 'Dighinala (দিঘীনালা)' },
      { id: 'Laksmichhari', name: 'Laksmichhari (লক্ষ্মীছড়ি)' },
      { id: 'Mahalchhari', name: 'Mahalchhari (মহালছড়ি)' },
      { id: 'Manikchhari', name: 'Manikchhari (মানিকছড়ি)' },
      { id: 'Matiranga', name: 'Matiranga (মাটিরাঙ্গা)' },
      { id: 'Panchhari', name: 'Panchhari (পানছড়ি)' },
      { id: 'Ramgarh', name: 'Ramgarh (রামগড়)' },
      { id: 'Guimara', name: 'Guimara (গুইমারা)' }
    ]
  },
  {
    id: 'Rangamati',
    name: 'Rangamati (রাঙ্গামাটি)',
    division: 'Chattogram',
    upazilas: [
      { id: 'Rangamati Sadar', name: 'Rangamati Sadar (রাঙ্গামাটি সদর)' },
      { id: 'Baghaichhari', name: 'Baghaichhari (বাঘাইছড়ি)' },
      { id: 'Barkal', name: 'Barkal (বরকল)' },
      { id: 'Belaichhari', name: 'Belaichhari (বিলাইছড়ি)' },
      { id: 'Juraichhari', name: 'Juraichhari (জুরাইছড়ি)' },
      { id: 'Kaptai', name: 'Kaptai (কাপ্তাই)' },
      { id: 'Kawkhali', name: 'Kawkhali (কাউখালী)' },
      { id: 'Langadu', name: 'Langadu (লংগদু)' },
      { id: 'Naniarchar', name: 'Naniarchar (নানিয়ারচর)' },
      { id: 'Rajasthali', name: 'Rajasthali (রাজস্থলী)' }
    ]
  },

  // --- RAJSHAHI DIVISION ---
  {
    id: 'Rajshahi',
    name: 'Rajshahi (রাজশাহী)',
    division: 'Rajshahi',
    upazilas: [
      { id: 'Boalia', name: 'Boalia (বোয়ালিয়া)' },
      { id: 'Motihar', name: 'Motihar (মতিহার)' },
      { id: 'Rajputra', name: 'Rajputra / Rajpara (রাজপাড়া)' },
      { id: 'Shah Makhdum', name: 'Shah Makhdum (শাহ মখদুম)' },
      { id: 'Paba', name: 'Paba (পবা)' },
      { id: 'Bagha', name: 'Bagha (বাঘা)' },
      { id: 'Bagmara', name: 'Bagmara (বাগমারা)' },
      { id: 'Charghat', name: 'Charghat (চারঘাট)' },
      { id: 'Durgapur', name: 'Durgapur (দুর্গাপুর)' },
      { id: 'Godagari', name: 'Godagari (গোদাগাড়ী)' },
      { id: 'Mohanpur', name: 'Mohanpur (মোহনপুর)' },
      { id: 'Puthia', name: 'Puthia (পুঠিয়া)' },
      { id: 'Tanore', name: 'Tanore (তানোর)' }
    ]
  },
  {
    id: 'Bogura',
    name: 'Bogura (বগুড়া)',
    division: 'Rajshahi',
    upazilas: [
      { id: 'Bogura Sadar', name: 'Bogura Sadar (বগুড়া সদর)' },
      { id: 'Adamdighi', name: 'Adamdighi (আদমদীঘি)' },
      { id: 'Dhunat', name: 'Dhunat (ধুনট)' },
      { id: 'Dhupchanchia', name: 'Dhupchanchia (দুপচাঁচিয়া)' },
      { id: 'Gabtali', name: 'Gabtali (গাবতলী)' },
      { id: 'Kahaloo', name: 'Kahaloo (কাহালু)' },
      { id: 'Nandigram', name: 'Nandigram (নন্দীগ্রাম)' },
      { id: 'Sariakandi', name: 'Sariakandi (সারিয়াকান্দি)' },
      { id: 'Shajahanpur', name: 'Shajahanpur (শাজাহানপুর)' },
      { id: 'Sherpur', name: 'Sherpur (শেরপুর)' },
      { id: 'Shibganj', name: 'Shibganj (শিবগঞ্জ)' },
      { id: 'Sonatola', name: 'Sonatola (সোনাতলা)' }
    ]
  },
  {
    id: 'Joypurhat',
    name: 'Joypurhat (জয়পুরহাট)',
    division: 'Rajshahi',
    upazilas: [
      { id: 'Joypurhat Sadar', name: 'Joypurhat Sadar (জয়পুরহাট সদর)' },
      { id: 'Akkelpur', name: 'Akkelpur (আক্কেলপুর)' },
      { id: 'Kalai', name: 'Kalai (কালাই)' },
      { id: 'Khetlal', name: 'Khetlal (ক্ষেতলাল)' },
      { id: 'Panchbibi', name: 'Panchbibi (পাঁচবিবি)' }
    ]
  },
  {
    id: 'Naogaon',
    name: 'Naogaon (নওগাঁ)',
    division: 'Rajshahi',
    upazilas: [
      { id: 'Naogaon Sadar', name: 'Naogaon Sadar (নওগাঁ সদর)' },
      { id: 'Atrai', name: 'Atrai (আত্রাই)' },
      { id: 'Badalgachhi', name: 'Badalgachhi (বদলগাছী)' },
      { id: 'Dhamoirhat', name: 'Dhamoirhat (ধামইরহাট)' },
      { id: 'Manda', name: 'Manda (মান্দা)' },
      { id: 'Mohadevpur', name: 'Mohadevpur (মহাদেবপুর)' },
      { id: 'Niamatpur', name: 'Niamatpur (নিয়ামতপুর)' },
      { id: 'Patnitala', name: 'Patnitala (পত্নীতলা)' },
      { id: 'Porsha', name: 'Porsha (পোরশা)' },
      { id: 'Raninagar', name: 'Raninagar (রানীনগর)' },
      { id: 'Sapahar', name: 'Sapahar (সাপাহার)' }
    ]
  },
  {
    id: 'Natore',
    name: 'Natore (নাটোর)',
    division: 'Rajshahi',
    upazilas: [
      { id: 'Natore Sadar', name: 'Natore Sadar (নাটোর সদর)' },
      { id: 'Bagatipara', name: 'Bagatipara (বাগাতিপাড়া)' },
      { id: 'Baraigram', name: 'Baraigram (বড়াইগ্রাম)' },
      { id: 'Gurudaspur', name: 'Gurudaspur (গুরুদাসপুর)' },
      { id: 'Lalpur', name: 'Lalpur (লালপুর)' },
      { id: 'Singra', name: 'Singra (সিংড়া)' },
      { id: 'Naldanga', name: 'Naldanga (নলডাঙ্গা)' }
    ]
  },
  {
    id: 'Chapainawabganj',
    name: 'Chapainawabganj (চাঁপাইনবাবগঞ্জ)',
    division: 'Rajshahi',
    upazilas: [
      { id: 'Chapainawabganj Sadar', name: 'Chapainawabganj Sadar (চাঁপাইনবাবগঞ্জ সদর)' },
      { id: 'Bholahat', name: 'Bholahat (ভোলাহাট)' },
      { id: 'Gomastapur', name: 'Gomastapur (গোমস্তাপুর)' },
      { id: 'Nachole', name: 'Nachole (নাচোল)' },
      { id: 'Shibganj', name: 'Shibganj (শিবগঞ্জ)' }
    ]
  },
  {
    id: 'Pabna',
    name: 'Pabna (পাবনা)',
    division: 'Rajshahi',
    upazilas: [
      { id: 'Pabna Sadar', name: 'Pabna Sadar (পাবনা সদর)' },
      { id: 'Atgharia', name: 'Atgharia (আটঘরিয়া)' },
      { id: 'Bera', name: 'Bera (বেড়া)' },
      { id: 'Bhangoora', name: 'Bhangoora (ভাঙ্গুড়া)' },
      { id: 'Chatmohar', name: 'Chatmohar (চাটমোহর)' },
      { id: 'Faridpur', name: 'Faridpur (ফরিদপুর)' },
      { id: 'Ishwardi', name: 'Ishwardi (ঈশ্বরদী)' },
      { id: 'Santhia', name: 'Santhia (সাঁথিয়া)' },
      { id: 'Sujanagar', name: 'Sujanagar (সুজানগর)' }
    ]
  },
  {
    id: 'Sirajganj',
    name: 'Sirajganj (সিরাজগঞ্জ)',
    division: 'Rajshahi',
    upazilas: [
      { id: 'Sirajganj Sadar', name: 'Sirajganj Sadar (সিরাজগঞ্জ সদর)' },
      { id: 'Belkuchi', name: 'Belkuchi (বেলকুচি)' },
      { id: 'Chauhali', name: 'Chauhali (চৌহালী)' },
      { id: 'Kamarkhanda', name: 'Kamarkhanda (কামারখন্দ)' },
      { id: 'Kazipur', name: 'Kazipur (কাজীপুর)' },
      { id: 'Raiganj', name: 'Raiganj (রায়গঞ্জ)' },
      { id: 'Shahjadpur', name: 'Shahjadpur (শাহজাদপুর)' },
      { id: 'Tarash', name: 'Tarash (তাড়াশ)' },
      { id: 'Ullahpara', name: 'Ullahpara (উল্লাপাড়া)' }
    ]
  },

  // --- KHULNA DIVISION ---
  {
    id: 'Khulna',
    name: 'Khulna (খুলনা)',
    division: 'Khulna',
    upazilas: [
      { id: 'Khulna Sadar', name: 'Khulna Sadar / City (খুলনা সদর / সিটি)' },
      { id: 'Sonadanga', name: 'Sonadanga (সোনাডাঙ্গা)' },
      { id: 'Khalishpur', name: 'Khalishpur (খালিশপুর)' },
      { id: 'Daulatpur', name: 'Daulatpur (দৌলতপুর)' },
      { id: 'Khan Jahan Ali', name: 'Khan Jahan Ali (খান জাহান আলী)' },
      { id: 'Batiaghata', name: 'Batiaghata (বটিয়াঘাটা)' },
      { id: 'Dacope', name: 'Dacope (দাকোপ)' },
      { id: 'Dumuria', name: 'Dumuria (ডুমুরিয়া)' },
      { id: 'Dighalia', name: 'Dighalia (দিঘলিয়া)' },
      { id: 'Koyra', name: 'Koyra (কয়রা)' },
      { id: 'Paikgachha', name: 'Paikgachha (পাইকগাছা)' },
      { id: 'Phultala', name: 'Phultala (ফুলতলা)' },
      { id: 'Rupsha', name: 'Rupsha (রূপসা)' },
      { id: 'Terokhada', name: 'Terokhada (তেরখাদা)' }
    ]
  },
  {
    id: 'Bagerhat',
    name: 'Bagerhat (বাগেরহাট)',
    division: 'Khulna',
    upazilas: [
      { id: 'Bagerhat Sadar', name: 'Bagerhat Sadar (বাগেরহাট সদর)' },
      { id: 'Chitalmari', name: 'Chitalmari (চিতলমারী)' },
      { id: 'Fakirhat', name: 'Fakirhat (ফকিরহাট)' },
      { id: 'Kachua', name: 'Kachua (কচুয়া)' },
      { id: 'Mollahat', name: 'Mollahat (মোল্লাহাট)' },
      { id: 'Mongla', name: 'Mongla (মোংলা)' },
      { id: 'Morrelganj', name: 'Morrelganj (মোড়েলগঞ্জ)' },
      { id: 'Rampal', name: 'Rampal (রামপাল)' },
      { id: 'Sarankhola', name: 'Sarankhola (শরণখোলা)' }
    ]
  },
  {
    id: 'Chuadanga',
    name: 'Chuadanga (চুয়াডাঙ্গা)',
    division: 'Khulna',
    upazilas: [
      { id: 'Chuadanga Sadar', name: 'Chuadanga Sadar (চুয়াডাঙ্গা সদর)' },
      { id: 'Alamdanga', name: 'Alamdanga (আলমডাঙ্গা)' },
      { id: 'Damurhuda', name: 'Damurhuda (দামুড়হুদা)' },
      { id: 'Jibannagar', name: 'Jibannagar (জীবননগর)' }
    ]
  },
  {
    id: 'Jashore',
    name: 'Jashore (যশোর)',
    division: 'Khulna',
    upazilas: [
      { id: 'Jashore Sadar', name: 'Jashore Sadar (যশোর সদর)' },
      { id: 'Abhaynagar', name: 'Abhaynagar (অভয়নগর)' },
      { id: 'Bagherpara', name: 'Bagherpara (বাঘারপাড়া)' },
      { id: 'Chaugachha', name: 'Chaugachha (চৌগাছা)' },
      { id: 'Jhikargachha', name: 'Jhikargachha (ঝিকরগাছা)' },
      { id: 'Keshabpur', name: 'Keshabpur (কেশবপুর)' },
      { id: 'Manirampur', name: 'Manirampur (মণিরামপুর)' },
      { id: 'Sharsha', name: 'Sharsha (শার্শা)' }
    ]
  },
  {
    id: 'Jhenaidah',
    name: 'Jhenaidah (ঝিনাইদহ)',
    division: 'Khulna',
    upazilas: [
      { id: 'Jhenaidah Sadar', name: 'Jhenaidah Sadar (ঝিনাইদহ সদর)' },
      { id: 'Harinakundu', name: 'Harinakundu (হরিণাকুণ্ডু)' },
      { id: 'Kaliganj', name: 'Kaliganj (কালীগঞ্জ)' },
      { id: 'Kotchandpur', name: 'Kotchandpur (কোটচাঁদপুর)' },
      { id: 'Maheshpur', name: 'Maheshpur (মহেশপুর)' },
      { id: 'Shailkupa', name: 'Shailkupa (শৈলকুপা)' }
    ]
  },
  {
    id: 'Kushtia',
    name: 'Kushtia (কুষ্টিয়া)',
    division: 'Khulna',
    upazilas: [
      { id: 'Kushtia Sadar', name: 'Kushtia Sadar (কুষ্টিয়া সদর)' },
      { id: 'Bheramara', name: 'Bheramara (ভেড়ামারা)' },
      { id: 'Daulatpur', name: 'Daulatpur (দৌলতপুর)' },
      { id: 'Khoksa', name: 'Khoksa (খোকসা)' },
      { id: 'Kumarkhali', name: 'Kumarkhali (কুমারখালী)' },
      { id: 'Mirpur', name: 'Mirpur (মিরপুর)' }
    ]
  },
  {
    id: 'Magura',
    name: 'Magura (মাগুরা)',
    division: 'Khulna',
    upazilas: [
      { id: 'Magura Sadar', name: 'Magura Sadar (মাগুরা সদর)' },
      { id: 'Mohammadpur', name: 'Mohammadpur (মোহাম্মদপুর)' },
      { id: 'Shalikha', name: 'Shalikha (শালিখা)' },
      { id: 'Sreepur', name: 'Sreepur (শ্রীপুর)' }
    ]
  },
  {
    id: 'Meherpur',
    name: 'Meherpur (মেহেরপুর)',
    division: 'Khulna',
    upazilas: [
      { id: 'Meherpur Sadar', name: 'Meherpur Sadar (মেহেরপুর সদর)' },
      { id: 'Gangni', name: 'Gangni (গাংনী)' },
      { id: 'Mujibnagar', name: 'Mujibnagar (মুজিবনগর)' }
    ]
  },
  {
    id: 'Narail',
    name: 'Narail (নড়াইল)',
    division: 'Khulna',
    upazilas: [
      { id: 'Narail Sadar', name: 'Narail Sadar (নড়াইল সদর)' },
      { id: 'Kalia', name: 'Kalia (কালিয়া)' },
      { id: 'Lohagara', name: 'Lohagara (লোহাগড়া)' }
    ]
  },
  {
    id: 'Satkhira',
    name: 'Satkhira (সাতক্ষীরা)',
    division: 'Khulna',
    upazilas: [
      { id: 'Satkhira Sadar', name: 'Satkhira Sadar (সাতক্ষীরা সদর)' },
      { id: 'Assasuni', name: 'Assasuni (আশাশুনি)' },
      { id: 'Debhata', name: 'Debhata (দেবহাটা)' },
      { id: 'Kalaroa', name: 'Kalaroa (কলারোয়া)' },
      { id: 'Kaliganj', name: 'Kaliganj (কালীগঞ্জ)' },
      { id: 'Shyamnagar', name: 'Shyamnagar (শ্যামনগর)' },
      { id: 'Tala', name: 'Tala (তালা)' }
    ]
  },

  // --- BARISHAL DIVISION ---
  {
    id: 'Barishal',
    name: 'Barishal (বরিশাল)',
    division: 'Barishal',
    upazilas: [
      { id: 'Barishal Sadar', name: 'Barishal Sadar (বরিশাল সদর)' },
      { id: 'Agailjhara', name: 'Agailjhara (আগৈলঝাড়া)' },
      { id: 'Babuganj', name: 'Babuganj (বাবুগঞ্জ)' },
      { id: 'Bakerganj', name: 'Bakerganj (বাকেরগঞ্জ)' },
      { id: 'Banaripara', name: 'Banaripara (বানারীপাড়া)' },
      { id: 'Gaurnadi', name: 'Gaurnadi (গৌরনদী)' },
      { id: 'Hizla', name: 'Hizla (হিজলা)' },
      { id: 'Mehendiganj', name: 'Mehendiganj (মেহেন্দীগঞ্জ)' },
      { id: 'Muladi', name: 'Muladi (মুলাদী)' },
      { id: 'Wazirpur', name: 'Wazirpur (উজিরপুর)' }
    ]
  },
  {
    id: 'Barguna',
    name: 'Barguna (বরগুনা)',
    division: 'Barishal',
    upazilas: [
      { id: 'Barguna Sadar', name: 'Barguna Sadar (বরগুনা সদর)' },
      { id: 'Amtali', name: 'Amtali (আমতলী)' },
      { id: 'Bamna', name: 'Bamna (বামনা)' },
      { id: 'Betagi', name: 'Betagi (বেতাগী)' },
      { id: 'Patharghata', name: 'Patharghata (পাথরঘাটা)' },
      { id: 'Taltali', name: 'Taltali (তালতলী)' }
    ]
  },
  {
    id: 'Bhola',
    name: 'Bhola (ভোলা)',
    division: 'Barishal',
    upazilas: [
      { id: 'Bhola Sadar', name: 'Bhola Sadar (ভোলা সদর)' },
      { id: 'Burhanuddin', name: 'Burhanuddin (বোরহানউদ্দিন)' },
      { id: 'Char Fasson', name: 'Char Fasson (চরফ্যাশন)' },
      { id: 'Daulatkhan', name: 'Daulatkhan (দৌলতখান)' },
      { id: 'Lalmohan', name: 'Lalmohan (লালমোহন)' },
      { id: 'Manpura', name: 'Manpura (মনপুরা)' },
      { id: 'Tazumuddin', name: 'Tazumuddin (তজুমদ্দিন)' }
    ]
  },
  {
    id: 'Jhalokati',
    name: 'Jhalokati (ঝালকাঠি)',
    division: 'Barishal',
    upazilas: [
      { id: 'Jhalokati Sadar', name: 'Jhalokati Sadar (ঝালকাঠি সদর)' },
      { id: 'Kathalia', name: 'Kathalia (কাঠালিয়া)' },
      { id: 'Nalchity', name: 'Nalchity (নলছিটি)' },
      { id: 'Rajapur', name: 'Rajapur (রাজাপুর)' }
    ]
  },
  {
    id: 'Patuakhali',
    name: 'Patuakhali (পটুয়াখালী)',
    division: 'Barishal',
    upazilas: [
      { id: 'Patuakhali Sadar', name: 'Patuakhali Sadar (পটুয়াখালী সদর)' },
      { id: 'Bauphal', name: 'Bauphal (বাউফল)' },
      { id: 'Dashmina', name: 'Dashmina (দশমিনা)' },
      { id: 'Galachipa', name: 'Galachipa (গলাচিপা)' },
      { id: 'Kalapara', name: 'Kalapara (কলাপাড়া)' },
      { id: 'Mirzaganj', name: 'Mirzaganj (মির্জাগঞ্জ)' },
      { id: 'Rangabali', name: 'Rangabali (রাঙ্গাবালী)' },
      { id: 'Dumki', name: 'Dumki (দুমকি)' }
    ]
  },
  {
    id: 'Pirojpur',
    name: 'Pirojpur (পিরোজপুর)',
    division: 'Barishal',
    upazilas: [
      { id: 'Pirojpur Sadar', name: 'Pirojpur Sadar (পিরোজপুর সদর)' },
      { id: 'Bhandaria', name: 'Bhandaria (ভান্ডারিয়া)' },
      { id: 'Kawkhali', name: 'Kawkhali (কাউখালী)' },
      { id: 'Mathbaria', name: 'Mathbaria (মঠবাড়িয়া)' },
      { id: 'Nazirpur', name: 'Nazirpur (নাজিরপুর)' },
      { id: 'Nesarabad', name: 'Nesarabad / Swarupkati (নেছারাবাদ / স্বরূপকাঠি)' },
      { id: 'Indurkani', name: 'Indurkani / Zianagar (ইন্দুরকানী / জিয়ানগর)' }
    ]
  },

  // --- RANGPUR DIVISION ---
  {
    id: 'Rangpur',
    name: 'Rangpur (রংপুর)',
    division: 'Rangpur',
    upazilas: [
      { id: 'Rangpur Sadar', name: 'Rangpur Sadar (রংপুর সদর)' },
      { id: 'Badarganj', name: 'Badarganj (বদরগঞ্জ)' },
      { id: 'Gangachhara', name: 'Gangachhara (গংগাচড়া)' },
      { id: 'Kaunia', name: 'Kaunia (কাউনিয়া)' },
      { id: 'Mithapukur', name: 'Mithapukur (মিঠাপুকুর)' },
      { id: 'Pirgachha', name: 'Pirgachha (পীরগাছা)' },
      { id: 'Pirganj', name: 'Pirganj (পীরগঞ্জ)' },
      { id: 'Taraganj', name: 'Taraganj (তারাগঞ্জ)' }
    ]
  },
  {
    id: 'Dinajpur',
    name: 'Dinajpur (দিনাজপুর)',
    division: 'Rangpur',
    upazilas: [
      { id: 'Dinajpur Sadar', name: 'Dinajpur Sadar (দিনাজপুর সদর)' },
      { id: 'Birampur', name: 'Birampur (বিরামপুর)' },
      { id: 'Birganj', name: 'Birganj (বীরগঞ্জ)' },
      { id: 'Birol', name: 'Birol (বিরল)' },
      { id: 'Bochaganj', name: 'Bochaganj (বোচাগঞ্জ)' },
      { id: 'Chirirbandar', name: 'Chirirbandar (চিরিরবন্দর)' },
      { id: 'Phulbari', name: 'Phulbari (ফুলবাড়ী)' },
      { id: 'Ghoraghat', name: 'Ghoraghat (ঘোড়াঘাট)' },
      { id: 'Hakimpur', name: 'Hakimpur (হাকিমপুর)' },
      { id: 'Kaharole', name: 'Kaharole (কাহারোল)' },
      { id: 'Khansama', name: 'Khansama (খানসামা)' },
      { id: 'Nawabganj', name: 'Nawabganj (নবাবগঞ্জ)' },
      { id: 'Parbatipur', name: 'Parbatipur (পার্বতীপুর)' }
    ]
  },
  {
    id: 'Gaibandha',
    name: 'Gaibandha (গাইবান্ধা)',
    division: 'Rangpur',
    upazilas: [
      { id: 'Gaibandha Sadar', name: 'Gaibandha Sadar (গাইবান্ধা সদর)' },
      { id: 'Fulchhari', name: 'Fulchhari (ফুলছড়ি)' },
      { id: 'Gobindaganj', name: 'Gobindaganj (গোবিন্দগঞ্জ)' },
      { id: 'Palashbari', name: 'Palashbari (পলাশবাড়ী)' },
      { id: 'Sadullapur', name: 'Sadullapur (সাদুল্লাপুর)' },
      { id: 'Saghata', name: 'Saghata (সাঘাটা)' },
      { id: 'Sundarganj', name: 'Sundarganj (সুন্দরগঞ্জ)' }
    ]
  },
  {
    id: 'Kurigram',
    name: 'Kurigram (কুড়িগ্রাম)',
    division: 'Rangpur',
    upazilas: [
      { id: 'Kurigram Sadar', name: 'Kurigram Sadar (কুড়িগ্রাম সদর)' },
      { id: 'Bhurungamari', name: 'Bhurungamari (ভুরুঙ্গামারী)' },
      { id: 'Char Rajibpur', name: 'Char Rajibpur (চর রাজিবপুর)' },
      { id: 'Chilmari', name: 'Chilmari (চিলমারী)' },
      { id: 'Phulbari', name: 'Phulbari (ফুলবাড়ী)' },
      { id: 'Nageshwari', name: 'Nageshwari (নাগেশ্বরী)' },
      { id: 'Rajarhat', name: 'Rajarhat (রাজারহাট)' },
      { id: 'Raumari', name: 'Raumari (রৌমারী)' },
      { id: 'Ulipur', name: 'Ulipur (উলিপুর)' }
    ]
  },
  {
    id: 'Lalmonirhat',
    name: 'Lalmonirhat (লালমনিরহাট)',
    division: 'Rangpur',
    upazilas: [
      { id: 'Lalmonirhat Sadar', name: 'Lalmonirhat Sadar (লালমনিরহাট সদর)' },
      { id: 'Aditmari', name: 'Aditmari (আদিতমারী)' },
      { id: 'Hatibandha', name: 'Hatibandha (হাতীবান্ধা)' },
      { id: 'Kaliganj', name: 'Kaliganj (কালীগঞ্জ)' },
      { id: 'Patgram', name: 'Patgram (পাটগ্রাম)' }
    ]
  },
  {
    id: 'Nilphamari',
    name: 'Nilphamari (নীলফামারী)',
    division: 'Rangpur',
    upazilas: [
      { id: 'Nilphamari Sadar', name: 'Nilphamari Sadar (নীলফামারী সদর)' },
      { id: 'Dimla', name: 'Dimla (ডিমলা)' },
      { id: 'Domar', name: 'Domar (ডোমার)' },
      { id: 'Jaldhaka', name: 'Jaldhaka (জলঢাকা)' },
      { id: 'Kishoreganj', name: 'Kishoreganj (কিশোরগঞ্জ)' },
      { id: 'Saidpur', name: 'Saidpur (সৈয়দপুর)' }
    ]
  },
  {
    id: 'Panchagarh',
    name: 'Panchagarh (পঞ্চগড়)',
    division: 'Rangpur',
    upazilas: [
      { id: 'Panchagarh Sadar', name: 'Panchagarh Sadar (পঞ্চগড় সদর)' },
      { id: 'Atwari', name: 'Atwari (আটোয়ারী)' },
      { id: 'Boda', name: 'Boda (বোদা)' },
      { id: 'Debiganj', name: 'Debiganj (দেবীগঞ্জ)' },
      { id: 'Tetulia', name: 'Tetulia (তেতুলিয়া)' }
    ]
  },
  {
    id: 'Thakurgaon',
    name: 'Thakurgaon (ঠাকুরগাঁও)',
    division: 'Rangpur',
    upazilas: [
      { id: 'Thakurgaon Sadar', name: 'Thakurgaon Sadar (ঠাকুরগাঁও সদর)' },
      { id: 'Baliadangi', name: 'Baliadangi (বালিয়াডাঙ্গী)' },
      { id: 'Haripur', name: 'Haripur (হরিপুর)' },
      { id: 'Pirganj', name: 'Pirganj (পীরগঞ্জ)' },
      { id: 'Ranisankail', name: 'Ranisankail (রাণীশংকৈল)' }
    ]
  },

  // --- MYMENSINGH DIVISION ---
  {
    id: 'Mymensingh',
    name: 'Mymensingh (ময়মনসিংহ)',
    division: 'Mymensingh',
    upazilas: [
      { id: 'Mymensingh Sadar', name: 'Mymensingh Sadar (ময়মনসিংহ সদর)' },
      { id: 'Bhaluka', name: 'Bhaluka (ভালুকা)' },
      { id: 'Dhobaura', name: 'Dhobaura (ধোবাউড়া)' },
      { id: 'Fulbaria', name: 'Fulbaria (ফুলবাড়ীয়া)' },
      { id: 'Gaffargaon', name: 'Gaffargaon (গফরগাঁও)' },
      { id: 'Gauripur', name: 'Gauripur (গৌরীপুর)' },
      { id: 'Haluaghat', name: 'Haluaghat (হালুয়াঘাট)' },
      { id: 'Ishwarganj', name: 'Ishwarganj (ঈশ্বরগঞ্জ)' },
      { id: 'Muktagachha', name: 'Muktagachha (মুক্তাগাছা)' },
      { id: 'Nandail', name: 'Nandail (নান্দাইল)' },
      { id: 'Phulpur', name: 'Phulpur (ফুলপুর)' },
      { id: 'Trishal', name: 'Trishal (ত্রিশাল)' },
      { id: 'Tara Khanda', name: 'Tara Khanda (তারাকান্দা)' }
    ]
  },
  {
    id: 'Jamalpur',
    name: 'Jamalpur (জামালপুর)',
    division: 'Mymensingh',
    upazilas: [
      { id: 'Jamalpur Sadar', name: 'Jamalpur Sadar (জামালপুর সদর)' },
      { id: 'Bakshiganj', name: 'Bakshiganj (বকশীগঞ্জ)' },
      { id: 'Dewanganj', name: 'Dewanganj (দেওয়ানগঞ্জ)' },
      { id: 'Islampur', name: 'Islampur (ইসলামপুর)' },
      { id: 'Madarganj', name: 'Madarganj (মাদারগঞ্জ)' },
      { id: 'Melandaha', name: 'Melandaha (মেলান্দহ)' },
      { id: 'Sarishabari', name: 'Sarishabari (সরিষাবাড়ী)' }
    ]
  },
  {
    id: 'Netrokona',
    name: 'Netrokona (নেত্রকোণা)',
    division: 'Mymensingh',
    upazilas: [
      { id: 'Netrokona Sadar', name: 'Netrokona Sadar (নেত্রকোণা সদর)' },
      { id: 'Atpara', name: 'Atpara (আটপাড়া)' },
      { id: 'Barhatta', name: 'Barhatta (বারহাট্টা)' },
      { id: 'Durgapur', name: 'Durgapur (দুর্গাপুর)' },
      { id: 'Khaliajuri', name: 'Khaliajuri (খালিয়াজুরী)' },
      { id: 'Kalmakanda', name: 'Kalmakanda (কলমাকান্দা)' },
      { id: 'Kendua', name: 'Kendua (কেন্দুয়া)' },
      { id: 'Madan', name: 'Madan (মদন)' },
      { id: 'Mohanganj', name: 'Mohanganj (মোহনগঞ্জ)' },
      { id: 'Purbadhala', name: 'Purbadhala (পূর্বধলা)' }
    ]
  },
  {
    id: 'Sherpur',
    name: 'Sherpur (শেরপুর)',
    division: 'Mymensingh',
    upazilas: [
      { id: 'Sherpur Sadar', name: 'Sherpur Sadar (শেরপুর সদর)' },
      { id: 'Jhenaigati', name: 'Jhenaigati (ঝিনাইগাতী)' },
      { id: 'Nakla', name: 'Nakla (নকলা)' },
      { id: 'Nalitabari', name: 'Nalitabari (নালিতাবাড়ী)' },
      { id: 'Sreebardi', name: 'Sreebardi (শ্রীবরদী)' }
    ]
  }
];

export const getDistrictById = (idOrName: string): District | undefined => {
  if (!idOrName) return undefined;
  const raw = idOrName.trim().toLowerCase();
  const cleanId = raw.replace(/\s*\(.*?\)/g, '').trim();

  // 1. Direct ID match
  let found = BANGLADESH_DISTRICTS.find(d => 
    d.id.toLowerCase() === raw || 
    d.id.toLowerCase() === cleanId
  );
  if (found) return found;

  // 2. Direct Name match
  found = BANGLADESH_DISTRICTS.find(d => 
    d.name.toLowerCase() === raw || 
    d.name.toLowerCase().includes(raw) || 
    (cleanId.length >= 3 && d.id.toLowerCase().includes(cleanId))
  );
  if (found) return found;

  // 3. Known Aliases for legacy English variations
  const aliases: Record<string, string> = {
    'chittagong': 'Chattogram',
    'chattagram': 'Chattogram',
    'bogra': 'Bogura',
    'barisal': 'Barishal',
    'comilla': 'Cumilla',
    'jessore': 'Jashore',
    'coxs bazar': "Cox's Bazar",
    'coxsbazar': "Cox's Bazar",
    'moulvibazar': 'Moulvibazar',
    'maulvibazar': 'Moulvibazar',
    'chapainawabganj': 'Chapai Nawabganj',
    'chapai nawabganj': 'Chapai Nawabganj',
    'netrakona': 'Netrokona',
  };
  const aliasTarget = aliases[cleanId] || aliases[raw];
  if (aliasTarget) {
    found = BANGLADESH_DISTRICTS.find(d => d.id.toLowerCase() === aliasTarget.toLowerCase());
    if (found) return found;
  }

  // 4. Bengali name match
  found = BANGLADESH_DISTRICTS.find(d => {
    const match = d.name.match(/\((.*?)\)/);
    if (match && match[1]) {
      const bn = match[1].trim();
      return bn === raw || bn.includes(raw) || raw.includes(bn);
    }
    return false;
  });
  if (found) return found;

  // 5. Partial fallback match
  return BANGLADESH_DISTRICTS.find(d => 
    d.id.toLowerCase().includes(cleanId) || 
    cleanId.includes(d.id.toLowerCase())
  );
};

export const getUpazilasByDistrict = (districtId: string): Upazila[] => {
  const district = getDistrictById(districtId);
  return district ? district.upazilas : [];
};

// Curated comprehensive areas for popular upazilas & unions
const CURATED_UPAZILA_AREAS: Record<string, string[]> = {
  // --- BARISHAL - BAKERGANJ (Matches user's reference) ---
  'Bakerganj': [
    'Bakerganj Darial',
    'Charamandi',
    'Garuria',
    'Kalaskati',
    'Padri Shibpur',
    'Sahebganj',
    'Bakerganj Sadar / Pourashava',
    'Dudhal',
    'Durgapur',
    'Faridpur',
    'Kabai',
    'Niamati',
    'Rangasree'
  ],
  'Barishal Sadar': [
    'Band Road / Sadar Road',
    'Natun Bazar',
    'Rupatali',
    'Amtala',
    'Chawkbazar',
    'Chandmari',
    'Kawnia',
    'Nobogram Road',
    'C&B Road',
    'Kashipur',
    'Jagorani',
    'Chadmari',
    'Barishal University Area',
    'Nathullabad Bus Stand'
  ],
  'Babuganj': ['Babuganj Sadar', 'Dehergati', 'Madhabpasha', 'Chandpasha', 'Kedarpur', 'Jahangirnagar', 'Rahmatpur'],
  'Gaurnadi': ['Gaurnadi Pourashava', 'Barthi', 'Chandshi', 'Mahilara', 'Nalchira', 'Sarikal', 'Tarki Bandar'],
  'Banaripara': ['Banaripara Pourashava', 'Baisari', 'Chakhar', 'Iluhar', 'Salimpur', 'Udaypur', 'Saidpur'],

  // --- DHAKA ---
  'Dhanmondi': [
    'Dhanmondi 27 / Road 27',
    'Dhanmondi 32',
    'Satmasjid Road',
    'Shankar',
    'Kalabagan',
    'Jigatola',
    'Sukrabad',
    'Sobhanbagh',
    'Rayer Bazar',
    'Science Lab Area'
  ],
  'Gulshan': [
    'Gulshan 1',
    'Gulshan 2',
    'Gulshan Circle 1',
    'Gulshan Circle 2',
    'Gulshan Avenue',
    'Niketan',
    'Police Plaza Area',
    'Gulshan South Avenue'
  ],
  'Banani': [
    'Banani Block A-D',
    'Banani Block E-H',
    'Kemal Ataturk Avenue',
    'Kakoli',
    'Chairman Bari',
    'Banani DOHS',
    'Banani Super Market'
  ],
  'Uttara': [
    'Uttara Sector 1',
    'Uttara Sector 3',
    'Uttara Sector 4',
    'Uttara Sector 6',
    'Uttara Sector 7',
    'Uttara Sector 9',
    'Uttara Sector 10',
    'Uttara Sector 11',
    'Uttara Sector 12',
    'Uttara Sector 13',
    'Uttara Sector 14',
    'Abdullahpur',
    'House Building',
    'Azampur',
    'Jasimuddin Road'
  ],
  'Mirpur': [
    'Mirpur 1',
    'Mirpur 2',
    'Mirpur 6',
    'Mirpur 10',
    'Mirpur 11',
    'Mirpur 12',
    'Mirpur 14',
    'Pallabi',
    'Kazipara',
    'Shewrapara',
    'Rupnagar',
    'Paikpara'
  ],
  'Mohammadpur': [
    'Mohammadpur Town Hall',
    'Tajmahal Road',
    'Noorjahan Road',
    'Ring Road',
    'Salimullah Road',
    'Iqbal Road',
    'Japan Garden City',
    'Bosila',
    'Chandrima Model Town',
    'Katasur'
  ],
  'Savar': [
    'Savar Bazar',
    'Savar EPZ',
    'Ashulia',
    'Baipail',
    'Hemayetpur',
    'Dhamrai Road',
    'Zirabo',
    'Jamgora',
    'Nabinagar',
    'Jahangirnagar University Area'
  ],
  'Keraniganj': [
    'Zinjira',
    'Aganagar',
    'Rohitpur',
    'Hasnabad',
    'Chunkutia',
    'Kadamtali',
    'Shubhadya',
    'Kalindi'
  ],

  // --- SYLHET ---
  'Sylhet Sadar': [
    'Zindabazar',
    'Bandar Bazar',
    'Amberkhana',
    'Shibganj',
    'Shahjalal Upashahar',
    'Mirabazar',
    'Chouhatta',
    'Subidbazar',
    'Kumarpara',
    'Lama Bazar',
    'Tilagarh',
    'Majortila',
    'Kadamtali',
    'Pathantula',
    'Akhalia',
    'Medical Road',
    'Nayasarak',
    'Kazitula'
  ],
  'Golapganj': [
    'Golapganj Pourashava',
    'Dhaka Dakshin',
    'Bhadeshwar',
    'Amura',
    'Badepasha',
    'Bagha',
    'Budhbaribazar',
    'Sharifganj',
    'Lakshmipasha'
  ],
  'Beanibazar': [
    'Beanibazar Pourashava',
    'Alinagar',
    'Charkhai',
    'Dubag',
    'Kurar Bazar',
    'Lauta',
    'Mathiura',
    'Mollapur',
    'Muria',
    'Sheola',
    'Tilpara'
  ],
  'Bishwanath': [
    'Bishwanath Sadar',
    'Dashghar',
    'Deokalas',
    'Daulatpur',
    'Khajanchi',
    'Lamakazi',
    'Rampasha'
  ],
  'Zakiganj': [
    'Zakiganj Pourashava',
    'Barahal',
    'Barathakuri',
    'Khasri',
    'Kajalshah',
    'Manikpur',
    'Sultanpur'
  ],

  // --- CHATTOGRAM ---
  'Kotwali': [
    'Anderkilla',
    'New Market Area',
    'Laldighi',
    'Terribazar',
    'Chawkbazar',
    'Khatunganj',
    'Asadganj',
    'Firingibazar',
    'Alkar More',
    'Nandan Kanan'
  ],
  'Panchlaish': [
    'GEC Circle',
    'Nasirabad',
    'Probartak',
    'Khulshi',
    'Muradpur',
    'Sholashahar',
    'Gate No. 2'
  ],
  'Agrabad': [
    'Agrabad C/A',
    'Badamtoli',
    'Choto Pool',
    'Boro Pool',
    'Chowdhury Para',
    'Agrabad Access Road'
  ],
  'Halishahar': [
    'Block A',
    'Block B',
    'Block G',
    'Block H',
    'Block K',
    'Block L',
    'Port Connecting Road',
    'Boro Pol'
  ],
  'Hathazari': [
    'Hathazari Sadar',
    'Chittagong University Area (CU)',
    'Fatehabad',
    'Aman Bazar',
    'Nazirhat',
    'Farhadabad',
    'Miranerhat'
  ],
  'Ukhiya': [
    'কাস্টম বালুখালী (Custom Balukhali)',
    'বালুখালী (Balukhali)',
    'উখিয়া সদর (Ukhiya Sadar)',
    'কোটবাজার (Court Bazar)',
    'কুতুপালং (Kutupalong)',
    'পালংখালী (Palongkhali)',
    'রাজাপালং (Rajapalong)',
    'জালিয়াপালং (Jalia Palong)',
    'ইনানী (Inani Beach Area)',
    'রত্নাপালং (Ratnapalong)'
  ],
  'Coxs Bazar Sadar': [
    'কলাতলী (Kolatoli)',
    'লাবণী পয়েন্ট (Laboni Point)',
    'ঝাউতলা (Jhawtala)',
    'পানবাজার (Pan Bazar)',
    'বড়বাজার (Boro Bazar)',
    'টেকপাড়া (Tekpara)',
    'লিংক রোড (Link Road)'
  ]
};

export const getAreasByDistrictAndUpazila = (districtId: string, upazilaId: string): Area[] => {
  if (!districtId || !upazilaId) return [];

  // Normalize ID for lookup
  const cleanUpazilaId = upazilaId.replace(/\s*\(.*?\)/g, '').trim();
  
  // 1. Check curated custom list
  if (CURATED_UPAZILA_AREAS[cleanUpazilaId]) {
    return CURATED_UPAZILA_AREAS[cleanUpazilaId].map(areaName => ({
      id: areaName,
      name: areaName
    }));
  }

  // 2. Check if upazila has specific areas declared in upazila object
  const district = getDistrictById(districtId);
  if (district) {
    const upazila = district.upazilas.find(u => u.id === upazilaId || u.name === upazilaId || u.id === cleanUpazilaId);
    if (upazila && upazila.areas && upazila.areas.length > 0) {
      return upazila.areas;
    }
  }

  // 3. Fallback: Generate authentic, comprehensive locality / union / ward list for this upazila
  const cleanName = cleanUpazilaId || upazilaId;
  const standardLocalities = [
    `${cleanName} Sadar / Center (সদর)`,
    `${cleanName} Pourashava / Municipal Area (পৌরসভা)`,
    `${cleanName} Bazar / Main Market (বাজার এলাকা)`,
    `${cleanName} Bus Stand / Station Road (বাসস্ট্যান্ড)`,
    `${cleanName} College Road / Hospital Area (কলেজ রোড)`,
    `${cleanName} Purba / East Union (পূর্ব ইউনিয়ন)`,
    `${cleanName} Paschim / West Union (পশ্চিম ইউনিয়ন)`,
    `${cleanName} Uttar / North Union (উত্তর ইউনিয়ন)`,
    `${cleanName} Dakshin / South Union (দক্ষিণ ইউনিয়ন)`,
    `${cleanName} Ward No 1-3 Area (ওয়ার্ড ১-৩)`,
    `${cleanName} Ward No 4-6 Area (ওয়ার্ড ৪-৬)`,
    `${cleanName} Ward No 7-9 Area (ওয়ার্ড ৭-৯)`,
    `${cleanName} Rural / Gramin Area (গ্রামীন এলাকা)`
  ];

  return standardLocalities.map(name => ({
    id: name,
    name: name
  }));
};

