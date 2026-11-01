import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { initialOf } from "../../lib/format";

/** The account photo, falling back to an initial when there is none or it fails to load. */
export function Avatar({ user, size = 32 }: { user: User | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = user?.user_metadata?.avatar_url;
  const box = { width: size, height: size };

  if (typeof url === "string" && url && !failed) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full object-cover"
        style={box}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-ai-soft font-display text-ai"
      style={{ ...box, fontSize: Math.round(size * 0.45) }}
    >
      {initialOf(user)}
    </span>
  );
}
