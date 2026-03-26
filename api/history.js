
export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Brak konfiguracji Supabase' });
  }

  // GET — pobierz listę rozmów lub konkretną rozmowę
  if (req.method === 'GET') {
    const { userId, conversationId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    // Pobierz konkretną rozmowę
    if (conversationId) {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&user_id=eq.${userId}`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const data = await response.json();
      if (!data || data.length === 0) return res.status(404).json({ error: 'Nie znaleziono' });
      return res.status(200).json({ messages: data[0].messages || [] });
    }

    // Pobierz listę ostatnich 20 rozmów
    const response = await fetch(
      `${supabaseUrl}/rest/v1/conversations?user_id=eq.${userId}&order=updated_at.desc&limit=20`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const data = await response.json();

    const conversations = (data || []).map(c => ({
      id: c.id,
      title: c.title || 'Rozmowa',
      updatedAt: c.updated_at
    }));

    return res.status(200).json({ conversations });
  }

  // DELETE — usuń rozmowę
  if (req.method === 'DELETE') {
    const { userId, conversationId } = req.body;
    if (!userId || !conversationId) return res.status(400).json({ error: 'Brak danych' });

    await fetch(
      `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      }
    );

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Metoda niedozwolona' });
}
