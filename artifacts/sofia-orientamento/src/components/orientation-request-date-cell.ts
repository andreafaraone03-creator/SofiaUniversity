import { createElement } from "react";
import type { OrientationRequest } from "@workspace/api-client-react";
import { formatDate, formatDateTime } from "../lib/date-format.ts";
import { createMeetAccountChooserUrl } from "../lib/meet-account-link.ts";

type OrientationRequestDateCellProps = {
  item: Pick<
    OrientationRequest,
    "id" | "appointmentDate" | "appointmentTime" | "appointmentStatus" | "createdAt" | "meetUrl"
  >;
  adminNotificationEmail?: string | null;
};

export function OrientationRequestDateCell({
  item,
  adminNotificationEmail,
}: OrientationRequestDateCellProps) {
  const hasAppointmentDate = Boolean(item.appointmentDate);
  const appointmentLabel = item.appointmentStatus === "cancelled"
    ? "Appuntamento annullato"
    : !hasAppointmentDate
      ? "Nessun appuntamento programmato"
      : null;

  return createElement(
    "td",
    { className: "px-4 py-4 text-xs" },
    createElement("span", { className: "whitespace-nowrap" }, formatDateTime(item.createdAt)),
    hasAppointmentDate &&
      createElement(
        "span",
        { className: "mt-2 block whitespace-nowrap font-semibold" },
        item.appointmentTime
          ? `${formatDate(item.appointmentDate)} · ${item.appointmentTime}`
          : formatDate(item.appointmentDate),
      ),
    appointmentLabel &&
      createElement(
        "span",
        {
          className: "mt-2 block text-[hsl(var(--muted-foreground))]",
          "data-testid": `text-appointment-status-${item.id}`,
        },
        appointmentLabel,
      ),
    item.meetUrl &&
      createElement(
        "a",
        {
          className: "mt-1 block whitespace-nowrap font-semibold underline underline-offset-4",
          href: createMeetAccountChooserUrl(item.meetUrl, adminNotificationEmail),
          target: "_blank",
          rel: "noopener noreferrer",
          "data-testid": `link-meet-orientation-${item.id}`,
        },
        "Apri Google Meet",
      ),
  );
}