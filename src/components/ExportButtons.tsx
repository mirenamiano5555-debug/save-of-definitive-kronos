import { Button } from "@/components/ui/button";
import { FileText, FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface ExportField {
  label: string;
  value: string | null | undefined;
}

interface ExportButtonsProps {
  title: string;
  fields: ExportField[];
  imageUrl?: string | null;
}

function generateDocContent(title: string, fields: ExportField[]): string {
  const rows = fields
    .filter((f) => f.value)
    .map((f) => `<tr><td style="padding:4px 8px;font-weight:bold;border:1px solid #ccc;">${f.label}</td><td style="padding:4px 8px;border:1px solid #ccc;">${f.value}</td></tr>`)
    .join("");

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${title}</title></head>
<body><h1>${title}</h1><table style="border-collapse:collapse;width:100%">${rows}</table></body></html>`;
}

export default function ExportButtons({ title, fields, imageUrl }: ExportButtonsProps) {
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(title, 14, 20);

    let y = 35;
    doc.setFontSize(10);
    fields
      .filter((f) => f.value)
      .forEach((f) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.text(`${f.label}:`, 14, y);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(f.value!, 120);
        doc.text(lines, 60, y);
        y += Math.max(lines.length * 5, 7);
      });

    doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
    toast.success("PDF exportat!");
  };

  const exportDoc = () => {
    const content = generateDocContent(title, fields);
    const blob = new Blob(["\ufeff", content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/\s+/g, "_")}.doc`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Document exportat!");
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportPDF}>
        <FileDown className="h-4 w-4 mr-1" /> PDF
      </Button>
      <Button variant="outline" size="sm" onClick={exportDoc}>
        <FileText className="h-4 w-4 mr-1" /> DOC
      </Button>
    </div>
  );
}
