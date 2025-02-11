import api, { route } from "@forge/api";


// console.log("Script loaded! Waiting for function call...");

export const fetchRecommendations = async (event, context) => {
  console.log("Function fetchRecommendations was triggered! ✅");

  const userId = context.principal.accountId;

  try {
    console.log("Fetching Jira issues...");

    // Fetch Jira issues assigned to the current user
    const jiraResponse = await api.asApp().requestJira(route`/rest/api/3/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        jql: `assignee = "${userId}" ORDER BY priority DESC`,
        fields: ['summary', 'priority', 'status']
      })
    });

    if (!jiraResponse.ok) {
      const errorText = await jiraResponse.text();
      console.error("Jira API request failed:", jiraResponse.status, errorText);
      return { error: `Jira API request failed: ${jiraResponse.status}` };
    }

    const jiraData = await jiraResponse.json();
    console.log("Jira API request successful! ✅", JSON.stringify(jiraData, null, 2));

    const jiraTickets = jiraData.issues?.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      priority: issue.fields.priority.name,
      status: issue.fields.status.name
    })) || [];

    console.log("Formatted Jira Tickets:", jiraTickets);

    // ---------------- FETCH CONFLUENCE PAGES ----------------
    console.log("Fetching Confluence pages...");

    const confluenceResponse = await api.asApp().requestConfluence(
      route`/wiki/rest/api/content/search?cql=(type=page AND (creator="${userId}" OR lastModified > now("-7d"))) ORDER BY lastModified DESC`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );
    // console.log(confluenceResponse);
    if (!confluenceResponse.ok) {
      const errorText = await confluenceResponse.text();
      console.error("Confluence API request failed:", confluenceResponse.status, errorText);
      return { 
        jiraTickets, 
        error: `Confluence API request failed: ${confluenceResponse.status}` 
      };
    }

    console.log("Confluence API request successful! ✅");

    // Parse JSON response
    const confluenceData = await confluenceResponse.json();
    console.log("Confluence Response:", JSON.stringify(confluenceData, null, 2));

    // Extract and format Confluence pages
    const confluencePages = confluenceData.results?.map(page => ({
      id: page.id,
      title: page.title,
      url: `https://your-confluence-instance.atlassian.net${page._links.webui}`
    })) || [];

    console.log("Formatted Confluence Pages:", confluencePages);

    return {
      jiraTickets,
      confluencePages,
    };

  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return { error: error.message };
  }
};





// const confluenceText = await confluenceResponse.text();
// console.log('Confluence Response:', confluenceText);
    // // Fetch relevant Confluence pages
    // const confluenceResponse = await api.asApp().requestConfluence(route`/wiki/rest/api/content/search?cql=type=page AND creator=currentUser() ORDER BY lastModified DESC`, {
    //   method: 'GET',
    //   headers: {
    //     'Accept': 'application/json' // <== Ensure response is JSON
    //   }
    // });
    // const confluencePages = await confluenceResponse.json();


export async function onboardingAssistant(event, context) {

  // Fetch completed issues by the user
  const completedIssues = await getCompletedIssues();

  // Fetch high-priority Jira tickets assigned to the user
  const nextIssues = await getHighPriorityIssues(2);

  // Generate an appreciation message
  const appreciationMessage = getAppreciationMessage(completedIssues.length);

  // Format the response
  const responseMessage = formatResponse(appreciationMessage, nextIssues);

  return responseMessage;
}

// Helper function to fetch completed issues
async function getCompletedIssues() {
  const response = await api.asApp().requestJira(route`/rest/api/3/search`, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
          jql: `status = "Done" ORDER BY updated DESC`,
          maxResults: 5
      })
  });

  const data = await response.json();
  return data.issues || [];
}

// Helper function to fetch high-priority issues
async function getHighPriorityIssues(limit) {
  const response = await api.asApp().requestJira(route`/rest/api/3/search`, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
          jql: `status = "TO DO" AND description ~ "Priority: High" ORDER BY due ASC`,
          maxResults: limit
      })
  });

  const data = await response.json();
  return data.issues || [];
}

// Helper function to generate appreciation message
function getAppreciationMessage(completedCount) {
  if (completedCount === 0) return "You're off to a great start!";
  if (completedCount < 3) return `Great work! You've completed ${completedCount} tasks already.`;
  return `Awesome! You've completed ${completedCount} tasks. Keep up the momentum! 🚀`;
}

// Helper function to format response message
function formatResponse(appreciationMessage, issues) {
  let issueList = issues.map(issue => `- **${issue.fields.summary}**`).join("\n");

  return `${appreciationMessage}\n\nHere are your next high-priority tasks:\n${issueList}`;
}

