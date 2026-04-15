import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (language) => {
    i18n.changeLanguage(language);
    localStorage.setItem("language", language);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-slate-700">{t("language")}:</span>
      <button
        onClick={() => handleLanguageChange("en")}
        className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${
          i18n.language === "en"
            ? "bg-teal-600 text-white"
            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
        }`}
      >
        {t("english")}
      </button>
      <button
        onClick={() => handleLanguageChange("hi")}
        className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${
          i18n.language === "hi"
            ? "bg-teal-600 text-white"
            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
        }`}
      >
        {t("hindi")}
      </button>
    </div>
  );
}
