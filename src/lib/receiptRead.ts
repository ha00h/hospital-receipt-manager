export type ReceiptCategory = "hospital" | "pharmacy";

export type ReceiptRead = {
  date: string | null;
  hospital: string | null;
  amount: number | null;
  category: ReceiptCategory | null;
};

const EMPTY = /^(없음|모름|미상|unknown|null|n\/a|-)$/i;

/** Turns model JSON into fields the form can trust. Invalid or missing values become null. */
export function normalizeReceiptRead(raw: unknown): ReceiptRead {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    date: normalizeDate(obj.date),
    hospital: normalizeHospital(obj.hospital),
    amount: normalizeAmount(obj.amount),
    category: normalizeCategory(obj.category),
  };
}

/**
 * Uses an already-saved name when it is the same place, so appointment matching
 * stays on one spelling. Short or loosely similar names are left unchanged.
 */
export function preferKnownName(name: string, names: string[]): string {
  const target = compact(name);
  const exact = names.find((candidate) => compact(candidate) === target);
  if (exact) return exact;

  let best: string | null = null;
  let bestLen = 0;
  for (const candidate of names) {
    const current = compact(candidate);
    if (current.length < 4) continue;
    const shorter = Math.min(current.length, target.length);
    const longer = Math.max(current.length, target.length);
    if (shorter / longer < 0.6) continue;
    if (!current.includes(target) && !target.includes(current)) continue;
    if (current.length > bestLen) {
      best = candidate;
      bestLen = current.length;
    }
  }
  return best ?? name;
}

const DATE_LABEL = /진료|내원|수납|조제|발행/;
const BIRTH_LABEL = /생년|주민|등록번호/;
/** Longer department and place words win, so 소아청소년과 is not cut down to 소아과. */
const PLACE_SUFFIXES = [
  "소아청소년과",
  "정신건강의학과",
  "마취통증의학과",
  "재활의학과",
  "가정의학과",
  "이비인후과",
  "비뇨의학과",
  "영상의학과",
  "응급의학과",
  "산부인과",
  "정형외과",
  "신경외과",
  "흉부외과",
  "성형외과",
  "비뇨기과",
  "소아과",
  "피부과",
  "한의원",
  "클리닉",
  "내과",
  "외과",
  "신경과",
  "치과",
  "안과",
  "약국",
  "의원",
  "병원",
];

/** Reads date, place, amount, and category from text recognized on the phone. */
export function parseReceiptOcr(text: string, known: { hospital: string[]; pharmacy: string[] }): ReceiptRead {
  const lines = text
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const fromHospital = findKnown(text, known.hospital);
  const fromPharmacy = findKnown(text, known.pharmacy);
  const knownName = betterKnown(fromHospital, fromPharmacy);
  const hospital = knownName?.name ?? guessInstitution(lines);
  const category: ReceiptCategory | null = knownName
    ? knownName.kind
    : hospital
      ? hospital.endsWith("약국")
        ? "pharmacy"
        : "hospital"
      : /약제비|조제/.test(text)
        ? "pharmacy"
        : null;

  return normalizeReceiptRead({
    date: guessDate(lines),
    hospital,
    amount: guessAmount(lines),
    category,
  });
}

function betterKnown(
  hospital: { name: string; index: number; length: number } | null,
  pharmacy: { name: string; index: number; length: number } | null,
) {
  if (hospital && pharmacy) {
    if (pharmacy.length > hospital.length) return { name: pharmacy.name, kind: "pharmacy" as const };
    if (hospital.length > pharmacy.length) return { name: hospital.name, kind: "hospital" as const };
    return pharmacy.index < hospital.index
      ? { name: pharmacy.name, kind: "pharmacy" as const }
      : { name: hospital.name, kind: "hospital" as const };
  }
  if (pharmacy) return { name: pharmacy.name, kind: "pharmacy" as const };
  if (hospital) return { name: hospital.name, kind: "hospital" as const };
  return null;
}

function findKnown(text: string, names: string[]) {
  const compactText = compact(text);
  let best: { name: string; index: number; length: number } | null = null;
  for (const name of names) {
    const current = compact(name);
    if (current.length < 4) continue;
    const index = compactText.indexOf(current);
    if (index < 0) continue;
    if (!best || current.length > best.length || (current.length === best.length && index < best.index)) {
      best = { name, index, length: current.length };
    }
  }
  return best;
}

function guessInstitution(lines: string[]) {
  let best: { name: string; score: number } | null = null;
  lines.forEach((line, index) => {
    const compactLine = line.replace(/[^가-힣A-Za-z0-9]/g, "");
    for (const suffix of PLACE_SUFFIXES) {
      let from = 0;
      while (from < compactLine.length) {
        const at = compactLine.indexOf(suffix, from);
        if (at < 0) break;
        from = at + suffix.length;
        const name = takePlaceName(compactLine, at, suffix);
        if (!name) continue;
        const score = scorePlace(name, suffix, line, index);
        if (!best || score > best.score) best = { name, score };
      }
    }
  });
  return best?.name ?? null;
}

function takePlaceName(line: string, suffixAt: number, suffix: string) {
  let start = suffixAt;
  let prefix = 0;
  while (start > 0 && prefix < 16 && /[가-힣A-Za-z0-9]/.test(line[start - 1]!)) {
    start -= 1;
    prefix += 1;
  }
  if (prefix < 2) return null;
  let name = line.slice(start, suffixAt + suffix.length);
  const university = name.match(/[가-힣]{2}대학교/);
  if (university?.index !== undefined) name = name.slice(university.index);
  else if (prefix > 8) name = name.slice(prefix - 8);
  name = name.replace(/^(상호|요양기관명|기관명칭|기관명)/, "");
  if (name.length < suffix.length + 2) return null;
  if (/종합병원|중합병원|병원급|의원급|요양병원|요양기관|보건기관|의료기관/.test(name)) return null;
  if (/^(병원|의원|약국|진료|환자)/.test(name)) return null;
  return name;
}

function scorePlace(name: string, suffix: string, line: string, index: number) {
  let score = name.length;
  if (/상호/.test(line)) score += 40;
  score += /약국|의원|병원|한의원|클리닉/.test(suffix) ? 15 : 10;
  if (index < 8) score += 8;
  if (/처방전\s*발행|발행\s*기관/.test(line)) score -= 25;
  if (line.length > 80 && !/상호/.test(line)) score -= 12;
  return score;
}

function guessDate(lines: string[]) {
  let best: { score: number; value: string } | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = line.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
    if (!match) continue;
    let score = index < 8 ? 1 : 0;
    if (DATE_LABEL.test(line)) score += 5;
    if (BIRTH_LABEL.test(line)) score -= 5;
    if (!best || score > best.score) best = { score, value: `${match[1]}-${match[2]}-${match[3]}` };
  }
  return best?.value ?? null;
}

function guessAmount(lines: string[]) {
  let best: { score: number; amount: number } | null = null;
  let card = 0;
  let cash = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = normalizePaidLine(lines[index] ?? "");
    if (isBillTotal(line) && !paidLabel(line)) continue;
    const rule = paidLabel(line);
    if (rule === "card") card += amountsIn(line).at(-1) ?? 0;
    if (rule === "cash") cash += amountsIn(line).at(-1) ?? 0;
    if (rule !== "paid") continue;
    const numbers = amountsIn(line);
    const next = normalizePaidLine(lines[index + 1] ?? "");
    const amount = (numbers.length ? numbers : isBillTotal(next) ? [] : amountsIn(next)).at(-1);
    if (!amount) continue;
    const score = paidScore(line);
    if (!best || score > best.score) best = { score, amount };
  }
  if (best) return best.amount;
  const tender = card + cash;
  return tender >= 100 ? tender : null;
}

/** Drops the document title so "영수증" is not treated as the amount received. */
function normalizePaidLine(line: string) {
  return line
    .replace(/남부한/g, "납부한")
    .replace(/남부할/g, "납부할")
    .replace(/남부하지/g, "납부하지")
    .replace(/현금영수증|영수증번호|계산서|영수증/g, "");
}

function isBillTotal(line: string) {
  return /진료비\s*총|공단\s*부담|급여\s*총|본인\s*부담|환자\s*부[담당]/.test(line);
}

function paidLabel(line: string) {
  if (hasAmountReceived(line)) return "paid" as const;
  if (/수납\s*(금액|액|금|합계)|총\s*수납/.test(line) && !/수납\s*담당|미수납|수납\s*후|수납\s*일시/.test(line)) {
    return "paid" as const;
  }
  if (/납부한/.test(line) && !/이미\s*납부한|납부하지/.test(line)) return "paid" as const;
  if (/납부할|납부하실/.test(line) && !/납부하지/.test(line)) return "paid" as const;
  if (/카드\s*금액|카드\s*결제/.test(line) && !/승인\s*번호|카드\s*번호/.test(line)) return "card" as const;
  if (/현금\s*금액|현금\s*결제/.test(line)) return "cash" as const;
  return null;
}

function hasAmountReceived(line: string) {
  return /영수\s*액|영수\s*금|영수\s*금액|(?:^|[^가-힣])영수(?:$|[^가-힣])/.test(line);
}

function paidScore(line: string) {
  if (hasAmountReceived(line)) return 50;
  if (/수납\s*(금액|액|금|합계)|총\s*수납/.test(line)) return 40;
  if (/납부한/.test(line)) return 35;
  return 20;
}

function amountsIn(line: string) {
  const year = Number(line.match(/(\d{4})\s*[.\-/년]/)?.[1]);
  return [...line.matchAll(/(\d{1,3}(?:,\d{3})+|\d{3,8})/g)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((amount) => amount >= 100 && amount <= 100_000_000 && amount !== year);
}

export function alignHospital(name: string, primary: string[], secondary: string[]) {
  const preferred = preferKnownName(name, primary);
  if (preferred !== name) return preferred;
  const target = compact(name);
  return secondary.find((candidate) => compact(candidate) === target) ?? name;
}

function compact(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function normalizeDate(value: unknown) {
  const match = String(value ?? "")
    .trim()
    .match(/(\d{4})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const maxYear = new Date().getFullYear() + 1;
  if (year < 2000 || year > maxYear || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeHospital(value: unknown) {
  const name = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!name || name.length > 60 || EMPTY.test(name) || !/[가-힣a-zA-Z]/.test(name)) return null;
  return name;
}

function normalizeAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d]/g, ""));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000) return null;
  return amount;
}

function normalizeCategory(value: unknown): ReceiptCategory | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "pharmacy" || /약국|약제|조제/.test(text)) return "pharmacy";
  if (text === "hospital" || /병원|의원|진료/.test(text)) return "hospital";
  return null;
}
