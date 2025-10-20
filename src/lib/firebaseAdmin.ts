import * as admin from "firebase-admin";

function resolveServiceAccount(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  // Option A: full JSON in one env var
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    try {
      const sa = JSON.parse(json);
      // Expect standard service account JSON keys
      if (!sa.project_id || !sa.client_email || !sa.private_key) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT missing required fields");
      }
      return {
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: String(sa.private_key).replace(/\\n/g, "\n"),
      };
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", e);
    }
  }

  // Option B: individual env vars
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    // Trim accidental quotes and fix newlines
    privateKey = privateKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

if (!admin.apps.length) {
  const sa = resolveServiceAccount();

  if (sa) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: sa.projectId,
        clientEmail: sa.clientEmail,
        privateKey: sa.privateKey,
      }),
    });
  } else {
    // Fallback to ADC if running on GCP with default credentials
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}

const adminDb = admin.firestore();

export { admin, adminDb };
