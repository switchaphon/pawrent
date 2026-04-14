import type { messagingApi } from "@line/bot-sdk";
import type { FoundPetAlertData } from "@/lib/types/push";

/**
 * LINE Flex Message for found pet alerts.
 * Green "FOUND" banner with pet photo, distance, and "View Details" CTA.
 * All user-facing text in Thai.
 */
export function foundPetFlexMessage(alert: FoundPetAlertData): messagingApi.FlexMessage {
  const descriptionParts = [alert.breed, alert.species].filter(Boolean);

  const bodyContents: messagingApi.FlexComponent[] = [
    {
      type: "text",
      text: "\u2705 \u0E1E\u0E1A\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07",
      weight: "bold",
      size: "xl",
      color: "#00AA00",
    },
    {
      type: "text",
      text: alert.petName,
      weight: "bold",
      size: "lg",
    },
    {
      type: "text",
      text:
        descriptionParts.length > 0
          ? descriptionParts.join(" \u2022 ")
          : "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E1E\u0E31\u0E19\u0E18\u0E38\u0E4C",
      size: "sm",
      color: "#666666",
    },
    {
      type: "text",
      text: `\u{1F4CD} ${alert.locationDescription || `${alert.distanceKm.toFixed(1)}km \u0E08\u0E32\u0E01\u0E04\u0E38\u0E13`}`,
      size: "sm",
      color: "#666666",
    },
    {
      type: "text",
      text: `\u{1F4C5} \u0E1E\u0E1A\u0E40\u0E21\u0E37\u0E48\u0E2D ${alert.foundDate}`,
      size: "sm",
      color: "#999999",
    },
  ];

  return {
    type: "flex",
    altText: `\u2705 \u0E1E\u0E1A\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07\u0E43\u0E01\u0E25\u0E49\u0E04\u0E38\u0E13: ${alert.petName}`,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: alert.photoUrl,
        size: "full",
        aspectRatio: "4:3",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: bodyContents,
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#00AA00",
            action: {
              type: "uri",
              label: "\u0E14\u0E39\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14",
              uri: alert.alertUrl,
            },
          },
        ],
      },
    },
  };
}
