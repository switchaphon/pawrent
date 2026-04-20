import type { messagingApi } from "@line/bot-sdk";

export interface HealthReminderData {
  petName: string;
  reminderTitle: string;
  dueDate: string;
  daysUntilDue: number;
  petPhotoUrl?: string | null;
  passportUrl: string;
}

/**
 * Build a LINE Flex Message for a health reminder (vaccination, parasite
 * prevention, etc.). Thai-language copy with a gentle tone.
 */
export function buildHealthReminderMessage(data: HealthReminderData): messagingApi.FlexMessage {
  const urgencyColor =
    data.daysUntilDue <= 0 ? "#DC2626" : data.daysUntilDue <= 3 ? "#F59E0B" : "#10B981";

  const urgencyText =
    data.daysUntilDue <= 0
      ? "ถึงกำหนดแล้ว!"
      : data.daysUntilDue === 1
        ? "พรุ่งนี้แล้ว!"
        : `อีก ${data.daysUntilDue} วัน`;

  return {
    type: "flex",
    altText: `${data.petName}: ${data.reminderTitle}`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: `💉 ${data.petName}`,
            weight: "bold",
            size: "lg",
            color: "#1A1A1A",
          },
        ],
        paddingAll: "16px",
        backgroundColor: "#F9FAFB",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: data.reminderTitle,
            weight: "bold",
            size: "md",
            wrap: true,
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: urgencyText,
                size: "sm",
                color: urgencyColor,
                weight: "bold",
              },
              {
                type: "text",
                text: data.dueDate,
                size: "sm",
                color: "#6B7280",
                align: "end",
              },
            ],
            margin: "md",
          },
        ],
        paddingAll: "16px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "uri",
              label: "ดู Health Passport",
              uri: data.passportUrl,
            },
            style: "primary",
            color: "#6366F1",
          },
        ],
        paddingAll: "12px",
      },
    },
  };
}
