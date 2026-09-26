import { db } from '../lib/firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot
} from "firebase/firestore";

// ================= USER CREATE =================
export async function createUser(userId: string, name: string, refId: string | null) {
  await setDoc(doc(db, "users", userId), {
    name: name,
    balance: 0,
    totalEarnings: 0,
    referredBy: refId || null,
    createdAt: new Date()
  });
}

// ================= REFERRAL LINK =================
export function getReferralLink(userId: string) {
  return `${window.location.origin}/register?ref=${userId}`;
}

export function copyReferralLink(userId: string) {
  const link = getReferralLink(userId);
  navigator.clipboard.writeText(link);
  alert("Referral link copied!");
}

// ================= CREATE ORDER =================
export async function createOrder(userId: string, amount: number) {
  await addDoc(collection(db, "orders"), {
    userId: userId,
    amount: amount,
    status: "pending",
    createdAt: new Date()
  });
}

// ================= WITHDRAW =================
export async function withdraw(userId: string, amount: number, method: string) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    alert("User not found");
    return;
  }

  const balance = userSnap.data().balance || 0;

  if (balance < amount) {
    alert("Insufficient balance");
    return;
  }

  await addDoc(collection(db, "withdraws"), {
    userId: userId,
    amount: amount,
    method: method, // bkash, nagad, rocket, bank
    status: "pending",
    createdAt: new Date()
  });

  await updateDoc(userRef, {
    balance: balance - amount
  });

  alert("Withdraw request sent");
}

// ================= LIVE BALANCE =================
export function listenBalance(userId: string, callback: (balance: number) => void) {
  return onSnapshot(doc(db, "users", userId), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().balance || 0);
    }
  });
}

// ================= PENDING BALANCE =================
export async function getPending(userId: string) {
  const q = query(
    collection(db, "withdraws"),
    where("userId", "==", userId),
    where("status", "==", "pending")
  );

  const snap = await getDocs(q);

  let total = 0;
  snap.forEach(doc => {
    total += doc.data().amount || 0;
  });

  return total;
}

// ================= MLM TEAM =================
export async function getMyTeam(userId: string): Promise<any[]> {
  const q = query(collection(db, "users"), where("referredBy", "==", userId));
  const snap = await getDocs(q);

  let team = [];

  for (let docSnap of snap.docs) {
    let data = docSnap.data();
    data.id = docSnap.id;
    data.children = await getMyTeam(docSnap.id);
    team.push(data);
  }

  return team;
}
