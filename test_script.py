with open("src/pages/vendor/VendorDashboard.tsx", "r") as f:
    content = f.read()

new_content = content.replace("""    try {
      // 1. Create a verification request
      await addDoc(collection(db, 'verified_seller_requests'), {
        vendorId: user.uid,
        sellerName: userData?.name || vendorInfo?.ownerName || 'Unknown',
        storeName: vendorInfo?.shopName || 'Unknown',
        paymentAmount: 100,
        paymentStatus: 'completed',
        paymentMethod,
        trxId,
        status: 'pending',
        requestDate: serverTimestamp()
      });
      
      // 2. Update vendor status
      await setDoc(doc(db, 'vendors', user.uid), {
        verificationStatus: 'pending'
      }, { merge: true });
      
      setVendorInfo(prev => ({...prev, verificationStatus: 'pending'}));
      closeVerifyModal();
      toast.success('Verification request submitted successfully!');
    } catch (error) {
      console.error("Error submitting verification request:", error);
      toast.error('Failed to submit verification request.');
    } finally {
      setIsVerifying(false);
    }""", """    try {
      console.log('Starting verification request...', { vendorId: user.uid });
      // 1. Create a verification request
      try {
        await addDoc(collection(db, 'verified_seller_requests'), {
          vendorId: user.uid,
          sellerName: userData?.name || vendorInfo?.ownerName || 'Unknown',
          storeName: vendorInfo?.shopName || 'Unknown',
          paymentAmount: 100,
          paymentStatus: 'completed',
          paymentMethod,
          trxId,
          status: 'pending',
          requestDate: serverTimestamp()
        });
        console.log('Step 1: addDoc verified_seller_requests succeeded');
      } catch (e) {
        console.error('Step 1 failed:', e);
        throw e;
      }
      
      // 2. Update vendor status
      try {
        await setDoc(doc(db, 'vendors', user.uid), {
          verificationStatus: 'pending'
        }, { merge: true });
        console.log('Step 2: setDoc vendors succeeded');
      } catch (e) {
        console.error('Step 2 failed:', e);
        throw e;
      }
      
      setVendorInfo(prev => ({...prev, verificationStatus: 'pending'}));
      closeVerifyModal();
      toast.success('Verification request submitted successfully!');
    } catch (error) {
      console.error("Error submitting verification request:", error);
      toast.error('Failed to submit verification request.');
    } finally {
      setIsVerifying(false);
    }""")

with open("src/pages/vendor/VendorDashboard.tsx", "w") as f:
    f.write(new_content)
