import type { messagingApi } from "@line/bot-sdk";
import type { SightingUpdateData } from "@/lib/types/push";

/**
 * LINE Flex Message for sighting updates.
 * Orange "SIGHTING" banner — notifies the pet owner that someone spotted their pet.
 * All user-facing text in Thai.
 */
export function sightingUpdateFlexMessage(data: SightingUpdateData): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: `\u{1F440} \u0E21\u0E35\u0E04\u0E19\u0E1E\u0E1A\u0E40\u0E2B\u0E47\u0E19 ${data.petName}!`,
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
            text: "\u{1F440} \u0E21\u0E35\u0E04\u0E19\u0E1E\u0E1A\u0E40\u0E2B\u0E47\u0E19\u0E19\u0E49\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13!",
            weight: "bold",
            size: "xl",
            color: "#FF8C00",
          },
          {
            type: "text",
            text: data.petName,
            weight: "bold",
            size: "lg",
          },
          {
            type: "text",
            text: `\u{1F4CD} ${data.sightingLocation}`,
            size: "sm",
            color: "#666666",
          },
          {
            type: "text",
            text: `\u{23F0} ${data.sightingTime}`,
            size: "sm",
            color: "#666666",
          },
          {
            type: "text",
            text: `\u{1F4CF} \u0E2B\u0E48\u0E32\u0E07\u0E08\u0E32\u0E01\u0E08\u0E38\u0E14\u0E2B\u0E32\u0E22 ${data.distanceKm.toFixed(1)}km`,
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
            color: "#FF8C00",
            action: {
              type: "uri",
              label:
                "\u0E14\u0E39\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E1A\u0E19\u0E41\u0E1C\u0E19\u0E17\u0E35\u0E48",
              uri: data.alertUrl,
            },
          },
        ],
      },
    },
  };
}
