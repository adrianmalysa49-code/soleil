export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Brak konfiguracji Supabase' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Brak userId' });

  // Pobierz ostatnią rozmowę użytkownika
  const response = await fetch(
    `${supabaseUrl}/rest/v1/conversations?user_id=eq.${userId}&order=updated_at.desc&limit=1`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    }
  );

  const data = await response.json();

  if (!data || data.length === 0) {
    return res.status(200).json({ messages: [], conversationId: null });
  }

  return res.status(200).json({
    messages: data[0].messages || [],
    conversationId: data[0].id
  });
}
