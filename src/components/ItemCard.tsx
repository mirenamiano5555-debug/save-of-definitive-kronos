import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import ExportButtons from "@/components/ExportButtons";

interface ItemCardProps {
  item: any;
  type: "objectes" | "jaciments" | "ues";
}

const visibilityLabels: Record<string, string> = {
  public: "Públic",
  entitat: "Entitat",
  esbos: "Esbós",
};

const conservacioLabels = ["Molt dolent", "Dolent", "Regular", "Bo", "Molt bo"];

/* A single bordered cell in the form layout */
function Cell({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`border border-border px-2 py-1 min-h-[28px] ${className}`}>
      <span className="text-[10px] font-bold text-foreground uppercase">{label}:</span>
      {value && <span className="text-xs text-foreground ml-1">{value}</span>}
    </div>
  );
}

/* Two cells side by side */
function Row2({ left, right }: { left: { label: string; value?: string | null }; right: { label: string; value?: string | null } }) {
  return (
    <div className="grid grid-cols-2">
      <Cell label={left.label} value={left.value} />
      <Cell label={right.label} value={right.value} />
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-muted px-2 py-1 border border-border">
      <span className="text-xs font-bold uppercase tracking-wide text-foreground">{title}</span>
    </div>
  );
}

function getUEFields(item: any) {
  return [
    { label: "Jaciment", value: item.jaciments?.name },
    { label: "Codi UE", value: item.codi_ue },
    { label: "Campanya", value: item.campanya },
    { label: "Terme municipal", value: item.terme_municipal },
    { label: "Comarca", value: item.comarca },
    { label: "Zona", value: item.zona },
    { label: "Sector", value: item.sector },
    { label: "Àmbit", value: item.ambit },
    { label: "FET", value: item.fet },
    { label: "Descripció", value: item.descripcio },
    { label: "Color", value: item.color },
    { label: "Consistència", value: item.consistencia },
    { label: "Igual a", value: item.igual_a },
    { label: "Tallat per", value: item.tallat_per },
    { label: "Es recolza a", value: item.es_recolza_a },
    { label: "Se li recolza", value: item.se_li_recolza },
    { label: "Talla", value: item.talla },
    { label: "Reomplert per", value: item.reomplert_per },
    { label: "Cobert per", value: item.cobert_per },
    { label: "Reomple a", value: item.reomple_a },
    { label: "Cobreix a", value: item.cobreix_a },
    { label: "Interpretació", value: item.interpretacio },
    { label: "Cronologia", value: item.cronologia },
    { label: "Criteri", value: item.criteri },
    { label: "Materials", value: item.materials },
    { label: "Planta", value: item.planta },
    { label: "Secció", value: item.seccio },
    { label: "Fotografia", value: item.fotografia },
    { label: "Sediment", value: item.sediment },
    { label: "Carpologia", value: item.carpologia },
    { label: "Antracologia", value: item.antracologia },
    { label: "Fauna", value: item.fauna },
    { label: "Metalls", value: item.metalls },
    { label: "Observacions", value: item.observacions },
  ];
}

function UECard({ item, onClick }: { item: any; onClick: () => void }) {
  return (
    <div className="border-2 border-border rounded bg-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto] border-b border-border">
        <div className="px-3 py-2 flex items-center gap-2 cursor-pointer" onClick={onClick}>
          <div>
            <p className="text-sm font-bold font-serif uppercase">Fitxa d'Excavació</p>
            <p className="text-[10px] text-muted-foreground">{item.codi_ue || `UE ${item.id.slice(0, 8)}`}</p>
          </div>
        </div>
        <div className="px-2 py-1 flex items-center gap-1 border-l border-border">
          <Badge variant="outline" className="text-[10px]">{visibilityLabels[item.visibility] || item.visibility}</Badge>
          <div onClick={(e) => e.stopPropagation()}>
            <ExportButtons title={item.codi_ue || `UE`} fields={getUEFields(item)} variant="fitxa" type="ue" />
          </div>
        </div>
      </div>

      <div className="cursor-pointer" onClick={onClick}>
        {/* DADES IDENTIFICATIVES */}
        <SectionHeader title="Dades Identificatives" />
        <Row2 left={{ label: "Jaciment", value: item.jaciments?.name }} right={{ label: "Terme municipal", value: item.terme_municipal }} />
        <Row2 left={{ label: "Coordenades", value: item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : null }} right={{ label: "Comarca", value: item.comarca }} />

        <div className="grid grid-cols-2">
          <div>
            <Cell label="Zona" value={item.zona} />
            <Cell label="Sector" value={item.sector} />
            <Cell label="Àmbit" value={item.ambit} />
          </div>
          <div>
            <Cell label="UE" value={item.codi_ue} />
            <Cell label="FET" value={item.fet} />
            <Cell label="Campanya" value={item.campanya} />
          </div>
        </div>

        <Cell label="Descripció" value={item.descripcio} className="min-h-[36px]" />
        <Row2 left={{ label: "Color", value: item.color }} right={{ label: "Consistència", value: item.consistencia }} />

        {/* DADES IDENTIFICACTIVES (relacions) */}
        <SectionHeader title="Dades Identificactives" />
        <Row2 left={{ label: "Igual a", value: item.igual_a }} right={{ label: "Tallat per", value: item.tallat_per }} />
        <Cell label="Es recolza a" value={item.es_recolza_a} />
        <Cell label="Se li recolza" value={item.se_li_recolza} />
        <Row2 left={{ label: "Talla", value: item.talla }} right={{ label: "Reomplert per", value: item.reomplert_per }} />
        <Row2 left={{ label: "Cobert per", value: item.cobert_per }} right={{ label: "Reomple a", value: item.reomple_a }} />
        <Cell label="Cobreix a" value={item.cobreix_a} />
        <Cell label="Interpretació" value={item.interpretacio} className="min-h-[36px]" />

        {/* DATACIÓ */}
        <SectionHeader title="Datació" />
        <Row2 left={{ label: "Cronologia", value: item.cronologia }} right={{ label: "Criteri", value: item.criteri }} />
        <Cell label="Materials" value={item.materials} />

        {/* DOCUMENTACIÓ & MOSTRES */}
        <div className="grid grid-cols-2">
          <div>
            <SectionHeader title="Documentació" />
            <Cell label="Planta" value={item.planta} />
            <Cell label="Secció" value={item.seccio} />
            <Cell label="Fotografia" value={item.fotografia} />
          </div>
          <div>
            <SectionHeader title="Mostres" />
            <Row2 left={{ label: "Sediment", value: item.sediment }} right={{ label: "Carpologia", value: item.carpologia }} />
            <Row2 left={{ label: "Antracologia", value: item.antracologia }} right={{ label: "Fauna", value: item.fauna }} />
            <Cell label="Metalls" value={item.metalls} />
          </div>
        </div>

        <Cell label="Observacions" value={item.observacions} className="min-h-[36px]" />
      </div>
    </div>
  );
}

function getObjecteFields(item: any) {
  return [
    { label: "ID", value: item.object_id },
    { label: "Jaciment", value: item.jaciments?.name },
    { label: "UE", value: item.ues?.codi_ue },
    { label: "Tipus", value: item.tipus },
    { label: "Data descobriment", value: item.data_descobriment },
    { label: "Data origen", value: item.data_origen },
    { label: "Estació GPS", value: item.estacio_gps },
    { label: "Codi nivell", value: item.codi_nivell },
    { label: "Subunitat", value: item.subunitat },
    { label: "Persona registra", value: item.persona_registra },
    { label: "Mides", value: item.mida_x && item.mida_y ? `${item.mida_x} x ${item.mida_y} cm` : null },
    { label: "Altres números", value: item.altres_nums },
    { label: "Estat conservació", value: item.estat_conservacio ? conservacioLabels[item.estat_conservacio - 1] : null },
  ];
}

function ObjecteCard({ item, onClick }: { item: any; onClick: () => void }) {
  return (
    <div className="border-2 border-border rounded bg-card overflow-hidden">
      <div className="grid grid-cols-[1fr_auto] border-b border-border">
        <div className="px-3 py-2 cursor-pointer" onClick={onClick}>
          <p className="text-sm font-bold font-serif uppercase">Fitxa d'Objecte</p>
          <p className="text-[10px] text-muted-foreground">{item.object_id} — {item.name}</p>
        </div>
        <div className="px-2 py-1 flex items-center gap-1 border-l border-border">
          <Badge variant="outline" className="text-[10px]">{visibilityLabels[item.visibility] || item.visibility}</Badge>
          <div onClick={(e) => e.stopPropagation()}>
            <ExportButtons title={item.name} fields={getObjecteFields(item)} variant="fitxa" type="objecte" />
          </div>
        </div>
      </div>

      <div className="cursor-pointer" onClick={onClick}>
        <SectionHeader title="Dades Identificatives" />
        <Row2 left={{ label: "Jaciment", value: item.jaciments?.name }} right={{ label: "UE", value: item.ues?.codi_ue }} />
        <Row2 left={{ label: "ID Objecte", value: item.object_id }} right={{ label: "Tipus", value: item.tipus }} />
        <Row2 left={{ label: "Data descobriment", value: item.data_descobriment }} right={{ label: "Data origen", value: item.data_origen }} />
        <Row2 left={{ label: "Estació GPS", value: item.estacio_gps }} right={{ label: "Codi nivell", value: item.codi_nivell }} />
        <Row2 left={{ label: "Subunitat", value: item.subunitat }} right={{ label: "Registra", value: item.persona_registra }} />
        <Row2 left={{ label: "Mides", value: item.mida_x && item.mida_y ? `${item.mida_x}x${item.mida_y} cm` : null }} right={{ label: "Conservació", value: item.estat_conservacio ? conservacioLabels[item.estat_conservacio - 1] : null }} />
        <Cell label="Altres números" value={item.altres_nums} />
      </div>
    </div>
  );
}

function getJacimentFields(item: any) {
  return [
    { label: "Nom", value: item.name },
    { label: "Període", value: item.period },
    { label: "Descripció", value: item.description },
    { label: "Entitat", value: item.entity },
    { label: "Coordenades", value: item.latitude && item.longitude ? `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}` : null },
    { label: "Visibilitat", value: visibilityLabels[item.visibility] || item.visibility },
  ];
}

function JacimentCard({ item, onClick }: { item: any; onClick: () => void }) {
  return (
    <div className="border-2 border-border rounded bg-card overflow-hidden">
      <div className="grid grid-cols-[1fr_auto] border-b border-border">
        <div className="px-3 py-2 cursor-pointer" onClick={onClick}>
          <p className="text-sm font-bold font-serif uppercase">Fitxa de Jaciment</p>
          <p className="text-[10px] text-muted-foreground">{item.name}</p>
        </div>
        <div className="px-2 py-1 flex items-center gap-1 border-l border-border">
          <Badge variant="outline" className="text-[10px]">{visibilityLabels[item.visibility] || item.visibility}</Badge>
          <div onClick={(e) => e.stopPropagation()}>
            <ExportButtons title={item.name} fields={getJacimentFields(item)} variant="fitxa" type="jaciment" />
          </div>
        </div>
      </div>

      <div className="cursor-pointer" onClick={onClick}>
        {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover border-b border-border" />}
        <SectionHeader title="Dades Identificatives" />
        <Row2 left={{ label: "Nom", value: item.name }} right={{ label: "Període", value: item.period }} />
        <Cell label="Descripció" value={item.description} className="min-h-[36px]" />
        <Row2 left={{ label: "Entitat", value: item.entity }} right={{ label: "Coordenades", value: item.latitude && item.longitude ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}` : null }} />
      </div>
    </div>
  );
}

export default function ItemCard({ item, type }: ItemCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (type === "objectes") navigate(`/objecte/${item.id}`);
    else if (type === "jaciments") navigate(`/jaciment/${item.id}`);
    else navigate(`/ue/${item.id}`);
  };

  if (type === "ues") return <UECard item={item} onClick={handleClick} />;
  if (type === "objectes") return <ObjecteCard item={item} onClick={handleClick} />;
  return <JacimentCard item={item} onClick={handleClick} />;
}
