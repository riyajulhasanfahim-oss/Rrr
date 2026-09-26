const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminResellers.tsx', 'utf8');

content = content.replace(/const fetchResellers = async \(\) => {[\s\S]*?const toggleStatus =/m, 
`const fetchResellers = async () => {
    try {
      setLoading(true);
      // 1. Fetch Approved Resellers (from users)
      const q = query(collection(db, 'users'), where('role', '==', 'Reseller'));
      const querySnapshot = await getDocs(q);
      const approvedResellers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // 2. Fetch Pending Resellers (from resellers collection)
      const pendingQ = query(collection(db, 'resellers'), where('status', '==', 'pending'));
      const pendingSnap = await getDocs(pendingQ);
      const pendingResellers = pendingSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.fullName || 'Pending Reseller',
          email: data.email,
          phone: data.mobileNumber,
          status: 'pending',
          paymentMethod: data.paymentMethod,
          transactionId: data.transactionId,
          registrationFee: data.registrationFee,
          role: 'user',
          ...data
        };
      });

      const allData = [...pendingResellers, ...approvedResellers];
      
      const resellersWithStats = await Promise.all(allData.map(async (r) => {
        const wallet = r.wallet || 0;
        return {
          ...r,
          totalSales: r.totalSales || 0,
          totalOrders: r.totalOrders || 0,
          totalCommission: r.totalCommission || 0,
          currentBalance: wallet,
        };
      }));
      setResellers(resellersWithStats);
    } catch (error) {
      console.error('Error fetching resellers:', error);
      toast.error('Failed to load resellers');
    } finally {
      setLoading(false);
    }
  };

  const approveReseller = async (resellerId: string) => {
    try {
      await updateDoc(doc(db, 'users', resellerId), { role: 'Reseller', status: 'active' });
      await updateDoc(doc(db, 'resellers', resellerId), { status: 'active', updatedAt: Date.now() });
      toast.success('Reseller approved successfully');
      fetchResellers();
    } catch (error) {
      console.error('Error approving reseller:', error);
      toast.error('Failed to approve reseller');
    }
  };

  const toggleStatus =`);

content = content.replace(
/\{r\.status === 'active' \? <CheckCircle className="w-3\.5 h-3\.5" \/> : <XCircle className="w-3\.5 h-3\.5" \/>\}[\s\S]*?<\/span>/,
`{r.status === 'active' ? <CheckCircle className="w-3.5 h-3.5" /> : r.status === 'pending' ? <Activity className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {r.status === 'active' ? 'Active' : r.status === 'pending' ? 'Pending' : 'Suspended'}
                      </span>`
);

content = content.replace(
/className={\`inline-flex items-center gap-1\.5 px-2\.5 py-1 rounded-full text-xs font-bold \\\$\{r\.status === 'active' \? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'\}\`}/,
`className={\`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold \${r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : r.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}\`}`
);

content = content.replace(
/title=\{r\.status === 'active' \? "Suspend Reseller" : "Activate Reseller"\}/,
`title={r.status === 'pending' ? "Approve Reseller" : r.status === 'active' ? "Suspend Reseller" : "Activate Reseller"}`
);

content = content.replace(
/onClick=\{\(\) => toggleStatus\(r\.id, r\.status\)\}/,
`onClick={() => {
                          if (r.status === 'pending') {
                            approveReseller(r.id);
                          } else {
                            toggleStatus(r.id, r.status);
                          }
                        }}`
);

fs.writeFileSync('src/pages/admin/AdminResellers.tsx', content);
