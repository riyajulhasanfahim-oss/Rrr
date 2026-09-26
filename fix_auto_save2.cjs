const fs = require('fs');
const file = 'src/pages/vendor/profile/ShopProfile.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `setProfile((prev: any) => ({ ...prev, shopSlug: slug, freeShopDomain: \`\${slug}.rjworld.com\` }));
      toast.success('Free Shop Domain generated! Please save profile.');`;
const replacement1 = `const newProfile = { ...profile, shopSlug: slug, freeShopDomain: \`\${slug}.rjworld.com\` };
      setProfile(newProfile);
      if (user) {
         const profileRef = doc(db, 'vendor_profiles', user.uid);
         await setDoc(profileRef, { shopSlug: slug, freeShopDomain: \`\${slug}.rjworld.com\` }, { merge: true });
      }
      toast.success('Free Shop Domain generated & saved successfully!');`;

if (content.includes(target1)) {
  content = content.replace(target1, replacement1);
} else {
  console.log("target1 not found");
}

fs.writeFileSync(file, content);
