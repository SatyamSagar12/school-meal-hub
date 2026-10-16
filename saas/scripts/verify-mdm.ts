/**
 * The meal arithmetic, checked against figures worked out by hand.
 *   npm run verify
 */
import assert from "node:assert/strict";
import {
  classKey,
  computeExpense,
  dayTotals,
  DEFAULT_RATES,
  scopeExpenseRow,
  tierForClass,
  todayISO,
  isIsoDate,
} from "../src/lib/mdm";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok  ${name}`);
}

check("tiers from class names", () => {
  assert.equal(tierForClass("5"), "primary");
  assert.equal(tierForClass("6th"), "upper_primary");
  assert.equal(tierForClass("8-B"), "upper_primary");
  assert.equal(tierForClass("LKG"), "primary");
  assert.equal(tierForClass("9"), "primary");
});

// The day the end-to-end test recorded: 75 primary, 49 upper primary.
const present = new Map([
  [classKey("1", "A"), 10],
  [classKey("2", "A"), 17],
  [classKey("3", "A"), 16],
  [classKey("4", "A"), 16],
  [classKey("5", "A"), 16],
  [classKey("6", "A"), 17],
  [classKey("7", "A"), 16],
  [classKey("8", "A"), 16],
]);
const calc = computeExpense(present, DEFAULT_RATES, { dalRate: 120, vegRate: 40, miscCost: 50 });

check("quantities per tier", () => {
  assert.equal(calc.byTier.primary.present, 75);
  assert.equal(calc.byTier.upper_primary.present, 49);
  assert.equal(calc.riceKg, 14.85); // 75x100 + 49x150 g
  assert.equal(calc.dalKg, 2.97);
  assert.equal(calc.vegKg, 7.425);
});

check("costs and budget", () => {
  assert.equal(calc.dalCost, 356.4);
  assert.equal(calc.vegCost, 297);
  assert.equal(calc.masalaCost, 178.2);
  assert.equal(calc.fuelCost, 148.5);
  assert.equal(calc.totalExpense, 1030.1);
  assert.equal(calc.budget, 1006.83); // 75x6.78 + 49x10.17
  assert.equal(calc.creditsSaved, -23.27);
});

check("class override beats tier rate", () => {
  const c = computeExpense(present, DEFAULT_RATES, { dalRate: 0, vegRate: 0, miscCost: 0 }, [{ className: "1", section: "", budgetPerStudent: 10 }]);
  assert.equal(c.budget, 1039.03); // class 1: 10 children at ₹10 instead of ₹6.78
});

check("quick count overrides student-wise for the same class", () => {
  const marks = Array.from({ length: 17 }, (_, i) => ({ className: "6", section: "A", present: i > 0 }));
  const t = dayTotals(marks, [{ className: "6", section: "A", presentCount: 17, enrolledCount: 17 }]);
  assert.equal(t.present, 17);
  assert.equal(t.absent, 0);
  const s = dayTotals(marks, []);
  assert.equal(s.present, 16);
  assert.equal(s.absent, 1);
});

check("tier reports add up to the combined one", () => {
  const row = {
    date: "2026-10-17",
    presentCount: calc.present,
    presentUpper: calc.byTier.upper_primary.present,
    riceKg: calc.riceKg,
    dalKg: calc.dalKg,
    vegKg: calc.vegKg,
    riceKgUpper: calc.byTier.upper_primary.riceKg,
    dalKgUpper: calc.byTier.upper_primary.dalKg,
    vegKgUpper: calc.byTier.upper_primary.vegKg,
    dalCost: calc.dalCost,
    vegCost: calc.vegCost,
    masalaCost: calc.masalaCost,
    fuelCost: calc.fuelCost,
    miscCost: calc.miscCost,
    totalExpense: calc.totalExpense,
    budget: calc.budget,
    creditsSaved: calc.creditsSaved,
  };
  const p = scopeExpenseRow(row, "primary");
  const u = scopeExpenseRow(row, "upper_primary");
  assert.equal(p.present + u.present, row.presentCount);
  assert.ok(Math.abs(p.riceKg + u.riceKg - row.riceKg) < 0.001);
  assert.ok(Math.abs(p.budget + u.budget - row.budget) <= 0.01);
  assert.ok(Math.abs(p.totalExpense + u.totalExpense - row.totalExpense) <= 0.02);
});

check("dates are Indian calendar days", () => {
  // 20:00 UTC on 16 Oct is 01:30 IST on 17 Oct.
  assert.equal(todayISO(new Date("2026-10-16T20:00:00Z")), "2026-10-17");
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2028-02-29"), true);
});

console.log(`\n${passed} checks passed`);
