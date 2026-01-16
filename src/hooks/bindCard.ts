import { ref, update } from "firebase/database";
import { db, ensureAnonAuth } from "../lib/firebase";

export async function loginAndBindCard(params: {
  username: string;
  email?: string;
  cardId: string;
}) {
  const username = params.username.trim();
  if (!username) throw new Error("Thiếu username");
  if (!params.cardId) throw new Error("Thiếu cardId");

  await ensureAnonAuth();

  // uid ổn định theo username (đơn giản nhất)
  const uid = username;

  const name = username;
  const email = params.email?.trim() || "";

  await update(ref(db), {
    [`users/${uid}/name`]: name,
    ...(email ? { [`users/${uid}/email`]: email } : {}),
    [`users/${uid}/updatedTs`]: Date.now(),
    [`rfidMap/${params.cardId}`]: uid,
    [`users/${uid}/cardId`]: params.cardId,
  });

  return { uid };
}
