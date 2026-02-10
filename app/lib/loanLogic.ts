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
    // 체증식은 나중에 추가될 수 있습니다.
  };
  errors?: any;
}

// --- Calculation Logic for Each Repayment Type ---

// 1. 원리금균등 (Equal Installments)
const calculateEqualInstallments = (data: z.infer<typeof LoanSchema>): CalculationResult => {
  let remainingPrincipal = data.principal;
  let currentAnnualRate = data.annualRate;
  let totalInterest = 0;
  const schedule: ScheduleEntry[] = [];
  const repayments = [...(data.repayments || [])].sort((a, b) => a.round - b.round);

  const getMonthlyPayment = (p: number, r: number, n: number) => {
    if (n <= 0) return 0;
    const monthlyRate = r / 100 / 12;
    return p * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  };

  for (let month = 1; month <= data.loanTermMonths; month++) {
    const monthlyRate = currentAnnualRate / 100 / 12;

    // Check for repayment/rate change events for the current month
    const event = repayments.find(r => r.round === month);
    if (event) {
      if (event.amount) remainingPrincipal -= event.amount;
      if (event.newRate) currentAnnualRate = event.newRate;
    }

    const interestPayment = remainingPrincipal * monthlyRate;
    let principalPayment = 0;
    let totalPayment = interestPayment;

    if (month > (data.gracePeriodMonths ?? 0)) {
        const remainingMonths = data.loanTermMonths - (data.gracePeriodMonths ?? 0);
        const monthsAfterGraceAndEvent = data.loanTermMonths - month + 1;
        
        const regularMonthlyPayment = getMonthlyPayment(remainingPrincipal, currentAnnualRate, monthsAfterGraceAndEvent);

        totalPayment = regularMonthlyPayment;
        principalPayment = totalPayment - interestPayment;
    }

    remainingPrincipal -= principalPayment;
    totalInterest += interestPayment;
    schedule.push({ month, principalPayment, interestPayment, totalPayment, remainingPrincipal: Math.max(0, remainingPrincipal) });
  }

  const totalPaid = data.principal + totalInterest;
  return { totalInterest, totalPaid, schedule };
};

// 2. 원금균등 (Equal Principal)
const calculateEqualPrincipal = (data: z.infer<typeof LoanSchema>): CalculationResult => {
    let remainingPrincipal = data.principal;
    let currentAnnualRate = data.annualRate;
    let totalInterest = 0;
    const schedule: ScheduleEntry[] = [];
    const repayments = [...(data.repayments || [])].sort((a, b) => a.round - b.round);

    let principalPaymentPerMonth = data.gracePeriodMonths 
        ? data.principal / (data.loanTermMonths - data.gracePeriodMonths) 
        : data.principal / data.loanTermMonths;

    for (let month = 1; month <= data.loanTermMonths; month++) {
        const monthlyRate = currentAnnualRate / 100 / 12;

        const event = repayments.find(r => r.round === month);
        if (event) {
            if (event.amount) remainingPrincipal -= event.amount;
            if (event.newRate) currentAnnualRate = event.newRate;
            // Recalculate principal payment if principal changes
            principalPaymentPerMonth = remainingPrincipal / (data.loanTermMonths - month + 1);
        }

        const interestPayment = remainingPrincipal * monthlyRate;
        let principalPayment = 0;

        if (month > (data.gracePeriodMonths ?? 0)) {
            principalPayment = Math.min(principalPaymentPerMonth, remainingPrincipal);
        }

        const totalPayment = principalPayment + interestPayment;
        remainingPrincipal -= principalPayment;
        totalInterest += interestPayment;
        schedule.push({ month, principalPayment, interestPayment, totalPayment, remainingPrincipal: Math.max(0, remainingPrincipal) });
    }

    const totalPaid = data.principal + totalInterest;
    return { totalInterest, totalPaid, schedule };
};

// 3. 만기일시 (Bullet Payment)
const calculateBulletPayment = (data: z.infer<typeof LoanSchema>): CalculationResult => {
    let remainingPrincipal = data.principal;
    let currentAnnualRate = data.annualRate;
    let totalInterest = 0;
    const schedule: ScheduleEntry[] = [];
    const repayments = [...(data.repayments || [])].sort((a, b) => a.round - b.round);

    for (let month = 1; month <= data.loanTermMonths; month++) {
        const monthlyRate = currentAnnualRate / 100 / 12;

        const event = repayments.find(r => r.round === month);
        if (event) {
            if (event.amount) remainingPrincipal -= event.amount;
            if (event.newRate) currentAnnualRate = event.newRate;
        }

        const interestPayment = remainingPrincipal * monthlyRate;
        let principalPayment = 0;

        if (month === data.loanTermMonths) {
            principalPayment = remainingPrincipal;
        }

        const totalPayment = principalPayment + interestPayment;
        totalInterest += interestPayment;
        if (month === data.loanTermMonths) {
             remainingPrincipal -= principalPayment;
        }
       
        schedule.push({ month, principalPayment, interestPayment, totalPayment, remainingPrincipal: Math.max(0, remainingPrincipal) });
    }

    const totalPaid = data.principal + totalInterest;
    return { totalInterest, totalPaid, schedule };
};


// --- Main Server Action ---

export async function calculateAllLoanScenarios(prevState: any, formData: FormData): Promise<AllScenariosResult> {
  try {
    const principal = parseFloat(formData.get('principal') as string) * 10000; // 만원 단위
    const loanTermMonths = parseInt(formData.get('loanTermMonths') as string, 10);
    const annualRate = parseFloat(formData.get('annualRate') as string);
    const gracePeriodMonths = formData.get('gracePeriodMonths') ? parseInt(formData.get('gracePeriodMonths') as string, 10) : 0;
    
    const repayments: any[] = [];
    for (const [key, value] of formData.entries()) {
        if (key.startsWith('repaymentRound_')) {
            const index = key.split('_')[1];
            const round = parseInt(value as string, 10);
            const amountValue = formData.get(`repaymentAmount_${index}`);
            const newRateValue = formData.get(`newRate_${index}`);

            const repayment: any = { round };
            if (amountValue) repayment.amount = parseFloat(amountValue as string) * 10000; // 만원 단위
            if (newRateValue) repayment.newRate = parseFloat(newRateValue as string);
            
            if(round) repayments.push(repayment);
        }
    }

    const validatedFields = LoanSchema.safeParse({ principal, loanTermMonths, annualRate, gracePeriodMonths, repayments });

    if (!validatedFields.success) {
      console.error("Validation Errors:", validatedFields.error.flatten().fieldErrors);
      return { errors: validatedFields.error.flatten().fieldErrors };
    }

    const data = validatedFields.data;

    // Run all calculations
    const results = {
      equalInstallments: calculateEqualInstallments(data),
      equalPrincipal: calculateEqualPrincipal(data),
      bullet: calculateBulletPayment(data),
    };

    return { results };

  } catch (error) {
    console.error("Calculation Error:", error);
    return { errors: { _form: ['서버에서 계산 중 오류가 발생했습니다.'] } };
  }
}
