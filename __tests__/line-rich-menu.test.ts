/**
 * Tests for lib/line/rich-menu.ts — Rich Menu template and lifecycle helpers.
 *
 * Strategy: mock LINE Bot SDK clients, verify correct API call sequences.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRichMenuTemplate,
  uploadRichMenu,
  swapRichMenu,
  deleteRichMenu,
} from "@/lib/line/rich-menu";

describe("createRichMenuTemplate", () => {
  it("returns a 4-panel rich menu with 2500x1686 dimensions", () => {
    const template = createRichMenuTemplate("https://liff.line.me/test-liff-id");

    expect(template.size).toEqual({ width: 2500, height: 1686 });
    expect(template.selected).toBe(true);
    expect(template.name).toBeDefined();
    expect(template.chatBarText).toBeDefined();
    expect(template.areas).toHaveLength(4);
  });

  it("defines 4 tap areas covering the full menu grid", () => {
    const template = createRichMenuTemplate("https://liff.line.me/test-liff-id");
    const areas = template.areas;

    // 2x2 grid: each cell is 1250x843
    // Top-left
    expect(areas[0].bounds).toEqual({ x: 0, y: 0, width: 1250, height: 843 });
    // Top-right
    expect(areas[1].bounds).toEqual({ x: 1250, y: 0, width: 1250, height: 843 });
    // Bottom-left
    expect(areas[2].bounds).toEqual({ x: 0, y: 843, width: 1250, height: 843 });
    // Bottom-right
    expect(areas[3].bounds).toEqual({ x: 1250, y: 843, width: 1250, height: 843 });
  });

  it("uses URI actions pointing to LIFF URLs with correct paths", () => {
    const liffBase = "https://liff.line.me/test-liff-id";
    const template = createRichMenuTemplate(liffBase);

    for (const area of template.areas) {
      expect(area.action.type).toBe("uri");
      expect(area.action.uri).toContain(liffBase);
    }
  });

  it("maps panels to Home, Pets, Hospital, Profile paths", () => {
    const liffBase = "https://liff.line.me/test-liff-id";
    const template = createRichMenuTemplate(liffBase);
    const uris = template.areas.map((a) => a.action.uri);

    expect(uris[0]).toBe(`${liffBase}/`);
    expect(uris[1]).toBe(`${liffBase}/pets`);
    expect(uris[2]).toBe(`${liffBase}/post`);
    expect(uris[3]).toBe(`${liffBase}/profile`);
  });
});

describe("uploadRichMenu", () => {
  const mockClient = {
    createRichMenu: vi.fn(),
    setDefaultRichMenu: vi.fn(),
  };
  const mockBlobClient = {
    setRichMenuImage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.createRichMenu.mockResolvedValue({ richMenuId: "rm-123" });
    mockBlobClient.setRichMenuImage.mockResolvedValue(undefined);
    mockClient.setDefaultRichMenu.mockResolvedValue(undefined);
  });

  it("calls createRichMenu → setRichMenuImage → setDefaultRichMenu in order", async () => {
    const callOrder: string[] = [];
    mockClient.createRichMenu.mockImplementation(async () => {
      callOrder.push("create");
      return { richMenuId: "rm-123" };
    });
    mockBlobClient.setRichMenuImage.mockImplementation(async () => {
      callOrder.push("uploadImage");
    });
    mockClient.setDefaultRichMenu.mockImplementation(async () => {
      callOrder.push("setDefault");
    });

    const imageBuffer = Buffer.from("fake-image");
    await uploadRichMenu(
      mockClient as never,
      mockBlobClient as never,
      "https://liff.line.me/test",
      imageBuffer
    );

    expect(callOrder).toEqual(["create", "uploadImage", "setDefault"]);
  });

  it("returns the created rich menu ID", async () => {
    const imageBuffer = Buffer.from("fake-image");
    const result = await uploadRichMenu(
      mockClient as never,
      mockBlobClient as never,
      "https://liff.line.me/test",
      imageBuffer
    );

    expect(result).toBe("rm-123");
  });

  it("passes image buffer to setRichMenuImage", async () => {
    const imageBuffer = Buffer.from("fake-image");
    await uploadRichMenu(
      mockClient as never,
      mockBlobClient as never,
      "https://liff.line.me/test",
      imageBuffer
    );

    expect(mockBlobClient.setRichMenuImage).toHaveBeenCalledWith("rm-123", expect.any(Blob));
  });
});

describe("swapRichMenu", () => {
  it("calls setDefaultRichMenu with the given menu ID", async () => {
    const mockClient = {
      setDefaultRichMenu: vi.fn().mockResolvedValue(undefined),
    };

    await swapRichMenu(mockClient as never, "rm-456");

    expect(mockClient.setDefaultRichMenu).toHaveBeenCalledWith("rm-456");
  });
});

describe("deleteRichMenu", () => {
  it("calls deleteRichMenu with the given menu ID", async () => {
    const mockClient = {
      deleteRichMenu: vi.fn().mockResolvedValue(undefined),
    };

    await deleteRichMenu(mockClient as never, "rm-789");

    expect(mockClient.deleteRichMenu).toHaveBeenCalledWith("rm-789");
  });
});
