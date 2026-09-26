import React, { useState, useEffect } from 'react';
import Header from '../../../components/layout/Header';
import Footer from '../../../components/layout/Footer';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { DollarSign, TrendingUp, Gift, Download, Activity, Calendar } from 'lucide-react';
import { initializeDefaultRules } from '../../../services/commissionEngine';
import { getResellerLedgerTransactions } from '../../../services/resellerWalletService';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip
} from '@mui/material';

export default function ResellerCommissions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  
  const [commissions, setCommissions] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalCommissions: 0,
    totalBonuses: 0,
    thisMonth: 0,
    pendingPayouts: 0
  });

  useEffect(() => {
    if (user) {
      // Ensure rules exist just for demo purposes
      initializeDefaultRules().catch(console.error);
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch from RTDB reseller_wallet_transactions
      let commData: any[] = [];
      let bonusData: any[] = [];
      try {
        const rtdbTxs = await getResellerLedgerTransactions(user!.uid);
        rtdbTxs.forEach(tx => {
          commData.push({
            id: tx.transactionId,
            amount: tx.amount || 0,
            description: tx.description || `${tx.type} transaction`,
            status: tx.status === 'COMPLETED' ? 'Paid' : (tx.status === 'RELEASED' ? 'Paid' : (tx.status === 'CANCELLED' ? 'Cancelled' : 'Pending')),
            createdAt: tx.createdAt || Date.now()
          });
        });
      } catch (_) {}

      // 2. Fetch Commissions from legacy collections for backward compatibility (guarded by timeout)
      try {
        await Promise.race([
          (async () => {
            try {
              const commQ = query(
                collection(db, 'commission_transactions'), 
                where('userId', '==', user!.uid),
                orderBy('createdAt', 'desc'),
                limit(50)
              );
              const commSnap = await getDocs(commQ);
              commSnap.docs.forEach(d => {
                if (!commData.some(c => c.id === d.id)) {
                  commData.push({ id: d.id, ...d.data() });
                }
              });
            } catch (_) {}

            try {
              const rTxQ = query(
                collection(db, 'reseller_transactions'),
                where('resellerId', '==', user!.uid)
              );
              const rTxSnap = await getDocs(rTxQ);
              rTxSnap.forEach(d => {
                const item = d.data();
                if (!commData.some(c => c.id === d.id)) {
                  commData.push({
                    id: d.id,
                    amount: item.amount || 0,
                    description: `Commission from Order #${item.orderId || d.id}`,
                    status: item.status || 'Approved',
                    createdAt: item.createdAt || Date.now()
                  });
                }
              });
            } catch (_) {}

            try {
              const bonusQ = query(
                collection(db, 'bonus_transactions'), 
                where('userId', '==', user!.uid),
                orderBy('createdAt', 'desc'),
                limit(50)
              );
              const bonusSnap = await getDocs(bonusQ);
              bonusData = bonusSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            } catch (_) {}
          })(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
        ]);
      } catch (_) {}
      
      // Sort desc
      commData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      bonusData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setCommissions(commData);
      setBonuses(bonusData);
      
      // Calc stats from real data
      const tComm = commData.filter(c => c.status === 'Paid' || c.status === 'Approved').reduce((a, b) => a + (b.amount || 0), 0);
      const tBonus = bonusData.filter(b => b.status === 'Paid' || b.status === 'Approved').reduce((a, b) => a + (b.amount || 0), 0);
      const pending = commData.filter(c => c.status === 'Pending').reduce((a, b) => a + (b.amount || 0), 0);
      
      setStats({
        totalCommissions: tComm,
        totalBonuses: tBonus,
        thisMonth: tComm + tBonus,
        pendingPayouts: pending
      });

    } catch (error) {
      console.error("Error fetching commissions data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleExport = (type: string) => {
    // In a real implementation, you would generate a CSV or PDF here
    alert(`Exporting ${type} report... (Simulation)`);
  };

  if (loading) {
     return (
       <div className="min-h-screen bg-gray-50  flex flex-col">
         <Header />
         <div className="flex-grow flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-main"></div>
         </div>
         <Footer />
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-gray-50  flex flex-col">
      <Header />
      
      <main className="flex-grow py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex flex-col sm sm justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900  tracking-tight">Commissions & Bonuses</h1>
            <p className="mt-2 text-sm text-gray-500 ">Track your earnings, view transaction history, and export reports.</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<Download size={16} />}
              onClick={() => handleExport('PDF')}
            >
              PDF Report
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<Download size={16} />}
              onClick={() => handleExport('CSV')}
            >
              CSV Export
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl shadow-sm border border-gray-100  bg-white ">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100  flex items-center justify-center text-blue-600 ">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <Typography variant="body2" className="text-gray-500 font-medium">Total Commissions</Typography>
                <Typography variant="h5" className="font-bold text-gray-900 ">৳{stats.totalCommissions.toLocaleString()}</Typography>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl shadow-sm border border-gray-100  bg-white ">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100  flex items-center justify-center text-purple-600 ">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <Typography variant="body2" className="text-gray-500 font-medium">Total Bonuses</Typography>
                <Typography variant="h5" className="font-bold text-gray-900 ">৳{stats.totalBonuses.toLocaleString()}</Typography>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border border-gray-100  bg-white ">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100  flex items-center justify-center text-green-600 ">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <Typography variant="body2" className="text-gray-500 font-medium">Earned This Month</Typography>
                <Typography variant="h5" className="font-bold text-gray-900 ">৳{stats.thisMonth.toLocaleString()}</Typography>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border border-gray-100  bg-white ">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100  flex items-center justify-center text-orange-600 ">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <Typography variant="body2" className="text-gray-500 font-medium">Pending Payouts</Typography>
                <Typography variant="h5" className="font-bold text-gray-900 ">৳{stats.pendingPayouts.toLocaleString()}</Typography>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Tabs */}
        <Card className="rounded-2xl shadow-sm border border-gray-100  bg-white  overflow-hidden">
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 2 }}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="commission tabs">
              <Tab label="Commission History" />
              <Tab label="Bonus History" />
            </Tabs>
          </Box>
          
          <CardContent className="p-0">
            {activeTab === 0 && (
              <TableContainer component={Paper} elevation={0} className="bg-transparent">
                <Table sx={{ minWidth: 650 }} aria-label="commissions table">
                  <TableHead className="bg-gray-50 ">
                    <TableRow>
                      <TableCell className="font-semibold">Date</TableCell>
                      <TableCell className="font-semibold">Description</TableCell>
                      <TableCell className="font-semibold text-right">Amount</TableCell>
                      <TableCell className="font-semibold text-center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {commissions.length > 0 ? commissions.map((row) => (
                      <TableRow key={row.id} sx={{ '& td, & th': { border: 0 } }}>
                        <TableCell component="th" scope="row">
                          {new Date(row.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell className="text-right font-bold text-gray-900 ">
                          ৳{row.amount?.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Chip 
                            label={row.status} 
                            color={row.status === 'Paid' ? 'success' : 'warning'} 
                            size="small" 
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          No commission transactions found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {activeTab === 1 && (
              <TableContainer component={Paper} elevation={0} className="bg-transparent">
                <Table sx={{ minWidth: 650 }} aria-label="bonuses table">
                  <TableHead className="bg-gray-50 ">
                    <TableRow>
                      <TableCell className="font-semibold">Date</TableCell>
                      <TableCell className="font-semibold">Bonus Type</TableCell>
                      <TableCell className="font-semibold text-right">Amount</TableCell>
                      <TableCell className="font-semibold text-center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bonuses.length > 0 ? bonuses.map((row) => (
                      <TableRow key={row.id} sx={{ '& td, & th': { border: 0 } }}>
                        <TableCell component="th" scope="row">
                          {new Date(row.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell className="text-right font-bold text-gray-900 ">
                          ৳{row.amount?.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Chip 
                            label={row.status} 
                            color={row.status === 'Paid' ? 'success' : 'warning'} 
                            size="small" 
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          No bonus transactions found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

      </main>
      
      <Footer />
    </div>
  );
}
