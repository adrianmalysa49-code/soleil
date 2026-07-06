// Progi odblokowania dodatków (liczba głaskań) — wspólne źródło prawdy z frontendem (index.html)
const ACCESSORY_THRESHOLDS = { hat: 0, scarf: 5, bow: 15, glasses: 30 };

function unlockedAccessories(affection) {
  return Object.entries(ACCESSORY_THRESHOLDS)
    .filter(([, threshold]) => affection >= threshold)
    .map(([key]) => key);
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Brak konfiguracji Supabase' });
  }

  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    try {
      const petRes = await fetch(
        `${supabaseUrl}/rest/v1/user_pets?user_id=eq.${userId}`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const pets = await petRes.json();
      if (!pets || pets.length === 0) return res.status(200).json({ hasPet: false });

      const pet = pets[0];
      return res.status(200).json({
        hasPet: true,
        species: pet.species,
        affection: pet.affection || 0,
        equipped: pet.equipped_accessory || null,
        unlocked: unlockedAccessories(pet.affection || 0)
      });
    } catch (err) {
      console.error('Pet GET error:', err);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }

  if (req.method === 'POST') {
    const { userId, action, species, accessory } = req.body;
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    try {
      // Utwórz zwierzaka (jednorazowo, przy wyborze pies/kot)
      if (action === 'create') {
        if (species !== 'dog' && species !== 'cat') return res.status(400).json({ error: 'Nieprawidłowy gatunek' });

        const existingRes = await fetch(
          `${supabaseUrl}/rest/v1/user_pets?user_id=eq.${userId}`,
          { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        );
        const existing = await existingRes.json();
        if (existing && existing.length > 0) {
          return res.status(200).json({ hasPet: true, species: existing[0].species, affection: existing[0].affection || 0, equipped: existing[0].equipped_accessory || null, unlocked: unlockedAccessories(existing[0].affection || 0) });
        }

        await fetch(`${supabaseUrl}/rest/v1/user_pets`, {
          method: 'POST',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, species, affection: 0, equipped_accessory: null })
        });

        return res.status(200).json({ hasPet: true, species, affection: 0, equipped: null, unlocked: unlockedAccessories(0) });
      }

      // Głaskanie — zwiększ przywiązanie o 1
      if (action === 'pet') {
        const petRes = await fetch(
          `${supabaseUrl}/rest/v1/user_pets?user_id=eq.${userId}`,
          { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        );
        const pets = await petRes.json();
        if (!pets || pets.length === 0) return res.status(404).json({ error: 'Brak zwierzaka' });

        const before = pets[0].affection || 0;
        const after = before + 1;

        await fetch(`${supabaseUrl}/rest/v1/user_pets?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ affection: after, updated_at: new Date().toISOString() })
        });

        const unlockedBefore = unlockedAccessories(before);
        const unlockedAfter = unlockedAccessories(after);
        const newlyUnlocked = unlockedAfter.filter(a => !unlockedBefore.includes(a));

        return res.status(200).json({ affection: after, unlocked: unlockedAfter, newlyUnlocked });
      }

      // Załóż / zdejmij dodatek
      if (action === 'equip') {
        const petRes = await fetch(
          `${supabaseUrl}/rest/v1/user_pets?user_id=eq.${userId}`,
          { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        );
        const pets = await petRes.json();
        if (!pets || pets.length === 0) return res.status(404).json({ error: 'Brak zwierzaka' });

        const affection = pets[0].affection || 0;
        const unlocked = unlockedAccessories(affection);
        if (accessory !== null && !unlocked.includes(accessory)) {
          return res.status(400).json({ error: 'Dodatek jeszcze nieodblokowany' });
        }

        await fetch(`${supabaseUrl}/rest/v1/user_pets?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ equipped_accessory: accessory || null, updated_at: new Date().toISOString() })
        });

        return res.status(200).json({ equipped: accessory || null });
      }

      return res.status(400).json({ error: 'Nieznana akcja' });
    } catch (err) {
      console.error('Pet POST error:', err);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }

  return res.status(405).json({ error: 'Metoda niedozwolona' });
}
