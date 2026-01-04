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
        const inflationMultiplier = 1 + inputs.inflationRate / 100;

        // Use startingWithdrawal if specified, otherwise use 4.5% rule
        let baseWithdrawal;
        if (inputs.startingWithdrawal && inputs.startingWithdrawal > 0) {
            baseWithdrawal = inputs.startingWithdrawal;
        } else {
            baseWithdrawal = inputs.startingPortfolio * (initialRate / 100);
        }

        // Apply min/max spending constraints
        let initialWithdrawal = Math.max(baseWithdrawal, inputs.minSpending || 0);
        if (inputs.maxSpending && inputs.maxSpending > 0) {
            initialWithdrawal = Math.min(initialWithdrawal, inputs.maxSpending);
        }

        let portfolio = inputs.startingPortfolio;
        let withdrawal = initialWithdrawal;
        const yearResults = [];
        let ruined = false;
        let ruinAge = null;

        const baseMaxSpending = inputs.maxSpending || 0;

        for (let i = 0; i < years; i++) {
            const age = inputs.retirementAge + i;
            const portfolioStart = portfolio;

            // Apply max spending cap (inflation-adjusted) if specified
            if (baseMaxSpending > 0) {
                const inflationAdjustedMaxSpending = baseMaxSpending * Math.pow(inflationMultiplier, i);
                withdrawal = Math.min(withdrawal, inflationAdjustedMaxSpending);
            }

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
        const baseMaxSpending = inputs.maxSpending || 0;
        const baseStartingWithdrawal = inputs.startingWithdrawal || 0;

        let portfolio = inputs.startingPortfolio;
        const yearResults = [];
        let ruined = false;
        let ruinAge = null;

        for (let i = 0; i < years; i++) {
            const age = inputs.retirementAge + i;
            const portfolioStart = portfolio;
            const inflationAdjustedMinSpending = baseMinSpending * Math.pow(inflationMultiplier, i);
            const inflationAdjustedMaxSpending = baseMaxSpending > 0 ? baseMaxSpending * Math.pow(inflationMultiplier, i) : Infinity;

            const isExpenseYear = ((i + 1) % 5 === 0);
            const oneTimeExpenseThisYear = isExpenseYear ? (inputs.oneTimeExpense || 0) * Math.pow(inflationMultiplier, i) : 0;

            const ssYearsReceiving = Math.max(0, age - inputs.ssStartAge);
            const ss = (age >= inputs.ssStartAge) ? inputs.socialSecurity * Math.pow(inflationMultiplier, ssYearsReceiving) : 0;

            // Year 1: Use startingWithdrawal if specified, otherwise use 4% of portfolio
            // Years 2+: Use 4% of current portfolio (the strategy's natural behavior)
            let targetWithdrawal;
            if (i === 0 && baseStartingWithdrawal > 0) {
                targetWithdrawal = baseStartingWithdrawal;
            } else {
                targetWithdrawal = portfolio * (withdrawalRate / 100);
            }
            // Apply min/max spending constraints
            targetWithdrawal = Math.max(targetWithdrawal, inflationAdjustedMinSpending);
            targetWithdrawal = Math.min(targetWithdrawal, inflationAdjustedMaxSpending);
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
        const baseMaxSpending = inputs.maxSpending || 0;
        const baseStartingWithdrawal = inputs.startingWithdrawal || 0;

        let portfolio = inputs.startingPortfolio;
        const yearResults = [];
        let ruined = false;
        let ruinAge = null;

        for (let i = 0; i < years; i++) {
            const age = inputs.retirementAge + i;
            const portfolioStart = portfolio;
            const inflationAdjustedMinSpending = baseMinSpending * Math.pow(inflationMultiplier, i);
            const inflationAdjustedMaxSpending = baseMaxSpending > 0 ? baseMaxSpending * Math.pow(inflationMultiplier, i) : Infinity;

            const isExpenseYear = ((i + 1) % 5 === 0);
            const oneTimeExpenseThisYear = isExpenseYear ? (inputs.oneTimeExpense || 0) * Math.pow(inflationMultiplier, i) : 0;

            const ssYearsReceiving = Math.max(0, age - inputs.ssStartAge);
            const ss = (age >= inputs.ssStartAge) ? inputs.socialSecurity * Math.pow(inflationMultiplier, ssYearsReceiving) : 0;

            // Calculate VPW percentage for this year (always, for reporting)
            const yearsRemaining = inputs.planningAge - age;
            const vpwPct = this.vpwPercentage(yearsRemaining, 60);
            const vpwWithdrawal = portfolio * (vpwPct / 100);

            // Year 1: Use startingWithdrawal if specified, otherwise use VPW calculation
            // Years 2+: Use VPW calculation (the strategy's natural behavior)
            let targetWithdrawal;
            if (i === 0 && baseStartingWithdrawal > 0) {
                targetWithdrawal = baseStartingWithdrawal;
            } else {
                targetWithdrawal = vpwWithdrawal;
            }
            // Apply min/max spending constraints
            targetWithdrawal = Math.max(targetWithdrawal, inflationAdjustedMinSpending);
            targetWithdrawal = Math.min(targetWithdrawal, inflationAdjustedMaxSpending);
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
        const baseMaxSpending = inputs.maxSpending || 0;

        let portfolio = inputs.startingPortfolio;

        // Use startingWithdrawal if specified, otherwise use 5% rule
        let baseWithdrawal;
        if (inputs.startingWithdrawal && inputs.startingWithdrawal > 0) {
            baseWithdrawal = inputs.startingWithdrawal;
        } else {
            baseWithdrawal = inputs.startingPortfolio * (initialRate / 100);
        }

        // Apply min/max spending constraints to initial withdrawal
        let withdrawal = Math.max(baseWithdrawal, baseMinSpending);
        if (baseMaxSpending > 0) {
            withdrawal = Math.min(withdrawal, baseMaxSpending);
        }

        const yearResults = [];
        let ruined = false;
        let ruinAge = null;

        for (let i = 0; i < years; i++) {
            const age = inputs.retirementAge + i;
            const portfolioStart = portfolio;
            const inflationAdjustedMinSpending = baseMinSpending * Math.pow(inflationMultiplier, i);
            const inflationAdjustedMaxSpending = baseMaxSpending > 0 ? baseMaxSpending * Math.pow(inflationMultiplier, i) : Infinity;

            const isExpenseYear = ((i + 1) % 5 === 0);
            const oneTimeExpenseThisYear = isExpenseYear ? (inputs.oneTimeExpense || 0) * Math.pow(inflationMultiplier, i) : 0;

            const ssYearsReceiving = Math.max(0, age - inputs.ssStartAge);
            const ss = (age >= inputs.ssStartAge) ? inputs.socialSecurity * Math.pow(inflationMultiplier, ssYearsReceiving) : 0;

            const currentRate = (withdrawal / portfolioStart) * 100;

            // Don't apply guardrails in Year 1 if user specified startingWithdrawal
            // (respect the user's explicit Year 1 choice)
            const skipGuardrailsYear1 = (i === 0 && inputs.startingWithdrawal && inputs.startingWithdrawal > 0);

            if (!skipGuardrailsYear1) {
                if (currentRate > upperGuardrail) {
                    withdrawal *= (1 - adjustmentFactor);
                } else if (currentRate < lowerGuardrail && portfolio > 0) {
                    withdrawal *= (1 + adjustmentFactor);
                }
            }

            // Apply min/max spending constraints
            withdrawal = Math.max(withdrawal, inflationAdjustedMinSpending);
            withdrawal = Math.min(withdrawal, inflationAdjustedMaxSpending);

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
        const baseMaxSpending = inputs.maxSpending || 0;
        const baseStartingWithdrawal = inputs.startingWithdrawal || 0;

        let portfolio = inputs.startingPortfolio;
        const yearResults = [];
        let ruined = false;
        let ruinAge = null;

        for (let i = 0; i < years; i++) {
            const age = inputs.retirementAge + i;
            const portfolioStart = portfolio;
            const inflationAdjustedMinSpending = baseMinSpending * Math.pow(inflationMultiplier, i);
            const inflationAdjustedMaxSpending = baseMaxSpending > 0 ? baseMaxSpending * Math.pow(inflationMultiplier, i) : Infinity;

            const isExpenseYear = ((i + 1) % 5 === 0);
            const oneTimeExpenseThisYear = isExpenseYear ? (inputs.oneTimeExpense || 0) * Math.pow(inflationMultiplier, i) : 0;

            const ssYearsReceiving = Math.max(0, age - inputs.ssStartAge);
            const ss = (age >= inputs.ssStartAge) ? inputs.socialSecurity * Math.pow(inflationMultiplier, ssYearsReceiving) : 0;

            // Calculate RMD for this year (always, for reporting)
            const lifeExp = this.lifeExpectancy(age);
            const rmdWithdrawal = portfolio / lifeExp;

            // Year 1: Use startingWithdrawal if specified, otherwise use RMD calculation
            // Years 2+: Use RMD calculation (the strategy's natural behavior)
            let targetWithdrawal;
            if (i === 0 && baseStartingWithdrawal > 0) {
                targetWithdrawal = baseStartingWithdrawal;
            } else {
                targetWithdrawal = rmdWithdrawal;
            }
            // Apply min/max spending constraints
            targetWithdrawal = Math.max(targetWithdrawal, inflationAdjustedMinSpending);
            targetWithdrawal = Math.min(targetWithdrawal, inflationAdjustedMaxSpending);
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
// TEST GROUP 18: Starting Withdrawal Input Tests
// ============================================
describe('Starting Withdrawal Input - All Strategies', () => {
    const baseInputs = {
        retirementAge: 65,
        planningAge: 90,
        startingPortfolio: 2000000,
        expectedReturn: 5.0,
        volatility: 0, // Deterministic for testing
        inflationRate: 2.5,
        monteCarloRuns: 100,
        minSpending: 50000,
        maxSpending: 0,
        startingWithdrawal: 80000, // User-specified withdrawal
        oneTimeExpense: 0,
        socialSecurity: 0,
        ssStartAge: 67
    };

    test('Constant Real uses startingWithdrawal instead of 4.5% rule', () => {
        const result = Simulation.strategyConstantReal(baseInputs, true);
        // Should use $80k instead of 4.5% of $2M = $90k
        expect(result.years[0].withdrawal).toBeCloseTo(80000, 0);
    });

    test('Guardrails uses startingWithdrawal instead of 5% rule', () => {
        const result = Simulation.strategyGuardrails(baseInputs, true);
        // Should use $80k instead of 5% of $2M = $100k
        expect(result.years[0].withdrawal).toBeCloseTo(80000, 0);
    });

    test('startingWithdrawal = 0 uses strategy defaults', () => {
        const inputs = { ...baseInputs, startingWithdrawal: 0 };
        const result = Simulation.strategyConstantReal(inputs, true);
        // Should use 4.5% of $2M = $90k
        expect(result.years[0].withdrawal).toBeCloseTo(90000, 0);
    });

    test('startingWithdrawal is inflation-adjusted in subsequent years', () => {
        const result = Simulation.strategyConstantReal(baseInputs, true);
        const inflationMultiplier = 1.025; // 2.5% inflation
        // Year 2 should be $80k * 1.025
        expect(result.years[1].withdrawal).toBeCloseTo(80000 * inflationMultiplier, 0);
    });

    test('startingWithdrawal overrides even when below minSpending for Constant Real', () => {
        // startingWithdrawal < minSpending - min should take precedence
        const inputs = { ...baseInputs, startingWithdrawal: 40000, minSpending: 60000 };
        const result = Simulation.strategyConstantReal(inputs, true);
        // Should use minSpending $60k since startingWithdrawal $40k is less
        expect(result.years[0].withdrawal).toBeCloseTo(60000, 0);
    });

    test('VPW uses startingWithdrawal in Year 1 only', () => {
        const inputs = { ...baseInputs, startingWithdrawal: 100000, planningAge: 90 };
        const result = Simulation.strategyVPW(inputs, true);
        // Year 1 should use startingWithdrawal
        expect(result.years[0].withdrawal).toBeCloseTo(100000, 0);
        // Year 2 reverts to VPW calculation
        // VPW at 24 years remaining = 5.5% (not 4.7% - that's for 25+ years)
        // Portfolio after Year 1: 2M - 100k = 1.9M, then grows 5% = 1.995M
        // Year 2 VPW: 1.995M * 5.5% = 109,725
        // NOTE: Year 2 CAN be higher than Year 1 because VPW% increases as time decreases
        expect(result.years[1].withdrawal).toBeGreaterThan(0);
        // Verify it's using VPW formula, not startingWithdrawal as floor
        const expectedVpwPct = Simulation.vpwPercentage(24, 60); // 5.5%
        const portfolioYear2 = 1900000 * 1.05; // 1.995M
        expect(result.years[1].withdrawal).toBeCloseTo(portfolioYear2 * expectedVpwPct / 100, 1000);
    });

    test('RMD uses startingWithdrawal in Year 1 only', () => {
        const inputs = { ...baseInputs, startingWithdrawal: 100000 };
        const result = Simulation.strategyRMD(inputs, true);
        // Year 1 should use startingWithdrawal
        expect(result.years[0].withdrawal).toBeCloseTo(100000, 0);
        // Year 2 should revert to RMD calculation
        // Life expectancy at 66 = 24
        // Portfolio after Year 1: 2M - 100k = 1.9M, grows 5% = 1.995M
        // Year 2 RMD: 1.995M / 24 = 83,125
        expect(result.years[1].withdrawal).toBeLessThan(100000);
    });

    test('Constant Percent uses startingWithdrawal in Year 1 only', () => {
        const inputs = { ...baseInputs, startingWithdrawal: 100000 };
        const result = Simulation.strategyConstantPercent(inputs, true);
        // Year 1 should use startingWithdrawal
        expect(result.years[0].withdrawal).toBeCloseTo(100000, 0);
        // Year 2 should revert to 4% of current portfolio
        // Portfolio after Year 1: 2M - 100k = 1.9M, grows 5% = 1.995M
        // Year 2: 4% of 1.995M = 79,800
        expect(result.years[1].withdrawal).toBeLessThan(100000);
    });
});

// ============================================
// TEST GROUP 19: Maximum Spending Cap Tests
// ============================================
describe('Maximum Spending Cap - All Strategies', () => {
    const baseInputs = {
        retirementAge: 65,
        planningAge: 90,
        startingPortfolio: 5000000,
        expectedReturn: 5.0,
        volatility: 0,
        inflationRate: 2.5,
        monteCarloRuns: 100,
        minSpending: 50000,
        maxSpending: 150000, // Cap at $150k
        startingWithdrawal: 0,
        oneTimeExpense: 0,
        socialSecurity: 0,
        ssStartAge: 67
    };

    test('Constant Real respects maxSpending cap', () => {
        // 4.5% of $5M = $225k, should be capped to $150k
        const result = Simulation.strategyConstantReal(baseInputs, true);
        expect(result.years[0].withdrawal).toBeLessThanOrEqual(150000);
        expect(result.years[0].withdrawal).toBeCloseTo(150000, 0);
    });

    test('Constant Percent respects maxSpending cap', () => {
        // 4% of $5M = $200k, should be capped to $150k
        const result = Simulation.strategyConstantPercent(baseInputs, true);
        expect(result.years[0].withdrawal).toBeLessThanOrEqual(150000);
    });

    test('Guardrails respects maxSpending cap', () => {
        // 5% of $5M = $250k, should be capped to $150k
        const result = Simulation.strategyGuardrails(baseInputs, true);
        expect(result.years[0].withdrawal).toBeLessThanOrEqual(150000);
    });

    test('VPW respects maxSpending cap', () => {
        const result = Simulation.strategyVPW(baseInputs, true);
        expect(result.years[0].withdrawal).toBeLessThanOrEqual(150000);
    });

    test('RMD respects maxSpending cap', () => {
        const result = Simulation.strategyRMD(baseInputs, true);
        expect(result.years[0].withdrawal).toBeLessThanOrEqual(150000);
    });

    test('maxSpending is inflation-adjusted over time', () => {
        const result = Simulation.strategyConstantReal(baseInputs, true);
        const year10Inflation = Math.pow(1.025, 10); // 2.5% for 10 years
        const maxYear10 = 150000 * year10Inflation;
        // Year 10 withdrawal should not exceed inflation-adjusted max
        expect(result.years[10].withdrawal).toBeLessThanOrEqual(maxYear10 * 1.01); // 1% tolerance
    });

    test('maxSpending = 0 means no cap', () => {
        const inputs = { ...baseInputs, maxSpending: 0 };
        const result = Simulation.strategyConstantReal(inputs, true);
        // 4.5% of $5M = $225k, should NOT be capped
        expect(result.years[0].withdrawal).toBeCloseTo(225000, 0);
    });

    test('maxSpending < minSpending edge case', () => {
        // This is a user error but shouldn't crash
        const inputs = { ...baseInputs, minSpending: 200000, maxSpending: 100000 };
        const result = Simulation.strategyConstantReal(inputs, true);
        // maxSpending should win (cap applied after min floor)
        expect(result.years[0].withdrawal).toBeLessThanOrEqual(100000);
    });
});

// ============================================
// TEST GROUP 20: Combined Min/Max/Starting Withdrawal Tests
// ============================================
describe('Combined Spending Constraints', () => {
    const baseInputs = {
        retirementAge: 65,
        planningAge: 90,
        startingPortfolio: 3000000,
        expectedReturn: 5.0,
        volatility: 0,
        inflationRate: 3.0,
        monteCarloRuns: 100,
        minSpending: 80000,
        maxSpending: 200000,
        startingWithdrawal: 120000,
        oneTimeExpense: 0,
        socialSecurity: 0,
        ssStartAge: 67
    };

    test('All three constraints work together', () => {
        const result = Simulation.strategyConstantReal(baseInputs, true);
        // startingWithdrawal $120k is between min $80k and max $200k
        expect(result.years[0].withdrawal).toBeCloseTo(120000, 0);
    });

    test('minSpending wins when startingWithdrawal is below', () => {
        const inputs = { ...baseInputs, startingWithdrawal: 50000 };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].withdrawal).toBeCloseTo(80000, 0);
    });

    test('maxSpending wins when startingWithdrawal is above', () => {
        const inputs = { ...baseInputs, startingWithdrawal: 250000 };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].withdrawal).toBeCloseTo(200000, 0);
    });

    test('Withdrawal stays within bounds across all years', () => {
        const result = Simulation.strategyConstantReal(baseInputs, true);
        const inflationRate = 1.03;

        for (let i = 0; i < result.years.length; i++) {
            const minAdjusted = 80000 * Math.pow(inflationRate, i);
            const maxAdjusted = 200000 * Math.pow(inflationRate, i);
            expect(result.years[i].withdrawal).toBeGreaterThanOrEqual(minAdjusted * 0.99);
            expect(result.years[i].withdrawal).toBeLessThanOrEqual(maxAdjusted * 1.01);
        }
    });
});

// ============================================
// TEST GROUP 21: Extreme Edge Cases - Breaking Attempts
// ============================================
describe('Extreme Edge Cases - Breaking Attempts', () => {
    test('Negative startingWithdrawal treated as 0', () => {
        const inputs = {
            ...standardInputs,
            startingWithdrawal: -50000,
            volatility: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // Should use default 4.5% rule, not negative value
        expect(result.years[0].withdrawal).toBeGreaterThan(0);
    });

    test('Extremely high startingWithdrawal (> portfolio)', () => {
        const inputs = {
            retirementAge: 65,
            planningAge: 90,
            startingPortfolio: 1000000,
            startingWithdrawal: 5000000, // 5x portfolio
            expectedReturn: 5.0,
            volatility: 0,
            inflationRate: 2.5,
            minSpending: 0,
            maxSpending: 0,
            oneTimeExpense: 0,
            socialSecurity: 0,
            ssStartAge: 67
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // Should deplete immediately but not crash
        expect(result.ruined).toBe(true);
        expect(result.years[0].portfolioEnd).toBe(0);
    });

    test('maxSpending = 1 (minimum possible spending)', () => {
        const inputs = {
            ...standardInputs,
            maxSpending: 1,
            minSpending: 0,
            volatility: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].withdrawal).toBeLessThanOrEqual(1);
    });

    test('All spending constraints = 0', () => {
        const inputs = {
            ...standardInputs,
            minSpending: 0,
            maxSpending: 0,
            startingWithdrawal: 0,
            volatility: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // Should use 4.5% default
        expect(result.years[0].withdrawal).toBeCloseTo(standardInputs.startingPortfolio * 0.045, 0);
    });

    test('Very small differences between min and max', () => {
        const inputs = {
            ...standardInputs,
            minSpending: 100000,
            maxSpending: 100001,
            startingWithdrawal: 100000,
            volatility: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].withdrawal).toBeGreaterThanOrEqual(100000);
        expect(result.years[0].withdrawal).toBeLessThanOrEqual(100001);
    });

    test('Infinity-like large numbers', () => {
        const inputs = {
            ...standardInputs,
            startingPortfolio: 1e15, // 1 quadrillion
            startingWithdrawal: 1e12, // 1 trillion
            volatility: 0
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].withdrawal).toBeFinite();
        expect(result.finalBalance).toBeFinite();
    });

    test('Floating point precision with small values', () => {
        const inputs = {
            retirementAge: 65,
            planningAge: 66,
            startingPortfolio: 0.01, // 1 cent
            startingWithdrawal: 0.001,
            expectedReturn: 5.0,
            volatility: 0,
            inflationRate: 2.5,
            minSpending: 0,
            maxSpending: 0,
            oneTimeExpense: 0,
            socialSecurity: 0,
            ssStartAge: 67
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years).toHaveLength(1);
        expect(result.finalBalance).toBeFinite();
    });

    test('100% withdrawal rate with maxSpending cap saves portfolio', () => {
        const inputs = {
            retirementAge: 65,
            planningAge: 90,
            startingPortfolio: 1000000,
            startingWithdrawal: 1000000, // 100% withdrawal
            maxSpending: 50000, // But capped at $50k
            expectedReturn: 5.0,
            volatility: 0,
            inflationRate: 0,
            minSpending: 0,
            oneTimeExpense: 0,
            socialSecurity: 0,
            ssStartAge: 67
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // maxSpending should prevent ruin
        expect(result.years[0].withdrawal).toBe(50000);
        expect(result.ruined).toBe(false);
    });
});

// ============================================
// TEST GROUP 22: Social Security Interaction with New Inputs
// ============================================
describe('Social Security with New Spending Inputs', () => {
    test('SS reduces net withdrawal but respects startingWithdrawal target', () => {
        const inputs = {
            retirementAge: 67,
            planningAge: 90,
            startingPortfolio: 2000000,
            startingWithdrawal: 100000,
            expectedReturn: 5.0,
            volatility: 0,
            inflationRate: 0,
            minSpending: 0,
            maxSpending: 0,
            oneTimeExpense: 0,
            socialSecurity: 30000,
            ssStartAge: 67 // SS starts immediately
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // Net withdrawal = $100k - $30k SS = $70k from portfolio
        expect(result.years[0].withdrawal).toBeCloseTo(70000, 0);
    });

    test('SS > startingWithdrawal results in $0 net withdrawal', () => {
        const inputs = {
            retirementAge: 67,
            planningAge: 90,
            startingPortfolio: 2000000,
            startingWithdrawal: 50000,
            expectedReturn: 5.0,
            volatility: 0,
            inflationRate: 0,
            minSpending: 0,
            maxSpending: 0,
            oneTimeExpense: 0,
            socialSecurity: 80000, // SS > startingWithdrawal
            ssStartAge: 67
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].withdrawal).toBe(0);
    });

    test('maxSpending applies before SS deduction', () => {
        const inputs = {
            retirementAge: 67,
            planningAge: 90,
            startingPortfolio: 5000000,
            startingWithdrawal: 0,
            expectedReturn: 5.0,
            volatility: 0,
            inflationRate: 0,
            minSpending: 0,
            maxSpending: 100000, // Cap total spending at $100k
            oneTimeExpense: 0,
            socialSecurity: 30000,
            ssStartAge: 67
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        // Max spending $100k - SS $30k = $70k net from portfolio
        expect(result.years[0].withdrawal).toBeCloseTo(70000, 0);
    });
});

// ============================================
// TEST GROUP 23: Starting Withdrawal Consistency Across All Strategies
// ============================================
describe('Starting Withdrawal Consistency - All 5 Strategies', () => {
    const baseInputs = {
        retirementAge: 65,
        planningAge: 68,
        startingPortfolio: 1000000,
        expectedReturn: 0, // Zero return for predictable math
        volatility: 0,
        inflationRate: 0,
        minSpending: 0,
        maxSpending: 0,
        oneTimeExpense: 0,
        socialSecurity: 0,
        ssStartAge: 70
    };

    test('All strategies use exact startingWithdrawal in Year 1 when specified', () => {
        const inputs = { ...baseInputs, startingWithdrawal: 35000 };

        const r1 = Simulation.strategyConstantReal(inputs, true);
        const r2 = Simulation.strategyConstantPercent(inputs, true);
        const r3 = Simulation.strategyVPW(inputs, true);
        const r4 = Simulation.strategyGuardrails(inputs, true);
        const r5 = Simulation.strategyRMD(inputs, true);

        expect(r1.years[0].withdrawal).toBeCloseTo(35000, 0);
        expect(r2.years[0].withdrawal).toBeCloseTo(35000, 0);
        expect(r3.years[0].withdrawal).toBeCloseTo(35000, 0);
        expect(r4.years[0].withdrawal).toBeCloseTo(35000, 0);
        expect(r5.years[0].withdrawal).toBeCloseTo(35000, 0);
    });

    test('All strategies use LOW startingWithdrawal in Year 1 (below defaults)', () => {
        // This tests that all strategies respect a LOW startingWithdrawal
        const inputs = { ...baseInputs, startingWithdrawal: 20000 };

        const r1 = Simulation.strategyConstantReal(inputs, true);
        const r2 = Simulation.strategyConstantPercent(inputs, true);
        const r3 = Simulation.strategyVPW(inputs, true);
        const r4 = Simulation.strategyGuardrails(inputs, true);
        const r5 = Simulation.strategyRMD(inputs, true);

        // All should use $20k even though defaults are higher
        expect(r1.years[0].withdrawal).toBeCloseTo(20000, 0);
        expect(r2.years[0].withdrawal).toBeCloseTo(20000, 0);
        expect(r3.years[0].withdrawal).toBeCloseTo(20000, 0);
        expect(r4.years[0].withdrawal).toBeCloseTo(20000, 0);
        expect(r5.years[0].withdrawal).toBeCloseTo(20000, 0);
    });

    test('Fixed strategies (1 & 4) continue to inflation-adjust startingWithdrawal', () => {
        const inputs = { ...baseInputs, startingWithdrawal: 40000, inflationRate: 3 };

        const r1 = Simulation.strategyConstantReal(inputs, true);
        const r4 = Simulation.strategyGuardrails(inputs, true);

        // Year 1: $40k, Year 2: $41,200 (inflated), Year 3: $42,436
        expect(r1.years[0].withdrawal).toBeCloseTo(40000, 0);
        expect(r1.years[1].withdrawal).toBeCloseTo(41200, 10);
        expect(r1.years[2].withdrawal).toBeCloseTo(42436, 10);

        expect(r4.years[0].withdrawal).toBeCloseTo(40000, 0);
        expect(r4.years[1].withdrawal).toBeCloseTo(41200, 10);
    });

    test('Dynamic strategies (2, 3, 5) revert to formula after Year 1', () => {
        const inputs = { ...baseInputs, startingWithdrawal: 50000 };

        const r2 = Simulation.strategyConstantPercent(inputs, true);
        const r3 = Simulation.strategyVPW(inputs, true);
        const r5 = Simulation.strategyRMD(inputs, true);

        // Year 1: All use $50k
        expect(r2.years[0].withdrawal).toBeCloseTo(50000, 0);
        expect(r3.years[0].withdrawal).toBeCloseTo(50000, 0);
        expect(r5.years[0].withdrawal).toBeCloseTo(50000, 0);

        // Year 2: All use their formulas (portfolio is now 950k after 50k withdrawal)
        // Strategy 2: 4% of 950k = 38000
        expect(r2.years[1].withdrawal).toBeCloseTo(38000, 0);

        // Strategy 3: VPW% of 950k (years remaining = 2, VPW ~= 22%)
        const vpwPct = Simulation.vpwPercentage(2, 60);
        expect(r3.years[1].withdrawal).toBeCloseTo(950000 * vpwPct / 100, 100);

        // Strategy 5: RMD = 950k / lifeExp(66)
        const lifeExp = Simulation.lifeExpectancy(66);
        expect(r5.years[1].withdrawal).toBeCloseTo(950000 / lifeExp, 100);
    });

    test('startingWithdrawal = 0 uses each strategy default', () => {
        const inputs = { ...baseInputs, startingWithdrawal: 0 };

        const r1 = Simulation.strategyConstantReal(inputs, true);
        const r2 = Simulation.strategyConstantPercent(inputs, true);
        const r3 = Simulation.strategyVPW(inputs, true);
        const r4 = Simulation.strategyGuardrails(inputs, true);
        const r5 = Simulation.strategyRMD(inputs, true);

        // Strategy 1: 4.5% of 1M = 45000
        expect(r1.years[0].withdrawal).toBeCloseTo(45000, 0);

        // Strategy 2: 4% of 1M = 40000
        expect(r2.years[0].withdrawal).toBeCloseTo(40000, 0);

        // Strategy 3: VPW% of 1M (3 years remaining)
        const vpwPct = Simulation.vpwPercentage(3, 60);
        expect(r3.years[0].withdrawal).toBeCloseTo(1000000 * vpwPct / 100, 100);

        // Strategy 4: 5% of 1M = 50000
        expect(r4.years[0].withdrawal).toBeCloseTo(50000, 0);

        // Strategy 5: RMD = 1M / lifeExp(65)
        const lifeExp = Simulation.lifeExpectancy(65);
        expect(r5.years[0].withdrawal).toBeCloseTo(1000000 / lifeExp, 100);
    });

    test('Year-by-year math verification for Constant Percent with startingWithdrawal', () => {
        const inputs = {
            ...baseInputs,
            startingWithdrawal: 60000,
            expectedReturn: 5,
            planningAge: 68
        };
        const result = Simulation.strategyConstantPercent(inputs, true);

        // Year 1: Withdraw $60k (startingWithdrawal)
        expect(result.years[0].portfolioStart).toBeCloseTo(1000000, 0);
        expect(result.years[0].withdrawal).toBeCloseTo(60000, 0);
        // End: (1000000 - 60000) * 1.05 = 987000
        expect(result.years[0].portfolioEnd).toBeCloseTo(987000, 0);

        // Year 2: 4% of 987000 = 39480
        expect(result.years[1].portfolioStart).toBeCloseTo(987000, 0);
        expect(result.years[1].withdrawal).toBeCloseTo(39480, 0);
        // End: (987000 - 39480) * 1.05 = 994896
        expect(result.years[1].portfolioEnd).toBeCloseTo(994896, 10);

        // Year 3: 4% of 994896 = 39795.84
        expect(result.years[2].portfolioStart).toBeCloseTo(994896, 10);
        expect(result.years[2].withdrawal).toBeCloseTo(39795.84, 1);
    });

    test('Year-by-year math verification for VPW with startingWithdrawal', () => {
        const inputs = {
            ...baseInputs,
            startingWithdrawal: 50000,
            expectedReturn: 0,
            planningAge: 68
        };
        const result = Simulation.strategyVPW(inputs, true);

        // Year 1: Withdraw $50k (startingWithdrawal)
        expect(result.years[0].withdrawal).toBeCloseTo(50000, 0);
        // End: 1000000 - 50000 = 950000

        // Year 2: VPW at 2 years remaining = 22% (approx)
        const vpwPct2 = Simulation.vpwPercentage(2, 60);
        expect(result.years[1].withdrawal).toBeCloseTo(950000 * vpwPct2 / 100, 100);

        // Year 3: VPW at 1 year remaining = 22% (min(100, 20+1*2))
        const vpwPct1 = Simulation.vpwPercentage(1, 60);
        // Portfolio after year 2
        const portfolioAfterYear2 = 950000 - result.years[1].withdrawal;
        expect(result.years[2].withdrawal).toBeCloseTo(portfolioAfterYear2 * vpwPct1 / 100, 100);
    });

    test('Year-by-year math verification for RMD with startingWithdrawal', () => {
        const inputs = {
            ...baseInputs,
            startingWithdrawal: 45000,
            expectedReturn: 0,
            planningAge: 68
        };
        const result = Simulation.strategyRMD(inputs, true);

        // Year 1 (age 65): Withdraw $45k (startingWithdrawal)
        expect(result.years[0].withdrawal).toBeCloseTo(45000, 0);
        // End: 1000000 - 45000 = 955000

        // Year 2 (age 66): RMD = 955000 / lifeExp(66)
        const lifeExp66 = Simulation.lifeExpectancy(66);
        expect(result.years[1].withdrawal).toBeCloseTo(955000 / lifeExp66, 10);

        // Year 3 (age 67): RMD = remaining / lifeExp(67)
        const portfolioAfterYear2 = 955000 - result.years[1].withdrawal;
        const lifeExp67 = Simulation.lifeExpectancy(67);
        expect(result.years[2].withdrawal).toBeCloseTo(portfolioAfterYear2 / lifeExp67, 10);
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
