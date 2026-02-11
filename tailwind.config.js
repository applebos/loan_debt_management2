// app/components/LoanPlanner.tsx

<div className="flex items-center">
    <input id="grace-period-checkbox" type="checkbox" checked={showGracePeriod} onChange={() => setShowGracePeriod(!showGracePeriod)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
    <label htmlFor="grace-period-checkbox" className="ml-2 block text-sm text-gray-900">거치기간</label>
</div>
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // Or if using `src` directory:
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};