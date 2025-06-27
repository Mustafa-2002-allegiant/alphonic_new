const vicidialDB = require('./vicidialDB');

// Function to assign bot to a campaign
const assignBotToCampaign = async (botId, campaignId) => {
  const query = `
    UPDATE vicidial_campaigns SET bot_id = ? WHERE campaign_id = ?;
  `;

  try {
    const [results] = await vicidialDB.execute(query, [botId, campaignId]);
    console.log(`Bot ${botId} assigned to campaign ${campaignId}:`, results);
  } catch (err) {
    console.error('Error assigning bot to campaign:', err);
  }
};

// Example usage
assignBotToCampaign("5555", "1001");
