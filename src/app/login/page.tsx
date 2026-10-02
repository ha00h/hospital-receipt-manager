"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <form
        action={action}
        className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-8 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl text-white">
            +
          </div>
          <h1 className="text-xl font-bold">병원 영수증</h1>
          <p className="text-sm text-slate-500">비밀번호를 입력하세요</p>
        </div>
        <input
          type="password"
          name="password"
          autoFocus
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
          placeholder="비밀번호"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          disabled={pending}
          className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "확인 중..." : "로그인"}
        </button>
      </form>
    </main>
  );
}
