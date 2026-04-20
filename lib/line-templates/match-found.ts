import type { messagingApi } from "@line/bot-sdk";
import type { MatchFoundData } from "@/lib/types/push";

/**
 * LINE Flex Message for match-found notifications.
 * Purple "MATCH" banner — AI-detected potential match between lost and found reports.
 * All user-facing text in Thai.
 */
export function matchFoundFlexMessage(data: MatchFoundData): messagingApi.FlexMessage {
  const confidencePercent = Math.round(data.matchConfidence * 100);

  return {
    type: "flex",
    altText: `\u{1F389} \u0E1E\u0E1A\u0E19\u0E49\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E04\u0E25\u0E49\u0E32\u0E22\u0E01\u0E31\u0E1A ${data.petName}!`,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: data.photoUrl,
        size: "full",
        aspectRatio: "4:3",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "\u{1F389} \u0E1E\u0E1A\u0E19\u0E49\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E04\u0E25\u0E49\u0E32\u0E22!",
            weight: "bold",
            size: "xl",
            color: "#7B2FBE",
          },
          {
            type: "text",
            text: data.petName,
            weight: "bold",
            size: "lg",
          },
          {
            type: "text",
            text: `\u{1F4CA} \u0E04\u0E27\u0E32\u0E21\u0E21\u0E31\u0E48\u0E19\u0E43\u0E08 ${confidencePercent}%`,
            size: "sm",
            color: "#7B2FBE",
            weight: "bold",
          },
          {
            type: "text",
            text: `\u{1F4CD} ${data.foundLocation}`,
            size: "sm",
            color: "#666666",
          },
          {
            type: "text",
            text: `\u{1F4C5} \u0E1E\u0E1A\u0E40\u0E21\u0E37\u0E48\u0E2D ${data.foundDate}`,
            size: "sm",
            color: "#999999",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#7B2FBE",
            action: {
              type: "uri",
              label: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E40\u0E25\u0E22",
              uri: data.alertUrl,
            },
          },
        ],
      },
    },
  };
}
