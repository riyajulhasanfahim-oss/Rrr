const fs = require('fs');
const file = 'src/pages/vendor/profile/ShopProfile.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetState = `    seo: {
      title: '',
      description: '',
      keywords: '',
      urlSlug: ''
    }
  });`;

const replacementState = `    seo: {
      title: '',
      description: '',
      keywords: '',
      urlSlug: ''
    },
    shopSlug: '',
    freeShopDomain: '',
    customDomain: '',
    customDomainStatus: 'Pending',
    verificationStatus: 'Pending'
  });

  const [verifyingDomain, setVerifyingDomain] = useState(false);`;

content = content.replace(targetState, replacementState);

const importsTarget = `import { \n  Store, Palette, Image as ImageIcon, MapPin, Clock, Phone, Globe, \n  Facebook, Instagram, Youtube, Twitter, Save, Layout, CheckCircle2,\n  Mail, MessageCircle, UploadCloud, Loader2, Copy, Check\n} from 'lucide-react';`;
const importsReplacement = `import { \n  Store, Palette, Image as ImageIcon, MapPin, Clock, Phone, Globe, \n  Facebook, Instagram, Youtube, Twitter, Save, Layout, CheckCircle2,\n  Mail, MessageCircle, UploadCloud, Loader2, Copy, Check, Globe2, Link\n} from 'lucide-react';\nimport { collection, query, where, getDocs } from 'firebase/firestore';`;

content = content.replace(importsTarget, importsReplacement);

fs.writeFileSync(file, content);
