import { describe, it } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

const TESTFLIGHT = "https://testflight.apple.com/join/DCYydfe6";
const BN = "https://bn-friend-form.favs.workers.dev/";

async function handle(url, init = {}, env = {}) {
  return worker.fetch(new Request(url, init), env);
}

describe("upcoming-coming-soon redirects", () => {
  it("sends / to TestFlight", async () => {
    const res = await handle("https://whatsupcomi.ng/");
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), TESTFLIGHT);
  });

  it("sends generic waitlist-style paths to TestFlight", async () => {
    for (const path of ["/waitlist", "/index.html", "/foo", "/assets/logo.png"]) {
      const res = await handle(`https://whatsupcomi.ng${path}`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), TESTFLIGHT);
    }
  });

  it("normalizes www to apex before other routing", async () => {
    const res = await handle("https://www.whatsupcomi.ng/");
    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), "https://whatsupcomi.ng/");
  });

  it("keeps /n/:token BirthdayNotes redirects", async () => {
    const res = await handle("https://whatsupcomi.ng/n/abc123");
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), `${BN}?t=abc123`);
  });

  it("keeps /n/:token with a trailing slash and encoded token", async () => {
    const res = await handle("https://whatsupcomi.ng/n/hello%20world/");
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), `${BN}?t=hello%20world`);
  });

  it("keeps ?t= BirthdayNotes redirects", async () => {
    const res = await handle("https://whatsupcomi.ng/?t=fromquery");
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), `${BN}?t=fromquery`);
  });

  it("rejects non-POST /api/waitlist", async () => {
    const res = await handle("https://whatsupcomi.ng/api/waitlist");
    assert.equal(res.status, 405);
    assert.deepEqual(await res.json(), { ok: false, error: "method_not_allowed" });
  });

  it("accepts OPTIONS /api/waitlist", async () => {
    const res = await handle("https://whatsupcomi.ng/api/waitlist", { method: "OPTIONS" });
    assert.equal(res.status, 204);
  });

  it("rejects invalid waitlist email", async () => {
    const res = await handle("https://whatsupcomi.ng/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { ok: false, error: "invalid_email" });
  });

  it("accepts a valid waitlist POST", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), init });
      return new Response("{}", { status: 200 });
    };
    try {
      const res = await handle(
        "https://whatsupcomi.ng/api/waitlist",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "Person@Example.com" }),
        },
        {
          WAITLIST: {
            async get() {
              return null;
            },
            async put() {},
          },
        }
      );
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true });
      assert.equal(calls.length, 1);
      assert.match(calls[0].input, /join_upcoming_waitlist/);
      assert.deepEqual(JSON.parse(calls[0].init.body), {
        p_email: "person@example.com",
        p_source: "whatsupcomi.ng",
        p_user_agent: null,
        p_ip: null,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
