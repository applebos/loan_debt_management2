import { z } from 'zod';

// Zod schema for input validation
export const LoanSchema = z.object({
  principal: z.number().positive("대출 원금은 0보다 커야 합니다."),
  loanTermMonths: z.number().int().positive("대출 기간은 0보다 커야 합니다."),
  annualRate: z.number().positive("연 이자율은 0보다 커야 합니다."),
  gracePeriodMonths: z.number().int().nonnegative().optional(),
  repayments: z.array(z.object({
    round: z.number().int().positive(),
    amount: z.number().positive().optional(),
    newRate: z.number().positive().optional(),
  })).optional(),
});

// Type definitions
export interface ScheduleEntry {
  month: number;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
  remainingPrincipal: number;
}

export interface CalculationResult {
  totalInterest: number;
  totalPaid: number;
  schedule: ScheduleEntry[];
}

// --- Helper: 월 상환금 계산 (원리금 균등)
const getEqualInstallmentPayment = (p: number, r: number, n: number): number => {
    if (p <= 0 || n <= 0) return 0;
    const monthlyRate = r / 100 / 12;
    if (monthlyRate === 0) return Math.round(p / n);
    const payment = p * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    return Math.round(payment);
};


// --- 1. 원리금 균등분할상환 ---
export const calculateEqualInstallments = (data: z.infer<typeof LoanSchema>): CalculationResult => {
    let remainingPrincipal = data.principal;
    let currentAnnualRate = data.annualRate;
    let totalInterest = 0;
    const schedule: ScheduleEntry[] = [];
    const sortedRepayments = [...(data.repayments || [])].sort((a, b) => a.round - b.round);
    const graceMonths = data.gracePeriodMonths ?? 0;

    let paymentMonths = data.loanTermMonths - graceMonths;
    let monthlyPayment = getEqualInstallmentPayment(remainingPrincipal, currentAnnualRate, paymentMonths);

    for (let month = 1; month <= data.loanTermMonths; month++) {
        if (remainingPrincipal <= 0) {
            schedule.push({ month, principalPayment: 0, interestPayment: 0, totalPayment: 0, remainingPrincipal: 0 });
            continue;
        }

        const interestForThisMonth = Math.round(remainingPrincipal * (currentAnnualRate / 100 / 12));
        let principalPayment = 0;
        if (month > graceMonths) {
            principalPayment = monthlyPayment - interestForThisMonth;
        }

        if (principalPayment < 0) principalPayment = 0;

        let principalRepaidEarly = 0;
        let rateChanged = false;
        const event = sortedRepayments.find(r => r.round === month);

        if (event) {
            if (event.amount) {
                principalRepaidEarly = event.amount;
            }
            if (typeof event.newRate === 'number') {
                rateChanged = true;
            }
        }

        let actualPrincipalPaid = principalPayment + principalRepaidEarly;
        if (month === data.loanTermMonths || actualPrincipalPaid > remainingPrincipal) {
            actualPrincipalPaid = remainingPrincipal;
        }

        const totalPayment = actualPrincipalPaid + interestForThisMonth;
        totalInterest += interestForThisMonth;
        
        schedule.push({ 
            month, 
            principalPayment: actualPrincipalPaid, 
            interestPayment: interestForThisMonth, 
            totalPayment, 
            remainingPrincipal: remainingPrincipal - actualPrincipalPaid
        });

        remainingPrincipal -= actualPrincipalPaid;

        if (event && (principalRepaidEarly > 0 || rateChanged)) {
             if (rateChanged) {
                currentAnnualRate = event.newRate!;
             }
            const monthsLeft = data.loanTermMonths - month;
            const graceLeft = Math.max(0, graceMonths - month);
            paymentMonths = monthsLeft - graceLeft;
            monthlyPayment = getEqualInstallmentPayment(remainingPrincipal, currentAnnualRate, paymentMonths);
        }
    }

    return { totalInterest, totalPaid: data.principal + totalInterest, schedule };
};

// --- 2. 원금 균등분할상환 ---
export const calculateEqualPrincipal = (data: z.infer<typeof LoanSchema>): CalculationResult => {
    let remainingPrincipal = data.principal;
    let currentAnnualRate = data.annualRate;
    let totalInterest = 0;
    const schedule: ScheduleEntry[] = [];
    const sortedRepayments = [...(data.repayments || [])].sort((a, b) => a.round - b.round);
    const graceMonths = data.gracePeriodMonths ?? 0;
    
    let paymentMonths = data.loanTermMonths - graceMonths;
    let principalPaymentPerMonth = paymentMonths > 0 ? Math.round(data.principal / paymentMonths) : 0;

    for (let month = 1; month <= data.loanTermMonths; month++) {
         if (remainingPrincipal <= 0) {
            schedule.push({ month, principalPayment: 0, interestPayment: 0, totalPayment: 0, remainingPrincipal: 0 });
            continue;
        }

        const interestForThisMonth = Math.round(remainingPrincipal * (currentAnnualRate / 100 / 12));
        let principalPayment = 0;
        if (month > graceMonths) {
            principalPayment = (month === data.loanTermMonths) ? remainingPrincipal : principalPaymentPerMonth;
        }
        
        if (principalPayment > remainingPrincipal) {
            principalPayment = remainingPrincipal;
        }

        let principalRepaidEarly = 0;
        let rateChanged = false;
        const event = sortedRepayments.find(r => r.round === month);

        if (event) {
            if (event.amount) {
                principalRepaidEarly = event.amount;
            }
            if (typeof event.newRate === 'number') {
                rateChanged = true;
            }
        }
        
        let actualPrincipalPaid = principalPayment + principalRepaidEarly;
        if (actualPrincipalPaid > remainingPrincipal) {
            actualPrincipalPaid = remainingPrincipal;
        }

        const totalPayment = actualPrincipalPaid + interestForThisMonth;
        totalInterest += interestForThisMonth;

        schedule.push({ 
            month, 
            principalPayment: actualPrincipalPaid, 
            interestPayment: interestForThisMonth, 
            totalPayment, 
            remainingPrincipal: remainingPrincipal - actualPrincipalPaid
        });
        
        remainingPrincipal -= actualPrincipalPaid;
        
        if (event && (principalRepaidEarly > 0 || rateChanged)) {
            if (rateChanged) {
                currentAnnualRate = event.newRate!;
            }
            const monthsLeft = data.loanTermMonths - month;
            const graceLeft = Math.max(0, graceMonths - month);
            paymentMonths = monthsLeft - graceLeft;
            if (paymentMonths > 0) {
                principalPaymentPerMonth = Math.round(remainingPrincipal / paymentMonths);
            }
        }
    }

    return { totalInterest, totalPaid: data.principal + totalInterest, schedule };
};


// --- 3. 만기일시상환 (Bullet Payment) ---
export const calculateBulletPayment = (data: z.infer<typeof LoanSchema>): CalculationResult => {
    let remainingPrincipal = data.principal;
    let currentAnnualRate = data.annualRate;
    let totalInterest = 0;
    const schedule: ScheduleEntry[] = [];
    const sortedRepayments = [...(data.repayments || [])].sort((a, b) => a.round - b.round);

    for (let month = 1; month <= data.loanTermMonths; month++) {
        if (remainingPrincipal <= 0) {
            schedule.push({ month, principalPayment: 0, interestPayment: 0, totalPayment: 0, remainingPrincipal: 0 });
            continue;
        }

        const interestForThisMonth = Math.round(remainingPrincipal * (currentAnnualRate / 100 / 12));
        let principalPayment = 0;
        
        let principalRepaidEarly = 0;
        const event = sortedRepayments.find(r => r.round === month);

        if (event) {
            if (event.amount) {
                principalRepaidEarly = Math.min(event.amount, remainingPrincipal);
            }
            if (typeof event.newRate === 'number') {
                currentAnnualRate = event.newRate;
            }
        }

        if (month === data.loanTermMonths) {
            principalPayment = remainingPrincipal - principalRepaidEarly;
        }

        const totalPayment = principalPayment + interestForThisMonth + principalRepaidEarly;
        totalInterest += interestForThisMonth;

        schedule.push({
            month,
            principalPayment: principalPayment + principalRepaidEarly,
            interestPayment: interestForThisMonth,
            totalPayment,
            remainingPrincipal: remainingPrincipal - principalPayment - principalRepaidEarly
        });

        remainingPrincipal -= (principalPayment + principalRepaidEarly);
    }

    return { totalInterest, totalPaid: data.principal + totalInterest, schedule };
};
