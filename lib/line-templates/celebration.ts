import type { messagingApi } from "@line/bot-sdk";

export interface CelebrationData {
  petName: string;
  type: "birthday" | "gotcha_day";
  age?: number;
  years?: number;
  petPhotoUrls: string[];
  passportUrl: string;
}

/**
 * Build a LINE Flex Message for a birthday or gotcha-day celebration.
 * Thai-language copy with festive tone.
 */
export function buildCelebrationMessage(data: CelebrationData): messagingApi.FlexMessage {
  const isBirthday = data.type === "birthday";
  const emoji = isBirthday ? "🎂" : "🏠";
  const ageLabel = isBirthday
    ? data.age
      ? `ครบ ${data.age} ขวบแล้ว!`
      : "สุขสันต์วันเกิด!"
    : data.years
      ? `ครบ ${data.years} ปีที่อยู่ด้วยกัน!`
      : "ครบรอบวันรับเลี้ยง!";

  const title = isBirthday
    ? `สุขสันต์วันเกิด ${data.petName}! 🎉`
    : `ครบรอบวันรับเลี้ยง ${data.petName}! 🎉`;

  const heroImage =
    data.petPhotoUrls.length > 0
      ? data.petPhotoUrls[0]
      : "https://placehold.co/600x400/E0E7FF/6366F1?text=Happy+Day";

  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      size: "mega",
      hero: {
        type: "image",
        url: heroImage,
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `${emoji} ${data.petName}`,
            weight: "bold",
            size: "xl",
            wrap: true,
          },
          {
            type: "text",
            text: ageLabel,
            size: "md",
            color: "#6366F1",
            margin: "sm",
          },
          {
            type: "text",
            text: isBirthday
              ? "ขอให้มีความสุข สุขภาพแข็งแรง! 💜"
              : "ขอบคุณที่เลือกเรา ขอบคุณที่อยู่ด้วยกัน! 💜",
            size: "sm",
            color: "#6B7280",
            wrap: true,
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
