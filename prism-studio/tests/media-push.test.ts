import { describe, expect, it } from "vitest";
import { pushAuthorized, pushPath, pushToken } from "../src/domain/media-push";

describe("media push", () => {
  it("allows only the files the studio reads, under films/channels", () => {
    for (const ok of ["films/channels/physics/ep01/out/rest-frame-001-9x16.mp4", "films/channels/physics/ep01/out/rest-frame-001-cover.jpg",
      "films/channels/body/ep06/script.md", "films/channels/body/ep06/claims.json", "films/channels/body/ep06/film.json",
      "films/channels/space/ep02/build/qa-delivery.json", "films/channels/space/compilations/vol01/vol01-16x9.mp4",
      "films/channels/space/compilations/vol01/chapters.txt", "films/channels/skincare/ep01/out/POSTING.md"]) expect(pushPath(ok)).toBe(ok);
  });
  it("refuses escapes, hidden files, other folders and other kinds of file", () => {
    for (const bad of ["../.env", "films/channels/physics/ep01/../../../.env", "films/channels/physics/ep01/out/.x.mp4", "films/channels/physics/ep01/out/a.sh",
      "films/channels/physics/ep01/build/frames/0001.png", "films/channels/physics/ep01/out/sub/a.mp4", "films/channels/Physics/ep01/script.md",
      "films/channels/physics/ep1/script.md", "films/kits/x.json", "prism-studio/.env.local", "/etc/passwd", "films/channels/physics/ep01/out/a.mp4/",
      "films\\channels\\physics\\ep01\\script.md", "films/channels/physics/compilations/a/b/c.mp4", "films/channels/physics/ep01/script.md\n"]) expect(pushPath(bad)).toBeNull();
  });
  it("needs a 32+ character token, sent as a bearer token", () => {
    const env = { MEDIA_PUSH_TOKEN: "t".repeat(40) };
    expect(pushAuthorized(`Bearer ${"t".repeat(40)}`, env)).toBe(true);
    expect(pushAuthorized(`Bearer ${"t".repeat(39)}`, env)).toBe(false);
    expect(pushAuthorized("t".repeat(40), env)).toBe(false);
    expect(pushAuthorized(null, env)).toBe(false);
    expect(pushToken({ MEDIA_PUSH_TOKEN: "short" })).toBeNull();
    expect(pushAuthorized("Bearer short", { MEDIA_PUSH_TOKEN: "short" })).toBe(false);
    expect(pushAuthorized("Bearer ", {})).toBe(false);
  });
});
