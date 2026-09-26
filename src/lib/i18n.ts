import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Comprehensive dictionary for RJ WORLD BD
export const translations = {
  en: {
    // Header & Navigation
    'RJ WORLD BD': 'RJ WORLD BD',
    'Search products...': 'Search products...',
    'Search': 'Search',
    'Dhaka': 'Dhaka',
    'Bangladesh': 'Bangladesh',
    'Notifications': 'Notifications',
    'Notification': 'Notification',
    'Wishlist': 'Wishlist',
    'Cart': 'Cart',
    'Sign In': 'Sign In',
    'Create Account': 'Create Account',
    'Admin Panel': 'Admin Panel',
    'Orders': 'Orders',
    'Account': 'Account',
    'Dashboard': 'Dashboard',
    'Logout': 'Logout',
    'Home': 'Home',
    'Reseller': 'Reseller',
    'My Store': 'My Store',
    'Profile': 'Profile',
    'Language': 'Language',
    'English': 'English',
    'বাংলা': 'বাংলা',
    
    // Categories
    'Categories': 'Categories',
    'ক্যাটাগরি': 'Categories',
    'All Categories': 'All Categories',
    'Electronics': 'Electronics',
    'Fashion': 'Fashion',
    'Beauty & Personal Care': 'Beauty & Personal Care',
    'Home & Living': 'Home & Living',
    'Grocery & Food': 'Grocery & Food',
    'Health & Wellness': 'Health & Wellness',
    'Baby & Kids': 'Baby & Kids',
    'Sports & Outdoor': 'Sports & Outdoor',
    'Automotive & Motorbike': 'Automotive & Motorbike',
    'Books & Stationery': 'Books & Stationery',
    'Computer & Gaming': 'Computer & Gaming',
    'Jewelry & Accessories': 'Jewelry & Accessories',
    'Agriculture & Gardening': 'Agriculture & Gardening',
    'Pet Supplies': 'Pet Supplies',
    'Others': 'Others',
    'All Brands': 'All Brands',

    // Product Section & Card
    'Add to Cart': 'Add to Cart',
    'Buy Now': 'Buy Now',
    'In Stock': 'In Stock',
    'Out of Stock': 'Out of Stock',
    'Price': 'Price',
    'Regular Price': 'Regular Price',
    'Sale Price': 'Sale Price',
    'Discount': 'Discount',
    'Quantity': 'Quantity',
    'Description': 'Description',
    'Specifications': 'Specifications',
    'Customer Reviews': 'Customer Reviews',
    'Related Products': 'Related Products',
    'Reviews': 'Reviews',
    'Ratings': 'Ratings',
    'Rating': 'Rating',
    'Share': 'Share',
    'Free Delivery': 'Free Delivery',
    'Cash on Delivery Available': 'Cash on Delivery Available',
    '7 Days Return': '7 Days Return',
    'Warranty': 'Warranty',
    'Sold by': 'Sold by',
    'Visit Store': 'Visit Store',
    'Verified Seller': 'Verified Seller',
    'Color': 'Color',
    'Size': 'Size',
    'Select Variant': 'Select Variant',
    'View Details': 'View Details',
    'Popular Products': 'Popular Products',
    'Featured Products': 'Featured Products',
    'New Arrivals': 'New Arrivals',
    'Best Sellers': 'Best Sellers',
    'Flash Sale': 'Flash Sale',
    'Trending Now': 'Trending Now',
    'Total Sold': 'Total Sold',
    'items': 'items',
    'item': 'item',
    'Clear Filters': 'Clear Filters',
    'Filters': 'Filters',
    'Filter': 'Filter',
    'Sort by': 'Sort by',
    'Price: Low to High': 'Price: Low to High',
    'Price: High to Low': 'Price: High to Low',
    'Latest': 'Latest',
    'Popular': 'Popular',
    'Top Rated': 'Top Rated',
    'No products found': 'No products found',
    'Results': 'Results',
    'results': 'results',
    'Store Top Pick': 'Store Top Pick',
    'Top customer favorite products in store': 'Top customer favorite products in store',
    'Drag or swipe': 'Drag or swipe',
    'Store Price:': 'Store Price:',
    'No reviews': 'No reviews',
    'sold': 'sold',
    'Invite Friends': 'Invite Friends',

    // Cart & Checkout
    'Shopping Cart': 'Shopping Cart',
    'Your cart is empty': 'Your cart is empty',
    'Continue Shopping': 'Continue Shopping',
    'Proceed to Checkout': 'Proceed to Checkout',
    'Order Summary': 'Order Summary',
    'Subtotal': 'Subtotal',
    'Delivery Fee': 'Delivery Fee',
    'Shipping': 'Shipping',
    'Estimated Delivery': 'Estimated Delivery',
    'Total': 'Total',
    'Grand Total': 'Grand Total',
    'Coupon Code': 'Coupon Code',
    'Apply': 'Apply',
    'Remove': 'Remove',
    'Checkout': 'Checkout',
    'Shipping Address': 'Shipping Address',
    'Full Name': 'Full Name',
    'Phone Number': 'Phone Number',
    'Alternative Phone': 'Alternative Phone',
    'Division': 'Division',
    'District': 'District',
    'Upazila / Thana': 'Upazila / Thana',
    'Delivery Address': 'Delivery Address',
    'Order Notes': 'Order Notes',
    'Payment Method': 'Payment Method',
    'Cash on Delivery': 'Cash on Delivery',
    'Online Payment': 'Online Payment',
    'Place Order': 'Place Order',
    'Confirm Order': 'Confirm Order',
    'Order Placed Successfully!': 'Order Placed Successfully!',
    'Items in Cart': 'Items in Cart',

    // Orders & Tracking
    'My Orders': 'My Orders',
    'Order ID': 'Order ID',
    'Order Date': 'Order Date',
    'Status': 'Status',
    'Pending': 'Pending',
    'Processing': 'Processing',
    'Shipped': 'Shipped',
    'Delivered': 'Delivered',
    'Cancelled': 'Cancelled',
    'Returned': 'Returned',
    'To Pay': 'To Pay',
    'To Ship': 'To Ship',
    'To Receive': 'To Receive',
    'Track Order': 'Track Order',
    'Order Details': 'Order Details',
    'View All': 'View All',
    'Track': 'Track',
    'Tracking Number': 'Tracking Number',
    'Courier Tracking': 'Courier Tracking',
    'Write a Review': 'Write a Review',

    // Profile & Dashboard & Wallet
    'My Account': 'My Account',
    'Total Balance': 'Total Balance',
    'Available Balance': 'Available Balance',
    'Pending Balance': 'Pending Balance',
    'Withdraw': 'Withdraw',
    'Wallet': 'Wallet',
    'Deposit': 'Deposit',
    'Transactions': 'Transactions',
    'Transaction History': 'Transaction History',
    'Edit Profile': 'Edit Profile',
    'Change Password': 'Change Password',
    'Saved Addresses': 'Saved Addresses',
    'Shipping Address Book': 'Shipping Address Book',
    'Saved Cards': 'Saved Cards',
    'Pickup Points': 'Pickup Points',
    'My Reviews': 'My Reviews',
    'My Chats': 'My Chats',
    'Customer Care': 'Customer Care',
    'Help Center': 'Help Center',
    'Payment Methods': 'Payment Methods',
    'Coupons': 'Coupons',
    'Settings': 'Settings',
    'Refer & Earn': 'Refer & Earn',
    'Security': 'Security',
    'My Services': 'My Services',
    'Active User': 'Active User',
    'Account Settings': 'Account Settings',
    'Personal Info': 'Personal Info',

    // Vendor Section
    'Vendor Dashboard': 'Vendor Dashboard',
    'Become a Vendor': 'Become a Vendor',
    'Vendor Application': 'Vendor Application',
    'Store Profile': 'Store Profile',
    'Shop Profile': 'Shop Profile',
    'Shop Settings': 'Shop Settings',
    'Products List': 'Products List',
    'Add Product': 'Add Product',
    'Edit Product': 'Edit Product',
    'Inventory': 'Inventory',
    'Orders List': 'Orders List',
    'Earnings': 'Earnings',
    'Platform Fee': 'Platform Fee',
    'Vendor Helpline': 'Vendor Helpline',
    'Product Boost': 'Product Boost',
    'Product Ads': 'Product Ads',
    'Vendor Reviews': 'Vendor Reviews',
    'Vendor Customers': 'Vendor Customers',
    'Store Name': 'Store Name',

    // Reseller Section
    'Reseller Dashboard': 'Reseller Dashboard',
    'Reseller Hub': 'Reseller Hub',
    'Apply as Reseller': 'Apply as Reseller',
    'Reseller Application': 'Reseller Application',
    'Reseller Products': 'Reseller Products',
    'My Reseller Shop': 'My Reseller Shop',
    'Shop Management': 'Shop Management',
    'Commissions': 'Commissions',
    'My Team': 'My Team',
    'Leadership': 'Leadership',
    'Referral Link': 'Referral Link',
    'Profit Margin': 'Profit Margin',
    'Base Price': 'Base Price',
    'Selling Price': 'Selling Price',
    'Your Profit': 'Your Profit',
    'Reseller Withdraw': 'Reseller Withdraw',

    // Auth
    'Login': 'Login',
    'Sign In to Your Account': 'Sign In to Your Account',
    'Register': 'Register',
    'Create a New Account': 'Create a New Account',
    'Email Address': 'Email Address',
    'Email': 'Email',
    'Password': 'Password',
    'Confirm Password': 'Confirm Password',
    'Forgot Password?': 'Forgot Password?',
    'Remember Me': 'Remember Me',
    'Don\'t have an account?': "Don't have an account?",
    'Already have an account?': 'Already have an account?',
    'Reset Password': 'Reset Password',
    'Send Reset Link': 'Send Reset Link',

    // Footer
    'Quick Links': 'Quick Links',
    'Customer Service': 'Customer Service',
    'Contact Info': 'Contact Info',
    'About Us': 'About Us',
    'Contact Us': 'Contact Us',
    'FAQ': 'FAQ',
    'Blog': 'Blog',
    'Terms of Service': 'Terms of Service',
    'Privacy Policy': 'Privacy Policy',
    'Returns & Exchanges': 'Returns & Exchanges',
    'Shipping Info': 'Shipping Info',
    'All rights reserved.': 'All rights reserved.',

    // Common Buttons & Modals & Messages
    'Save': 'Save',
    'Save Changes': 'Save Changes',
    'Cancel': 'Cancel',
    'Confirm': 'Confirm',
    'Delete': 'Delete',
    'Edit': 'Edit',
    'Close': 'Close',
    'Back': 'Back',
    'Next': 'Next',
    'Previous': 'Previous',
    'Submit': 'Submit',
    'Loading...': 'Loading...',
    'Success': 'Success',
    'Error': 'Error',
    'Warning': 'Warning',
    'Copied to clipboard!': 'Copied to clipboard!',
    'Please fill in all required fields': 'Please fill in all required fields',
    'Action Successful': 'Action Successful',
    'Something went wrong': 'Something went wrong',
  },
  bn: {
    // Header & Navigation
    'RJ WORLD BD': 'RJ WORLD BD',
    'Search products...': 'পণ্য খুঁজুন...',
    'Search': 'খুঁজুন',
    'Dhaka': 'ঢাকা',
    'Bangladesh': 'বাংলাদেশ',
    'Notifications': 'নোটিফিকেশন',
    'Notification': 'নোটিফিকেশন',
    'Wishlist': 'উইশলিস্ট',
    'Cart': 'কার্ট',
    'Sign In': 'সাইন ইন',
    'Create Account': 'অ্যাকাউন্ট তৈরি',
    'Admin Panel': 'অ্যাডমিন প্যানেল',
    'Orders': 'অর্ডারসমূহ',
    'Account': 'অ্যাকাউন্ট',
    'Dashboard': 'ড্যাশবোর্ড',
    'Logout': 'লগআউট',
    'Home': 'হোম',
    'Reseller': 'রিসেলার',
    'My Store': 'আমার শপ',
    'Profile': 'প্রোফাইল',
    'Language': 'ভাষা',
    'English': 'English',
    'বাংলা': 'বাংলা',
    
    // Categories
    'Categories': 'ক্যাটাগরি',
    'ক্যাটাগরি': 'ক্যাটাগরি',
    'All Categories': 'সকল ক্যাটাগরি',
    'Electronics': 'ইলেকট্রনিক্স',
    'Fashion': 'ফ্যাশন',
    'Beauty & Personal Care': 'বিউটি ও পার্সোনাল কেয়ার',
    'Home & Living': 'হোম ও লিভিং',
    'Grocery & Food': 'মুদি ও খাদ্যসামগ্রী',
    'Health & Wellness': 'স্বাস্থ্য ও সুস্থতা',
    'Baby & Kids': 'শিশু ও বাচ্চাদের পণ্য',
    'Sports & Outdoor': 'খেলাধুলা ও আউটডোর',
    'Automotive & Motorbike': 'মোটরযান ও পার্টস',
    'Books & Stationery': 'বই ও স্টেশনারি',
    'Computer & Gaming': 'কম্পিউটার ও গেমিং',
    'Jewelry & Accessories': 'জুয়েলারি ও এক্সেসরিজ',
    'Agriculture & Gardening': 'কৃষি ও বাগান',
    'Pet Supplies': 'পোষা প্রাণীর যত্ন',
    'Others': 'অন্যান্য',
    'All Brands': 'সকল ব্র্যান্ড',

    // Product Section & Card
    'Add to Cart': 'কার্টে যোগ করুন',
    'Buy Now': 'এখনই কিনুন',
    'In Stock': 'স্টকে আছে',
    'Out of Stock': 'স্টক শেষ',
    'Price': 'দাম',
    'Regular Price': 'নিয়মিত মূল্য',
    'Sale Price': 'অফার মূল্য',
    'Discount': 'ছাড়',
    'Quantity': 'পরিমাণ',
    'Description': 'বিবরণ',
    'Specifications': 'স্পেসিফিকেশন',
    'Customer Reviews': 'গ্রাহক রিভিউ',
    'Related Products': 'সম্পর্কিত পণ্যসমূহ',
    'Reviews': 'রিভিউ',
    'Ratings': 'রেটিং',
    'Rating': 'রেটিং',
    'Share': 'শেয়ার',
    'Free Delivery': 'ফ্রি ডেলিভারি',
    'Cash on Delivery Available': 'ক্যাশ অন ডেলিভারি সুবিধা আছে',
    '7 Days Return': '৭ দিনের রিটার্ন',
    'Warranty': 'ওয়ারেন্টি',
    'Sold by': 'বিক্রেতা',
    'Visit Store': 'দোকান ভিজিট করুন',
    'Verified Seller': 'যাচাইকৃত বিক্রেতা',
    'Color': 'রং',
    'Size': 'সাইজ',
    'Select Variant': 'ভ্যারিয়েন্ট নির্বাচন করুন',
    'View Details': 'বিস্তারিত দেখুন',
    'Popular Products': 'জনপ্রিয় পণ্য',
    'Featured Products': 'ফিচার্ড পণ্যসমূহ',
    'New Arrivals': 'নতুন পণ্যসমূহ',
    'Best Sellers': 'সেরা বিক্রিত পণ্য',
    'Flash Sale': 'ফ্ল্যাশ সেল',
    'Trending Now': 'জনপ্রিয় ট্রেন্ডিং',
    'Total Sold': 'মোট বিক্রি',
    'items': 'টি পণ্য',
    'item': 'টি পণ্য',
    'Clear Filters': 'ফিল্টার মুছুন',
    'Filters': 'ফিল্টার',
    'Filter': 'ফিল্টার',
    'Sort by': 'সর্ট করুন',
    'Price: Low to High': 'মূল্য: কম থেকে বেশি',
    'Price: High to Low': 'মূল্য: বেশি থেকে কম',
    'Latest': 'সর্বশেষ',
    'Popular': 'জনপ্রিয়',
    'Top Rated': 'সেরা রেটিং',
    'No products found': 'কোনো পণ্য পাওয়া যায়নি',
    'Results': 'ফলাফল',
    'results': 'টি ফলাফল',
    'Store Top Pick': 'দোকানে সেরা পছন্দ',
    'Top customer favorite products in store': 'দোকানে এসে গ্রাহকদের পছন্দের শীর্ষে থাকা পণ্যসমূহ',
    'Drag or swipe': 'টেনে বা সোয়াইপ করুন',
    'Store Price:': 'স্টোর প্রাইস:',
    'No reviews': 'রিভিউ নেই',
    'sold': 'বিক্রি',
    'Invite Friends': 'বন্ধুদের আমন্ত্রণ জানান',

    // Cart & Checkout
    'Shopping Cart': 'শপিং কার্ট',
    'Your cart is empty': 'আপনার কার্ট খালি',
    'Continue Shopping': 'কেনাকাটা চালিয়ে যান',
    'Proceed to Checkout': 'চেকআউটে যান',
    'Order Summary': 'অর্ডার সারসংক্ষেপ',
    'Subtotal': 'সাবটোটাল',
    'Delivery Fee': 'ডেলিভারি চার্জ',
    'Shipping': 'শিপিং চার্জ',
    'Estimated Delivery': 'আনুমানিক ডেলিভারি',
    'Total': 'মোট',
    'Grand Total': 'সর্বমোট',
    'Coupon Code': 'কুপন কোড',
    'Apply': 'প্রয়োগ করুন',
    'Remove': 'মুছে ফেলুন',
    'Checkout': 'চেকআউট',
    'Shipping Address': 'ডেলিভারির ঠিকানা',
    'Full Name': 'পুরো নাম',
    'Phone Number': 'ফোন নম্বর',
    'Alternative Phone': 'বিকল্প ফোন নম্বর',
    'Division': 'বিভাগ',
    'District': 'জেলা',
    'Upazila / Thana': 'উপজেলা / থানা',
    'Delivery Address': 'ডেলিভারি ঠিকানা',
    'Order Notes': 'অর্ডার নোট (ঐচ্ছিক)',
    'Payment Method': 'মূল্য পরিশোধের পদ্ধতি',
    'Cash on Delivery': 'ক্যাশ অন ডেলিভারি',
    'Online Payment': 'অনলাইন পেমেন্ট',
    'Place Order': 'অর্ডার নিশ্চিত করুন',
    'Confirm Order': 'অর্ডার কনফার্ম করুন',
    'Order Placed Successfully!': 'অর্ডার সফলভাবে গ্রহণ করা হয়েছে!',
    'Items in Cart': 'কার্টের পণ্যসমূহ',

    // Orders & Tracking
    'My Orders': 'আমার অর্ডারসমূহ',
    'Order ID': 'অর্ডার আইডি',
    'Order Date': 'অর্ডারের তারিখ',
    'Status': 'অবস্থা',
    'Pending': 'অপেক্ষমান',
    'Processing': 'প্রক্রিয়াকরণ চলছে',
    'Shipped': 'শিপ করা হয়েছে',
    'Delivered': 'ডেলিভারি হয়েছে',
    'Cancelled': 'বাতিল করা হয়েছে',
    'Returned': 'রিটার্ন করা হয়েছে',
    'To Pay': 'পেমেন্ট বাকি',
    'To Ship': 'শিপিং বাকি',
    'To Receive': 'গ্রহণ বাকি',
    'Track Order': 'অর্ডার ট্র্যাক করুন',
    'Order Details': 'অর্ডারের বিবরণ',
    'View All': 'সব দেখুন',
    'Track': 'ট্র্যাক করুন',
    'Tracking Number': 'ট্র্যাকিং নম্বর',
    'Courier Tracking': 'কুরিয়ার ট্র্যাকিং',
    'Write a Review': 'রিভিউ লিখুন',

    // Profile & Dashboard & Wallet
    'My Account': 'আমার অ্যাকাউন্ট',
    'Total Balance': 'মোট ব্যালেন্স',
    'Available Balance': 'উত্তোলনযোগ্য ব্যালেন্স',
    'Pending Balance': 'অপেক্ষমান ব্যালেন্স',
    'Withdraw': 'উত্তোলন',
    'Wallet': 'ওয়ালেট',
    'Deposit': 'টাকা জমা / ডিপোজিট',
    'Transactions': 'লেনদেনসমূহ',
    'Transaction History': 'লেনদেনের ইতিহাস',
    'Edit Profile': 'প্রোফাইল পরিবর্তন',
    'Change Password': 'পাসওয়ার্ড পরিবর্তন',
    'Saved Addresses': 'সংরক্ষিত ঠিকানা',
    'Shipping Address Book': 'শিপিং অ্যাড্রেস বুক',
    'Saved Cards': 'সংরক্ষিত কার্ড',
    'Pickup Points': 'পিকআপ পয়েন্ট',
    'My Reviews': 'আমার রিভিউ',
    'My Chats': 'আমার চ্যাট',
    'Customer Care': 'কাস্টমার কেয়ার',
    'Help Center': 'সহায়তা কেন্দ্র',
    'Payment Methods': 'পেমেন্ট মাধ্যমসমূহ',
    'Coupons': 'কুপনসমূহ',
    'Settings': 'সেটিংস',
    'Refer & Earn': 'রেফার ও ইনকাম',
    'Security': 'নিরাপত্তা',
    'My Services': 'আমার সার্ভিসসমূহ',
    'Active User': 'সক্রিয় ব্যবহারকারী',
    'Account Settings': 'অ্যাকাউন্ট সেটিংস',
    'Personal Info': 'ব্যক্তিগত তথ্য',

    // Vendor Section
    'Vendor Dashboard': 'ভেন্ডর ড্যাশবোর্ড',
    'Become a Vendor': 'ভেন্ডর হোন',
    'Vendor Application': 'ভেন্ডর আবেদন',
    'Store Profile': 'দোকানের প্রোফাইল',
    'Shop Profile': 'শপ প্রোফাইল',
    'Shop Settings': 'শপ সেটিংস',
    'Products List': 'পণ্যের তালিকা',
    'Add Product': 'নতুন পণ্য যোগ',
    'Edit Product': 'পণ্য এডিট করুন',
    'Inventory': 'ইনভেন্টরি',
    'Orders List': 'অর্ডারের তালিকা',
    'Earnings': 'উপার্জন',
    'Platform Fee': 'প্ল্যাটফর্ম ফি',
    'Vendor Helpline': 'ভেন্ডর হেল্পলাইন',
    'Product Boost': 'পণ্য বুস্ট',
    'Product Ads': 'পণ্য বিজ্ঞাপন',
    'Vendor Reviews': 'ভেন্ডর রিভিউ',
    'Vendor Customers': 'ভেন্ডর ক্রেতাবৃন্দ',
    'Store Name': 'দোকানের নাম',

    // Reseller Section
    'Reseller Dashboard': 'রিসেলার ড্যাশবোর্ড',
    'Reseller Hub': 'রিসেলার হাব',
    'Apply as Reseller': 'রিসেলার হিসেবে আবেদন',
    'Reseller Application': 'রিসেলার আবেদনপত্র',
    'Reseller Products': 'রিসেলার পণ্যসমূহ',
    'My Reseller Shop': 'আমার রিসেলার শপ',
    'Shop Management': 'শপ পরিচালনা',
    'Commissions': 'কমিশন',
    'My Team': 'আমার টিম',
    'Leadership': 'লিডারশিপ',
    'Referral Link': 'রেফারেল লিংক',
    'Profit Margin': 'লাভের মার্জিন',
    'Base Price': 'মূল পাইকারি দাম',
    'Selling Price': 'বিক্রয় মূল্য',
    'Your Profit': 'আপনার লাভ',
    'Reseller Withdraw': 'রিসেলার উত্তোলন',

    // Auth
    'Login': 'লগইন',
    'Sign In to Your Account': 'আপনার অ্যাকাউন্টে লগইন করুন',
    'Register': 'নিবন্ধন',
    'Create a New Account': 'নতুন অ্যাকাউন্ট তৈরি করুন',
    'Email Address': 'ইমেইল অ্যাড্রেস',
    'Email': 'ইমেইল',
    'Password': 'পাসওয়ার্ড',
    'Confirm Password': 'পাসওয়ার্ড নিশ্চিত করুন',
    'Forgot Password?': 'পাসওয়ার্ড ভুলে গেছেন?',
    'Remember Me': 'আমাকে মনে রাখুন',
    'Don\'t have an account?': 'কোনো অ্যাকাউন্ট নেই?',
    'Already have an account?': 'ইতিমধ্যে অ্যাকাউন্ট আছে?',
    'Reset Password': 'পাসওয়ার্ড রিসেট করুন',
    'Send Reset Link': 'রিসেট লিংক পাঠান',

    // Footer
    'Quick Links': 'প্রয়োজনীয় লিংক',
    'Customer Service': 'গ্রাহক সেবা',
    'Contact Info': 'যোগাযোগের তথ্য',
    'About Us': 'আমাদের সম্পর্কে',
    'Contact Us': 'যোগাযোগ করুন',
    'FAQ': 'সাধারণ জিজ্ঞাসা',
    'Blog': 'ব্লগ',
    'Terms of Service': 'ব্যবহারের শর্তাবলী',
    'Privacy Policy': 'গোপনীয়তা নীতি',
    'Returns & Exchanges': 'রিটার্ন ও এক্সচেঞ্জ',
    'Shipping Info': 'ডেলিভারি তথ্য',
    'All rights reserved.': 'সর্বস্বত্ব সংরক্ষিত।',

    // Common Buttons & Modals & Messages
    'Save': 'সংরক্ষণ করুন',
    'Save Changes': 'পরিবর্তন সংরক্ষণ করুন',
    'Cancel': 'বাতিল',
    'Confirm': 'নিশ্চিত করুন',
    'Delete': 'মুছুন',
    'Edit': 'সম্পাদনা',
    'Close': 'বন্ধ করুন',
    'Back': 'ফিরে যান',
    'Next': 'পরবর্তী',
    'Previous': 'পূর্ববর্তী',
    'Submit': 'জমা দিন',
    'Loading...': 'লোড হচ্ছে...',
    'Success': 'সফল হয়েছে',
    'Error': 'ত্রুটি',
    'Warning': 'সতর্কতা',
    'Copied to clipboard!': 'ক্লিপবোর্ডে কপি করা হয়েছে!',
    'Please fill in all required fields': 'সবগুলো প্রয়োজনীয় তথ্য প্রদান করুন',
    'Action Successful': 'কাজটি সফলভাবে সম্পন্ন হয়েছে',
    'Something went wrong': 'কিছু একটা সমস্যা হয়েছে',
  }
};

// Bidirectional lookup dictionary for seamless DOM and context translation
export const EN_TO_BN: Record<string, string> = {
  ...translations.bn,
};

export const BN_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(translations.bn).map(([enKey, bnVal]) => [bnVal, enKey])
);

// Map common category slugs / names
export const CATEGORY_TRANSLATIONS: Record<string, { en: string; bn: string }> = {
  'electronics': { en: 'Electronics', bn: 'ইলেকট্রনিক্স' },
  'fashion': { en: 'Fashion', bn: 'ফ্যাশন' },
  'beauty-personal-care': { en: 'Beauty & Personal Care', bn: 'বিউটি ও পার্সোনাল কেয়ার' },
  'home-living': { en: 'Home & Living', bn: 'হোম ও লিভিং' },
  'grocery-food': { en: 'Grocery & Food', bn: 'মুদি ও খাদ্যসামগ্রী' },
  'health-wellness': { en: 'Health & Wellness', bn: 'স্বাস্থ্য ও সুস্থতা' },
  'baby-kids': { en: 'Baby & Kids', bn: 'শিশু ও বাচ্চাদের পণ্য' },
  'sports-outdoor': { en: 'Sports & Outdoor', bn: 'খেলাধুলা ও আউটডোর' },
  'automotive-motorbike': { en: 'Automotive & Motorbike', bn: 'মোটরযান ও পার্টস' },
  'books-stationery': { en: 'Books & Stationery', bn: 'বই ও স্টেশনারি' },
  'computer-gaming': { en: 'Computer & Gaming', bn: 'কম্পিউটার ও গেমিং' },
  'jewelry-accessories': { en: 'Jewelry & Accessories', bn: 'জুয়েলারি ও এক্সেসরিজ' },
  'agriculture-gardening': { en: 'Agriculture & Gardening', bn: 'কৃষি ও বাগান' },
  'pet-supplies': { en: 'Pet Supplies', bn: 'পোষা প্রাণীর যত্ন' },
  'others': { en: 'Others', bn: 'অন্যান্য' },
};

// Helper to get active language
export function getSavedLanguage(): 'en' | 'bn' {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem('rj_language') || localStorage.getItem('i18nextLng');
    if (saved && (saved.startsWith('bn') || saved === 'bn')) return 'bn';
    return 'en';
  } catch (e) {
    return 'en';
  }
}

// Helper to switch language
export function switchAppLanguage(lang: 'en' | 'bn') {
  const target = lang === 'bn' ? 'bn' : 'en';
  try {
    localStorage.setItem('rj_language', target);
    localStorage.setItem('i18nextLng', target);
  } catch (e) {
    // Ignore localStorage errors
  }

  if (document.documentElement) {
    document.documentElement.lang = target;
  }

  i18n.changeLanguage(target);

  // Dispatch custom event to notify any listeners immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rj-language-changed', { detail: { language: target } }));
  }
}

// Category translator helper
export function getCategoryDisplayName(cat: string | undefined | null, lang: 'en' | 'bn'): string {
  if (!cat) return '';
  const key = cat.toLowerCase().trim();
  const direct = CATEGORY_TRANSLATIONS[key];
  if (direct) return direct[lang];

  // Try matching against name
  for (const item of Object.values(CATEGORY_TRANSLATIONS)) {
    if (item.en.toLowerCase() === key || item.bn.toLowerCase() === key) {
      return item[lang];
    }
  }

  if (lang === 'bn') {
    return EN_TO_BN[cat] || cat;
  } else {
    return BN_TO_EN[cat] || cat;
  }
}

const initialLang = typeof window !== 'undefined' ? getSavedLanguage() : 'en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: initialLang,
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'rj_language',
    },
    resources: {
      en: {
        translation: translations.en,
      },
      bn: {
        translation: translations.bn,
      },
    },
    interpolation: {
      escapeValue: false,
    },
  });

// Keep html lang attribute in sync
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLang;
}

i18n.on('languageChanged', (lng) => {
  const norm = lng.startsWith('bn') ? 'bn' : 'en';
  try {
    localStorage.setItem('rj_language', norm);
    localStorage.setItem('i18nextLng', norm);
  } catch (e) {}
  if (typeof document !== 'undefined') {
    document.documentElement.lang = norm;
  }
});

export default i18n;
