import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
const config = [
  ...next,
  ...ts,
  {
    ignores: [
      ".next/**",
      "next-env.d.ts",
      "public/monaco/**",
      "test-results/**",
      "playwright-report/**",
      "coverage/**",
    ],
  },
];

export default config;
