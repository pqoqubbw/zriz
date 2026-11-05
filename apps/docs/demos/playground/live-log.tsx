"use client";

import { usePlayground } from "@/demos/playground/use-playground";

const LiveLog = () => {
  const rows = usePlayground((state) => state.rows);

  if (rows.length === 0) {
    return <div className="text-faint">no events yet</div>;
  }

  return rows.map((row) => (
    <div className="flex gap-4" data-slot="log-row" key={row.id}>
      <span className="w-20 shrink-0 text-faint">{row.time}</span>{" "}
      <span>{row.event}</span>
    </div>
  ));
};

export { LiveLog };
