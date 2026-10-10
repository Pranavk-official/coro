import { expect, test } from "@playwright/test";
import { presenceLabel } from "@/lib/utils/presence";

test("U20 presence label wording", () => {
  expect(presenceLabel({ count: 0, names: [] })).toBe("No one else is here");
  expect(presenceLabel({ count: 1, names: ["Dana"] })).toBe("Dana is in this call");
  expect(presenceLabel({ count: 2, names: ["Dana", "Lee"] })).toBe("Dana and Lee are in this call");
  expect(presenceLabel({ count: 3, names: ["Dana", "Lee", "Kim"] })).toBe("Dana, Lee and 1 other are in this call");
  expect(presenceLabel({ count: 6, names: ["Dana", "Lee", "Kim"] })).toBe("Dana, Lee and 4 others are in this call");
});
