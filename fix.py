import re

with open("firestore.rules", "r") as f:
    content = f.read()

bad_line = "allow update, delete: if isUserAdmin() || (isSignedIn() allow update, delete: if isUserAdmin() || (isUserVendor() && request.auth.uid == vendorId);allow update, delete: if isUserAdmin() || (isUserVendor() && request.auth.uid == vendorId); request.auth.uid == vendorId);"
good_line = "allow update, delete: if isUserAdmin() || (isSignedIn() && request.auth.uid == vendorId);"

content = content.replace(bad_line, good_line)

with open("firestore.rules", "w") as f:
    f.write(content)
