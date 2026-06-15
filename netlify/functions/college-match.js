const REGION_STATES = {
  Midwest: ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"],
  Northeast: ["CT", "ME", "MA", "NH", "NJ", "NY", "PA", "RI", "VT"],
  South: [
    "AL", "AR", "DE", "FL", "GA", "KY", "LA", "MD", "MS", "NC", "OK", "SC", "TN",
    "TX", "VA", "WV", "DC",
  ],
  "West Coast": ["CA", "OR", "WA", "AK", "HI", "AZ", "NV"],
};

const FIELDS = [
  "id",
  "school.name",
  "school.city",
  "school.state",
  "school.locale",
  "school.school_url",
  "school.ownership",
  "school.degrees_awarded.predominant",
  "latest.admissions.admission_rate.overall",
  "latest.admissions.sat_scores.average.overall",
  "latest.admissions.act_scores.midpoint.cumulative",
  "latest.admissions.test_requirements",
  "latest.cost.tuition.in_state",
  "latest.cost.tuition.out_of_state",
  "latest.student.size",
  "latest.academics.program_percentage.agriculture",
  "latest.academics.program_percentage.business_marketing",
  "latest.academics.program_percentage.computer",
  "latest.academics.program_percentage.engineering",
  "latest.academics.program_percentage.health",
  "latest.academics.program_percentage.education",
  "latest.academics.program_percentage.biological",
  "latest.academics.program_percentage.psychology",
  "latest.academics.program_percentage.social_science",
].join(",");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const apiKey = process.env.COLLEGE_SCORECARD_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          "College Scorecard API key not configured. Add COLLEGE_SCORECARD_API_KEY to Netlify environment variables.",
      }),
    };
  }

  const params = event.queryStringParameters || {};

  try {
    const queryParts = [`fields=${FIELDS}`, "per_page=100", "page=0"];

    const collegeType = params.collegeType || "any";
    if (collegeType === "public") {
      queryParts.push("school.ownership=1");
    } else if (collegeType === "private") {
      queryParts.push("school.ownership=2");
    } else if (collegeType === "community") {
      queryParts.push("school.degrees_awarded.predominant=2");
    }

    const size = params.size || "any";
    if (size === "small") {
      queryParts.push("latest.student.size__range=1..4999");
    } else if (size === "medium") {
      queryParts.push("latest.student.size__range=5000..15000");
    } else if (size === "large") {
      queryParts.push("latest.student.size__range=15001..999999");
    }

    const tuition = params.tuition || "any";
    if (tuition === "under-15k") {
      queryParts.push("latest.cost.tuition.out_of_state__range=1..14999");
    } else if (tuition === "15-30k") {
      queryParts.push("latest.cost.tuition.out_of_state__range=15000..30000");
    } else if (tuition === "30-50k") {
      queryParts.push("latest.cost.tuition.out_of_state__range=30001..50000");
    } else if (tuition === "50k-plus") {
      queryParts.push("latest.cost.tuition.out_of_state__range=50001..999999");
    }

    const homeState = (params.homeState || "").toUpperCase();
    const location = params.location || "any";

    if (location === "in-state" && homeState) {
      queryParts.push(`school.state=${homeState}`);
    } else if (location === "out-of-state" && homeState) {
      // Scorecard has no NOT operator; fetch broader set and filter client-side.
    } else if (REGION_STATES[location]) {
      queryParts.push(`school.state=${REGION_STATES[location].join(",")}`);
    }

    queryParts.push(
      "latest.admissions.admission_rate.overall__range=0.01..0.99",
    );

    const url = `https://api.data.gov/ed/collegescorecard/v1/schools?${queryParts.join(
      "&",
    )}&api_key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.error("College Scorecard match error:", errText);
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error: `College Scorecard API error: ${res.status}`,
        }),
      };
    }

    const data = await res.json();
    let results = (data.results || []).map(normalizeSchool);

    if (location === "out-of-state" && homeState) {
      results = results.filter((school) => school.state !== homeState);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ results }) };
  } catch (err) {
    console.error("College match function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

function normalizeSchool(school) {
  const programMap = {
    agriculture: "Agriculture",
    business_marketing: "Business",
    computer: "Computer Science",
    engineering: "Engineering",
    health: "Health Sciences",
    education: "Education",
    biological: "Biology",
    psychology: "Psychology",
    social_science: "Social Sciences",
  };

  const strongMajors = Object.entries(programMap)
    .map(([key, label]) => {
      const pct = school[`latest.academics.program_percentage.${key}`];
      return pct != null && pct >= 0.08 ? label : null;
    })
    .filter(Boolean)
    .slice(0, 4);

  const testReq = school["latest.admissions.test_requirements"];
  let testPolicy = "Test optional";
  if (testReq === 1) testPolicy = "Test required";

  return {
    id: school.id,
    name: school["school.name"],
    city: school["school.city"],
    state: school["school.state"],
    locale: school["school.locale"],
    url: school["school.school_url"],
    ownership: formatOwnership(school["school.ownership"]),
    ownershipCode: school["school.ownership"],
    degreesPredominant: school["school.degrees_awarded.predominant"],
    admissionRate: school["latest.admissions.admission_rate.overall"],
    satAvg: school["latest.admissions.sat_scores.average.overall"],
    actMidpoint: school["latest.admissions.act_scores.midpoint.cumulative"],
    inStateTuition: school["latest.cost.tuition.in_state"],
    outOfStateTuition: school["latest.cost.tuition.out_of_state"],
    studentSize: school["latest.student.size"],
    testPolicy,
    strongMajors,
  };
}

function formatOwnership(code) {
  const map = { 1: "Public", 2: "Private", 3: "Private For-Profit" };
  return map[code] || "Unknown";
}
