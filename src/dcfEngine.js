/**
 * dcfEngine.js — Damodaran FCFF Valuation Engine
 *
 * Pure-function DCF valuation implementing Damodaran's Free Cash Flow to Firm
 * model with a 10-year explicit forecast, terminal value, equity bridge, and
 * optional probability-of-failure adjustment.
 *
 * All monetary values are in the same unit the caller provides (millions, crores, etc.).
 */

// ─── defaults ────────────────────────────────────────────────────────────────

const DEFAULTS = {
    margin_convergence_year: 5,
    prob_failure: 0,
    distress_proceeds_pct: 0.5,
    minority_interests: 0,
    non_operating_assets: 0,
};

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Linear interpolation from `start` to `end` over `years`.
 * Returns the value at `currentYear` (1-indexed).
 * If currentYear >= years the value is clamped to `end`.
 */
function lerp(start, end, currentYear, years) {
    if (currentYear >= years) return end;
    return start + (end - start) * (currentYear / years);
}

// ─── main valuation ──────────────────────────────────────────────────────────

/**
 * Run a full 10-year FCFF DCF valuation.
 *
 * @param {Object} inputs  – see README / prompt for the full list of keys
 * @returns {Object}       – detailed valuation output
 */
export function runDCF(inputs) {
    const cfg = { ...DEFAULTS, ...inputs };

    const {
        revenue_base,
        ebit_base,
        cash,
        debt,
        shares_outstanding,
        current_price,
        minority_interests,
        non_operating_assets,
        revenue_growth_yr1,
        revenue_growth_yr2_5,
        operating_margin_base,
        operating_margin_target,
        margin_convergence_year,
        tax_rate_effective,
        tax_rate_marginal,
        sales_to_capital_1_5,
        sales_to_capital_6_10,
        wacc: wacc_initial,
        riskfree_rate,
        prob_failure,
        distress_proceeds_pct,
    } = cfg;

    // terminal WACC = riskfree + mature market ERP (4.11%, Damodaran Jan 2024)
    const wacc_terminal = riskfree_rate + 0.0411;

    // ── pre-compute all revenues (needed for reinvestment look-ahead) ─────

    const revenues = [revenue_base]; // index 0 = base (year 0)
    const growthRates = [0];         // placeholder for year 0
    for (let t = 1; t <= 10; t++) {
        let g;
        if (t === 1) {
            g = revenue_growth_yr1;
        } else if (t <= 5) {
            g = revenue_growth_yr2_5;
        } else {
            // years 6-10: taper linearly from revenue_growth_yr2_5 → riskfree_rate
            g = revenue_growth_yr2_5 + (riskfree_rate - revenue_growth_yr2_5) * ((t - 5) / 5);
        }
        growthRates.push(g);
        revenues.push(revenues[t - 1] * (1 + g));
    }
    // terminal year revenue (year 11)
    const terminalRevenue = revenues[10] * (1 + riskfree_rate);

    // ── year-by-year projection ────────────────────────────────────────────

    const yearByYear = [];
    let cumulativeDiscount = 1;

    for (let t = 1; t <= 10; t++) {
        const revenue = revenues[t];
        const revenueGrowth = growthRates[t];

        // ── operating margin (Damodaran rule) ───────────────────────────────
        // Year 1: frozen at base margin (no convergence)
        // Years 2 through convergence_year: base + (target - base) × (year / convergence_year)
        // After convergence_year: target
        let margin;
        if (t === 1) {
            margin = operating_margin_base;
        } else if (t >= margin_convergence_year) {
            margin = operating_margin_target;
        } else {
            margin = operating_margin_base +
                (operating_margin_target - operating_margin_base) * (t / margin_convergence_year);
        }

        // ── EBIT & taxes ───────────────────────────────────────────────────
        const ebit = revenue * margin;

        // Tax rate: flat at effective for years 1-5, tapers to marginal over 6-10
        let taxRate;
        if (t <= 5) {
            taxRate = tax_rate_effective;
        } else {
            taxRate = tax_rate_effective +
                (tax_rate_marginal - tax_rate_effective) * ((t - 5) / 5);
        }
        const nopat = ebit * (1 - taxRate);

        // ── reinvestment (uses NEXT year's revenue) ────────────────────────
        const salesToCapital = t <= 5 ? sales_to_capital_1_5 : sales_to_capital_6_10;
        const nextRevenue = t < 10 ? revenues[t + 1] : terminalRevenue;
        const reinvestment = (nextRevenue - revenue) / salesToCapital;

        // ── FCFF ───────────────────────────────────────────────────────────
        const fcff = nopat - reinvestment;

        // ── WACC & discount factor ─────────────────────────────────────────
        // Flat at initial WACC for years 1-5, tapers to terminal over 6-10
        let waccT;
        if (t <= 5) {
            waccT = wacc_initial;
        } else {
            waccT = wacc_initial +
                (wacc_terminal - wacc_initial) * ((t - 5) / 5);
        }
        cumulativeDiscount *= 1 / (1 + waccT);

        const pvFcff = fcff * cumulativeDiscount;

        yearByYear.push({
            year: t,
            revenue,
            revenue_growth: revenueGrowth,
            margin,
            ebit,
            tax_rate: taxRate,
            nopat,
            reinvestment,
            fcff,
            wacc: waccT,
            discount_factor: cumulativeDiscount,
            pv_fcff: pvFcff,
        });
    }

    // ── terminal value ───────────────────────────────────────────────────────

    const lastYear = yearByYear[9];
    const terminalGrowth = riskfree_rate;

    // terminalRevenue already computed above
    const terminalMargin = lastYear.margin;
    const terminalEbit = terminalRevenue * terminalMargin;
    const terminalNopat = lastYear.nopat * (1 + terminalGrowth);
    const reinvestmentRate = terminalGrowth / wacc_terminal;
    const terminalFcff = terminalNopat * (1 - reinvestmentRate);
    const terminalValue = terminalFcff / (wacc_terminal - terminalGrowth);
    const pvTerminalValue = terminalValue * lastYear.discount_factor;

    const terminalYear = {
        revenue: terminalRevenue,
        margin: terminalMargin,
        ebit: terminalEbit,
        nopat: terminalNopat,
        reinvestment: terminalNopat - terminalFcff,
        fcff: terminalFcff,
        terminal_value: terminalValue,
    };

    // ── equity bridge ────────────────────────────────────────────────────────

    const pvCf10years = yearByYear.reduce((sum, y) => sum + y.pv_fcff, 0);
    let valueOperatingAssets = pvCf10years + pvTerminalValue;

    // probability-of-failure adjustment
    let adjustedValue = valueOperatingAssets;
    if (prob_failure > 0) {
        adjustedValue =
            valueOperatingAssets * (1 - prob_failure) +
            prob_failure * distress_proceeds_pct * valueOperatingAssets;
    }

    const valueEquity =
        adjustedValue - debt - minority_interests + cash + non_operating_assets;
    const intrinsicValuePerShare = valueEquity / shares_outstanding;
    const upsidePct = intrinsicValuePerShare / current_price - 1;

    return {
        intrinsic_value_per_share: intrinsicValuePerShare,
        upside_pct: upsidePct,
        value_equity: valueEquity,
        value_operating_assets: valueOperatingAssets,
        pv_terminal_value: pvTerminalValue,
        pv_cf_10years: pvCf10years,
        yearByYear,
        terminalYear,
    };
}

// ─── sensitivity table ───────────────────────────────────────────────────────

/**
 * Build a 5×5 sensitivity matrix of intrinsic values.
 *
 * @param {Object}   baseInputs   – same config object as runDCF
 * @param {number[]} [growthRange] – 5 revenue_growth_yr2_5 values to test
 * @param {number[]} [waccRange]   – 5 WACC values to test
 * @returns {{ growthValues: number[], waccValues: number[], matrix: number[][] }}
 */
export function sensitivityTable(baseInputs, growthRange, waccRange) {
    const baseGrowth = baseInputs.revenue_growth_yr2_5;
    const baseWacc = baseInputs.wacc;

    const growths = growthRange || [
        baseGrowth - 0.04,
        baseGrowth - 0.02,
        baseGrowth,
        baseGrowth + 0.02,
        baseGrowth + 0.04,
    ];

    const waccs = waccRange || [
        baseWacc - 0.02,
        baseWacc - 0.01,
        baseWacc,
        baseWacc + 0.01,
        baseWacc + 0.02,
    ];

    const matrix = waccs.map((w) =>
        growths.map((g) => {
            const result = runDCF({
                ...baseInputs,
                revenue_growth_yr2_5: g,
                wacc: w,
            });
            return result.intrinsic_value_per_share;
        }),
    );

    return { growthValues: growths, waccValues: waccs, matrix };
}
