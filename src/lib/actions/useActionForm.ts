"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { initialActionState, type ActionState } from "@/lib/actions/result";

/**
 * Runs a Server Action from a form without React's automatic form reset.
 *
 * With <form action={…}>, React 19 resets every uncontrolled field after
 * each submission — including one the server rejected — so a validation
 * error would wipe what the user typed. Submitting through onSubmit keeps
 * the fields; forms that should clear after success use key={state.done}.
 */
export function useActionForm(action: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const next = await action(prev, formData);
    // Keep `done` unchanged on errors, so key={state.done} only remounts (clears) after a success.
    return next.done ? next : { ...next, done: prev.done };
  }, initialActionState);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return { state, onSubmit, pending };
}
