'use client';

import { calculateAllLoanScenarios } from '../lib/actions';
import type { AllScenariosResult, ScheduleEntry, RefinanceInfo } from '../lib/loanLogic';
import React, { useState, useActionState } from 'react';

const initialState: AllScenariosResult = {};

// --- 헬퍼 함수 ---
const formatCurrency = (amount: number): string => {
  if (isNaN(amount)) return '-';
  return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + '원';
};


// --- 1. 정보 탭 컴포넌트 ---
const InfoTabs = () => {
    const [activeTab, setActiveTab] = useState('description');

    return (
        <div className="mb-8">             
            <div className="pt-6  border border-gray-200 rounded">
            <button 
                    onClick={() => setActiveTab('description')}
                    className={`pb-3 text-lg font-bold transition-colors duration-200 ${activeTab === 'description' ? ' border-b-2 border-gray-900' : ''}`}>
                    설명
                </button>
                <button
                    onClick={() => setActiveTab('methods')}
                    className={`pb-3 text-lg font-bold transition-colors duration-200 ${activeTab === 'methods' ? ' border-b-2 border-gray-900' : ''}`}>
                    상환 방법
                </button>
                {activeTab === 'methods' ? (
                    <ul className="space-y-3">
                        <li><strong className="font-semibold text-gray-900">• 원리금균등분할:</strong> 매달 원금과 이자를 합쳐 동일한 금액을 납부하여 자금 계획을 세우기 편리합니다.</li>
                        <li><strong className="font-semibold text-gray-900">• 원금균등분할:</strong> 매달 같은 금액의 원금을 상환하여 월 납입금이 점차 줄어듭니다. 총 이자가 가장 적습니다.</li>
                        <li><strong className="font-semibold text-gray-900">• 만기일시상환:</strong> 대출 기간 동안 이자만 납부하고, 만기일에 원금 전액을 상환합니다. 월 부담은 적지만 총 이자액은 가장 많습니다.</li>
                    </ul>
                ) : (
                    <p>
                        이 계산기는 사용자가 대출 원금, 이자율, 기간 등 기본 정보를 입력하면, 다양한 상환 방식에 따른 월 납입금과 총 이자를 한눈에 비교할 수 있는 웹 애플리케이션입니다. 또한, 사용자의 현재 대출 조건이 시장 평균 대비 고금리일 경우, 더 나은 조건의 대환대출을 지능적으로 제안하여 사용자의 금융 비용 절감을 돕는 것을 목표로 합니다.
                    </p>
                )}
            </div>
            
        </div>
    );
};


// --- 2. 대출 입력 폼 컴포넌트 ---
const LoanForm = ({ formAction }: { formAction: (payload: FormData) => void }) => {
    const [showGracePeriod, setShowGracePeriod] = useState(false);
    const [showPrepayment, setShowPrepayment] = useState(false);
    const [additionalRepayments, setAdditionalRepayments] = useState([{ round: '', amount: '', newRate: '' }]);

    const addRepayment = () => setAdditionalRepayments([...additionalRepayments, { round: '', amount: '', newRate: '' }]);
    const removeRepayment = (index: number) => setAdditionalRepayments(additionalRepayments.filter((_, i) => i !== index));

    const inputStyles = "flex-1 px-4 py-2 border border-gray-300 rounded-md transition-all duration-200 focus:ring-2 focus:ring-blue-300 focus:border-blue-500";
    const labelStyles = "w-28 shrink-0 bg-gray-100 text-gray-700 px-4 py-2 text-center text-sm font-medium rounded-l-md";
    const addonStyles = "bg-gray-200 text-gray-700 px-4 py-2 rounded-r-md";

    return (
        <form action={formAction} className="space-y-6 max-w-3xl mx-auto">
            <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-2 mb-4">
                 <label className="flex items-center space-x-2 cursor-pointer">
                    <input id="grace-period-checkbox" type="checkbox" checked={showGracePeriod} onChange={() => setShowGracePeriod(!showGracePeriod)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
                    <span className="text-sm text-gray-900">거치기간</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input id="prepayment-checkbox" type="checkbox" checked={showPrepayment} onChange={() => setShowPrepayment(!showPrepayment)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
                    <span className="text-sm text-gray-900">중도상환/금리변동</span>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
  {/* 대출 금액 */}
    <div className="flex items-center">
      <label htmlFor="principal" className="w-28 text-gray-700 text-sm text-center font-medium">대출 금액</label>
      <input type="number" id="principal" name="principal" required className="flex-none w-28 px-3 py-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-blue-300 focus:border-blue-500" placeholder="금액 입력" />
      <span className="flex-none w-12 bg-gray-200 text-gray-700 px-2 py-2 rounded-r-md text-sm text-center">만원</span>
    </div>

  {/* 연 이자율 */}
   <div className="flex items-center">
      <label htmlFor="annualRate" className="w-28 text-gray-700 text-sm text-center font-medium">연 이자율</label>
      <input type="number" step="0.01" id="annualRate" name="annualRate" required className="flex-none w-28 px-3 py-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-blue-300 focus:border-blue-500" placeholder="% 입력" />
      <span className="flex-none w-12 bg-gray-200 text-gray-700 px-2 py-2 rounded-r-md text-sm text-center">%</span>
    </div>

  {/* 대출 기간 */}
    <div className="flex items-center">
      <label htmlFor="loanTermMonths" className="w-28 text-gray-700 text-sm text-center font-medium">대출 기간</label>
      <input type="number" id="loanTermMonths" name="loanTermMonths" required className="flex-none w-28 px-3 py-2 border border-ray-300 rounded-l-md focus:ring-2 focus:ring-blue-300 focus:border-blue-500" placeholder="총 개월수" />
      <span className="flex-none w-12 bg-gray-200 text-gray-700 px-2 py-2 rounded-r-md text-sm text-center">개월</span>
    </div>

  {/* 거치기간 (체크 시) */}
  {showGracePeriod && (
    <div className="flex items-center">
      <label htmlFor="gracePeriodMonths" className="w-28 text-gray-700 text-sm text-center font-medium">거치 기간</label>
      <input type="number" id="gracePeriodMonths" name="gracePeriodMonths" className="flex-none w-28 px-3 py-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-blue-300 focus:border-blue-500" placeholder="거치 개월수" />
      <span className="flex-none w-12 bg-gray-200 text-gray-700 px-2 py-2 rounded-r-md text-sm text-center">개월</span>
    </div>
  )}
</div>


{showPrepayment && additionalRepayments.map((_, index) => (
  
  <div key={index} className="p-3 bg-gray-50 rounded-lg">
    <div className="w-full border-t border-gray-300 border-dashed border-[0.5px] mb-1"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
      {/* 회차 */}
      <div className="flex items-center">
        <label className="w-20 text-gray-700 text-sm text-center font-medium">회차</label>
        <input
          type="number"
          name={`repaymentRound_${index}`}
          placeholder="상환 회차"
          className="flex-none w-20 px-2 py-2 border border-gray-300 rounded-l-md text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500"
        />
        <span className="flex-none w-10 bg-gray-200 text-gray-700 px-2 py-2 rounded-r-md text-sm text-center">회</span>
      </div>

      {/* 상환액 */}
      <div className="flex items-center">
        <label className="w-20 text-gray-700 text-sm text-center font-medium">상환액</label>
        <input
          type="number"
          name={`repaymentAmount_${index}`}
          placeholder="금액"
          className="flex-none w-20 px-2 py-2 border border-gray-300 rounded-l-md text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500"
        />
        <span className="flex-none w-12 bg-gray-200 text-gray-700 px-2 py-2 rounded-r-md text-sm text-center">만원</span>
      </div>

      {/* 변경 이율 */}
      <div className="flex items-stretch">
                <label className="w-20 text-gray-700 text-sm text-center font-medium">변경 이율</label>
        <input
          type="number"
          step="0.01"
          name={`newRate_${index}`}
          placeholder="변경 시만"
          className="flex-none w-20 px-2 py-2 border border-gray-300 rounded-l-md text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500"
        />
        <span className="flex-none w-10 bg-gray-200 text-gray-700 px-2 py-1 rounded-r-md text-sm text-center">%</span>
      </div>
    </div>

    {/* 삭제/추가 버튼 */}
    <div className="flex justify-end items-center mt-2">
      {additionalRepayments.length > 1 && (
        <button
          type="button"
          onClick={() => removeRepayment(index)}
          className="w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded-full text-lg hover:bg-red-600 transform hover:scale-110 transition-transform"
        >
          -
        </button>
      )}
      {index === additionalRepayments.length - 1 && (
        <button
          type="button"
          onClick={addRepayment}
          className="ml-2 w-7 h-7 flex items-center justify-center bg-blue-500 text-white rounded-full text-lg hover:bg-blue-600 transform hover:scale-110 transition-transform"
        >
          +
        </button>
      )}
      
    </div>
  </div>
))}



            <div className="pt-4">
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md transform hover:scale-105">계산하기</button>
            </div>
        </form>
    );
};


// --- 3. 결과 표시 관련 컴포넌트들 ---

const RefinanceSuggestion = ({ refinanceInfo, annualRate }: { refinanceInfo: RefinanceInfo, annualRate: number }) => {
    const [showLinks, setShowLinks] = useState(false);
    const HIGH_RATE_THRESHOLD = 5.0;
    const externalLinks = [
        { name: '카카오뱅크', url: 'https://www.kakaobank.com/products/refinanceLoan' },
        { name: '하나은행', url: 'https://m.hanacard.co.kr/MKTRLO0000M.web' },
        { name: '네이버페이', url: 'https://loan.pay.naver.com/n/mortgage' },
        { name: 'KB국민', url: 'https://obank.kbstar.com/quics?QSL=F&cc=b104363:b104516&isNew=N&page=C103429&prcode=LN20001334&utm_source=chatgpt.com' },
        { name: '우리은행', url:'https://spot.wooribank.com/pot/Dream?withyou=POLON0060&cc=c010528:c010531;c012425:c012399&PRD_CD=P020006549&PRD_YN=Y'},
        {name: '신한은행', url:'https://m.shinhan.com/mw/fin/pg/PR0502S0100F01?mid=220011114002&pid=612123600&type=app&hwno='}
    ];
    const title = annualRate >= HIGH_RATE_THRESHOLD ? "현재 대출 금리가 높은 편이에요." : "이자를 더 아낄 기회가 있을 수 있어요.";

    return (
        <div className="mt-10 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg text-center shadow-md">
            <p className="text-lg font-semibold text-gray-800">{title}</p>
            <p className="text-2xl font-bold text-blue-600 my-2">대환 시 최대 <span className="underline">{formatCurrency(refinanceInfo.potentialSavings)}</span> 절약 가능!</p>
            <p className="text-sm text-gray-600 mb-4">더 좋은 조건으로 바꾸고 이자를 아껴보세요. (1년 후 제1금융권 평균금리 전환 가정)</p>
            <button onClick={() => setShowLinks(!showLinks)} className="bg-blue-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105">
                {showLinks ? '닫기' : '대환대출 알아보기'}
            </button>
            {showLinks && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                    <p className="text-sm font-semibold text-gray-700 mb-3">주요 대환대출 플랫폼</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {externalLinks.map(link => (
                            <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className="block bg-white py-3 px-2 border border-gray-300 rounded-lg text-sm text-gray-800 font-medium hover:bg-gray-100 hover:border-gray-400 transition-all transform hover:scale-105">
                                {link.name}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const ScheduleTable = ({ schedule, title }: { schedule: ScheduleEntry[], title: string }) => (
    <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">{title} - 상세 상환 스케줄</h3>
        <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-300">
            <table className="w-full text-sm text-left text-gray-600 border-collapse">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
                    <tr>
                        <th className="px-4 py-3 border-b border-gray-300">회차</th>
                        <th className="px-4 py-3 border-b border-gray-300">상환원금</th>
                        <th className="px-4 py-3 border-b border-gray-300">이자액</th>
                        <th className="px-4 py-3 border-b border-gray-300">납부액</th>
                        <th className="px-4 py-3 border-b border-gray-300">잔액</th>
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {schedule.map((entry, index) => (
                        <tr key={entry.month} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 font-medium border-b border-gray-200">{entry.month}</td>
                            <td className="px-4 py-2 border-b border-gray-200">{formatCurrency(entry.principalPayment)}</td>
                            <td className="px-4 py-2 border-b border-gray-200">{formatCurrency(entry.interestPayment)}</td>
                            <td className="px-4 py-2 border-b border-gray-200">{formatCurrency(entry.totalPayment)}</td>
                            <td className="px-4 py-2 border-b border-gray-200">{formatCurrency(entry.remainingPrincipal)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const ResultsDisplay = ({ results, visibleSchedule, handleToggleSchedule }: { results: NonNullable<AllScenariosResult['results']>, visibleSchedule: string | null, handleToggleSchedule: (scenario: string) => void }) => (
    <div className="mt-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">계산 결과 비교</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-center bg-white">
                 <thead className="bg-gray-100">
                    <tr>
                        <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider">구분</th>
                        <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider">원리금 균등</th>
                        <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider">원금 균등</th>
                        <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider">만기일시</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    <tr className="hover:bg-gray-50">
                        <td className="px-6 py-5 font-semibold text-gray-700">총 이자</td>
                        <td className="px-6 py-5 text-red-600 font-bold text-lg">{formatCurrency(results.equalInstallments.totalInterest)}</td>
                        <td className="px-6 py-5 text-red-500 font-bold text-lg">{formatCurrency(results.equalPrincipal.totalInterest)}</td>
                        <td className="px-6 py-5 text-red-500 font-bold text-lg">{formatCurrency(results.bullet.totalInterest)}</td>
                    </tr>
                    <tr className="bg-gray-50 hover:bg-gray-100">
                        <td className="px-6 py-5 font-semibold text-gray-700">총 상환액</td>
                        <td className="px-6 py-5">{formatCurrency(results.equalInstallments.totalPaid)}</td>
                        <td className="px-6 py-5">{formatCurrency(results.equalPrincipal.totalPaid)}</td>
                        <td className="px-6 py-5">{formatCurrency(results.bullet.totalPaid)}</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                        <td className="px-6 py-5 font-semibold text-gray-700">상세 스케줄</td>
                        <td className="px-6 py-5"><button onClick={() => handleToggleSchedule('equalInstallments')} className="text-blue-600 hover:underline text-sm font-medium">{visibleSchedule === 'equalInstallments' ? '숨기기' : '보기'}</button></td>
                        <td className="px-6 py-5"><button onClick={() => handleToggleSchedule('equalPrincipal')} className="text-blue-600 hover:underline text-sm font-medium">{visibleSchedule === 'equalPrincipal' ? '숨기기' : '보기'}</button></td>
                        <td className="px-6 py-5"><button onClick={() => handleToggleSchedule('bullet')} className="text-blue-600 hover:underline text-sm font-medium">{visibleSchedule === 'bullet' ? '숨기기' : '보기'}</button></td>
                    </tr>
                </tbody>
            </table>
        </div>

        {results.refinance && results.inputs && <RefinanceSuggestion refinanceInfo={results.refinance} annualRate={results.inputs.annualRate} />}

        <div className="mt-4">
            {visibleSchedule === 'equalInstallments' && <ScheduleTable schedule={results.equalInstallments.schedule} title="원리금 균등상환" />}
            {visibleSchedule === 'equalPrincipal' && <ScheduleTable schedule={results.equalPrincipal.schedule} title="원금 균등상환" />}
            {visibleSchedule === 'bullet' && <ScheduleTable schedule={results.bullet.schedule} title="만기일시 상환" />}
        </div>
    </div>
);

const ErrorDisplay = ({ errors }: { errors: NonNullable<AllScenariosResult['errors']> }) => (
    <div className="mt-6 bg-red-100 border border-red-300 p-4 rounded-lg text-red-800 text-sm">
        <p className="font-bold mb-2">오류가 발생했습니다.</p>
        <ul className="list-disc list-inside">
            {/* 폼 전체에 대한 오류 메시지 처리 */}
            {errors.formErrors && errors.formErrors.length > 0 && errors.formErrors.map((error: string, i: number) => (
                <li key={`form-error-${i}`}>{error}</li>
            ))}
            {/* 각 필드에 대한 오류 메시지 처리 */}
            {errors.fieldErrors && Object.entries(errors.fieldErrors).map(([key, value]) => {
                if (Array.isArray(value) && value.length > 0) {
                    return (
                        <li key={key}>
                            <span className="font-semibold">{key}:</span> {value.join(', ')}
                        </li>
                    );
                }
                return null;
            })}
        </ul>
    </div>
);


// --- 최종 메인 컴포넌트 ---
export default function LoanPlanner() {
  const [state, formAction] = useActionState(calculateAllLoanScenarios, initialState);
  const [visibleSchedule, setVisibleSchedule] = useState<string | null>(null);

  const handleToggleSchedule = (scenario: string) => {
      setVisibleSchedule(visibleSchedule === scenario ? null : scenario);
  };

  return (
      <div className="flex flex-col min-h-screen bg-gray-50 p-4 font-sans">
          <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8">
              
              <div className="text-center mb-6">
                  <h1 className="text-4xl font-bold text-gray-800">대출 이자 계산기</h1>
                  <br/>
                  <p className="text-gray-600 mt-2">
                      다양한 상환 방식의 월 납입금과 총 이자를 비교하고, 더 나은 대출 관리를 위한 제안을 받아보세요.
                  </p>
              </div>

              <InfoTabs />
              <br/><br/>
          
              <LoanForm formAction={formAction} />

              {state.results && (
                  <ResultsDisplay
                      results={state.results}
                      visibleSchedule={visibleSchedule}
                      handleToggleSchedule={handleToggleSchedule}
                  />
              )}

              {state.errors && <ErrorDisplay errors={state.errors} />}
          </div>
      </div>
  );
}
