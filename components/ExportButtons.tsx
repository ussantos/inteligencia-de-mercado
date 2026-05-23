'use client';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Download, FileDown, Share2 } from 'lucide-react';
import { Button } from '@/components/ui';
import type { AnalysisResult } from '@/lib/types';

export function ExportButtons({ result, readOnly = false }: { result: AnalysisResult; readOnly?: boolean }) {
  async function exportPdf() {
    const element = document.getElementById('analysis-report');
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 1.5, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, width, height);
    pdf.save('relatorio-inteligencia-myrobot.pdf');
  }

  function exportXlsx() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.points), 'CEPs Analisados');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.afinidadePorBairro), 'Afinidade por Bairro');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.strategicPlaces), 'Concorrentes e Obstáculos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.perfilEconomico), 'Perfil Econômico');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.personas), 'Personas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.planoDeAcao), 'Plano de Ação');
    XLSX.writeFile(wb, 'analise-inteligencia-myrobot.xlsx');
  }

  async function share() {
    if (!result.id) return;
    const response = await fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analysisId: result.id }) });
    const json = await response.json();
    if (json.url) {
      await navigator.clipboard.writeText(`${window.location.origin}${json.url}`);
      alert('Link compartilhável copiado para a área de transferência.');
    }
  }

  return (
    <div className="flex flex-wrap gap-3 no-print">
      <Button onClick={exportPdf}><FileDown className="mr-2 h-4 w-4" /> Exportar Relatório PDF</Button>
      <Button onClick={exportXlsx} className="bg-slate-900 hover:bg-slate-800"><Download className="mr-2 h-4 w-4" /> Exportar Planilha</Button>
      {!readOnly && result.id && <Button onClick={share} className="bg-blue-600 hover:bg-blue-700"><Share2 className="mr-2 h-4 w-4" /> Compartilhar Análise</Button>}
    </div>
  );
}
