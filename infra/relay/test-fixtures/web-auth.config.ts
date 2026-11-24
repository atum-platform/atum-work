import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["infra/relay/test-fixtures/web-auth.test.tsx"],
  },
});
