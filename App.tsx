
import React, { useState, useCallback } from 'react';
import { DiagnosticForm } from './components/DiagnosticForm';
import { ReportDisplay } from './components/ReportDisplay';
import { FormData, Report } from './types';
import { generateReport } from './services/geminiService';
import { LogoIcon, SparklesIcon } from './components/icons';

const App: React.FC = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFormSubmit = useCallback(async (formData: FormData) => {
    setIsLoading(true);
    setError(null);
    setReport(null);
    try {
      const generatedReport = await generateReport(formData);
      setReport(generatedReport);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = () => {
    setReport(null);
    setError(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <header className="w-full max-w-4xl mx-auto text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
            <LogoIcon className="h-10 w-10 text-indigo-600" />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                Persuasion Imagineering
            </h1>
        </div>
        <p className="text-lg text-gray-600">Skill Stack Diagnostic</p>
      </header>

      <main className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg transition-all duration-500">
          {isLoading ? (
            <div className="p-12 text-center">
              <SparklesIcon className="h-12 w-12 text-indigo-500 mx-auto animate-pulse" />
              <h2 className="mt-4 text-2xl font-semibold text-gray-700">Generating Your Renaissance Map...</h2>
              <p className="mt-2 text-gray-500">The Imagineer is analyzing your skills and crafting your opportunities. This may take a moment.</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <h2 className="text-2xl font-semibold text-red-600">An Error Occurred</h2>
              <p className="mt-2 text-gray-600">{error}</p>
              <button
                onClick={handleReset}
                className="mt-6 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Try Again
              </button>
            </div>
          ) : report ? (
            <ReportDisplay report={report} onReset={handleReset} />
          ) : (
            <DiagnosticForm onSubmit={handleFormSubmit} />
          )}
        </div>
        <footer className="text-center mt-8 text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} Persuasion Imagineering. All Rights Reserved.</p>
        </footer>
      </main>
    </div>
  );
};

export default App;
