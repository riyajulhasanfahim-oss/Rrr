import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rtdbGet } from '../lib/rtdb';
import { checkAccountStatus } from '../services/accountStatusService';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  
  if (loading) {
    return null;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // If user is logged in but email is not verified, we can restrict access or redirect
  // For now, we allow them to pass, or you can uncomment below to strictly require verification
  // if (!user.emailVerified) {
  //   return <Navigate to="/verify-email" replace />;
  // }
  
  return <>{children}</>;
};

export const UserPanelRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  
  if (loading) {
    return null;
  }

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userData, isAdmin, loading } = useAuth();
  
  if (loading) {
    return null;
  }

  if (user) {
    if (isAdmin) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (userData?.role === 'Vendor' && userData?.hasActiveVendor) {
      return <Navigate to="/vendor-dashboard" replace />;
    }
    if (userData?.role === 'Reseller' && userData?.hasActiveReseller) {
      return <Navigate to="/reseller/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

export const VendorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userData, loading } = useAuth();
  const [checkingVendor, setCheckingVendor] = useState(true);
  const [isAuthorizedVendor, setIsAuthorizedVendor] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyVendorAccess() {
      if (!user) {
        if (active) {
          setIsAuthorizedVendor(false);
          setCheckingVendor(false);
        }
        return;
      }

      try {
        const adminEmails = ['riyajulhasanfahim@gmail.com', 'frofficialbd1@gmail.com', 'mdfahim776154@gmail.com'];
        const isAdmin = userData?.role === 'Admin' || adminEmails.includes(user.email?.toLowerCase() || '');
        if (isAdmin) {
          if (active) setIsAuthorizedVendor(true);
          return;
        }

        const vData = await rtdbGet<any>(`vendors/${user.uid}`);
        if (!vData) {
          // Check by email in vendors
          if (user.email) {
            const statusResult = await checkAccountStatus(user.email, user.uid);
            if (statusResult.hasActiveVendor) {
              if (active) setIsAuthorizedVendor(true);
              return;
            }
          }
          if (active) {
            setIsAuthorizedVendor(false);
            setCheckingVendor(false);
          }
          return;
        }

        const rawStatus = (vData.status || '').toLowerCase();
        const isApproved = rawStatus === 'active' || rawStatus === 'approved' || rawStatus === 'vacation';
        const isPaid = Boolean(
          vData.registrationPayment === 'completed' ||
          vData.transactionId ||
          vData.verifiedAt ||
          vData.paymentMethod ||
          vData.registrationFee === 0
        );

        if (isApproved && isPaid) {
          if (active) setIsAuthorizedVendor(true);
        } else {
          if (active) setIsAuthorizedVendor(false);
        }
      } catch (e) {
        // Fallback to strict AuthContext check
        if (active) setIsAuthorizedVendor(Boolean(userData?.role === 'Vendor' && userData?.hasActiveVendor));
      } finally {
        if (active) setCheckingVendor(false);
      }
    }

    if (!loading) {
      verifyVendorAccess();
    }

    return () => {
      active = false;
    };
  }, [user, loading, userData]);

  if (loading || checkingVendor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-9 h-9 border-4 border-primary-main border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-xs text-slate-500 font-medium">ভেন্ডর একাউন্ট যাচাই করা হচ্ছে...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthorizedVendor) {
    return <Navigate to="/become-vendor" replace />;
  }

  return <>{children}</>;
};

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const ResellerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userData, loading } = useAuth();
  
  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasReseller = userData?.role === 'Reseller' || userData?.hasActiveReseller === true;
  if (!userData || !hasReseller) {
    return <Navigate to="/reseller/apply" replace />;
  }

  return <>{children}</>;
};
