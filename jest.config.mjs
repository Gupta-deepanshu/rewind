// Jest with Next.js's built-in setup (next/jest): SWC transforms, CSS modules and next/font mocked,
// .env files loaded. See node_modules/next/dist/docs/01-app/02-guides/testing/jest.md
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  coverageProvider: "v8",
  // components need a DOM; tests of server code opt into "node" with a @jest-environment docblock
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/jest.env.js"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts", "!src/components/reactbits/**", "!src/lib/data/details.ts"],
};

/**
 * The Vercel AI SDK and its dependencies ship only as ES modules, which Jest (CommonJS) can't
 * load as they are. next/jest leaves node_modules untransformed, so these packages are let
 * through its ignore pattern and compiled by SWC like our own code.
 */
const ESM_PACKAGES = ["ai", "@ai-sdk", "@standard-schema", "@workflow", "@vercel/oidc", "eventsource-parser"];

export default async function jestConfig() {
  const resolved = await createJestConfig(config)();
  const esm = ESM_PACKAGES.map((p) => p.replace("/", "[\\\\/]")).join("|");
  return {
    ...resolved,
    transformIgnorePatterns: [
      `/node_modules/(?!(${esm})[\\\\/])(?!.pnpm)(?!(geist|next/dist/client|next/dist/shared/lib|next/src/client|next/src/shared/lib)/)`,
      ...resolved.transformIgnorePatterns.filter((p) => !p.startsWith("/node_modules/(?!.pnpm)")),
    ],
  };
}
