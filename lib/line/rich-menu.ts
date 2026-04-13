import type { messagingApi } from "@line/bot-sdk";

interface RichMenuBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RichMenuUriArea {
  bounds: RichMenuBounds;
  action: { type: "uri"; label: string; uri: string };
}

interface RichMenuTemplate {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: RichMenuUriArea[];
}

const MENU_WIDTH = 2500;
const MENU_HEIGHT = 1686;
const COLS = 2;
const ROWS = 2;
const CELL_WIDTH = MENU_WIDTH / COLS; // 1250
const CELL_HEIGHT = MENU_HEIGHT / ROWS; // 843

const PANELS = [
  { path: "/", label: "Home" },
  { path: "/pets", label: "My Pets" },
  { path: "/post", label: "Lost & Found" },
  { path: "/profile", label: "Profile" },
] as const;

export function createRichMenuTemplate(liffBaseUrl: string): RichMenuTemplate {
  const areas: RichMenuUriArea[] = PANELS.map((panel, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    return {
      bounds: {
        x: col * CELL_WIDTH,
        y: row * CELL_HEIGHT,
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
      },
      action: {
        type: "uri" as const,
        label: panel.label,
        uri: `${liffBaseUrl}${panel.path}`,
      },
    };
  });

  return {
    size: { width: MENU_WIDTH, height: MENU_HEIGHT },
    selected: true,
    name: "Pawrent Main Menu",
    chatBarText: "Open Menu",
    areas,
  };
}

export async function uploadRichMenu(
  client: messagingApi.MessagingApiClient,
  blobClient: messagingApi.MessagingApiBlobClient,
  liffBaseUrl: string,
  imageBuffer: Buffer
): Promise<string> {
  const template = createRichMenuTemplate(liffBaseUrl);
  const { richMenuId } = await client.createRichMenu(template);

  const uint8 = new Uint8Array(imageBuffer);
  const blob = new Blob([uint8], { type: "image/png" });
  await blobClient.setRichMenuImage(richMenuId, blob);

  await client.setDefaultRichMenu(richMenuId);

  return richMenuId;
}

export async function swapRichMenu(
  client: messagingApi.MessagingApiClient,
  richMenuId: string
): Promise<void> {
  await client.setDefaultRichMenu(richMenuId);
}

export async function deleteRichMenu(
  client: messagingApi.MessagingApiClient,
  richMenuId: string
): Promise<void> {
  await client.deleteRichMenu(richMenuId);
}
