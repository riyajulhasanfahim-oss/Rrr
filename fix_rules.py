import re

with open("firestore.rules.fixed", "r") as f:
    content = f.read()

# Add the verified_seller_requests block just before match /vendor_wallet/
block_to_add = """
    match /verified_seller_requests/{requestId} {
      allow read: if isUserAdmin() || (isSignedIn() && resource.data.vendorId == request.auth.uid);
      allow create: if isSignedIn() && incoming().vendorId == request.auth.uid;
      allow update, delete: if isUserAdmin();
    }
"""

if "verified_seller_requests" not in content:
    content = content.replace("    match /vendor_wallet/{vendorId} {", block_to_add + "    match /vendor_wallet/{vendorId} {")

with open("firestore.rules", "w") as f:
    f.write(content)
