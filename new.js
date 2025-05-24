const fetch = require("node-fetch");

const BACKEND_API_URL = "http://localhost:8080/vicidial-agents"; // Change if deployed

async function testFetchAgents() {
  try {
    const response = await fetch(BACKEND_API_URL);
    if (!response.ok) {
      console.error("Failed to fetch agents:", response.status);
      return;
    }
    const agents = await response.json();
    console.log("Fetched VICIdial agents:", agents);
  } catch (err) {
    console.error("Error fetching agents:", err);
  }
}

testFetchAgents();
