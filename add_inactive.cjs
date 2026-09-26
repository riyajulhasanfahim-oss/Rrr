const fs = require('fs');
const file = 'src/pages/VendorStore.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `  if (loading) {
    return (
      <div className="min-h-screen flex flex-col"><Header /><main className="flex-1">
        <div className="animate-pulse">`;

const newCode = `  const isInactive = vendor?.status === 'Inactive' || vendor?.status === 'Suspended' || profile?.status === 'Inactive';
  if (isInactive) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Store className="w-10 h-10 text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Unavailable</h1>
            <p className="text-gray-500 mb-8">
              This store is currently inactive or suspended. Please check back later.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-main text-white font-medium rounded-lg hover:bg-sky-600 transition-colors"
            >
              Return to Marketplace
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col"><Header /><main className="flex-1">
        <div className="animate-pulse">`;

content = content.replace(target, newCode);
fs.writeFileSync(file, content);
