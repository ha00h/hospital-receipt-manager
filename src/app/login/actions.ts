"use server";

import { redirect } from "next/navigation";
import { checkPassword, endSession, startSession } from "@/lib/auth";
import { lockedMinutes, recordFailure } from "@/lib/loginLimit";

export type LoginState = { error?: string };

function lockMessage(minutes: number) {
  const wait = minutes >= 60 ? `${Math.ceil(minutes / 60)}시간` : `${minutes}분`;
  return `로그인 시도가 너무 많습니다. 약 ${wait} 후에 다시 시도하세요.`;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const locked = lockedMinutes();
  if (locked) return { error: lockMessage(locked) };

  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    recordFailure();
    await new Promise((r) => setTimeout(r, 1000));
    const nowLocked = lockedMinutes();
    return { error: nowLocked ? lockMessage(nowLocked) : "비밀번호가 올바르지 않습니다." };
  }
  await startSession();
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
