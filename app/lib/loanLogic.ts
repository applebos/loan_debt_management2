'use server';

import { z } from 'zod';

// Zod schema for input validation
const LoanSchema = z.object({
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

export interface AllScenariosResult {
  results?: {
    equalInstallments: CalculationResult;
    equalPrincipal: CalculationResult;
    bullet: CalculationResult;
  };
  errors?: any;
}

// --- Helper: 월 상환금 계산 (원리금 균등)
const getEqualInstallmentPayment = (p: number, r: number, n: number): number => {
    if (p <= 0 || n <= 0) return 0;
    const monthlyRate = r / 100 / 12;
    if (monthlyRate === 0) return p / n;
    return p * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
};


// --- 1. 원리금 균등분할상환 ---
const calculateEqualInstallments = (data: z.infer<typeof LoanSchema>): CalculationResult => {
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

        const interestForThisMonth = remainingPrincipal * (currentAnnualRate / 100 / 12);
        let principalPayment = 0;
        if (month > graceMonths) {
            principalPayment = monthlyPayment - interestForThisMonth;
        }

        if (principalPayment < 0) principalPayment = 0;
        if (principalPayment > remainingPrincipal) {
             principalPayment = remainingPrincipal;
        }

        let principalRepaidEarly = 0;
        let rateChanged = false;
        const event = sortedRepayments.find(r => r.round === month);

        // 이벤트 적용: 당월 상환 후, 중도상환/금리변경 적용 후, 재계산
        if (event) {
            if (event.amount) {
                principalRepaidEarly = Math.min(event.amount, remainingPrincipal - principalPayment);
            }
            if (typeof event.newRate === 'number') {
                rateChanged = true;
            }
        }

        // 마지막 회차 보정
        if (month === data.loanTermMonths && (principalPayment + principalRepaidEarly < remainingPrincipal)) {
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

        if (event && (principalRepaidEarly > 0 || rateChanged)) {
             if (rateChanged) {
                currentAnnualRate = event.newRate!;
             }
            // --- 재설계 ---
            const monthsLeft = data.loanTermMonths - month;
            const graceLeft = Math.max(0, graceMonths - month);
            paymentMonths = monthsLeft - graceLeft;
            monthlyPayment = getEqualInstallmentPayment(remainingPrincipal, currentAnnualRate, paymentMonths);
        }
    }

    return { totalInterest, totalPaid: data.principal + totalInterest, schedule };
};

// --- 2. 원금 균등분할상환 ---
const calculateEqualPrincipal = (data: z.infer<typeof LoanSchema>): CalculationResult => {
    let remainingPrincipal = data.principal;
    let currentAnnualRate = data.annualRate;
    let totalInterest = 0;
    const schedule: ScheduleEntry[] = [];
    const sortedRepayments = [...(data.repayments || [])].sort((a, b) => a.round - b.round);
    const graceMonths = data.gracePeriodMonths ?? 0;
    
    let paymentMonths = data.loanTermMonths - graceMonths;
    let principalPaymentPerMonth = paymentMonths > 0 ? remainingPrincipal / paymentMonths : 0;

    for (let month = 1; month <= data.loanTermMonths; month++) {
         if (remainingPrincipal <= 0) {
            schedule.push({ month, principalPayment: 0, interestPayment: 0, totalPayment: 0, remainingPrincipal: 0 });
            continue;
        }

        const interestForThisMonth = remainingPrincipal * (currentAnnualRate / 100 / 12);
        let principalPayment = 0;
        if (month > graceMonths) {
            principalPayment = principalPaymentPerMonth;
        }
        
        if (principalPayment > remainingPrincipal) {
            principalPayment = remainingPrincipal;
        }

        let principalRepaidEarly = 0;
        let rateChanged = false;
        const event = sortedRepayments.find(r => r.round === month);

        if (event) {
            if (event.amount) {
                principalRepaidEarly = Math.min(event.amount, remainingPrincipal - principalPayment);
            }
            if (typeof event.newRate === 'number') {
                rateChanged = true;
            }
        }

        // 마지막 회차 보정
        if (month === data.loanTermMonths && (principalPayment + principalRepaidEarly < remainingPrincipal)) {
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
        
        if (event && (principalRepaidEarly > 0 || rateChanged)) {
            if (rateChanged) {
                currentAnnualRate = event.newRate!;
            }
            // --- 재설계 ---
            const monthsLeft = data.loanTermMonths - month;
            const graceLeft = Math.max(0, graceMonths - month);
            paymentMonths = monthsLeft - graceLeft;
            principalPaymentPerMonth = paymentMonths > 0 ? remainingPrincipal / paymentMonths : 0;
        }
    }

    return { totalInterest, totalPaid: data.principal + totalInterest, schedule };
};


// --- 3. 만기일시상환 (Bullet Payment) ---
const calculateBulletPayment = (data: z.infer<typeof LoanSchema>): CalculationResult => {
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

        const interestForThisMonth = remainingPrincipal * (currentAnnualRate / 100 / 12);
        let principalPayment = 0;
        
        let principalRepaidEarly = 0;
        const event = sortedRepayments.find(r => r.round === month);

        if (event) {
            if (event.amount) {
                principalRepaidEarly = Math.min(event.amount, remainingPrincipal);
            }
            if (typeof event.newRate === 'number') {
                currentAnnualrate = event.newRate;
            }
        }

        // 만기 상환
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
        
        // 금리 변경은 즉시 반영되지만, 재설계는 없음
        if (event && event.newRate) {
            currentAnnualRate = event.newRate;
        }
    }

    return { totalInterest, totalPaid: data.principal + totalInterest, schedule };
};



// --- Main Server Action ---
export async function calculateAllLoanScenarios(prevState: any, formData: FormData): Promise<AllScenariosResult> {
  try {
    const principal = parseFloat(formData.get('principal') as string) * 10000;
    const loanTermMonths = parseInt(formData.get('loanTermMonths') as string, 10);
    const annualRate = parseFloat(formData.get('annualRate') as string);
    const gracePeriodMonths = formData.get('gracePeriodMonths') ? parseInt(formData.get('gracePeriodMonths') as string, 10) : 0;

    const repayments: z.infer<typeof LoanSchema>['repayments'] = [];
    for (const [key, value] of formData.entries()) {
        if (key.startsWith('repaymentRound_')) {
            const index = key.split('_')[1];
            if (!index) continue;
            const round = parseInt(value as string, 10);
            const amountValue = formData.get(`repaymentAmount_${index}`);
            const newRateValue = formData.get(`newRate_${index}`);

            if (round) {
                 const repayment: {round: number, amount?: number, newRate?: number} = { round };
                if (amountValue && parseFloat(amountValue as string) > 0) {
                    repayment.amount = parseFloat(amountValue as string) * 10000;
                }
                if (newRateValue && parseFloat(newRateValue as string) >= 0) {
                    repayment.newRate = parseFloat(newRateValue as string);
                }
                if (repayment.amount || typeof repayment.newRate === 'number') {
                    repayments.push(repayment);
                }
            }
        }
    }

    const validatedFields = LoanSchema.safeParse({ principal, loanTermMonths, annualRate, gracePeriodMonths, repayments });

    if (!validatedFields.success) {
      console.error("Validation Errors:", validatedFields.error.flatten().fieldErrors);
      return { errors: validatedFields.error.flatten().fieldErrors };
    }

    const data = validatedFields.data;

    const results: AllScenariosResult['results'] = {
      equalInstallments: calculateEqualInstallments(data),
      equalPrincipal: calculateEqualPrincipal(data),
      bullet: calculateBulletPayment(data),
    };

    return { results };

  } catch (error) {
    console.error("Calculation Error:", error);
    if (error instanceof Error) {
        return { errors: { _form: [`서버 오류: ${error.message}`] } };
    }
    return { errors: { _form: ['서버에서 알 수 없는 계산 오류가 발생했습니다.'] } };
  }
}
