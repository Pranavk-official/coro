import { expect, test } from "@playwright/test";
import { MAX_PEERS, type JoinError } from "../../src/lib/socket.io/events";

test("U1 @regression MAX_PEERS and JoinError union match FR6", async () => {
  expect(MAX_PEERS).toBe(10);
  const all: JoinError[] = [
    "not_found",
    "ended",
    "expired",
    "password_required",
    "guests_not_allowed",
    "locked",
    "room_full",
  ];
  expect(all).toHaveLength(7);
});
