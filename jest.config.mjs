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

export default createJestConfig(config);
