import { createElement } from "react";
import type { OrientationRequest } from "@workspace/api-client-react";
import { formatDate, formatDateTime } from "../lib/date-format.ts";

type OrientationRequestDateCellProps = {
  item: Pick<
    OrientationRequest,
    "appointmentDate" | "appointmentTime" | "appointmentStatus" | "createdAt" | "meetUrl"
  >;
};

export function OrientationRequestDateCell({ item }: OrientationRequestDateCellProps) {
  return createElement(
    "td",
    { className: "px-4 py-4 text-xs" },
    createElement("span", { className: "whitespace-nowrap" }, formatDateTime(item.createdAt)),
    item.appointmentDate &&
      createElement(
        "span",
        { className: "mt-2 block whitespace-nowrap font-semibold" },
        `${formatDate(item.appointmentDate)} · ${item.appointmentTime}`,
      ),
    item.meetUrl &&
      createElement(
        "a",
        {
          className: "mt-1 block whitespace-nowrap font-semibold underline underline-offset-4",
          href: item.meetUrl,
          target: "_blank",
          rel: "noreferrer",
        },
        "Apri Google Meet",
      ),
    item.appointmentStatus === "cancelled" &&
      createElement(
        "span",
        { className: "mt-1 block text-[hsl(var(--muted-foreground))]" },
        "Appuntamento annullato",
      ),
  );
}