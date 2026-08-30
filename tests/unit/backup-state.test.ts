import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";

import { signState, verifyState } from "~/lib/backup/oauth";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function resign(payload: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("test requires SUPABASE_SERVICE_ROLE_KEY");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe("backup OAuth state", () => {
  it("round-trips a signed provider for the same user", () => {
    for (const provider of ["google_drive", "dropbox", "onedrive"] as const) {
      expect(verifyState(signState(provider, USER_A), USER_A)).toBe(provider);
    }
  });

  it("rejects a state signed for another user", () => {
    expect(verifyState(signState("google_drive", USER_A), USER_B)).toBeNull();
  });

  it("rejects tampered state", () => {
    const state = signState("google_drive", USER_A);
    const forged = state.replace("google_drive", "onedrive");
    expect(verifyState(forged, USER_A)).toBeNull();
  });

  it("rejects garbage and missing state", () => {
    expect(verifyState(null, USER_A)).toBeNull();
    expect(verifyState("", USER_A)).toBeNull();
    expect(verifyState("google_drive", USER_A)).toBeNull();
    expect(verifyState("a.b.c", USER_A)).toBeNull();
    expect(verifyState("a.b.c.d", USER_A)).toBeNull();
  });

  it("rejects expired state even when correctly re-signed", () => {
    const state = signState("dropbox", USER_A);
    const parts = state.split(".");
    const provider = parts[0] ?? "";
    const userId = parts[1] ?? "";
    const expiry = parts[2] ?? "";
    const past = String(Number(expiry) - 20 * 60 * 1000);
    const payload = `${provider}.${userId}.${past}`;
    expect(verifyState(`${payload}.${resign(payload)}`, USER_A)).toBeNull();
  });
});
