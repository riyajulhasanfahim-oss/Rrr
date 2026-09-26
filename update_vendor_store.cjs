const fs = require('fs');
const file = 'src/pages/VendorStore.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `export default function VendorStore() {
  const { vendorId } = useParams<{ vendorId: string }>();`;

const replacement = `export default function VendorStore({ propVendorId }: { propVendorId?: string }) {
  const params = useParams<{ vendorId: string }>();
  const vendorId = propVendorId || params.vendorId;`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
