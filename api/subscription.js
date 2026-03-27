export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Brak konfiguracji' });
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Metoda niedozwolona' });

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Brak userId' });

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${userId}`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const data = await response.json();

    if (!data || data.length === 0) {
      return res.status(200).json({ isPremium: false, status: 'inactive' });
    }

    return res.status(200).json({
      isPremium: data[0].is_premium || false,
      status: data[0].subscription_status || 'inactive'
    });

  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' });
  }
}
