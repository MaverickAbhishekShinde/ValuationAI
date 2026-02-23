/**
 * dcfEngine.test.js — Unit tests for the DCF Valuation Engine
 *
 * Run:  node dcfEngine.test.js
 */

import { runDCF, sensitivityTable } from './dcfEngine.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${message}`);
    } else {
        failed++;
        console.error(`  ✗ ${message}`);
    }
}

function assertClose(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    const ok = diff <= tolerance;
    if (ok) {
        passed++;
        console.log(`  ✓ ${message} (actual: ${actual.toFixed(4)}, expected: ${expected})`);
    } else {
        failed++;
        console.error(
            `  ✗ ${message} — actual: ${actual.toFixed(4)}, expected: ${expected}, diff: ${diff.toFixed(4)}`,
        );
    }
}

// ─── Amazon test inputs ──────────────────────────────────────────────────────

const AMAZON = {
    revenue_base: 574785,
    ebit_base: 65139,
    revenue_growth_yr1: 0.12,
    revenue_growth_yr2_5: 0.12,
    operating_margin_base: 0.1133,
    operating_margin_target: 0.14,
    margin_convergence_year: 5,
    tax_rate_effective: 0.19,
    tax_rate_marginal: 0.25,
    sales_to_capital_1_5: 1.5,
    sales_to_capital_6_10: 1.5,
    wacc: 0.086,
    riskfree_rate: 0.0408,
    cash: 86780,
    debt: 161574,
    shares_outstanding: 10492,
    current_price: 169,
    minority_interests: 0,
    non_operating_assets: 2954,
    prob_failure: 0,
};

// ─── test suite ──────────────────────────────────────────────────────────────

console.log('\n=== DCF Engine Tests ===\n');

// ── Test 1: basic structure ──────────────────────────────────────────────────

console.log('1. Output structure');
const result = runDCF(AMAZON);

assert(typeof result.intrinsic_value_per_share === 'number', 'intrinsic_value_per_share is a number');
assert(typeof result.upside_pct === 'number', 'upside_pct is a number');
assert(typeof result.value_equity === 'number', 'value_equity is a number');
assert(typeof result.value_operating_assets === 'number', 'value_operating_assets is a number');
assert(typeof result.pv_terminal_value === 'number', 'pv_terminal_value is a number');
assert(typeof result.pv_cf_10years === 'number', 'pv_cf_10years is a number');
assert(Array.isArray(result.yearByYear), 'yearByYear is an array');
assert(result.yearByYear.length === 10, 'yearByYear has 10 entries');
assert(typeof result.terminalYear === 'object', 'terminalYear is an object');

// ── Test 2: year-by-year fields ──────────────────────────────────────────────

console.log('\n2. Year-by-year field presence');
const y1 = result.yearByYear[0];
const requiredFields = [
    'year', 'revenue', 'revenue_growth', 'margin', 'ebit',
    'tax_rate', 'nopat', 'reinvestment', 'fcff', 'wacc',
    'discount_factor', 'pv_fcff',
];
for (const field of requiredFields) {
    assert(field in y1, `year 1 has field '${field}'`);
}

// ── Test 3: revenue projection ───────────────────────────────────────────────

console.log('\n3. Revenue projection');
assertClose(
    result.yearByYear[0].revenue,
    574785 * 1.12,
    1,
    'Year 1 revenue = base × (1 + 12%)',
);
assertClose(
    result.yearByYear[1].revenue,
    574785 * 1.12 * 1.12,
    1,
    'Year 2 revenue = yr1 × (1 + 12%)',
);

// revenue should grow every year
for (let i = 1; i < 10; i++) {
    assert(
        result.yearByYear[i].revenue > result.yearByYear[i - 1].revenue,
        `Year ${i + 1} revenue > year ${i} revenue`,
    );
}

// ── Test 4: growth tapering in years 6-10 ────────────────────────────────────

console.log('\n4. Revenue growth tapering (years 6-10)');
const yr5Growth = result.yearByYear[4].revenue_growth;
const yr10Growth = result.yearByYear[9].revenue_growth;
assertClose(yr5Growth, 0.12, 0.001, 'Year 5 growth = 12%');
assertClose(yr10Growth, 0.0408, 0.001, 'Year 10 growth = riskfree_rate (4.08%)');

// check linear tapering: yr6 should be one step down
const expectedYr6Growth = 0.12 + (0.0408 - 0.12) * (1 / 5);
assertClose(result.yearByYear[5].revenue_growth, expectedYr6Growth, 0.001, 'Year 6 growth taper check');

// ── Test 5: margin convergence (Damodaran rule) ─────────────────────────────

console.log('\n5. Margin convergence (Damodaran rule)');
assertClose(result.yearByYear[0].margin, 0.1133, 0.0001, 'Year 1 margin = base (frozen)');
assertClose(result.yearByYear[1].margin, 0.1133 + (0.14 - 0.1133) * (2 / 5), 0.0001, 'Year 2 margin = base + diff × 2/5');
assertClose(result.yearByYear[2].margin, 0.1133 + (0.14 - 0.1133) * (3 / 5), 0.0001, 'Year 3 margin = base + diff × 3/5');
assertClose(result.yearByYear[3].margin, 0.1133 + (0.14 - 0.1133) * (4 / 5), 0.0001, 'Year 4 margin = base + diff × 4/5');
assertClose(result.yearByYear[4].margin, 0.14, 0.0001, 'Year 5 margin = target (0.14)');
assertClose(result.yearByYear[9].margin, 0.14, 0.0001, 'Year 10 margin stays at target');

// ── Test 6: tax rate tapering ────────────────────────────────────────────────

console.log('\n6. Tax rate tapering');
assertClose(result.yearByYear[0].tax_rate, 0.19, 0.001, 'Year 1 tax rate = effective (flat)');
assertClose(result.yearByYear[9].tax_rate, 0.25, 0.001, 'Year 10 tax rate = marginal (25%)');

// ── Test 7: WACC tapering ────────────────────────────────────────────────────

console.log('\n7. WACC tapering');
const wacc_terminal = 0.0408 + 0.0411;
assertClose(result.yearByYear[0].wacc, 0.086, 0.0001, 'Year 1 WACC = initial (flat)');
assertClose(result.yearByYear[9].wacc, wacc_terminal, 0.0001, 'Year 10 WACC = riskfree + 4.11%');

// ── Test 8: FCFF = NOPAT - reinvestment ──────────────────────────────────────

console.log('\n8. FCFF identity');
for (let i = 0; i < 10; i++) {
    const y = result.yearByYear[i];
    assertClose(y.fcff, y.nopat - y.reinvestment, 0.01, `Year ${i + 1}: FCFF = NOPAT - reinvestment`);
}

// ── Test 9: discount factors are cumulative ──────────────────────────────────

console.log('\n9. Cumulative discount factors');
let cumDisc = 1;
for (let i = 0; i < 10; i++) {
    cumDisc *= 1 / (1 + result.yearByYear[i].wacc);
    assertClose(result.yearByYear[i].discount_factor, cumDisc, 0.00001, `Year ${i + 1} cumulative discount`);
}

// ── Test 10: PV sums ─────────────────────────────────────────────────────────

console.log('\n10. PV aggregates');
const sumPV = result.yearByYear.reduce((s, y) => s + y.pv_fcff, 0);
assertClose(result.pv_cf_10years, sumPV, 0.01, 'pv_cf_10years = sum of pv_fcff');

// ── Test 11: terminal value sanity ───────────────────────────────────────────

console.log('\n11. Terminal value');
assert(result.terminalYear.terminal_value > 0, 'Terminal value is positive');
assert(result.pv_terminal_value > 0, 'PV terminal value is positive');
assert(
    result.pv_terminal_value < result.terminalYear.terminal_value,
    'PV terminal < undiscounted terminal',
);

// ── Test 12: equity bridge ───────────────────────────────────────────────────

console.log('\n12. Equity bridge');
assertClose(
    result.value_operating_assets,
    result.pv_cf_10years + result.pv_terminal_value,
    0.01,
    'operating assets = PV(FCFF) + PV(terminal)',
);
const expectedEquity =
    result.value_operating_assets - AMAZON.debt - AMAZON.minority_interests +
    AMAZON.cash + AMAZON.non_operating_assets;
assertClose(result.value_equity, expectedEquity, 0.01, 'equity bridge math');
assertClose(
    result.intrinsic_value_per_share,
    result.value_equity / AMAZON.shares_outstanding,
    0.01,
    'per-share = equity / shares',
);

// ── Test 13: Amazon target intrinsic value ≈ $103.79 ─────────────────────────

console.log('\n13. Amazon intrinsic value target');
console.log(`    Computed intrinsic value: $${result.intrinsic_value_per_share.toFixed(2)}`);
console.log(`    Value of equity: $${(result.value_equity).toFixed(0)}`);
console.log(`    Operating assets: $${(result.value_operating_assets).toFixed(0)}`);
console.log(`    PV of 10yr CFs: $${(result.pv_cf_10years).toFixed(0)}`);
console.log(`    PV terminal: $${(result.pv_terminal_value).toFixed(0)}`);
assertClose(result.intrinsic_value_per_share, 103.79, 5, 'Intrinsic value ≈ $103.79 (±$5 tolerance)');

// ── Test 14: upside percentage ───────────────────────────────────────────────

console.log('\n14. Upside percentage');
const expectedUpside = result.intrinsic_value_per_share / 169 - 1;
assertClose(result.upside_pct, expectedUpside, 0.0001, 'upside_pct matches');

// ── Test 15: probability of failure ──────────────────────────────────────────

console.log('\n15. Probability of failure adjustment');
const failResult = runDCF({ ...AMAZON, prob_failure: 0.1, distress_proceeds_pct: 0.5 });
assert(
    failResult.intrinsic_value_per_share < result.intrinsic_value_per_share,
    'Failure probability lowers intrinsic value',
);
// With 10% failure and 50% distress proceeds: adjusted = value * 0.9 + 0.1 * 0.5 * value = 0.95 * value
const adjustedOps = result.value_operating_assets * 0.95;
const adjustedEquity = adjustedOps - AMAZON.debt + AMAZON.cash + AMAZON.non_operating_assets;
assertClose(
    failResult.value_equity,
    adjustedEquity,
    1,
    'Failure-adjusted equity value matches formula',
);

// ── Test 16: sensitivity table ───────────────────────────────────────────────

console.log('\n16. Sensitivity table');
const sens = sensitivityTable(AMAZON);
assert(sens.growthValues.length === 5, 'growthValues has 5 entries');
assert(sens.waccValues.length === 5, 'waccValues has 5 entries');
assert(sens.matrix.length === 5, 'matrix has 5 rows');
assert(sens.matrix[0].length === 5, 'matrix has 5 columns');

// center cell should match base case
assertClose(sens.matrix[2][2], result.intrinsic_value_per_share, 0.01, 'Center cell = base case');

// higher growth → higher value (same WACC row)
assert(sens.matrix[2][4] > sens.matrix[2][0], 'Higher growth → higher value');

// lower WACC → higher value (same growth column)
assert(sens.matrix[0][2] > sens.matrix[4][2], 'Lower WACC → higher value');

// custom ranges
const customSens = sensitivityTable(AMAZON, [0.08, 0.10, 0.12, 0.14, 0.16], [0.07, 0.08, 0.086, 0.09, 0.10]);
assert(customSens.growthValues[0] === 0.08, 'Custom growth range works');
assert(customSens.waccValues[2] === 0.086, 'Custom WACC range works');

// ── Test 17: defaults ────────────────────────────────────────────────────────

console.log('\n17. Defaults');
const minimalInputs = { ...AMAZON };
delete minimalInputs.prob_failure;
delete minimalInputs.minority_interests;
delete minimalInputs.non_operating_assets;
const defaultResult = runDCF(minimalInputs);
assert(typeof defaultResult.intrinsic_value_per_share === 'number', 'Runs with defaults');

// ── summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log('='.repeat(50));

if (failed > 0) {
    process.exit(1);
}
