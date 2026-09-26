/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./components/common/LanguageProvider";
import { NotificationProvider } from "./context/NotificationContext";
import { VendorStoreProvider } from "./context/VendorStoreContext";
import { VendorNotificationProvider } from "./context/VendorNotificationContext";
import { CartProvider } from "./contexts/CartContext";
import { WishlistProvider } from "./contexts/WishlistContext";
import { Toaster } from "react-hot-toast";
import { seedFirestoreInitialData } from "./lib/firebaseSeed";
import ScrollToTop from "./components/common/ScrollToTop";

// Pages
import MyChats from "./pages/chat/MyChats";
import ChatRoom from "./pages/chat/ChatRoom";
import VendorChats from "./pages/vendor/chat/VendorChats";
import VendorChatRoom from "./pages/vendor/chat/VendorChatRoom";
import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import VerifyEmail from "./pages/auth/VerifyEmail";
import ResetPassword from "./pages/auth/ResetPassword";
import Dashboard from "./pages/Dashboard";
import WalletPage from "./pages/profile/WalletPage";
import WithdrawPage from "./pages/profile/WithdrawPage";
import ReturnsPage from "./pages/profile/ReturnsPage";
import PickupPointsPage from "./pages/profile/PickupPointsPage";
import HelpCenterPage from "./pages/profile/HelpCenterPage";
import CustomerCarePage from "./pages/profile/CustomerCarePage";
import MyReviewsPage from "./pages/profile/MyReviewsPage";
import PaymentMethodsPage from "./pages/profile/PaymentMethodsPage";
import CouponsPage from "./pages/profile/CouponsPage";
import NotificationsPage from "./pages/profile/NotificationsPage";
import NotificationDetailPage from "./pages/notifications/NotificationDetailPage";
import SettingsPage from "./pages/profile/SettingsPage";
import ShippingAddressPage from "./pages/profile/ShippingAddressPage";
import SavedCardsPage from "./pages/profile/SavedCardsPage";
import SupportPage from "./pages/profile/SupportPage";
import PrivacyPolicyPage from "./pages/profile/PrivacyPolicyPage";
import AboutUsPage from "./pages/AboutUsPage";
import ContactUsPage from "./pages/ContactUsPage";
import FAQPage from "./pages/FAQPage";
import BlogPage from "./pages/BlogPage";
import ShippingInfoPage from "./pages/ShippingInfoPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import TrackOrderPage from "./pages/TrackOrderPage";
import CategoryView from "./pages/CategoryView";
import ProductDetails from "./pages/ProductDetails";
import ProductReviewsPage from "./pages/ProductReviewsPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderConfirmation from "./pages/OrderConfirmation";
import SofolXCallback from "./pages/payment/SofolXCallback";
import SofolXSandboxPortal from "./pages/payment/SofolXSandboxPortal";
import EmonPayCallback from "./pages/payment/EmonPayCallback";
import EmonPaySandboxPortal from "./pages/payment/EmonPaySandboxPortal";
import DeshiPayCallback from "./pages/payment/DeshiPayCallback";
import DeshiPaySandboxPortal from "./pages/payment/DeshiPaySandboxPortal";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailsPage from "./pages/OrderDetailsPage";
import WishlistPage from "./pages/WishlistPage";
import VendorStore from "./pages/VendorStore";
import AllBrands from "./pages/AllBrands";
import VendorApplication from "./pages/VendorApplication";
import ResellerApplication from "./pages/ResellerApplication";
import RjWorldBdSmsReaderApp from "./pages/sms-reader/RjWorldBdSmsReaderApp";

import ResellerDashboard from "./pages/reseller/ResellerDashboard";
import ResellerProducts from "./pages/reseller/products/ResellerProducts";
import ResellerWithdraw from "./pages/reseller/withdraw/ResellerWithdraw";
import ResellerTeam from "./pages/reseller/team/ResellerTeam";
import ResellerLeadership from "./pages/reseller/leadership/ResellerLeadership";
import ResellerCommissions from "./pages/reseller/commissions/ResellerCommissions";
import ResellerReferral from "./pages/reseller/referral/ResellerReferral";
import ResellerTracking from "./pages/reseller/tracking/ResellerTracking";
import ResellerShopManagement from "./pages/reseller/shop/ResellerShopManagement";
import ShopDomainWrapper from "./components/ShopDomainWrapper";
import RootRoute from "./components/RootRoute";
import PublicResellerShop from "./pages/reseller/shop/PublicResellerShop";

import VendorDashboard from "./pages/vendor/VendorDashboard";
import VendorRegistration from "./pages/vendor/auth/VendorRegistration";
import ProductsList from "./pages/vendor/products/ProductsList";
import AddProduct from "./pages/vendor/products/AddProduct";
import EditProduct from "./pages/vendor/products/EditProduct";
import InventoryDashboard from "./pages/vendor/inventory/InventoryDashboard";
import OrdersList from "./pages/vendor/orders/OrdersList";
import OrderDetails from "./pages/vendor/orders/OrderDetails";
import PlaceholderPage from "./pages/vendor/PlaceholderPage";
import VendorWallet from "./pages/vendor/wallet/VendorWallet";
import WithdrawDashboard from "./pages/vendor/withdraw/WithdrawDashboard";
import ShopProfile from "./pages/vendor/profile/ShopProfile";
import VendorNotifications from "./pages/vendor/VendorNotifications";
import VendorCustomers from "./pages/vendor/customers/VendorCustomers";
import VendorSettings from "./pages/vendor/settings/VendorSettings";
import VendorHelpline from "./pages/vendor/support/VendorHelpline";
import VendorProductBoost from "./pages/vendor/boost/VendorProductBoost";
import VendorProductAds from "./pages/vendor/ads/VendorProductAds";
import VendorReviewsPage from "./pages/vendor/reviews/VendorReviewsPage";
import VendorLogin from "./pages/vendor/auth/VendorLogin";
import ResellerLogin from "./pages/reseller/ResellerLogin";

// Components
import BottomNavigation from "./components/layout/BottomNavigation";

import AdminLayout from "./layouts/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetails from "./pages/admin/AdminUserDetails";
import AdminVendors from "./pages/admin/AdminVendors";
import AdminPlatformFee from "./pages/admin/AdminPlatformFee";
import VendorPlatformFee from "./pages/vendor/platform-fee/VendorPlatformFee";
import AdminResellers from "./pages/admin/AdminResellers";
import AdminVerifiedSellers from "./pages/admin/AdminVerifiedSellers";
import AdminMLM from "./pages/admin/AdminMLM";
import AdminCommissions from "./pages/admin/AdminCommissions";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminContent from "./pages/admin/AdminContent";
import AdminPricing from "./pages/admin/AdminPricing";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminOrderDetails from "./pages/admin/AdminOrderDetails";
import AdminDisputes from "./pages/admin/AdminDisputes";
import AdminRequiresAttention from "./pages/admin/AdminRequiresAttention";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminProductDetails from "./pages/admin/AdminProductDetails";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminCategoryDetails from "./pages/admin/AdminCategoryDetails";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminBannerDetails from "./pages/admin/AdminBannerDetails";
import AdminReports from "./pages/admin/AdminReports";
import AdminActivityLogs from "./pages/admin/AdminActivityLogs";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminStorageManagement from "./pages/admin/AdminStorageManagement";
import AdminDomainSettings from "./pages/admin/AdminDomainSettings";
import AdminSupportInbox from "./pages/admin/AdminSupportInbox";
import AdminCourierLinkReview from "./pages/admin/AdminCourierLinkReview";
import AdminResellerReviews from "./pages/admin/AdminResellerReviews";
import AdminResellerReturns from "./pages/admin/AdminResellerReturns";
import ResellerSupport from "./pages/reseller/support/ResellerSupport";

// Routes
import { PrivateRoute, PublicRoute, VendorRoute, ResellerRoute, AdminRoute, UserPanelRoute } from "./components/ProtectedRoute";
import SplashScreen from "./components/common/SplashScreen";

export default function App() {
  useEffect(() => {
    seedFirestoreInitialData();
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <SplashScreen />
      <NotificationProvider>
        <VendorStoreProvider>
          <VendorNotificationProvider>
            <CartProvider>
              <WishlistProvider>
          <Router>
            <ScrollToTop />
            <Toaster position="top-right" />
          <ShopDomainWrapper>
          <Routes>
            <Route path="/" element={<RootRoute />} />
              <Route path="/category/:categoryId" element={<CategoryView />} />
              <Route path="/products" element={<CategoryView />} />
              <Route path="/search" element={<CategoryView />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/product/:id/reviews" element={<ProductReviewsPage />} />
              <Route path="/shop/:shopSlug" element={<PublicResellerShop />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/store/:vendorId" element={<VendorStore />} />
              <Route path="/brands" element={<AllBrands />} />
              
              
              <Route path="/my-chats" element={
                <PrivateRoute>
                  <MyChats />
                </PrivateRoute>
              } />
              <Route path="/chat/:vendorId" element={
                <PrivateRoute>
                  <ChatRoom />
                </PrivateRoute>
              } />
              <Route path="/vendor/messages" element={
                <VendorRoute>
                  <VendorChats />
                </VendorRoute>
              } />
              <Route path="/vendor/chat/:customerId" element={
                <VendorRoute>
                  <VendorChatRoom />
                </VendorRoute>
              } />
              <Route path="/checkout" element={
                <PrivateRoute>
                  <CheckoutPage />
                </PrivateRoute>
              } />
              <Route path="/order-confirmation/:orderId" element={
                <PrivateRoute>
                  <OrderConfirmation />
                </PrivateRoute>
              } />
              <Route path="/payment/sofolx/callback" element={<SofolXCallback />} />
              <Route path="/payment/sofolx/portal" element={<SofolXSandboxPortal />} />
              <Route path="/payment/sofolx/sandbox-portal" element={<SofolXSandboxPortal />} />
              <Route path="/payment/emonpay/callback" element={<EmonPayCallback />} />
              <Route path="/payment/emonpay/sandbox-portal" element={<EmonPaySandboxPortal />} />
              <Route path="/payment/deshipay/callback" element={<DeshiPayCallback />} />
              <Route path="/payment/deshipay/sandbox-portal" element={<DeshiPaySandboxPortal />} />
              <Route path="/orders" element={
                <PrivateRoute>
                  <OrdersPage />
                </PrivateRoute>
              } />
              <Route path="/orders/:orderId" element={
                <PrivateRoute>
                  <OrderDetailsPage />
                </PrivateRoute>
              } />
              <Route path="/track-order/:orderId" element={
                <PrivateRoute>
                  <OrderDetailsPage />
                </PrivateRoute>
              } />
              <Route path="/track/:orderId" element={
                <PrivateRoute>
                  <OrderDetailsPage />
                </PrivateRoute>
              } />
              
              <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            <Route path="/register" element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            } />
            <Route path="/forgot-password" element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            } />
            <Route path="/reset-password" element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            } />
            <Route path="/__/auth/action" element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            } />
            <Route path="/verify-email" element={
              <PrivateRoute>
                <VerifyEmail />
              </PrivateRoute>
            } />
            
            <Route path="/wallet" element={<PrivateRoute><WalletPage /></PrivateRoute>} />
            <Route path="/withdraw" element={<PrivateRoute><WithdrawPage /></PrivateRoute>} />
            <Route path="/returns" element={<ReturnsPage />} />
            <Route path="/pickup-points" element={<PrivateRoute><PickupPointsPage /></PrivateRoute>} />
            <Route path="/help-center" element={<PrivateRoute><HelpCenterPage /></PrivateRoute>} />
            <Route path="/customer-care" element={<PrivateRoute><CustomerCarePage /></PrivateRoute>} />
            <Route path="/my-reviews" element={<PrivateRoute><MyReviewsPage /></PrivateRoute>} />
            <Route path="/payment-methods" element={<PrivateRoute><PaymentMethodsPage /></PrivateRoute>} />
            <Route path="/coupons" element={<PrivateRoute><CouponsPage /></PrivateRoute>} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/notification/:id" element={<NotificationDetailPage />} />
            <Route path="/notifications/:id" element={<NotificationDetailPage />} />
            <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
            <Route path="/shipping-address" element={<PrivateRoute><ShippingAddressPage /></PrivateRoute>} />
            <Route path="/saved-cards" element={<PrivateRoute><SavedCardsPage /></PrivateRoute>} />
            <Route path="/support" element={<PrivateRoute><SupportPage /></PrivateRoute>} />
            
            {/* Public Legal & Informational Pages */}
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
            <Route path="/about" element={<AboutUsPage />} />
            <Route path="/contact" element={<ContactUsPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/shipping" element={<ShippingInfoPage />} />
            <Route path="/track-order" element={<TrackOrderPage />} />
  
            <Route path="/account" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            <Route path="/dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            <Route path="/vendor-application" element={<Navigate to="/become-vendor" replace />} />
            
            <Route path="/vendor-login" element={<VendorLogin />} />
            <Route path="/vendor/login" element={<VendorLogin />} />
            <Route path="/reseller-login" element={<ResellerLogin />} />
            <Route path="/reseller/login" element={<ResellerLogin />} />
            <Route path="/become-vendor" element={<VendorRegistration />} />
            <Route path="/sms-reader" element={<RjWorldBdSmsReaderApp />} />
            
            <Route path="/reseller/apply" element={<ResellerApplication />} />
            <Route path="/become-reseller" element={<ResellerApplication />} />
            <Route path="/reseller/referrals" element={<ResellerRoute><ResellerReferral /></ResellerRoute>} />
            <Route path="/reseller/tracking" element={<ResellerRoute><ResellerTracking /></ResellerRoute>} />
            <Route path="/reseller/shop" element={<ResellerRoute><ResellerShopManagement /></ResellerRoute>} />
            <Route path="/reseller/dashboard" element={
              <ResellerRoute>
                <ResellerDashboard />
              </ResellerRoute>
            } />
            <Route path="/reseller/products" element={
              <ResellerRoute>
                <ResellerProducts />
              </ResellerRoute>
            } />
            <Route path="/reseller/withdraw" element={
              <ResellerRoute>
                <ResellerWithdraw />
              </ResellerRoute>
            } />
            <Route path="/reseller/team" element={
              <ResellerRoute>
                <ResellerTeam />
              </ResellerRoute>
            } />
            <Route path="/reseller/leadership" element={
              <ResellerRoute>
                <ResellerLeadership />
              </ResellerRoute>
            } />
            <Route path="/reseller/commissions" element={
              <ResellerRoute>
                <ResellerCommissions />
              </ResellerRoute>
            } />
            <Route path="/reseller/support" element={
              <ResellerRoute>
                <ResellerSupport />
              </ResellerRoute>
            } />
            
            <Route path="/vendor-dashboard" element={
              <VendorRoute>
                <VendorDashboard />
              </VendorRoute>
            } />
            
            <Route path="/vendor/products" element={<VendorRoute><ProductsList /></VendorRoute>} />
            <Route path="/vendor/products/new" element={<VendorRoute><AddProduct /></VendorRoute>} />
            <Route path="/vendor/products/:id" element={<VendorRoute><EditProduct /></VendorRoute>} />
            <Route path="/vendor/products/:id/edit" element={<VendorRoute><EditProduct /></VendorRoute>} />
            <Route path="/vendor/orders" element={<VendorRoute><OrdersList /></VendorRoute>} />
            <Route path="/vendor/orders/:id" element={<VendorRoute><OrderDetails /></VendorRoute>} />
            <Route path="/vendor/reviews" element={<VendorRoute><VendorReviewsPage /></VendorRoute>} />
            <Route path="/vendor/inventory" element={<VendorRoute><InventoryDashboard /></VendorRoute>} />
            <Route path="/vendor/customers" element={<VendorRoute><VendorCustomers /></VendorRoute>} />
            <Route path="/vendor/wallet" element={<VendorRoute><VendorWallet /></VendorRoute>} />
            <Route path="/vendor/withdraw" element={<VendorRoute><WithdrawDashboard /></VendorRoute>} />
            <Route path="/vendor/profile" element={<VendorRoute><ShopProfile /></VendorRoute>} />
            <Route path="/vendor/notifications" element={<VendorRoute><VendorNotifications /></VendorRoute>} />
            <Route path="/vendor/settings" element={<VendorRoute><VendorSettings /></VendorRoute>} />
            <Route path="/vendor/support" element={<VendorRoute><VendorHelpline /></VendorRoute>} />
            <Route path="/vendor/helpline" element={<VendorRoute><VendorHelpline /></VendorRoute>} />
            <Route path="/vendor/boost" element={<VendorRoute><VendorProductBoost /></VendorRoute>} />
            <Route path="/vendor/ads" element={<VendorRoute><VendorProductAds /></VendorRoute>} />
            <Route path="/vendor/platform-fee" element={<VendorRoute><VendorPlatformFee /></VendorRoute>} />
          
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="attention" element={<AdminRequiresAttention />} />
            <Route path="exceptions" element={<AdminRequiresAttention />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetails />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/:id" element={<AdminProductDetails />} />
            <Route path="pricing" element={<AdminPricing />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="categories/:id" element={<AdminCategoryDetails />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetails />} />
            <Route path="courier-review" element={<AdminCourierLinkReview />} />
            <Route path="courier-link-review" element={<AdminCourierLinkReview />} />
            <Route path="courier-verification" element={<AdminCourierLinkReview />} />
            <Route path="disputes" element={<AdminDisputes />} />
            <Route path="vendors" element={<AdminVendors />} />
            <Route path="platform-fee" element={<AdminPlatformFee />} />
            <Route path="verified-sellers" element={<AdminVerifiedSellers />} />
            <Route path="resellers" element={<AdminResellers />} />
            <Route path="reseller-reviews" element={<AdminResellerReviews />} />
            <Route path="reseller-profit-reviews" element={<AdminResellerReviews />} />
            <Route path="reseller-returns" element={<AdminResellerReturns />} />
            <Route path="reseller-return-requests" element={<AdminResellerReturns />} />
            <Route path="mlm" element={<AdminMLM />} />
            <Route path="commissions" element={<AdminCommissions />} />
            <Route path="withdrawals" element={<AdminWithdrawals />} />
            <Route path="banners" element={<AdminBanners />} />
            <Route path="banners/:id" element={<AdminBannerDetails />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="activity-logs" element={<AdminActivityLogs />} />
            <Route path="storage" element={<AdminStorageManagement />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="support" element={<AdminSupportInbox />} />
            <Route path="support-inbox" element={<AdminSupportInbox />} />
            <Route path="physical-support" element={<AdminSupportInbox defaultTab="physical" />} />
            <Route path="domain-settings" element={<AdminDomainSettings />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
        <BottomNavigation />
          </ShopDomainWrapper>
      </Router>
      </WishlistProvider>
      </CartProvider>
        </VendorNotificationProvider>
      </VendorStoreProvider>
      </NotificationProvider>
    </AuthProvider>
    </LanguageProvider>
  );
}
