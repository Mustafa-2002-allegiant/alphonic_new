const fetch = require("node-fetch");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Allow self-signed certs

const transferToCampaign002 = async () => {
  const formData = new URLSearchParams({
    source: "api",
    user: "8024",
    pass: "hello123",
    function: "external_dial",
    phone_number: "9999999999",
    phone_code: "1",
    search: "NO",
    preview: "NO",
    focus: "YES",
    vendor_lead_code: "API_XFER",
    group_alias: "",
    handle_method: "CID",
    dial_prefix: "9",
    campaign_id: "002",
    alt_dial: "NONE",
    format: "text"
  });

  try {
    const res = await fetch("https://138.201.82.40/agc/api.php", {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    const text = await res.text();
    console.log("📞 Transfer to 002 Response:", text);
  } catch (err) {
    console.error("❌ Transfer to 002 Failed:", err);
  }
};

// ✅ Run the function properly:
(async () => {
  await transferToCampaign002();
})();
