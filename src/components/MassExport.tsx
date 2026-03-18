import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface MassExportProps {
  items: any[];
  type: "objectes" | "ues" | "jaciments";
}

export default function MassExport({ items, type }: MassExportProps) {
  if (items.length === 0) return null;

  const exportAllPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentW = pageW - margin * 2;

    const typeLabel = type === "objectes" ? "OBJECTES" : type === "ues" ? "UNITATS ESTRATIGRÀFIQUES" : "JACIMENTS";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`EXPORTACIÓ MASSIVA — ${typeLabel}`, margin, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${items.length} registres · ${new Date().toLocaleDateString("ca")}`, margin, 28);

    let y = 36;

    for (const item of items) {
      if (y > 250) { doc.addPage(); y = 15; }

      // Item header
      doc.setFillColor(230, 225, 215);
      doc.rect(margin, y, contentW, 7, "F");
      doc.rect(margin, y, contentW, 7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);

      const name = type === "objectes" ? (item.name || item.object_id) :
                   type === "ues" ? (item.codi_ue || `UE ${item.id?.slice(0, 8)}`) :
                   item.name;
      doc.text(name || "Sense nom", margin + 2, y + 5);
      y += 9;

      // Fields
      const fields = getFieldsForItem(item, type);
      doc.setFontSize(7);
      for (const [label, value] of fields) {
        if (!value) continue;
        if (y > 275) { doc.addPage(); y = 15; }
        doc.rect(margin, y, contentW, 6);
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, margin + 2, y + 4);
        doc.setFont("helvetica", "normal");
        const text = String(value).slice(0, 80);
        doc.text(text, margin + 40, y + 4);
        y += 6;
      }

      y += 6;
    }

    doc.save(`exportacio_${type}_${Date.now()}.pdf`);
    toast.success(`${items.length} fitxes exportades!`);
  };

  return (
    <Button variant="outline" size="sm" onClick={exportAllPDF} className="h-7 px-2 text-xs gap-1">
      <FileDown className="h-3 w-3" /> Exportar {items.length} fitxes (PDF)
    </Button>
  );
}

function getFieldsForItem(item: any, type: string): [string, any][] {
  if (type === "objectes") {
    return [
      ["ID", item.object_id], ["Tipus", item.tipus], ["Data", item.data_descobriment],
      ["GPS", item.estacio_gps], ["Persona", item.persona_registra],
    ];
  }
  if (type === "ues") {
    return [
      ["Codi UE", item.codi_ue], ["Campanya", item.campanya], ["Zona", item.zona],
      ["Sector", item.sector], ["Cronologia", item.cronologia], ["Interpretació", item.interpretacio],
    ];
  }
  return [
    ["Nom", item.name], ["Període", item.period], ["Entitat", item.entity],
    ["Descripció", item.description],
  ];
}
