export type PaymentUserType = 'customer' | 'reseller' | 'vendor' | 'vendor_platform_fee';

export type PaymentMethodType = 'bkash' | 'nagad' | 'rocket' | 'upay';

export type PaymentVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface PaymentVerificationRecord {
  paymentId: string;
  invoiceId: string;
  userId: string;
  userType: PaymentUserType;
  paymentMethod: PaymentMethodType;
  expectedAmount: number;
  transactionId: string;
  status: PaymentVerificationStatus;
  senderNumber?: string | null;
  receivedAmount?: number | null;
  verifiedAt?: number | null;
  createdAt: number;
  rejectionReason?: string | null;
  metadata?: Record<string, any>;
}

export interface CreatePaymentVerificationInput {
  paymentId?: string;
  invoiceId: string;
  userId: string;
  userType: PaymentUserType;
  paymentMethod: PaymentMethodType | string;
  expectedAmount: number;
  transactionId: string;
  senderNumber?: string | null;
  metadata?: Record<string, any>;
}

export interface UpdateVerificationStatusInput {
  status: PaymentVerificationStatus;
  receivedAmount?: number | null;
  senderNumber?: string | null;
  rejectionReason?: string | null;
}
