import re

firebase_ts_path = "src/lib/firebase.ts"
with open(firebase_ts_path, "r") as f:
    ts_content = f.read()

# Fix initializeFirestore
ts_content = re.sub(r'initializeFirestore\(app, \{ experimentalForceLongPolling: true \}, "[^"]+"\);',
                    r'initializeFirestore(app, { experimentalForceLongPolling: true });',
                    ts_content)

# Fix getFirestore
ts_content = re.sub(r'getFirestore\(app, "[^"]+"\);',
                    r'getFirestore(app);',
                    ts_content)

with open(firebase_ts_path, "w") as f:
    f.write(ts_content)
