import { messagingApi } from "@line/bot-sdk";

function getChannelAccessToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  }
  return token;
}

export function getLineClient(): messagingApi.MessagingApiClient {
  return new messagingApi.MessagingApiClient({
    channelAccessToken: getChannelAccessToken(),
  });
}

export function getLineBlobClient(): messagingApi.MessagingApiBlobClient {
  return new messagingApi.MessagingApiBlobClient({
    channelAccessToken: getChannelAccessToken(),
  });
}
