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
  variant?: "default" | "fitxa";
  type?: "ue" | "objecte" | "jaciment";
}

const sectionConfigs: Record<string, { title: string; fieldLabels: string[] }[]> = {
  ue: [
    { title: "DADES IDENTIFICATIVES", fieldLabels: ["Jaciment", "Codi UE", "Campanya", "Terme municipal", "Comarca", "Zona", "Sector", "Àmbit", "FET", "Descripció", "Color", "Consistència"] },
    { title: "RELACIONS ESTRATIGRÀFIQUES", fieldLabels: ["Igual a", "Tallat per", "Es recolza a", "Se li recolza", "Talla", "Reomplert per", "Cobert per", "Reomple a", "Cobreix a", "Interpretació"] },
    { title: "DATACIÓ", fieldLabels: ["Cronologia", "Criteri", "Materials"] },
    { title: "DOCUMENTACIÓ I MOSTRES", fieldLabels: ["Planta", "Secció", "Fotografia", "Sediment", "Carpologia", "Antracologia", "Fauna", "Metalls", "Observacions"] },
  ],
  objecte: [
    { title: "DADES DE L'OBJECTE", fieldLabels: ["ID", "Jaciment", "UE", "Tipus", "Data descobriment", "Data origen", "Estació GPS", "Codi nivell", "Subunitat", "Persona registra", "Mides", "Altres números", "Estat conservació"] },
  ],
  jaciment: [
    { title: "DADES DEL JACIMENT", fieldLabels: ["Nom", "Període", "Descripció", "Entitat", "Coordenades", "Visibilitat"] },
  ],
};

function generateFitxaPDF(title: string, fields: ExportField[], type: string) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;

  // Title block
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(margin, 10, contentW, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);

  const fitxaTitle = type === "ue" ? "FITXA D'EXCAVACIÓ" : type === "objecte" ? "FITXA D'OBJECTE" : "FITXA DE JACIMENT";
  doc.text(fitxaTitle, margin + 4, 22);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(title, margin + contentW / 2, 22);

  let y = 32;
  const sections = sectionConfigs[type] || [{ title: "", fieldLabels: fields.map((f) => f.label) }];

  for (const section of sections) {
    if (y > 270) { doc.addPage(); y = 15; }

    // Section header
    doc.setFillColor(230, 225, 215);
    doc.rect(margin, y, contentW, 7, "F");
    doc.rect(margin, y, contentW, 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(section.title, margin + 2, y + 5);
    y += 9;

    const sectionFields = section.fieldLabels
      .map((label) => {
        const f = fields.find((ff) => ff.label === label);
        return f ? { label: f.label, value: f.value || "" } : { label, value: "" };
      });

    // Render fields as bordered cells, 2 per row
    for (let i = 0; i < sectionFields.length; i += 2) {
      if (y > 275) { doc.addPage(); y = 15; }

      const f1 = sectionFields[i];
      const f2 = sectionFields[i + 1];
      const cellH = 8;
      const halfW = contentW / 2;

      // First cell
      doc.rect(margin, y, f2 ? halfW : contentW, cellH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(`${f1.label}:`, margin + 2, y + 4);
      doc.setFont("helvetica", "normal");
      doc.text(f1.value || "", margin + 2, y + 7, { maxWidth: (f2 ? halfW : contentW) - 4 });

      // Second cell
      if (f2) {
        doc.rect(margin + halfW, y, halfW, cellH);
        doc.setFont("helvetica", "bold");
        doc.text(`${f2.label}:`, margin + halfW + 2, y + 4);
        doc.setFont("helvetica", "normal");
        doc.text(f2.value || "", margin + halfW + 2, y + 7, { maxWidth: halfW - 4 });
      }

      y += cellH;
    }

    y += 3;
  }

  doc.save(`${fitxaTitle.replace(/\s+/g, "_")}_${title.replace(/\s+/g, "_")}.pdf`);
  toast.success("PDF exportat!");
}

function generateDocContent(title: string, fields: ExportField[], type?: string): string {
  const fitxaTitle = type === "ue" ? "FITXA D'EXCAVACIÓ" : type === "objecte" ? "FITXA D'OBJECTE" : type === "jaciment" ? "FITXA DE JACIMENT" : title;

  const sections = type && sectionConfigs[type]
    ? sectionConfigs[type]
    : [{ title: "", fieldLabels: fields.map((f) => f.label) }];

  let html = "";
  for (const section of sections) {
    if (section.title) {
      html += `<tr><td colspan="2" style="padding:4px 8px;font-weight:bold;background:#e6e1d7;border:1px solid #999;">${section.title}</td></tr>`;
    }
    const sectionFields = section.fieldLabels.map((label) => {
      const f = fields.find((ff) => ff.label === label);
      return { label, value: f?.value || "" };
    });
    for (let i = 0; i < sectionFields.length; i += 2) {
      const f1 = sectionFields[i];
      const f2 = sectionFields[i + 1];
      html += `<tr>`;
      html += `<td style="padding:3px 6px;border:1px solid #999;width:50%;font-size:11px;"><b>${f1.label}:</b> ${f1.value}</td>`;
      if (f2) {
        html += `<td style="padding:3px 6px;border:1px solid #999;width:50%;font-size:11px;"><b>${f2.label}:</b> ${f2.value}</td>`;
      } else {
        html += `<td style="border:1px solid #999;"></td>`;
      }
      html += `</tr>`;
    }
  }

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${fitxaTitle}</title></head>
<body>
<h1 style="font-size:16px;">${fitxaTitle}</h1>
<h2 style="font-size:13px;color:#555;">${title}</h2>
<table style="border-collapse:collapse;width:100%">${html}</table>
</body></html>`;
}

export default function ExportButtons({ title, fields, variant = "default", type }: ExportButtonsProps) {
  const exportPDF = () => {
    if (variant === "fitxa" && type) {
      generateFitxaPDF(title, fields, type);
    } else {
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
    }
  };

  const exportDoc = () => {
    const content = generateDocContent(title, fields, type);
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
    <div className="flex gap-1">
      <Button variant="outline" size="sm" onClick={exportPDF} className="h-7 px-2 text-xs">
        <FileDown className="h-3 w-3 mr-1" /> PDF
      </Button>
      <Button variant="outline" size="sm" onClick={exportDoc} className="h-7 px-2 text-xs">
        <FileText className="h-3 w-3 mr-1" /> DOC
      </Button>
    </div>
  );
}
