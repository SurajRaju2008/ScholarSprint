const { SEED_SCHOLARSHIPS } = require("./scholarship-seed");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const profile = body.profile || {};
  const tavilyKey = process.env.TAVILY_API_KEY;

  let tavilyResults = [];
  if (tavilyKey) {
    try {
      tavilyResults = await fetchTavilyScholarships(profile, tavilyKey);
    } catch (err) {
      console.error("Tavily scholarship search error:", err);
    }
  }

  const scholarships = dedupeScholarships([
    ...SEED_SCHOLARSHIPS,
    ...tavilyResults,
  ]);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      scholarships,
      source: tavilyKey ? "seed+tavily" : "seed",
    }),
  };
};

async function fetchTavilyScholarships(profile, apiKey) {
  const major = profile.intendedMajor || "college";
  const state = profile.homeState || "";
  const grade = inferGradeLabel(profile.graduationYear);

  const queries = [
    `${grade} ${major} scholarship 2026 application deadline official site`,
    `high school ${state} local scholarship ${major} 2026 apply`,
    `no essay scholarship high school senior 2026`,
  ];

  const all = [];

  for (const query of queries) {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 6,
        include_answer: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Tavily HTTP error:", res.status, errText);
      continue;
    }

    const data = await res.json();
    for (const item of data.results || []) {
      all.push(normalizeTavilyResult(item, profile));
    }
  }

  return all.filter(Boolean);
}

function normalizeTavilyResult(item, profile) {
  if (!item?.url || !item?.title) return null;

  const text = `${item.title} ${item.content || ""}`;
  const amount = extractAmount(text);
  const deadline = extractDeadline(text);
  const essayRequired = /\bessay\b/i.test(text);
  const categories = inferCategories(text, profile.intendedMajor);
  const id = `tavily-${simpleHash(item.url)}`;

  return {
    id,
    name: cleanTitle(item.title),
    sponsor: extractSponsor(item.url, text),
    url: item.url,
    amountMin: amount.min,
    amountMax: amount.max,
    amountLabel: amount.label,
    deadline: deadline.iso,
    deadlineType: deadline.type,
    categories,
    eligibility: inferEligibility(text),
    requirements: inferRequirements(text),
    essayRequired,
    effort: inferEffort(text),
    renewable: /\brenewable\b/i.test(text),
    locationScope: inferLocationScope(text, profile.homeState),
    gradeLevels: inferGradeLevels(text),
    minGpa: extractMinGpa(text),
    needBased: /\bfinancial need\b|\bneed-based\b|\bpell\b/i.test(text),
    tags: categories.slice(0, 3),
    source: "tavily",
  };
}

function dedupeScholarships(list) {
  const seen = new Set();
  return list.filter((s) => {
    const key = (s.url || s.name || s.id).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanTitle(title) {
  return title.replace(/\s*[\|\-–—].*$/, "").trim().slice(0, 120);
}

function extractSponsor(url, text) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length >= 2) {
      return parts[parts.length - 2].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
  } catch {
    /* ignore */
  }
  const match = text.match(/(?:sponsor(?:ed by)?|foundation|corporation)\s*[:\-]?\s*([A-Za-z0-9 &]+)/i);
  return match ? match[1].trim().slice(0, 60) : "Organization";
}

function extractAmount(text) {
  if (/full (?:ride|tuition|cost)/i.test(text)) {
    return { min: 50000, max: 999999, label: "Full tuition / major award" };
  }

  const range = text.match(/\$([\d,]+)\s*(?:to|\-|–)\s*\$([\d,]+)/i);
  if (range) {
    const min = parseInt(range[1].replace(/,/g, ""), 10);
    const max = parseInt(range[2].replace(/,/g, ""), 10);
    return { min, max, label: `$${min.toLocaleString()}–$${max.toLocaleString()}` };
  }

  const single = text.match(/\$([\d,]+)/);
  if (single) {
    const val = parseInt(single[1].replace(/,/g, ""), 10);
    return { min: val, max: val, label: `$${val.toLocaleString()}` };
  }

  return { min: 500, max: 2500, label: "Varies" };
}

function extractDeadline(text) {
  const rolling = /\brolling\b/i.test(text);
  if (rolling) {
    return { iso: null, type: "rolling" };
  }

  const iso = text.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const d = `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
    return { iso: d, type: "fixed" };
  }

  const monthDay = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i,
  );
  if (monthDay) {
    const months = {
      january: "01", february: "02", march: "03", april: "04",
      may: "05", june: "06", july: "07", august: "08",
      september: "09", october: "10", november: "11", december: "12",
    };
    const m = months[monthDay[1].toLowerCase()];
    const d = `${monthDay[3]}-${m}-${String(monthDay[2]).padStart(2, "0")}`;
    return { iso: d, type: "fixed" };
  }

  const future = new Date();
  future.setMonth(future.getMonth() + 4);
  return { iso: future.toISOString().slice(0, 10), type: "estimated" };
}

function inferCategories(text, major) {
  const cats = [];
  const lower = text.toLowerCase();
  const majorLower = (major || "").toLowerCase();

  if (/stem|science|engineering|math|computer|technology|research/i.test(text) || /engineering|computer|biology|physics|math/.test(majorLower)) {
    cats.push("STEM");
  }
  if (/leadership|leader|captain|president/i.test(text)) cats.push("Leadership");
  if (/community service|volunteer|service/i.test(text)) cats.push("Community Service");
  if (/financial need|need-based|pell|low-income/i.test(text)) cats.push("Need-Based");
  if (/minority|diversity|hispanic|african american|native american|first-generation/i.test(text)) cats.push("Diversity");
  if (/art|music|creative|film|theater|writing/i.test(text)) cats.push("Arts & Music");
  if (/athletic|sport/i.test(text)) cats.push("Athletics");
  if (/academic|merit|gpa|honor/i.test(text)) cats.push("Academic");
  if (majorLower && cats.length === 0) cats.push("Career-Specific");

  return cats.length ? cats : ["Academic"];
}

function inferEligibility(text) {
  if (/high school senior/i.test(text)) return "High school seniors";
  if (/high school junior/i.test(text)) return "High school juniors and seniors";
  if (/undergraduate|college student/i.test(text)) return "College students";
  return "High school students planning to attend college";
}

function inferRequirements(text) {
  const parts = [];
  const gpa = extractMinGpa(text);
  if (gpa) parts.push(`${gpa}+ GPA`);
  if (/\bleadership\b/i.test(text)) parts.push("Leadership experience");
  if (/\bessay\b/i.test(text)) parts.push("Application essay");
  if (/\bcommunity service\b|\bvolunteer/i.test(text)) parts.push("Community service");
  if (/\brecommendation\b/i.test(text)) parts.push("Recommendations");
  return parts.length ? parts.join(", ") : "Review official eligibility on scholarship website";
}

function inferEffort(text) {
  if (/\bportfolio\b|\bresearch project\b|\bmultiple essays\b/i.test(text)) return "High";
  if (/\bessay\b|\brecommendation\b|\btranscript\b/i.test(text)) return "Medium";
  return "Low";
}

function inferLocationScope(text, homeState) {
  if (/\blocal\b|\bcounty\b|\bcommunity foundation\b/i.test(text)) return "Local";
  if (homeState && new RegExp(`\\b${homeState}\\b`, "i").test(text)) return "State";
  if (/\bnational\b|\bunited states\b|\bcountrywide\b/i.test(text)) return "National";
  if (/\bschool-specific\b|\buniversity\b/i.test(text)) return "School-specific";
  return "National";
}

function inferGradeLevels(text) {
  const levels = [];
  if (/freshman/i.test(text)) levels.push("Freshman");
  if (/sophomore/i.test(text)) levels.push("Sophomore");
  if (/junior/i.test(text)) levels.push("Junior");
  if (/senior/i.test(text)) levels.push("Senior");
  if (/college student|undergraduate/i.test(text)) levels.push("College student");
  return levels.length ? levels : ["Senior"];
}

function extractMinGpa(text) {
  const match = text.match(/(\d\.\d)\+?\s*gpa/i);
  return match ? Number(match[1]) : null;
}

function inferGradeLabel(graduationYear) {
  const year = Number(graduationYear);
  const now = new Date().getFullYear();
  if (year === now) return "high school senior";
  if (year === now + 1) return "high school junior";
  return "high school student";
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
