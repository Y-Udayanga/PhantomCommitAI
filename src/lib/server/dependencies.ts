import "server-only";
import ts from "typescript";
import { posix } from "node:path";
export type CodeNode = {
  id: string;
  label: string;
  file: string;
  line: number;
  kind: string;
};
export type CodeEdge = {
  id: string;
  source: string;
  target: string;
  kind: string;
  file: string;
  line: number;
};
export type CodeGraph = {
  nodes: CodeNode[];
  edges: CodeEdge[];
  limitations: string[];
};
/** A filesystem-free compiler host: parsing never loads or executes repository code. */
export function extractDependencies(input: Record<string, string>): CodeGraph {
  const files = Object.fromEntries(
    Object.entries(input)
      .filter(([p, text]) => /\.[cm]?[jt]sx?$/.test(p) && text.length <= 150000)
      .slice(0, 12)
      .map(([p, t]) => ["/" + p, t]),
  );
  const host: ts.CompilerHost = {
    getSourceFile: (p, version) =>
      files[p] === undefined
        ? undefined
        : ts.createSourceFile(p, files[p], version, true),
    getDefaultLibFileName: () => "",
    writeFile: () => {},
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    fileExists: (p) => files[p] !== undefined,
    readFile: (p) => files[p],
    getCanonicalFileName: (p) => p,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    resolveModuleNames: (names, from) =>
      names.map((name) => {
        if (!name.startsWith(".")) return undefined;
        const root = posix.resolve(posix.dirname(from), name);
        const found = [
          root,
          ...[
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            "/index.ts",
            "/index.tsx",
            "/index.js",
          ].map((ext) => root + ext),
        ].find((p) => files[p] !== undefined);
        return found ? { resolvedFileName: found } : undefined;
      }),
  };
  const program = ts.createProgram(
    Object.keys(files),
    {
      allowJs: true,
      noLib: true,
      noResolve: false,
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.Latest,
    },
    host,
  );
  const checker = program.getTypeChecker();
  const nodes: CodeNode[] = [],
    edges: CodeEdge[] = [];
  const declarations = new Map<ts.Node, string>();
  const sources = program
    .getSourceFiles()
    .filter((s) => files[s.fileName] !== undefined);
  const line = (n: ts.Node) =>
    n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const fileId = (s: ts.SourceFile) => s.fileName.slice(1);
  const addEdge = (
    source: string,
    target: string,
    kind: string,
    n: ts.Node,
  ) => {
    if (edges.length >= 1500) return;
    const id = `${source}>${target}:${kind}:${line(n)}`;
    if (!edges.some((e) => e.id === id))
      edges.push({
        id,
        source,
        target,
        kind,
        file: fileId(n.getSourceFile()),
        line: line(n),
      });
  };
  for (const s of sources) {
    nodes.push({
      id: fileId(s),
      label: fileId(s),
      file: fileId(s),
      line: 1,
      kind: "file",
    });
    function collect(n: ts.Node) {
      if (nodes.length >= 500) return;
      if (
        (ts.isFunctionDeclaration(n) ||
          ts.isClassDeclaration(n) ||
          ts.isMethodDeclaration(n) ||
          (ts.isVariableDeclaration(n) &&
            n.initializer &&
            (ts.isArrowFunction(n.initializer) ||
              ts.isFunctionExpression(n.initializer)))) &&
        n.name
      ) {
        const label = n.name.getText(s),
          id = `${fileId(s)}#${label}:${line(n)}`;
        declarations.set(n, id);
        if (ts.isVariableDeclaration(n) && n.initializer)
          declarations.set(n.initializer, id);
        nodes.push({
          id,
          label,
          file: fileId(s),
          line: line(n),
          kind: ts.isClassDeclaration(n)
            ? "class"
            : /^[A-Z]/.test(label)
              ? "component"
              : "function",
        });
        addEdge(fileId(s), id, "contains", n);
      }
      ts.forEachChild(n, collect);
    }
    collect(s);
  }
  const resolve = (n: ts.Node) => {
    let symbol = checker.getSymbolAtLocation(n);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias)
      symbol = checker.getAliasedSymbol(symbol);
    return symbol?.declarations?.map((d) => declarations.get(d)).find(Boolean);
  };
  for (const s of sources) {
    function visit(n: ts.Node, owner: string) {
      owner = declarations.get(n) || owner;
      if (
        (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
        n.moduleSpecifier &&
        ts.isStringLiteral(n.moduleSpecifier)
      ) {
        const symbol = checker.getSymbolAtLocation(n.moduleSpecifier);
        const target = symbol?.declarations?.find(ts.isSourceFile);
        if (target && files[target.fileName] !== undefined)
          addEdge(
            fileId(s),
            fileId(target),
            ts.isImportDeclaration(n) ? "imports" : "exports",
            n,
          );
      }
      if (
        ts.isCallExpression(n) ||
        ts.isNewExpression(n) ||
        ts.isJsxOpeningElement(n) ||
        ts.isJsxSelfClosingElement(n)
      ) {
        const expression =
          ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)
            ? n.tagName
            : n.expression;
        const target = resolve(
          ts.isPropertyAccessExpression(expression)
            ? expression.name
            : expression,
        );
        if (target)
          addEdge(
            owner,
            target,
            ts.isNewExpression(n)
              ? "constructs"
              : ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)
                ? "renders"
                : "calls",
            n,
          );
      }
      if (ts.isExpressionWithTypeArguments(n)) {
        const target = resolve(n.expression);
        if (target) addEdge(owner, target, "extends/implements", n);
      }
      ts.forEachChild(n, (child) => visit(child, owner));
    }
    visit(s, fileId(s));
  }
  return {
    nodes,
    edges,
    limitations: [
      "Static JS/TS relationships in at most 12 selected files (500 nodes / 1,500 edges). Missing files, aliases, external packages, reflection, dynamic calls and runtime dispatch are unresolved. Edges prove syntax/binding, not runtime execution.",
      ...(nodes.length >= 500 || edges.length >= 1500
        ? ["Graph limit reached; results are partial."]
        : []),
    ],
  };
}
export function compareGraphs(before: CodeGraph, after: CodeGraph) {
  // Ignore line movement; report a relationship change as a removal plus an addition.
  const key = (e: CodeEdge) =>
    `${e.source.replace(/:\d+$/, "")}>${e.target.replace(/:\d+$/, "")}:${e.kind}`;
  const old = new Set(before.edges.map(key)),
    current = new Set(after.edges.map(key));
  return {
    added: after.edges.filter((e) => !old.has(key(e))),
    removed: before.edges.filter((e) => !current.has(key(e))),
  };
}
