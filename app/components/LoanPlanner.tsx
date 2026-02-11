'use client';

import { calculateAllLoanScenarios, type AllScenariosResult, type ScheduleEntry } from '../lib/loanLogic';
import React, { useState, useActionState } from 'react';

const initialState: AllScenariosResult = {};

// --- Helper Components ---

const formatCurrency = (amount: number) => {
  if (isNaN(amount)) return '-';
  return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + '원';
};

const ScheduleTable = ({ schedule, title }: { schedule: ScheduleEntry[], title: string }) => (
  <div className="mt-8">
    <h3 className="text-xl font-semibold text-gray-700 mb-4">{title} - 상세 상환 스케줄</h3>
    <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-300">
      <table className="w-full text-sm text-left text-gray-600 border-collapse">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
          <tr>
            <th scope="col" className="px-4 py-3 border border-gray-300">회차</th> 
            <th scope="col" className="px-4 py-3 border border-gray-300">상환원금</th>
            <th scope="col" className="px-4 py-3 border border-gray-300">이자액</th>
            <th scope="col" className="px-4 py-3 border border-gray-300">납부액</th>
            <th scope="col" className="px-4 py-3 border border-gray-300">잔액</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((entry) => (
            <tr key={entry.month} className="bg-white hover:bg-gray-50">
              <td className="px-4 py-2 font-medium border border-gray-300">{entry.month}</td>
              <td className="px-4 py-2 border border-gray-300">{formatCurrency(entry.principalPayment)}</td>
              <td className="px-4 py-2 border border-gray-300">{formatCurrency(entry.interestPayment)}</td>
              <td className="px-4 py-2 border border-gray-300">{formatCurrency(entry.totalPayment)}</td>
              <td className="px-4 py-2 border border-gray-300">{formatCurrency(entry.remainingPrincipal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// --- Main Component ---

export default function LoanPlanner() {
  const [state, formAction] = useActionState(calculateAllLoanScenarios, initialState);
  const [showGracePeriod, setShowGracePeriod] = useState(false);
  const [showPrepayment, setShowPrepayment] = useState(false);
  const [additionalRepayments, setAdditionalRepayments] = useState([{ round: '', amount: '', newRate: '' }]);
  const [visibleSchedule, setVisibleSchedule] = useState<string | null>(null);

  const addRepayment = () => {
    setAdditionalRepayments([...additionalRepayments, { round: '', amount: '', newRate: '' }]);
  };

  const removeRepayment = (index: number) => {
    const newRepayments = [...additionalRepayments];
    newRepayments.splice(index, 1);
    setAdditionalRepayments(newRepayments);
  };

  const handleToggleSchedule = (scenario: string) => {
    setVisibleSchedule(visibleSchedule === scenario ? null : scenario);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 font-sans">
      <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">대출 이자 계산기</h1>
        
        <form action={formAction} className="space-y-4">
            <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-2 pt-2 mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input id="grace-period-checkbox" type="checkbox" checked={showGracePeriod} onChange={() => setShowGracePeriod(!showGracePeriod)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
                    <span className="text-sm text-gray-900">거치기간</span>
                </label>
                <span>&nbsp;&nbsp;&nbsp;</span>
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input id="prepayment-checkbox" type="checkbox" checked={showPrepayment} onChange={() => setShowPrepayment(!showPrepayment)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
                    <span className="text-sm text-gray-900">중도상환/금리변동</span>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                    <label htmlFor="principal" className="w-28 shrink-0 bg-gray-100 text-gray-700 px-4 py-2 text-center text-sm font-medium">대출 금액</label>
                    <span>&nbsp;&nbsp;&nbsp;</span>
                    <input type="number" id="principal" name="principal" required className="flex-1 px-4 py-2 border border-gray-300" placeholder="금액 입력" />
                    <span className="bg-gray-200 text-gray-700 px-4 py-2 rounded-r-md">만원</span>
                </div>
                <div className="flex items-center">
                    <label htmlFor="annualRate" className="w-28 shrink-0 bg-gray-100 text-gray-700 px-4 py-2 text-center text-sm font-medium">연 이자율</label>
                    <span>&nbsp;&nbsp;&nbsp;</span>
                    <input type="number" step="0.01" id="annualRate" name="annualRate" required className="flex-1 px-4 py-2 border border-gray-300" placeholder="% 입력" />
                    <span className="bg-gray-200 text-gray-700 px-4 py-2 rounded-r-md">%</span>
                </div>
                <div className="flex items-center">
                  <label htmlFor="loanTermMonths" className="w-28 shrink-0 bg-gray-100 text-gray-700 px-4 py-2 text-center text-sm font-medium">대출 기간</label>
                  <span>&nbsp;&nbsp;&nbsp;</span>
                  <input type="number" id="loanTermMonths" name="loanTermMonths" required className="w-full px-4 py-2 border border-gray-300" placeholder="총 개월수" />
                  <span className="bg-gray-200 text-gray-700 px-4 py-2 rounded-r-md">개월</span>
                </div>
                {showGracePeriod && (
                  <div className="flex items-center">
                    <label htmlFor="gracePeriodMonths" className="w-28 shrink-0 bg-gray-100 text-gray-700 px-4 py-2 text-center text-sm font-medium">거치 기간</label>
                    <span>&nbsp;&nbsp;&nbsp;</span>
                    <input type="number" id="gracePeriodMonths" name="gracePeriodMonths" className="w-full px-4 py-2 border border-gray-300" placeholder="거치 개월수" />
                    <span className="bg-gray-200 text-gray-700 px-4 py-2 rounded-r-md">개월</span>
                  </div>
                )}
            </div>
            <hr></hr>

            {showPrepayment && additionalRepayments.map((repayment, index) => (
                 <div key={index} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                        <label className="shrink-0 text-gray-700 text-sm">회차</label>
                        <span>&nbsp;&nbsp;&nbsp;</span>
                        <input type="number" name={`repaymentRound_${index}`} placeholder="상환 회차" className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm" />
                        <span className="shrink-0 text-gray-700 text-sm">회</span>
                        <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                        <label className="shrink-0 text-gray-700 text-sm">추가 상환액</label>
                        <span>&nbsp;&nbsp;&nbsp;</span>
                        <input type="number" name={`repaymentAmount_${index}`} placeholder="금액" className="w-28 px-2 py-1 border border-gray-300 rounded-md text-sm" />
                        <span className="shrink-0 text-gray-700 text-sm">만원</span>
                        <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                        <label className="shrink-0 text-gray-700 text-sm">변경 이율</label>
                        <span>&nbsp;&nbsp;&nbsp;</span>
                        <input type="number" step="0.01" name={`newRate_${index}`} placeholder="변경 시만" className="w-28 px-2 py-1 border border-gray-300 rounded-md text-sm" />
                        <span className="shrink-0 text-gray-700 text-sm">%</span>
                        {additionalRepayments.length > 1 && (
                            <button type="button" onClick={() => removeRepayment(index)} className="w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded-full text-base shrink-0 hover:bg-red-600">-</button>
                        )}
                        {index === additionalRepayments.length - 1 && (
                            <button type="button" onClick={addRepayment} className="w-7 h-7 flex items-center justify-center bg-blue-500 text-white rounded-full text-base shrink-0 hover:bg-blue-600">+</button>
                        )}
                    </div>
                </div>
            ))}

            <div className="pt-4">
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md">계산하기</button>
            </div>
        </form>

        {state.results && (
          <div className="mt-10">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">계산 결과 비교</h2>
            <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-center bg-white border-collapse">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider border border-gray-300">구분</th>
                            <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider border border-gray-300">원리금 균등</th>
                            <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider border border-gray-300">원금 균등</th>
                            <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider border border-gray-300">만기일시</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="hover:bg-gray-50">
                            <td className="px-6 py-5 font-semibold text-gray-700 border border-gray-300">총 이자</td>
                            <td className="px-6 py-5 text-red-600 font-bold text-lg border border-gray-300">{formatCurrency(state.results.equalInstallments.totalInterest)}</td>
                            <td className="px-6 py-5 text-red-500 font-bold text-lg border border-gray-300">{formatCurrency(state.results.equalPrincipal.totalInterest)}</td>
                            <td className="px-6 py-5 text-red-500 font-bold text-lg border border-gray-300">{formatCurrency(state.results.bullet.totalInterest)}</td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                            <td className="px-6 py-5 font-semibold text-gray-700 border border-gray-300">총 상환액</td>
                            <td className="px-6 py-5 border border-gray-300">{formatCurrency(state.results.equalInstallments.totalPaid)}</td>
                            <td className="px-6 py-5 border border-gray-300">{formatCurrency(state.results.equalPrincipal.totalPaid)}</td>
                            <td className="px-6 py-5 border border-gray-300">{formatCurrency(state.results.bullet.totalPaid)}</td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                            <td className="px-6 py-5 font-semibold text-gray-700 border border-gray-300">상세 스케줄</td>
                            <td className="px-6 py-5 border border-gray-300"><button onClick={() => handleToggleSchedule('equalInstallments')} className="text-blue-600 hover:underline text-sm font-medium">{visibleSchedule === 'equalInstallments' ? '숨기기' : '보기'}</button></td>
                            <td className="px-6 py-5 border border-gray-300"><button onClick={() => handleToggleSchedule('equalPrincipal')} className="text-blue-600 hover:underline text-sm font-medium">{visibleSchedule === 'equalPrincipal' ? '숨기기' : '보기'}</button></td>
                            <td className="px-6 py-5 border border-gray-300"><button onClick={() => handleToggleSchedule('bullet')} className="text-blue-600 hover:underline text-sm font-medium">{visibleSchedule === 'bullet' ? '숨기기' : '보기'}</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-4">
              {visibleSchedule === 'equalInstallments' && state.results.equalInstallments && <ScheduleTable schedule={state.results.equalInstallments.schedule} title="원리금 균등상환" />}
              {visibleSchedule === 'equalPrincipal' && state.results.equalPrincipal && <ScheduleTable schedule={state.results.equalPrincipal.schedule} title="원금 균등상환" />}
              {visibleSchedule === 'bullet' && state.results.bullet && <ScheduleTable schedule={state.results.bullet.schedule} title="만기일시 상환" />}
            </div>
          </div>
        )}

        {state.errors && (
            <div className="mt-6 bg-red-100 p-4 rounded-lg text-red-700 text-sm">
                <p className="font-bold mb-2">오류가 발생했습니다.</p>
                <ul>
                    {Object.entries(state.errors).map(([key, value]) => (
                        <li key={key}>{`${key}: ${Array.isArray(value) ? value.join(', ') : value}`}</li>
                    ))}
                </ul>
            </div>
        )}
      </div>
    </div>
  );
}
