const fs = require('fs');
const file = 'src/pages/vendor/profile/ShopProfile.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `setProfile((prev: any) => ({ ...prev, shopSlug: slug, freeShopDomain: \\\`\\\${slug}.rjworld.com\\\` }));\n      toast.success('Free Shop Domain generated! Please save profile.');`,
  `const newProfile = { ...profile, shopSlug: slug, freeShopDomain: \`\${slug}.rjworld.com\` };
      setProfile(newProfile);
      
      // Auto-save
      if (user) {
         const profileRef = doc(db, 'vendor_profiles', user.uid);
         await setDoc(profileRef, newProfile, { merge: true });
      }
      toast.success('Free Shop Domain generated & saved successfully!');`
);

content = content.replace(
  `setProfile((prev: any) => ({ ...prev, customDomainStatus: 'Verified', verificationStatus: 'Verified', customDomain: domainToCheck }));\n        toast.success('Domain verified successfully!');`,
  `const newProfile = { ...profile, customDomainStatus: 'Verified', verificationStatus: 'Verified', customDomain: domainToCheck };
        setProfile(newProfile);
        if (user) {
           const profileRef = doc(db, 'vendor_profiles', user.uid);
           await setDoc(profileRef, newProfile, { merge: true });
        }
        toast.success('Domain verified & saved successfully!');`
);

// We need to import setDoc and doc if not already there... Wait, they are used in handleSaveProfile so they are there!
// import { doc, setDoc, getDoc } from 'firebase/firestore'; is probably at the top. Let's check.
fs.writeFileSync(file, content);
