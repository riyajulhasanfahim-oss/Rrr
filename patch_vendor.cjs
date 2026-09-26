const fs = require('fs');
let content = fs.readFileSync('src/pages/vendor/VendorDashboard.tsx', 'utf8');

// Add imports
if (!content.includes('serverTimestamp')) {
    content = content.replace(
        "import { doc, getDoc } from 'firebase/firestore';",
        "import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';"
    );
}

if (!content.includes('react-hot-toast')) {
    content = content.replace(
        "import { Link } from 'react-router-dom';",
        "import { Link } from 'react-router-dom';\nimport toast from 'react-hot-toast';"
    );
}

if (!content.includes('X, CheckCircle,')) {
    content = content.replace(
        "Plus,\n  ArrowRight",
        "Plus,\n  ArrowRight,\n  X,\n  CheckCircle,\n  Clock"
    );
}

fs.writeFileSync('src/pages/vendor/VendorDashboard.tsx', content);
