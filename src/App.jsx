import { useState, useEffect, useMemo, useRef, Component } from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  LayoutDashboard, Building2, Upload, List, SlidersHorizontal,
  Plus, Trash2, ChevronLeft, ChevronRight, Search, X, Check,
  ArrowUpRight, ArrowDownRight, FileText, AlertCircle,
  Wrench, Sun, Moon, Palette, Calculator, ArrowLeftRight, PiggyBank, Percent, RefreshCw,
} from "lucide-react";

/* ---------------------------------- Konstanten ---------------------------------- */

const CATEGORIES = [
  { id: "einkommen", label: "Einkommen", color: "#2ECC87" },
  { id: "wohnen", label: "Wohnen", color: "#F5B942" },
  { id: "lebensmittel", label: "Lebensmittel", color: "#4FA8E8" },
  { id: "transport", label: "Transport", color: "#9B6BE0" },
  { id: "versicherung", label: "Versicherung", color: "#F0699A" },
  { id: "freizeit", label: "Freizeit & Restaurants", color: "#F5A623" },
  { id: "gesundheit", label: "Gesundheit", color: "#3DDC97" },
  { id: "shopping", label: "Shopping", color: "#FF6B6B" },
  { id: "abos", label: "Abos & Telecom", color: "#37C4D0" },
  { id: "sonstiges", label: "Sonstiges", color: "#A0AAB3" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const DEFAULT_RULES = [
  ["lohn", "einkommen"], ["salär", "einkommen"], ["gehalt", "einkommen"], ["salary", "einkommen"],
  ["miete", "wohnen"], ["hypothek", "wohnen"], ["nebenkosten", "wohnen"],
  ["migros", "lebensmittel"], ["coop", "lebensmittel"], ["denner", "lebensmittel"], ["lidl", "lebensmittel"], ["aldi", "lebensmittel"],
  ["sbb", "transport"], ["uber", "transport"], ["tankstelle", "transport"], ["parking", "transport"], ["tcs", "transport"],
  ["versicherung", "versicherung"], ["krankenkasse", "versicherung"], ["axa", "versicherung"], ["mobiliar", "versicherung"], ["css", "versicherung"],
  ["restaurant", "freizeit"], ["netflix", "freizeit"], ["spotify", "freizeit"], ["kino", "freizeit"],
  ["apotheke", "gesundheit"], ["arzt", "gesundheit"], ["zahnarzt", "gesundheit"], ["pharmacie", "gesundheit"],
  ["zalando", "shopping"], ["digitec", "shopping"], ["galaxus", "shopping"], ["amazon", "shopping"],
  ["swisscom", "abos"], ["sunrise", "abos"], ["salt", "abos"],
].map(([keyword, category], i) => ({ id: "r" + i, keyword, category }));

const ACCOUNT_COLORS = ["#4FD1AE", "#D4B96A", "#9B8AE8", "#E8846B", "#7FB3D5", "#E38FB0"];
const MONTHS_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const STORAGE_KEY = "money-cockpit-state";

const THEME_PRESETS = {
  dark: { bg: "#0E1316", panel: "#171E22", panelRaised: "#1E2731", line: "#2B363D", text: "#E9EEF1", textMuted: "#7E8B93", income: "#4FD1AE", expense: "#E8846B", gold: "#D4B96A" },
  light: { bg: "#F3F5F6", panel: "#FFFFFF", panelRaised: "#F0F2F4", line: "#DCE2E6", text: "#1C2428", textMuted: "#63707A", income: "#1E9E70", expense: "#C9503A", gold: "#B8860B" },
};
const CUSTOM_DEFAULTS = { bg: "#14181D", gold: "#D4B96A", income: "#4FD1AE", expense: "#E8846B" };

function hexToRgb(hex) {
  const c = hex.replace("#", "");
  return { r: parseInt(c.substr(0, 2), 16) || 0, g: parseInt(c.substr(2, 2), 16) || 0, b: parseInt(c.substr(4, 2), 16) || 0 };
}
function mixHex(hex, target, amount) {
  const c1 = hexToRgb(hex), c2 = hexToRgb(target);
  const r = Math.round(c1.r + (c2.r - c1.r) * amount);
  const g = Math.round(c1.g + (c2.g - c1.g) * amount);
  const b = Math.round(c1.b + (c2.b - c1.b) * amount);
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");
}
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function buildCustomTheme({ bg, gold, income, expense }) {
  const dark = luminance(bg) < 0.5;
  return {
    bg, gold, income, expense,
    panel: mixHex(bg, dark ? "#ffffff" : "#000000", dark ? 0.06 : 0.03),
    panelRaised: mixHex(bg, dark ? "#ffffff" : "#000000", dark ? 0.11 : 0.06),
    line: mixHex(bg, dark ? "#ffffff" : "#000000", dark ? 0.19 : 0.14),
    text: dark ? "#EDEFF0" : "#1C2428",
    textMuted: dark ? "#8B949C" : "#5B6670",
  };
}

/* ---------------------------------- Helpers ---------------------------------- */

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseAmount(raw) {
  if (typeof raw === "number") return raw;
  let s = String(raw ?? "").trim();
  if (!s) return NaN;
  s = s.replace(/['’\s]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  s = s.replace(/[^0-9.\-+]/g, "");
  return parseFloat(s);
}

function parseDateStr(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return new Date(y, +m[2] - 1, +m[1]);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d) {
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthKey(iso) {
  return iso.slice(0, 7);
}

function categorize(desc, rules) {
  const d = (desc || "").toLowerCase();
  for (const r of rules) {
    if (r.keyword && d.includes(r.keyword.toLowerCase())) return r.category;
  }
  return "sonstiges";
}

function guessColumn(fields, patterns) {
  const lower = fields.map((f) => f.toLowerCase());
  for (const p of patterns) {
    const idx = lower.findIndex((f) => f.includes(p));
    if (idx > -1) return fields[idx];
  }
  return "";
}

function fmtMoney(n, currency) {
  const val = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("de-CH", { style: "currency", currency }).format(val);
  } catch {
    return val.toFixed(2) + " " + currency;
  }
}

/* ---------------------------------- Signature: Flow-Gauge ---------------------------------- */

function FlowGauge({ value }) {
  // value: -100..100 (Sparquote in %)
  const clamped = Math.max(-100, Math.min(100, value || 0));
  const angle = (clamped / 100) * 90; // -90..90 degrees
  const ticks = [-90, -60, -30, 0, 30, 60, 90];
  const cx = 100, cy = 100, r = 78;

  const polar = (deg, radius) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  };
  const arcPath = (startDeg, endDeg, radius) => {
    const [x1, y1] = polar(startDeg, radius);
    const [x2, y2] = polar(endDeg, radius);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };
  const [nx, ny] = polar(angle, r - 14);

  return (
    <svg viewBox="0 0 200 118" width="100%" height="auto" style={{ overflow: "visible" }}>
      <path d={arcPath(-90, 0, r)} stroke="#5B3A34" strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d={arcPath(0, 90, r)} stroke="#2E5C4D" strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.55" />
      {ticks.map((t) => {
        const [x1, y1] = polar(t, r + 9);
        const [x2, y2] = polar(t, r + 1);
        return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D4B96A" strokeWidth="2" opacity="0.8" />;
      })}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#E9EEF1" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="#D4B96A" />
    </svg>
  );
}

function DeltaBadge({ current, previous, invert = false }) {
  if (previous === 0 && current === 0) return <span className="delta-badge neutral mono">–</span>;
  const delta = current - previous;
  const pct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : 100;
  const isUp = delta > 0;
  const isGood = invert ? !isUp : isUp;
  if (Math.abs(delta) < 0.005) return <span className="delta-badge neutral mono">±0%</span>;
  return (
    <span className={"delta-badge mono " + (isGood ? "good" : "bad")}>
      {isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/* ---------------------------------- Root Component ---------------------------------- */

function MoneyCockpitInner() {
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [view, setView] = useState("cockpit");
  const [accounts, setAccounts] = useState([]);
  const [txByAccount, setTxByAccount] = useState({});
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [currency, setCurrency] = useState("CHF");
  const [themeMode, setThemeMode] = useState("dark"); // "dark" | "light" | "custom"
  const [customColors, setCustomColors] = useState(CUSTOM_DEFAULTS);
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(toISO(new Date())));
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [periodMode, setPeriodMode] = useState("month"); // "month" | "year"
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setAccounts(parsed.accounts || []);
          setTxByAccount(parsed.txByAccount || {});
          setRules(parsed.rules && parsed.rules.length ? parsed.rules : DEFAULT_RULES);
          setCurrency(parsed.currency || "CHF");
          setThemeMode(parsed.themeMode || "dark");
          setCustomColors(parsed.customColors || CUSTOM_DEFAULTS);
        }
      } catch (e) {
        // kein bestehender Datensatz - Start mit leerem Zustand
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const result = await window.storage.set(
          STORAGE_KEY,
          JSON.stringify({ accounts, txByAccount, rules, currency, themeMode, customColors }),
          false
        );
        setSaveError(!result);
      } catch (e) {
        setSaveError(true);
      }
    })();
  }, [accounts, txByAccount, rules, currency, themeMode, customColors, loaded]);

  const allTx = useMemo(() => {
    const out = [];
    for (const acc of accounts) {
      for (const t of txByAccount[acc.id] || []) {
        if (t && typeof t.date === "string" && t.date.length >= 7 && Number.isFinite(t.amount)) {
          out.push(t);
        }
      }
    }
    return out;
  }, [accounts, txByAccount]);

  const accountBalances = useMemo(() => {
    const map = {};
    for (const acc of accounts) {
      const sum = (txByAccount[acc.id] || []).reduce((s, t) => s + t.amount, 0);
      map[acc.id] = acc.startingBalance + sum;
    }
    return map;
  }, [accounts, txByAccount]);

  const totalBalance = useMemo(
    () => Object.values(accountBalances).reduce((s, v) => s + v, 0),
    [accountBalances]
  );

  // Aktuelle Periode (Monat oder Jahr) + Vorjahres-Vergleichsperiode
  const currentPeriodTx = useMemo(() => {
    if (periodMode === "year") return allTx.filter((t) => t.date.slice(0, 4) === String(selectedYear));
    return allTx.filter((t) => monthKey(t.date) === selectedMonth);
  }, [allTx, periodMode, selectedYear, selectedMonth]);

  const comparisonPeriodTx = useMemo(() => {
    if (periodMode === "year") return allTx.filter((t) => t.date.slice(0, 4) === String(selectedYear - 1));
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevKey = monthKey(toISO(new Date(y - 1, m - 1, 1)));
    return allTx.filter((t) => monthKey(t.date) === prevKey);
  }, [allTx, periodMode, selectedYear, selectedMonth]);

  function sumIncome(txs) { return txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0); }
  function sumExpense(txs) { return Math.abs(txs.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)); }

  const income = useMemo(() => sumIncome(currentPeriodTx), [currentPeriodTx]);
  const expense = useMemo(() => sumExpense(currentPeriodTx), [currentPeriodTx]);
  const prevIncome = useMemo(() => sumIncome(comparisonPeriodTx), [comparisonPeriodTx]);
  const prevExpense = useMemo(() => sumExpense(comparisonPeriodTx), [comparisonPeriodTx]);
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : expense > 0 ? -100 : 0;

  const categoryBreakdown = useMemo(() => {
    const sums = {};
    for (const t of currentPeriodTx) {
      if (t.amount >= 0) continue;
      sums[t.category] = (sums[t.category] || 0) + Math.abs(t.amount);
    }
    return Object.entries(sums)
      .map(([id, value]) => ({ id, value, label: CAT_MAP[id]?.label || id, color: CAT_MAP[id]?.color || "#8A97A0" }))
      .sort((a, b) => b.value - a.value);
  }, [currentPeriodTx]);

  // Kategoriensummen: laufende Periode vs. Vorjahresperiode, für alle Kategorien inkl. Einkommen
  const categoryComparison = useMemo(() => {
    const cur = {}, prev = {};
    for (const t of currentPeriodTx) {
      const v = t.amount >= 0 ? t.amount : Math.abs(t.amount);
      cur[t.category] = (cur[t.category] || 0) + v;
    }
    for (const t of comparisonPeriodTx) {
      const v = t.amount >= 0 ? t.amount : Math.abs(t.amount);
      prev[t.category] = (prev[t.category] || 0) + v;
    }
    return CATEGORIES
      .map((c) => ({ id: c.id, label: c.label, color: c.color, current: cur[c.id] || 0, previous: prev[c.id] || 0 }))
      .filter((c) => c.current !== 0 || c.previous !== 0)
      .sort((a, b) => b.current - a.current);
  }, [currentPeriodTx, comparisonPeriodTx]);

  const trendData = useMemo(() => {
    const out = [];
    if (periodMode === "year") {
      for (let mIdx = 0; mIdx < 12; mIdx++) {
        const curKey = `${selectedYear}-${String(mIdx + 1).padStart(2, "0")}`;
        const prevKey = `${selectedYear - 1}-${String(mIdx + 1).padStart(2, "0")}`;
        const curTxs = allTx.filter((t) => monthKey(t.date) === curKey);
        const prevTxs = allTx.filter((t) => monthKey(t.date) === prevKey);
        out.push({
          month: MONTHS_DE[mIdx],
          Einnahmen: sumIncome(curTxs),
          Ausgaben: sumExpense(curTxs),
          "Einnahmen Vj": sumIncome(prevTxs),
          "Ausgaben Vj": sumExpense(prevTxs),
        });
      }
    } else {
      const [y, m] = selectedMonth.split("-").map(Number);
      for (let i = 5; i >= 0; i--) {
        const d = new Date(y, m - 1 - i, 1);
        const key = monthKey(toISO(d));
        const txs = allTx.filter((t) => monthKey(t.date) === key);
        out.push({ month: MONTHS_DE[d.getMonth()] + " " + String(d.getFullYear()).slice(2), Einnahmen: sumIncome(txs), Ausgaben: sumExpense(txs) });
      }
    }
    return out;
  }, [allTx, periodMode, selectedYear, selectedMonth]);

  // Prognose für das laufende Jahr, auf Basis der bisher erfassten Monate
  const isCurrentYear = periodMode === "year" && selectedYear === new Date().getFullYear();
  const forecast = useMemo(() => {
    if (!isCurrentYear) return null;
    const monthsWithData = new Set(
      currentPeriodTx.map((t) => Number(t.date.slice(5, 7)))
    ).size;
    if (monthsWithData === 0) return null;
    const factor = 12 / monthsWithData;
    const projIncome = income * factor;
    const projExpense = expense * factor;
    return {
      monthsWithData,
      projIncome,
      projExpense,
      projNet: projIncome - projExpense,
      projRate: projIncome > 0 ? ((projIncome - projExpense) / projIncome) * 100 : projExpense > 0 ? -100 : 0,
    };
  }, [isCurrentYear, currentPeriodTx, income, expense]);

  function shiftPeriod(delta) {
    if (periodMode === "year") { setSelectedYear((y) => y + delta); return; }
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(monthKey(toISO(d)));
  }

  // Mehrjahresbetrachtung: alle Jahre, für die Daten vorliegen
  const yearsAvailable = useMemo(() => {
    const set = new Set(allTx.map((t) => Number(t.date.slice(0, 4))));
    if (set.size === 0) set.add(new Date().getFullYear());
    return [...set].sort((a, b) => a - b);
  }, [allTx]);

  const yearlySummary = useMemo(() => {
    return yearsAvailable.map((yr) => {
      const txs = allTx.filter((t) => Number(t.date.slice(0, 4)) === yr);
      const inc = sumIncome(txs);
      const exp = sumExpense(txs);
      return {
        year: yr,
        income: inc,
        expense: exp,
        net: inc - exp,
        rate: inc > 0 ? ((inc - exp) / inc) * 100 : exp > 0 ? -100 : 0,
      };
    });
  }, [yearsAvailable, allTx]);

  const categoryByYear = useMemo(() => {
    const table = {};
    for (const c of CATEGORIES) table[c.id] = { label: c.label, color: c.color, byYear: {} };
    for (const t of allTx) {
      const yr = Number(t.date.slice(0, 4));
      const v = t.amount >= 0 ? t.amount : Math.abs(t.amount);
      if (!table[t.category]) continue;
      table[t.category].byYear[yr] = (table[t.category].byYear[yr] || 0) + v;
    }
    return Object.entries(table)
      .map(([id, v]) => ({ id, ...v }))
      .filter((c) => Object.values(c.byYear).some((v) => v !== 0));
  }, [allTx]);

  function addAccount(acc) {
    setAccounts((prev) => [...prev, { ...acc, id: uid(), color: ACCOUNT_COLORS[prev.length % ACCOUNT_COLORS.length] }]);
  }
  function deleteAccount(id) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setTxByAccount((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }
  function importTransactions(accountId, newTxs) {
    setTxByAccount((prev) => {
      const existing = prev[accountId] || [];
      const seen = new Set(existing.map((t) => `${t.date}|${t.amount}|${t.description}`));
      const additions = newTxs.filter((t) => !seen.has(`${t.date}|${t.amount}|${t.description}`));
      return { ...prev, [accountId]: [...existing, ...additions] };
    });
    if (newTxs.length > 0) {
      const maxDate = newTxs.reduce((max, t) => (t.date > max ? t.date : max), newTxs[0].date);
      setSelectedMonth(monthKey(maxDate));
      setSelectedYear(Number(maxDate.slice(0, 4)));
    }
  }
  function jumpToLatestData() {
    if (allTx.length === 0) return;
    const maxDate = allTx.reduce((max, t) => (t.date > max ? t.date : max), allTx[0].date);
    setSelectedMonth(monthKey(maxDate));
    setSelectedYear(Number(maxDate.slice(0, 4)));
  }
  function updateTxCategory(accountId, txId, category) {
    setTxByAccount((prev) => ({
      ...prev,
      [accountId]: (prev[accountId] || []).map((t) => (t.id === txId ? { ...t, category } : t)),
    }));
  }
  function deleteTx(accountId, txId) {
    setTxByAccount((prev) => ({
      ...prev,
      [accountId]: (prev[accountId] || []).filter((t) => t.id !== txId),
    }));
  }
  function addRule(rule) {
    setRules((prev) => [...prev, { ...rule, id: uid() }]);
  }
  function deleteRule(id) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }
  async function resetAll() {
    setAccounts([]);
    setTxByAccount({});
    setRules(DEFAULT_RULES);
    try {
      await window.storage.delete(STORAGE_KEY, false);
    } catch {}
  }

  const activeTheme = useMemo(() => {
    if (themeMode === "light") return THEME_PRESETS.light;
    if (themeMode === "custom") return buildCustomTheme(customColors);
    return THEME_PRESETS.dark;
  }, [themeMode, customColors]);

  const rootStyle = {
    "--bg": activeTheme.bg,
    "--panel": activeTheme.panel,
    "--panel-raised": activeTheme.panelRaised,
    "--line": activeTheme.line,
    "--text": activeTheme.text,
    "--text-muted": activeTheme.textMuted,
    "--income": activeTheme.income,
    "--expense": activeTheme.expense,
    "--gold": activeTheme.gold,
  };

  const NAV = [
    { id: "cockpit", label: "Cockpit", icon: LayoutDashboard },
    { id: "accounts", label: "Konten", icon: Building2 },
    { id: "import", label: "Import", icon: Upload },
    { id: "transactions", label: "Transaktionen", icon: List },
    { id: "rules", label: "Regeln", icon: SlidersHorizontal },
    { id: "tools", label: "Werkzeuge", icon: Wrench },
  ];

  return (
    <div className="cockpit-root" style={rootStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;600&display=swap');

        .cockpit-root {
          --bg: #0E1316;
          --panel: #171E22;
          --panel-raised: #1E2731;
          --line: #2B363D;
          --text: #E9EEF1;
          --text-muted: #7E8B93;
          --income: #4FD1AE;
          --expense: #E8846B;
          --gold: #D4B96A;
          font-family: 'Roboto', sans-serif;
          background: radial-gradient(ellipse at top, #141B1F 0%, var(--bg) 60%);
          color: var(--text);
          min-height: 100vh;
          padding: 20px 16px 60px;
        }
        .mono { font-family: 'Roboto Mono', monospace; }
        .cockpit-header {
          display: flex; align-items: center; justify-content: space-between;
          max-width: 1180px; margin: 0 auto 20px; flex-wrap: wrap; gap: 12px;
        }
        .cockpit-title { font-size: 22px; font-weight: 700; letter-spacing: 0.3px; }
        .cockpit-title span { color: var(--gold); }
        .header-balance { text-align: right; }
        .header-balance .label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
        .header-balance .value { font-size: 26px; font-weight: 600; }

        .nav-bar {
          max-width: 1180px; margin: 0 auto 20px; display: flex; gap: 6px;
          background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 5px;
          overflow-x: auto;
        }
        .theme-switch { display: flex; gap: 3px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 3px; }
        .theme-switch button { background: transparent; border: none; color: var(--text-muted); padding: 6px 8px; border-radius: 6px; cursor: pointer; display: flex; }
        .theme-switch button.active { background: var(--panel-raised); color: var(--gold); box-shadow: inset 0 0 0 1px var(--line); }
        .nav-btn {
          display: flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: 8px;
          background: transparent; border: none; color: var(--text-muted); font-family: inherit;
          font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: all .15s;
        }
        .nav-btn:hover { color: var(--text); background: rgba(255,255,255,0.03); }
        .nav-btn.active { background: var(--panel-raised); color: var(--gold); box-shadow: inset 0 0 0 1px var(--line); }

        .content { max-width: 1180px; margin: 0 auto; }

        .panel {
          background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
          padding: 18px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
        }
        .panel-title {
          font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; color: var(--text-muted);
          margin-bottom: 14px; font-weight: 600;
        }

        .gauge-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
        @media (max-width: 860px) { .gauge-row { grid-template-columns: repeat(2, 1fr); } }
        .gauge-card { display: flex; flex-direction: column; gap: 4px; }
        .gauge-value { font-size: 24px; font-weight: 600; }
        .gauge-value.pos { color: var(--income); }
        .gauge-value.neg { color: var(--expense); }
        .gauge-sub { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }

        .two-col { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; margin-bottom: 16px; }
        @media (max-width: 860px) { .two-col { grid-template-columns: 1fr; } }

        .month-selector { display: flex; align-items: center; gap: 10px; }
        .month-selector button { background: var(--panel-raised); border: 1px solid var(--line); border-radius: 6px; color: var(--text); cursor: pointer; padding: 4px 8px; }
        .month-label { font-family: 'Roboto Mono', monospace; font-size: 13px; min-width: 90px; text-align: center; }

        .period-toggle { display: flex; gap: 4px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 3px; }
        .period-toggle button { background: transparent; border: none; color: var(--text-muted); font-family: inherit; font-size: 12px; font-weight: 500; padding: 6px 14px; border-radius: 6px; cursor: pointer; }
        .period-toggle button.active { background: var(--panel-raised); color: var(--gold); box-shadow: inset 0 0 0 1px var(--line); }

        .delta-badge { display: inline-flex; align-items: center; gap: 2px; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 6px; }
        .delta-badge.good { color: var(--income); background: rgba(79,209,174,0.12); }
        .delta-badge.bad { color: var(--expense); background: rgba(232,132,107,0.12); }
        .delta-badge.neutral { color: var(--text-muted); background: rgba(255,255,255,0.04); }

        .cat-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
        .cat-row:last-child { border-bottom: none; }
        .cat-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .cat-row .fill { flex: 1; color: var(--text-muted); }
        .cat-row .amt { font-family: 'Roboto Mono', monospace; }

        .accounts-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .account-card { border-left: 3px solid var(--gold); padding-left: 12px; }
        .account-card .name { font-weight: 600; font-size: 14px; }
        .account-card .bank { font-size: 11px; color: var(--text-muted); margin-bottom: 6px; }
        .account-card .bal { font-family: 'Roboto Mono', monospace; font-size: 18px; }

        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; color: var(--text-muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; padding: 8px 10px; border-bottom: 1px solid var(--line); }
        td { padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        .amt-cell { font-family: 'Roboto Mono', monospace; text-align: right; }
        .amt-cell.pos { color: var(--income); }
        .amt-cell.neg { color: var(--expense); }

        .chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 100px; font-size: 11px; font-weight: 500; }

        select, input[type=text], input[type=number], input[type=date] {
          background: var(--panel-raised); border: 1px solid var(--line); color: var(--text);
          border-radius: 7px; padding: 8px 10px; font-family: inherit; font-size: 13px; outline: none;
        }
        select:focus, input:focus { border-color: var(--gold); }
        label.field-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; display: block; }

        .btn { background: var(--panel-raised); border: 1px solid var(--line); color: var(--text); border-radius: 8px; padding: 9px 15px; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
        .btn:hover { border-color: var(--gold); color: var(--gold); }
        .btn-primary { background: var(--gold); color: #14181A; border-color: var(--gold); font-weight: 600; }
        .btn-primary:hover { opacity: 0.9; color: #14181A; }
        .btn-danger:hover { border-color: var(--expense); color: var(--expense); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .empty-state { text-align: center; padding: 50px 20px; color: var(--text-muted); }
        .empty-state svg { margin-bottom: 10px; opacity: 0.5; }

        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 14px; }
        .steps { display: flex; gap: 8px; margin-bottom: 18px; }
        .step-dot { flex: 1; height: 3px; background: var(--line); border-radius: 2px; }
        .step-dot.active { background: var(--gold); }

        .toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; align-items: center; }
        .search-box { display: flex; align-items: center; gap: 6px; background: var(--panel-raised); border: 1px solid var(--line); border-radius: 7px; padding: 6px 10px; flex: 1; min-width: 160px; }
        .search-box input { background: transparent; border: none; padding: 2px; flex: 1; }
        .tools-grid { }
        @media (max-width: 860px) { .tools-grid { grid-template-columns: 1fr !important; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="cockpit-header">
        <div className="cockpit-title">Vermögens<span>-Cockpit</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div className="theme-switch">
            <button title="Dunkel" className={themeMode === "dark" ? "active" : ""} onClick={() => setThemeMode("dark")}><Moon size={14} /></button>
            <button title="Hell" className={themeMode === "light" ? "active" : ""} onClick={() => setThemeMode("light")}><Sun size={14} /></button>
            <button title="Benutzerdefiniert" className={themeMode === "custom" ? "active" : ""} onClick={() => setThemeMode("custom")}><Palette size={14} /></button>
          </div>
          <div className="header-balance">
            <div className="label">Gesamtvermögen</div>
            <div className="value mono">{fmtMoney(totalBalance, currency)}</div>
          </div>
        </div>
      </div>

      {themeMode === "custom" && (
        <div className="content" style={{ marginBottom: 16 }}>
          <div className="panel" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>Eigene Farben</span>
            {[
              ["Hintergrund", "bg"],
              ["Akzent", "gold"],
              ["Einnahmen", "income"],
              ["Ausgaben", "expense"],
            ].map(([label, key]) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                {label}
                <input
                  type="color"
                  value={customColors[key]}
                  onChange={(e) => setCustomColors((prev) => ({ ...prev, [key]: e.target.value }))}
                  style={{ width: 32, height: 24, padding: 0, border: "1px solid var(--line)", borderRadius: 4, background: "transparent", cursor: "pointer" }}
                />
              </label>
            ))}
            <button className="btn" onClick={() => setCustomColors(CUSTOM_DEFAULTS)}>Zurücksetzen</button>
          </div>
        </div>
      )}

      <div className="nav-bar">
        {NAV.map((n) => (
          <button key={n.id} className={"nav-btn" + (view === n.id ? " active" : "")} onClick={() => setView(n.id)}>
            <n.icon size={15} /> {n.label}
          </button>
        ))}
      </div>

      <div className="content">
        {!loaded ? (
          <div className="empty-state">Lade Daten…</div>
        ) : (
          <>
            {saveError && (
              <div className="panel" style={{ marginBottom: 14, borderColor: "#7A4A3E", display: "flex", gap: 8, alignItems: "center" }}>
                <AlertCircle size={16} color="var(--expense)" />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Speichern ist fehlgeschlagen. Änderungen bleiben nur für diese Sitzung erhalten.</span>
              </div>
            )}

            {view === "cockpit" && (
              <CockpitTab
                accounts={accounts}
                accountBalances={accountBalances}
                income={income}
                expense={expense}
                prevIncome={prevIncome}
                prevExpense={prevExpense}
                savingsRate={savingsRate}
                categoryBreakdown={categoryBreakdown}
                categoryComparison={categoryComparison}
                trendData={trendData}
                forecast={forecast}
                isCurrentYear={isCurrentYear}
                yearsAvailable={yearsAvailable}
                yearlySummary={yearlySummary}
                categoryByYear={categoryByYear}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                periodMode={periodMode}
                setPeriodMode={setPeriodMode}
                shiftPeriod={shiftPeriod}
                currency={currency}
                hasAnyData={allTx.length > 0}
                jumpToLatestData={jumpToLatestData}
              />
            )}
            {view === "accounts" && (
              <AccountsTab
                accounts={accounts}
                accountBalances={accountBalances}
                currency={currency}
                onAdd={addAccount}
                onDelete={deleteAccount}
              />
            )}
            {view === "import" && (
              <ImportTab accounts={accounts} rules={rules} onImport={importTransactions} onAddAccount={addAccount} />
            )}
            {view === "transactions" && (
              <TransactionsTab
                accounts={accounts}
                txByAccount={txByAccount}
                currency={currency}
                onUpdateCategory={updateTxCategory}
                onDelete={deleteTx}
              />
            )}
            {view === "rules" && <RulesTab rules={rules} onAdd={addRule} onDelete={deleteRule} />}
            {view === "tools" && <ToolsTab defaultCurrency={currency} />}

            <div style={{ textAlign: "center", marginTop: 30 }}>
              {confirmReset ? (
                <div style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Wirklich alle Daten unwiderruflich löschen?</span>
                  <button className="btn btn-danger" onClick={() => { resetAll(); setConfirmReset(false); }}>Ja, alles löschen</button>
                  <button className="btn" onClick={() => setConfirmReset(false)}>Abbrechen</button>
                </div>
              ) : (
                <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
                  <Trash2 size={13} /> Alle Daten zurücksetzen
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Cockpit Tab ---------------------------------- */

function CockpitTab({
  accounts, accountBalances, income, expense, prevIncome, prevExpense, savingsRate,
  categoryBreakdown, categoryComparison, trendData, forecast, isCurrentYear,
  yearsAvailable, yearlySummary, categoryByYear, selectedMonth, selectedYear,
  periodMode, setPeriodMode, shiftPeriod, currency, hasAnyData, jumpToLatestData,
}) {
  const [y, m] = selectedMonth.split("-").map(Number);
  const monthLabel = `${MONTHS_DE[m - 1]} ${y}`;
  const periodLabel = periodMode === "year" ? String(selectedYear) : monthLabel;
  const comparisonLabel = periodMode === "year" ? String(selectedYear - 1) : `${MONTHS_DE[m - 1]} ${y - 1}`;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <div className="period-toggle">
          <button className={periodMode === "month" ? "active" : ""} onClick={() => setPeriodMode("month")}>Monat</button>
          <button className={periodMode === "year" ? "active" : ""} onClick={() => setPeriodMode("year")}>Jahr</button>
          <button className={periodMode === "multi" ? "active" : ""} onClick={() => setPeriodMode("multi")}>Mehrjahre</button>
        </div>
        {periodMode !== "multi" && (
          <div className="month-selector">
            <button onClick={() => shiftPeriod(-1)}><ChevronLeft size={15} /></button>
            <span className="month-label">{periodLabel}</span>
            <button onClick={() => shiftPeriod(1)}><ChevronRight size={15} /></button>
          </div>
        )}
      </div>

      {periodMode === "multi" ? (
        <MultiYearView
          accounts={accounts}
          accountBalances={accountBalances}
          yearsAvailable={yearsAvailable}
          yearlySummary={yearlySummary}
          categoryByYear={categoryByYear}
          currency={currency}
        />
      ) : (
      <>
      {hasAnyData && income === 0 && expense === 0 && categoryBreakdown.length === 0 && (
        <div className="panel" style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Für {periodLabel} liegen keine Transaktionen vor — du hast aber bereits importierte Daten in anderen Zeiträumen.
          </span>
          <button className="btn btn-primary" onClick={jumpToLatestData}>Zum neuesten Datensatz springen</button>
        </div>
      )}

      <div className="gauge-row">
        <div className="panel gauge-card">
          <div className="panel-title">Einnahmen</div>
          <div className="gauge-value pos mono">{fmtMoney(income, currency)}</div>
          <div className="gauge-sub">
            <DeltaBadge current={income} previous={prevIncome} /> vs. {comparisonLabel}
          </div>
        </div>
        <div className="panel gauge-card">
          <div className="panel-title">Ausgaben</div>
          <div className="gauge-value neg mono">{fmtMoney(expense, currency)}</div>
          <div className="gauge-sub">
            <DeltaBadge current={expense} previous={prevExpense} invert /> vs. {comparisonLabel}
          </div>
        </div>
        <div className="panel gauge-card">
          <div className="panel-title">Netto-Flow</div>
          <div className={"gauge-value mono " + (income - expense >= 0 ? "pos" : "neg")}>{fmtMoney(income - expense, currency)}</div>
          <div className="gauge-sub">
            <DeltaBadge current={income - expense} previous={prevIncome - prevExpense} /> vs. {comparisonLabel}
          </div>
        </div>
        <div className="panel gauge-card" style={{ alignItems: "center" }}>
          <div className="panel-title" style={{ alignSelf: "flex-start" }}>Sparquote</div>
          <FlowGauge value={savingsRate} />
          <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: -6 }}>{savingsRate.toFixed(0)}%</div>
        </div>
      </div>

      <div className="accounts-strip">
        {accounts.length === 0 && (
          <div className="panel empty-state" style={{ gridColumn: "1/-1" }}>
            <Building2 size={28} />
            <div>Noch keine Konten angelegt. Lege im Tab „Konten" dein erstes Konto an.</div>
          </div>
        )}
        {accounts.map((a) => (
          <div className="panel account-card" key={a.id} style={{ borderLeftColor: a.color }}>
            <div className="name">{a.name}</div>
            <div className="bank">{a.bank}</div>
            <div className="bal mono">{fmtMoney(accountBalances[a.id] || 0, currency)}</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Ausgaben nach Kategorie</div>
          {categoryBreakdown.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>Keine Ausgaben in diesem Monat.</div>
          ) : (
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 150, height: 150, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryBreakdown} dataKey="value" nameKey="label" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {categoryBreakdown.map((c) => <Cell key={c.id} fill={c.color} stroke="var(--panel)" strokeWidth={2} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1E2731", border: "1px solid #2B363D", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(v, currency)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                {categoryBreakdown.map((c) => (
                  <div className="cat-row" key={c.id}>
                    <span className="cat-dot" style={{ background: c.color }} />
                    <span className="fill">{c.label}</span>
                    <span className="amt">{fmtMoney(c.value, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            {periodMode === "year" ? `Verlauf ${selectedYear} vs. ${selectedYear - 1}` : "Verlauf (letzte 6 Monate)"}
          </div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              {periodMode === "year" ? (
                <ComposedChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2B363D" vertical={false} />
                  <XAxis dataKey="month" stroke="#7E8B93" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#7E8B93" fontSize={11} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={{ background: "#1E2731", border: "1px solid #2B363D", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(v, currency)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Einnahmen" fill="#4FD1AE" radius={[3, 3, 0, 0]} barSize={14} />
                  <Bar dataKey="Ausgaben" fill="#E8846B" radius={[3, 3, 0, 0]} barSize={14} />
                  <Line type="monotone" dataKey="Einnahmen Vj" stroke="#4FD1AE" strokeWidth={2} strokeDasharray="4 3" dot={false} opacity={0.6} />
                  <Line type="monotone" dataKey="Ausgaben Vj" stroke="#E8846B" strokeWidth={2} strokeDasharray="4 3" dot={false} opacity={0.6} />
                </ComposedChart>
              ) : (
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2B363D" vertical={false} />
                  <XAxis dataKey="month" stroke="#7E8B93" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#7E8B93" fontSize={11} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={{ background: "#1E2731", border: "1px solid #2B363D", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(v, currency)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Einnahmen" fill="#4FD1AE" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Ausgaben" fill="#E8846B" radius={[3, 3, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {periodMode === "year" && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              Durchgezogene Balken = {selectedYear} · gestrichelte Linien = {selectedYear - 1}
            </div>
          )}
        </div>
      </div>

      {forecast && (
        <div className="panel" style={{ marginBottom: 16, borderColor: "var(--gold)" }}>
          <div className="panel-title">Prognose Jahresende {selectedYear} <span style={{ color: "var(--text-muted)", textTransform: "none", letterSpacing: 0 }}>— Hochrechnung auf Basis von {forecast.monthsWithData} {forecast.monthsWithData === 1 ? "Monat" : "Monaten"}</span></div>
          <div className="gauge-row" style={{ marginBottom: 0 }}>
            <div className="gauge-card">
              <div className="panel-title">Einnahmen (Ist / Prognose)</div>
              <div className="gauge-value mono" style={{ fontSize: 15, color: "var(--text-muted)" }}>{fmtMoney(income, currency)}</div>
              <div className="gauge-value pos mono">{fmtMoney(forecast.projIncome, currency)}</div>
              <div className="gauge-sub"><DeltaBadge current={forecast.projIncome} previous={prevIncome} /> vs. {selectedYear - 1}</div>
            </div>
            <div className="gauge-card">
              <div className="panel-title">Ausgaben (Ist / Prognose)</div>
              <div className="gauge-value mono" style={{ fontSize: 15, color: "var(--text-muted)" }}>{fmtMoney(expense, currency)}</div>
              <div className="gauge-value neg mono">{fmtMoney(forecast.projExpense, currency)}</div>
              <div className="gauge-sub"><DeltaBadge current={forecast.projExpense} previous={prevExpense} invert /> vs. {selectedYear - 1}</div>
            </div>
            <div className="gauge-card">
              <div className="panel-title">Rendite / Netto-Ergebnis</div>
              <div className={"gauge-value mono " + (forecast.projNet >= 0 ? "pos" : "neg")}>{fmtMoney(forecast.projNet, currency)}</div>
              <div className="gauge-sub"><DeltaBadge current={forecast.projNet} previous={prevIncome - prevExpense} /> vs. {selectedYear - 1}</div>
            </div>
            <div className="gauge-card" style={{ alignItems: "center" }}>
              <div className="panel-title" style={{ alignSelf: "flex-start" }}>Prognostizierte Sparquote</div>
              <FlowGauge value={forecast.projRate} />
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: -6 }}>{forecast.projRate.toFixed(0)}%</div>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">Kategoriensummen — {periodLabel} vs. {comparisonLabel}</div>
        {categoryComparison.length === 0 ? (
          <div className="empty-state" style={{ padding: 20 }}>Für diese Periode liegen noch keine Daten vor.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Kategorie</th>
                <th style={{ textAlign: "right" }}>{periodLabel}</th>
                <th style={{ textAlign: "right" }}>{comparisonLabel}</th>
                <th style={{ textAlign: "right" }}>Veränderung</th>
              </tr>
            </thead>
            <tbody>
              {categoryComparison.map((c) => (
                <tr key={c.id}>
                  <td><span className="cat-dot" style={{ background: c.color, marginRight: 8, display: "inline-block" }} />{c.label}</td>
                  <td className="amt-cell">{fmtMoney(c.current, currency)}</td>
                  <td className="amt-cell" style={{ color: "var(--text-muted)" }}>{fmtMoney(c.previous, currency)}</td>
                  <td className="amt-cell"><DeltaBadge current={c.current} previous={c.previous} invert={c.id !== "einkommen"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}
    </>
  );
}

/* ---------------------------------- Multi-Year View ---------------------------------- */

function MultiYearView({ accountBalances, yearsAvailable, yearlySummary, categoryByYear, currency }) {
  const chartData = yearlySummary.map((y) => ({ year: String(y.year), Einnahmen: y.income, Ausgaben: y.expense, Netto: y.net }));
  const totalBalance = Object.values(accountBalances).reduce((s, v) => s + v, 0);

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-title">Verlauf über alle Jahre ({yearsAvailable[0]}–{yearsAvailable[yearsAvailable.length - 1]})</div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2B363D" vertical={false} />
              <XAxis dataKey="year" stroke="#7E8B93" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#7E8B93" fontSize={11} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={{ background: "#1E2731", border: "1px solid #2B363D", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(v, currency)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Einnahmen" fill="#4FD1AE" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Ausgaben" fill="#E8846B" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Netto" fill="#D4B96A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-title">Jahresübersicht</div>
        <table>
          <thead>
            <tr>
              <th>Jahr</th>
              <th style={{ textAlign: "right" }}>Einnahmen</th>
              <th style={{ textAlign: "right" }}>Ausgaben</th>
              <th style={{ textAlign: "right" }}>Netto</th>
              <th style={{ textAlign: "right" }}>Sparquote</th>
              <th style={{ textAlign: "right" }}>Netto ggü. Vorjahr</th>
            </tr>
          </thead>
          <tbody>
            {yearlySummary.map((y, i) => (
              <tr key={y.year}>
                <td className="mono">{y.year}</td>
                <td className="amt-cell pos">{fmtMoney(y.income, currency)}</td>
                <td className="amt-cell neg">{fmtMoney(y.expense, currency)}</td>
                <td className={"amt-cell " + (y.net >= 0 ? "pos" : "neg")}>{fmtMoney(y.net, currency)}</td>
                <td className="amt-cell">{y.rate.toFixed(0)}%</td>
                <td className="amt-cell">
                  {i === 0 ? <span className="delta-badge neutral mono">–</span> : <DeltaBadge current={y.net} previous={yearlySummary[i - 1].net} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-title">Kategoriensummen pro Jahr</div>
        {categoryByYear.length === 0 ? (
          <div className="empty-state" style={{ padding: 20 }}>Noch keine kategorisierten Daten vorhanden.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Kategorie</th>
                  {yearsAvailable.map((yr) => <th key={yr} style={{ textAlign: "right" }}>{yr}</th>)}
                </tr>
              </thead>
              <tbody>
                {categoryByYear.map((c) => (
                  <tr key={c.id}>
                    <td><span className="cat-dot" style={{ background: c.color, marginRight: 8, display: "inline-block" }} />{c.label}</td>
                    {yearsAvailable.map((yr) => (
                      <td key={yr} className="amt-cell">{c.byYear[yr] ? fmtMoney(c.byYear[yr], currency) : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------------------------- Accounts Tab ---------------------------------- */

function AccountsTab({ accounts, accountBalances, currency, onAdd, onDelete }) {
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  function submit() {
    if (!name.trim() || !bank.trim()) return;
    onAdd({ name: name.trim(), bank: bank.trim(), startingBalance: parseFloat(startingBalance) || 0 });
    setName(""); setBank(""); setStartingBalance("");
  }

  return (
    <div className="panel">
      <div className="panel-title">Neues Konto anlegen</div>
      <div className="form-grid">
        <div>
          <label className="field-label">Kontoname</label>
          <input type="text" placeholder="z. B. Privatkonto" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <label className="field-label">Bank</label>
          <input type="text" placeholder="z. B. UBS, PostFinance" value={bank} onChange={(e) => setBank(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <label className="field-label">Startsaldo</label>
          <input type="number" placeholder="0.00" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} style={{ width: "100%" }} />
        </div>
      </div>
      <button className="btn btn-primary" onClick={submit}><Plus size={14} /> Konto hinzufügen</button>

      <div className="panel-title" style={{ marginTop: 26 }}>Deine Konten</div>
      {accounts.length === 0 ? (
        <div className="empty-state" style={{ padding: 20 }}>Noch keine Konten vorhanden.</div>
      ) : (
        <table>
          <thead><tr><th>Konto</th><th>Bank</th><th style={{ textAlign: "right" }}>Saldo</th><th></th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td><span className="cat-dot" style={{ background: a.color, marginRight: 8, display: "inline-block" }} />{a.name}</td>
                <td style={{ color: "var(--text-muted)" }}>{a.bank}</td>
                <td className="amt-cell">{fmtMoney(accountBalances[a.id] || 0, currency)}</td>
                <td>
                  {confirmId === a.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Wirklich löschen?</span>
                      <button className="btn btn-danger" style={{ padding: "5px 9px" }} onClick={() => { onDelete(a.id); setConfirmId(null); }}>Ja</button>
                      <button className="btn" style={{ padding: "5px 9px" }} onClick={() => setConfirmId(null)}>Abbrechen</button>
                    </div>
                  ) : (
                    <button className="btn btn-danger" style={{ padding: "5px 9px" }} onClick={() => setConfirmId(a.id)}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------------------------- Import Tab ---------------------------------- */

function ImportTab({ accounts, rules, onImport, onAddAccount }) {
  const [step, setStep] = useState(1);
  const [accountId, setAccountId] = useState("");
  const [newAccName, setNewAccName] = useState("");
  const [newAccBank, setNewAccBank] = useState("");
  const [rawText, setRawText] = useState("");
  const [fields, setFields] = useState([]);
  const [rows, setRows] = useState([]);
  const [parseWarning, setParseWarning] = useState("");
  const [dateCol, setDateCol] = useState("");
  const [descCol, setDescCol] = useState("");
  const [amountMode, setAmountMode] = useState("single");
  const [amountCol, setAmountCol] = useState("");
  const [debitCol, setDebitCol] = useState("");
  const [creditCol, setCreditCol] = useState("");
  const [fileName, setFileName] = useState("");
  const [skipLines, setSkipLines] = useState(0);
  const [delimiter, setDelimiter] = useState("auto");
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setRawText(String(reader.result));
      setSkipLines(0);
    };
    reader.readAsText(file, "UTF-8");
  }

  // Parst den Rohtext neu, sobald er sich ändert oder Kopfzeilen/Trennzeichen angepasst werden
  useEffect(() => {
    if (!rawText) return;
    const lines = rawText.split(/\r\n|\n|\r/);
    const trimmed = lines.slice(skipLines).join("\n");
    Papa.parse(trimmed, {
      header: true,
      skipEmptyLines: true,
      delimiter: delimiter === "auto" ? "" : delimiter,
      complete: (res) => {
        const flds = (res.meta.fields || []).filter(Boolean);
        setFields(flds);
        setRows(res.data);
        if (flds.length <= 1) {
          setParseWarning("Es wurde nur eine Spalte erkannt. Prüfe das Trennzeichen oder ob vor der Kopfzeile noch Infozeilen stehen, die übersprungen werden müssen.");
        } else {
          setParseWarning("");
        }
        setDateCol((prev) => prev && flds.includes(prev) ? prev : guessColumn(flds, ["datum", "date", "buchungsdatum"]));
        setDescCol((prev) => prev && flds.includes(prev) ? prev : guessColumn(flds, ["text", "beschreibung", "verwendungszweck", "buchungstext", "description"]));
        const debit = guessColumn(flds, ["belastung", "debit", "soll"]);
        const credit = guessColumn(flds, ["gutschrift", "credit", "haben"]);
        if (debit || credit) {
          setAmountMode("split"); setDebitCol(debit); setCreditCol(credit);
        } else {
          const singleCandidates = flds.filter((f) => {
            const lo = f.toLowerCase();
            return (lo.includes("betrag") || lo.includes("amount")) && !lo.includes("detail") && !lo.includes("referenz");
          });
          const single = singleCandidates[0] || "";
          if (single) { setAmountMode("single"); setAmountCol(single); }
        }
      },
    });
  }, [rawText, skipLines, delimiter]);

  const preview = useMemo(() => {
    if (!dateCol || !descCol) return [];
    return rows.slice(0, rows.length).map((r) => {
      const d = parseDateStr(r[dateCol]);
      let amount;
      if (amountMode === "single") amount = parseAmount(r[amountCol]);
      else {
        const debit = parseAmount(r[debitCol]) || 0;
        const credit = parseAmount(r[creditCol]) || 0;
        amount = (credit || 0) - Math.abs(debit || 0);
      }
      const desc = r[descCol] || "";
      return {
        id: uid(),
        date: d ? toISO(d) : "",
        description: desc,
        amount: Number.isFinite(amount) ? amount : 0,
        category: categorize(desc, rules),
      };
    }).filter((t) => t.date);
  }, [rows, dateCol, descCol, amountMode, amountCol, debitCol, creditCol, rules]);

  const zeroAmountCount = useMemo(() => preview.filter((t) => t.amount === 0).length, [preview]);

  function confirmImport() {
    onImport(accountId, preview);
    setStep(1); setFields([]); setRows([]); setFileName(""); setRawText(""); setSkipLines(0); setDelimiter("auto"); setParseWarning("");
    setDateCol(""); setDescCol(""); setAmountCol(""); setDebitCol(""); setCreditCol("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function createAndSelectAccount() {
    if (!newAccName.trim() || !newAccBank.trim()) return;
    onAddAccount({ name: newAccName.trim(), bank: newAccBank.trim(), startingBalance: 0 });
  }

  return (
    <div className="panel">
      <div className="panel-title">Kontoauszug importieren</div>
      <div className="steps">
        {[1, 2, 3].map((s) => <div key={s} className={"step-dot" + (step >= s ? " active" : "")} />)}
      </div>

      {step === 1 && (
        <div>
          <label className="field-label">Zielkonto wählen</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ width: "100%", marginBottom: 14 }}>
            <option value="">— Konto auswählen —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.bank})</option>)}
          </select>

          {accounts.length === 0 && (
            <div style={{ marginBottom: 14, padding: 12, background: "var(--panel-raised)", borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Noch kein Konto vorhanden — hier direkt anlegen:</div>
              <div className="form-grid" style={{ marginBottom: 8 }}>
                <input type="text" placeholder="Kontoname" value={newAccName} onChange={(e) => setNewAccName(e.target.value)} />
                <input type="text" placeholder="Bank" value={newAccBank} onChange={(e) => setNewAccBank(e.target.value)} />
              </div>
              <button className="btn" onClick={createAndSelectAccount}><Plus size={13} /> Konto anlegen</button>
            </div>
          )}
          <button className="btn btn-primary" disabled={!accountId} onClick={() => setStep(2)}>Weiter</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <label className="field-label">CSV-Datei auswählen</label>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ marginBottom: 16, display: "block" }} />

          {rawText && (
            <>
              <div style={{ marginBottom: 14, padding: 10, background: "var(--panel-raised)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>Rohtext (erste Zeilen)</div>
                <pre className="mono" style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 90, overflow: "auto" }}>
                  {rawText.split(/\r\n|\n|\r/).slice(0, 6).join("\n")}
                </pre>
              </div>

              <div className="form-grid">
                <div>
                  <label className="field-label">Kopfzeilen überspringen</label>
                  <input type="number" min="0" value={skipLines} onChange={(e) => setSkipLines(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: "100%" }} />
                </div>
                <div>
                  <label className="field-label">Trennzeichen</label>
                  <select value={delimiter} onChange={(e) => setDelimiter(e.target.value)} style={{ width: "100%" }}>
                    <option value="auto">Automatisch erkennen</option>
                    <option value=",">Komma (,)</option>
                    <option value=";">Semikolon (;)</option>
                    <option value="\t">Tabulator</option>
                  </select>
                </div>
              </div>

              {parseWarning && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 14, padding: 10, background: "rgba(232,132,107,0.1)", border: "1px solid #7A4A3E", borderRadius: 8 }}>
                  <AlertCircle size={15} color="var(--expense)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{parseWarning}</span>
                </div>
              )}
            </>
          )}

          {fields.length > 0 && (
            <>
              <div className="form-grid">
                <div>
                  <label className="field-label">Datum-Spalte</label>
                  <select value={dateCol} onChange={(e) => setDateCol(e.target.value)} style={{ width: "100%" }}>
                    <option value="">—</option>{fields.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Beschreibung-Spalte</label>
                  <select value={descCol} onChange={(e) => setDescCol(e.target.value)} style={{ width: "100%" }}>
                    <option value="">—</option>{fields.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Betrag-Format</label>
                  <select value={amountMode} onChange={(e) => setAmountMode(e.target.value)} style={{ width: "100%" }}>
                    <option value="single">Ein Betrag (± Vorzeichen)</option>
                    <option value="split">Getrennt: Belastung / Gutschrift</option>
                  </select>
                </div>
                {amountMode === "single" ? (
                  <div>
                    <label className="field-label">Betrag-Spalte</label>
                    <select value={amountCol} onChange={(e) => setAmountCol(e.target.value)} style={{ width: "100%" }}>
                      <option value="">—</option>{fields.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="field-label">Belastung-Spalte</label>
                      <select value={debitCol} onChange={(e) => setDebitCol(e.target.value)} style={{ width: "100%" }}>
                        <option value="">—</option>{fields.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Gutschrift-Spalte</label>
                      <select value={creditCol} onChange={(e) => setCreditCol(e.target.value)} style={{ width: "100%" }}>
                        <option value="">—</option>{fields.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" onClick={() => setStep(1)}>Zurück</button>
                <button className="btn btn-primary" disabled={!dateCol || !descCol || (amountMode === "single" ? !amountCol : !debitCol && !creditCol)} onClick={() => setStep(3)}>
                  Vorschau anzeigen
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13, color: "var(--text-muted)" }}>
            <FileText size={14} /> {fileName} — {preview.length} Transaktionen erkannt
          </div>
          {zeroAmountCount > 0 && zeroAmountCount >= preview.length * 0.3 && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 14, padding: 10, background: "rgba(232,132,107,0.1)", border: "1px solid #7A4A3E", borderRadius: 8 }}>
              <AlertCircle size={15} color="var(--expense)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {zeroAmountCount} von {preview.length} Zeilen haben einen Betrag von 0 — das deutet meist auf eine falsche Spaltenzuordnung hin. Geh zurück zu Schritt 2 und prüfe Betrag-/Belastung-/Gutschrift-Spalte.
              </span>
            </div>
          )}
          <div style={{ maxHeight: 340, overflow: "auto", marginBottom: 14 }}>
            <table>
              <thead><tr><th>Datum</th><th>Beschreibung</th><th>Kategorie</th><th style={{ textAlign: "right" }}>Betrag</th></tr></thead>
              <tbody>
                {preview.slice(0, 50).map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.date}</td>
                    <td>{t.description}</td>
                    <td><span className="chip" style={{ background: CAT_MAP[t.category].color + "22", color: CAT_MAP[t.category].color }}>{CAT_MAP[t.category].label}</span></td>
                    <td className={"amt-cell " + (t.amount >= 0 ? "pos" : "neg")}>{t.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && <div style={{ padding: 8, fontSize: 12, color: "var(--text-muted)" }}>… und {preview.length - 50} weitere</div>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={() => setStep(2)}>Zurück</button>
            <button className="btn btn-primary" onClick={confirmImport}><Check size={14} /> {preview.length} Transaktionen importieren</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Transactions Tab ---------------------------------- */

function TransactionsTab({ accounts, txByAccount, currency, onUpdateCategory, onDelete }) {
  const [accFilter, setAccFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    let out = [];
    for (const acc of accounts) {
      if (accFilter !== "all" && accFilter !== acc.id) continue;
      for (const t of txByAccount[acc.id] || []) out.push({ ...t, accountName: acc.name, accountId: acc.id });
    }
    if (catFilter !== "all") out = out.filter((t) => t.category === catFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      out = out.filter((t) => t.description.toLowerCase().includes(s));
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [accounts, txByAccount, accFilter, catFilter, search]);

  return (
    <div className="panel">
      <div className="panel-title">Transaktionen ({rows.length})</div>
      <div className="toolbar">
        <div className="search-box">
          <Search size={14} color="var(--text-muted)" />
          <input type="text" placeholder="Beschreibung durchsuchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={accFilter} onChange={(e) => setAccFilter(e.target.value)}>
          <option value="all">Alle Konten</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="all">Alle Kategorien</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state"><List size={26} /><div>Keine Transaktionen gefunden.</div></div>
      ) : (
        <div style={{ maxHeight: 520, overflow: "auto" }}>
          <table>
            <thead><tr><th>Datum</th><th>Beschreibung</th><th>Konto</th><th>Kategorie</th><th style={{ textAlign: "right" }}>Betrag</th><th></th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{t.date}</td>
                  <td>{t.description}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{t.accountName}</td>
                  <td>
                    <select value={t.category} onChange={(e) => onUpdateCategory(t.accountId, t.id, e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className={"amt-cell " + (t.amount >= 0 ? "pos" : "neg")}>{t.amount.toFixed(2)}</td>
                  <td><button className="btn btn-danger" style={{ padding: "4px 8px" }} onClick={() => onDelete(t.accountId, t.id)}><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Rules Tab ---------------------------------- */

function RulesTab({ rules, onAdd, onDelete }) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].id);

  function submit() {
    if (!keyword.trim()) return;
    onAdd({ keyword: keyword.trim(), category });
    setKeyword("");
  }

  return (
    <div className="panel">
      <div className="panel-title">Kategorisierungs-Regeln</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
        Enthält die Beschreibung einer Transaktion ein Stichwort, wird automatisch die zugehörige Kategorie zugewiesen.
      </div>
      <div className="form-grid">
        <div style={{ gridColumn: "span 2" }}>
          <label className="field-label">Stichwort (z. B. "migros")</label>
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <label className="field-label">Kategorie</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%" }}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <button className="btn btn-primary" onClick={submit}><Plus size={14} /> Regel hinzufügen</button>

      <div className="panel-title" style={{ marginTop: 26 }}>Aktive Regeln ({rules.length})</div>
      <div style={{ maxHeight: 400, overflow: "auto" }}>
        <table>
          <thead><tr><th>Stichwort</th><th>Kategorie</th><th></th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.keyword}</td>
                <td><span className="chip" style={{ background: CAT_MAP[r.category].color + "22", color: CAT_MAP[r.category].color }}>{CAT_MAP[r.category].label}</span></td>
                <td><button className="btn btn-danger" style={{ padding: "4px 8px" }} onClick={() => onDelete(r.id)}><X size={12} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------- Werkzeuge (Tools) ---------------------------------- */

const CONVERTIBLE_CURRENCIES = ["CHF", "EUR", "USD", "GBP", "JPY", "CAD", "AUD", "SEK", "NOK"];

function CalculatorTool() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function press(token) {
    setExpr((prev) => prev + token);
  }
  function clearAll() { setExpr(""); setResult(null); setError(""); }
  function backspace() { setExpr((prev) => prev.slice(0, -1)); }
  function evaluate() {
    if (!expr.trim()) return;
    if (!/^[0-9+\-*/.,()\s%]+$/.test(expr)) { setError("Nur Zahlen und + − × ÷ % sind erlaubt."); return; }
    try {
      const sanitized = expr.replace(/,/g, ".").replace(/%/g, "/100");
      // eslint-disable-next-line no-new-func
      const value = Function('"use strict"; return (' + sanitized + ")")();
      if (!Number.isFinite(value)) throw new Error("ungültig");
      setResult(value);
      setError("");
    } catch {
      setError("Ausdruck konnte nicht berechnet werden.");
    }
  }

  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "%", "+"];

  return (
    <div className="panel">
      <div className="panel-title"><Calculator size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Taschenrechner</div>
      <input
        type="text"
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") evaluate(); }}
        placeholder="z. B. 120.50 + 34.90"
        className="mono"
        style={{ width: "100%", marginBottom: 10, fontSize: 16, padding: "12px 14px" }}
      />
      {result !== null && !error && <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--gold)", marginBottom: 10 }}>= {result.toLocaleString("de-CH", { maximumFractionDigits: 6 })}</div>}
      {error && <div style={{ fontSize: 12, color: "var(--expense)", marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, maxWidth: 320 }}>
        {keys.map((k) => (
          <button key={k} className="btn" style={{ padding: "12px 0", fontSize: 15 }} onClick={() => press(k)}>{k === "*" ? "×" : k === "/" ? "÷" : k}</button>
        ))}
        <button className="btn" style={{ padding: "12px 0" }} onClick={backspace}>⌫</button>
        <button className="btn" style={{ padding: "12px 0" }} onClick={clearAll}>C</button>
        <button className="btn btn-primary" style={{ padding: "12px 0", gridColumn: "span 2" }} onClick={evaluate}>=</button>
      </div>
    </div>
  );
}

function CurrencyConverterTool() {
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("CHF");
  const [to, setTo] = useState("EUR");
  const [rate, setRate] = useState("");
  const [manualRate, setManualRate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  async function fetchRate() {
    if (from === to) { setRate("1"); return; }
    setLoading(true); setFetchError("");
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Anfrage fehlgeschlagen");
      const data = await res.json();
      const r = data.rates && data.rates[to];
      if (!r) throw new Error("Kein Kurs erhalten");
      setRate(String(r));
      setLastUpdated(data.date || "");
      setManualRate(false);
    } catch (e) {
      setFetchError("Kurs konnte nicht automatisch geladen werden (evtl. keine Internetverbindung möglich). Bitte Kurs manuell eintragen.");
      setManualRate(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from, to]);

  const numericAmount = parseAmount(amount) || 0;
  const numericRate = parseAmount(rate) || 0;
  const converted = numericAmount * numericRate;

  return (
    <div className="panel">
      <div className="panel-title"><ArrowLeftRight size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Währungsrechner</div>
      <div className="form-grid">
        <div>
          <label className="field-label">Betrag</label>
          <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} className="mono" style={{ width: "100%" }} />
        </div>
        <div>
          <label className="field-label">Von</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "100%" }}>
            {CONVERTIBLE_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Nach</label>
          <select value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "100%" }}>
            {CONVERTIBLE_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <label className="field-label" style={{ marginBottom: 0 }}>Kurs (1 {from} =)</label>
        <input type="text" value={rate} onChange={(e) => { setRate(e.target.value); setManualRate(true); }} className="mono" style={{ width: 110 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{to}</span>
        <button className="btn" onClick={fetchRate} disabled={loading}><RefreshCw size={13} style={loading ? { animation: "spin 1s linear infinite" } : {}} /> {loading ? "Lädt…" : "Kurs abrufen"}</button>
        {lastUpdated && !manualRate && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Stand: {lastUpdated} (EZB-Referenzkurs)</span>}
      </div>
      {fetchError && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 14, padding: 10, background: "rgba(232,132,107,0.1)", border: "1px solid #7A4A3E", borderRadius: 8 }}>
          <AlertCircle size={15} color="var(--expense)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fetchError}</span>
        </div>
      )}

      <div className="mono" style={{ fontSize: 26, fontWeight: 600, color: "var(--gold)" }}>
        {numericAmount.toLocaleString("de-CH", { maximumFractionDigits: 2 })} {from} = {converted.toLocaleString("de-CH", { maximumFractionDigits: 2 })} {to}
      </div>
    </div>
  );
}

function SavingsGoalTool() {
  const [goal, setGoal] = useState("20000");
  const [current, setCurrent] = useState("2000");
  const [monthly, setMonthly] = useState("300");
  const [annualRate, setAnnualRate] = useState("1.5");

  const result = useMemo(() => {
    const g = parseAmount(goal) || 0;
    let bal = parseAmount(current) || 0;
    const m = parseAmount(monthly) || 0;
    const r = (parseAmount(annualRate) || 0) / 100 / 12;
    if (bal >= g) return { months: 0, totalContributed: 0, totalInterest: 0 };
    if (m <= 0 && r <= 0) return null;
    let months = 0;
    let totalContributed = 0;
    const startBal = bal;
    while (bal < g && months < 1200) {
      bal += bal * r + m;
      totalContributed += m;
      months++;
    }
    if (months >= 1200) return null;
    const totalInterest = bal - startBal - totalContributed;
    return { months, totalContributed, totalInterest, finalBalance: bal };
  }, [goal, current, monthly, annualRate]);

  return (
    <div className="panel">
      <div className="panel-title"><PiggyBank size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Sparziel-Rechner</div>
      <div className="form-grid">
        <div>
          <label className="field-label">Sparziel</label>
          <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)} className="mono" style={{ width: "100%" }} />
        </div>
        <div>
          <label className="field-label">Bereits gespart</label>
          <input type="text" value={current} onChange={(e) => setCurrent(e.target.value)} className="mono" style={{ width: "100%" }} />
        </div>
        <div>
          <label className="field-label">Monatliche Sparrate</label>
          <input type="text" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="mono" style={{ width: "100%" }} />
        </div>
        <div>
          <label className="field-label">Erwartete Rendite % p. a.</label>
          <input type="text" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} className="mono" style={{ width: "100%" }} />
        </div>
      </div>
      {result === null ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Mit diesen Angaben wird das Ziel nicht erreicht — bitte Sparrate oder Rendite erhöhen.</div>
      ) : result.months === 0 ? (
        <div className="mono" style={{ fontSize: 18, color: "var(--income)" }}>Ziel bereits erreicht 🎉</div>
      ) : (
        <div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--gold)", marginBottom: 6 }}>
            {result.months} Monate ({(result.months / 12).toFixed(1)} Jahre)
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Eigene Einzahlungen: {result.totalContributed.toLocaleString("de-CH", { maximumFractionDigits: 0 })} · Zinsertrag: {result.totalInterest.toLocaleString("de-CH", { maximumFractionDigits: 0 })}
          </div>
        </div>
      )}
    </div>
  );
}

function LoanCalculatorTool() {
  const [principal, setPrincipal] = useState("50000");
  const [rate, setRate] = useState("4.5");
  const [years, setYears] = useState("5");

  const result = useMemo(() => {
    const p = parseAmount(principal) || 0;
    const r = (parseAmount(rate) || 0) / 100 / 12;
    const n = (parseAmount(years) || 0) * 12;
    if (p <= 0 || n <= 0) return null;
    const monthlyPayment = r === 0 ? p / n : (p * r) / (1 - Math.pow(1 + r, -n));
    const totalPaid = monthlyPayment * n;
    return { monthlyPayment, totalPaid, totalInterest: totalPaid - p };
  }, [principal, rate, years]);

  return (
    <div className="panel">
      <div className="panel-title"><Percent size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Kredit- / Zinsrechner</div>
      <div className="form-grid">
        <div>
          <label className="field-label">Kreditbetrag</label>
          <input type="text" value={principal} onChange={(e) => setPrincipal(e.target.value)} className="mono" style={{ width: "100%" }} />
        </div>
        <div>
          <label className="field-label">Zinssatz % p. a.</label>
          <input type="text" value={rate} onChange={(e) => setRate(e.target.value)} className="mono" style={{ width: "100%" }} />
        </div>
        <div>
          <label className="field-label">Laufzeit (Jahre)</label>
          <input type="text" value={years} onChange={(e) => setYears(e.target.value)} className="mono" style={{ width: "100%" }} />
        </div>
      </div>
      {result && (
        <div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--gold)", marginBottom: 6 }}>
            {result.monthlyPayment.toLocaleString("de-CH", { maximumFractionDigits: 2 })} / Monat
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Gesamtkosten: {result.totalPaid.toLocaleString("de-CH", { maximumFractionDigits: 0 })} · davon Zinsen: {result.totalInterest.toLocaleString("de-CH", { maximumFractionDigits: 0 })}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolsTab({ defaultCurrency }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="tools-grid">
      <CalculatorTool />
      <CurrencyConverterTool />
      <SavingsGoalTool />
      <LoanCalculatorTool />
    </div>
  );
}

/* ---------------------------------- Error Boundary ---------------------------------- */

class CockpitErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          background: "#0E1316", color: "#E9EEF1", minHeight: "100vh",
          padding: 30, fontFamily: "'Roboto', sans-serif",
        }}>
          <div style={{
            maxWidth: 640, margin: "60px auto", background: "#171E22",
            border: "1px solid #7A4A3E", borderRadius: 12, padding: 24,
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: "#E8846B" }}>
              Das Cockpit ist auf einen Fehler gestoßen
            </div>
            <div style={{ fontSize: 13, color: "#7E8B93", marginBottom: 14 }}>
              Damit ich den Fehler beheben kann, bitte diese Meldung kopieren und mir schicken:
            </div>
            <pre style={{
              background: "#1E2731", padding: 12, borderRadius: 8, fontSize: 12,
              whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'Roboto Mono', monospace",
            }}>
              {String(this.state.error && (this.state.error.stack || this.state.error.message || this.state.error))}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MoneyCockpit() {
  return (
    <CockpitErrorBoundary>
      <MoneyCockpitInner />
    </CockpitErrorBoundary>
  );
}
