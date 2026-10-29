import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ForensicWorkbench from "../src/components/forensic-workbench";
import ImpactGraph from "../src/components/impact-graph";
it("renders discoverable tools and disables investigations without a repository", () => {
  const html = renderToStaticMarkup(
    createElement(ForensicWorkbench, {
      initialKind: "recovery",
      repos: [],
      repository: null,
      branches: [],
      branch: "",
      selected: null,
      commits: [],
      onRepository: () => {},
    }),
  );
  for (const title of [
    "Smart code recovery",
    "Code impact graph",
    "Security regressions",
    "Feature evolution timeline",
  ])
    expect(html).toContain(title);
  expect(html).toContain("Connect a repository to begin");
  expect(html).toContain("disabled");
  expect(html).not.toContain("Proposed restoration patch");
});
it("renders graph relationship controls and explicit certainty labels", () => {
  const html = renderToStaticMarkup(
    createElement(ImpactGraph, {
      graph: { nodes: [], edges: [], limitations: [] },
      repositoryUrl: "https://github.com/fixture/repo",
      sha: "a".repeat(40),
    }),
  );
  expect(html).toContain("Search nodes");
  expect(html).toContain("Transitive dependents");
  expect(html).toContain("behavioral effects remain predictions");
  expect(html).toContain("No supported nodes");
});
