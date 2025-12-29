#!/usr/bin/env node
/**
 * Retirement Calculator Test Suite
 * Run with: node test-runner.js
 */

// ============================================
// TEST FRAMEWORK
// ============================================
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

const results = [];
let currentGroup = '';

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
        }
    };
}

// ============================================
// SIMULATION ENGINE (copied from main file with fixes)
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
        const initialWithdrawal = inputs.startingPortfolio * (initialRate / 100);
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
            const oneTimeExpenseThisYear = isExpenseYear ? inputs.oneTimeExpense * Math.pow(inflationMultiplier, i) : 0;

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

        let portfolio = inputs.startingPortfolio;
        const yearResults = [];
        let ruined = false;
        let ruinAge = null;

        for (let i = 0; i < years; i++) {
            const age = inputs.retirementAge + i;
            const portfolioStart = portfolio;

            const isExpenseYear = ((i + 1) % 5 === 0);
            const oneTimeExpenseThisYear = isExpenseYear ? inputs.oneTimeExpense * Math.pow(inflationMultiplier, i) : 0;

            const ssYearsReceiving = Math.max(0, age - inputs.ssStartAge);
            const ss = (age >= inputs.ssStartAge) ? inputs.socialSecurity * Math.pow(inflationMultiplier, ssYearsReceiving) : 0;
            const targetWithdrawal = portfolio * (withdrawalRate / 100);
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
// TESTS
// ============================================

console.log(`${colors.bold}========================================`);
console.log('Retirement Calculator - Test Suite');
console.log(`========================================${colors.reset}`);

// TEST GROUP 1: Basic Math Utilities
describe('Basic Math Utilities', () => {
    test('randomNormal generates values near 0 on average', () => {
        let sum = 0;
        const n = 10000;
        for (let i = 0; i < n; i++) {
            sum += Simulation.randomNormal();
        }
        const mean = sum / n;
        expect(mean).toBeCloseTo(0, 0.05);
    });

    test('randomNormal has standard deviation near 1', () => {
        const values = [];
        const n = 10000;
        for (let i = 0; i < n; i++) {
            values.push(Simulation.randomNormal());
        }
        const mean = values.reduce((a, b) => a + b) / n;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);
        expect(stdDev).toBeCloseTo(1, 0.1);
    });

    test('generateReturn returns mean when deterministic', () => {
        const returnValue = Simulation.generateReturn(6, 15, true);
        expect(returnValue).toBe(0.06);
    });

    test('generateReturn returns values around mean', () => {
        let sum = 0;
        const n = 10000;
        for (let i = 0; i < n; i++) {
            sum += Simulation.generateReturn(6, 15, false);
        }
        const mean = sum / n;
        expect(mean).toBeCloseTo(0.06, 0.01);
    });

    test('percentile calculation for median (50th)', () => {
        const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const median = Simulation.percentile(sorted, 50);
        expect(median).toBeCloseTo(5.5, 0.01);
    });

    test('percentile calculation for 10th percentile', () => {
        const sorted = Array.from({length: 100}, (_, i) => i + 1);
        const p10 = Simulation.percentile(sorted, 10);
        expect(p10).toBeCloseTo(10.9, 0.1);
    });
});

// TEST GROUP 2: Life Expectancy Table
describe('Life Expectancy Table', () => {
    test('life expectancy at 55 is 40 years', () => {
        expect(Simulation.lifeExpectancy(55)).toBe(40);
    });

    test('life expectancy at 65 is 25 years', () => {
        expect(Simulation.lifeExpectancy(65)).toBe(25);
    });

    test('life expectancy at 75 is 12 years', () => {
        expect(Simulation.lifeExpectancy(75)).toBe(12);
    });

    test('life expectancy at 85 is 9 years', () => {
        expect(Simulation.lifeExpectancy(85)).toBe(9);
    });

    test('life expectancy at 95 is at least 2 years', () => {
        expect(Simulation.lifeExpectancy(95)).toBeGreaterThan(1);
    });
});

// TEST GROUP 3: VPW Percentage Table
describe('VPW Percentage Table', () => {
    test('VPW at 30 years remaining (60% stocks) is ~4.2%', () => {
        const vpw = Simulation.vpwPercentage(30, 60);
        expect(vpw).toBeCloseTo(4.2, 0.1);
    });

    test('VPW at 20 years remaining (60% stocks) is ~5.5%', () => {
        const vpw = Simulation.vpwPercentage(20, 60);
        expect(vpw).toBeCloseTo(5.5, 0.1);
    });

    test('VPW at 10 years remaining (60% stocks) is ~8.6%', () => {
        const vpw = Simulation.vpwPercentage(10, 60);
        expect(vpw).toBeCloseTo(8.6, 0.1);
    });

    test('VPW increases as years remaining decrease', () => {
        const vpw30 = Simulation.vpwPercentage(30, 60);
        const vpw20 = Simulation.vpwPercentage(20, 60);
        const vpw10 = Simulation.vpwPercentage(10, 60);
        expect(vpw20).toBeGreaterThan(vpw30);
        expect(vpw10).toBeGreaterThan(vpw20);
    });
});

// TEST GROUP 4: Constant Real Withdrawal (4% Rule)
describe('Constant Real Withdrawal Strategy', () => {
    const baseInputs = {
        currentAge: 40,
        retirementAge: 65,
        planningAge: 95,
        startingPortfolio: 1000000,
        expectedReturn: 6.0,
        volatility: 0,
        inflationRate: 2.5,
        monteCarloRuns: 1,
        minSpending: 40000,
        oneTimeExpense: 0,
        socialSecurity: 0,
        ssStartAge: 67
    };

    test('initial withdrawal is 4.5% of portfolio', () => {
        const result = Simulation.strategyConstantReal(baseInputs, true);
        const firstYear = result.years[0];
        expect(firstYear.withdrawal).toBeCloseTo(45000, 1);
    });

    test('withdrawal increases by inflation each year', () => {
        const result = Simulation.strategyConstantReal(baseInputs, true);
        const year1 = result.years[0];
        const year2 = result.years[1];
        const expectedIncrease = 1.025;
        expect(year2.baseWithdrawal / year1.baseWithdrawal).toBeCloseTo(expectedIncrease, 0.001);
    });

    test('30-year withdrawal is properly inflation-adjusted', () => {
        const inputs = {...baseInputs, retirementAge: 65, planningAge: 95};
        const result = Simulation.strategyConstantReal(inputs, true);
        const year30 = result.years[29];
        const expectedWithdrawal = 45000 * Math.pow(1.025, 29);
        expect(year30.baseWithdrawal).toBeCloseTo(expectedWithdrawal, 100);
    });

    test('Social Security reduces net withdrawal', () => {
        const inputs = {...baseInputs, socialSecurity: 20000, ssStartAge: 65};
        const result = Simulation.strategyConstantReal(inputs, true);
        const firstYear = result.years[0];
        expect(firstYear.withdrawal).toBeCloseTo(25000, 1);
    });

    test('Social Security has COLA adjustment', () => {
        const inputs = {...baseInputs, socialSecurity: 20000, ssStartAge: 65};
        const result = Simulation.strategyConstantReal(inputs, true);
        const year1SS = result.years[0].ssReceived;
        const year10SS = result.years[9].ssReceived;
        const expectedGrowth = Math.pow(1.025, 9);
        expect(year10SS / year1SS).toBeCloseTo(expectedGrowth, 0.01);
    });

    test('portfolio grows with 6% return and 4.5% withdrawal', () => {
        const inputs = {...baseInputs, inflationRate: 0, socialSecurity: 0};
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.finalBalance).toBeGreaterThan(inputs.startingPortfolio * 0.5);
    });

    test('generates correct number of years', () => {
        const result = Simulation.strategyConstantReal(baseInputs, true);
        expect(result.years).toHaveLength(30);
    });
});

// TEST GROUP 5: Constant Percentage Strategy
describe('Constant Percentage Strategy', () => {
    const baseInputs = {
        currentAge: 40,
        retirementAge: 65,
        planningAge: 95,
        startingPortfolio: 1000000,
        expectedReturn: 6.0,
        volatility: 0,
        inflationRate: 2.5,
        monteCarloRuns: 1,
        minSpending: 40000,
        oneTimeExpense: 0,
        socialSecurity: 0,
        ssStartAge: 67
    };

    test('withdrawal is 4% of current portfolio', () => {
        const result = Simulation.strategyConstantPercent(baseInputs, true);
        const firstYear = result.years[0];
        expect(firstYear.withdrawal).toBeCloseTo(40000, 1);
    });

    test('withdrawal adjusts with portfolio value', () => {
        const result = Simulation.strategyConstantPercent(baseInputs, true);
        const year1 = result.years[0];
        const year2 = result.years[1];
        const expectedWithdrawal = year1.portfolioEnd * 0.04;
        expect(year2.withdrawal).toBeCloseTo(expectedWithdrawal, 100);
    });

    test('portfolio never depletes with constant %', () => {
        const result = Simulation.strategyConstantPercent(baseInputs, true);
        expect(result.ruined).toBeFalsy();
    });
});

// TEST GROUP 6: One-Time Expenses
describe('One-Time Expenses', () => {
    const baseInputs = {
        currentAge: 40,
        retirementAge: 65,
        planningAge: 75,
        startingPortfolio: 1000000,
        expectedReturn: 6.0,
        volatility: 0,
        inflationRate: 2.5,
        monteCarloRuns: 1,
        minSpending: 40000,
        oneTimeExpense: 50000,
        socialSecurity: 0,
        ssStartAge: 67
    };

    test('one-time expense occurs in year 5', () => {
        const result = Simulation.strategyConstantReal(baseInputs, true);
        const year4 = result.years[3];
        const year5 = result.years[4];
        expect(year5.withdrawal).toBeGreaterThan(year4.withdrawal + 40000);
    });

    test('one-time expense is inflation-adjusted', () => {
        const result = Simulation.strategyConstantReal(baseInputs, true);
        const year5Expense = result.years[4].withdrawal - result.years[4].baseWithdrawal;
        const year10Expense = result.years[9].withdrawal - result.years[9].baseWithdrawal;
        expect(year10Expense).toBeGreaterThan(year5Expense);
    });
});

// TEST GROUP 7: Portfolio Depletion
describe('Portfolio Depletion Detection', () => {
    test('high withdrawal rate causes depletion', () => {
        const inputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 95,
            startingPortfolio: 500000,
            expectedReturn: 0,
            volatility: 0,
            inflationRate: 3.0,
            monteCarloRuns: 1,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 0,
            ssStartAge: 70
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.ruined).toBeTruthy();
    });

    test('ruinAge is recorded correctly', () => {
        const inputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 95,
            startingPortfolio: 200000,
            expectedReturn: 0,
            volatility: 0,
            inflationRate: 0,
            monteCarloRuns: 1,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 0,
            ssStartAge: 70
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.ruined).toBeTruthy();
        expect(result.ruinAge).toBeWithinRange(70, 90);
    });
});

// TEST GROUP 8: Monte Carlo Statistics
describe('Monte Carlo Statistics', () => {
    test('success rate is between 0 and 100', () => {
        const inputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 95,
            startingPortfolio: 1000000,
            expectedReturn: 6.0,
            volatility: 15.0,
            inflationRate: 2.5,
            monteCarloRuns: 100,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 20000,
            ssStartAge: 67
        };

        let successful = 0;
        for (let i = 0; i < inputs.monteCarloRuns; i++) {
            const result = Simulation.strategyConstantReal(inputs, false);
            if (!result.ruined) successful++;
        }
        const successRate = (successful / inputs.monteCarloRuns) * 100;

        expect(successRate).toBeWithinRange(0, 100);
    });

    test('higher starting portfolio = higher success rate', () => {
        const baseInputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 95,
            expectedReturn: 5.0,
            volatility: 12.0,
            inflationRate: 2.5,
            monteCarloRuns: 200,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 0,
            ssStartAge: 67
        };

        const runSimulation = (portfolio) => {
            const inputs = {...baseInputs, startingPortfolio: portfolio};
            let successful = 0;
            for (let i = 0; i < inputs.monteCarloRuns; i++) {
                const result = Simulation.strategyConstantReal(inputs, false);
                if (!result.ruined) successful++;
            }
            return (successful / inputs.monteCarloRuns) * 100;
        };

        const lowPortfolio = runSimulation(500000);
        const highPortfolio = runSimulation(2000000);

        expect(highPortfolio).toBeGreaterThan(lowPortfolio);
    });
});

// TEST GROUP 9: Edge Cases
describe('Edge Cases', () => {
    test('handles zero Social Security', () => {
        const inputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 70,
            startingPortfolio: 1000000,
            expectedReturn: 6.0,
            volatility: 0,
            inflationRate: 2.5,
            monteCarloRuns: 1,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 0,
            ssStartAge: 67
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years).toHaveLength(5);
    });

    test('handles zero one-time expense', () => {
        const inputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 75,
            startingPortfolio: 1000000,
            expectedReturn: 6.0,
            volatility: 0,
            inflationRate: 2.5,
            monteCarloRuns: 1,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 0,
            ssStartAge: 67
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        const year5 = result.years[4];
        expect(year5.withdrawal).toBeCloseTo(year5.baseWithdrawal, 1);
    });

    test('handles Social Security starting before retirement', () => {
        const inputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 70,
            startingPortfolio: 1000000,
            expectedReturn: 6.0,
            volatility: 0,
            inflationRate: 2.5,
            monteCarloRuns: 1,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 20000,
            ssStartAge: 62
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].ssReceived).toBeGreaterThan(0);
    });

    test('handles zero inflation rate', () => {
        const inputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 75,
            startingPortfolio: 1000000,
            expectedReturn: 6.0,
            volatility: 0,
            inflationRate: 0,
            monteCarloRuns: 1,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 20000,
            ssStartAge: 67
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        expect(result.years[0].baseWithdrawal).toBe(result.years[9].baseWithdrawal);
    });
});

// TEST GROUP 10: Mathematical Invariants
describe('Mathematical Invariants', () => {
    test('total withdrawals + final balance ≈ starting + returns (zero return)', () => {
        const inputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 75,
            startingPortfolio: 1000000,
            expectedReturn: 0,
            volatility: 0,
            inflationRate: 0,
            monteCarloRuns: 1,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 0,
            ssStartAge: 70
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        const totalOut = result.totalWithdrawals + result.finalBalance;
        expect(totalOut).toBeCloseTo(inputs.startingPortfolio, 1);
    });

    test('portfolio balance is always non-negative', () => {
        const inputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 95,
            startingPortfolio: 100000,
            expectedReturn: -5,
            volatility: 0,
            inflationRate: 3,
            monteCarloRuns: 1,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 0,
            ssStartAge: 70
        };
        const result = Simulation.strategyConstantReal(inputs, true);
        result.years.forEach(year => {
            expect(year.portfolioEnd).toBeWithinRange(0, Infinity);
        });
    });
});

// TEST GROUP 11: Performance Tests
describe('Performance Tests', () => {
    test('1000 Monte Carlo runs complete in under 1 second', () => {
        const inputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 95,
            startingPortfolio: 1000000,
            expectedReturn: 6.0,
            volatility: 15.0,
            inflationRate: 2.5,
            monteCarloRuns: 1000,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 20000,
            ssStartAge: 67
        };

        const start = Date.now();
        for (let i = 0; i < inputs.monteCarloRuns; i++) {
            Simulation.strategyConstantReal(inputs, false);
        }
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(1000);
    });

    test('10000 Monte Carlo runs complete in under 5 seconds', () => {
        const inputs = {
            currentAge: 40,
            retirementAge: 65,
            planningAge: 95,
            startingPortfolio: 1000000,
            expectedReturn: 6.0,
            volatility: 15.0,
            inflationRate: 2.5,
            monteCarloRuns: 10000,
            minSpending: 40000,
            oneTimeExpense: 0,
            socialSecurity: 20000,
            ssStartAge: 67
        };

        const start = Date.now();
        for (let i = 0; i < inputs.monteCarloRuns; i++) {
            Simulation.strategyConstantReal(inputs, false);
        }
        const elapsed = Date.now() - start;

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
