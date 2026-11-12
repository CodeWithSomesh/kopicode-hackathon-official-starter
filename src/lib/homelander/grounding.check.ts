// Run with `npm run check:grounding`: the form only fills from the buyer's own words.
import assert from "node:assert/strict";
import { groundPatch } from "./grounding.ts";

// Nothing said about money: a guessed salary and age never reach the form.
assert.deepEqual(
  groundPatch({ grossRM: 6000, age: 30, livingWith: "partner" }, [{ field: "livingWith", quote: "me and my wife" }], "Me and my wife."),
  { livingWith: "partner" },
);

// A quote the buyer never said (it was Mochi's line) is rejected.
assert.deepEqual(
  groundPatch({ grossRM: 5000 }, [{ field: "grossRM", quote: "if you earn RM5,000" }], "Hello, who are you?"),
  {},
);

// Real numbers in English, Malay, Mandarin and Tamil pass, matched without spacing or punctuation.
assert.deepEqual(groundPatch({ grossRM: 8000 }, [{ field: "grossRM", quote: "RM 8,000 a month" }], "I earn rm8,000 a month."), { grossRM: 8000 });
assert.deepEqual(groundPatch({ grossRM: 5000 }, [{ field: "grossRM", quote: "gaji saya lima ribu" }], "Gaji saya lima ribu sebulan"), { grossRM: 5000 });
assert.deepEqual(groundPatch({ grossRM: 8000 }, [{ field: "grossRM", quote: "我月薪八千" }], "我月薪八千块。"), { grossRM: 8000 });
assert.deepEqual(groundPatch({ age: 30 }, [{ field: "age", quote: "எனக்கு 30 வயது" }], "எனக்கு 30 வயது"), { age: 30 });
assert.deepEqual(groundPatch({ workArea: "Kuala Lumpur" }, [{ field: "workArea", quote: "我在吉隆坡工作" }], "我在吉隆坡工作"), { workArea: "Kuala Lumpur" });

// A number field quoted without any number is dropped; "no car loan" may set 0.
assert.deepEqual(groundPatch({ savingsRM: 30000 }, [{ field: "savingsRM", quote: "some savings" }], "I have some savings"), {});
assert.deepEqual(groundPatch({ carRM: 0 }, [{ field: "carRM", quote: "takde loan kereta" }], "Takde loan kereta"), { carRM: 0 });

// householdSize follows from who they live with; one stray character proves nothing.
assert.deepEqual(
  groundPatch({ livingWith: "partner", householdSize: 2 }, [{ field: "livingWith", quote: "my husband" }], "With my husband"),
  { livingWith: "partner", householdSize: 2 },
);
assert.deepEqual(groundPatch({ homeType: "landed" }, [{ field: "homeType", quote: "I" }], "I"), {});

// Office days said as weekdays, not digits, still count.
assert.deepEqual(groundPatch({ officeDays: 5 }, [{ field: "officeDays", quote: "I work every Monday to Friday" }], "I work every Monday to Friday"), { officeDays: 5 });
assert.deepEqual(groundPatch({ officeDays: 5 }, [{ field: "officeDays", quote: "我星期一到星期五上班" }], "我星期一到星期五上班"), { officeDays: 5 });

console.log("grounding: all checks passed");
