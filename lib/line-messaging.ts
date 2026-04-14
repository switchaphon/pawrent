import { messagingApi } from "@line/bot-sdk";
import { getLineClient } from "@/lib/line/client";

/**
 * Push a message to a single LINE user.
 */
export async function pushMessage(userId: string, messages: messagingApi.Message[]): Promise<void> {
  const client = getLineClient();
  await client.pushMessage({ to: userId, messages });
}

/**
 * Multicast messages to multiple LINE users.
 * LINE multicast API supports max 500 recipients per call.
 * Batches automatically if more than 500.
 */
export async function multicastMessage(
  userIds: string[],
  messages: messagingApi.Message[]
): Promise<number> {
  if (userIds.length === 0) return 0;

  const client = getLineClient();
  const batches = chunk(userIds, 500);
  let sent = 0;

  for (const batch of batches) {
    await client.multicast({ to: batch, messages });
    sent += batch.length;
  }

  return sent;
}

/**
 * Check if the current time (Asia/Bangkok) falls within quiet hours.
 * Quiet hours wrap around midnight, e.g. 22:00 - 07:00.
 * Returns true if push should be suppressed.
 */
export function isQuietHours(
  quietStart: string | null,
  quietEnd: string | null,
  now?: Date
): boolean {
  if (!quietStart || !quietEnd) return false;

  const currentTime = now ?? new Date();
  // Use Bangkok timezone
  const bangkokTime = new Date(currentTime.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const currentMinutes = bangkokTime.getHours() * 60 + bangkokTime.getMinutes();

  const [startH, startM] = quietStart.split(":").map(Number);
  const [endH, endM] = quietEnd.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle wrap-around (e.g. 22:00 - 07:00)
  if (startMinutes <= endMinutes) {
    // Same day range (e.g. 08:00 - 12:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Wrap-around (e.g. 22:00 - 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Split an array into chunks of the given size.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}
