import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileMock } = vi.hoisted(() => ({ readFileMock: vi.fn() }));

vi.mock("node:fs/promises", () => {
  const readdirMock = vi.fn().mockResolvedValue([]);
  return {
    readFile: readFileMock,
    readdir: readdirMock,
    default: { readFile: readFileMock, readdir: readdirMock },
  };
});

import { JsonFilePageStore } from "./json-file-page-store";
import { InvalidPageConfigError } from "./page-store";

function validConfigJson(id = "example", route = "/os/example") {
  return JSON.stringify({
    id,
    route,
    definition: { id: "example-page", kind: "page", children: [] },
  });
}

describe("JsonFilePageStore", () => {
  beforeEach(() => {
    readFileMock.mockReset();
  });

  it("getPageById resolves a valid config", async () => {
    readFileMock.mockResolvedValue(validConfigJson());
    const store = new JsonFilePageStore();

    const page = await store.getPageById("example");

    expect(page?.id).toBe("example");
    expect(page?.route).toBe("/os/example");
  });

  it("getPageById returns null when no file exists at that path (an unbuilt page, not an error)", async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error("no such file"), { code: "ENOENT" }));
    const store = new JsonFilePageStore();

    expect(await store.getPageById("does-not-exist")).toBeNull();
  });

  it("getPageById throws InvalidPageConfigError for malformed JSON, distinct from not-found", async () => {
    readFileMock.mockResolvedValue("{ this is not valid json");
    const store = new JsonFilePageStore();

    await expect(store.getPageById("broken")).rejects.toThrow(InvalidPageConfigError);
  });

  it("getPageById throws InvalidPageConfigError for JSON that fails schema validation", async () => {
    readFileMock.mockResolvedValue(JSON.stringify({ id: "x" })); // missing route/definition
    const store = new JsonFilePageStore();

    await expect(store.getPageById("x")).rejects.toThrow(InvalidPageConfigError);
  });

  it("rejects path-traversal / unsafe segments before ever touching the filesystem", async () => {
    const store = new JsonFilePageStore();

    expect(await store.getPageById("../../etc/passwd")).toBeNull();
    expect(await store.getPageById("/etc/passwd")).toBeNull();
    expect(await store.getPageById("a/../b")).toBeNull();
    expect(await store.getPageById("UPPERCASE")).toBeNull(); // outside the allowlisted charset
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("getPageByRoute derives the id from an /os/ route and delegates to getPageById", async () => {
    readFileMock.mockResolvedValue(validConfigJson("headless", "/os/headless"));
    const store = new JsonFilePageStore();

    const page = await store.getPageByRoute("/os/headless");

    expect(page?.id).toBe("headless");
  });

  it("getPageByRoute returns null (and never reads the filesystem) for a route outside /os", async () => {
    const store = new JsonFilePageStore();

    expect(await store.getPageByRoute("/auth/login")).toBeNull();
    expect(readFileMock).not.toHaveBeenCalled();
  });
});
