import { calculateEqualInstallments, calculateEqualPrincipal } from '../loanLogic';

describe('Loan Calculation Logic', () => {

  const baseLoanData = {
    principal: 300000000,
    annualRate: 5,
    loanTermMonths: 360, // 30년
    gracePeriodMonths: 0,
    repayments: [],
  };

  // 1. 원리금 균등 상환 테스트
  describe('Equal Installments', () => {
    test('should calculate a standard loan correctly', () => {
      const result = calculateEqualInstallments(baseLoanData);
      expect(result.totalInterest).toBeCloseTo(279767291, 0);
      expect(result.schedule[0].totalPayment).toBeCloseTo(1610465, 0);
      expect(result.schedule[359].remainingPrincipal).toBeCloseTo(0, 0);
    });

    test('should handle grace period', () => {
      const dataWithGrace = { ...baseLoanData, gracePeriodMonths: 24 }; // 2년 거치
      const result = calculateEqualInstallments(dataWithGrace);
      // 거치기간 동안은 이자만 납부
      expect(result.schedule[0].totalPayment).toBeCloseTo(1250000, 0);
      expect(result.schedule[0].principalPayment).toBe(0);
       // 거치기간 이후 상환 시작
      expect(result.schedule[24].totalPayment).toBeCloseTo(1660722, 0);
      expect(result.totalInterest).toBeCloseTo(288002487, 0);
    });

    test('should handle early repayment', () => {
      const dataWithRepayment = {
        ...baseLoanData,
        repayments: [{ round: 60, amount: 50000000 }], // 5년 후 5천만원 중도상환
      };
      const result = calculateEqualInstallments(dataWithRepayment);
      expect(result.totalInterest).toBeLessThan(279768393);
      expect(result.totalInterest).toBeCloseTo(242078782, 0);
      // 중도상환 이후 월 상환액 감소
      expect(result.schedule[58].totalPayment).toBeCloseTo(1610465, 0); // 59회차
      expect(result.schedule[60].totalPayment).toBeCloseTo(1318170, 0); // 61회차
    });
  });

  // 2. 원금 균등 상환 테스트
  describe('Equal Principal', () => {
    test('should calculate a standard loan correctly', () => {
      const result = calculateEqualPrincipal(baseLoanData);
      expect(result.totalInterest).toBeCloseTo(225625090, 0);
      expect(result.schedule[0].totalPayment).toBeCloseTo(2083333, 0);
      expect(result.schedule[359].totalPayment).toBeCloseTo(836926, 0);
      expect(result.schedule[359].remainingPrincipal).toBeCloseTo(0, 0);
    });
  });

});
