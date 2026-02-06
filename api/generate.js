export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Luetaan avain Vercelin Environment Variables -kohdasta
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: "API-avain (GEMINI_API_KEY) puuttuu Vercelin asetuksista! Tarkista Settings -> Environment Variables." 
    });
  }

  const { contents, systemInstruction, useSearch } = req.body;
  const model = "gemini-2.5-flash-preview-09-2025";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: contents,
    systemInstruction: systemInstruction
  };

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
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.error?.message || "Googlen palvelu palautti virheen." 
      });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Palvelinvirhe: Yhteys tekoälyyn epäonnistui." });
  }
}

