
import React, { useRef, useState, useCallback } from 'react';
import { Report } from '../types.ts';
import { PersonaIcon, EdgeIcon, OpportunityIcon, QuickWinsIcon, BuildPlanIcon, GuardrailsIcon, ToolsIcon, PromptsIcon, CopyIcon, DownloadIcon, JsonIcon, BackIcon } from './icons.tsx';

// FIX: Add global type declarations for window properties from external scripts (jsPDF, html2canvas)
declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

interface ReportDisplayProps {
  report: Report;
  onReset: () => void;
}

const ReportSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; }> = ({ title, icon, children }) => (
    <div className="py-6 border-b border-gray-200 last:border-b-0">
        <div className="flex items-center gap-3 mb-4">
            {icon}
            <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        </div>
        <div className="pl-10 space-y-4 text-gray-700">
            {children}
        </div>
    </div>
);

export const ReportDisplay: React.FC<ReportDisplayProps> = ({ report, onReset }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
    const [showJson, setShowJson] = useState(false);

    const copyToClipboard = useCallback(() => {
        if (!reportRef.current) return;
        
        // FIX: Explicitly type `el` as Element to resolve type inference issues.
        const reportText = Array.from(reportRef.current.querySelectorAll('.report-section-content')).map((el: Element) => {
            const title = el.querySelector('h3')?.textContent || '';
            const content = Array.from(el.querySelectorAll('p, li')).map(item => item.textContent).join('\n');
            return `${title}\n${content}\n`;
        }).join('\n');

        navigator.clipboard.writeText(reportText).then(() => {
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 2000);
        });
    }, []);

    const downloadAsPdf = useCallback(() => {
        const input = reportRef.current;
        if (!input) return;

        const { jsPDF } = window.jspdf;
        const html2canvas = window.html2canvas;

        html2canvas(input, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: 'a4'
            });

            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const pageHeight = pdf.internal.pageSize.getHeight();
            const pageWidth = pdf.internal.pageSize.getWidth();

            // Calculate the height of the image in the PDF to maintain aspect ratio
            const ratio = pageWidth / imgWidth;
            const totalPdfHeight = imgHeight * ratio;

            let heightLeft = totalPdfHeight;
            let position = 0;

            // Add the first page
            pdf.addImage(imgData, 'PNG', 0, position, pageWidth, totalPdfHeight);
            heightLeft -= pageHeight;

            // Add subsequent pages if the content is taller than one page
            while (heightLeft > 0) {
                position -= pageHeight; // Move the image "up" to show the next part
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pageWidth, totalPdfHeight);
                heightLeft -= pageHeight;
            }

            pdf.save('Persuasion_Imagineering_Report.pdf');
        });
    }, []);

    return (
        <div className="p-6 sm:p-10">
            <div className="flex justify-between items-center mb-6">
                <button onClick={onReset} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                    <BackIcon className="h-5 w-5" />
                    Start Over
                </button>
                <div className="flex items-center gap-2">
                    <button onClick={copyToClipboard} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
                        <CopyIcon className="h-4 w-4" /> {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={downloadAsPdf} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
                        <DownloadIcon className="h-4 w-4" /> Download PDF
                    </button>
                </div>
            </div>

            <div ref={reportRef} className="report-container bg-white">
                <div className="text-center py-6 border-b border-gray-200 report-section-content">
                    <PersonaIcon className="h-16 w-16 mx-auto text-indigo-500 mb-4" />
                    <h2 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">You Are:</h2>
                    <h1 className="text-4xl font-extrabold text-gray-900 mt-1">{report.personaTitle}</h1>
                    <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-600">{report.identityParagraph}</p>
                </div>

                <div className="report-section-content">
                    <ReportSection title="Your Edge (Top 3 Strength Zones)" icon={<EdgeIcon className="h-7 w-7 text-green-500" />}>
                        <ul className="list-none space-y-3">
                            {report.topStrengths.map((strength, i) => (
                                <li key={i}>
                                    <p className="font-semibold text-gray-800">{strength.strength}</p>
                                    <p className="text-gray-600">{strength.reason}</p>
                                </li>
                            ))}
                        </ul>
                    </ReportSection>
                </div>

                <div className="report-section-content">
                    <ReportSection title="Opportunity Map (3-5 ideas)" icon={<OpportunityIcon className="h-7 w-7 text-blue-500" />}>
                        <div className="space-y-8">
                            {report.opportunityMap.map((opp, i) => (
                                <div key={i} className="bg-gray-50 p-4 rounded-lg">
                                    <h4 className="font-bold text-lg text-gray-900">{opp.what}</h4>
                                    <ul className="mt-3 space-y-2 text-sm">
                                        <li><strong>Why You Fit:</strong> {opp.whyFit}</li>
                                        <li><strong>Audience:</strong> {opp.audience}</li>
                                        <li><strong>Offer:</strong> {opp.offer}</li>
                                        <li><strong>Channel:</strong> {opp.channel}</li>
                                        <li><strong>Speed Plan:</strong> {opp.speedPlan}</li>
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </ReportSection>
                </div>
                
                <div className="grid md:grid-cols-2 gap-x-8">
                    <div className="report-section-content">
                        <ReportSection title="Quick Wins (Next 7-14 days)" icon={<QuickWinsIcon className="h-7 w-7 text-yellow-500" />}>
                            <ul className="list-disc list-inside space-y-1">
                                {report.quickWins.map((win, i) => <li key={i}>{win}</li>)}
                            </ul>
                        </ReportSection>
                    </div>
                    <div className="report-section-content">
                        <ReportSection title="30-Day Build Plan" icon={<BuildPlanIcon className="h-7 w-7 text-teal-500" />}>
                            <ul className="list-disc list-inside space-y-1">
                                {report.buildPlan.map((step, i) => <li key={i}>{step}</li>)}
                            </ul>
                        </ReportSection>
                    </div>
                    <div className="report-section-content">
                        <ReportSection title="Guardrails (Not Worth Your Time)" icon={<GuardrailsIcon className="h-7 w-7 text-red-500" />}>
                            <ul className="list-disc list-inside space-y-1">
                                {report.guardrails.map((g, i) => <li key={i}>{g}</li>)}
                            </ul>
                        </ReportSection>
                    </div>
                     <div className="report-section-content">
                        <ReportSection title="Tools to Explore" icon={<ToolsIcon className="h-7 w-7 text-purple-500" />}>
                            <p>{report.tools.join(' • ')}</p>
                        </ReportSection>
                    </div>
                </div>

                <div className="report-section-content">
                    <ReportSection title="Starter Prompts" icon={<PromptsIcon className="h-7 w-7 text-orange-500" />}>
                        {report.starterPrompts.map((p, i) => (
                            <div key={i} className="bg-gray-800 text-white p-4 rounded-lg font-mono text-sm">
                                <h5 className="font-bold mb-2 text-gray-300">{p.title}</h5>
                                <p className="whitespace-pre-wrap">{p.prompt}</p>
                            </div>
                        ))}
                    </ReportSection>
                </div>
            </div>
            
            <div className="mt-6">
                <button onClick={() => setShowJson(!showJson)} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-800">
                    <JsonIcon className="h-5 w-5" />
                    {showJson ? 'Hide' : 'Show'} Data Snapshot
                </button>
                {showJson && (
                    <pre className="mt-2 bg-gray-900 text-white p-4 rounded-lg text-xs overflow-x-auto">
                        <code>{report.jsonData}</code>
                    </pre>
                )}
            </div>
        </div>
    );
};