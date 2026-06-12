import { test as setup } from "@playwright/test";
import fs from "fs";
import path from "path";

const authDir = path.join(__dirname, ".auth");

setup("authenticate", async ({ request }) => {
  const res = await request.post("/api/auth/line", {
    data: { idToken: "e2e-test-token" },
  });

  if (!res.ok()) {
    // E2E_TEST_MODE not enabled on the target server — authenticated specs will skip
    setup.skip();
    return;
  }

  const { access_token } = await res.json();
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(path.join(authDir, "token.json"), JSON.stringify({ access_token }));
});
