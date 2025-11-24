import "dotenv/config";

const apiKey = process.env.ED_API_KEY;
const searchButton = document.getElementById("searchButton");
const searchInput = document.getElementById("collegeSearch");
const resultsDiv = document.getElementById("collegeResults");

searchButton.addEventListener("click", async () => {
  const query = searchInput.value.trim();
  if (!query) {
    resultsDiv.innerHTML = "<p>Please enter a college name.</p>";
    return;
  }

  resultsDiv.innerHTML = "<p>Loading...</p>";

  try {
    const response = await fetch(
      `https://api.data.gov/ed/collegescorecard/v1/schools.json?school.name=${encodeURIComponent(query)}&api_key=${apiKey}&fields=school.name,school.city,school.state,latest.admissions.sat_scores.average.overall,latest.cost.tuition.out_of_state`
    );
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      resultsDiv.innerHTML = "<p>No colleges found.</p>";
      return;
    }

    resultsDiv.innerHTML = data.results
      .map(
        (college) => `
        <div class="college-card">
          <h3>${college["school.name"]}</h3>
          <p>${college["school.city"]}, ${college["school.state"]}</p>
          <p><strong>Average SAT:</strong> ${college["latest.admissions.sat_scores.average.overall"] || "N/A"}</p>
          <p><strong>Tuition (Out-of-State):</strong> $${college["latest.cost.tuition.out_of_state"] || "N/A"}</p>
        </div>
      `
      )
      .join("");
  } catch (error) {
    resultsDiv.innerHTML = `<p>Error fetching data: ${error.message}</p>`;
  }
});
