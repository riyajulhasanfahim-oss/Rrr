sed -i '1s/^/import toast from "react-hot-toast";\nimport { addDoc, collection, serverTimestamp } from "firebase/firestore";\n/' src/pages/vendor/VendorDashboard.tsx
