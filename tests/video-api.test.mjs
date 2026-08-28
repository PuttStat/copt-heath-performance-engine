// Real route/access code with deterministic Supabase and Mux adapters. No live writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import Mux from "@mux/mux-node";
import { generateKeyPairSync, verify } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const id = "11111111-1111-4111-8111-111111111111",
  owner = "22222222-2222-4222-8222-222222222222",
  coach = "33333333-3333-4333-8333-333333333333";
const empty = () => ({ version: 1, shapes: [], note: "" });
function fixture(options = {}) {
  const rows = [];
  let signed = 0;
  const video = {
    id,
    player_id: owner,
    status: "ready",
    mux_asset_id: "asset",
    duration_seconds: 6,
    club: "7-iron",
    camera_view: "down_the_line",
    swing_type: "full_swing",
    ...options.video,
  };
  const admin = {
    from(table) {
      let mode = "select",
        values,
        filters = [];
      const query = {
        select() {
          return query;
        },
        eq(k, v) {
          filters.push([k, v]);
          return query;
        },
        order() {
          return query;
        },
        insert(v) {
          mode = "insert";
          values = v;
          return query;
        },
        update(v) {
          mode = "update";
          values = v;
          return query;
        },
        maybeSingle() {
          return Promise.resolve(result(true));
        },
        then(resolve, reject) {
          return Promise.resolve(result(false)).then(resolve, reject);
        },
      };
      function result(single) {
        if (table === "swing_videos")
          return { data: options.missing ? null : video, error: null };
        if (table === "profiles")
          return { data: { role: options.role || "player" }, error: null };
        if (table === "coach_player_links")
          return {
            data: options.linked ? { coach_id: coach } : null,
            error: null,
          };
        if (options.dbError) return { data: null, error: { code: "42P01" } };
        if (mode === "insert") {
          if (
            rows.some(
              (r) =>
                r.video_id === values.video_id &&
                r.author_id === values.author_id,
            )
          )
            return { data: null, error: { code: "23505" } };
          rows.push(values);
          return { data: values, error: null };
        }
        const matches = rows.filter((r) =>
          filters.every(([k, v]) => r[k] === v),
        );
        if (mode === "update") matches.forEach((r) => Object.assign(r, values));
        return { data: single ? (matches[0] ?? null) : matches, error: null };
      }
      return query;
    },
  };
  const environment = {
    NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture",
    MUX_SIGNING_KEY_ID: "fixture",
    MUX_SIGNING_PRIVATE_KEY: "fixture",
    ...options.env,
  };
  const mux = {
    video: {
      assets: {
        retrieve: async () => ({
          status: "ready",
          passthrough: id,
          playback_ids: [{ id: "signed-id", policy: "signed" }],
          max_stored_frame_rate: 30,
          duration: 6,
          ...options.asset,
        }),
      },
    },
    jwt: {
      signPlaybackId: async () => {
        signed++;
        return "fixture-token";
      },
    },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    function localRequire(spec) {
      if (spec === "server-only") return {};
      if (spec === "@supabase/supabase-js")
        return {
          createClient: () => ({
            auth: {
              getUser: async () => ({
                data: {
                  user: options.invalidAuth
                    ? null
                    : { id: options.user || owner },
                },
                error: null,
              }),
            },
          }),
        };
      if (spec.endsWith("/supabase/admin"))
        return { createAdminClient: () => admin };
      if (spec === "@/src/lib/mux") return { getMux: () => mux };
      if (spec.startsWith("@/"))
        return load(path.join(root, spec.slice(2)) + ".ts");
      if (spec.startsWith("."))
        return load(path.resolve(path.dirname(file), spec) + ".ts");
      return require(spec);
    }
    vm.runInNewContext(
      `(function(require,module,exports,process,Buffer,console){${js}\n})`,
      {},
      { filename: file },
    )(
      localRequire,
      module,
      module.exports,
      { env: environment },
      Buffer,
      console,
    );
    return module.exports;
  }
  const analysis = load(
    path.join(root, "app/api/videos/[videoId]/analysis/route.ts"),
  );
  const playback = load(
    path.join(root, "app/api/videos/[videoId]/playback/route.ts"),
  );
  const context = { params: Promise.resolve({ videoId: id }) };
  const request = (method = "GET", body, token = true) =>
    new Request("http://localhost/api/videos/" + id + "/analysis", {
      method,
      headers: token
        ? {
            Authorization: "Bearer fixture",
            "Content-Type": "application/json",
          }
        : {},
      ...(body === undefined
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    });
  return { analysis, playback, context, request, rows, signed: () => signed };
}
test("anonymous and expired sessions are denied", async () => {
  const f = fixture();
  assert.equal(
    (await f.analysis.GET(f.request("GET", undefined, false), f.context))
      .status,
    401,
  );
  const expired = fixture({ invalidAuth: true });
  assert.equal(
    (await expired.analysis.GET(expired.request(), expired.context)).status,
    401,
  );
});
test("player and coach both receive every saved drawing and note with author labels", async () => {
  for (const options of [{}, { user: coach, role: 'coach', linked: true }]) {
    const f = fixture(options);
    for (const author of [owner, coach]) f.rows.push({
      video_id: id, author_id: author, revision: 1,
      document: { ...empty(), note: author === owner ? 'Player feedback' : 'Coach feedback',
        shapes: [{ id, type: 'line', points: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.9 }],
          color: '#f4c95d', width: 3, time: 2, scope: 'frame' }] },
    });
    const response = await f.analysis.GET(f.request(), f.context);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.annotations.length, 2);
    assert.equal(body.annotations[0].author_label, 'Player');
    assert.match(body.annotations[1].author_label, /Coach/);
    assert.equal(body.annotations[0].document.note, 'Player feedback');
    assert.equal(body.annotations[1].document.note, 'Coach feedback');
    assert.equal(body.annotations[0].document.shapes[0].time, 2);
    assert.equal(body.annotations[1].document.shapes[0].points[1].x, 0.8);
  }
});
test("owner and linked coach can open; unrelated identities cannot", async () => {
  for (const [options, expected] of [
    [{}, 200],
    [{ user: coach, role: "coach", linked: true }, 200],
    [{ user: coach, role: "coach" }, 404],
    [{ user: coach, role: "player", linked: true }, 404],
    [{ user: coach, role: "admin" }, 404],
    [{ video: { status: "archived" } }, 404],
  ]) {
    const f = fixture(options);
    assert.equal(
      (await f.analysis.GET(f.request(), f.context)).status,
      expected,
    );
  }
});
test("save, reload, optimistic concurrency and server-owned author", async () => {
  const f = fixture();
  const doc = { ...empty(), note: "Posture" };
  const first = await f.analysis.PUT(
    f.request("PUT", { document: doc, revision: 0, author_id: coach }),
    f.context,
  );
  assert.equal(first.status, 200);
  assert.equal((await first.json()).author_id, owner);
  const read = await f.analysis.GET(f.request(), f.context);
  assert.match(read.headers.get("cache-control"), /no-store/);
  assert.equal((await read.json()).annotations[0].document.note, "Posture");
  assert.equal(
    (
      await f.analysis.PUT(
        f.request("PUT", { document: doc, revision: 0 }),
        f.context,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.analysis.PUT(
        f.request("PUT", { document: doc, revision: 1 }),
        f.context,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await f.analysis.PUT(
        f.request("PUT", { document: doc, revision: 1 }),
        f.context,
      )
    ).status,
    409,
  );
});
test("reject malformed, oversized and invalid saves without writing", async () => {
  const f = fixture();
  for (const [body, status] of [
    ["{", 400],
    ["a".repeat(100001), 413],
    [{ document: { ...empty(), note: "a".repeat(4001) }, revision: 0 }, 400],
    [{ document: empty(), revision: -1 }, 400],
  ])
    assert.equal(
      (await f.analysis.PUT(f.request("PUT", body), f.context)).status,
      status,
    );
  assert.equal(f.rows.length, 0);
});
test("missing annotation table is a visible setup failure", async () => {
  const f = fixture({ dbError: true });
  const res = await f.analysis.GET(f.request(), f.context);
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /migration/);
});
test("signed playback has no-store headers and never returns signing credentials", async () => {
  const f = fixture();
  const res = await f.playback.POST(f.request("POST"), f.context);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("cache-control"), /no-store/);
  const body = await res.json();
  assert.match(body.url, /signed-id.m3u8\?token=/);
  assert.equal(body.fps, 30);
  assert.equal("keySecret" in body, false);
  assert.equal(f.signed(), 1);
});
test("do not sign unowned, unready, public-only or unconfigured assets", async () => {
  for (const [options, expected] of [
    [{ asset: { passthrough: "someone-else" } }, 409],
    [{ asset: { status: "preparing" } }, 409],
    [{ asset: { playback_ids: [{ id: "public", policy: "public" }] } }, 409],
    [{ env: { MUX_SIGNING_PRIVATE_KEY: "" } }, 503],
    [{ user: coach, role: "coach" }, 404],
  ]) {
    const f = fixture(options);
    assert.equal(
      (await f.playback.POST(f.request("POST"), f.context)).status,
      expected,
    );
    assert.equal(f.signed(), 0);
  }
});
test("installed Mux SDK signs valid one-hour playback JWTs using PEM or base64 keys", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const mux = new Mux({ tokenId: "fixture", tokenSecret: "fixture" });
  for (const keySecret of [
    privateKey,
    Buffer.from(privateKey).toString("base64"),
  ]) {
    const token = await mux.jwt.signPlaybackId("fixture-playback", {
      keyId: "fixture-key",
      keySecret,
      type: "video",
      expiration: "1h",
    });
    const [header, payload, signature] = token.split(".");
    assert.equal(
      verify(
        "RSA-SHA256",
        Buffer.from(header + "." + payload),
        publicKey,
        Buffer.from(signature, "base64url"),
      ),
      true,
    );
    const decoded = JSON.parse(Buffer.from(payload, "base64url"));
    assert.equal(decoded.sub, "fixture-playback");
    assert.equal(decoded.aud, "v");
    assert.ok(
      decoded.exp - Date.now() / 1000 > 3500 &&
        decoded.exp - Date.now() / 1000 <= 3600,
    );
  }
});
