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

  const query = event.queryStringParameters?.q;
  if (!query || query.trim().length < 2) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Query must be at least 2 characters" }),
    };
  }

  // Fields to fetch from the College Scorecard API
  const fields = [
    "id",
    "school.name",
    "school.city",
    "school.state",
    "school.school_url",
    "school.ownership",
    "latest.admissions.admission_rate.overall",
    "latest.admissions.sat_scores.average.overall",
    "latest.admissions.act_scores.midpoint.cumulative",
    "latest.cost.tuition.in_state",
    "latest.cost.tuition.out_of_state",
    "latest.student.size",
    "latest.academics.program_percentage.computer_science",
    "latest.school.carnegie_size_setting",
  ].join(",");

  const url = `https://api.data.gov/ed/collegescorecard/v1/schools?school.name=${encodeURIComponent(
    query,
  )}&fields=${fields}&per_page=5&api_key=${apiKey}`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      const errText = await res.text();
      console.error("College Scorecard error:", errText);
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error: `College Scorecard API error: ${res.status}`,
        }),
      };
    }

    const data = await res.json();

    // Normalize and clean up the results
    const results = (data.results || []).map((school) => ({
      id: school.id,
      name: school["school.name"],
      city: school["school.city"],
      state: school["school.state"],
      url: school["school.school_url"],
      ownership: formatOwnership(school["school.ownership"]),
      admissionRate: school["latest.admissions.admission_rate.overall"],
      satAvg: school["latest.admissions.sat_scores.average.overall"],
      actMidpoint: school["latest.admissions.act_scores.midpoint.cumulative"],
      inStateTuition: school["latest.cost.tuition.in_state"],
      outOfStateTuition: school["latest.cost.tuition.out_of_state"],
      studentSize: school["latest.student.size"],
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ results }) };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

function formatOwnership(code) {
  const map = { 1: "Public", 2: "Private Nonprofit", 3: "Private For-Profit" };
  return map[code] || "Unknown";
}
