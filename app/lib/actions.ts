'use server';

import { z } from 'zod';
import {
    LoanSchema, 
    calculateEqualInstallments, 
    calculateEqualPrincipal, 
    calculateBulletPayment 
} from './loanLogic';
import type { AllScenariosResult, CalculationResult } from './loanLogic';

// --- 대환대출 절약액 계산 ---
const calculateRefinanceSavings = (originalData: z.infer<typeof LoanSchema>, originalResult: CalculationResult): any | null => {
    const REFINANCE_MONTH = 12;
    const TIER_1_AVG_RATE = 3.8; 

    if (originalData.annualRate <= TIER_1_AVG_RATE || originalData.loanTermMonths <= REFINANCE_MONTH || originalResult.schedule.length <= REFINANCE_MONTH) {
        return null;
    }

    const newAnnualRate = Math.max(TIER_1_AVG_RATE, originalData.annualRate - 1.0);
    if (newAnnualRate >= originalData.annualRate) return null;

    const interestPaidSoFar = originalResult.schedule.slice(0, REFINANCE_MONTH).reduce((acc, s) => acc + s.interestPayment, 0);
    const principalAtRefinance = originalResult.schedule[REFINANCE_MONTH - 1].remainingPrincipal;

    if(principalAtRefinance <= 0) return null;

    const refinanceLoanData: z.infer<typeof LoanSchema> = {
        principal: principalAtRefinance,
        annualRate: newAnnualRate,
        loanTermMonths: originalData.loanTermMonths - REFINANCE_MONTH,
        repayments: [],
        gracePeriodMonths: 0
    };

    const refinancedPartResult = calculateEqualInstallments(refinanceLoanData);
    const refinancedTotalInterest = interestPaidSoFar + refinancedPartResult.totalInterest;
    const potentialSavings = originalResult.totalInterest - refinancedTotalInterest;

    if (potentialSavings <= 0) return null;

    return {
        potentialSavings: Math.round(potentialSavings),
        originalTotalInterest: Math.round(originalResult.totalInterest),
        refinancedTotalInterest: Math.round(refinancedTotalInterest),
    };
}


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
      inputs: {
          annualRate: data.annualRate
      }
    };

    const refinanceInfo = calculateRefinanceSavings(data, results.equalInstallments);
    if (refinanceInfo) {
        results.refinance = refinanceInfo;
    }

    return { results };

  } catch (error) {
    console.error("Calculation Error:", error);
    if (error instanceof Error) {
        return { errors: { _form: [`서버 오류: ${error.message}`] } };
    }
    return { errors: { _form: ['서버에서 알 수 없는 계산 오류가 발생했습니다.'] } };
  }
}
