import { useNavigate } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TutorialPage() {
  const navigate = useNavigate();
  const { t } = useT();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">{t("Guia de funcions")}</h1>
      </header>

      <div className="p-4 max-w-3xl mx-auto prose prose-sm dark:prose-invert animate-fade-in">
        <h2 className="font-serif">{t("tut_title")}</h2>

        <h3>🗂️ {t("tut_data_title")}</h3>
        <ul>
          <li><strong>{t("tut_hierarchy_label")}:</strong> {t("tut_hierarchy")}</li>
          <li>{t("tut_forms")}</li>
          <li>{t("tut_templates")}</li>
          <li>{t("tut_ue_codes")}</li>
          <li><strong>{t("Visibilitat")}:</strong> {t("tut_visibility")}</li>
        </ul>

        <h3>🔍 {t("tut_search_title")}</h3>
        <ul>
          <li>{t("tut_global_search")}</li>
          <li>{t("tut_advanced_filters")}</li>
          <li>{t("tut_interactive_map")}</li>
          <li>{t("tut_qr_codes")}</li>
        </ul>

        <h3>📊 {t("tut_strat_title")}</h3>
        <ul>
          <li>{t("tut_harris")}</li>
          <li>{t("tut_incoherence")}</li>
          <li>{t("tut_autocorrect")}</li>
        </ul>

        <h3>🤖 {t("Assistent IA")}</h3>
        <ul>
          <li>{t("tut_ai_chatbot")}</li>
          <li>{t("tut_ai_languages")}</li>
          <li>{t("tut_ai_create")}</li>
          <li>{t("tut_ai_history")}</li>
        </ul>

        <h3>👥 {t("tut_users_title")}</h3>
        <ul>
          <li>{t("tut_auth")}</li>
          <li><strong>{t("tut_roles_label")}:</strong> {t("tut_roles")}</li>
          <li>{t("tut_directors")}</li>
          <li>{t("tut_profile")}</li>
        </ul>

        <h3>💬 {t("tut_comms_title")}</h3>
        <ul>
          <li>{t("tut_messaging")}</li>
          <li>{t("tut_notifications")}</li>
        </ul>

        <h3>📤 {t("tut_export_title")}</h3>
        <ul>
          <li>{t("tut_export_formats")}</li>
          <li>{t("tut_mass_export")}</li>
        </ul>

        <h3>🌍 {t("tut_i18n_title")}</h3>
        <ul>
          <li>{t("tut_i18n_langs")}</li>
          <li>{t("tut_i18n_selector")}</li>
        </ul>

        <h3>📱 PWA</h3>
        <ul>
          <li>{t("tut_pwa_install")}</li>
          <li>{t("tut_pwa_offline")}</li>
          <li>{t("tut_pwa_camera")}</li>
        </ul>

        <h3>🔧 {t("tut_other_title")}</h3>
        <ul>
          <li>{t("tut_changelog")}</li>
          <li>{t("tut_sketch")}</li>
          <li>{t("tut_install_guide")}</li>
        </ul>
      </div>
    </div>
  );
}
