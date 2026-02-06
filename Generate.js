export default async function handler(req, res) {
  // Varmistetaan, että käytetään vain POST-metodia
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Luetaan API-avain Vercelin suojatusta ympäristöstä
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API-avain puuttuu palvelimelta. Lisää GEMINI_API_KEY Vercelin asetuksiin." });
  }

  const { contents, systemInstruction, useSearch } = req.body;
  
  // Käytetään uusinta Flash-mallia
  const model = "gemini-2.5-flash-preview-09-2025";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Rakennetaan pyyntö Googlelle
  const payload = {
    contents: contents,
    systemInstruction: systemInstruction
  };

  // Lisätään haku-työkalu, jos sitä on pyydetty (hinta-arviota varten)
  if (useSearch) {
    payload.tools = [{ "google_search": {} }];
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // Palautetaan vastaus selaimelle
    res.status(response.status).json(data);
  } catch (error) {
    console.error("API Proxy Error:", error);
    res.status(500).json({ error: "Yhteysvirhe tekoälypalvelimeen." });
  }
}

 
