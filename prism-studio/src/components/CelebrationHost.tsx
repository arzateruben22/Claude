"use client";
// One celebration host for the whole studio. The layout passes achievements unlocked in the last few minutes
// that haven't been seen yet (read from the database, so the moment survives whatever re-render moved the task
// that caused it); closing the modal records them as seen, so it never replays.
import { useEffect, useRef, useState } from "react";
import { seeAchievementIds } from "@/app/actions";
import { Celebration } from "./Celebration";

export function CelebrationHost({ fresh }: { fresh: { id: string; title: string; demo: boolean }[] }) {
  const dismissed = useRef(new Set<string>());   // closed in this tab, even if the "seen" write hasn't landed yet
  const [open, setOpen] = useState<typeof fresh>([]);
  useEffect(() => {
    const next = fresh.filter((a) => !dismissed.current.has(a.id));
    if (next.length) setOpen(next);
  }, [fresh]);
  if (!open.length) return null;
  return <Celebration titles={open.map((a) => a.title)} demo={open.every((a) => a.demo)} onClose={() => {
    const ids = open.map((a) => a.id);
    ids.forEach((id) => dismissed.current.add(id));
    setOpen([]);
    void seeAchievementIds(ids);
  }} />;
}
