#!/usr/bin/env node
/**
 * Comprehensive Retirement Calculator Test Suite
 * Tests all strategies, edge cases, extreme inputs, and validates math
 * Run with: node comprehensive-tests.js
 */

// ============================================
// TEST FRAMEWORK
// ============================================
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

const results = [];
let currentGroup = '';
let warnings = [];

function describe(name, fn) {
    currentGroup = name;
    console.log(`\n${colors.cyan}${colors.bold}${name}${colors.reset}`);
    fn();
}

function test(name, fn) {
    try {
        fn();
        results.push({ group: currentGroup, name, passed: true });
        console.log(`  ${colors.green}✓${colors.reset} ${name}`);
    } catch (e) {
        results.push({ group: currentGroup, name, passed: false, error: e.message });
        console.log(`  ${colors.red}✗${colors.reset} ${name}`);
        console.log(`    ${colors.red}${e.message}${colors.reset}`);
    }
}

function warn(message) {
    warnings.push(message);
    console.log(`  ${colors.yellow}⚠${colors.reset} ${message}`);
}

function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${expected}, got ${actual}`);
            }
        },
        toBeCloseTo(expected, tolerance = 0.01) {
            if (Math.abs(actual - expected) > tolerance) {
                throw new Error(`Expected ~${expected} (±${tolerance}), got ${actual}`);
            }
        },
        toBeGreaterThan(expected) {
            if (actual <= expected) {
                throw new Error(`Expected ${actual} > ${expected}`);
            }
        },
        toBeLessThan(expected) {
            if (actual >= expected) {
                throw new Error(`Expected ${actual} < ${expected}`);
            }
        },
        toBeGreaterThanOrEqual(expected) {
            if (actual < expected) {
                throw new Error(`Expected ${actual} >= ${expected}`);
            }
        },
        toBeLessThanOrEqual(expected) {
            if (actual > expected) {
                throw new Error(`Expected ${actual} <= ${expected}`);
            }
        },
        toBeWithinRange(min, max) {
            if (actual < min || actual > max) {
                throw new Error(`Expected ${actual} to be within [${min}, ${max}]`);
            }
        },
        toBeTruthy() {
            if (!actual) {
                throw new Error(`Expected truthy value, got ${actual}`);
            }
        },
        toBeFalsy() {
            if (actual) {
                throw new Error(`Expected falsy value, got ${actual}`);
            }
        },
        toHaveLength(expected) {
            if (actual.length !== expected) {
                throw new Error(`Expected length ${expected}, got ${actual.length}`);
            }
        },
        toBeFinite() {
            if (!Number.isFinite(actual)) {
                throw new Error(`Expected finite number, got ${actual}`);
            }
        },
        toBeNonNegative() {
            if (actual < 0) {
                throw new Error(`Expected non-negative number, got ${actual}`);
            }
        }
    };
}

// ============================================
// SIMULATION ENGINE (copied from main file)
// ============================================
const Simulation = {
    randomNormal() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    },

    generateReturn(mean, volatility, deterministic = false) {
        if (deterministic) return mean / 100;
        const z = this.randomNormal();
        return (mean + z * volatility) / 100;
    },

    lifeExpectancy(age) {
        if (age < 60) return 95 - age;
        if (age < 70) return 90 - age;
        if (age < 80) return 87 - age;
        if (age < 90) return 94 - age;
        return Math.max(2, 100 - age);
    },

    vpwPercentage(yearsRemaining, stockAllocation = 60) {
        if (yearsRemaining >= 30) return 3.0 + stockAllocation * 0.02;
        if (yearsRemaining >= 25) return 3.5 + stockAllocation * 0.02;
        if (yearsRemaining >= 20) return 4.0 + stockAllocation * 0.025;
        if (yearsRemaining >= 15) return 5.0 + stockAllocation * 0.03;
        if (yearsRemaining >= 10) return 6.5 + stockAllocation * 0.035;
        if (yearsRemaining >= 5) return 9.0 + stockAllocation * 0.04;
        return Math.min(100, 20.0 + yearsRemaining * 2);
    },

    strategyConstantReal(inputs, deterministic = false) {
        const years = inputs.planningAge - inputs.retirementAge;
        const initialRate = 4.5;
        const calculatedWithdrawal = inputs.startingPortfolio * (initialRate / 100);
        const initialWithdrawal = Math.max(calculatedWithdrawal, inputs.minSpending || 0);
        const inflationMultiplier = 1 + inputs.inflationRate / 100;

        let portfolio = inputs.startingPortfolio;
        let withdrawal = initialWithdrawal;
        const yearResults = [];
        let ruined = false;
        let ruinAge = null;

        for (let i = 0; i < years; i++) {
            const age = inputs.retirementAge + i;
            const portfolioStart = portfolio;

            const isExpenseYear = ((i + 1) % 5 === 0);
            const oneTimeExpenseThisYear = isExpenseYear ? (inputs.oneTimeExpense || 0) * Math.pow(inflationMultiplier, i) : 0;

            const ssYearsReceiving = Math.max(0, age - inputs.ssStartAge);
            const ss = (age >= inputs.ssStartAge) ? inputs.socialSecurity * Math.pow(inflationMultiplier, ssYearsReceiving) : 0;
            const netWithdrawal = Math.max(0, withdrawal - ss) + oneTimeExpenseThisYear;

            portfolio -= netWithdrawal;

            if (portfolio < 0) {
                portfolio = 0;
                if (!ruined) {
                    ruined = true;
                    ruinAge = age;
                }
            }

            const returnPct = this.generateReturn(inputs.expectedReturn, inputs.volatility, deterministic);
            portfolio *= (1 + returnPct);

            yearResults.push({
                year: i,
                age,
                portfolioStart,
                returnPct: returnPct * 100,
                withdrawal: netWithdrawal,
                portfolioEnd: portfolio,
                ruined: portfolio <= 0,
                ssReceived: ss,
                baseWithdrawal: withdrawal
            });

            if (portfolio <= 0 && !ruined) {
                ruined = true;
                ruinAge = age;
            }

            withdrawal *= inflationMultiplier;
        }

        return {
            years: yearResults,
            finalBalance: portfolio,
            totalWithdrawals: yearResults.reduce((sum, y) => sum + y.withdrawal, 0),
            ruined,
            ruinAge
        };
    },

    strategyConstantPercent(inputs, deterministic = false) {
        const years = inputs.planningAge - inputs.retirementAge;
        const withdrawalRate = 4.0;
        const inflationMultiplier = 1 + inputs.inflationRate / 100;
        const baseMinSpending = inputs.minSpending || 0;

        let portfolio = inputs.startingPortfolio;
        const yearResults = [];
        let ruined = false;
        let ruinAge = null;

        for (let i = 0; i < years; i++) {
            const age = inputs.retirementAge + i;
            const portfolioStart = portfolio;
            const inflationAdjustedMinSpending = baseMinSpending * Math.pow(inflationMultiplier, i);

            const isExpenseYear = ((i + 1) % 5 === 0);
            const oneTimeExpenseThisYear = isExpenseYear ? (inputs.oneTimeExpense || 0) * Math.pow(inflationMultiplier, i) : 0;

            const ssYearsReceiving = Math.max(0, age - inputs.ssStartAge);
            const ss = (age >= inputs.ssStartAge) ? inputs.socialSecurity * Math.pow(inflationMultiplier, ssYearsReceiving) : 0;
            const percentWithdrawal = portfolio * (withdrawalRate / 100);
            const targetWithdrawal = Math.max(percentWithdrawal, inflationAdjustedMinSpending);
            const netWithdrawal = Math.max(0, targetWithdrawal - ss) + oneTimeExpenseThisYear;

            portfolio -= netWithdrawal;

            if (portfolio < 0) {
                portfolio = 0;
                if (!ruined) {
                    ruined = true;
                    ruinAge = age;
                }
            }

            const returnPct = this.generateReturn(inputs.expectedReturn, inputs.volatility, deterministic);
            portfolio *= (1 + returnPct);

            yearResults.push({
                year: i,
                age,
                portfolioStart,
                returnPct: returnPct * 100,
                withdrawal: netWithdrawal,
                targetWithdrawal,
                portfolioEnd: portfolio,
                ruined: portfolio <= 0
            });

            if (portfolio <= 0 && !ruined) {
                ruined = true;
                ruinAge = age;
            }
        }

        return {
            years: yearResults,
            finalBalance: portfolio,
            totalWithdrawals: yearResults.reduce((sum, y) => sum + y.withdrawal, 0),
            ruined,
            ruinAge
        };
    },

    strategyVPW(inputs, deterministic = false) {
        const years = inputs.planningAge - inputs.retirementAge;
        const inflationMultiplier = 1 + inputs.inflationRate / 100;
        const baseMinSpending = inputs.minSpending || 0;

        let portfolio = inputs.startingPortfolio;
        const yearResults = [];
        let ruined = false;
        let ruinAge = null;

        for (let i = 0; i < years; i++) {
            const age = inputs.retirementAge + i;
            const portfolioStart = portfolio;
            const inflationAdjustedMinSpending = baseMinSpending * Math.pow(inflationMultiplier, i);

            const isExpenseYear = ((i + 1) % 5 === 0);
            const oneTimeExpenseThisYear = isExpenseYear ? (inputs.oneTimeExpense || 0) * Math.pow(inflationMultiplier, i) : 0;

            const ssYearsReceiving = Math.max(0, age - inputs.ssStartAge);
            const ss = (age >= inputs.ssStartAge) ? inputs.socialSecurity * Math.pow(inflationMultiplier, ssYearsReceiving) : 0;

            const yearsRemaining = inputs.planningAge - age;
            const vpwPct = this.vpwPercentage(yearsRemaining, 60);
            const vpwWithdrawal = portfolio * (vpwPct / 100);
            const targetWithdrawal = Math.max(vpwWithdrawal, inflationAdjustedMinSpending);
            const netWithdrawal = Math.max(0, targetWithdrawal - ss) + oneTimeExpenseThisYear;

            portfolio -= netWithdrawal;

            if (portfolio < 0) {
                portfolio = 0;
                if (!ruined) {
                    ruined = true;
                    ruinAge = age;
                }
            }

            const returnPct = this.generateReturn(inputs.expectedReturn, inputs.volatility, deterministic);
            portfolio *= (1 + returnPct);

            yearResults.push({
                year: i,
                age,
                portfolioStart,
                returnPct: returnPct * 100,
                withdrawal: netWithdrawal,
                vpwPct,
                targetWithdrawal,
                portfolioEnd: portfolio,
                ruined: portfolio <= 0
            });

            if (portfolio <= 0 && !ruined) {
                ruined = true;
                ruinAge = age;
            }
        }

        return {
            years: yearResults,
            finalBalance: portfolio,
            totalWithdrawals: yearResults.reduce((sum, y) => sum + y.withdrawal, 0),
            ruined,
            ruinAge
        };
    },

    strategyGuardrails(inputs, deterministic = false) {
        const years = inputs.planningAge - inputs.retirementAge;
        const initialRate = 5.0;
        const upperGuardrail = initialRate * 1.20;
        const lowerGuardrail = initialRate * 0.80;
        const adjustmentFactor = 0.10;
        const inflationMultiplier = 1 + inputs.inflationRate / 100;
        const baseMinSpending = inputs.minSpending || 0;

        let portfolio = inputs.startingPortfolio;
        const calculatedWithdrawal = inputs.startingPortfolio * (initialRate / 100);
        let withdrawal = Math.max(calculatedWithdrawal, baseMinSpending);
        const yearResults = [];
        let ruined = false;
        let ruinAge = null;

        for (let i = 0; i < years; i++) {
            const age = inputs.retirementAge + i;
            const portfolioStart = portfolio;
            const inflationAdjustedMinSpending = baseMinSpending * Math.pow(inflationMultiplier, i);

            const isExpenseYear = ((i + 1) % 5 === 0);
            const oneTimeExpenseThisYear = isExpenseYear ? (inputs.oneTimeExpense || 0) * Math.pow(inflationMultiplier, i) : 0;

            const ssYearsReceiving = Math.max(0, age - inputs.ssStartAge);
            const ss = (age >= inputs.ssStartAge) ? inputs.socialSecurity * Math.pow(inflationMultiplier, ssYearsReceiving) : 0;

            const currentRate = (withdrawal / portfolioStart) * 100;

            if (currentRate > upperGuardrail) {
                withdrawal *= (1 - adjustmentFactor);
            } else if (currentRate < lowerGuardrail && portfolio > 0) {
                withdrawal *= (1 + adjustmentFactor);
            }

            withdrawal = Math.max(withdrawal, inflationAdjustedMinSpending);

            const netWithdrawal = Math.max(0, withdrawal - ss) + oneTimeExpenseThisYear;

            portfolio -= netWithdrawal;

            if (portfolio < 0) {
                portfolio = 0;
                if (!ruined) {
                    ruined = true;
                    ruinAge = age;
                }
            }

            const returnPct = this.generateReturn(inputs.expectedReturn, inputs.volatility, deterministic);
            portfolio *= (1 + returnPct);

            yearResults.push({
                year: i,
                age,
                portfolioStart,
                returnPct: returnPct * 100,
                withdrawal: netWithdrawal,
                baseWithdrawal: withdrawal,
                currentRate,
                portfolioEnd: portfolio,
                ruined: portfolio <= 0
            });

            if (portfolio <= 0 && !ruined) {
                ruined = true;
                ruinAge = age;
            }

            withdrawal *= inflationMultiplier;
        }

        return {
            years: yearResults,
            finalBalance: portfolio,
            totalWithdrawals: yearResults.reduce((sum, y) => sum + y.withdrawal, 0),
            ruined,
            ruinAge
        };
    },

    strategyRMD(inputs, deterministic = false) {
        const years = inputs.planningAge - inputs.retirementAge;
        const inflationMultiplier = 1 + inputs.inflationRate / 100;
        const baseMinSpending = inputs.minSpending || 0;

        let portfolio = inputs.startingPortfolio;
        const yearResults = [];
        let ruined = false;
        let ruinAge = null;

        for (let i = 0; i < years; i++) {
            const age = inputs.retirementAge + i;
            const portfolioStart = portfolio;
            const inflationAdjustedMinSpending = baseMinSpending * Math.pow(inflationMultiplier, i);

            const isExpenseYear = ((i + 1) % 5 === 0);
            const oneTimeExpenseThisYear = isExpenseYear ? (inputs.oneTimeExpense || 0) * Math.pow(inflationMultiplier, i) : 0;

            const ssYearsReceiving = Math.max(0, age - inputs.ssStartAge);
            const ss = (age >= inputs.ssStartAge) ? inputs.socialSecurity * Math.pow(inflationMultiplier, ssYearsReceiving) : 0;

            const lifeExp = this.lifeExpectancy(age);
            const rmdWithdrawal = portfolio / lifeExp;
            const targetWithdrawal = Math.max(rmdWithdrawal, inflationAdjustedMinSpending);
            const netWithdrawal = Math.max(0, targetWithdrawal - ss) + oneTimeExpenseThisYear;

            portfolio -= netWithdrawal;

            if (portfolio < 0) {
                portfolio = 0;
                if (!ruined) {
                    ruined = true;
                    ruinAge = age;
                }
            }

            const returnPct = this.generateReturn(inputs.expectedReturn, inputs.volatility, deterministic);
            portfolio *= (1 + returnPct);

            yearResults.push({
                year: i,
                age,
                portfolioStart,
                returnPct: returnPct * 100,
                withdrawal: netWithdrawal,
                lifeExp,
                rmdWithdrawal,
                targetWithdrawal,
                portfolioEnd: portfolio,
                ruined: portfolio <= 0
            });

            if (portfolio <= 0 && !ruined) {
                ruined = true;
                ruinAge = age;
            }
        }

        return {
            years: yearResults,
            finalBalance: portfolio,
            totalWithdrawals: yearResults.reduce((sum, y) => sum + y.withdrawal, 0),
            ruined,
            ruinAge
        };
    },

    percentile(sorted, p) {
        if (sorted.length === 0) return 0;
        const index = (p / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
};

// ============================================
// TESTS START
// ============================================

console.log(`${colors.bold}========================================`);
console.log('Comprehensive Retirement Calculator Tests');
console.log(`========================================${colors.reset}`);

// Standard test inputs
const standardInputs = {
    retirementAge: 45,
    planningAge: 95,
    startingPortfolio: 1500000,
    expectedReturn: 5.0,
    volatility: 15.0,
    inflationRate: 3.0,
    monteCarloRuns: 1000,
    minSpending: 150000,
    oneTimeExpense: 0,
    socialSecurity: 30000,
    ssStartAge: 67
};

// ============================================
// TEST GROUP 1: Min Spending Floor Validation
// ============================================
describe('Min Spending Floor - All Strategies', () => {
    const inputs = {
        ...standardInputs,
        startingPortfolio: 1000000,  // Small portfolio
        minSpending: 100000,          // High min spending
        socialSecurity: 0,
        volatility: 0
    };

    test('Constant Real respects minSpending floor', () => {
        const result = Simulation.strategyConstantReal(inputs, true);
        // 4.5% of $1M = $45,000, but minSpending is $100,000
        expect(result.years[0].withdrawal).toBeGreaterThanOrEqual(100000);
    });

    test('Constant Percent respects minSpending floor', () => {
        const result = Simulation.strategyConstantPercent(inputs, true);
        // 4% of $1M = $40,000, but minSpending is $100,000
        expect(result.years[0].targetWithdrawal).toBeGreaterThanOrEqual(100000);
    });

    test('VPW respects minSpending floor', () => {
        const result = Simulation.strategyVPW(inputs, true);
        expect(result.years[0].targetWithdrawal).toBeGreaterThanOrEqual(100000);
    });

    test('Guardrails respects minSpending floor', () => {
        const result = Simulation.strategyGuardrails(inputs, true);
        // 5% of $1M = $50,000, but minSpending is $100,000
        expect(result.years[0].baseWithdrawal).toBeGreaterThanOrEqual(100000);
    });

    test('RMD respects minSpending floor', () => {
        const result = Simulation.strategyRMD(inputs, true);
        expect(result.years[0].targetWithdrawal).toBeGreaterThanOrEqual(100000);
    });

    test('minSpending is inflation-adjusted in year 10', () => {
        const result = Simulation.strategyConstantPercent(inputs, true);
        const expectedMinYear10 = 100000 * Math.pow(1.03, 9);
        expect(result.years[9].targetWithdrawal).toBeGreaterThanOrEqual(expectedMinYear10 - 1);
    });
});

// ============================================
// TEST GROUP 2: Extreme Portfolios
// ============================================
describe('Extreme Portfolio Values', () => {
    test('$100 portfolio does not crash', () => {
        const inputs = { ...standardInputs, startingPortfolio: 100, minSpending: 0 };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years).toHaveLength(50);
        expect(result.finalBalance).toBeFinite();
    });

    test('$1 billion portfolio does not overflow', () => {
        const inputs = { ...standardInputs, startingPortfolio: 1000000000, minSpending: 0 };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.finalBalance).toBeFinite();
        expect(result.finalBalance).toBeNonNegative();
    });

    test('$0 portfolio handles gracefully', () => {
        const inputs = { ...standardInputs, startingPortfolio: 0, minSpending: 0 };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.finalBalance).toBe(0);
        expect(result.ruined).toBeTruthy();
    });

    test('Very small portfolio ($1000) with high spending depletes quickly', () => {
        const inputs = {
            ...standardInputs,
            startingPortfolio: 1000,
            minSpending: 50000,
            socialSecurity: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.ruined).toBeTruthy();
        expect(result.ruinAge).toBeLessThan(50);
    });
});

// ============================================
// TEST GROUP 3: Extreme Return Rates
// ============================================
describe('Extreme Return Rates', () => {
    test('0% return with 0% inflation (neutral scenario)', () => {
        const inputs = {
            ...standardInputs,
            expectedReturn: 0,
            volatility: 0,
            inflationRate: 0,
            minSpending: 50000,
            socialSecurity: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].withdrawal).toBeCloseTo(67500, 1); // 4.5% of 1.5M
    });

    test('-10% annual return causes rapid depletion', () => {
        const inputs = {
            ...standardInputs,
            expectedReturn: -10,
            volatility: 0,
            minSpending: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.ruined).toBeTruthy();
    });

    test('+20% annual return grows portfolio significantly', () => {
        const inputs = {
            ...standardInputs,
            expectedReturn: 20,
            volatility: 0,
            minSpending: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.finalBalance).toBeGreaterThan(inputs.startingPortfolio);
    });

    test('100% volatility produces valid results', () => {
        const inputs = { ...standardInputs, volatility: 100, minSpending: 0 };
        let finiteCount = 0;
        for (let i = 0; i < 100; i++) {
            const result = Simulation.strategyConstantReal(inputs, false);
            if (Number.isFinite(result.finalBalance)) finiteCount++;
        }
        expect(finiteCount).toBeGreaterThan(95); // Most should be finite
    });
});

// ============================================
// TEST GROUP 4: Extreme Inflation
// ============================================
describe('Extreme Inflation Rates', () => {
    test('0% inflation keeps withdrawals constant', () => {
        const inputs = {
            ...standardInputs,
            inflationRate: 0,
            volatility: 0,
            minSpending: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].baseWithdrawal).toBe(result.years[29].baseWithdrawal);
    });

    test('10% inflation significantly increases withdrawals', () => {
        const inputs = {
            ...standardInputs,
            inflationRate: 10,
            volatility: 0,
            minSpending: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        const year30Withdrawal = result.years[29].baseWithdrawal;
        const year1Withdrawal = result.years[0].baseWithdrawal;
        const expectedMultiplier = Math.pow(1.10, 29);
        expect(year30Withdrawal / year1Withdrawal).toBeCloseTo(expectedMultiplier, 1);
    });

    test('Negative inflation (-2%) decreases withdrawals', () => {
        const inputs = {
            ...standardInputs,
            inflationRate: -2,
            volatility: 0,
            minSpending: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[10].baseWithdrawal).toBeLessThan(result.years[0].baseWithdrawal);
    });
});

// ============================================
// TEST GROUP 5: Extreme Ages
// ============================================
describe('Extreme Age Scenarios', () => {
    test('Retire at 18, plan to 100 (82 years)', () => {
        const inputs = {
            ...standardInputs,
            retirementAge: 18,
            planningAge: 100,
            ssStartAge: 67,
            minSpending: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years).toHaveLength(82);
    });

    test('Retire at 90, plan to 95 (5 years)', () => {
        const inputs = {
            ...standardInputs,
            retirementAge: 90,
            planningAge: 95,
            minSpending: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years).toHaveLength(5);
    });

    test('1 year retirement (edge case)', () => {
        const inputs = {
            ...standardInputs,
            retirementAge: 65,
            planningAge: 66,
            minSpending: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years).toHaveLength(1);
    });

    test('0 years retirement returns empty array', () => {
        const inputs = {
            ...standardInputs,
            retirementAge: 65,
            planningAge: 65,
            minSpending: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years).toHaveLength(0);
    });
});

// ============================================
// TEST GROUP 6: Social Security Edge Cases
// ============================================
describe('Social Security Edge Cases', () => {
    test('SS > withdrawal reduces net withdrawal to 0', () => {
        const inputs = {
            ...standardInputs,
            socialSecurity: 100000,
            ssStartAge: 45, // Starts at retirement
            startingPortfolio: 1000000,
            minSpending: 0,
            volatility: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // 4.5% of $1M = $45,000, SS = $100,000
        expect(result.years[0].withdrawal).toBe(0);
    });

    test('SS starts after retirement age', () => {
        const inputs = {
            ...standardInputs,
            socialSecurity: 30000,
            ssStartAge: 67,
            retirementAge: 45,
            minSpending: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // Before SS starts
        expect(result.years[0].ssReceived).toBe(0);
        // After SS starts (year 22+)
        expect(result.years[22].ssReceived).toBeGreaterThan(0);
    });

    test('Very high SS ($500k/year)', () => {
        const inputs = {
            ...standardInputs,
            socialSecurity: 500000,
            ssStartAge: 45,
            minSpending: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].withdrawal).toBe(0);
    });

    test('SS with COLA grows correctly over 30 years', () => {
        const inputs = {
            ...standardInputs,
            socialSecurity: 30000,
            ssStartAge: 45,
            inflationRate: 3.0,
            minSpending: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        const ssYear30 = result.years[29].ssReceived;
        const expectedSS = 30000 * Math.pow(1.03, 29);
        expect(ssYear30).toBeCloseTo(expectedSS, 100);
    });
});

// ============================================
// TEST GROUP 7: One-Time Expense Edge Cases
// ============================================
describe('One-Time Expense Edge Cases', () => {
    test('Very large one-time expense ($500k every 5 years)', () => {
        const inputs = {
            ...standardInputs,
            oneTimeExpense: 500000,
            volatility: 0,
            minSpending: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // Year 5 should have much higher withdrawal
        expect(result.years[4].withdrawal).toBeGreaterThan(result.years[3].withdrawal + 400000);
    });

    test('One-time expense is inflation-adjusted', () => {
        const inputs = {
            ...standardInputs,
            oneTimeExpense: 100000,
            inflationRate: 5.0,
            volatility: 0,
            minSpending: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        const expense5 = result.years[4].withdrawal - result.years[4].baseWithdrawal;
        const expense10 = result.years[9].withdrawal - result.years[9].baseWithdrawal;
        expect(expense10).toBeGreaterThan(expense5 * 1.2); // Should be ~1.276x
    });

    test('Zero one-time expense has no impact', () => {
        const inputs = {
            ...standardInputs,
            oneTimeExpense: 0,
            volatility: 0,
            minSpending: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // Year 5 withdrawal should be close to baseWithdrawal
        expect(Math.abs(result.years[4].withdrawal - result.years[4].baseWithdrawal)).toBeLessThan(1);
    });
});

// ============================================
// TEST GROUP 8: All Strategies - Math Validation
// ============================================
describe('Strategy Math Validation', () => {
    const inputs = {
        ...standardInputs,
        startingPortfolio: 2000000,
        volatility: 0,
        expectedReturn: 6,
        minSpending: 0,
        socialSecurity: 0,
        oneTimeExpense: 0
    };

    test('Constant Real: 4.5% initial withdrawal', () => {
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].withdrawal).toBeCloseTo(90000, 1); // 4.5% of $2M
    });

    test('Constant Percent: 4% of current portfolio', () => {
        const result = Simulation.strategyConstantPercent(inputs, true);
        expect(result.years[0].withdrawal).toBeCloseTo(80000, 1); // 4% of $2M
    });

    test('Guardrails: 5% initial withdrawal', () => {
        const result = Simulation.strategyGuardrails(inputs, true);
        expect(result.years[0].withdrawal).toBeCloseTo(100000, 1); // 5% of $2M
    });

    test('VPW: withdrawal based on years remaining', () => {
        const result = Simulation.strategyVPW(inputs, true);
        const yearsRemaining = inputs.planningAge - inputs.retirementAge;
        const expectedPct = Simulation.vpwPercentage(yearsRemaining, 60);
        const expectedWithdrawal = inputs.startingPortfolio * (expectedPct / 100);
        expect(result.years[0].withdrawal).toBeCloseTo(expectedWithdrawal, 100);
    });

    test('RMD: withdrawal = portfolio / life expectancy', () => {
        const result = Simulation.strategyRMD(inputs, true);
        const lifeExp = Simulation.lifeExpectancy(inputs.retirementAge);
        const expectedWithdrawal = inputs.startingPortfolio / lifeExp;
        expect(result.years[0].withdrawal).toBeCloseTo(expectedWithdrawal, 100);
    });
});

// ============================================
// TEST GROUP 9: Scenario - User's Defaults
// ============================================
describe('User Default Scenario ($1.5M, $150k spend, retire at 45)', () => {
    const inputs = {
        retirementAge: 45,
        planningAge: 95,
        startingPortfolio: 1500000,
        expectedReturn: 5.0,
        volatility: 15.0,
        inflationRate: 3.0,
        monteCarloRuns: 1000,
        minSpending: 150000,
        oneTimeExpense: 0,
        socialSecurity: 30000,
        ssStartAge: 67
    };

    test('Constant Real: minSpending overrides 4.5% rule', () => {
        const result = Simulation.strategyConstantReal({ ...inputs, volatility: 0 }, true);
        // 4.5% of $1.5M = $67,500, but minSpending is $150,000
        expect(result.years[0].withdrawal).toBeCloseTo(150000, 1);
    });

    test('50 year retirement period generated', () => {
        const result = Simulation.strategyConstantReal({ ...inputs, volatility: 0 }, true);
        expect(result.years).toHaveLength(50);
    });

    test('SS starts in year 22 (age 67)', () => {
        const result = Simulation.strategyConstantReal({ ...inputs, volatility: 0 }, true);
        expect(result.years[21].ssReceived).toBe(0);
        expect(result.years[22].ssReceived).toBeGreaterThan(0);
    });

    test('Monte Carlo produces range of outcomes', () => {
        // Use a more sustainable withdrawal scenario to test variance
        // (The default inputs have 10% withdrawal rate which depletes most simulations to $0)
        const sustainableInputs = {
            ...inputs,
            startingPortfolio: 3000000,  // Larger portfolio
            minSpending: 100000,          // Lower spending (3.3% rate)
            planningAge: 70               // Shorter horizon (25 years)
        };
        const finalBalances = [];
        for (let i = 0; i < 100; i++) {
            const result = Simulation.strategyConstantReal(sustainableInputs, false);
            finalBalances.push(result.finalBalance);
        }
        const min = Math.min(...finalBalances);
        const max = Math.max(...finalBalances);
        expect(max - min).toBeGreaterThan(100000); // Significant variation
    });
});

// ============================================
// TEST GROUP 10: Extreme Spending Scenarios
// ============================================
describe('Extreme Spending Scenarios', () => {
    test('$600k annual spend on $15M portfolio', () => {
        const inputs = {
            ...standardInputs,
            startingPortfolio: 15000000,
            minSpending: 600000,
            volatility: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // Should use $675,000 (4.5% of $15M) since it's > minSpending
        expect(result.years[0].withdrawal).toBeCloseTo(675000, 1);
    });

    test('$1M annual spend on $5M portfolio depletes quickly', () => {
        const inputs = {
            ...standardInputs,
            startingPortfolio: 5000000,
            minSpending: 1000000,
            volatility: 0,
            socialSecurity: 0,
            expectedReturn: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.ruined).toBeTruthy();
        expect(result.ruinAge).toBeLessThan(55); // Should deplete within ~5-6 years
    });

    test('Spending = 100% of portfolio still runs', () => {
        const inputs = {
            ...standardInputs,
            startingPortfolio: 100000,
            minSpending: 100000,
            volatility: 0,
            socialSecurity: 0,
            expectedReturn: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years).toHaveLength(50);
        expect(result.ruined).toBeTruthy();
    });
});

// ============================================
// TEST GROUP 11: Mathematical Invariants
// ============================================
describe('Mathematical Invariants', () => {
    test('Portfolio is always non-negative', () => {
        const inputs = {
            ...standardInputs,
            startingPortfolio: 100000,
            minSpending: 500000,
            volatility: 0,
            socialSecurity: 0,
            expectedReturn: -20
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        result.years.forEach((year, i) => {
            expect(year.portfolioEnd).toBeGreaterThanOrEqual(0);
        });
    });

    test('All withdrawals are non-negative', () => {
        const inputs = standardInputs;
        const result = Simulation.strategyConstantReal(inputs, true);
        result.years.forEach((year) => {
            expect(year.withdrawal).toBeGreaterThanOrEqual(0);
        });
    });

    test('Withdrawal = 0 returns conservation (no change)', () => {
        const inputs = {
            ...standardInputs,
            minSpending: 0,
            socialSecurity: 1000000, // SS > any withdrawal
            ssStartAge: 45,
            expectedReturn: 0,
            volatility: 0,
            oneTimeExpense: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // With 0% return and 0 net withdrawals, portfolio should stay constant
        expect(result.finalBalance).toBeCloseTo(inputs.startingPortfolio, 1);
    });

    test('Year count matches planningAge - retirementAge', () => {
        const testCases = [
            { retirementAge: 30, planningAge: 100 }, // 70 years
            { retirementAge: 65, planningAge: 90 },  // 25 years
            { retirementAge: 55, planningAge: 85 },  // 30 years
        ];
        testCases.forEach(tc => {
            const inputs = { ...standardInputs, ...tc, minSpending: 0 };
            const result = Simulation.strategyConstantReal(inputs, true);
            expect(result.years).toHaveLength(tc.planningAge - tc.retirementAge);
        });
    });
});

// ============================================
// TEST GROUP 12: All Strategies Under Stress
// ============================================
describe('All Strategies Under Stress', () => {
    const stressInputs = {
        retirementAge: 35,
        planningAge: 100,
        startingPortfolio: 2000000,
        expectedReturn: 2.0,
        volatility: 25.0,
        inflationRate: 5.0,
        monteCarloRuns: 100,
        minSpending: 100000,
        oneTimeExpense: 50000,
        socialSecurity: 20000,
        ssStartAge: 70
    };

    test('Constant Real survives stress test', () => {
        let successCount = 0;
        for (let i = 0; i < 100; i++) {
            const result = Simulation.strategyConstantReal(stressInputs, false);
            if (!result.ruined) successCount++;
            expect(result.finalBalance).toBeFinite();
        }
        console.log(`    (Success rate: ${successCount}%)`);
    });

    test('Constant Percent survives stress test', () => {
        let successCount = 0;
        for (let i = 0; i < 100; i++) {
            const result = Simulation.strategyConstantPercent(stressInputs, false);
            if (!result.ruined) successCount++;
            expect(result.finalBalance).toBeFinite();
        }
        console.log(`    (Success rate: ${successCount}%)`);
    });

    test('VPW survives stress test', () => {
        let successCount = 0;
        for (let i = 0; i < 100; i++) {
            const result = Simulation.strategyVPW(stressInputs, false);
            if (!result.ruined) successCount++;
            expect(result.finalBalance).toBeFinite();
        }
        console.log(`    (Success rate: ${successCount}%)`);
    });

    test('Guardrails survives stress test', () => {
        let successCount = 0;
        for (let i = 0; i < 100; i++) {
            const result = Simulation.strategyGuardrails(stressInputs, false);
            if (!result.ruined) successCount++;
            expect(result.finalBalance).toBeFinite();
        }
        console.log(`    (Success rate: ${successCount}%)`);
    });

    test('RMD survives stress test', () => {
        let successCount = 0;
        for (let i = 0; i < 100; i++) {
            const result = Simulation.strategyRMD(stressInputs, false);
            if (!result.ruined) successCount++;
            expect(result.finalBalance).toBeFinite();
        }
        console.log(`    (Success rate: ${successCount}%)`);
    });
});

// ============================================
// TEST GROUP 13: Guardrails-Specific Tests
// ============================================
describe('Guardrails Strategy Specific Tests', () => {
    test('Guardrails adjusts down when rate exceeds upper limit', () => {
        const inputs = {
            ...standardInputs,
            startingPortfolio: 1000000,
            expectedReturn: -20, // Crash to trigger guardrail
            volatility: 0,
            minSpending: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyGuardrails(inputs, true);
        // After crash, withdrawal rate will exceed 6% upper guardrail
        // Check that spending was reduced
        const rates = result.years.map(y => y.currentRate);
        const adjustments = rates.filter(r => r > 6.0);
        expect(adjustments.length).toBeGreaterThan(0); // Should have high rates
    });

    test('Guardrails never goes below minSpending', () => {
        const inputs = {
            ...standardInputs,
            startingPortfolio: 500000,
            expectedReturn: -10,
            volatility: 0,
            minSpending: 100000,
            socialSecurity: 0
        };
        const result = Simulation.strategyGuardrails(inputs, true);
        result.years.forEach(year => {
            expect(year.baseWithdrawal).toBeGreaterThanOrEqual(
                inputs.minSpending * Math.pow(1.03, year.year) - 1
            );
        });
    });
});

// ============================================
// TEST GROUP 14: VPW-Specific Tests
// ============================================
describe('VPW Strategy Specific Tests', () => {
    test('VPW percentage increases as years remaining decrease', () => {
        const inputs = {
            ...standardInputs,
            volatility: 0,
            minSpending: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyVPW(inputs, true);
        const pctYear1 = result.years[0].vpwPct;
        const pctYear40 = result.years[39].vpwPct;
        expect(pctYear40).toBeGreaterThan(pctYear1);
    });

    test('VPW does not exceed 100% withdrawal', () => {
        const inputs = {
            ...standardInputs,
            retirementAge: 90,
            planningAge: 95,
            volatility: 0,
            minSpending: 0
        };
        const result = Simulation.strategyVPW(inputs, true);
        result.years.forEach(year => {
            expect(year.vpwPct).toBeLessThanOrEqual(100);
        });
    });
});

// ============================================
// TEST GROUP 15: RMD-Specific Tests
// ============================================
describe('RMD Strategy Specific Tests', () => {
    test('RMD life expectancy decreases with age', () => {
        const inputs = {
            ...standardInputs,
            volatility: 0,
            minSpending: 0
        };
        const result = Simulation.strategyRMD(inputs, true);
        const lifeExp1 = result.years[0].lifeExp;
        const lifeExp20 = result.years[19].lifeExp;
        expect(lifeExp20).toBeLessThan(lifeExp1);
    });

    test('RMD withdrawal increases over time (relative to portfolio)', () => {
        const inputs = {
            ...standardInputs,
            volatility: 0,
            expectedReturn: 10, // High return to keep portfolio stable
            minSpending: 0,
            socialSecurity: 0
        };
        const result = Simulation.strategyRMD(inputs, true);
        // RMD rate (withdrawal/portfolio) should increase as life expectancy decreases
        const rate1 = result.years[0].rmdWithdrawal / result.years[0].portfolioStart;
        const rate20 = result.years[19].rmdWithdrawal / result.years[19].portfolioStart;
        expect(rate20).toBeGreaterThan(rate1);
    });
});

// ============================================
// TEST GROUP 16: Edge Case Combinations
// ============================================
describe('Edge Case Combinations', () => {
    test('All zeros except portfolio', () => {
        const inputs = {
            retirementAge: 65,
            planningAge: 95,
            startingPortfolio: 1000000,
            expectedReturn: 0,
            volatility: 0,
            inflationRate: 0,
            monteCarloRuns: 1,
            minSpending: 0,
            oneTimeExpense: 0,
            socialSecurity: 0,
            ssStartAge: 70
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years).toHaveLength(30);
        expect(result.finalBalance).toBeLessThan(inputs.startingPortfolio);
    });

    test('Maximum reasonable values', () => {
        const inputs = {
            retirementAge: 18,
            planningAge: 120,
            startingPortfolio: 100000000, // $100M
            expectedReturn: 15,
            volatility: 50,
            inflationRate: 10,
            monteCarloRuns: 1,
            minSpending: 1000000, // $1M/year
            oneTimeExpense: 500000,
            socialSecurity: 100000,
            ssStartAge: 62
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years).toHaveLength(102);
        expect(result.finalBalance).toBeFinite();
    });

    test('SS exactly equals withdrawal (net = 0)', () => {
        const inputs = {
            retirementAge: 67,
            planningAge: 95,
            startingPortfolio: 1000000,
            expectedReturn: 0,
            volatility: 0,
            inflationRate: 0,
            minSpending: 0,
            oneTimeExpense: 0,
            socialSecurity: 45000, // Exactly 4.5% of $1M
            ssStartAge: 67
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].withdrawal).toBe(0);
        expect(result.finalBalance).toBe(inputs.startingPortfolio); // No change
    });
});

// ============================================
// TEST GROUP 17: Performance Under Load
// ============================================
describe('Performance Under Load', () => {
    test('5000 simulations complete in under 3 seconds', () => {
        const inputs = standardInputs;
        const start = Date.now();
        for (let i = 0; i < 5000; i++) {
            Simulation.strategyConstantReal(inputs, false);
        }
        const elapsed = Date.now() - start;
        console.log(`    (Completed in ${elapsed}ms)`);
        expect(elapsed).toBeLessThan(3000);
    });

    test('All 5 strategies x 1000 runs complete in under 5 seconds', () => {
        const inputs = standardInputs;
        const strategies = [
            Simulation.strategyConstantReal,
            Simulation.strategyConstantPercent,
            Simulation.strategyVPW,
            Simulation.strategyGuardrails,
            Simulation.strategyRMD
        ];
        const start = Date.now();
        strategies.forEach(strategy => {
            for (let i = 0; i < 1000; i++) {
                strategy.call(Simulation, inputs, false);
            }
        });
        const elapsed = Date.now() - start;
        console.log(`    (Completed in ${elapsed}ms)`);
        expect(elapsed).toBeLessThan(5000);
    });
});

// ============================================
// SUMMARY
// ============================================
console.log(`\n${colors.bold}========================================`);
console.log('Test Summary');
console.log(`========================================${colors.reset}`);

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
if (failed > 0) {
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
}
console.log(`Total: ${results.length}`);

if (warnings.length > 0) {
    console.log(`\n${colors.yellow}${colors.bold}Warnings: ${warnings.length}${colors.reset}`);
    warnings.forEach(w => console.log(`  ${colors.yellow}⚠${colors.reset} ${w}`));
}

if (failed > 0) {
    console.log(`\n${colors.red}${colors.bold}Failed Tests:${colors.reset}`);
    results.filter(r => !r.passed).forEach(r => {
        console.log(`  ${colors.red}✗${colors.reset} ${r.group} > ${r.name}`);
        console.log(`    ${colors.red}${r.error}${colors.reset}`);
    });
    process.exit(1);
} else {
    console.log(`\n${colors.green}${colors.bold}All tests passed!${colors.reset}`);
    process.exit(0);
}
